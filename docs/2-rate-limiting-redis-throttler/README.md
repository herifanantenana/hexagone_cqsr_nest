# 2 — Rate Limiting avec Redis et @nestjs/throttler

## Objectif

Ajouter un **rate limiting production-ready** dans le projet NestJS hexagonal existant :

- Stockage Redis partagé (pas en mémoire — sinon ça ne tient pas en multi-instance)
- `@nestjs/throttler` avec un guard custom qui identifie par **userId** (si authentifié) ou par **IP réelle** (si anonyme, compatible proxy)
- 3 niveaux de limitation : **global**, **auth** (login/signup/refresh), **upload** (avatar)
- Exemptions possibles (`@SkipThrottle()` sur `/health`)
- Réponses 429 propres
- Aucune logique métier qui fuit dans Domain/Application

---

## Prérequis

- Le projet du Concept 1 fonctionne (auth + user OK)
- Un serveur Redis accessible (local ou distant)
  - **Local** : `sudo apt install redis-server` puis `redis-cli ping` → `PONG`
  - **Distant** : Upstash, Redis Cloud, etc. → tu as une URL de connexion

---

## Étapes (pas à pas)

### Étape 1 — Installer les dépendances

```bash
pnpm add @nestjs/throttler ioredis @nest-lab/throttler-storage-redis
```

> `@nest-lab/throttler-storage-redis` est le package **maintenu** pour brancher Throttler sur Redis. Ne code pas ton propre storage.

### Étape 2 — Créer le module Redis commun

**Emplacement** : `src/arch/common/infra/redis/`

Créer 3 fichiers :

1. **`redis.config.ts`** — Lit `REDIS_URL` depuis `ConfigService`, retourne la config `ioredis`.

2. **`redis.client.ts`** — Fournisseur custom qui instancie `new Redis(url)` et le fournit via un token d'injection (ex : `REDIS_CLIENT`).

3. **`redis.module.ts`** — Module `@Global()` qui :
   - Importe `ConfigModule`
   - Déclare le provider Redis
   - Exporte le token `REDIS_CLIENT`

**Pourquoi `@Global()`** : Redis sera utilisé par Throttler et potentiellement d'autres modules. Un seul enregistrement suffit.

### Étape 3 — Configurer ThrottlerModule

Dans `app.module.ts`, importer `ThrottlerModule.forRootAsync(...)` :

```
ThrottlerModule.forRootAsync({
  imports: [ConfigModule],
  inject: [ConfigService, REDIS_CLIENT],
  useFactory: (config, redis) => ({
    throttlers: [
      { name: 'global', ttl: 60_000, limit: config.get('THROTTLE_GLOBAL_LIMIT', 120) },
      { name: 'auth',   ttl: 60_000, limit: config.get('THROTTLE_AUTH_LIMIT', 5) },
      { name: 'upload', ttl: 60_000, limit: config.get('THROTTLE_UPLOAD_LIMIT', 10) },
    ],
    storage: new ThrottlerStorageRedisService(redis),
  }),
});
```

**Explication des 3 throttlers** :

| Nom      | Limite/min | S'applique à                    |
| -------- | ---------- | ------------------------------- |
| `global` | 120        | Toute requête (par défaut)      |
| `auth`   | 5          | Login, signup, refresh (opt-in) |
| `upload` | 10         | Upload avatar (opt-in)          |

`global` s'applique à tout. `auth` et `upload` sont **opt-in** : ils ne s'activent que si tu mets un décorateur sur le endpoint.

### Étape 4 — Créer le RateLimitGuard custom

**Emplacement** : `src/arch/common/interface/http/guards/rate-limit.guard.ts`

Ce guard **étend** `ThrottlerGuard` et surcharge 2 méthodes :

1. **`getTracker(req)`** — Retourne :
   - `req.user.sub` (userId) si l'utilisateur est authentifié
   - IP réelle sinon (`req.ip`, ou `x-forwarded-for` si `TRUST_PROXY=true`)

2. **`handleRequest(requestProps)`** — Logique pour rendre `auth` et `upload` opt-in :
   - Si le throttler est `global` → toujours appliquer
   - Si le throttler est `auth` → appliquer seulement si le handler a le metadata `THROTTLE_AUTH`
   - Si le throttler est `upload` → appliquer seulement si le handler a le metadata `THROTTLE_UPLOAD`

