import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { IdGenerator } from '@shared/utils/id-generator.util';
import { InvalidCredentialsError, UserDisabledError } from '../../domain/errors';
import { PasswordHasherPort } from '../ports/password-hasher.port';
import { SessionRepositoryPort } from '../ports/session-repository.port';
import { TokenPort } from '../ports/token.port';
import { UserAuthReadPort } from '../ports/user-auth-read.port';

export class LoginCommand {
  constructor(
    public readonly email: string,
    public readonly password: string,
    public readonly userAgent?: string,
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

    const user = await this.userAuthReadPort.findByEmail(email);
    if (!user) {
      throw new InvalidCredentialsError();
    }

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

    // Generate refresh token (UUID) and hash it
    const refreshToken = this.tokenPort.generateRefreshToken({
      userId: user.id,
      email: user.email,
    });
    const refreshTokenHash = await this.passwordHasher.hash(refreshToken);

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 days

    await this.sessionRepository.create({
      userId: user.id,
      refreshTokenHash,
      expiresAt,
      userAgent,
      ip,
    });

    const accessToken = this.tokenPort.generateAccessToken({
      userId: user.id,
      email: user.email,
    });

    const expiresIn = 15 * 60; // 15 minutes in seconds

    return {
      accessToken,
      refreshToken,
      expiresIn,
    };
  }
}
