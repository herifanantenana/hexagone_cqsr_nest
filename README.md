# NestJS Hexagonal Architecture with CQRS Example

A complete example of a NestJS application implementing **Hexagonal Architecture** (Ports & Adapters), **CQRS** (Command Query Responsibility Segregation), **Domain-Driven Design**, and **PostgreSQL** with **Drizzle ORM**.

## Architecture Overview

This project demonstrates clean architecture principles with clear separation of concerns.

### Layers (inside-out)

1. **Domain Layer** (`domain/`) - Pure business logic, domain models, value objects, domain services, domain errors. **No NestJS or framework imports allowed.**
2. **Application Layer** (`application/`) - Use cases (Commands & Queries via `@nestjs/cqrs`), ports (abstract interfaces), application events. Orchestrates the domain.
3. **Infrastructure Layer** (`infrastructure/`) - Adapters implementing ports (Drizzle repositories, bcrypt hasher, JWT token service, file storage). Framework-dependent.
4. **Interface Layer** (`interface/http/`) - HTTP controllers, DTOs (class-validator + Swagger), guards, decorators. The entry point for the outside world.

### Modules

- **Auth Module** - Authentication and authorization (signup, login, JWT, refresh tokens, sessions)
- **User Module** - User profile management (CRUD operations, avatar upload)
- **Posts Module** - Post CRUD with visibility (public/private), ownership, pagination

### Cross-cutting (`common/`)

- **GlobalExceptionFilter** - Catches all exceptions, maps domain errors to HTTP status codes, includes `requestId` for correlation
- **LoggingInterceptor** - Logs every request with method, URL, status, duration, and requestId
- **RequestIdMiddleware** - Injects a UUID `x-request-id` header on every request (and returns it in the response)
- **RateLimitGuard** - Global rate limiting via `@nestjs/throttler` + Redis (global, auth, upload tiers)
- **PermissionsGuard** - Global guard checking `@Can(resource, action)` decorator against `UserPrincipal.permissions`
- **OptionalAuthGuard** - JWT auth that returns `null` instead of throwing (for public routes that behave differently when authenticated)

## Features

### Authentication

- User signup with email/password
- Login with JWT access tokens
- Refresh token mechanism with session management
- Logout (revoke sessions)
- Change password (revokes all sessions)
- Passport strategies (Local, JWT, Refresh)

### User Management

- Get user profile (private + public views)
- Update profile (display name, bio)
- Upload/delete avatar (local file storage)
- Read/Write separation (CQRS)

### Posts

- Create posts (public or private visibility)
- List public posts with pagination
- Get post by ID (public posts visible to all, private posts only to owner via OptionalAuthGuard)
- Update post (owner only)
- Delete post (owner only)
- Domain-level policy enforcement (`PostPolicyService`)

### Technical Features

- Strict hexagonal architecture (domain has zero framework dependencies)
- CQRS pattern with separate commands and queries
- Domain-driven design with rich domain models
- Value objects (Email, UserStatus, PostVisibility)
- Database views for optimized read models
- Permission-based access control via JWT principal (no DB roles)
- Rate limiting with Redis storage (3 tiers: global, auth, upload)
- OpenAPI/Swagger documentation at `/api/docs`
- Standardized error responses with `requestId` correlation
- Request logging with response time tracking

## Tech Stack

- **NestJS** 10.x
- **TypeScript** 5.x
- **PostgreSQL** (database)
- **Drizzle ORM** (type-safe ORM)
- **Redis** (rate limiting counters via `@nestjs/throttler` + `ioredis`)
- **Passport** (authentication)
- **JWT** (JSON Web Tokens)
- **bcrypt** (password hashing)
- **Multer** (file uploads)
- **class-validator** / **class-transformer** (DTO validation)
- **@nestjs/swagger** 7.x (OpenAPI documentation)

## Setup Instructions

### Prerequisites

- Node.js 18+ and pnpm
- PostgreSQL 14+
- Redis (local or hosted, e.g. Upstash)

### 1. Install Dependencies

```bash
pnpm install
```

### 2. Create Database

```bash
psql -U postgres
CREATE DATABASE hexagon_cqrs_db;
\q
```

### 3. Configure Environment

```bash
cp .env.example .env
```

