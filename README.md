# NestJS Hexagonal Architecture with CQRS Example

A complete example of a NestJS application implementing **Hexagonal Architecture** (Ports & Adapters), **CQRS** (Command Query Responsibility Segregation), **Domain-Driven Design**, and **PostgreSQL** with **Drizzle ORM**.

## Architecture Overview

This project demonstrates clean architecture principles with clear separation of concerns:

### Layers

1. **Domain Layer**: Pure business logic, domain models, value objects, and domain services
2. **Application Layer**: Use cases (Commands & Queries), ports (interfaces), and application events
3. **Infrastructure Layer**: Adapters for external dependencies (database, file storage, JWT, bcrypt)
4. **Interface Layer**: HTTP controllers, DTOs, guards, and decorators

### Modules

- **Auth Module**: Authentication and authorization (signup, login, JWT, refresh tokens, sessions)
- **User Module**: User profile management (CRUD operations, avatar upload)

## Features

### Authentication

- User signup with email/password
- Login with JWT access tokens
- Refresh token mechanism with session management
- Logout (revoke sessions)
- Change password (revokes all sessions)
- Passport strategies (Local, JWT, Refresh)

### User Management

- Get user profile
- Update profile (display name, bio)
- Upload/delete avatar (local file storage)
- Public profile view
- Read/Write separation (CQRS)

### Technical Features

- Strict hexagonal architecture
- CQRS pattern with separate read/write models
- Domain-driven design with rich domain models
- Value objects (Email, UserStatus)
- Database views for read models
- Session-based refresh token management
- File upload with validation (2MB limit, JPEG/PNG/WebP only)
- Global exception handling
- Request logging interceptor
- Validation pipes

## Tech Stack

- **NestJS** 10.x
- **TypeScript** 5.x
- **PostgreSQL** (database)
- **Drizzle ORM** (type-safe ORM)
- **Passport** (authentication)
- **JWT** (JSON Web Tokens)
- **bcrypt** (password hashing)
- **Multer** (file uploads)
- **class-validator** (DTO validation)

## Setup Instructions

### Prerequisites

- Node.js 18+ and pnpm
- PostgreSQL 14+

### 1. Install Dependencies

```bash
pnpm install
```

### 2. Create Database

Manually create the database in PostgreSQL:

```bash
# Connect to PostgreSQL
psql -U postgres

# Create database
CREATE DATABASE hexagon_cqrs_db;

# Exit
\q
```

### 3. Configure Environment

Copy the example environment file and update with your settings:

```bash
cp .env.example .env
```

Edit `.env`:

```env
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/hexagon_cqrs_db
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
JWT_EXPIRES_IN=15m
PORT=3000
NODE_ENV=development
```

### 4. Run Migrations

Generate and push database schema:

```bash
# Generate migration files
pnpm run migrate:generate

# Push schema to database (creates tables and views)
pnpm run migrate:push

# Or run migrations programmatically
pnpm run migrate
```

### 5. Seed Database (Optional)

```bash
pnpm run seed
```

### 6. Start Development Server

```bash
pnpm run dev
```

The server will start at `http://localhost:3000`

## API Endpoints

### Authentication

#### Signup

```http
POST /auth/signup
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "Password123",
  "displayName": "John Doe"
}
```

#### Login

```http
POST /auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "Password123"
}
```

Response:

```json
{
  "accessToken": "eyJhbGc...",
  "refreshToken": "uuid-v4",
  "expiresIn": 900,
  "tokenType": "Bearer"
}
```

#### Refresh Token

```http
POST /auth/refresh
Content-Type: application/json

{
  "refreshToken": "uuid-v4-from-login"
}
```

#### Logout

```http
POST /auth/logout
Authorization: Bearer <access_token>
```

#### Change Password

```http
POST /auth/change-password
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "currentPassword": "Password123",
  "newPassword": "NewPassword456"
}
```

### User Profile

#### Get My Profile

```http
GET /users/me
Authorization: Bearer <access_token>
```

#### Get Public Profile

```http
GET /users/:userId
```

#### Update Profile

```http
PUT /users/me
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "displayName": "Jane Doe",
  "bio": "Software engineer and coffee enthusiast"
}
```

#### Upload Avatar

```http
POST /users/me/avatar
Authorization: Bearer <access_token>
Content-Type: multipart/form-data

avatar: <file> (max 2MB, JPEG/PNG/WebP only)
```

#### Delete Avatar

```http
DELETE /users/me/avatar
Authorization: Bearer <access_token>
```

## cURL Examples

### 1. Signup

```bash
curl -X POST http://localhost:3000/auth/signup \
  -H "Content-Type: application/json" \
  -d '{
    "email": "alice@example.com",
    "password": "SecurePass123",
    "displayName": "Alice Smith"
  }'
```

### 2. Login

```bash
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "alice@example.com",
    "password": "SecurePass123"
  }'
```

Save the `accessToken` from the response for subsequent requests.

### 3. Get My Profile

```bash
curl -X GET http://localhost:3000/users/me \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

### 4. Update Profile

```bash
curl -X PUT http://localhost:3000/users/me \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "displayName": "Alice Johnson",
    "bio": "Full-stack developer | TypeScript enthusiast"
  }'
```

### 5. Upload Avatar

```bash
curl -X POST http://localhost:3000/users/me/avatar \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -F "avatar=@/path/to/your/image.jpg"
```

### 6. Get Public Profile

```bash
# Use the user ID from signup/profile response
curl -X GET http://localhost:3000/users/USER_ID_HERE
```

### 7. Refresh Token

```bash
curl -X POST http://localhost:3000/auth/refresh \
  -H "Content-Type: application/json" \
  -d '{
    "refreshToken": "YOUR_REFRESH_TOKEN"
  }'
