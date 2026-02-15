// Commande CQRS : connexion d'un utilisateur (genere access + refresh tokens)
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { DEFAULT_PERMISSIONS } from '@shared/types/user-principal.type';
import {
  InvalidCredentialsError,
  UserDisabledError,
} from '../../domain/errors';
import { PasswordHasherPort } from '../ports/password-hasher.port';
import { SessionRepositoryPort } from '../ports/session-repository.port';
import { TokenPort } from '../ports/token.port';
import { UserAuthReadPort } from '../ports/user-auth-read.port';

export class LoginCommand {
  constructor(
    public readonly email: string,
    public readonly password: string,
    public readonly userAgent?: string, // Info navigateur pour tracer la session
    public readonly ip?: string,
  ) {}
}

export interface LoginResult {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

@CommandHandler(LoginCommand)
export class LoginCommandHandler implements ICommandHandler<
  LoginCommand,
  LoginResult
> {
  constructor(
    private readonly userAuthReadPort: UserAuthReadPort,
    private readonly passwordHasher: PasswordHasherPort,
    private readonly tokenPort: TokenPort,
    private readonly sessionRepository: SessionRepositoryPort,
  ) {}

  async execute(command: LoginCommand): Promise<LoginResult> {
    const { email, password, userAgent, ip } = command;

    // Recherche l'utilisateur par email
    const user = await this.userAuthReadPort.findByEmail(email);
    if (!user) {
      throw new InvalidCredentialsError();
    }

    // Verifie le mot de passe
    const isPasswordValid = await this.passwordHasher.compare(
      password,
      user.passwordHash,
    );
    if (!isPasswordValid) {
      throw new InvalidCredentialsError();
    }

    if (user.status !== 'active') {
      throw new UserDisabledError();
    }

    // Genere le refresh token et le stocke hashe en base (SHA-256 deterministe)
    const refreshToken = this.tokenPort.generateRefreshToken();
    const refreshTokenHash = this.tokenPort.hashRefreshToken(refreshToken);

    // Session valide N jours (depuis la config)
    const refreshTtlDays = this.tokenPort.getRefreshTtlDays();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + refreshTtlDays);

    await this.sessionRepository.create({
      userId: user.id,
      refreshTokenHash,
      expiresAt,
      userAgent,
      ip,
    });

    // Genere l'access token JWT avec les permissions embarquees
    const accessToken = this.tokenPort.generateAccessToken({
      userId: user.id,
      email: user.email,
      permissions: DEFAULT_PERMISSIONS,
    });

    const expiresIn = this.tokenPort.getAccessTtlSeconds();

    return {
      accessToken,
      refreshToken,
      expiresIn,
    };
  }
}
