# 4 — Authorization, Permissions et Gestion des Expirations

## Objectif

Mettre en place un système d'**authorization propre** "resource + actions" **sans rôles** et **sans appels DB** dans le guard, combiné à une gestion rigoureuse des **expirations** (access token, refresh token, sessions) :

- `@Can(resource, action)` + `PermissionsGuard` basé sur les permissions dans le JWT
- `OptionalAuthGuard` pour les routes publiques enrichies quand l'utilisateur est connecté
- Access token JWT 15 min avec refus automatique si expiré (401 clair)
- Refresh token 7 jours avec sessions PostgreSQL, rotation obligatoire, vérifications complètes
- Logout qui révoque la session, change-password qui révoque TOUTES les sessions
- Policies d'ownership/visibilité dans Domain/Application (pas dans les controllers)

---

## Prérequis

- Les Concepts 1 à 3 sont en place (auth, user, rate limiting, posts, Swagger)
- Tu as compris la différence entre **authentification** (qui es-tu ?) et **authorization** (as-tu le droit ?)

---

## Étapes (pas à pas)

### Étape 1 — Comprendre le modèle de permissions

Le modèle est simple : **pas de rôles, pas de table en DB**. Les permissions sont directement dans le JWT payload.

```typescript
// Payload du JWT access token
{
  sub: "user-uuid",
  email: "john@example.com",
  permissions: [
    { resource: "posts", actions: ["create", "read", "update", "delete"] },
    { resource: "user", actions: ["read", "update"] },
    { resource: "conversations", actions: ["read", "create"] },
    { resource: "messages", actions: ["read", "create"] }
  ]
}
```

**Pourquoi pas de rôles ?** :

- Le projet est éducatif, on garde les choses simples
- Un système resource/action est plus granulaire qu'un rôle
- Pas besoin de table `roles` ni de relation `users_roles`
- Les permissions sont calculées au moment de la génération du token

**Quand les permissions changent** : L'utilisateur doit se re-loguer (ou refresh). C'est la limite d'un système sans DB lookup dans le guard — mais c'est un compromis acceptable pour la performance.

### Étape 2 — Type `UserPrincipal`

**Emplacement** : `src/arch/shared/types/user-principal.type.ts`

```
type Permission = { resource: string; actions: string[] };
type UserPrincipal = { sub: string; email: string; permissions: Permission[] };
```

C'est ce type qui est injecté dans `request.user` après validation du JWT par Passport.

### Étape 3 — Décorateur `@Can(resource, action)`

**Emplacement** : `src/arch/common/interface/http/decorators/can.decorator.ts`

Ce décorateur :

1. Utilise `SetMetadata` pour stocker `{ resource, action }` sur le handler
2. Est lu par le `PermissionsGuard`

**Utilisation** :

```
@Can('posts', 'create')   // Le user doit avoir posts.create
@Can('user', 'update')    // Le user doit avoir user.update
```

### Étape 4 — `PermissionsGuard`

**Emplacement** : `src/arch/common/interface/http/guards/permissions.guard.ts`

**Logique** :

```
1. Lire le metadata @Can du handler via Reflector
2. Si pas de @Can → laisser passer (pas de restriction)
3. Si @Can présent :
   a. Si pas de req.user → 401 Unauthorized
   b. Si req.user existe → chercher dans permissions[]
      - Trouver l'entrée avec resource === @Can.resource
      - Vérifier que actions[] contient @Can.action
      - Si oui → laisser passer
      - Si non → 403 Forbidden
```

**Cas spécial OptionalAuth** : Si le guard `OptionalAuthGuard` a posé un flag (ex : `req.isOptionalAuth = true`) et qu'il n'y a pas de `@Can()`, on laisse passer même sans user.

**Enregistrement** : Guard global dans `app.module.ts` :

```
{ provide: APP_GUARD, useClass: PermissionsGuard }
```

