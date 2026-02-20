# 6 — Module Chat : HTTP d'abord, WebSocket ensuite

## Objectif

Ajouter un **module chat complet** au projet, en 3 phases :

1. **Phase A** — Finaliser la partie HTTP (vérifier que tout est clean)
2. **Phase B** — Chat HTTP persisté (conversations, membres, messages — REST + CQRS)
3. **Phase C** — Chat WebSocket temps réel (gateway comme simple transport, auth JWT au handshake)

Le principe fondamental : **le WebSocket n'est qu'un transport**. Toute la logique métier et la persistance passent par les commands/queries CQRS, exactement comme pour HTTP.

---

## Prérequis

- Les Concepts 1 à 5 sont en place et fonctionnels
- PostgreSQL et Redis accessibles
- `pnpm build` compile sans erreur
- Pour la Phase C : `@nestjs/websockets` et `socket.io` installés

---

## Étapes (pas à pas)

### Phase A — Vérification HTTP

Avant d'ajouter le chat, s'assurer que tout le reste est clean. Référence : le Concept 5 (finalisation).

**Checklist rapide** :
- [ ] Auth cycle complet OK (signup → login → refresh → logout → change-password)
- [ ] Posts CRUD OK avec visibilité/ownership
- [ ] Rate limiting actif
- [ ] Swagger fidèle
- [ ] Composants communs branchés
- [ ] `pnpm build` sans erreur

Si tout est OK, passe à la Phase B.

---

### Phase B — Chat HTTP Persisté

#### B.1 — Schema (Drizzle)

Ajouter dans `schema.ts` :

**Table `conversations`** :

| Colonne    | Type              | Notes                            |
|------------|-------------------|----------------------------------|
| `id`       | UUID PK           | `gen_random_uuid()`              |
| `createdBy`| UUID FK → users   | CASCADE                          |
| `title`    | VARCHAR 255       | Nullable (optionnel)             |
| `createdAt`| TIMESTAMP WITH TZ | `defaultNow()`                   |
| `updatedAt`| TIMESTAMP WITH TZ | `defaultNow()`                   |

**Table `conversation_members`** :

| Colonne          | Type              | Notes                        |
|------------------|-------------------|------------------------------|
| `conversationId` | UUID FK → conversations | CASCADE, PK composite   |
| `userId`         | UUID FK → users   | CASCADE, PK composite        |
| `joinedAt`       | TIMESTAMP WITH TZ | `defaultNow()`               |

**Clé primaire composite** : `(conversationId, userId)` — un user ne peut être membre qu'une fois par conversation.

**Table `messages`** :

| Colonne          | Type              | Notes                        |
|------------------|-------------------|------------------------------|
| `id`             | UUID PK           | `gen_random_uuid()`          |
| `conversationId` | UUID FK → conversations | CASCADE                |
| `senderId`       | UUID FK → users   | CASCADE                      |
| `content`        | TEXT              | Le message                   |
| `createdAt`      | TIMESTAMP WITH TZ | `defaultNow()`               |

#### B.2 — Migrations et Seeds

```bash
pnpm migrate:generate
pnpm migrate:push
```

Seed (`seed.dev.ts`) — ajouter :
- 1 conversation entre user1 et user2
- Membership pour les 2 users
- 5 messages échangés

#### B.3 — Arborescence du module

```
src/arch/modules/chat/
├── domain/
│   ├── models/
│   │   ├── conversation.model.ts
│   │   ├── conversation-member.model.ts
│   │   └── message.model.ts
│   ├── errors/
│   │   ├── conversation-not-found.error.ts
│   │   ├── not-conversation-member.error.ts
│   │   ├── already-conversation-member.error.ts
│   │   └── cannot-add-member.error.ts
│   └── services/
│       └── membership.policy.ts   ← Policy : seuls les membres peuvent lire/écrire
├── application/
│   ├── commands/
│   │   ├── create-conversation.command.ts
│   │   ├── add-conversation-member.command.ts
│   │   └── send-message.command.ts
│   ├── queries/
│   │   ├── list-my-conversations.query.ts
│   │   ├── get-conversation-by-id.query.ts
│   │   └── list-messages.query.ts
│   └── ports/
│       ├── conversation-repository.port.ts
│       ├── conversation-member-repository.port.ts
│       └── message-repository.port.ts
├── infrastructure/
│   └── adapters/
│       ├── conversation-repository.adapter.ts
│       ├── conversation-member-repository.adapter.ts
│       └── message-repository.adapter.ts
└── interface/
    ├── http/
    │   ├── chat.controller.ts
    │   └── dto/
    │       ├── create-conversation.dto.ts
    │       ├── add-member.dto.ts
    │       ├── send-message.dto.ts
    │       └── list-messages-query.dto.ts
    └── ws/   ← Phase C (vide pour l'instant, NE PAS le créer maintenant)
```

