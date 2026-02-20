# 7 — Logging Professionnel avec Winston

## Objectif

Intégrer un **système de logging professionnel** avec Winston qui :

- Produit des logs **lisibles en console** (développement) et **persistés en fichiers** (production)
- Fichiers séparés par **niveau** (error, warn, info) et par **type** (HTTP vs applicatif)
- Support optionnel de la **rotation** des fichiers (daily rotate)
- Configuration via **variables d'environnement**
- Création automatique du dossier `logs/` + ajout à `.gitignore`
- Remplace/centralise le logging NestJS natif
- S'intègre avec `RequestIdMiddleware`, `HttpLoggingInterceptor`, `GlobalExceptionFilter`
- Fournit un logger **injectable** pour les logs applicatifs (auth, posts, chat)
- **Ne logge jamais** de secrets, tokens, mots de passe

---

## Prérequis

- Le projet des Concepts 1 à 6 fonctionne
- `pnpm build` compile sans erreur

---

## Étapes (pas à pas)

### Étape 1 — Installer les dépendances

```bash
pnpm add winston nest-winston
```

Optionnel (rotation des fichiers) :

```bash
pnpm add winston-daily-rotate-file
```

### Étape 2 — Comprendre les niveaux de log Winston

Winston utilise les niveaux npm par défaut (du plus grave au plus verbeux) :

| Niveau  | Valeur | Usage                                                           |
| ------- | ------ | --------------------------------------------------------------- |
| `error` | 0      | Erreurs non récupérables, exceptions 5xx                        |
| `warn`  | 1      | Situations suspectes, erreurs 4xx (client)                      |
| `info`  | 2      | Événements importants (démarrage, login, création de ressource) |
| `http`  | 3      | Requêtes HTTP entrantes/sortantes                               |
| `debug` | 4      | Détails techniques pour le dev                                  |

Le paramètre `LOG_LEVEL` définit le niveau **minimum**. Par exemple, `LOG_LEVEL=http` logge tout sauf `debug`.

### Étape 3 — Créer le dossier et les fichiers

**Emplacement** : `src/arch/common/infra/logger/`

```
src/arch/common/infra/logger/
├── logger.config.ts       ← Lit les variables d'env
├── winston.instance.ts    ← Crée l'instance Winston
├── logger.service.ts      ← AppLogger injectable
└── logger.module.ts       ← Module @Global()
```

### Étape 4 — Configuration (`logger.config.ts`)

Lit les variables d'environnement via `ConfigService` :

| Variable         | Défaut        | Description                                     |
| ---------------- | ------------- | ----------------------------------------------- |
| `LOG_LEVEL`      | `http`        | Niveau minimum (error, warn, info, http, debug) |
| `LOG_DIR`        | `logs`        | Dossier de sortie des fichiers                  |
| `LOG_CONSOLE`    | `true`        | Activer les logs en console                     |
| `LOG_FILE`       | `true` (prod) | Activer les logs en fichiers                    |
| `LOG_JSON_FILES` | `true` (prod) | Format JSON dans les fichiers (sinon texte)     |
| `LOG_ROTATE`     | `false`       | Activer la rotation quotidienne                 |
| `LOG_MAX_FILES`  | `14d`         | Rétention des fichiers (jours ou nombre)        |

**Règle** : En développement (`NODE_ENV=development`), active principalement la console. En production, active les fichiers avec rotation.

### Étape 5 — Instance Winston (`winston.instance.ts`)

Créer la factory qui construit l'instance `winston.Logger` :

**Transports à configurer** :

1. **Console** (si `LOG_CONSOLE=true`) :
   - Format coloré et lisible (`winston.format.colorize()` + `printf`)
   - Format : `[2024-01-15 10:30:45] [INFO] [AuthService] User logged in { userId: "..." }`
   - Inclure le `requestId` quand disponible

2. **Fichier Error** (si `LOG_FILE=true`) :
   - Chemin : `logs/error.log`
   - Niveau : `error` uniquement (`level: 'error'`)
   - Format JSON (structuré, parseable)

3. **Fichier Warn** (si `LOG_FILE=true`) :
   - Chemin : `logs/warn.log`
   - Niveau : `warn` uniquement

4. **Fichier Combined** (si `LOG_FILE=true`) :
   - Chemin : `logs/combined.log`
   - Tous les niveaux jusqu'à `LOG_LEVEL`

5. **Fichier HTTP** (si `LOG_FILE=true`) :
   - Chemin : `logs/http.log`
   - Niveau : `http` uniquement
   - Logs HTTP séparés des logs applicatifs

**Rotation optionnelle** (si `LOG_ROTATE=true` et `winston-daily-rotate-file` installé) :