### Étape 5 — `OptionalAuthGuard`

**Emplacement** : `src/arch/common/interface/http/guards/optional-auth.guard.ts`

C'est un guard qui étend `AuthGuard('jwt')` avec une particularité : il ne **rejette jamais** si le token est absent.

```
handleRequest(err, user, info):
  - Si user existe → retourner user (authentifié)
  - Si token absent → retourner null (anonyme, pas d'erreur)
  - Si token invalide/expiré → option : retourner null ou lever 401
```

**Cas d'usage concrets** :

- `GET /posts` → anonyme voit les posts publics, connecté voit aussi ses privés
- `GET /posts/:id` → anonyme voit un post public, connecté voit aussi ses posts privés
- `GET /users/:id` → profil public, mais si le :id correspond au user connecté, on pourrait enrichir

### Étape 6 — Gestion de l'Access Token (15 min)

Le JWT access token a un TTL de 15 minutes (`JWT_ACCESS_EXPIRATION=15m`).

**Côté génération** (dans `JwtTokenAdapter`) :

```
jwt.sign(payload, secret, { expiresIn: '15m' })
```

**Côté validation** (dans `JwtStrategy` / Passport) :

- Passport vérifie automatiquement le `exp` du JWT
- Si expiré → `TokenExpiredError` → attrapé par le `GlobalExceptionFilter` → **401 Unauthorized**

**Réponse 401 pour token expiré** :

```json
{
  "statusCode": 401,
  "error": "Unauthorized",
  "message": "Access token expiré. Utilisez /auth/refresh pour obtenir un nouveau token.",
  "requestId": "...",
  "timestamp": "...",
  "path": "..."
}
```

**Clock skew** : En production, il peut y avoir un décalage d'horloge entre le serveur qui génère le token et celui qui le valide. Passport/jsonwebtoken accepte un `clockTolerance` (ex : 30 secondes). Si nécessaire, l'ajouter dans les options de `JwtStrategy`.

### Étape 7 — Gestion du Refresh Token (7 jours, sessions PostgreSQL)

Le refresh token est géré via une **table `sessions`** en PostgreSQL.

**Flow du refresh** :

```
Client envoie : POST /auth/refresh { refreshToken }
  ↓
1. Décoder le refresh token (vérifier la signature)
2. Extraire le sessionId du payload
3. Lire la session en DB par sessionId
4. Vérifications :
   a. Session existe ? → sinon 401
   b. Session non révoquée (revokedAt === null) ? → sinon 401
   c. Session non expirée (expiresAt > now()) ? → sinon 401
   d. Hash du refresh token correspond ? → sinon 401
5. ROTATION : révoquer l'ancienne session
6. Créer une nouvelle session :
   - Nouveau sessionId
   - Hash du nouveau refresh token
   - expiresAt = now + 7 jours
7. Générer un nouveau access token + refresh token
8. Retourner les deux
```

**Pourquoi la rotation ?** : Si un refresh token fuit, l'attaquant ne peut l'utiliser qu'une fois. Dès que le vrai utilisateur fait un refresh, le token de l'attaquant est invalidé (la session a été révoquée). C'est la **rotation de refresh token**.

### Étape 8 — Logout et Change Password

**Logout** (`POST /auth/logout`) :

```
1. Extraire le sessionId du JWT access token (ou du body)
2. Révoquer la session : UPDATE sessions SET revokedAt = NOW() WHERE id = sessionId
3. Le refresh token de cette session ne fonctionne plus
```

**Change Password** (`POST /auth/change-password`) :

```
1. Vérifier l'ancien mot de passe
2. Hasher le nouveau mot de passe
3. Mettre à jour le user
4. RÉVOQUER TOUTES LES SESSIONS du user : UPDATE sessions SET revokedAt = NOW() WHERE userId = ...
5. L'utilisateur est déconnecté de partout (tous les appareils)
```

### Étape 9 — Policies d'ownership et visibilité