#### B.4 — Domain

**Models** : Propriétés simples (id, userId, content, etc.)

**Errors** :
- `ConversationNotFoundError` — conversation inexistante
- `NotConversationMemberError` — l'utilisateur n'est pas membre
- `AlreadyConversationMemberError` — déjà membre
- `CannotAddMemberError` — ne peut pas ajouter (ex: seul le créateur peut inviter, ou tout membre peut inviter — choisis une règle et tiens-toi y)

**Membership Policy** :
```
canAccessConversation(conversationId, userId, memberRepo):
  → vérifie que le userId est dans conversation_members pour cette conversation
  → sinon : NotConversationMemberError
```

Cette policy est appelée dans CHAQUE handler qui touche à une conversation (lecture des messages, envoi, détails).

#### B.5 — Application (Commands)

**CreateConversationCommand** :
```
Input: { createdBy, title?, memberIds[] }
1. Créer la conversation
2. Ajouter createdBy comme membre
3. Ajouter chaque memberId comme membre (vérifier qu'ils existent)
4. Retourner la conversation
```

**AddConversationMemberCommand** :
```
Input: { conversationId, requesterId, userId }
1. Vérifier que la conversation existe
2. Vérifier que requesterId est membre (membership policy)
3. Vérifier que userId n'est pas déjà membre
4. Ajouter userId comme membre
```

**SendMessageCommand** :
```
Input: { conversationId, senderId, content }
1. Vérifier que la conversation existe
2. Vérifier que senderId est membre (membership policy)
3. Créer le message
4. Retourner le message
```

#### B.6 — Application (Queries)

**ListMyConversationsQuery** :
```
Input: { userId }
→ Retourne toutes les conversations où userId est membre
```

**GetConversationByIdQuery** :
```
Input: { conversationId, requesterId }
1. Vérifier que requesterId est membre
2. Retourner la conversation avec ses membres
```

**ListMessagesQuery** :
```
Input: { conversationId, requesterId, page, limit }
1. Vérifier que requesterId est membre
2. Retourner les messages paginés (du plus récent au plus ancien)
```

#### B.7 — Application (Ports)

```
ConversationRepositoryPort:
  create(conv): Conversation
  findById(id): Conversation | null

ConversationMemberRepositoryPort:
  addMember(conversationId, userId): void
  isMember(conversationId, userId): boolean
  findMembersByConversation(conversationId): Member[]
  findConversationsByUser(userId): Conversation[]

MessageRepositoryPort:
  create(message): Message
  findByConversation(conversationId, page, limit): { data: Message[], total: number }
```

#### B.8 — Infrastructure (Adapters)

Chaque adapter implémente son port avec des requêtes Drizzle. Pas de logique métier ici — juste du CRUD.

#### B.9 — Interface HTTP (Controller)

| Route                                        | Méthode | Auth | Description                     |
|----------------------------------------------|---------|------|---------------------------------|
| `POST /chat/conversations`                   | Command | JWT  | Créer une conversation          |
| `GET /chat/conversations`                    | Query   | JWT  | Mes conversations               |
| `GET /chat/conversations/:id`                | Query   | JWT  | Détail (membership vérifiée)    |
| `POST /chat/conversations/:id/members`       | Command | JWT  | Ajouter un membre               |
| `GET /chat/conversations/:id/messages`       | Query   | JWT  | Messages paginés                |
| `POST /chat/conversations/:id/messages`      | Command | JWT  | Envoyer un message              |

Tous les endpoints chat nécessitent `@UseGuards(JwtAuthGuard)`.

**Permissions** : `@Can('conversations', 'create')`, `@Can('messages', 'create')`, etc.

#### B.10 — Module `chat.module.ts`

- Importer `CqrsModule`
- Déclarer tous les handlers (commands + queries)
- Binder les ports : `{ provide: XxxPort, useClass: XxxAdapter }`
- Exporter les ports si nécessaire

Enregistrer dans `app.module.ts` :
```
imports: [..., ChatModule]
```

#### B.11 — Swagger

Ajouter `@ApiTags('chat')` au controller. Documenter tous les endpoints avec DTOs, réponses, et `@ApiBearerAuth()`.

