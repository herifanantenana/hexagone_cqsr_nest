# 5 — Finalisation HTTP : Application Cohérente et Production-Ready

## Objectif

Obtenir une application NestJS **réellement fonctionnelle, cohérente et éducative** — pas un prototype avec des morceaux manquants. Ce concept est une **revue de finalisation** qui s'assure que tout est branché, documenté, testé et que rien n'est déclaré sans être utilisé.

Vérifier et compléter :
- Auth complète (JWT access 15 min + refresh sessions, rotation, logout, change-password)
- Authorization resource/actions (`@Can` + `PermissionsGuard` + policies + `OptionalAuthGuard`)
- Module Posts complet (CRUD + visibilité + pagination + seeds)
- Swagger avancé fidèle (bearerAuth, DTOs, erreurs standard, `/health`)
- Rate limiting avancé (Throttler + Redis, global/auth/upload, tracker userId/IP, 429 clair)
- Composants communs réellement branchés (filter, middleware, interceptor)
- Commentaires pédagogiques simples (sans excès)

---

## Prérequis

- Les Concepts 1 à 4 sont implémentés
- Le projet compile (`pnpm build` sans erreur)
- PostgreSQL et Redis sont accessibles

---

## Étapes (pas à pas)

### Étape 1 — Audit de cohérence : rien d'inutilisé

Parcours chaque fichier et vérifie :

**Imports inutilisés** :
```bash
pnpm build
# Le compilateur TypeScript signale les imports inutilisés si strict est activé
```

**Composants déclarés mais non branchés** : Ouvre `app.module.ts` et vérifie que chaque composant listé est réellement enregistré :

| Composant              | Comment il est enregistré                | ✓ |
|------------------------|------------------------------------------|---|
| `GlobalExceptionFilter`| `{ provide: APP_FILTER, useClass: ... }` |   |
| `HttpLoggingInterceptor`| `{ provide: APP_INTERCEPTOR, useClass: ... }` |   |
| `RateLimitGuard`       | `{ provide: APP_GUARD, useClass: ... }`  |   |
| `PermissionsGuard`     | `{ provide: APP_GUARD, useClass: ... }`  |   |
| `RequestIdMiddleware`  | `configure(consumer) { consumer.apply(...).forRoutes('*') }` |   |

**Modules importés mais non utilisés** : Si tu importes un module mais qu'aucun de ses exports n'est injecté → le supprimer.

**Dossiers vides** :
```bash
find src/arch -type d -empty
# Doit retourner RIEN
```

### Étape 2 — Vérifier l'authent complète

Teste le cycle complet :

```
signup → login → accès protégé → refresh → accès protégé (nouveau token) → logout → refresh échoue
```

Et le cycle change-password :

```
login → change-password → refresh avec l'ancien token → échoue (toutes sessions révoquées)
```

**Points à vérifier dans le code** :

| Vérification | Fichier | Fait ? |
|-------------|---------|--------|
| Access token signé avec `JWT_ACCESS_SECRET` | JwtTokenAdapter | |
| Refresh token signé avec `JWT_REFRESH_SECRET` (différent !) | JwtTokenAdapter | |
| Access token TTL = `JWT_ACCESS_EXPIRATION` (15m) | JwtTokenAdapter | |
| Refresh token TTL = `JWT_REFRESH_EXPIRATION` (7d) | JwtTokenAdapter | |
| Refresh token hashé avant stockage en DB | SignupHandler, LoginHandler | |
| Refresh : vérifie session exists + non revoked + non expired + hash OK | RefreshTokenHandler | |
| Refresh : rotation (révoque ancienne, crée nouvelle) | RefreshTokenHandler | |
| Logout : révoque la session du user | LogoutHandler | |
| ChangePassword : révoque TOUTES les sessions | ChangePasswordHandler | |

### Étape 3 — Vérifier l'authorization

| Vérification | Fait ? |
|-------------|--------|
| `@Can('posts', 'create')` sur `POST /posts` | |
| `@Can('user', 'read')` sur `GET /users/me` | |
| `@Can('user', 'update')` sur `PUT /users/me` | |
| `PermissionsGuard` global dans `app.module.ts` | |
| `OptionalAuthGuard` sur `GET /posts` et `GET /posts/:id` | |
| Post visibility policy dans Domain | |
| Post ownership vérifié dans le handler (pas le controller) | |

### Étape 4 — Vérifier le module Posts