Les policies sont des fonctions métier qui décident si un utilisateur peut accéder à une ressource spécifique. Elles sont dans **Domain** (ou **Application**), jamais dans les controllers.

**Post visibility policy** :

```
canAccessPost(post, requesterId?):
  - post.visibility === 'public' → true
  - post.visibility === 'private' AND requesterId === post.ownerId → true
  - Sinon → false (lever ForbiddenPostAccessError)
```

**Post ownership policy** :

```
canModifyPost(post, requesterId):
  - requesterId === post.ownerId → true
  - Sinon → false (lever ForbiddenPostAccessError)
```

**Où sont-elles appelées ?** Dans les **command/query handlers** (Application layer) :

```
// GetPostByIdHandler
const post = await this.postRepo.findById(query.postId);
if (!canAccessPost(post, query.requesterId)) throw new ForbiddenPostAccessError();
return post;
```

### Étape 10 — Mettre à jour Swagger

Chaque endpoint protégé doit documenter :

- `@ApiBearerAuth()` — Indique qu'un JWT est requis
- `@ApiResponse({ status: 401, description: 'Token manquant ou expiré' })`
- `@ApiResponse({ status: 403, description: 'Permission refusée ou accès non autorisé' })`

### Étape 11 — Mettre à jour `.env.example`

Vérifier que toutes les variables liées à l'auth sont documentées :

```env
JWT_ACCESS_SECRET=...
JWT_REFRESH_SECRET=...
JWT_ACCESS_EXPIRATION=15m
JWT_REFRESH_EXPIRATION=7d
```

---

## Où mettre quoi dans /arch

| Élément                     | Couche         | Emplacement                                                           |
| --------------------------- | -------------- | --------------------------------------------------------------------- |
| `UserPrincipal` type        | Shared         | `shared/types/user-principal.type.ts`                                 |
| `@Can()` decorator          | Interface      | `common/interface/http/decorators/can.decorator.ts`                   |
| `PermissionsGuard`          | Interface      | `common/interface/http/guards/permissions.guard.ts`                   |
| `OptionalAuthGuard`         | Interface      | `common/interface/http/guards/optional-auth.guard.ts`                 |
| `JwtAuthGuard`              | Interface      | Module auth : `interface/http/guards/`                                |
| `JwtStrategy`               | Interface      | Module auth : `interface/http/strategies/`                            |
| Token generation/validation | Infrastructure | Module auth : `infrastructure/adapters/jwt-token.adapter.ts`          |
| Session repository          | Infrastructure | Module auth : `infrastructure/adapters/session-repository.adapter.ts` |
| Session vérifications       | Application    | Module auth : `application/commands/refresh-token.handler.ts`         |
| Post visibility policy      | Domain         | Module posts : `domain/services/post-visibility.policy.ts`            |
| Post ownership policy       | Domain         | Module posts : `domain/services/post-visibility.policy.ts`            |
| Domain errors               | Domain         | `domain/errors/` dans chaque module                                   |

---

## Config (.env)

Pas de nouvelles variables. Vérifier la présence de :

```env
JWT_ACCESS_SECRET=change-me-access-secret-32-chars-min
JWT_REFRESH_SECRET=change-me-refresh-secret-32-chars-min
JWT_ACCESS_EXPIRATION=15m
JWT_REFRESH_EXPIRATION=7d
```

---

## Pièges à éviter

