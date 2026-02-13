import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { IdGenerator } from '@shared/utils/id-generator.util';
import { InvalidTokenError, SessionNotFoundError, UserDisabledError } from '../../domain/errors';
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
export class RefreshTokenCommandHandler
  implements ICommandHandler<RefreshTokenCommand, RefreshTokenResult>
{
  constructor(
    private readonly sessionRepository: SessionRepositoryPort,
    private readonly passwordHasher: PasswordHasherPort,
    private readonly tokenPort: TokenPort,
    private readonly userAuthReadPort: UserAuthReadPort,
  ) {}

  async execute(command: RefreshTokenCommand): Promise<RefreshTokenResult> {
    const { refreshToken } = command;

    // Hash the refresh token to find matching session
    const refreshTokenHash = await this.passwordHasher.hash(refreshToken);
    const session = await this.sessionRepository.findByRefreshTokenHash(refreshTokenHash);

    if (!session) {
      throw new SessionNotFoundError();
    }

    // Check if session is revoked
    if (session.revokedAt !== null) {
      throw new InvalidTokenError('Session has been revoked');
    }

    // Check if session is expired
    if (session.expiresAt < new Date()) {
      throw new InvalidTokenError('Session has expired');
    }

    // Get user info
    const user = await this.userAuthReadPort.findById(session.userId);

    if (!user) {
      throw new InvalidTokenError('User not found');
    }

    if (user.status !== 'active') {
      throw new UserDisabledError();
    }

    // Revoke old session
    await this.sessionRepository.revokeSession(session.id);

    // Generate new tokens and create new session
    const newRefreshToken = IdGenerator.generate();
    const newRefreshTokenHash = await this.passwordHasher.hash(newRefreshToken);

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

    const expiresIn = 15 * 60; // 15 minutes

    return {
      accessToken,
      refreshToken: newRefreshToken,
      expiresIn,
    };
  }
}