| Vérification | Fait ? |
|-------------|--------|
| Table `posts` dans le schema Drizzle | |
| View `postsPublicView` créée | |
| Migration générée et appliquée | |
| Seed insère des posts publics et privés | |
| `POST /posts` crée un post | |
| `GET /posts` avec pagination (page, limit) | |
| `GET /posts` anonyme → publics uniquement | |
| `GET /posts` authentifié → publics + ses privés | |
| `GET /posts/:id` applique la policy de visibilité | |
| `PATCH /posts/:id` vérifie ownership | |
| `DELETE /posts/:id` vérifie ownership | |
| `PostRepositoryPort` dans Application | |
| `PostRepositoryAdapter` dans Infrastructure | |
| Module posts branché dans `app.module.ts` | |

### Étape 5 — Vérifier Swagger

Ouvre `http://localhost:3000/api/docs` et vérifie :

| Vérification | Fait ? |
|-------------|--------|
| Swagger accessible | |
| Bouton "Authorize" présent (Bearer Auth) | |
| Sections par tags : auth, users, posts, health | |
| Chaque DTO a des exemples (valeurs dans `@ApiProperty()`) | |
| Les réponses d'erreur 400/401/403/404/429 sont documentées | |
| Le format d'erreur standard est décrit | |
| L'endpoint `GET /health` est présent | |
| Les endpoints de pagination montrent les query params | |
| La documentation reflète le comportement RÉEL | |

**Point critique** : Si Swagger dit qu'un endpoint retourne `201` mais que le code retourne `200`, corriger l'un ou l'autre. La doc doit être fidèle.

### Étape 6 — Vérifier le Rate Limiting

| Vérification | Fait ? |
|-------------|--------|
| Redis se connecte au démarrage (vérifier les logs) | |
| `ThrottlerModule` avec 3 throttlers (global, auth, upload) | |
| `RateLimitGuard` global dans `app.module.ts` | |
| `@AuthThrottle()` sur signup, login, refresh | |
| `@UploadThrottle()` sur upload avatar | |
| `@SkipThrottle()` sur `/health` | |
| 429 après dépassement de limite | |
| Le format de la réponse 429 est standard | |
| `TRUST_PROXY` est configuré si derrière un proxy | |

### Étape 7 — Vérifier les composants communs

**GlobalExceptionFilter** :
- Mappe toutes les erreurs Domain vers le bon code HTTP
- Format standard : `{ statusCode, error, message, requestId, timestamp, path }`
- Stack trace log (pas dans la réponse) pour les 5xx
- Gère `ThrottlerException` → 429

**RequestIdMiddleware** :
- UUID généré pour chaque requête
- Réutilise `x-request-id` si déjà présent (propagation proxy)
- Present dans le header de réponse

**HttpLoggingInterceptor** :
- Log incoming : method, path, IP, requestId, userId (si auth)
- Log outgoing : statusCode, duration
- Niveaux : 2xx/3xx → info, 4xx → warn, 5xx → error

### Étape 8 — Commentaires pédagogiques

Ajouter des commentaires **simples et utiles** (pas du jargon) dans les fichiers clés :

```typescript
// Ce guard vérifie que l'utilisateur a la permission requise par @Can()
// Les permissions sont lues directement depuis le JWT, sans appel DB
```

**Règles** :
- Un commentaire par concept, pas un commentaire par ligne
- Pas de commentaire évident (`// Importe le module` → inutile)
- Expliquer le **pourquoi**, pas le **quoi**
- Ne pas ajouter de commentaires dans des fichiers que tu n'as pas modifiés

### Étape 9 — Vérifier `package.json`

```json
{
  "scripts": {
    "build": "nest build",
    "dev": "nest start --watch",
    "start": "nest start",
    "start:prod": "node dist/main",
    "lint": "eslint \"{src,apps,libs,test}/**/*.ts\" --fix",
    "format": "prettier --write \"src/**/*.ts\"",
    "migrate:generate": "drizzle-kit generate",
    "migrate:push": "drizzle-kit push",
    "migrate": "tsx src/arch/common/db/migrations/run-migrations.ts",
    "seed": "tsx src/arch/common/db/seeds/seed.dev.ts",
    "db:studio": "drizzle-kit studio"
  }
}
```

Chaque script doit **fonctionner**. Teste :
```bash
pnpm build    # Compile
pnpm dev      # Démarre en watch
pnpm seed     # Exécute le seed
```

### Étape 10 — Vérifier `.env.example`