#### B.12 — Test HTTP complet

Avant de passer au WebSocket, vérifie que tout le chat fonctionne via REST.

---

### Phase C — Chat WebSocket Temps Réel

#### C.1 — Installer les dépendances

```bash
pnpm add @nestjs/websockets @nestjs/platform-socket.io socket.io
```

#### C.2 — Principe fondamental

Le **WebSocket Gateway est un simple transport**. Il ne fait que :
1. Authentifier la connexion (JWT au handshake)
2. Joindre des rooms (une room par conversation)
3. Recevoir des events et les transformer en **Commands CQRS**
4. Broadcaster les résultats aux membres de la room

**AUCUNE logique métier dans le gateway**. Pas de vérification de membership, pas de validation de contenu. Tout passe par les handlers CQRS existants (les mêmes que pour HTTP).

#### C.3 — Arborescence

```
src/arch/modules/chat/interface/ws/
├── chat.gateway.ts         ← Le gateway Socket.IO
└── guards/
    └── ws-jwt-auth.guard.ts ← Auth au handshake
```

#### C.4 — Guard WebSocket (`WsJwtAuthGuard`)

Ce guard n'est **pas** un guard NestJS standard (il ne peut pas utiliser `APP_GUARD`). Il fonctionne au niveau du **handshake** Socket.IO.

**Logique** :
```
1. Extraire le token du handshake : client.handshake.auth.token
2. Vérifier le JWT (même secret que l'access token)
3. Si valide → attacher le user au socket (socket.data.user = decoded)
4. Si invalide → déconnecter le client avec un message d'erreur
```

**Implémentation** : Dans le gateway, utiliser le lifecycle hook `handleConnection` :
```
handleConnection(client: Socket):
  try:
    token = client.handshake.auth.token
    user = jwtService.verify(token)
    client.data.user = user
  catch:
    client.disconnect()
```

#### C.5 — Gateway (`ChatGateway`)

**Namespace** : `/chat` (les clients se connectent sur `ws://localhost:3000/chat`)

**Events** :

| Event          | Direction       | Description                                        |
|----------------|-----------------|----------------------------------------------------|
| `connection`   | Client → Server | Handshake + auth JWT                               |
| `join_room`    | Client → Server | Rejoindre une room (conversationId)                |
| `send_message` | Client → Server | Envoyer un message (via CQRS)                      |
| `new_message`  | Server → Client | Broadcast du message à tous les membres de la room |
| `disconnect`   | Client → Server | Déconnexion                                        |

**Flow `send_message`** :
```
1. Client envoie : { conversationId, content }
2. Gateway extrait le userId depuis socket.data.user
3. Gateway exécute : commandBus.execute(new SendMessageCommand(conversationId, senderId, content))
4. Le handler CQRS (le même que pour HTTP) :
   - Vérifie la membership
   - Crée le message en DB
   - Retourne le message
5. Gateway broadcaste le message à la room : server.to(conversationId).emit('new_message', message)
```

**Flow `join_room`** :
```
1. Client envoie : { conversationId }
2. Gateway vérifie que l'utilisateur est membre (via un query)
3. Si OK → client.join(conversationId)
4. Si KO → envoyer une erreur au client
```

#### C.6 — Scaling multi-instance (note)

Par défaut, Socket.IO fonctionne en mémoire. Si tu as plusieurs instances du serveur, les clients connectés à l'instance A ne voient pas les messages broadcastés par l'instance B.

**Solution** : `@socket.io/redis-adapter`

```bash
pnpm add @socket.io/redis-adapter
```

Configuration dans le module :
```
IoAdapter avec Redis → les events sont broadcastés via Redis pub/sub
```

**Pour l'instant** : c'est une **note** pour plus tard. En dev sur une seule instance, ce n'est pas nécessaire. Mais garde ça en tête pour la production.

#### C.7 — Erreurs WebSocket

Les erreurs dans le gateway ne passent pas par le `GlobalExceptionFilter` HTTP. Il faut les gérer manuellement :

```
try {
  const message = await this.commandBus.execute(command);
  server.to(conversationId).emit('new_message', message);
} catch (error) {
  client.emit('error', { message: error.message });
}
```

#### C.8 — Mettre à jour `chat.module.ts`

Ajouter le gateway aux providers :
```
providers: [...handlers, ..., ChatGateway]
```

#### C.9 — Mettre à jour le GlobalExceptionFilter

Ajouter le mapping dans le filter pour les erreurs chat :
- `ConversationNotFoundError` → 404
- `NotConversationMemberError` → 403
- `CannotAddMemberError` → 403
- `AlreadyConversationMemberError` → 409