Edit `.env` with your database URL, Redis URL, and JWT secrets.

### 4. Run Migrations

```bash
pnpm run migrate
```

### 5. Seed Database (Optional)

Creates 3 test users (password: `Password123!`) and 6 demo posts (public + private):

```bash
pnpm run seed
```

### 6. Start Development Server

```bash
pnpm run dev
```

The server starts at `http://localhost:3000`.
Swagger docs available at `http://localhost:3000/api/docs`.

## API Endpoints

| Method   | Path                    | Auth     | Description                   |
| -------- | ----------------------- | -------- | ----------------------------- |
| `GET`    | `/`                     | -        | Root (Hello World)            |
| `GET`    | `/health`               | -        | Health check                  |
| `POST`   | `/auth/signup`          | -        | Register a new user           |
| `POST`   | `/auth/login`           | -        | Login (returns JWT tokens)    |
| `POST`   | `/auth/refresh`         | -        | Refresh access token          |
| `POST`   | `/auth/logout`          | Bearer   | Logout (revoke session)       |
| `POST`   | `/auth/change-password` | Bearer   | Change password               |
| `GET`    | `/users/me`             | Bearer   | Get my profile                |
| `GET`    | `/users/:userId`        | -        | Get public profile            |
| `PUT`    | `/users/me`             | Bearer   | Update my profile             |
| `POST`   | `/users/me/avatar`      | Bearer   | Upload avatar                 |
| `DELETE` | `/users/me/avatar`      | Bearer   | Delete avatar                 |
| `POST`   | `/posts`                | Bearer   | Create a post                 |
| `GET`    | `/posts`                | -        | List public posts (paginated) |
| `GET`    | `/posts/:id`            | Optional | Get post by ID                |
| `PATCH`  | `/posts/:id`            | Bearer   | Update post (owner only)      |
| `DELETE` | `/posts/:id`            | Bearer   | Delete post (owner only)      |

## cURL Examples

### Auth: Signup

```bash
curl -s -X POST http://localhost:3000/auth/signup \
  -H "Content-Type: application/json" \
  -d '{
    "email": "alice@example.com",
    "password": "SecurePass123!",
    "displayName": "Alice Smith"
  }'
```

### Auth: Login

```bash
# Store the tokens for later use
LOGIN=$(curl -s -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "alice@example.com",
    "password": "SecurePass123!"
  }')

echo $LOGIN
TOKEN=$(echo $LOGIN | jq -r '.accessToken')
REFRESH=$(echo $LOGIN | jq -r '.refreshToken')
```

### Auth: Refresh Token

```bash
curl -s -X POST http://localhost:3000/auth/refresh \
  -H "Content-Type: application/json" \
  -d "{\"refreshToken\": \"$REFRESH\"}"
```

### Auth: Change Password

```bash
curl -s -X POST http://localhost:3000/auth/change-password \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "currentPassword": "SecurePass123!",
    "newPassword": "NewSecurePass456!"
  }'
```

### Auth: Logout

```bash
curl -s -X POST http://localhost:3000/auth/logout \
  -H "Authorization: Bearer $TOKEN"
```

### Users: Get My Profile

```bash
curl -s http://localhost:3000/users/me \
  -H "Authorization: Bearer $TOKEN"
```

### Users: Update Profile

```bash
curl -s -X PUT http://localhost:3000/users/me \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "displayName": "Alice Johnson",
    "bio": "Full-stack developer | TypeScript enthusiast"
  }'
```

### Users: Upload Avatar

```bash
curl -s -X POST http://localhost:3000/users/me/avatar \
  -H "Authorization: Bearer $TOKEN" \
  -F "avatar=@/path/to/image.jpg"
```

### Users: Get Public Profile

```bash
curl -s http://localhost:3000/users/USER_ID_HERE
```

### Posts: Create

```bash
curl -s -X POST http://localhost:3000/posts \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "My First Post",
    "content": "Hello world from hexagonal architecture!",
    "visibility": "public"
  }'
```

### Posts: Create Private Post

```bash
curl -s -X POST http://localhost:3000/posts \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "My Private Notes",
    "content": "This is only visible to me.",
    "visibility": "private"
  }'
```