**Pourquoi un guard custom** : Le ThrottlerGuard par défaut applique TOUS les throttlers à TOUTES les routes. On veut `auth` et `upload` uniquement sur certains endpoints.

### Étape 5 — Créer les décorateurs

**Emplacement** : `src/arch/common/interface/http/decorators/rate-limit.decorators.ts`

```
@AuthThrottle()   → Reflector.set(THROTTLE_AUTH, true)
@UploadThrottle() → Reflector.set(THROTTLE_UPLOAD, true)
```

Ces décorateurs sont à placer sur les méthodes de controller ciblées.

### Étape 6 — Enregistrer le guard globalement

Dans `app.module.ts`, ajouter aux providers :

```
{ provide: APP_GUARD, useClass: RateLimitGuard }
```

**Ordre des guards** : Le RateLimitGuard doit être **avant** JwtAuthGuard et PermissionsGuard. L'ordre dans le tableau `providers` détermine l'ordre d'exécution.

### Étape 7 — Appliquer les décorateurs

| Endpoint                | Décorateur          |
| ----------------------- | ------------------- |
| `POST /auth/signup`     | `@AuthThrottle()`   |
| `POST /auth/login`      | `@AuthThrottle()`   |
| `POST /auth/refresh`    | `@AuthThrottle()`   |
| `POST /users/me/avatar` | `@UploadThrottle()` |
| `GET /health`           | `@SkipThrottle()`   |

### Étape 8 — Réponse 429 propre

Le `GlobalExceptionFilter` doit gérer `ThrottlerException` :

```
ThrottlerException → 429 Too Many Requests
{
  statusCode: 429,
  error: "Too Many Requests",
  message: "Trop de requêtes, réessayez plus tard.",
  requestId: "...",
  timestamp: "...",
  path: "..."
}
```

### Étape 9 — Support proxy (production)

Si l'app est derrière un reverse proxy (Nginx, Cloudflare, etc.) :

1. Dans `main.ts` :

   ```
   if (configService.get('TRUST_PROXY') === 'true') {
     app.getHttpAdapter().getInstance().set('trust proxy', 1);
   }
   ```

2. Le `RateLimitGuard` utilise alors `req.ip` qui contient la vraie IP client.

> **DANGER** : Ne mets `TRUST_PROXY=true` que si tu es réellement derrière un proxy de confiance. Sinon un attaquant peut spoofer son IP via le header `X-Forwarded-For`.

---

## Où mettre quoi dans /arch

| Fichier / Module                               | Couche         | Emplacement                                                 |
| ---------------------------------------------- | -------------- | ----------------------------------------------------------- |
| Module Redis (`@Global`)                       | Infrastructure | `common/infra/redis/`                                       |
| Redis config                                   | Infrastructure | `common/infra/redis/redis.config.ts`                        |
| Redis client provider                          | Infrastructure | `common/infra/redis/redis.client.ts`                        |
| RateLimitGuard                                 | Interface      | `common/interface/http/guards/rate-limit.guard.ts`          |
| Décorateurs `@AuthThrottle`, `@UploadThrottle` | Interface      | `common/interface/http/decorators/rate-limit.decorators.ts` |
| Constantes throttle                            | Interface      | `common/interface/http/constants/rate-limit.constants.ts`   |
| Config ThrottlerModule                         | Interface      | `app.module.ts` (imports)                                   |

**Rien ne va dans Domain ni Application.** Le rate limiting est un concern purement Infrastructure/Interface.

---

## Config (.env)

Ajouter à `.env` et `.env.example` :

```env
# --- Redis ---
REDIS_URL=redis://localhost:6379

# --- Rate Limiting ---
THROTTLE_GLOBAL_LIMIT=120
THROTTLE_AUTH_LIMIT=5
THROTTLE_UPLOAD_LIMIT=10

# --- Proxy ---
TRUST_PROXY=false
```

---

## Pièges à éviter

