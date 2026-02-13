import { CommandHandler, EventBus, ICommandHandler } from '@nestjs/cqrs';
import { UserNotFoundError } from '../../domain/errors/user-errors';
import { UserDomainService } from '../../domain/services/user-domain.service';
import { UserProfileUpdatedEvent } from '../events/user-profile-updated.event';
import { UserWriteRepositoryPort } from '../ports/user-write-repository.port';

export class UpdateProfileCommand {
  constructor(
    public readonly userId: string,
    public readonly displayName: string,
    public readonly bio?: string,
  ) {}
}

export interface UpdateProfileResult {
  userId: string;
  displayName: string;
  bio?: string;
}

@CommandHandler(UpdateProfileCommand)
export class UpdateProfileCommandHandler implements ICommandHandler<
  UpdateProfileCommand,
  UpdateProfileResult
> {
  private readonly userDomainService = new UserDomainService();

  constructor(
    private readonly userWriteRepository: UserWriteRepositoryPort,
    private readonly eventBus: EventBus,
  ) {}

  async execute(command: UpdateProfileCommand): Promise<UpdateProfileResult> {
    const { userId, displayName, bio } = command;

    this.userDomainService.validateDisplayName(displayName);
    if (bio) {
      this.userDomainService.validateBio(bio);
    }

    const user = await this.userWriteRepository.findById(userId);
    if (!user) {
      throw new UserNotFoundError(userId);
    }

    user.updateProfile(displayName, bio);
    await this.userWriteRepository.update(user);

    this.eventBus.publish(
      new UserProfileUpdatedEvent(userId, displayName, bio),
    );

    return { userId, displayName, bio };
  }
}