---

## Où mettre quoi dans /arch

| Élément                        | Couche         | Emplacement                                        |
|--------------------------------|----------------|----------------------------------------------------|
| Models (conversation, message) | Domain         | `modules/chat/domain/models/`                      |
| Errors (not member, etc.)      | Domain         | `modules/chat/domain/errors/`                      |
| Membership policy              | Domain         | `modules/chat/domain/services/`                    |
| Commands/Queries               | Application    | `modules/chat/application/commands/` et `queries/` |
| Ports (repositories)           | Application    | `modules/chat/application/ports/`                  |
| Adapters (Drizzle)             | Infrastructure | `modules/chat/infrastructure/adapters/`            |
| REST Controller                | Interface      | `modules/chat/interface/http/`                     |
| DTOs                           | Interface      | `modules/chat/interface/http/dto/`                 |
| WebSocket Gateway              | Interface      | `modules/chat/interface/ws/`                       |
| WS Auth Guard                  | Interface      | `modules/chat/interface/ws/guards/`                |

**Règle** : Le gateway (Interface) n'appelle que le `CommandBus`/`QueryBus` (Application). Il ne touche jamais directement aux adapters ni au domain.

---

## Config (.env)

Pas de nouvelles variables spécifiques au chat. Le WebSocket utilise le même port que HTTP (Socket.IO est attaché au même serveur HTTP).

Si tu veux configurer le Redis adapter pour le scaling :
```env
# Redis (déjà présent pour le rate limiting)
REDIS_URL=redis://localhost:6379
```

---

## Pièges à éviter

| Piège | Pourquoi | Solution |
|-------|----------|----------|
| Mettre la logique métier dans le gateway | Le gateway est un transport, pas un service métier | Tout passe par `commandBus.execute()` |
| Oublier la membership policy | N'importe qui peut lire les messages d'une conversation | Vérifier la membership dans CHAQUE handler (read et write) |
| Vérifier la membership dans le controller/gateway | Logique métier dans l'Interface | La membership est vérifiée dans le handler CQRS |
| Créer le dossier `ws/` avant la Phase C | Dossier vide → bruit | Ne créer que quand tu en as besoin |
| WebSocket sans auth | Tout le monde peut écouter les conversations | Auth JWT au handshake, déconnexion si invalide |
| Ne pas joindre les rooms | Les messages sont broadcastés à TOUT le monde | `client.join(conversationId)` après vérification de membership |
| Oublier de gérer les erreurs dans le gateway | Les erreurs partent dans le void | Try/catch + `client.emit('error', ...)` |
| Scaling sans Redis adapter | Les messages ne sont pas partagés entre instances | Ajouter `@socket.io/redis-adapter` en production |
| Ne pas tester le chat HTTP avant d'ajouter le WS | Tu ne sais pas si les handlers CQRS marchent | Phase B entièrement testée → Phase C |
| Créer des endpoints REST ET WebSocket redondants | Double la surface d'API pour rien | REST pour le CRUD (lister conversations, historique), WS pour le temps réel (envoyer/recevoir en live) |

---

## Checklist DONE

### Phase A — HTTP Clean
- [ ] Auth, posts, rate limiting, Swagger → tout OK (cf. Concept 5)
- [ ] `pnpm build` compile

### Phase B — Chat HTTP
- [ ] Tables `conversations`, `conversation_members`, `messages` créées
- [ ] Seed insère une conversation avec messages
- [ ] `POST /chat/conversations` crée une conversation
- [ ] `GET /chat/conversations` liste mes conversations
- [ ] `GET /chat/conversations/:id` avec membership check
- [ ] `POST /chat/conversations/:id/members` ajoute un membre
- [ ] `GET /chat/conversations/:id/messages` paginé
- [ ] `POST /chat/conversations/:id/messages` envoie un message
- [ ] Un non-membre qui tente de lire les messages → 403
- [ ] Un non-membre qui tente d'envoyer un message → 403
- [ ] Swagger documente tous les endpoints chat
- [ ] `pnpm build` compile

### Phase C — Chat WebSocket
- [ ] Gateway sur `/chat` namespace
- [ ] Auth JWT au handshake (déconnexion si invalide)
- [ ] `join_room` rejoint une room conversation
- [ ] `send_message` persiste via CQRS et broadcaste `new_message`
- [ ] Les erreurs sont envoyées au client via `client.emit('error', ...)`
- [ ] Le gateway ne contient AUCUNE logique métier
- [ ] `pnpm build` compile
- [ ] Note sur le Redis adapter pour le scaling documentée

