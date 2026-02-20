# 3 — Swagger, Composants Communs et Module Posts

## Objectif

Faire évoluer le projet pour qu'il soit **compilable, documenté et réellement utilisable** :

- **Swagger avancé** : OpenAPI complet avec JWT Bearer, tags, exemples DTO, pagination, format d'erreur standard, endpoint `/health`
- **Composants transverses réellement branchés** : GlobalExceptionFilter, LoggingInterceptor, RequestIdMiddleware, JwtAuthGuard, PermissionsGuard + `@Can(resource, action)`, OptionalAuthGuard
- **Module Posts complet** : CRUD avec visibilité public/private, ownership, CQRS, ports/adapters Drizzle, migrations + seeds, view `posts_public_view`
- **Zéro composant déclaré mais non utilisé**

---

## Prérequis

- Le projet des Concepts 1 et 2 fonctionne (auth, user, rate limiting)
- La base PostgreSQL est accessible

---

## Étapes (pas à pas)

### Étape 1 — Installer Swagger

```bash
pnpm add @nestjs/swagger
```

### Étape 2 — Configurer Swagger dans `main.ts`

Configurer `SwaggerModule` avec :

- **Titre** : Nom de ton app
- **Description** : Résumé de l'API
- **Version** : `1.0`
- **Security** : `addBearerAuth()` — ajoute le schéma JWT Bearer
- **URL** : Accessible sur `/api/docs`

```
const config = new DocumentBuilder()
  .setTitle('Mon API')
  .setDescription('API NestJS Hexagonal + CQRS')
  .setVersion('1.0')
  .addBearerAuth()
  .build();
const document = SwaggerModule.createDocument(app, config);
SwaggerModule.setup('api/docs', app, document);
```

### Étape 3 — Annoter les DTOs

Pour chaque DTO, utiliser les décorateurs Swagger :

```
@ApiProperty({ example: 'john@example.com', description: 'Adresse email' })
@IsEmail()
email: string;
```

**Décorateurs fréquents** :
- `@ApiProperty()` — Champ obligatoire
- `@ApiPropertyOptional()` — Champ optionnel
- `@ApiResponse()` — Sur le controller, décrit les réponses possibles
- `@ApiTags('auth')` — Regroupe les endpoints par tag
- `@ApiBearerAuth()` — Indique que le endpoint requiert un JWT
- `@ApiConsumes('multipart/form-data')` — Pour l'upload

**Pagination** — Créer un DTO réutilisable :
```
class PaginatedResponseDto<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
}
```

### Étape 4 — Annoter les Controllers

Pour chaque controller :

1. Ajouter `@ApiTags('nom')` au niveau de la classe
2. Ajouter `@ApiBearerAuth()` sur les méthodes protégées
3. Ajouter `@ApiResponse({ status, description, type })` pour chaque code de retour possible
4. Documenter le format d'erreur standard :

```json
{
  "statusCode": 400,
  "error": "Bad Request",
  "message": "Description de l'erreur",
  "requestId": "uuid",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "path": "/endpoint"
}
```

### Étape 5 — Endpoint `/health`

Si pas déjà fait, créer :

```
GET /health → { status: "ok", timestamp: "..." }
```

- `@SkipThrottle()` — Exempt du rate limiting
- `@ApiTags('health')`
- `@ApiResponse({ status: 200, description: 'API is healthy' })`

### Étape 6 — Composants transverses (vérification et branchement)