### Posts: List Public Posts (Paginated)

```bash
# Default: page=1, pageSize=20
curl -s "http://localhost:3000/posts"

# With pagination
curl -s "http://localhost:3000/posts?page=1&pageSize=5"
```

### Posts: Get by ID (Public Post)

```bash
curl -s http://localhost:3000/posts/POST_ID_HERE
```

### Posts: Get by ID (Private Post as Owner)

```bash
# Private posts are only accessible with the owner's JWT
curl -s http://localhost:3000/posts/PRIVATE_POST_ID \
  -H "Authorization: Bearer $TOKEN"
```

### Posts: Update (Owner Only)

```bash
curl -s -X PATCH http://localhost:3000/posts/POST_ID_HERE \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Updated Title",
    "visibility": "private"
  }'
```

### Posts: Delete (Owner Only)

```bash
curl -s -X DELETE http://localhost:3000/posts/POST_ID_HERE \
  -H "Authorization: Bearer $TOKEN"
```

### Health Check

```bash
curl -s http://localhost:3000/health
```

## Project Structure

```
src/
├── main.ts                            # Bootstrap, Swagger setup, global pipes/filters/interceptors
├── app.module.ts                      # Root module (imports, global guards, middleware)
├── app.controller.ts                  # Root controller (/, /health)
├── app.service.ts
│
└── arch/
    ├── common/                        # Cross-cutting concerns (shared by all modules)
    │   ├── db/
    │   │   ├── schema.ts              # Drizzle schema (users, sessions, posts tables + views)
    │   │   ├── drizzle.module.ts      # DB module (provides DrizzleService)
    │   │   ├── drizzle.service.ts     # Drizzle DB connection
    │   │   ├── migrations/            # SQL migrations (0001_init, 0002_posts)
    │   │   └── seeds/                 # Seed scripts (seed.dev.ts)
    │   ├── infra/redis/               # Redis module (ioredis client provider)
    │   └── interface/http/
    │       ├── constants/             # Rate limit throttler names
    │       ├── decorators/            # @AuthThrottle, @UploadThrottle, @SkipAllThrottle, @Can
    │       ├── filter/                # GlobalExceptionFilter
    │       ├── guards/                # RateLimitGuard, PermissionsGuard, OptionalAuthGuard
    │       ├── interceptor/           # LoggingInterceptor
    │       └── middleware/            # RequestIdMiddleware
    │
    ├── modules/
    │   ├── auth/                      # Authentication module
    │   │   ├── domain/
    │   │   │   ├── models/            # Session model
    │   │   │   ├── services/          # AuthDomainService
    │   │   │   ├── events/            # Domain events
    │   │   │   └── errors/            # InvalidCredentials, InvalidToken, EmailAlreadyUsed, etc.
    │   │   ├── application/
    │   │   │   ├── commands/          # Signup, Login, Logout, RefreshToken, ChangePassword
    │   │   │   ├── queries/           # ValidateCredentials, GetUserPrincipal
    │   │   │   ├── ports/             # PasswordHasher, SessionRepository, Token, UserAuthRead
    │   │   │   └── events/            # UserSignedUp event
    │   │   ├── infrastructure/
    │   │   │   ├── adapters/          # BcryptPasswordHasher, JwtToken, SessionRepository
    │   │   │   └── strategies/        # Passport: Local, JWT, Refresh
    │   │   ├── interface/http/
    │   │   │   ├── controllers/       # AuthController (signup, login, refresh, logout, change-password)
    │   │   │   ├── dtos/              # SignupDto, LoginDto, ChangePasswordDto, AuthResponseDto
    │   │   │   ├── guards/            # JwtAuthGuard, LocalAuthGuard, RefreshAuthGuard
    │   │   │   └── decorators/        # @CurrentUser
    │   │   └── auth.module.ts
    │   │
    │   ├── user/                      # User profile module
    │   │   ├── domain/
    │   │   │   ├── models/            # User model
    │   │   │   ├── value-objects/     # Email VO, UserStatus VO
    │   │   │   ├── services/          # UserDomainService
    │   │   │   ├── events/            # Domain events
    │   │   │   └── errors/            # UserNotFound, UserDisabled, etc.
    │   │   ├── application/
    │   │   │   ├── commands/          # UpdateProfile, UploadAvatar, DeleteAvatar
    │   │   │   ├── queries/           # GetMyProfile, GetPublicProfile, FindUserByEmail
    │   │   │   ├── ports/             # UserRepository, UserWriteRepository, FileStorage
    │   │   │   └── events/            # UserProfileUpdated
    │   │   ├── infrastructure/
    │   │   │   └── adapters/          # UserRepository, UserWriteRepository, UserAuthRead, LocalFileStorage
    │   │   ├── interface/http/
    │   │   │   ├── controllers/       # UserController (me, profile, avatar)
    │   │   │   ├── dtos/              # ProfileResponseDto, PublicProfileResponseDto, UpdateProfileDto
    │   │   │   └── config/            # Multer config
    │   │   └── user.module.ts
    │   │
    │   └── posts/                     # Posts module
    │       ├── domain/
    │       │   ├── models/            # Post model (aggregate root)
    │       │   ├── value-objects/     # PostVisibility VO ('public' | 'private')
    │       │   ├── services/          # PostPolicyService (canView, assertCanModify, validatePostData)
    │       │   └── errors/            # PostNotFound, ForbiddenPostAccess, InvalidPostData
    │       ├── application/
    │       │   ├── commands/          # CreatePost, UpdatePost, DeletePost
    │       │   ├── queries/           # ListPublicPosts, GetPostById
    │       │   └── ports/             # PostRepositoryPort (abstract class)
    │       ├── infrastructure/
    │       │   └── adapters/          # PostRepositoryAdapter (Drizzle)
    │       ├── interface/http/
    │       │   ├── controllers/       # PostsController (CRUD with guards + @Can)
    │       │   └── dtos/              # CreatePostDto, UpdatePostDto, PostResponseDto, etc.
    │       └── posts.module.ts
    │
    └── shared/
        ├── types/                     # UserPrincipal, Permission, PaginatedResult<T>
        └── utils/                     # IdGenerator
```