---

## Tests manuels (curl et WebSocket)

### Phase B — Tests HTTP

#### Créer une conversation

```bash
curl -s -X POST http://localhost:3000/chat/conversations \
  -H "Authorization: Bearer $TOKEN_USER1" \
  -H "Content-Type: application/json" \
  -d '{"title":"Discussion","memberIds":["<USER2_UUID>"]}' | jq
```

#### Lister mes conversations

```bash
curl -s http://localhost:3000/chat/conversations \
  -H "Authorization: Bearer $TOKEN_USER1" | jq
```

#### Détail d'une conversation

```bash
curl -s http://localhost:3000/chat/conversations/<CONV_UUID> \
  -H "Authorization: Bearer $TOKEN_USER1" | jq
```

#### Ajouter un membre

```bash
curl -s -X POST http://localhost:3000/chat/conversations/<CONV_UUID>/members \
  -H "Authorization: Bearer $TOKEN_USER1" \
  -H "Content-Type: application/json" \
  -d '{"userId":"<USER3_UUID>"}' | jq
```

#### Envoyer un message (HTTP)

```bash
curl -s -X POST http://localhost:3000/chat/conversations/<CONV_UUID>/messages \
  -H "Authorization: Bearer $TOKEN_USER1" \
  -H "Content-Type: application/json" \
  -d '{"content":"Hello depuis HTTP !"}' | jq
```

#### Lister les messages

```bash
curl -s "http://localhost:3000/chat/conversations/<CONV_UUID>/messages?page=1&limit=20" \
  -H "Authorization: Bearer $TOKEN_USER1" | jq
```

#### Non-membre → 403

```bash
curl -s http://localhost:3000/chat/conversations/<CONV_UUID>/messages \
  -H "Authorization: Bearer $TOKEN_USER3_NOT_MEMBER" | jq
# → 403 Forbidden
```

### Phase C — Tests WebSocket

Pour tester le WebSocket, plusieurs options :

#### Option 1 : Script Node.js

```javascript
// test-ws.js
const { io } = require('socket.io-client');

const socket = io('http://localhost:3000/chat', {
  auth: { token: '<ACCESS_TOKEN>' }
});

socket.on('connect', () => {
  console.log('Connecté ! Socket ID:', socket.id);

  // Rejoindre une room
  socket.emit('join_room', { conversationId: '<CONV_UUID>' });

  // Envoyer un message
  socket.emit('send_message', {
    conversationId: '<CONV_UUID>',
    content: 'Hello depuis WebSocket !'
  });
});

socket.on('new_message', (message) => {
  console.log('Nouveau message:', message);
});

socket.on('error', (error) => {
  console.error('Erreur:', error);
});

socket.on('disconnect', (reason) => {
  console.log('Déconnecté:', reason);
});
```

```bash
node test-ws.js
```

#### Option 2 : wscat + Postman

- **Postman** : Supporte nativement Socket.IO (onglet WebSocket)
- Connecter sur `ws://localhost:3000/chat` avec le header auth

#### Test d'auth WebSocket invalide

```javascript
const socket = io('http://localhost:3000/chat', {
  auth: { token: 'token-invalide' }
});

socket.on('connect_error', (error) => {
  console.log('Connection refusée:', error.message);
  // → "jwt malformed" ou "Unauthorized"
});
```

#### Test broadcast entre 2 clients

Ouvrir 2 terminaux avec 2 tokens différents (2 membres de la même conversation) :

```bash
# Terminal 1 : User1 écoute
node -e "
const io = require('socket.io-client');
const s = io('http://localhost:3000/chat', { auth: { token: '$TOKEN_USER1' } });
s.on('connect', () => { s.emit('join_room', { conversationId: '$CONV_ID' }); });
s.on('new_message', (m) => console.log('USER1 reçoit:', m));
"

# Terminal 2 : User2 envoie
node -e "
const io = require('socket.io-client');
const s = io('http://localhost:3000/chat', { auth: { token: '$TOKEN_USER2' } });
s.on('connect', () => {
  s.emit('join_room', { conversationId: '$CONV_ID' });
  setTimeout(() => s.emit('send_message', { conversationId: '$CONV_ID', content: 'Coucou !' }), 1000);
});
s.on('new_message', (m) => console.log('USER2 reçoit:', m));
"
```

User1 devrait voir le message de User2 s'afficher en temps réel.