```

### 8. Change Password

```bash
curl -X POST http://localhost:3000/auth/change-password \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "currentPassword": "SecurePass123",
    "newPassword": "NewSecurePass456"
  }'
```

### 9. Logout

```bash
curl -X POST http://localhost:3000/auth/logout \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

### 10. Delete Avatar

```bash
curl -X DELETE http://localhost:3000/users/me/avatar \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

## Project Structure

```
src/
├── arch/
│   ├── common/
│   │   ├── db/                    # Database configuration and schema
│   │   │   ├── schema.ts          # Drizzle schema (tables and views)
│   │   │   ├── drizzle.module.ts
│   │   │   ├── drizzle.service.ts
│   │   │   ├── migrations/
│   │   │   └── seeds/
│   │   └── interface/http/        # Global HTTP concerns
│   │       ├── filter/            # Exception filters
│   │       ├── interceptor/       # Interceptors
│   │       └── middleware/        # Middleware
│   ├── modules/
│   │   ├── auth/
│   │   │   ├── domain/
│   │   │   │   ├── models/        # Domain models (Session)
│   │   │   │   ├── services/      # Domain services
│   │   │   │   ├── events/        # Domain events
│   │   │   │   └── errors/        # Domain errors
│   │   │   ├── application/
│   │   │   │   ├── commands/      # Command handlers
│   │   │   │   ├── queries/       # Query handlers
│   │   │   │   ├── ports/         # Port interfaces
│   │   │   │   └── events/        # Application events
│   │   │   ├── infrastructure/
│   │   │   │   ├── adapters/      # Port implementations
│   │   │   │   └── strategies/    # Passport strategies
│   │   │   ├── interface/http/
│   │   │   │   ├── controllers/   # HTTP controllers
│   │   │   │   ├── dtos/          # DTOs
│   │   │   │   ├── guards/        # Auth guards
│   │   │   │   └── decorators/    # Custom decorators
│   │   │   └── auth.module.ts
│   │   └── user/
│   │       ├── domain/
│   │       │   ├── models/        # User domain model
│   │       │   ├── value-objects/ # Email, UserStatus VOs
│   │       │   ├── services/      # Domain services
│   │       │   ├── events/        # Domain events
│   │       │   └── errors/        # Domain errors
│   │       ├── application/
│   │       │   ├── commands/      # Command handlers
│   │       │   ├── queries/       # Query handlers
│   │       │   ├── ports/         # Port interfaces
│   │       │   └── events/        # Application events
│   │       ├── infrastructure/
│   │       │   └── adapters/      # Port implementations
│   │       ├── interface/http/
│   │       │   ├── controllers/   # HTTP controllers
│   │       │   ├── dtos/          # DTOs
│   │       │   └── config/        # Multer config
│   │       └── user.module.ts
│   └── shared/
│       ├── types/                 # Shared types
│       └── utils/                 # Shared utilities
├── app.module.ts
└── main.ts
uploads/                           # Local file storage
└── avatars/                       # User avatars
```

## Database Schema

### Tables

**users**

- id (UUID, PK)
- email (VARCHAR, UNIQUE)
- password_hash (VARCHAR)
- display_name (VARCHAR)
- bio (TEXT)
- avatar_key (VARCHAR)
- avatar_url (VARCHAR)
- status (VARCHAR) - 'active' | 'inactive' | 'banned'
- created_at (TIMESTAMP)
- updated_at (TIMESTAMP)

**sessions**

- id (UUID, PK)
- user_id (UUID, FK -> users.id)
- refresh_token_hash (VARCHAR)
- revoked_at (TIMESTAMP, nullable)
- expires_at (TIMESTAMP)
- created_at (TIMESTAMP)
- user_agent (VARCHAR)
- ip (VARCHAR)

### Views

**user_me_view** - Private profile view (includes email, status)

**user_public_view** - Public profile view (excludes email, only active users)

## Testing

```bash
# Unit tests
pnpm run test

# E2E tests
pnpm run test:e2e

# Test coverage
pnpm run test:cov
```

## Available Scripts

```bash
pnpm run build          # Build for production
pnpm run dev            # Start in watch mode
pnpm run start          # Start production build
pnpm run lint           # Lint and fix files
pnpm run format         # Format code with Prettier
pnpm run migrate        # Run database migrations
pnpm run seed           # Seed database with sample data
pnpm run db:studio      # Open Drizzle Studio (DB GUI)
```

## Design Patterns Used

1. **Hexagonal Architecture** - Clean separation between domain, application, infrastructure, and interface layers
2. **CQRS** - Separate read and write models with dedicated query/command handlers
3. **Repository Pattern** - Abstract data access through ports
4. **Domain-Driven Design** - Rich domain models with business logic
5. **Value Objects** - Immutable objects representing domain concepts (Email, UserStatus)
6. **Dependency Injection** - NestJS built-in DI container
7. **Strategy Pattern** - Passport authentication strategies
8. **Adapter Pattern** - Infrastructure adapters implementing port interfaces

## Security Features

- Password hashing with bcrypt (10 salt rounds)
- JWT-based authentication
- Refresh token rotation
- Session management with revocation
- Password strength validation
- File upload validation (type, size)
- Input validation with class-validator
- SQL injection protection (Drizzle ORM)
- CORS enabled

## License

MIT
