// Commande CQRS : rafraichissement des tokens (rotation du refresh token)
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { IdGenerator } from '@shared/utils/id-generator.util';
import {
  InvalidTokenError,
  SessionNotFoundError,
  UserDisabledError,
} from '../../domain/errors';
import { PasswordHasherPort } from '../ports/password-hasher.port';
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
    private readonly passwordHasher: PasswordHasherPort,
    private readonly tokenPort: TokenPort,
    private readonly userAuthReadPort: UserAuthReadPort,
  ) {}

  async execute(command: RefreshTokenCommand): Promise<RefreshTokenResult> {
    const { refreshToken } = command;

    // Hache le refresh token pour chercher la session correspondante
    const refreshTokenHash = await this.passwordHasher.hash(refreshToken);
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
    const newRefreshToken = IdGenerator.generate();
    const newRefreshTokenHash = await this.passwordHasher.hash(newRefreshToken);

    // Nouvelle session valide 7 jours
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    await this.sessionRepository.create({
      userId: user.id,
      refreshTokenHash: newRefreshTokenHash,
      expiresAt,
    });

    const accessToken = this.tokenPort.generateAccessToken({
      userId: user.id,
      email: user.email,
    });

    const expiresIn = 15 * 60; // 15 minutes en secondes

    return {
      accessToken,
      refreshToken: newRefreshToken,
      expiresIn,
    };
  }
}