Le fichier `.env.example` doit contenir **toutes** les variables avec des valeurs d'exemple :

```env
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/mydb

# JWT
JWT_ACCESS_SECRET=your-super-secret-access-key-change-in-production
JWT_REFRESH_SECRET=your-super-secret-refresh-key-change-in-production
JWT_ACCESS_EXPIRATION=15m
JWT_REFRESH_EXPIRATION=7d

# Application
PORT=3000
NODE_ENV=development

# Upload
UPLOAD_DIR=./uploads
MAX_FILE_SIZE=2097152

# Redis
REDIS_URL=redis://localhost:6379

# Rate Limiting
THROTTLE_GLOBAL_LIMIT=120
THROTTLE_AUTH_LIMIT=5
THROTTLE_UPLOAD_LIMIT=10

# Proxy
TRUST_PROXY=false
```

---

## Où mettre quoi dans /arch

Ce concept ne rajoute pas de nouveaux fichiers. Il s'assure que la structure existante est correcte :

```
src/arch/
├── common/
│   ├── db/               ← Schema, migrations, seeds
│   └── interface/http/   ← Middleware, guards, filters, interceptors, decorators
├── shared/
│   ├── types/            ← UserPrincipal, pagination
│   └── utils/            ← ID generator
└── modules/
    ├── auth/             ← Domain → Application → Infrastructure → Interface
    ├── user/             ← Domain → Application → Infrastructure → Interface
    └── posts/            ← Domain → Application → Infrastructure → Interface
```

Si tu trouves un fichier dans le mauvais dossier (ex: un adapter dans Application), déplace-le.

---

## Config (.env)

Pas de nouvelles variables. Ce concept vérifie que `.env.example` est complet et fidèle.

---

## Pièges à éviter

| Piège | Pourquoi | Solution |
|-------|----------|----------|
| Déclarer un guard dans `app.module.ts` sans qu'il soit réellement exécuté | Faux sentiment de sécurité | Tester avec un request invalide et vérifier que le guard rejette |
| Swagger qui ne reflète pas la réalité | Les devs font confiance à la doc → ils reportent des bugs fantômes | Tester chaque endpoint Swagger vs curl et comparer |
| Seed qui crée des données incohérentes | Tests manuels cassés, mauvaise première impression | Le seed doit créer un scénario complet : 2 users, des posts publics/privés, des sessions |
| Commentaires copiés-collés du concept sans adaptation | Confus, pas pédagogique | Rédiger des commentaires cohérents avec le code réel |
| Oublier de tester `pnpm build` après les modifications | L'app ne compile pas → rien ne marche | Toujours terminer par `pnpm build` |
| Laisser traîner des `console.log` | Bruit dans les logs, pas professionnel | Utiliser le logger Winston à la place |
| Variables `.env` qui ne sont référencées nulle part dans le code | Confusion, on ne sait pas si c'est utilisé | Chaque variable dans `.env.example` doit être lue par `ConfigService` quelque part |

---

## Checklist DONE

### Compilation et démarrage
- [ ] `pnpm build` compile sans erreur ni warning
- [ ] `pnpm dev` démarre sans erreur
- [ ] Aucun `console.log` résiduel (uniquement Winston)

### Pas de code mort
- [ ] `find src/arch -type d -empty` ne retourne rien
- [ ] Aucun import inutilisé
- [ ] Aucun composant déclaré dans `app.module.ts` mais non branché
- [ ] Aucun fichier créé "pour plus tard" qui n'est pas utilisé

### Auth complète
- [ ] Cycle complet signup → login → refresh → logout testé
- [ ] Change-password → toutes sessions révoquées
- [ ] Token expiré → 401 clair
- [ ] Refresh avec token révoqué → 401

### Authorization
- [ ] `@Can()` utilisé sur les endpoints appropriés
- [ ] `PermissionsGuard` actif globalement
- [ ] `OptionalAuthGuard` sur les routes de lecture publique
- [ ] Policies d'ownership dans Domain
- [ ] 401 (pas de token) vs 403 (pas de permission) distinction claire

### Posts
- [ ] CRUD complet fonctionnel via curl
- [ ] Pagination testée
- [ ] Visibilité public/private respectée
- [ ] Ownership vérifié pour update/delete
- [ ] Seed avec des données de test

### Swagger
- [ ] Accessible sur `/api/docs`
- [ ] Bearer Auth fonctionnel
- [ ] Tous les endpoints documentés et fidèles
- [ ] Format d'erreur standard documenté

