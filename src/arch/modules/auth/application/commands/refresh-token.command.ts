// Commande CQRS : rafraichissement des tokens (rotation du refresh token)
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { DEFAULT_PERMISSIONS } from '@shared/types/user-principal.type';
import {
  InvalidTokenError,
  SessionNotFoundError,
  UserDisabledError,
} from '../../domain/errors';
import { SessionRepositoryPort } from '../ports/session-repository.port';
import { TokenPort } from '../ports/token.port';
import { UserAuthReadPort } from '../ports/user-auth-read.port';

export class RefreshTokenCommand {
  constructor(public readonly refreshToken: string) {}
}

export interface RefreshTokenResult {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

@CommandHandler(RefreshTokenCommand)
export class RefreshTokenCommandHandler implements ICommandHandler<
  RefreshTokenCommand,
  RefreshTokenResult
> {
  constructor(
    private readonly sessionRepository: SessionRepositoryPort,
    private readonly tokenPort: TokenPort,
    private readonly userAuthReadPort: UserAuthReadPort,
  ) {}

  async execute(command: RefreshTokenCommand): Promise<RefreshTokenResult> {
    const { refreshToken } = command;

    // Hash deterministe SHA-256 pour retrouver la session en base
    const refreshTokenHash = this.tokenPort.hashRefreshToken(refreshToken);
    const session =
      await this.sessionRepository.findByRefreshTokenHash(refreshTokenHash);

    if (!session) {
      throw new SessionNotFoundError();
    }

    // Verifie que la session n'est pas revoquee
    if (session.revokedAt !== null) {
      throw new InvalidTokenError('Session has been revoked');
    }

    // Verifie que la session n'est pas expiree
    if (session.expiresAt < new Date()) {
      throw new InvalidTokenError('Session has expired');
    }

    // Recupere les infos utilisateur pour generer les nouveaux tokens
    const user = await this.userAuthReadPort.findById(session.userId);

    if (!user) {
      throw new InvalidTokenError('User not found');
    }

    if (user.status !== 'active') {
      throw new UserDisabledError();
    }

    // Revoque l'ancienne session (rotation de token)
    await this.sessionRepository.revokeSession(session.id);

    // Genere un nouveau refresh token et cree une nouvelle session
    const newRefreshToken = this.tokenPort.generateRefreshToken();
    const newRefreshTokenHash =
      this.tokenPort.hashRefreshToken(newRefreshToken);

    // Nouvelle session valide N jours (depuis la config)
    const refreshTtlDays = this.tokenPort.getRefreshTtlDays();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + refreshTtlDays);

    await this.sessionRepository.create({
      userId: user.id,
      refreshTokenHash: newRefreshTokenHash,
      expiresAt,
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
      refreshToken: newRefreshToken,
      expiresIn,
    };
  }
}