| Piège                                                               | Pourquoi                                                                                           | Solution                                                             |
| ------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| Stocker les permissions dans une table DB et les lire dans le guard | Appel DB à chaque requête protégée → lent                                                          | Permissions dans le JWT payload, le guard ne lit que `req.user`      |
| Oublier `@UseGuards(JwtAuthGuard)` quand tu mets `@Can()`           | Le PermissionsGuard n'a pas de user → crash ou 401 inattendu                                       | Toujours combiner les deux                                           |
| Vérifier l'ownership dans le controller                             | Logique métier dans l'Interface → pas testable, pas réutilisable                                   | Ownership vérifié dans le handler CQRS qui appelle la policy Domain  |
| Ne pas révoquer les sessions au change-password                     | L'attaquant qui a volé un refresh token peut encore l'utiliser                                     | `revokeAllByUserId()` obligatoire                                    |
| Ne pas hasher le refresh token en DB                                | Si la DB fuit, tous les refresh tokens sont compromis                                              | Toujours stocker uniquement le hash                                  |
| Oublier de vérifier `revokedAt` dans le refresh flow                | Un token révoqué (après logout) fonctionne encore                                                  | Vérifier les 4 conditions : existe, non révoqué, non expiré, hash OK |
| Token expiré = 403 au lieu de 401                                   | 403 = "tu n'as pas la permission" (authentifié mais pas autorisé). 401 = "tu n'es pas authentifié" | Token expiré/invalide → 401. Permission refusée → 403                |
| OptionalAuthGuard qui lève sur token expiré                         | L'utilisateur anonyme ne peut plus accéder aux routes publiques si un cookie expiré traîne         | Catch l'erreur, retourner null                                       |
| Mettre le clock skew à 5 minutes                                    | Un token "expiré" reste valide trop longtemps                                                      | 30 secondes max de tolérance                                         |
| Oublier de retourner le message "utilisez /auth/refresh" sur 401    | Le client ne sait pas quoi faire                                                                   | Message explicite dans la réponse 401                                |

---

## Checklist DONE

### Authorization

- [ ] `@Can(resource, action)` existe et est utilisé sur au moins 3 endpoints
- [ ] `PermissionsGuard` est enregistré globalement
- [ ] Un endpoint avec `@Can('posts', 'create')` retourne 403 si la permission manque
- [ ] Un endpoint avec `@Can()` sans token retourne 401
- [ ] Un endpoint SANS `@Can()` est accessible librement (pas de restriction)
- [ ] `OptionalAuthGuard` est utilisé sur `GET /posts` et `GET /posts/:id`
- [ ] `GET /posts` anonyme → posts publics uniquement
- [ ] `GET /posts` authentifié → posts publics + posts privés du user

### Expiration Access Token

- [ ] Le JWT access token expire après 15 minutes
- [ ] Une requête avec un token expiré retourne 401 (pas 403)
- [ ] Le message 401 indique clairement "token expiré" et suggère `/auth/refresh`
- [ ] Le `GlobalExceptionFilter` mappe `TokenExpiredError` → 401

### Refresh Token et Sessions

- [ ] `POST /auth/refresh` avec un refresh token valide retourne de nouveaux tokens
- [ ] L'ancien refresh token ne fonctionne plus après rotation (session révoquée)
- [ ] Un refresh token expiré (>7 jours) retourne 401
- [ ] Un refresh token d'une session révoquée retourne 401
- [ ] Le hash du refresh token est vérifié (pas de comparaison en clair)

### Logout et Change Password

- [ ] `POST /auth/logout` révoque la session → refresh impossible
- [ ] `POST /auth/change-password` révoque TOUTES les sessions
- [ ] Après change-password, aucun ancien refresh token ne fonctionne

### Policies

- [ ] La policy de visibilité est dans Domain (`post-visibility.policy.ts`)
- [ ] `GET /posts/:id` pour un post privé par un non-owner → 403
- [ ] `PATCH /posts/:id` par un non-owner → 403
- [ ] `DELETE /posts/:id` par un non-owner → 403

### Documentation

- [ ] Swagger documente les 401/403 sur chaque endpoint protégé
- [ ] `.env.example` contient toutes les variables JWT

---

## Tests manuels (curl)

### Tester `@Can` — Permission présente