### Rate Limiting
- [ ] Redis connecté
- [ ] 3 throttlers actifs
- [ ] 429 après dépassement
- [ ] `/health` exempt

### Composants communs
- [ ] `x-request-id` dans toutes les réponses
- [ ] Erreurs au format standard
- [ ] Logs HTTP dans la console

### Configuration
- [ ] `.env.example` complet et fidèle
- [ ] Tous les scripts `package.json` fonctionnent
- [ ] `drizzle.config.ts` pointe vers le bon schema

---

## Tests manuels (curl)

### Scénario complet de bout en bout

```bash
# 1. Health check
curl -s http://localhost:3000/health | jq

# 2. Signup
SIGNUP=$(curl -s -X POST http://localhost:3000/auth/signup \
  -H "Content-Type: application/json" \
  -d '{"email":"final@test.com","password":"FinalP@ss1","displayName":"Final User"}')
echo $SIGNUP | jq
ACCESS=$(echo $SIGNUP | jq -r '.accessToken')
REFRESH=$(echo $SIGNUP | jq -r '.refreshToken')

# 3. Profil "me"
curl -s http://localhost:3000/users/me \
  -H "Authorization: Bearer $ACCESS" | jq

# 4. Update profil
curl -s -X PUT http://localhost:3000/users/me \
  -H "Authorization: Bearer $ACCESS" \
  -H "Content-Type: application/json" \
  -d '{"bio":"Mon bio de test"}' | jq

# 5. Créer un post public
POST_PUB=$(curl -s -X POST http://localhost:3000/posts \
  -H "Authorization: Bearer $ACCESS" \
  -H "Content-Type: application/json" \
  -d '{"title":"Post Public","content":"Visible par tous","visibility":"public"}')
echo $POST_PUB | jq
PUB_ID=$(echo $POST_PUB | jq -r '.id')

# 6. Créer un post privé
POST_PRIV=$(curl -s -X POST http://localhost:3000/posts \
  -H "Authorization: Bearer $ACCESS" \
  -H "Content-Type: application/json" \
  -d '{"title":"Post Privé","content":"Moi seul","visibility":"private"}')
echo $POST_PRIV | jq
PRIV_ID=$(echo $POST_PRIV | jq -r '.id')

# 7. Lister les posts (anonyme) → pas de post privé
curl -s "http://localhost:3000/posts?page=1&limit=10" | jq

# 8. Lister les posts (auth) → include le privé
curl -s "http://localhost:3000/posts?page=1&limit=10" \
  -H "Authorization: Bearer $ACCESS" | jq

# 9. Accéder au post privé (owner) → OK
curl -s http://localhost:3000/posts/$PRIV_ID \
  -H "Authorization: Bearer $ACCESS" | jq

# 10. Accéder au post privé (anonyme) → 403/404
curl -s http://localhost:3000/posts/$PRIV_ID | jq

# 11. Refresh
TOKENS=$(curl -s -X POST http://localhost:3000/auth/refresh \
  -H "Content-Type: application/json" \
  -d "{\"refreshToken\":\"$REFRESH\"}")
echo $TOKENS | jq
ACCESS=$(echo $TOKENS | jq -r '.accessToken')
REFRESH=$(echo $TOKENS | jq -r '.refreshToken')

# 12. L'ancien refresh token ne marche plus
# (utiliser l'ancien REFRESH ici — il a été overwritten, mais si tu l'as sauvé, teste-le)

# 13. Logout
curl -s -X POST http://localhost:3000/auth/logout \
  -H "Authorization: Bearer $ACCESS" | jq

# 14. Refresh après logout → 401
curl -s -X POST http://localhost:3000/auth/refresh \
  -H "Content-Type: application/json" \
  -d "{\"refreshToken\":\"$REFRESH\"}" | jq

# 15. Vérifier le rate limit (login spam)
for i in $(seq 1 8); do
  echo -n "$i: "
  curl -s -o /dev/null -w "%{http_code}" \
    -X POST http://localhost:3000/auth/login \
    -H "Content-Type: application/json" \
    -d '{"email":"final@test.com","password":"wrong"}'
  echo
done
# Les 5 premiers → 401, ensuite → 429

# 16. Swagger
echo "Ouvrir : http://localhost:3000/api/docs"
```

Ce scénario teste TOUT le projet de bout en bout en une seule séquence.
