import { DrizzleModule } from '@common/db/drizzle.module';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { CqrsModule } from '@nestjs/cqrs';
import { PassportModule } from '@nestjs/passport';
import { UserModule } from '../user/user.module';

// Controllers
import { AuthController } from './interface/http/controllers/auth.controller';

// Command Handlers
import { ChangePasswordCommandHandler } from './application/commands/change-password.command';
import { LoginCommandHandler } from './application/commands/login.command';
import { LogoutCommandHandler } from './application/commands/logout.command';
import { RefreshTokenCommandHandler } from './application/commands/refresh-token.command';
import { SignupCommandHandler } from './application/commands/signup.command';

// Query Handlers
import { GetUserPrincipalQueryHandler } from './application/queries/get-user-principal.query';
import { ValidateCredentialsQueryHandler } from './application/queries/validate-credentials.query';

// Adapters
import { BcryptPasswordHasherAdapter } from './infrastructure/adapters/bcrypt-password-hasher.adapter';
import { JwtTokenAdapter } from './infrastructure/adapters/jwt-token.adapter';
import { SessionRepositoryAdapter } from './infrastructure/adapters/session-repository.adapter';

// Strategies
import { JwtStrategy } from './infrastructure/strategies/jwt.strategy';
import { LocalStrategy } from './infrastructure/strategies/local.strategy';
import { RefreshStrategy } from './infrastructure/strategies/refresh.strategy';

// Ports
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

const queryHandlers = [
  ValidateCredentialsQueryHandler,
  GetUserPrincipalQueryHandler,
];

const adapters = [
  {
    provide: PasswordHasherPort,
    useClass: BcryptPasswordHasherAdapter,
  },
  {
    provide: TokenPort,
    useClass: JwtTokenAdapter,
  },
  {
    provide: SessionRepositoryPort,
    useClass: SessionRepositoryAdapter,
  },
];

const strategies = [LocalStrategy, JwtStrategy, RefreshStrategy];

@Module({
  imports: [
    CqrsModule,
    PassportModule,
    ConfigModule,
    DrizzleModule,
    UserModule, // Import UserModule to get UserAuthReadPort and UserWriteRepositoryPort
  ],
  controllers: [AuthController],
  providers: [...commandHandlers, ...queryHandlers, ...adapters, ...strategies],
  exports: [PasswordHasherPort, TokenPort, SessionRepositoryPort],
})
export class AuthModule {}
