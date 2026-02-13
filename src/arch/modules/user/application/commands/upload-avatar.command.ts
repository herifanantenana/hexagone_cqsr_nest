import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { UserNotFoundError } from '../../domain/errors/user-errors';
import { UserDomainService } from '../../domain/services/user-domain.service';
import { FileStoragePort } from '../ports/file-storage.port';
import { UserWriteRepositoryPort } from '../ports/user-write-repository.port';

export class UploadAvatarCommand {
  constructor(
    public readonly userId: string,
    public readonly file: Express.Multer.File,
  ) {}
}

export interface UploadAvatarResult {
  avatarUrl: string;
}

@CommandHandler(UploadAvatarCommand)
export class UploadAvatarCommandHandler implements ICommandHandler<
  UploadAvatarCommand,
  UploadAvatarResult
> {
  private readonly userDomainService = new UserDomainService();

  constructor(
    private readonly userWriteRepository: UserWriteRepositoryPort,
    private readonly fileStorage: FileStoragePort,
  ) {}

  async execute(command: UploadAvatarCommand): Promise<UploadAvatarResult> {
    const { userId, file } = command;

    this.userDomainService.validateAvatarFile(file.mimetype, file.size);

    const user = await this.userWriteRepository.findById(userId);
    if (!user) {
      throw new UserNotFoundError(userId);
    }

    // Delete old avatar if exists
    const oldAvatarKey = user.getAvatarKey();
    if (oldAvatarKey) {
      await this.fileStorage.delete(oldAvatarKey);
    }

    // Upload new avatar
    const { key, url } = await this.fileStorage.upload(
      file,
      `avatars/${userId}`,
    );

    user.setAvatar(key, url);
    await this.userWriteRepository.update(user);

    return { avatarUrl: url };
  }
}
