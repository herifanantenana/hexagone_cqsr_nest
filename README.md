# Hexagonal CQRS API — NestJS Learning Project

API REST éducative construite avec **NestJS**, **Architecture Hexagonale**, **CQRS**, **PostgreSQL** (Drizzle ORM) et **Passport.js**.

Ce projet montre comment structurer une vraie application back-end professionnelle, étape par étape.

---

## Table des matières

- [Démarrage rapide](#démarrage-rapide)
- [Architecture](#architecture)
- [Authentification (JWT + sessions)](#authentification-jwt--sessions)
- [Autorisation (permissions + ownership)](#autorisation-permissions--ownership)
- [Rate limiting (Redis)](#rate-limiting-redis)
- [Swagger (documentation API)](#swagger-documentation-api)
- [Exemples curl](#exemples-curl)
- [API Endpoints](#api-endpoints)
- [Logging (Winston)](#logging-winston)
- [Structure des dossiers](#structure-des-dossiers)
- [Comment ajouter un nouveau module](#comment-ajouter-un-nouveau-module)
- [Scripts disponibles](#scripts-disponibles)

---

## Démarrage rapide

### Prérequis

| Outil          | Version | Rôle                                                                             |
| -------------- | ------- | -------------------------------------------------------------------------------- |
| **Node.js**    | >= 18   | Runtime JavaScript                                                               |
| **pnpm**       | >= 8    | Gestionnaire de paquets (`npm install -g pnpm`)                                  |
| **PostgreSQL** | >= 14   | Base de données (local ou distant)                                               |
| **Redis**      | >= 6    | Stockage des compteurs rate-limiting ([Upstash](https://upstash.com) fonctionne) |

### Installation

```bash
# 1. Cloner le projet
git clone <url> && cd exemple-hexagone-cqsr

# 2. Installer les dépendances
pnpm install

# 3. Configurer l'environnement
cp .env.example .env
# → Ouvrir .env et renseigner DATABASE_URL, REDIS_URL, JWT_ACCESS_SECRET

# 4. Créer les tables et les vues SQL
pnpm migrate

# 5. Peupler la base avec des données de test
pnpm seed
# Crée 3 utilisateurs : john@example.com, jane@example.com, bob@example.com
# Mot de passe commun : Password123!
# Crée 6 posts variés (public + privé)
# Crée 1 conversation + 3 membres + 5 messages de test

# 6. Lancer le serveur en mode développement
pnpm dev
```

Le serveur démarre sur `http://localhost:3000`.
La documentation Swagger est accessible sur `http://localhost:3000/api/docs`.

---

## Architecture

Ce projet suit l'**Architecture Hexagonale** (ports & adapters) combinée au pattern **CQRS**.

### Les 4 couches

```
┌──────────────────────────────────────────────────────┐
│                    Interface (HTTP)                   │  ← Controllers, DTOs, Guards, Decorators
│                                                      │     Reçoit les requêtes, renvoie les réponses
├──────────────────────────────────────────────────────┤
│                    Application                       │  ← Commands, Queries, Handlers, Ports
│                                                      │     Orchestre les cas d'usage (CQRS)
├──────────────────────────────────────────────────────┤
│                      Domain                          │  ← Modèles, Services, Errors, Value Objects
│                                                      │     Règles métier pures (AUCUN import technique)
├──────────────────────────────────────────────────────┤
│                   Infrastructure                     │  ← Adapters (Drizzle, bcrypt, JWT, fichiers)
│                                                      │     Implémente les ports avec de la vraie techno
└──────────────────────────────────────────────────────┘
```

**Règle d'or :** Les dépendances vont toujours de l'extérieur vers l'intérieur.
Le **Domain** ne dépend de rien. L'**Application** dépend du Domain. L'**Infrastructure** implémente les ports définis par l'Application.

### CQRS en 30 secondes

| Concept     | Rôle                                    | Exemples                                                         |
| ----------- | --------------------------------------- | ---------------------------------------------------------------- |
| **Command** | Action qui modifie l'état               | `CreatePostCommand`, `LoginCommand`                              |
| **Query**   | Lecture de données, zéro effet de bord  | `ListPublicPostsQuery`, `GetMyProfileQuery`                      |
| **Handler** | Classe qui exécute une Command ou Query | `CreatePostHandler`, `LoginHandler`                              |
| **Port**    | Interface abstraite (contrat)           | `PostRepositoryPort`, `PasswordHasherPort`                       |
| **Adapter** | Implémentation concrète d'un port       | `PostRepositoryAdapter` (Drizzle), `BcryptPasswordHasherAdapter` |

**Comment NestJS fait le lien ?**
Dans le module, on déclare `{ provide: PostRepositoryPort, useClass: PostRepositoryAdapter }`.
Les handlers injectent le Port — NestJS fournit l'Adapter transparemment (Dependency Injection).

---

## Authentification (JWT + sessions)

### Access Token JWT (courte durée)

- Durée de vie : **15 minutes** par défaut (configurable via `JWT_ACCESS_TTL_SECONDS`)
- Contient dans le payload : `userId`, `email`, `permissions[]`
- Token expiré → **401** `{ "error": "TokenExpired", "message": "Access token has expired" }`
- Token invalide → **401** `{ "error": "InvalidToken" }`
- Vérifié par le `JwtStrategy` de Passport (`ignoreExpiration: false`)

### Refresh Token + Sessions (PostgreSQL)

- Le refresh token est un **UUID opaque** (PAS un JWT !)
- Stocké en base sous forme de **hash SHA-256** (table `sessions`)
- **Rotation obligatoire** : chaque refresh génère un nouveau token et révoque l'ancien

**Table sessions :**

| Colonne              | Description                            |
| -------------------- | -------------------------------------- |
| `id`                 | UUID de la session                     |
| `user_id`            | FK vers users                          |
| `refresh_token_hash` | SHA-256 du refresh token               |
| `expires_at`         | Date d'expiration (7 jours par défaut) |
| `revoked_at`         | `null` = active, date = révoquée       |
| `user_agent`         | Navigateur (optionnel)                 |
| `ip`                 | Adresse IP (optionnel)                 |

**Flow de refresh :**

1. Client envoie `POST /auth/refresh { refreshToken: "uuid-opaque" }`
2. Le handler hash le token (SHA-256), cherche la session en base
3. Vérifie : session existe, non révoquée, non expirée, user actif
4. Révoque l'ancienne session, crée une nouvelle avec un nouveau hash
5. Retourne un nouveau couple `accessToken` + `refreshToken`

**Logout** = révoque **toutes** les sessions du user (déconnexion sur tous les appareils).
**Change password** = révoque **toutes** les sessions du user (force re-login partout).

---

## Autorisation (permissions + ownership)

L'autorisation se fait en **2 niveaux complémentaires** :

### Niveau 1 : Permissions (Guard global stateless)

Chaque utilisateur reçoit des **permissions** embarquées dans le JWT au login :

```json
{
  "permissions": [
    { "resource": "posts", "actions": ["create", "read", "update", "delete"] },
    { "resource": "user", "actions": ["read", "update"] },
    { "resource": "conversations", "actions": ["read", "create"] },
    { "resource": "messages", "actions": ["read", "create"] }
  ]
}
```

Le décorateur `@Can(resource, action)` déclare la permission requise sur un endpoint :

```typescript
@Can('posts', 'create')  // L'utilisateur doit avoir posts:create
@Post()
async create(...) { }
```

Le `PermissionsGuard` (global, **zéro appel base de données**) applique la logique :

| Situation                                | Résultat                |
| ---------------------------------------- | ----------------------- |
| Pas de `@Can` sur la route               | ✅ Laisse passer        |
| `@Can` + pas de token                    | ❌ **401** Unauthorized |
| `@Can` + token mais permission manquante | ❌ **403** Forbidden    |
| `@Can` + token + permission OK           | ✅ Laisse passer        |

### Niveau 2 : Ownership (Domain Policy)

Les permissions ne suffisent pas pour les ressources privées :

- User B a `posts:update`, mais ne peut PAS modifier le post de User A
- C'est le **PostPolicyService** (couche domaine, pure logique) qui vérifie l'ownership

```
Permission (Guard)  →  Ownership (Domain Policy)
"As-tu le droit ?"      "Es-tu le propriétaire ?"
```

| Règle                        | Service                               | Résultat              |
| ---------------------------- | ------------------------------------- | --------------------- |
| Post public visible par tous | `PostPolicyService.canView()`         | ✅ OK                 |
| Post privé visible par owner | `PostPolicyService.canView()`         | ✅ si owner, ❌ sinon |
| Modifier un post             | `PostPolicyService.assertCanModify()` | ✅ si owner, ❌ sinon |

### OptionalAuthGuard (routes publiques mixtes)

`GET /posts/:id` utilise `OptionalAuthGuard` — comportement adaptatif :

- **Pas de token** → `req.user = null`, le domain décide (public = OK, private = 403)
- **Token valide** → `req.user` peuplé, le domain vérifie l'ownership
- **Token invalide** → `req.user = null` (ne rejette pas, traite comme anonyme)

### Comment ajouter une nouvelle permission

1. Ajouter dans `DEFAULT_PERMISSIONS` (dans `login.command.ts` et `refresh-token.command.ts`)
2. Utiliser `@Can('ma-resource', 'mon-action')` sur le controller
3. C'est tout — `PermissionsGuard` le vérifie automatiquement grâce au décorateur

---

## Rate Limiting (Redis)

### Pourquoi Redis ?

Les compteurs de rate limiting sont stockés dans Redis au lieu de la mémoire du serveur.
Si vous avez **plusieurs instances** du serveur (load balancer), chaque instance partage les mêmes compteurs.
Sans Redis, un attaquant pourrait faire `120 req × N instances` avant d'être bloqué.

### 3 niveaux de throttle

| Niveau     | Limite par défaut | Appliqué sur           | Décorateur          |
| ---------- | ----------------- | ---------------------- | ------------------- |
| **Global** | 120 req/min       | Toutes les routes      | Automatique         |
| **Auth**   | 5 req/min         | login, signup, refresh | `@AuthThrottle()`   |
| **Upload** | 10 req/min        | avatar upload          | `@UploadThrottle()` |

- Authentifié → rate limit par `userId`
- Anonyme → rate limit par `IP`
- Derrière un proxy → activer `TRUST_PROXY=true` pour utiliser `x-forwarded-for`
- Désactiver le rate limit sur une route → `@SkipAllThrottle()`

### Comment tester le 429

```bash
# Boucle de 6 logins rapides (limite auth = 5/min)
for i in $(seq 1 6); do
  curl -s -o /dev/null -w "%{http_code}\n" -X POST http://localhost:3000/auth/login \
    -H "Content-Type: application/json" \
    -d '{"email":"john@example.com","password":"Password123!"}'
done
# Les 5 premiers → 200, le 6e → 429 Too Many Requests
```

---

## Swagger (documentation API)

Documentation interactive : **http://localhost:3000/api/docs**

1. Cliquer sur **Authorize** 🔓 et coller un access token pour tester les routes protégées
2. Tous les endpoints affichent les codes de réponse possibles (200, 201, 400, 401, 403, 404, 409, 429)
3. Les DTOs montrent des exemples réalistes via `@ApiProperty({ example: ... })`

### Format d'erreur standardisé

Toute erreur retourne la même structure :

```json
{
  "statusCode": 401,
  "error": "TokenExpired",
  "message": "Access token has expired",
  "requestId": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
  "timestamp": "2025-02-15T10:30:00.000Z",
  "path": "/users/me"
}
```

Le `requestId` est généré par le `RequestIdMiddleware` et propagé dans les logs + la réponse.

---

## Exemples curl

### Inscription

```bash
curl -X POST http://localhost:3000/auth/signup \
  -H "Content-Type: application/json" \
  -d '{
    "email": "alice@example.com",
    "password": "SecureP@ss1!",
    "displayName": "Alice"
  }'
# → 201 { "userId": "...", "email": "alice@example.com", "displayName": "Alice" }
```

### Connexion (stocker les tokens)

```bash
LOGIN=$(curl -s -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"john@example.com","password":"Password123!"}')

echo "$LOGIN"
# → { "accessToken": "eyJ...", "refreshToken": "a1b2c3...", "expiresIn": 900, "tokenType": "Bearer" }

TOKEN=$(echo "$LOGIN" | jq -r '.accessToken')
REFRESH=$(echo "$LOGIN" | jq -r '.refreshToken')
```

### Créer un post (protégé)

```bash
curl -X POST http://localhost:3000/posts \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "title": "Mon premier post",
    "content": "Hello World depuis l architecture hexagonale !",
    "visibility": "public"
  }'
# → 201 { "id": "...", "ownerId": "...", "title": "Mon premier post", ... }
```

### Lister les posts publics

```bash
curl "http://localhost:3000/posts?page=1&pageSize=10"
# → 200 { "data": [...], "total": 6, "page": 1, "pageSize": 10, "totalPages": 1 }
```

### Voir un post public (sans token)

```bash
curl http://localhost:3000/posts/<post-id>
# → 200 si public, 403 si privé (car pas de token → pas d'owner)
```

### Voir un post privé (en tant qu'owner)

```bash
curl http://localhost:3000/posts/<post-id-prive> \
  -H "Authorization: Bearer $TOKEN"
# → 200 si vous êtes l'owner, 403 sinon
```

### Token expiré → 401

```bash
# Attendez 15 minutes ou utilisez un token expiré :
curl http://localhost:3000/users/me \
  -H "Authorization: Bearer <token-expire>"
# → 401 { "error": "TokenExpired", "message": "Access token has expired" }
```

### Rafraîchir les tokens (rotation)

```bash
curl -X POST http://localhost:3000/auth/refresh \
  -H "Content-Type: application/json" \
  -d "{\"refreshToken\": \"$REFRESH\"}"
# → 200 { "accessToken": "eyJ...(nouveau)", "refreshToken": "d4e5f6...(nouveau)", "expiresIn": 900 }
# ⚠️ L'ancien refresh token est maintenant INVALIDE (rotation obligatoire)
```

### Spam login → 429

```bash
for i in $(seq 1 6); do
  curl -s -w "%{http_code} " -X POST http://localhost:3000/auth/login \
    -H "Content-Type: application/json" \
    -d '{"email":"john@example.com","password":"wrong"}'
done
echo
# → 401 401 401 401 401 429
```

### Logout

```bash
curl -X POST http://localhost:3000/auth/logout \
  -H "Authorization: Bearer $TOKEN"
# → 204 No Content (toutes les sessions révoquées)
```

### Mon profil

```bash
curl http://localhost:3000/users/me \
  -H "Authorization: Bearer $TOKEN"
# → 200 { "id": "...", "email": "...", "displayName": "...", "bio": "...", ... }
```

### Modifier mon profil

```bash
curl -X PUT http://localhost:3000/users/me \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"displayName": "John Updated", "bio": "Développeur NestJS"}'
# → 200
```

### Upload d'avatar

```bash
curl -X POST http://localhost:3000/users/me/avatar \
  -H "Authorization: Bearer $TOKEN" \
  -F "avatar=@/chemin/vers/image.jpg"
# → 200 { "avatarUrl": "/uploads/avatars/..." }
```

### Changer de mot de passe

```bash
curl -X POST http://localhost:3000/auth/change-password \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"currentPassword":"Password123!","newPassword":"NouveauM0tDePasse!"}'
# → 204 No Content (toutes les sessions sont révoquées → re-login nécessaire)
```

---

## API Endpoints

| Méthode  | Route                              | Auth     | Permission             | Description                        |
| -------- | ---------------------------------- | -------- | ---------------------- | ---------------------------------- |
| `GET`    | `/`                                | -        | -                      | Hello World                        |
| `GET`    | `/health`                          | -        | -                      | Health check                       |
| `POST`   | `/auth/signup`                     | -        | -                      | Créer un compte                    |
| `POST`   | `/auth/login`                      | -        | -                      | Se connecter (JWT + refresh)       |
| `POST`   | `/auth/refresh`                    | -        | -                      | Rafraîchir le token                |
| `POST`   | `/auth/logout`                     | Bearer   | `user:read`            | Se déconnecter                     |
| `POST`   | `/auth/change-password`            | Bearer   | `user:update`          | Changer le mot de passe            |
| `GET`    | `/users/me`                        | Bearer   | `user:read`            | Mon profil                         |
| `PUT`    | `/users/me`                        | Bearer   | `user:update`          | Modifier mon profil                |
| `GET`    | `/users/:userId`                   | -        | -                      | Profil public                      |
| `POST`   | `/users/me/avatar`                 | Bearer   | `user:update`          | Upload d'avatar                    |
| `DELETE` | `/users/me/avatar`                 | Bearer   | `user:update`          | Supprimer l'avatar                 |
| `POST`   | `/posts`                           | Bearer   | `posts:create`         | Créer un post                      |
| `GET`    | `/posts`                           | -        | -                      | Lister les posts publics           |
| `GET`    | `/posts/:id`                       | Optional | `posts:read`           | Voir un post (public/privé)        |
| `PATCH`  | `/posts/:id`                       | Bearer   | `posts:update`         | Modifier un post (owner)           |
| `DELETE` | `/posts/:id`                       | Bearer   | `posts:delete`         | Supprimer un post (owner)          |
| `POST`   | `/chat/conversations`              | Bearer   | `conversations:create` | Creer une conversation             |
| `GET`    | `/chat/conversations`              | Bearer   | `conversations:read`   | Lister mes conversations           |
| `GET`    | `/chat/conversations/:id`          | Bearer   | `conversations:read`   | Detail d'une conversation (membre) |
| `POST`   | `/chat/conversations/:id/members`  | Bearer   | `conversations:create` | Ajouter un membre (createur only)  |
| `POST`   | `/chat/conversations/:id/messages` | Bearer   | `messages:create`      | Envoyer un message (membre only)   |
| `GET`    | `/chat/conversations/:id/messages` | Bearer   | `messages:read`        | Lister les messages (pagine)       |

---

## Logging (Winston)

Le projet utilise **Winston** comme logger central, intégré via **nest-winston**.

### Niveaux de log

| Niveau  | Priorité | Usage                                            |
| ------- | -------- | ------------------------------------------------ |
| `error` | 0        | Erreurs 5xx, exceptions non gérées               |
| `warn`  | 1        | Erreurs 4xx, login échoué, opérations refusées   |
| `info`  | 2        | Lifecycle NestJS, actions métier réussies        |
| `http`  | 3        | Requêtes entrantes/sortantes (incoming/outgoing) |
| `debug` | 4        | Informations de débogage détaillées              |

### Fichiers de log (en production)

| Fichier                        | Contenu                                      |
| ------------------------------ | -------------------------------------------- |
| `logs/error-YYYY-MM-DD.log`    | Erreurs uniquement (avec stack trace si 5xx) |
| `logs/warn-YYYY-MM-DD.log`     | Warnings uniquement                          |
| `logs/combined-YYYY-MM-DD.log` | Tout (error + warn + info)                   |
| `logs/http-YYYY-MM-DD.log`     | Requêtes HTTP (incoming/outgoing)            |

Les fichiers sont en **JSON structuré** (facile à parser avec `jq`, ELK, Datadog...).
La rotation quotidienne est assurée par `winston-daily-rotate-file` (rétention configurable).

### Variables d'environnement

| Variable         | Défaut                        | Description                                          |
| ---------------- | ----------------------------- | ---------------------------------------------------- |
| `LOG_LEVEL`      | `info`                        | Niveau minimum (error, warn, info, http, debug)      |
| `LOG_DIR`        | `logs`                        | Dossier destination des fichiers                     |
| `LOG_CONSOLE`    | `true`                        | Activer les logs console (format lisible, coloré)    |
| `LOG_FILE`       | `false` (dev) / `true` (prod) | Activer la persistence en fichiers                   |
| `LOG_HTTP`       | `true`                        | Activer les logs HTTP (requêtes entrantes/sortantes) |
| `LOG_JSON_FILES` | `false` (dev) / `true` (prod) | Format JSON dans les fichiers                        |
| `LOG_ROTATE`     | `false` (dev) / `true` (prod) | Rotation quotidienne                                 |
| `LOG_MAX_FILES`  | `14d`                         | Durée de rétention des fichiers                      |

### Exemple de log console (développement)

```
2025-01-15 10:30:45 info [Bootstrap] Application is running on: http://localhost:3000
2025-01-15 10:30:50 http [HTTP] --> GET /posts {requestId: f47ac10b-58cc-4372-a567-0e02b2c3d479}
2025-01-15 10:30:50 http [HTTP] <-- GET /posts 200 12ms {requestId: f47ac10b-58cc-4372-a567-0e02b2c3d479}
2025-01-15 10:30:55 info [Auth] Login success {requestId: a1b2c3d4, email: john@example.com}
2025-01-15 10:31:00 warn [Auth] Login failed {requestId: e5f6g7h8, email: hacker@evil.com}
2025-01-15 10:31:05 warn [ExceptionFilter] POST /auth/login 401 - Invalid credentials
```

### Exemple de log fichier JSON (production)

```json
{"level":"info","message":"Login success","context":"Auth","requestId":"a1b2c3d4","email":"john@example.com","timestamp":"2025-01-15T10:30:55.000Z"}
{"level":"error","message":"POST /api/crash 500 - Internal server error","context":"ExceptionFilter","requestId":"x9y0z1","statusCode":500,"stack":"Error: ...","timestamp":"2025-01-15T10:31:10.000Z"}
```

### Comment utiliser le logger dans un service/controller

```typescript
import { AppLogger } from '@common/infra/logger';

@Controller('example')
export class ExampleController {
  private readonly logger: AppLogger;

  constructor(appLogger: AppLogger) {
    this.logger = appLogger.withContext('Example'); // Contexte fixe
  }

  @Get()
  async doSomething(@Req() req: Request) {
    this.logger.log('Operation success', {
      requestId: req.headers['x-request-id'],
      customData: 'some-value',
    });
  }
}
```

### Points d'instrumentation (logs applicatifs)

Les logs sont branchés sur les points critiques :

**Auth** (contexte `[Auth]`) :

- Signup success (userId, email)
- Login success/fail (email, ip) — jamais le mot de passe ni les tokens
- Token refresh success/fail
- Logout (userId)
- Change password success/fail (userId)

**Posts** (contexte `[Posts]`) :

- Create (postId, ownerId, requestId)
- Update (postId, ownerId, requestId)
- Delete (postId, ownerId, requestId)

**HTTP** (contexte `[HTTP]`) :

- Incoming : method, path, ip, userAgent, requestId, userId (si connecté)
- Outgoing : statusCode, durationMs, requestId
- Niveau adapté : 2xx/3xx → http, 4xx → warn, 5xx → error

### Comment tester les logs

```bash
# Activer les fichiers de log en dev
LOG_FILE=true LOG_ROTATE=false pnpm dev

# Provoquer un 401 (credentials invalides)
curl -s -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@test.com","password":"wrong"}'
# → Vérifier logs/warn.log

# Provoquer un 404
curl -s http://localhost:3000/posts/00000000-0000-0000-0000-000000000000
# → Vérifier logs/warn.log

# Requêtes normales
curl -s http://localhost:3000/posts
# → Vérifier logs/http.log

# Vérifier les fichiers
ls -la logs/
cat logs/http.log | head -5
cat logs/warn.log | head -5
```

### Architecture des fichiers logger

```
arch/common/infra/logger/
├── logger.config.ts       # Configuration (ENV → LoggerConfig)
├── winston.instance.ts    # Factory Winston (transports console + fichiers)
├── logger.service.ts      # AppLogger (wrapper injectable, compatible LoggerService)
├── logger.module.ts       # Module global (fournit AppLogger partout)
└── index.ts               # Barrel export
```

### Interdictions (sécurité)

Les logs ne doivent **jamais** contenir :

- Mots de passe (currentPassword, newPassword)
- Tokens (accessToken, refreshToken)
- Secrets d'environnement (JWT_ACCESS_SECRET, REDIS_URL)

---

## Structure des dossiers

```
src/
├── main.ts                          # Bootstrap : Swagger, CORS, ValidationPipe, static files
├── app.module.ts                    # Module racine : guards globaux, middleware, throttle
├── app.controller.ts                # Health check (GET /, GET /health)
│
└── arch/
    ├── common/                      # Code partagé entre tous les modules
    │   ├── db/                      # Drizzle ORM : schema, migrations, seeds
    │   │   ├── schema.ts            # Tables + vues (source de vérité de la DB)
    │   │   ├── drizzle.module.ts    # Fournit le token 'DRIZZLE' injectable
    │   │   ├── drizzle.service.ts   # Connexion PostgreSQL via Drizzle
    │   │   ├── migrations/          # SQL exécuté par `pnpm migrate`
    │   │   └── seeds/               # Données de test `pnpm seed`
    │   ├── infra/redis/             # Client Redis partagé (rate limiting)
    │   ├── infra/logger/            # Winston : config, factory, AppLogger, module
    │   └── interface/http/          # Guards, decorators, filter, interceptor, middleware
    │       ├── guards/              # PermissionsGuard, OptionalAuthGuard, RateLimitGuard
    │       ├── decorators/          # @Can(), @AuthThrottle(), @UploadThrottle()
    │       ├── filter/              # GlobalExceptionFilter (erreurs domaine → HTTP)
    │       ├── interceptor/         # HttpLoggingInterceptor (Winston, incoming/outgoing)
    │       └── middleware/          # RequestIdMiddleware (x-request-id)
    │
    ├── modules/
    │   ├── auth/                    # Module authentification
    │   │   ├── auth.module.ts       # Wiring : handlers, adapters, JwtStrategy
    │   │   ├── domain/
    │   │   │   ├── models/          # Session model (aggregate sessionnel)
    │   │   │   ├── services/        # AuthDomainService (validation mdp, displayName)
    │   │   │   └── errors/          # InvalidCredentials, TokenExpired, EmailAlreadyUsed...
    │   │   ├── application/
    │   │   │   ├── commands/        # Signup, Login, Logout, RefreshToken, ChangePassword
    │   │   │   ├── ports/           # PasswordHasherPort, SessionRepositoryPort, TokenPort...
    │   │   │   └── events/          # UserSignedUpEvent
    │   │   ├── infrastructure/
    │   │   │   ├── adapters/        # BcryptPasswordHasher, JwtTokenAdapter, SessionRepoAdapter
    │   │   │   └── strategies/      # JwtStrategy (Passport, vérifie le token)
    │   │   └── interface/http/
    │   │       ├── controllers/     # AuthController (signup, login, refresh, logout, change-password)
    │   │       ├── dtos/            # SignupDto, LoginDto, ChangePasswordDto, AuthResponseDto
    │   │       ├── guards/          # JwtAuthGuard (extends AuthGuard('jwt'))
    │   │       └── decorators/      # @CurrentUser()
    │   │
    │   ├── user/                    # Module utilisateur
    │   │   ├── user.module.ts       # Wiring
    │   │   ├── domain/
    │   │   │   ├── models/          # User model
    │   │   │   ├── value-objects/   # Email VO, UserStatus VO
    │   │   │   ├── services/        # UserDomainService (validation displayName, bio, avatar)
    │   │   │   └── errors/          # UserNotFound, UserDisabled, InvalidFileType...
    │   │   ├── application/
    │   │   │   ├── commands/        # UpdateProfile, UploadAvatar, DeleteAvatar
    │   │   │   ├── queries/         # GetMyProfile, GetPublicProfile, FindUserByEmail
    │   │   │   ├── ports/           # UserRepositoryPort, UserWriteRepositoryPort, FileStoragePort
    │   │   │   └── events/          # UserProfileUpdatedEvent
    │   │   ├── infrastructure/
    │   │   │   └── adapters/        # UserRepoAdapter, WriteRepoAdapter, LocalFileStorageAdapter
    │   │   └── interface/http/
    │   │       ├── controllers/     # UserController (me, profile, avatar)
    │   │       ├── dtos/            # ProfileResponseDto, PublicProfileDto, UpdateProfileDto
    │   │       └── config/          # Multer config
    │   │
    │   ├── posts/                   # Module posts
    │   │   ├── posts.module.ts      # Wiring
    │   │   ├── domain/
    │   │   │   ├── models/          # Post model (aggregate root)
    │   │   │   ├── value-objects/   # PostVisibility VO ('public' | 'private')
    │   │   │   ├── services/        # PostPolicyService (canView, assertCanModify, validate)
    │   │   │   └── errors/          # PostNotFound, ForbiddenPostAccess, InvalidPostData
    │   │   ├── application/
    │   │   │   ├── commands/        # CreatePost, UpdatePost, DeletePost
    │   │   │   ├── queries/         # ListPublicPosts, GetPostById
    │   │   │   └── ports/           # PostRepositoryPort (abstract class)
    │   │   ├── infrastructure/
    │   │   │   └── adapters/        # PostRepositoryAdapter (Drizzle)
    │   │   └── interface/http/
    │   │       ├── controllers/     # PostsController (CRUD + guards + @Can)
    │   │       └── dtos/            # CreatePostDto, UpdatePostDto, PostResponseDto, ListPostsDto
    │   │
    │   └── chat/                    # Module chat (HTTP + WebSocket)
    │       ├── chat.module.ts       # Wiring
    │       ├── domain/
    │       │   ├── models/          # Conversation, ConversationMember, Message
    │       │   ├── services/        # ConversationPolicyService, MessagePolicyService
    │       │   └── errors/          # ConversationNotFound, NotMember, AlreadyMember...
    │       ├── application/
    │       │   ├── commands/        # CreateConversation, AddMember, SendMessage
    │       │   ├── queries/         # ListMyConversations, GetConversationById, ListMessages
    │       │   └── ports/           # ConversationRepoPort, MemberRepoPort, MessageRepoPort
    │       ├── infrastructure/
    │       │   └── adapters/        # Drizzle adapters pour chaque repo
    │       └── interface/
    │           ├── http/
    │           │   ├── controllers/ # ChatController (REST endpoints)
    │           │   └── dtos/        # CreateConversationDto, SendMessageDto, etc.
    │           └── ws/
    │               ├── gateway/     # ChatGateway (Socket.IO, join/send/broadcast)
    │               └── guards/      # WsJwtAuthGuard (JWT validation on handshake)
    │
    └── shared/
        ├── types/                   # UserPrincipal, Permission, PaginatedResult<T>
        └── utils/                   # IdGenerator (UUID v4)
```

### Pipeline HTTP (ordre d'exécution par requête)

```
Client → Middleware (RequestId)
       → Guard      (RateLimit → Permissions)
       → Interceptor (HttpLogging — log incoming + début chrono)
       → Pipe       (ValidationPipe — valide les DTOs)
       → Controller → CommandBus/QueryBus → Handler → Port → Adapter → DB
       → Interceptor (HttpLogging — log outgoing + durée)
       → Filter     (si erreur → GlobalExceptionFilter → log Winston + réponse JSON)
```

---

## Comment ajouter un nouveau module

Checklist pour ajouter un module (ex : `comments`) :

### 1. Domain — Règles métier pures

```
src/arch/modules/comments/domain/
├── models/comment.model.ts           # Classe pure TypeScript (aucun décorateur !)
├── services/comment-policy.service.ts # Logique métier (ownership, validations)
└── errors/comment-errors.ts          # Classes d'erreurs qui étendent Error
```

**Règle absolue :** Zéro import `@nestjs/*` dans le domaine. Uniquement du TypeScript pur.

### 2. Application — Ports + CQRS handlers

```
src/arch/modules/comments/application/
├── ports/comment-repository.port.ts   # Classe abstraite (contrat)
├── commands/create-comment.command.ts  # Command + Handler
└── queries/list-comments.query.ts     # Query + Handler
```

Les Ports sont des **classes abstraites** (pas des interfaces) pour que le DI NestJS fonctionne :

```typescript
export abstract class CommentRepositoryPort {
  abstract findById(id: string): Promise<Comment | null>;
  abstract create(comment: Comment): Promise<void>;
}
```

### 3. Infrastructure — Adapters (implémentations techniques)

```typescript
@Injectable()
export class CommentRepositoryAdapter extends CommentRepositoryPort {
  constructor(@Inject('DRIZZLE') private readonly db: DrizzleDB) {}
  // Implémente toutes les méthodes abstraites avec Drizzle
}
```

### 4. Interface HTTP — Controller + DTOs

```
src/arch/modules/comments/interface/http/
├── controllers/comments.controller.ts  # @Controller('comments'), @ApiTags, @Can
└── dtos/create-comment.dto.ts          # class-validator + @ApiProperty
```

### 5. Module — Le câblage hexagonal

```typescript
@Module({
  imports: [CqrsModule, DrizzleModule],
  controllers: [CommentsController],
  providers: [
    // CQRS handlers
    CreateCommentHandler,
    ListCommentsHandler,
    // Domain services
    CommentPolicyService,
    // Port → Adapter (le cœur de l'hexagone)
    { provide: CommentRepositoryPort, useClass: CommentRepositoryAdapter },
  ],
})
export class CommentsModule {}
```

Puis ajouter `CommentsModule` dans `AppModule.imports`.

### 6. Compléter

- Ajouter la table dans `schema.ts` + créer une migration SQL
- Ajouter le mapping d'erreur dans `GlobalExceptionFilter`
- Ajouter `@ApiTags('Comments')` + le tag dans `main.ts`
- Ajouter les permissions dans `DEFAULT_PERMISSIONS` si nécessaire

---

## Base de données

### Tables

| Table                    | Colonnes clés                                                                                       |
| ------------------------ | --------------------------------------------------------------------------------------------------- |
| **users**                | id, email, password_hash, display_name, bio, avatar_key, avatar_url, status, created_at, updated_at |
| **sessions**             | id, user_id (FK), refresh_token_hash, revoked_at, expires_at, created_at, user_agent, ip            |
| **posts**                | id, owner_id (FK), title, content, visibility (`public`\|`private`), created_at, updated_at         |
| **conversations**        | id, created_by (FK), title, created_at, updated_at                                                  |
| **conversation_members** | conversation_id (FK), user_id (FK), joined_at — PK composite (unique par conversation)              |
| **messages**             | id, conversation_id (FK), sender_id (FK), content, created_at                                       |

### Vues SQL (optimisation lecture)

| Vue                 | Rôle                                                                       |
| ------------------- | -------------------------------------------------------------------------- |
| `user_me_view`      | Profil complet (email, status) — pour `GET /users/me`                      |
| `user_public_view`  | Profil public (sans email, users actifs seulement) — pour `GET /users/:id` |
| `posts_public_view` | Posts publics + displayName de l'auteur — pour `GET /posts`                |

---

## Design Patterns utilisés

| Pattern                    | Où                                | Pourquoi                           |
| -------------------------- | --------------------------------- | ---------------------------------- |
| **Hexagonal Architecture** | Chaque module                     | Isoler le domaine de la technique  |
| **CQRS**                   | Commands + Queries                | Séparer écriture et lecture        |
| **Repository**             | Ports/Adapters                    | Abstraire l'accès aux données      |
| **Value Object**           | Email, UserStatus, PostVisibility | Valider dès la construction        |
| **Policy**                 | PostPolicyService                 | Règles d'accès au niveau domaine   |
| **Strategy**               | JwtStrategy (Passport)            | Authentification pluggable         |
| **Adapter**                | Tous les adapters infra           | Implémenter les contrats des ports |
| **Decorator**              | @Can, @AuthThrottle, @CurrentUser | Métadonnées déclaratives           |

---

## Scripts disponibles

| Script           | Description                                 |
| ---------------- | ------------------------------------------- |
| `pnpm dev`       | Lance le serveur en mode watch (hot reload) |
| `pnpm build`     | Compile le projet TypeScript                |
| `pnpm start`     | Lance le serveur compilé                    |
| `pnpm migrate`   | Applique les migrations SQL                 |
| `pnpm seed`      | Insère les données de test                  |
| `pnpm lint`      | Lance ESLint avec auto-fix                  |
| `pnpm db:studio` | Lance Drizzle Studio (interface DB web)     |

---

## Chat — Policies (membership)

Le module chat ajoute un **3e niveau d'autorisation** : la **membership** de conversation.

| Regle                 | Service domaine                                  | Resultat            |
| --------------------- | ------------------------------------------------ | ------------------- |
| Lire une conversation | `ConversationPolicyService.assertIsMember()`     | 403 si non membre   |
| Envoyer un message    | `MessagePolicyService.assertCanSend()`           | 403 si non membre   |
| Ajouter un membre     | `ConversationPolicyService.assertCanAddMember()` | 403 si pas createur |
| Lire les messages     | `MessagePolicyService.assertCanRead()`           | 403 si non membre   |

Les policies sont dans le **domaine pur** (pas de NestJS, pas de DB).
Les handlers CQRS verifient les policies **apres** le Guard `@Can()`.

## Exemples curl — Chat HTTP

### Login (prereq pour tous les tests chat)

```bash
# Login John
LOGIN_JOHN=$(curl -s -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"john@example.com","password":"Password123!"}')
TOKEN_JOHN=$(echo "$LOGIN_JOHN" | jq -r '.accessToken')

# Login Jane
LOGIN_JANE=$(curl -s -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"jane@example.com","password":"Password123!"}')
TOKEN_JANE=$(echo "$LOGIN_JANE" | jq -r '.accessToken')

# Recuperer l'ID de Jane pour l'ajouter comme membre
JANE_PROFILE=$(curl -s http://localhost:3000/users/me \
  -H "Authorization: Bearer $TOKEN_JANE")
JANE_ID=$(echo "$JANE_PROFILE" | jq -r '.id')
```

### Creer une conversation

```bash
curl -s -X POST http://localhost:3000/chat/conversations \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN_JOHN" \
  -d "{\"memberIds\": [\"$JANE_ID\"], \"title\": \"Architecture Chat\"}"
# -> 201 { "id": "...", "createdBy": "...", "title": "Architecture Chat", "members": [...] }

CONV_ID=<id-retourne>
```

### Lister mes conversations

```bash
curl -s http://localhost:3000/chat/conversations \
  -H "Authorization: Bearer $TOKEN_JOHN"
# -> 200 [{ "id": "...", "title": "...", "lastMessageContent": "...", "memberCount": 2 }]
```

### Voir le detail d'une conversation (membre)

```bash
curl -s http://localhost:3000/chat/conversations/$CONV_ID \
  -H "Authorization: Bearer $TOKEN_JOHN"
# -> 200 { "id": "...", "members": [{ "userId": "...", "joinedAt": "..." }, ...] }
```

### Voir le detail d'une conversation (non membre -> 403)

```bash
# Login Bob (pas membre de cette conversation)
LOGIN_BOB=$(curl -s -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"bob@example.com","password":"Password123!"}')
TOKEN_BOB=$(echo "$LOGIN_BOB" | jq -r '.accessToken')

curl -s http://localhost:3000/chat/conversations/$CONV_ID \
  -H "Authorization: Bearer $TOKEN_BOB"
# -> 403 { "error": "Forbidden", "message": "You are not a member of this conversation" }
```

### Ajouter un membre (createur only)

```bash
BOB_PROFILE=$(curl -s http://localhost:3000/users/me \
  -H "Authorization: Bearer $TOKEN_BOB")
BOB_ID=$(echo "$BOB_PROFILE" | jq -r '.id')

curl -s -X POST http://localhost:3000/chat/conversations/$CONV_ID/members \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN_JOHN" \
  -d "{\"userId\": \"$BOB_ID\"}"
# -> 201 { "message": "Member added successfully" }
```

### Envoyer un message (membre only)

```bash
curl -s -X POST http://localhost:3000/chat/conversations/$CONV_ID/messages \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN_JOHN" \
  -d '{"content": "Hello from John via HTTP!"}'
# -> 201 { "id": "...", "conversationId": "...", "senderId": "...", "content": "Hello from John via HTTP!" }
```

### Lister les messages (pagine)

```bash
curl -s "http://localhost:3000/chat/conversations/$CONV_ID/messages?page=1&pageSize=10" \
  -H "Authorization: Bearer $TOKEN_JOHN"
# -> 200 { "data": [...], "total": 1, "page": 1, "pageSize": 10, "totalPages": 1 }
```

---

## WebSocket — Chat temps reel

### Architecture

Le Gateway WebSocket est un **transport** : il ne contient pas de logique metier.

```
Client (Socket.IO)
  -> handleConnection() : valide JWT, attache UserPrincipal
  -> chat.join { conversationId }
       -> QueryBus (GetConversationByIdQuery) : verifie membership via policy
       -> client.join("conv:<id>")
  -> chat.send { conversationId, content }
       -> CommandBus (SendMessageCommand) : persiste en DB + policy membership
       -> server.to("conv:<id>").emit("chat.message", { ... })
```

### Comment se connecter

Le client fournit son **access token JWT** dans le handshake Socket.IO :

```javascript
// Client JavaScript minimal (Socket.IO)
import { io } from 'socket.io-client';

const socket = io('http://localhost:3000/chat', {
  auth: { token: 'eyJ...' }, // Access token JWT
});

socket.on('connect', () => {
  console.log('Connected to chat!');

  // Rejoindre une conversation
  socket.emit('chat.join', { conversationId: '<uuid>' });

  // Envoyer un message
  socket.emit('chat.send', {
    conversationId: '<uuid>',
    content: 'Hello from WebSocket!',
  });
});

// Recevoir les messages en temps reel
socket.on('chat.message', (data) => {
  console.log('New message:', data.message);
  // { id, senderId, content, createdAt }
});

// Confirmation de join
socket.on('chat.joined', (data) => {
  console.log('Joined:', data.conversationId);
});

// Erreurs
socket.on('chat.error', (data) => {
  console.error('Error:', data.message);
});

socket.on('disconnect', () => {
  console.log('Disconnected');
});
```

### Events WebSocket

| Direction        | Event          | Payload                       | Description                       |
| ---------------- | -------------- | ----------------------------- | --------------------------------- |
| client -> server | `chat.join`    | `{ conversationId }`          | Rejoindre la room de conversation |
| client -> server | `chat.send`    | `{ conversationId, content }` | Envoyer un message                |
| server -> client | `chat.message` | `{ conversationId, message }` | Nouveau message broadcast         |
| server -> client | `chat.joined`  | `{ conversationId, message }` | Confirmation de join              |
| server -> client | `chat.error`   | `{ event, message }`          | Erreur (non membre, etc.)         |

### Tester avec wscat ou websocat

```bash
# Installer wscat (si besoin)
npm install -g wscat

# Connexion (Socket.IO utilise HTTP upgrade, wscat est pour WS natif)
# Pour Socket.IO, utiliser le client JS ci-dessus ou Postman
```

### Scaling (multi-instance)

Actuellement, le WebSocket fonctionne pour **une seule instance** du serveur.
Si vous deployez plusieurs instances derriere un load balancer :

- Les rooms Socket.IO sont locales a chaque instance
- Un message envoye sur l'instance A ne sera PAS recu par les clients de l'instance B

**Solution** : utiliser le **Redis adapter** pour Socket.IO :

```typescript
// Ajouter dans le ChatGateway ou un adapter custom :
import { createAdapter } from '@socket.io/redis-adapter';
import { createClient } from 'redis';

// Le Redis adapter synchronise les rooms et les messages entre instances
const pubClient = createClient({ url: 'redis://localhost:6379' });
const subClient = pubClient.duplicate();
io.adapter(createAdapter(pubClient, subClient));
```

Cette implementation n'est **pas incluse** dans le projet pour garder la simplicite.
Le code est structure pour l'ajouter facilement quand necessaire.

## Licence

MIT
