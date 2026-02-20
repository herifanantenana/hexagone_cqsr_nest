# 1 — Bootstrap du projet : Auth + User (Hexagonal + CQRS)

## Objectif

Partir de zéro et obtenir un projet NestJS **qui tourne en local** avec :

- PostgreSQL + Drizzle ORM (pas Docker, juste un Postgres local ou distant)
- Architecture hexagonale stricte : **Domain / Application / Infrastructure / Interface**
- CQRS via `@nestjs/cqrs`
- Module **auth** : signup, login, refresh, logout, change-password
- Module **user** : profil "me", profil public, update profil, upload/delete avatar
- Cross-cutting minimum : GlobalExceptionFilter, RequestIdMiddleware, LoggingInterceptor
- Communication inter-modules propre (ports, pas d'import direct)

Aucun WebSocket, aucun rôle, aucun Docker.

---

## Prérequis

| Outil        | Version min. | Vérification           |
|--------------|-------------|------------------------|
| Node.js      | 18+         | `node -v`              |
| PNPM         | 8+          | `pnpm -v`              |
| PostgreSQL   | 14+         | `psql --version`       |
| Git          | 2+          | `git --version`        |

Tu dois avoir une base PostgreSQL accessible (locale ou distante). Note l'URL de connexion, tu en auras besoin pour `.env`.

---

## Étapes (pas à pas)

### Étape 1 — Initialiser le projet NestJS

```bash
pnpm dlx @nestjs/cli new mon-projet --package-manager pnpm --strict
cd mon-projet
```

Supprime les fichiers générés inutiles (`app.controller.spec.ts`, `app.service.ts` si tu ne l'utilises pas).

### Étape 2 — Installer les dépendances

```bash
# Core NestJS
pnpm add @nestjs/config @nestjs/cqrs @nestjs/passport @nestjs/jwt passport passport-jwt

# Base de données
pnpm add drizzle-orm pg
pnpm add -D drizzle-kit @types/pg tsx

# Sécurité & utilitaires
pnpm add bcryptjs uuid class-validator class-transformer
pnpm add -D @types/bcryptjs @types/uuid @types/passport-jwt @types/multer

# Upload fichiers
pnpm add multer
```

### Étape 3 — Créer l'arborescence `/arch`

```
src/arch/
├── common/
│   ├── db/
│   │   ├── schema.ts              ← Toutes les tables Drizzle
│   │   ├── drizzle.service.ts     ← Fournit le client Drizzle
│   │   ├── drizzle.module.ts      ← Module global DB
│   │   ├── migrations/
│   │   │   └── run-migrations.ts  ← Script de migration custom
│   │   └── seeds/
│   │       └── seed.dev.ts        ← Données de test
│   └── interface/http/
│       ├── middleware/
│       │   └── request-id.middleware.ts
│       ├── filters/
│       │   └── global-exception.filter.ts
│       └── interceptors/
│           └── http-logging.interceptor.ts
├── shared/
│   ├── types/
│   │   └── user-principal.type.ts
│   └── utils/
│       └── id-generator.util.ts
└── modules/
    ├── auth/
    │   ├── domain/
    │   │   ├── models/
    │   │   ├── errors/
    │   │   └── value-objects/
    │   ├── application/
    │   │   ├── commands/       ← Signup, Login, Refresh, Logout, ChangePassword
    │   │   ├── ports/          ← PasswordHasherPort, TokenPort, SessionRepositoryPort, UserAuthReadPort
    │   │   └── events/
    │   ├── infrastructure/
    │   │   └── adapters/       ← BcryptAdapter, JwtAdapter, SessionAdapter, UserAuthReadAdapter
    │   └── interface/http/
    │       ├── auth.controller.ts
    │       ├── dto/
    │       └── strategies/     ← JwtStrategy (Passport)
    └── user/
        ├── domain/
        │   ├── models/
        │   └── errors/
        ├── application/
        │   ├── commands/       ← UpdateProfile, UploadAvatar, DeleteAvatar
        │   ├── queries/        ← GetMyProfile, GetPublicProfile, FindUserByEmail
        │   └── ports/          ← UserRepositoryPort, FileStoragePort
        ├── infrastructure/
        │   └── adapters/       ← UserRepositoryAdapter, LocalFileStorageAdapter
        └── interface/http/
            ├── user.controller.ts
            └── dto/
```

**Règle d'or** : crée uniquement les dossiers dont tu as besoin. Pas de dossier vide.

### Étape 4 — Configurer la base de données

**`drizzle.config.ts`** (racine du projet) :
- `schema` → `./src/arch/common/db/schema.ts`
- `out` → `./src/arch/common/db/migrations`
- `dialect` → `postgresql`
- `dbCredentials.url` → lire `DATABASE_URL` depuis `process.env`

**`schema.ts`** — Définir les tables :

| Table       | Colonnes clés                                                                 |
|-------------|-------------------------------------------------------------------------------|
| `users`     | id (UUID PK), email (unique), passwordHash, displayName, bio, avatarKey, avatarUrl, status, timestamps |
| `sessions`  | id (UUID PK), userId (FK→users), refreshTokenHash, revokedAt, expiresAt, userAgent, ip |

**Views PostgreSQL** (read models CQRS) :

| Vue               | Contenu                                                         |
|-------------------|-----------------------------------------------------------------|
| `userPublicView`  | displayName, bio, avatarUrl, createdAt — filtre `status = 'active'` |
| `userMeView`      | Tout le profil sauf passwordHash — filtre `status = 'active'`  |

**Scripts `package.json`** :
```json
{
  "migrate:generate": "drizzle-kit generate",
  "migrate:push": "drizzle-kit push",
  "migrate": "tsx src/arch/common/db/migrations/run-migrations.ts",
  "seed": "tsx src/arch/common/db/seeds/seed.dev.ts"
}
```

### Étape 5 — Module Auth (le cœur)

**Domain** — Créer les erreurs métier :
- `InvalidCredentialsError`
- `EmailAlreadyUsedError`
- `InvalidTokenError`
- `SessionNotFoundError`
- `SessionExpiredError`
- `SessionRevokedError`

**Application (Ports)** — Définir les interfaces :
- `PasswordHasherPort` : `hash(password)`, `compare(password, hash)`
- `TokenPort` : `generateAccessToken(payload)`, `generateRefreshToken(payload)`, `verifyRefreshToken(token)`
- `SessionRepositoryPort` : `create(session)`, `findById(id)`, `revokeById(id)`, `revokeAllByUserId(userId)`
- `UserAuthReadPort` : `findByEmail(email)` — C'est le **port inter-module**, Auth lit les users sans importer UserModule directement.

**Application (Commands + Handlers)** — Créer un command + handler par action :
1. `SignupCommand` → vérifie email dispo, hash password, crée user (via port), crée session, retourne tokens
2. `LoginCommand` → vérifie credentials, crée session, retourne tokens
3. `RefreshTokenCommand` → vérifie refresh token, vérifie session (existe, non révoquée, non expirée, hash OK), rotation : révoque ancienne session + crée nouvelle, retourne nouveaux tokens
4. `LogoutCommand` → révoque la session courante
5. `ChangePasswordCommand` → vérifie ancien password, hash nouveau, met à jour, **révoque toutes les sessions**

**Infrastructure (Adapters)** — Implémenter chaque port :
- `BcryptPasswordHasherAdapter` → utilise `bcryptjs`
- `JwtTokenAdapter` → utilise `@nestjs/jwt`
- `SessionRepositoryAdapter` → requêtes Drizzle sur table `sessions`
- `UserAuthReadAdapter` → requête Drizzle pour lire un user par email

**Interface (Controller)** :
- `POST /auth/signup` — body: `{ email, password, displayName }`
- `POST /auth/login` — body: `{ email, password }`
- `POST /auth/refresh` — body: `{ refreshToken }`
- `POST /auth/logout` — header: `Authorization: Bearer <access_token>`
- `POST /auth/change-password` — header: Bearer + body: `{ oldPassword, newPassword }`

**JwtStrategy (Passport)** :
- Extrait le token du header `Authorization: Bearer ...`
- Valide et decode le JWT
- Injecte `UserPrincipal` dans `request.user`

### Étape 6 — Module User

**Application (Ports)** :
- `UserRepositoryPort` : `findById`, `findPublicById` (via view)
- `UserWriteRepositoryPort` : `updateProfile`, `updateAvatar`, `deleteAvatar`
- `FileStoragePort` : `save(file)`, `delete(key)`

**Commands** :
- `UpdateProfileCommand` → met à jour displayName, bio
- `UploadAvatarCommand` → sauvegarde fichier via FileStoragePort, met à jour avatarKey/avatarUrl
- `DeleteAvatarCommand` → supprime fichier, remet avatar à null

**Queries** :
- `GetMyProfileQuery` → lit depuis `userMeView`
- `GetPublicProfileQuery` → lit depuis `userPublicView`
- `FindUserByEmailQuery` → utilisée par Auth (via le port exporté)

**Infrastructure** :
- `LocalFileStorageAdapter` — stocke dans `/uploads`, retourne le chemin relatif
- Configurer Multer : taille max (2 Mo), types autorisés (image/jpeg, image/png, image/webp)

**Interface (Controller)** :
- `GET /users/me` — profil complet (auth requise)
- `GET /users/:id` — profil public
- `PUT /users/me` — mise à jour profil (auth requise)
- `POST /users/me/avatar` — upload (multipart/form-data, auth requise)
- `DELETE /users/me/avatar` — suppression avatar (auth requise)

### Étape 7 — Communication inter-modules

Le module **Auth** a besoin de lire un user par email (pour login/signup). Il ne doit **jamais** importer `UserModule` directement.

**Pattern** :
1. Définis `UserAuthReadPort` dans `auth/application/ports/`
2. L'implémentation (`UserAuthReadAdapter`) est dans `user/infrastructure/adapters/`
3. `UserModule` exporte `UserAuthReadPort`
4. `AuthModule` importe `UserModule` et injecte `UserAuthReadPort`

Cela respecte la dépendance inversée : Auth dépend d'une abstraction, pas d'un module concret.

### Étape 8 — Cross-cutting (commun)

**RequestIdMiddleware** :
- Intercepte toute requête entrante
- Génère un UUID si le header `x-request-id` n'existe pas
- Attache l'id à `req` et au header de réponse

**GlobalExceptionFilter** :
- Attrape toutes les exceptions (domain + HTTP + inconnues)
- Mappe chaque erreur domain vers un code HTTP précis
- Retourne un format standard : `{ statusCode, error, message, requestId, timestamp, path }`
- Log les erreurs 5xx avec stack trace

**HttpLoggingInterceptor** :
- Log chaque requête entrante (method, path, IP, userAgent, requestId)
- Log chaque réponse (statusCode, durée)
- Niveau de log : 2xx/3xx → info, 4xx → warn, 5xx → error

**Branchement dans `app.module.ts`** :
```
providers: [
  { provide: APP_FILTER, useClass: GlobalExceptionFilter },
  { provide: APP_INTERCEPTOR, useClass: HttpLoggingInterceptor },
]
```

Middleware appliqué via `configure(consumer)` dans `AppModule` :
```
consumer.apply(RequestIdMiddleware).forRoutes('*');
```

### Étape 9 — Fichier `main.ts`

- Créer l'app NestJS
- Appliquer `ValidationPipe` global (whitelist, transform, forbidNonWhitelisted)
- Servir les fichiers statiques depuis `/uploads`
- Activer CORS
- Activer les hooks de shutdown (`enableShutdownHooks`)
- Écouter sur le port défini dans `.env`

### Étape 10 — Configurer les alias TypeScript

Dans `tsconfig.json`, ajouter les paths :
```json
{
  "paths": {
    "@arch/*": ["src/arch/*"],
    "@shared/*": ["src/arch/shared/*"],
    "@common/*": ["src/arch/common/*"],
    "@modules/*": ["src/arch/modules/*"]
  }
}
```

### Étape 11 — Migrations et Seeds

1. Lance `pnpm migrate:generate` pour générer les fichiers SQL depuis le schema
2. Lance `pnpm migrate:push` pour appliquer sur la DB
3. Crée un `seed.dev.ts` qui insère :
   - 2 users de test (avec password hashé)
   - Des sessions associées
4. Lance `pnpm seed`

### Étape 12 — Tester que tout fonctionne

Lance le serveur : `pnpm dev`

Vérifie :
- Le serveur démarre sans erreur
- La console affiche le port d'écoute
- Les migrations ont créé les tables
- Le seed a inséré des données

---

## Où mettre quoi dans /arch

| Couche           | Emplacement                          | Contenu                                                        |
|------------------|--------------------------------------|----------------------------------------------------------------|
| **Domain**       | `modules/<mod>/domain/`              | Models, errors, value-objects. AUCUNE dépendance externe.       |
| **Application**  | `modules/<mod>/application/`         | Commands, queries, handlers, ports (interfaces). Pas de Drizzle, pas de HTTP. |
| **Infrastructure** | `modules/<mod>/infrastructure/`    | Adapters (implémentent les ports). Drizzle, Bcrypt, JWT, Multer. |
| **Interface**    | `modules/<mod>/interface/http/`      | Controllers, DTOs, guards spécifiques au module.                |
| **Common**       | `common/`                            | DB, middleware, filters, interceptors partagés.                 |
| **Shared**       | `shared/`                            | Types et utilitaires partagés entre modules.                    |

**Règle absolue** : Domain et Application ne doivent jamais importer depuis Infrastructure ou Interface. La flèche va toujours de l'extérieur vers l'intérieur.

---

## Config (.env)

Crée un fichier `.env` (et un `.env.example` versionné) :

```env
# --- Base de données ---
DATABASE_URL=postgresql://user:password@localhost:5432/ma_base

# --- JWT ---
JWT_ACCESS_SECRET=change-me-access-secret-32-chars-min
JWT_REFRESH_SECRET=change-me-refresh-secret-32-chars-min
JWT_ACCESS_EXPIRATION=15m
JWT_REFRESH_EXPIRATION=7d

# --- Application ---
PORT=3000
NODE_ENV=development

# --- Upload ---
UPLOAD_DIR=./uploads
MAX_FILE_SIZE=2097152
```

**Ne jamais committer** `.env`. Seul `.env.example` va dans Git (avec des valeurs fictives).

---

## Pièges à éviter

| Piège | Pourquoi | Solution |
|-------|----------|----------|
| Importer directement un module dans un autre | Casse l'hexagonal, crée un couplage fort | Utiliser un **port** (interface) + adapter |
| Mettre de la logique Drizzle dans un handler CQRS | L'Application layer ne doit pas connaître l'infrastructure | Passer par un port, implémenter dans un adapter |
| Stocker le refresh token en clair dans la DB | Si la DB fuit, tous les tokens sont compromis | Stocker uniquement le **hash** (bcrypt) |
| Oublier de révoquer les sessions au change-password | L'ancien refresh token reste valide | `revokeAllByUserId()` dans le handler ChangePassword |
| Créer des dossiers vides "pour plus tard" | Bruit, confusion, pas de valeur | Ne crée que ce qui est utilisé immédiatement |
| Mettre les DTOs dans Domain | Les DTOs sont liés à HTTP (validation, transformation) | DTOs dans `interface/http/dto/` |
| Oublier `class-validator` + `ValidationPipe` | Les DTOs ne valident rien sans ça | Installer les packages + configurer le pipe global |
| Ne pas gérer le cas où le fichier avatar n'existe plus | Crash au delete | Vérifier l'existence avant suppression, ignorer si absent |
| Utiliser `@Res()` dans les controllers | Perd le pipe NestJS (interceptors, filters ne marchent plus) | Retourner un objet, laisser NestJS sérialiser |

---

## Checklist DONE

- [ ] `pnpm dev` démarre sans erreur
- [ ] Les tables `users` et `sessions` existent dans PostgreSQL
- [ ] Les views `userPublicView` et `userMeView` sont créées
- [ ] `POST /auth/signup` crée un user et retourne `{ accessToken, refreshToken }`
- [ ] `POST /auth/login` retourne des tokens valides
- [ ] `POST /auth/refresh` retourne de nouveaux tokens et révoque les anciens
- [ ] `POST /auth/logout` révoque la session (le refresh token ne marche plus)
- [ ] `POST /auth/change-password` change le mot de passe et révoque toutes les sessions
- [ ] `GET /users/me` retourne le profil complet (avec un token valide)
- [ ] `GET /users/:id` retourne le profil public (sans token)
- [ ] `PUT /users/me` met à jour displayName et/ou bio
- [ ] `POST /users/me/avatar` upload un fichier image
- [ ] `DELETE /users/me/avatar` supprime l'avatar
- [ ] Le dossier `/uploads` contient les avatars uploadés
- [ ] Chaque requête a un header `x-request-id` dans la réponse
- [ ] Les erreurs retournent le format standard `{ statusCode, error, message, requestId, timestamp, path }`
- [ ] Aucun dossier vide dans l'arborescence
- [ ] `.env.example` est présent et documenté
- [ ] Le seed insère des données de test exploitables

---

## Tests manuels (curl)

### Signup
```bash
curl -s -X POST http://localhost:3000/auth/signup \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"MyP@ss123","displayName":"Test User"}' | jq
```

### Login
```bash
curl -s -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"MyP@ss123"}' | jq
```

### Refresh
```bash
curl -s -X POST http://localhost:3000/auth/refresh \
  -H "Content-Type: application/json" \
  -d '{"refreshToken":"<REFRESH_TOKEN>"}' | jq
```

### Logout
```bash
curl -s -X POST http://localhost:3000/auth/logout \
  -H "Authorization: Bearer <ACCESS_TOKEN>" | jq
```

### Change Password
```bash
curl -s -X POST http://localhost:3000/auth/change-password \
  -H "Authorization: Bearer <ACCESS_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"oldPassword":"MyP@ss123","newPassword":"NewP@ss456"}' | jq
```

### Profil "me"
```bash
curl -s http://localhost:3000/users/me \
  -H "Authorization: Bearer <ACCESS_TOKEN>" | jq
```

### Profil public
```bash
curl -s http://localhost:3000/users/<USER_UUID> | jq
```

### Update profil
```bash
curl -s -X PUT http://localhost:3000/users/me \
  -H "Authorization: Bearer <ACCESS_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"displayName":"Nouveau Nom","bio":"Ma bio"}' | jq
```

### Upload avatar
```bash
curl -s -X POST http://localhost:3000/users/me/avatar \
  -H "Authorization: Bearer <ACCESS_TOKEN>" \
  -F "file=@/chemin/vers/photo.jpg" | jq
```

### Delete avatar
```bash
curl -s -X DELETE http://localhost:3000/users/me/avatar \
  -H "Authorization: Bearer <ACCESS_TOKEN>" | jq
```

### Vérifier le request-id
```bash
curl -v http://localhost:3000/health 2>&1 | grep -i x-request-id
```

### Vérifier le format d'erreur
```bash
curl -s -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"nope@nope.com","password":"wrong"}' | jq
# Doit retourner : { statusCode: 401, error: "Unauthorized", message: "...", requestId: "...", ... }
```