Vérifie que CHAQUE composant ci-dessous est :
1. **Créé** (le fichier existe)
2. **Branché** (enregistré dans `app.module.ts` ou appliqué via `configure`)
3. **Utilisé** (au moins un endpoint l'utilise)

| Composant              | Enregistrement                          | Vérifié ? |
|------------------------|-----------------------------------------|-----------|
| `RequestIdMiddleware`  | `consumer.apply(...).forRoutes('*')`    |           |
| `GlobalExceptionFilter`| `{ provide: APP_FILTER, useClass: ... }`|           |
| `HttpLoggingInterceptor`| `{ provide: APP_INTERCEPTOR, useClass: ... }` |   |
| `RateLimitGuard`       | `{ provide: APP_GUARD, useClass: ... }` |           |
| `PermissionsGuard`     | `{ provide: APP_GUARD, useClass: ... }` |           |

**Guards spécifiques (pas globaux)** :

| Guard               | Utilisation                                | Comment          |
|---------------------|--------------------------------------------|------------------|
| `JwtAuthGuard`      | Routes protégées (auth requise)            | `@UseGuards(JwtAuthGuard)` sur le endpoint |
| `OptionalAuthGuard` | Routes publiques enrichies si connecté      | `@UseGuards(OptionalAuthGuard)` |

### Étape 7 — Décorateur `@Can(resource, action)`

**Emplacement** : `src/arch/common/interface/http/decorators/can.decorator.ts`

Ce décorateur pose un metadata sur le handler. Le `PermissionsGuard` le lit :

1. Si `@Can()` est présent → vérifier que `req.user` a la permission
2. Si pas de token → 401
3. Si token présent mais permission absente → 403
4. Si `@Can()` absent → le guard laisse passer (pas de restriction)

**Utilisation** :
```
@Can('posts', 'create')
@UseGuards(JwtAuthGuard)
@Post()
createPost(...) { ... }
```

### Étape 8 — OptionalAuthGuard

**Emplacement** : `src/arch/common/interface/http/guards/optional-auth.guard.ts`

Étend `AuthGuard('jwt')` mais ne lève **jamais** d'erreur si le token est absent :
- Token présent et valide → `req.user` est rempli
- Token absent → `req.user` reste `undefined`, la requête continue
- Token invalide/expiré → peut être traité comme absent (graceful)

**Cas d'usage** : `GET /posts` — retourne les posts publics pour tous, MAIS si l'utilisateur est connecté, retourne aussi ses posts privés.

### Étape 9 — Module Posts

#### Schema (Drizzle)

Ajouter dans `schema.ts` :

**Table `posts`** :
- `id` (UUID PK)
- `ownerId` (UUID FK → users, CASCADE)
- `title` (VARCHAR 255)
- `content` (TEXT)
- `visibility` ('public' | 'private', défaut 'public')
- `createdAt`, `updatedAt` (timestamps)

**View `postsPublicView`** :
- Sélectionne les posts où `visibility = 'public'`
- Joint le `displayName` du owner (dénormalisation pour la lecture)

#### Arborescence

```
src/arch/modules/posts/
├── domain/
│   ├── models/
│   │   └── post.model.ts
│   ├── errors/
│   │   ├── post-not-found.error.ts
│   │   └── forbidden-post-access.error.ts
│   └── services/
│       └── post-visibility.policy.ts   ← Logique de visibilité
├── application/
│   ├── commands/
│   │   ├── create-post.command.ts
│   │   ├── update-post.command.ts
│   │   └── delete-post.command.ts
│   ├── queries/
│   │   ├── list-public-posts.query.ts
│   │   └── get-post-by-id.query.ts
│   └── ports/
│       └── post-repository.port.ts
├── infrastructure/
│   └── adapters/
│       └── post-repository.adapter.ts  ← Drizzle
└── interface/http/
    ├── posts.controller.ts
    └── dto/
        ├── create-post.dto.ts
        ├── update-post.dto.ts
        └── list-posts-query.dto.ts     ← Pagination
```

#### Domain — Post Model

Propriétés : `id`, `ownerId`, `title`, `content`, `visibility`, `createdAt`, `updatedAt`

#### Domain — Policy de visibilité

```
canAccess(post, requesterId?):
  - Si post.visibility === 'public' → true
  - Si post.visibility === 'private' ET requesterId === post.ownerId → true
  - Sinon → false
```

Cette policy est dans **Domain**, pas dans le controller.

#### Application — Commands

1. **CreatePostCommand** : `{ ownerId, title, content, visibility? }` → crée le post
2. **UpdatePostCommand** : `{ postId, requesterId, title?, content?, visibility? }` → vérifie ownership, met à jour
3. **DeletePostCommand** : `{ postId, requesterId }` → vérifie ownership, supprime

#### Application — Queries

1. **ListPublicPostsQuery** : `{ page, limit, requesterId? }` → si requesterId, inclut aussi ses posts privés
2. **GetPostByIdQuery** : `{ postId, requesterId? }` → applique la policy de visibilité

#### Application — Port

```
PostRepositoryPort:
  create(post): Post
  findById(id): Post | null
  findPublic(page, limit): { data: Post[], total: number }
  findPublicAndOwned(ownerId, page, limit): { data: Post[], total: number }
  update(id, data): Post
  delete(id): void
```

#### Infrastructure — Adapter

`PostRepositoryAdapter` implémente `PostRepositoryPort` avec des requêtes Drizzle :
- `findPublic` → lit depuis `postsPublicView`
- `findPublicAndOwned` → union des posts publics + posts privés du owner

#### Interface — Controller

| Route           | Méthode | Auth         | Guard/Décorateur             | Description               |
|-----------------|---------|--------------|------------------------------|---------------------------|
| `GET /posts`    | Query   | OptionalAuth | `@UseGuards(OptionalAuthGuard)` | Liste paginée           |
| `GET /posts/:id`| Query   | OptionalAuth | `@UseGuards(OptionalAuthGuard)` | Détail (policy appliquée)|
| `POST /posts`   | Command | JWT          | `@UseGuards(JwtAuthGuard)` + `@Can('posts', 'create')` | Création     |
| `PATCH /posts/:id`| Command | JWT        | `@UseGuards(JwtAuthGuard)`    | Mise à jour (ownership)  |
| `DELETE /posts/:id`| Command | JWT       | `@UseGuards(JwtAuthGuard)`    | Suppression (ownership)  |

#### Migrations et Seeds

1. `pnpm migrate:generate` → génère la migration pour la table `posts` et la view
2. `pnpm migrate:push` → applique
3. Ajouter dans `seed.dev.ts` :
   - 5 posts publics (2 users différents)
   - 2 posts privés (1 par user)

### Étape 10 — Module `posts.module.ts`

- Importer `CqrsModule`
- Déclarer tous les handlers (commands + queries)
- Binder le port : `{ provide: PostRepositoryPort, useClass: PostRepositoryAdapter }`
- Importer `DrizzleModule` (ou le service DB disponible globalement)
- Exporter le port si d'autres modules en ont besoin

### Étape 11 — Vérification finale

1. `pnpm build` doit compiler sans erreur
2. `pnpm dev` doit démarrer sans erreur
3. Swagger doit être accessible sur `http://localhost:3000/api/docs`
4. Tous les endpoints doivent être visibles et documentés
5. Le bouton "Authorize" dans Swagger doit fonctionner avec un JWT

---

## Où mettre quoi dans /arch

| Élément                | Couche         | Emplacement                                          |
|------------------------|----------------|------------------------------------------------------|
| Post model             | Domain         | `modules/posts/domain/models/`                       |
| Post errors            | Domain         | `modules/posts/domain/errors/`                       |
| Visibility policy      | Domain         | `modules/posts/domain/services/`                     |
| Commands/Queries       | Application    | `modules/posts/application/commands/` et `queries/`  |
| PostRepositoryPort     | Application    | `modules/posts/application/ports/`                   |
| PostRepositoryAdapter  | Infrastructure | `modules/posts/infrastructure/adapters/`             |
| PostsController        | Interface      | `modules/posts/interface/http/`                      |
| DTOs (create, update)  | Interface      | `modules/posts/interface/http/dto/`                  |
| Swagger config         | Interface      | `main.ts`                                            |
| `@Can()` decorator     | Interface      | `common/interface/http/decorators/`                  |
| PermissionsGuard       | Interface      | `common/interface/http/guards/`                      |
| OptionalAuthGuard      | Interface      | `common/interface/http/guards/`                      |

---

## Config (.env)

Pas de nouvelles variables pour ce concept. Vérifier que celles-ci sont déjà présentes :

```env
DATABASE_URL=postgresql://...
JWT_ACCESS_SECRET=...
PORT=3000
NODE_ENV=development
```

---

## Pièges à éviter

| Piège | Pourquoi | Solution |
|-------|----------|----------|
| Décorateurs Swagger sur des routes inexistantes | Swagger affiche des endpoints fantômes | Documenter uniquement ce qui existe |
| `@ApiBearerAuth()` sans `addBearerAuth()` dans le builder | Le bouton Authorize n'apparaît pas | Ajouter `addBearerAuth()` dans `DocumentBuilder` |
| `@Can()` sans `JwtAuthGuard` | Le PermissionsGuard n'a pas de `req.user` → crash ou 401 inattendu | Toujours combiner `@UseGuards(JwtAuthGuard)` avec `@Can()` |
| Vérifier l'ownership dans le controller | Logique métier dans l'Interface | La vérification d'ownership est dans le **handler CQRS** (Application), la policy de visibilité dans **Domain** |
| Oublier `OptionalAuthGuard` sur les routes de lecture | Posts privés de l'user connecté invisibles | Utiliser `OptionalAuthGuard` pour enrichir le contexte |
| Ne pas paginer les listes | `GET /posts` retourne 10 000 lignes | Toujours paginer. DTO avec `page` + `limit` (défauts raisonnables : page=1, limit=20) |
| View Drizzle sans `WITH (security_barrier)` ou mal filtrée | Fuite de données privées | Vérifier que la view ne retourne QUE les posts publics |
| Créer un PermissionsGuard qui fait des appels DB | Lent, couplé à l'infra, non testable | Les permissions sont dans le JWT payload, le guard ne lit que ça |
| Déclarer des composants communs sans les brancher | Faux sentiment de sécurité, rien n'est actif | Vérifier `app.module.ts` : chaque composant doit y être enregistré |

---

## Checklist DONE

- [ ] `pnpm build` compile sans erreur
- [ ] Swagger accessible sur `http://localhost:3000/api/docs`
- [ ] Le bouton "Authorize" accepte un JWT et les requêtes protégées fonctionnent
- [ ] Tous les endpoints auth/user/posts sont visibles dans Swagger avec tags
- [ ] Les DTOs ont des exemples dans Swagger
- [ ] `GET /health` retourne `{ status: "ok", timestamp }` et est dans Swagger
- [ ] `POST /posts` crée un post (auth requise, permission `posts:create`)
- [ ] `GET /posts` retourne les posts publics (paginés)
- [ ] `GET /posts` avec un JWT retourne aussi les posts privés de l'utilisateur
- [ ] `GET /posts/:id` applique la policy de visibilité
- [ ] `PATCH /posts/:id` ne marche que pour le owner
- [ ] `DELETE /posts/:id` ne marche que pour le owner
- [ ] Seed insère des posts de test
- [ ] `GlobalExceptionFilter` est branché (erreurs au format standard)
- [ ] `RequestIdMiddleware` est branché (header `x-request-id` présent)
- [ ] `HttpLoggingInterceptor` est branché (logs dans la console)
- [ ] `PermissionsGuard` est branché globalement
- [ ] `@Can()` est utilisé sur au moins un endpoint
- [ ] `OptionalAuthGuard` est utilisé sur `GET /posts` et `GET /posts/:id`
- [ ] Aucun fichier/composant déclaré mais non utilisé

---

## Tests manuels (curl)

### Swagger

```bash
# Ouvrir dans un navigateur :
open http://localhost:3000/api/docs
```

### Health

```bash
curl -s http://localhost:3000/health | jq
# { "status": "ok", "timestamp": "..." }
```

### Créer un post

```bash
curl -s -X POST http://localhost:3000/posts \
  -H "Authorization: Bearer <ACCESS_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"title":"Mon premier post","content":"Contenu du post","visibility":"public"}' | jq
```

### Créer un post privé

```bash
curl -s -X POST http://localhost:3000/posts \
  -H "Authorization: Bearer <ACCESS_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"title":"Post secret","content":"Contenu privé","visibility":"private"}' | jq
```

### Lister les posts (anonyme — publics uniquement)

```bash
curl -s "http://localhost:3000/posts?page=1&limit=10" | jq
```

### Lister les posts (authentifié — publics + ses privés)

```bash
curl -s "http://localhost:3000/posts?page=1&limit=10" \
  -H "Authorization: Bearer <ACCESS_TOKEN>" | jq
```

### Détail d'un post

```bash
curl -s http://localhost:3000/posts/<POST_UUID> | jq
```

### Détail d'un post privé (non-owner → 403)

```bash
# Avec un token d'un AUTRE user :
curl -s http://localhost:3000/posts/<PRIVATE_POST_UUID> \
  -H "Authorization: Bearer <OTHER_USER_TOKEN>" | jq
# Doit retourner 403 ou 404 selon ta stratégie
```

### Mettre à jour un post

```bash
curl -s -X PATCH http://localhost:3000/posts/<POST_UUID> \
  -H "Authorization: Bearer <ACCESS_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"title":"Titre modifié"}' | jq
```

### Supprimer un post

```bash
curl -s -X DELETE http://localhost:3000/posts/<POST_UUID> \
  -H "Authorization: Bearer <ACCESS_TOKEN>" | jq
```

### Vérifier que `@Can` bloque sans permission

```bash
# Si tu retires 'posts:create' du JWT payload d'un user,
# POST /posts doit retourner 403 Forbidden
```