```bash
# Login (le JWT inclut les permissions par défaut)
TOKEN=$(curl -s -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"MyP@ss123"}' | jq -r '.accessToken')

# Créer un post (nécessite posts:create)
curl -s -X POST http://localhost:3000/posts \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"title":"Test @Can","content":"Ceci teste les permissions"}' | jq
# → 201 Created
```

### Tester `@Can` — Sans token (401)

```bash
curl -s -X POST http://localhost:3000/posts \
  -H "Content-Type: application/json" \
  -d '{"title":"Sans token","content":"..."}' | jq
# → 401 Unauthorized
```

### Tester l'expiration de l'access token

```bash
# Attendre 15 minutes (ou réduire temporairement JWT_ACCESS_EXPIRATION=10s pour tester)
curl -s http://localhost:3000/users/me \
  -H "Authorization: Bearer <EXPIRED_TOKEN>" | jq
# → 401 avec message "token expiré"
```

### Tester le refresh avec rotation

```bash
# Refresh
TOKENS=$(curl -s -X POST http://localhost:3000/auth/refresh \
  -H "Content-Type: application/json" \
  -d '{"refreshToken":"<REFRESH_TOKEN>"}')
echo $TOKENS | jq

# Re-utiliser l'ancien refresh token (doit échouer)
curl -s -X POST http://localhost:3000/auth/refresh \
  -H "Content-Type: application/json" \
  -d '{"refreshToken":"<ANCIEN_REFRESH_TOKEN>"}' | jq
# → 401 (session révoquée)
```

### Tester le logout

```bash
# Logout
curl -s -X POST http://localhost:3000/auth/logout \
  -H "Authorization: Bearer $TOKEN" | jq

# Essayer de refresh avec l'ancien refresh token
curl -s -X POST http://localhost:3000/auth/refresh \
  -H "Content-Type: application/json" \
  -d '{"refreshToken":"<REFRESH_TOKEN>"}' | jq
# → 401 (session révoquée)
```

### Tester change-password révoque toutes les sessions

```bash
# Se loguer sur 2 "appareils" (2 sessions)
TOKEN1=$(curl -s -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"MyP@ss123"}' | jq -r '.accessToken')
REFRESH1=$(curl -s -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"MyP@ss123"}' | jq -r '.refreshToken')

TOKEN2=$(curl -s -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"MyP@ss123"}' | jq -r '.accessToken')
REFRESH2=$(curl -s -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"MyP@ss123"}' | jq -r '.refreshToken')

# Change password depuis la session 1
curl -s -X POST http://localhost:3000/auth/change-password \
  -H "Authorization: Bearer $TOKEN1" \
  -H "Content-Type: application/json" \
  -d '{"oldPassword":"MyP@ss123","newPassword":"NewP@ss456"}' | jq

# Essayer de refresh avec REFRESH2 (autre session) → doit échouer
curl -s -X POST http://localhost:3000/auth/refresh \
  -H "Content-Type: application/json" \
  -d '{"refreshToken":"'$REFRESH2'"}' | jq
# → 401 (toutes les sessions sont révoquées)
```

### Tester la policy de visibilité des posts

```bash
# Créer un post privé avec user1
POST_ID=$(curl -s -X POST http://localhost:3000/posts \
  -H "Authorization: Bearer $TOKEN_USER1" \
  -H "Content-Type: application/json" \
  -d '{"title":"Privé","content":"Secret","visibility":"private"}' | jq -r '.id')

# Accéder avec user2 → 403
curl -s http://localhost:3000/posts/$POST_ID \
  -H "Authorization: Bearer $TOKEN_USER2" | jq
# → 403 Forbidden

# Accéder anonymement → 403 ou 404
curl -s http://localhost:3000/posts/$POST_ID | jq
# → 403 ou 404

# Accéder avec user1 (owner) → 200
curl -s http://localhost:3000/posts/$POST_ID \
  -H "Authorization: Bearer $TOKEN_USER1" | jq
# → 200 OK
```