## Database Schema

### Tables

**users** - id, email, password_hash, display_name, bio, avatar_key, avatar_url, status, created_at, updated_at

**sessions** - id, user_id (FK), refresh_token_hash, revoked_at, expires_at, created_at, user_agent, ip

**posts** - id, owner_id (FK), title, content, visibility (`public`|`private`), created_at, updated_at

### Views

- **user_me_view** - Full profile (includes email, status)
- **user_public_view** - Public profile (active users only, no email)
- **posts_public_view** - Public posts joined with owner display name

## How to Add a New Module

Follow this checklist to add a new module (e.g., `comments`):

### 1. Domain Layer

Create `src/arch/modules/comments/domain/`:

```
domain/
├── models/comment.model.ts        # Aggregate root (pure class, no decorators)
├── value-objects/                  # VOs if needed
├── services/comment-policy.service.ts  # Domain rules (pure, no framework deps)
└── errors/comment-errors.ts       # Domain-specific errors (extend Error)
```

**Rule:** Domain must have **zero imports from `@nestjs/*`** or any infrastructure library. Only plain TypeScript.

### 2. Application Layer

Create `src/arch/modules/comments/application/`:

```
application/
├── ports/comment-repository.port.ts   # Abstract class defining the contract
├── commands/
│   ├── create-comment.command.ts      # Command class + @CommandHandler
│   └── delete-comment.command.ts
└── queries/
    └── list-comments.query.ts         # Query class + @QueryHandler
```

**Ports** are abstract classes (not interfaces) so NestJS DI can resolve them:

```typescript
export abstract class CommentRepositoryPort {
  abstract findById(id: string): Promise<Comment | null>;
  abstract create(comment: Comment): Promise<void>;
}
```

**Handlers** inject ports (not adapters). NestJS wires the adapter at module level.

### 3. Infrastructure Layer

Create `src/arch/modules/comments/infrastructure/adapters/`:

```typescript
@Injectable()
export class CommentRepositoryAdapter extends CommentRepositoryPort {
  constructor(@Inject('DRIZZLE') private readonly db: DrizzleDB) {}
  // Implement all abstract methods using Drizzle queries
}
```

### 4. Interface Layer

Create `src/arch/modules/comments/interface/http/`:

