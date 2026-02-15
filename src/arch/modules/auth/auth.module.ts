// Module NestJS auth : assemble handlers CQRS, adapters infra et stratégie Passport JWT
// Chaque port (classe abstraite) est mappé vers son adapter concret via provide/useClass
import { DrizzleModule } from '@common/db/drizzle.module';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { CqrsModule } from '@nestjs/cqrs';
import { PassportModule } from '@nestjs/passport';
import { UserModule } from '../user/user.module';

// Controller (interface HTTP)
import { AuthController } from './interface/http/controllers/auth.controller';

// Command Handlers (cas d'usage en écriture)
import { ChangePasswordCommandHandler } from './application/commands/change-password.command';
import { LoginCommandHandler } from './application/commands/login.command';
import { LogoutCommandHandler } from './application/commands/logout.command';
import { RefreshTokenCommandHandler } from './application/commands/refresh-token.command';
import { SignupCommandHandler } from './application/commands/signup.command';

// Adapters (implémentations concrètes des ports)
import { BcryptPasswordHasherAdapter } from './infrastructure/adapters/bcrypt-password-hasher.adapter';
import { JwtTokenAdapter } from './infrastructure/adapters/jwt-token.adapter';
import { SessionRepositoryAdapter } from './infrastructure/adapters/session-repository.adapter';

// Stratégie Passport JWT (seule stratégie utilisée — login se fait via CQRS command)
import { JwtStrategy } from './infrastructure/strategies/jwt.strategy';

// Ports (classes abstraites = contrats d'injection)
import { PasswordHasherPort } from './application/ports/password-hasher.port';
import { SessionRepositoryPort } from './application/ports/session-repository.port';
import { TokenPort } from './application/ports/token.port';

const commandHandlers = [
  SignupCommandHandler,
  LoginCommandHandler,
  RefreshTokenCommandHandler,
  LogoutCommandHandler,
  ChangePasswordCommandHandler,
];

// Binding port → adapter (inversion de dépendance)
const adapters = [
  { provide: PasswordHasherPort, useClass: BcryptPasswordHasherAdapter },
  { provide: TokenPort, useClass: JwtTokenAdapter },
  { provide: SessionRepositoryPort, useClass: SessionRepositoryAdapter },
];

@Module({
  imports: [
    CqrsModule,
    PassportModule,
    ConfigModule,
    DrizzleModule,
    UserModule, // Importe UserModule pour accéder à UserAuthReadPort et UserWriteRepositoryPort
  ],
  controllers: [AuthController],
  providers: [...commandHandlers, ...adapters, JwtStrategy],
  exports: [PasswordHasherPort, TokenPort, SessionRepositoryPort],
})
export class AuthModule {}