| Piège                                            | Pourquoi                                                                                 | Solution                                                        |
| ------------------------------------------------ | ---------------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| Stocker les compteurs en mémoire (default)       | En multi-instance, chaque instance a ses propres compteurs → le rate limit est contourné | Utiliser `ThrottlerStorageRedisService`                         |
| Coder un storage Redis maison                    | Bugs subtils (race conditions, TTL), maintenance                                         | Utiliser `@nest-lab/throttler-storage-redis`                    |
| Appliquer tous les throttlers partout            | Login limité à 120/min au lieu de 5/min                                                  | Rendre `auth`/`upload` opt-in via metadata dans le guard custom |
| Tracker par IP sans `trust proxy` derrière Nginx | Toutes les requêtes viennent de `127.0.0.1` → tout le monde partage le même compteur     | Configurer `trust proxy` dans Express                           |
| Mettre `TRUST_PROXY=true` sans proxy             | Un attaquant peut spoofer son IP via `X-Forwarded-For`                                   | Uniquement si tu es derrière un proxy de confiance              |
| Oublier `@SkipThrottle()` sur `/health`          | Les health checks de monitoring consomment le rate limit                                 | Exclure explicitement                                           |
| Mettre la logique rate limit dans Application    | Le rate limiting est un concern d'infra, pas métier                                      | Guard + décorateurs dans Interface, storage dans Infra          |
| Ne pas gérer la déconnexion Redis                | Si Redis tombe, toutes les requêtes sont refusées ou crashent                            | Tester le comportement, éventuellement fail-open en dev         |

---

## Checklist DONE

- [ ] `pnpm add @nestjs/throttler ioredis @nest-lab/throttler-storage-redis` installé
- [ ] Le module Redis est créé dans `common/infra/redis/` et est `@Global()`
- [ ] Redis se connecte au démarrage (vérifier les logs)
- [ ] `ThrottlerModule` configuré avec 3 throttlers nommés (global, auth, upload)
- [ ] `RateLimitGuard` custom créé et enregistré globalement (`APP_GUARD`)
- [ ] Le guard identifie par userId si authentifié, par IP sinon
- [ ] `@AuthThrottle()` appliqué sur signup, login, refresh
- [ ] `@UploadThrottle()` appliqué sur upload avatar
- [ ] `@SkipThrottle()` appliqué sur `/health`
- [ ] Après 5 login rapides → réponse 429 avec le format d'erreur standard
- [ ] Après 120 requêtes anonymes rapides → réponse 429
- [ ] La réponse 429 inclut `requestId`, `timestamp`, `path`
- [ ] Les variables `THROTTLE_*` et `REDIS_URL` sont dans `.env.example`
- [ ] `TRUST_PROXY` est documenté dans `.env.example`
- [ ] Aucun code rate-limiting dans Domain ou Application

---

## Tests manuels (curl)

### Vérifier que `/health` est exempt

```bash
for i in $(seq 1 200); do curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/health; done
# Toutes les réponses doivent être 200, jamais 429
```

### Tester le rate limit global (anonyme)

```bash
# Envoie 130 requêtes rapides sur un endpoint public
for i in $(seq 1 130); do curl -s -o /dev/null -w "$i: %{http_code}\n" http://localhost:3000/users/some-uuid; done
# Les 120 premières → 200 ou 404
# À partir de ~121 → 429
```

### Tester le rate limit auth (login)

```bash
# Envoie 8 tentatives de login rapides
for i in $(seq 1 8); do
  curl -s -o /dev/null -w "$i: %{http_code}\n" \
    -X POST http://localhost:3000/auth/login \
    -H "Content-Type: application/json" \
    -d '{"email":"test@example.com","password":"wrong"}'
done
# Les 5 premières → 401 (credentials invalides)
# À partir de ~6 → 429 (rate limited)
```

### Vérifier le format de la réponse 429

```bash
# Après avoir déclenché un 429 :
curl -s -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"wrong"}' | jq
# Doit retourner :
# {
#   "statusCode": 429,
#   "error": "Too Many Requests",
#   "message": "...",
#   "requestId": "uuid",
#   "timestamp": "...",
#   "path": "/auth/login"
# }
```

### Tester que le tracking est par userId (authentifié)

```bash
# Login pour obtenir un token
TOKEN=$(curl -s -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"MyP@ss123"}' | jq -r '.accessToken')

# Envoie 130 requêtes authentifiées
for i in $(seq 1 130); do
  curl -s -o /dev/null -w "$i: %{http_code}\n" \
    http://localhost:3000/users/me \
    -H "Authorization: Bearer $TOKEN"
done
# Le compteur est par userId, pas par IP
# Donc un autre user depuis la même IP a son propre compteur
```

### Vérifier que Redis stocke les clés

```bash
redis-cli KEYS "throttler:*"
# Doit montrer des clés avec des patterns userId ou IP
```
