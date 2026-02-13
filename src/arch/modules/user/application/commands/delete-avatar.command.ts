import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { UserNotFoundError } from '../../domain/errors/user-errors';
import { FileStoragePort } from '../ports/file-storage.port';
import { UserWriteRepositoryPort } from '../ports/user-write-repository.port';

export class DeleteAvatarCommand {
  constructor(public readonly userId: string) {}
}

@CommandHandler(DeleteAvatarCommand)
export class DeleteAvatarCommandHandler implements ICommandHandler<
  DeleteAvatarCommand,
  void
> {
  constructor(
    private readonly userWriteRepository: UserWriteRepositoryPort,
    private readonly fileStorage: FileStoragePort,
  ) {}

  async execute(command: DeleteAvatarCommand): Promise<void> {
    const { userId } = command;

    const user = await this.userWriteRepository.findById(userId);
    if (!user) {
      throw new UserNotFoundError(userId);
    }

    const avatarKey = user.getAvatarKey();
    if (!avatarKey) {
      return; // No avatar to delete
    }

    await this.fileStorage.delete(avatarKey);
    user.removeAvatar();
    await this.userWriteRepository.update(user);
  }
}
