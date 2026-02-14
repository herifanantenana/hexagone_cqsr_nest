// Command CQRS : met a jour le profil utilisateur (nom d'affichage et bio)

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
  // Service domaine instancie directement (pas de dependance infra)
  private readonly userDomainService = new UserDomainService();

  constructor(
    private readonly userWriteRepository: UserWriteRepositoryPort,
    private readonly eventBus: EventBus,
  ) {}

  async execute(command: UpdateProfileCommand): Promise<UpdateProfileResult> {
    const { userId, displayName, bio } = command;

    // Validation metier avant toute mutation
    this.userDomainService.validateDisplayName(displayName);
    if (bio) {
      this.userDomainService.validateBio(bio);
    }

    const user = await this.userWriteRepository.findById(userId);
    if (!user) {
      throw new UserNotFoundError(userId);
    }

    // Mutation de l'agregat puis persistance
    user.updateProfile(displayName, bio);
    await this.userWriteRepository.update(user);

    // Publication d'un evenement applicatif apres succes
    this.eventBus.publish(
      new UserProfileUpdatedEvent(userId, displayName, bio),
    );

    return { userId, displayName, bio };
  }
}
