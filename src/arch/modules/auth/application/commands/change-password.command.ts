import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { UserWriteRepositoryPort } from '../../../user/application/ports/user-write-repository.port';
import { UserNotFoundError } from '../../../user/domain/errors/user-errors';
import { InvalidCredentialsError } from '../../domain/errors';
import { AuthDomainService } from '../../domain/services';
import { PasswordHasherPort } from '../ports/password-hasher.port';
import { SessionRepositoryPort } from '../ports/session-repository.port';

export class ChangePasswordCommand {
  constructor(
    public readonly userId: string,
    public readonly currentPassword: string,
    public readonly newPassword: string,
  ) {}
}

@CommandHandler(ChangePasswordCommand)
export class ChangePasswordCommandHandler implements ICommandHandler<
  ChangePasswordCommand,
  void
> {
  private readonly authDomainService = new AuthDomainService();

  constructor(
    private readonly userWriteRepository: UserWriteRepositoryPort,
    private readonly passwordHasher: PasswordHasherPort,
    private readonly sessionRepository: SessionRepositoryPort,
  ) {}

  async execute(command: ChangePasswordCommand): Promise<void> {
    const { userId, currentPassword, newPassword } = command;

    this.authDomainService.validatePassword(newPassword);

    const user = await this.userWriteRepository.findById(userId);
    if (!user) {
      throw new UserNotFoundError(userId);
    }

    const isCurrentPasswordValid = await this.passwordHasher.compare(
      currentPassword,
      user.getPasswordHash(),
    );

    if (!isCurrentPasswordValid) {
      throw new InvalidCredentialsError();
    }

    const newPasswordHash = await this.passwordHasher.hash(newPassword);
    user.updatePassword(newPasswordHash);

    await this.userWriteRepository.update(user);

    // Revoke all sessions after password change
    await this.sessionRepository.revokeAllUserSessions(userId);
  }
}