- Remplacement des transports File par des transports DailyRotateFile
- Pattern : `logs/error-%DATE%.log`, etc.
- `maxFiles: '14d'` (suppression automatique après 14 jours)

**Création automatique du dossier `logs/`** :

```typescript
import { mkdirSync, existsSync } from 'fs';
if (!existsSync(logDir)) mkdirSync(logDir, { recursive: true });
```

### Étape 6 — Logger injectable (`logger.service.ts`)

`AppLogger` est un service injectable qui wrape l'instance Winston :

```
@Injectable()
class AppLogger {
  private context: string = 'App';

  constructor(@Inject(WINSTON_LOGGER) private logger: Logger) {}

  withContext(context: string): AppLogger { ... }

  info(message: string, meta?: object): void { this.logger.info(message, { context: this.context, ...meta }); }
  warn(message: string, meta?: object): void { ... }
  error(message: string, meta?: object): void { ... }
  http(message: string, meta?: object): void { ... }
  debug(message: string, meta?: object): void { ... }
}
```

**`withContext()`** : Permet de créer une copie du logger avec un contexte nommé :

```typescript
private readonly logger = this.appLogger.withContext('AuthService');
this.logger.info('User logged in', { userId });
// → [INFO] [AuthService] User logged in { userId: "..." }
```

### Étape 7 — Module `@Global()` (`logger.module.ts`)

```
@Global()
@Module({
  providers: [
    { provide: WINSTON_LOGGER, useFactory: createWinstonInstance, inject: [ConfigService] },
    AppLogger,
  ],
  exports: [AppLogger, WINSTON_LOGGER],
})
export class LoggerModule {}
```

**Pourquoi `@Global()`** : Le logger est utilisé partout. Un seul enregistrement dans `app.module.ts` suffit.

### Étape 8 — Brancher Winston dans NestJS (`main.ts`)

Remplacer le logger natif de NestJS par Winston :

```typescript
import { WinstonModule } from 'nest-winston';

const app = await NestFactory.create(AppModule, {
  logger: WinstonModule.createLogger({ instance: winstonInstance }),
});
```

Cela redirige **tous** les logs NestJS (bootstrap, DI, Passport, etc.) vers Winston.

### Étape 9 — Adapter le `RequestIdMiddleware`

Le middleware doit attacher le `requestId` au contexte du logger pour que tous les logs d'une même requête soient corrélés.

**Comment** : Utiliser `cls-hooked`, `AsyncLocalStorage`, ou simplement attacher le requestId à `req` et le lire dans les interceptors/filters.

L'approche la plus simple :

1. Le middleware attache `req.requestId = uuid`
2. Le `HttpLoggingInterceptor` lit `req.requestId` et le passe au logger
3. Le `GlobalExceptionFilter` lit `req.requestId` et le passe au logger

### Étape 10 — Adapter le `HttpLoggingInterceptor`