```
interface/http/
├── controllers/comments.controller.ts  # @Controller('comments'), Swagger decorators
└── dtos/
    ├── create-comment.dto.ts           # class-validator + @ApiProperty
    └── comment-response.dto.ts
```

### 5. Module Wiring

Create `src/arch/modules/comments/comments.module.ts`:

```typescript
@Module({
  imports: [CqrsModule, DrizzleModule],
  controllers: [CommentsController],
  providers: [
    // CQRS handlers (auto-registered by CqrsModule)
    CreateCommentHandler,
    ListCommentsHandler,
    // Domain services (pure, no deps)
    CommentPolicyService,
    // Port → Adapter binding (hexagonal wiring)
    { provide: CommentRepositoryPort, useClass: CommentRepositoryAdapter },
  ],
})
export class CommentsModule {}
```

Then add `CommentsModule` to `AppModule.imports`.

### 6. Database

- Add the table to `src/arch/common/db/schema.ts`
- Create a migration in `src/arch/common/db/migrations/`
- Add domain error mappings to `GlobalExceptionFilter`

### 7. Swagger

- Add `@ApiTags('Comments')` to the controller
- Add `@ApiOperation`, `@ApiResponse`, `@ApiBody`, `@ApiParam` to each endpoint
- Add `@ApiProperty` to each DTO field
- Add the tag in `main.ts` DocumentBuilder: `.addTag('Comments', '...')`

### 8. Permissions

If the endpoint requires auth:

- Use `@UseGuards(JwtAuthGuard)` + `@ApiBearerAuth()`
- Add `@Can('comments', 'create')` for permission checking
- Add the permission to `GetUserPrincipalQuery` handler

## Rate Limiting

Three tiers configured via environment variables:

| Tier   | Default     | Applied to             | Decorator           |
| ------ | ----------- | ---------------------- | ------------------- |
| Global | 120 req/min | All routes             | (automatic)         |
| Auth   | 5 req/min   | Signup, login, refresh | `@AuthThrottle()`   |
| Upload | 10 req/min  | Avatar upload          | `@UploadThrottle()` |

Skip rate limiting entirely with `@SkipAllThrottle()`.

## Permissions System

Permissions are embedded in the JWT principal at login time (no database roles):

```typescript
// Every active user gets these permissions:
permissions: [
  { resource: 'posts', actions: ['create', 'read', 'update', 'delete'] },
  { resource: 'user', actions: ['read', 'update'] },
];
```

Use the `@Can(resource, action)` decorator on controller methods:

```typescript
@Can('posts', 'create')  // Requires posts:create permission
```

The `PermissionsGuard` (registered globally) reads this metadata and checks against `request.user.permissions`.

## Error Response Format

All errors follow the same structure:

```json
{
  "statusCode": 404,
  "error": "NotFound",
  "message": "Post not found",
  "requestId": "a1b2c3d4-...",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "path": "/posts/some-uuid"
}
```

Domain errors are automatically mapped to HTTP status codes by `GlobalExceptionFilter`.

## Available Scripts

```bash
pnpm run build          # Build for production
pnpm run dev            # Start in watch mode
pnpm run start          # Start without watch
pnpm run start:prod     # Start production build
pnpm run lint           # Lint and fix files
pnpm run format         # Format code with Prettier
pnpm run migrate        # Run database migrations
pnpm run seed           # Seed database with sample data
pnpm run db:studio      # Open Drizzle Studio (DB GUI)
pnpm run test           # Unit tests
pnpm run test:e2e       # E2E tests
pnpm run test:cov       # Test coverage
```

## Design Patterns

1. **Hexagonal Architecture** - Domain at the center, ports as contracts, adapters as implementations
2. **CQRS** - Separate command (write) and query (read) handlers
3. **Repository Pattern** - Abstract data access through ports
4. **Domain-Driven Design** - Rich domain models, value objects, domain services
5. **Policy Pattern** - Domain-level authorization (PostPolicyService)
6. **Strategy Pattern** - Passport authentication strategies
7. **Adapter Pattern** - Infrastructure adapters implementing port interfaces
8. **Decorator Pattern** - Custom NestJS decorators (@Can, @AuthThrottle, @CurrentUser)

## License

MIT
