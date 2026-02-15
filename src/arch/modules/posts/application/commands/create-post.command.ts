// Commande CQRS : création d'un nouveau post par un utilisateur authentifié
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { IdGenerator } from '@shared/utils/id-generator.util';
import { PostPolicyService } from '../../domain/services/post-policy.service';
import { PostRepositoryPort } from '../ports/post-repository.port';

export class CreatePostCommand {
  constructor(
    public readonly userId: string,
    public readonly title: string,
    public readonly content: string,
    public readonly visibility: string = 'public',
  ) {}
}

export interface CreatePostResult {
  id: string;
  ownerId: string;
  title: string;
  content: string;
  visibility: string;
  createdAt: Date;
  updatedAt: Date;
}

@CommandHandler(CreatePostCommand)
export class CreatePostCommandHandler implements ICommandHandler<
  CreatePostCommand,
  CreatePostResult
> {
  // Service domaine instancié directement (logique pure, pas de DI nécessaire)
  private readonly policy = new PostPolicyService();

  constructor(private readonly postRepository: PostRepositoryPort) {}

  async execute(command: CreatePostCommand): Promise<CreatePostResult> {
    const { userId, title, content, visibility } = command;

    // Validation métier (titre, contenu)
    this.policy.validatePostData(title, content);

    const id = IdGenerator.generate();
    const now = new Date();

    await this.postRepository.create({
      id,
      ownerId: userId,
      title: title.trim(),
      content: content.trim(),
      visibility,
    });

    return {
      id,
      ownerId: userId,
      title: title.trim(),
      content: content.trim(),
      visibility,
      createdAt: now,
      updatedAt: now,
    };
  }
}