Utiliser `AppLogger` (ou l'instance Winston directement) au lieu de `console.log` :

**Incoming** :

```
this.logger.http('Incoming request', {
  method: req.method,
  path: req.url,
  ip: req.ip,
  userAgent: req.headers['user-agent'],
  requestId: req.requestId,
  userId: req.user?.sub,
});
```

**Outgoing** :

```
const level = statusCode >= 500 ? 'error' : statusCode >= 400 ? 'warn' : 'info';

this.logger[level]('Outgoing response', {
  method: req.method,
  path: req.url,
  statusCode,
  durationMs: Date.now() - startTime,
  requestId: req.requestId,
});
```

### Étape 11 — Adapter le `GlobalExceptionFilter`

Utiliser `AppLogger` pour loguer les erreurs :

```
// Erreur 5xx (serveur) → log error avec stack trace
this.logger.error('Unhandled exception', {
  statusCode: 500,
  message: exception.message,
  stack: exception.stack,
  requestId: req.requestId,
  path: req.url,
});

// Erreur 4xx (client) → log warn sans stack trace
this.logger.warn('Client error', {
  statusCode,
  message,
  requestId: req.requestId,
  path: req.url,
});
```

### Étape 12 — Logs applicatifs dans les modules

Injecter `AppLogger` dans les services/handlers qui ont besoin de loguer :

**Auth** :

```typescript
// Dans le SignupHandler
this.logger.info('New user registered', { email: command.email });
// JAMAIS : this.logger.info('Signup', { password: command.password }); ← INTERDIT

// Dans le LoginHandler
this.logger.info('User logged in', { userId });
// JAMAIS : this.logger.info('Login', { token: accessToken }); ← INTERDIT
```

**Posts** :

```typescript
this.logger.info('Post created', { postId, ownerId });
this.logger.info('Post deleted', { postId, deletedBy });
```

**Règle absolue : NE JAMAIS loguer** :

- Mots de passe (en clair ou hashés)
- Tokens (access, refresh)
- Secrets JWT
- Données sensibles (numéros de carte, etc.)

### Étape 13 — `.gitignore`

Ajouter :

```
logs/
```

Le dossier `logs/` ne doit JAMAIS être commité. Il est créé automatiquement au démarrage.

### Étape 14 — Vérifier que ça fonctionne

1. `pnpm dev` → les logs NestJS passent par Winston (format coloré en console)
2. Faire quelques requêtes → les logs HTTP apparaissent
3. Provoquer une erreur → le log error s'affiche
4. En production (ou en simulant `LOG_FILE=true`) → les fichiers `logs/*.log` sont créés

---

## Où mettre quoi dans /arch

| Fichier                          | Couche         | Emplacement                                         |
| -------------------------------- | -------------- | --------------------------------------------------- |
| `logger.config.ts`               | Infrastructure | `common/infra/logger/`                              |
| `winston.instance.ts`            | Infrastructure | `common/infra/logger/`                              |
| `logger.service.ts`              | Infrastructure | `common/infra/logger/`                              |
| `logger.module.ts`               | Infrastructure | `common/infra/logger/`                              |
| `HttpLoggingInterceptor`         | Interface      | `common/interface/http/interceptors/`               |
| `GlobalExceptionFilter`          | Interface      | `common/interface/http/filters/`                    |
| `RequestIdMiddleware`            | Interface      | `common/interface/http/middleware/`                 |
| Logs applicatifs (dans handlers) | Application    | `modules/<mod>/application/commands/` ou `queries/` |

**Le logger est Infrastructure** (il dépend de Winston, une lib externe). Mais il est injecté partout via DI.

**Les logs applicatifs dans les handlers sont OK** : un handler (Application) peut loguer via un port (le logger est injecté). Ce n'est pas une violation hexagonale — c'est un cross-cutting concern accepté.

---

## Config (.env)

Ajouter à `.env` et `.env.example` :

```env
# --- Logging (Winston) ---
LOG_LEVEL=http
LOG_DIR=logs
LOG_CONSOLE=true
LOG_FILE=false
LOG_JSON_FILES=true
LOG_ROTATE=false
LOG_MAX_FILES=14d
```

**Recommandations par environnement** :

| Variable         | Development | Production |
| ---------------- | ----------- | ---------- |
| `LOG_LEVEL`      | `debug`     | `http`     |
| `LOG_CONSOLE`    | `true`      | `true`     |
| `LOG_FILE`       | `false`     | `true`     |
| `LOG_JSON_FILES` | `false`     | `true`     |
| `LOG_ROTATE`     | `false`     | `true`     |

---

## Pièges à éviter

| Piège                                       | Pourquoi                                                                       | Solution                                                           |
| ------------------------------------------- | ------------------------------------------------------------------------------ | ------------------------------------------------------------------ |
| Garder `console.log` à côté de Winston      | Logs non structurés, pas dans les fichiers                                     | Remplacer TOUS les `console.log` par le logger Winston             |
| Loguer les mots de passe ou tokens          | Fuite de données sensibles dans les fichiers de log                            | Règle stricte : jamais de secrets dans les logs                    |
| Pas de requestId dans les logs              | Impossible de corréler les logs d'une même requête                             | Toujours inclure le `requestId` dans les métadonnées               |
| Fichiers de log dans Git                    | Le repo grossit inutilement, données sensibles potentielles                    | `logs/` dans `.gitignore`                                          |
| Pas de rotation en production               | Les fichiers grossissent indéfiniment → disque plein                           | Activer `LOG_ROTATE=true` avec une rétention (14 jours)            |
| Logger trop verbeux en production           | Performances dégradées, disque plein                                           | `LOG_LEVEL=info` ou `http` en production, `debug` en dev           |
| Winston non branché dans NestJS             | Les logs NestJS natifs (DI errors, Passport errors) ne passent pas par Winston | `WinstonModule.createLogger()` dans `NestFactory.create()`         |
| Créer un "logger maison" au lieu de Winston | Réinvention de la roue, bugs, pas de rotation                                  | Utiliser Winston qui est le standard Node.js                       |
| Mettre le logger dans Domain                | Domain ne doit pas dépendre de lib externes                                    | Le logger est Infrastructure, injecté via DI dans Application      |
| Log level codé en dur                       | Pas de flexibilité entre environnements                                        | Lire `LOG_LEVEL` depuis `.env` via `ConfigService`                 |
| Stack trace dans la réponse HTTP            | Information technique exposée au client                                        | Stack trace dans le log uniquement, pas dans le body de la réponse |

---

## Checklist DONE

### Installation et configuration

- [ ] `winston` et `nest-winston` installés
- [ ] `winston-daily-rotate-file` installé (optionnel)
- [ ] Variables `LOG_*` dans `.env.example`
- [ ] `logs/` dans `.gitignore`

### Fichiers créés

- [ ] `logger.config.ts` lit les variables d'env
- [ ] `winston.instance.ts` crée l'instance Winston avec les transports
- [ ] `logger.service.ts` fournit `AppLogger` injectable
- [ ] `logger.module.ts` est `@Global()`

### Branchement

- [ ] `LoggerModule` importé dans `app.module.ts`
- [ ] Winston remplace le logger NestJS natif dans `main.ts`
- [ ] `HttpLoggingInterceptor` utilise Winston (pas `console.log`)
- [ ] `GlobalExceptionFilter` utilise Winston
- [ ] `RequestIdMiddleware` attache le requestId lisible par le logger

### Console

- [ ] `pnpm dev` → logs colorés en console
- [ ] Les logs incluent : timestamp, niveau, contexte, message, requestId
- [ ] Les requêtes HTTP sont loguées (incoming + outgoing)
- [ ] Les erreurs sont loguées avec stack trace

### Fichiers de logs

- [ ] `LOG_FILE=true` → crée `logs/error.log`, `logs/warn.log`, `logs/combined.log`, `logs/http.log`
- [ ] Le dossier `logs/` est créé automatiquement
- [ ] Les logs error contiennent uniquement les erreurs
- [ ] Les logs HTTP sont séparés des logs applicatifs
- [ ] Le format est JSON en production (`LOG_JSON_FILES=true`)

### Rotation (optionnel)

- [ ] `LOG_ROTATE=true` crée des fichiers avec date (`error-2024-01-15.log`)
- [ ] Les fichiers de plus de `LOG_MAX_FILES` sont supprimés automatiquement

### Logs applicatifs

- [ ] `AppLogger` injecté dans au moins un handler (auth, posts)
- [ ] Les logs applicatifs incluent le contexte (`[AuthService]`, `[PostsService]`)
- [ ] AUCUN mot de passe, token ou secret dans les logs

### Nettoyage

- [ ] Plus aucun `console.log` dans le code
- [ ] Pas de fichier de log commité dans Git
- [ ] `pnpm build` compile sans erreur

---

## Tests manuels (curl)

### Vérifier les logs console

```bash
pnpm dev
# Les logs NestJS de bootstrap doivent passer par Winston :
# [2024-01-15 10:30:00] [INFO] [NestFactory] Starting Nest application...
# [2024-01-15 10:30:01] [INFO] [RoutesResolver] AppController {/}: ...
```

### Vérifier les logs HTTP

```bash
curl -s http://localhost:3000/health
# Dans la console, tu dois voir :
# [HTTP] Incoming request  { method: 'GET', path: '/health', requestId: '...', ip: '::1' }
# [INFO] Outgoing response { method: 'GET', path: '/health', statusCode: 200, durationMs: 3 }
```

### Vérifier les logs d'erreur

```bash
curl -s -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"nope@nope.com","password":"wrong"}'
# Dans la console :
# [WARN] Client error { statusCode: 401, message: '...', path: '/auth/login', requestId: '...' }
```

### Vérifier les logs applicatifs

```bash
# Signup un nouveau user
curl -s -X POST http://localhost:3000/auth/signup \
  -H "Content-Type: application/json" \
  -d '{"email":"logtest@test.com","password":"Test123!","displayName":"Log Test"}'
# Dans la console :
# [INFO] [AuthService] New user registered { email: 'logtest@test.com' }
# PAS de password ni de token dans le log !
```

### Vérifier les fichiers de logs

```bash
# Activer les fichiers temporairement
LOG_FILE=true pnpm dev

# Après quelques requêtes :
ls -la logs/
# error.log  warn.log  combined.log  http.log

# Vérifier le contenu
cat logs/error.log    # Uniquement les erreurs 5xx
cat logs/http.log     # Toutes les requêtes HTTP
cat logs/combined.log # Tout
```

### Vérifier que les secrets ne sont PAS loggés

```bash
# Login
curl -s -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"MyP@ss123"}'

# Vérifier dans les logs
grep -i "password" logs/combined.log  # Doit retourner RIEN
grep -i "token" logs/combined.log     # Doit retourner RIEN (sauf des requestIds)
grep -i "secret" logs/combined.log    # Doit retourner RIEN
```

### Vérifier le requestId dans les logs

```bash
# Envoyer une requête avec un requestId custom
curl -s http://localhost:3000/health -H "x-request-id: my-custom-id-123"

# Dans les logs, tous les logs de cette requête doivent contenir :
# requestId: 'my-custom-id-123'
```
