// Commande CQRS : mise à jour d'un post (owner uniquement)
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { PostNotFoundError } from '../../domain/errors/post-errors';
import { PostPolicyService } from '../../domain/services/post-policy.service';
import { PostVisibility } from '../../domain/value-objects/post-visibility.vo';
import { PostRepositoryPort } from '../ports/post-repository.port';

export class UpdatePostCommand {
  constructor(
    public readonly userId: string,
    public readonly postId: string,
    public readonly title?: string,
    public readonly content?: string,
    public readonly visibility?: string,
  ) {}
}

export interface UpdatePostResult {
  id: string;
  ownerId: string;
  title: string;
  content: string;
  visibility: string;
  createdAt: Date;
  updatedAt: Date;
}

@CommandHandler(UpdatePostCommand)
export class UpdatePostCommandHandler implements ICommandHandler<
  UpdatePostCommand,
  UpdatePostResult
> {
  private readonly policy = new PostPolicyService();

  constructor(private readonly postRepository: PostRepositoryPort) {}

  async execute(command: UpdatePostCommand): Promise<UpdatePostResult> {
    const { userId, postId, title, content, visibility } = command;

    const post = await this.postRepository.findById(postId);
    if (!post) {
      throw new PostNotFoundError(postId);
    }

    // Vérifie que l'utilisateur est bien le propriétaire
    this.policy.assertCanModify(post, userId);

    // Validation des nouvelles données si fournies
    if (title || content) {
      this.policy.validatePostData(
        title || post.getTitle(),
        content || post.getContent(),
      );
    }

    // Applique les mutations sur l'agrégat
    const newVisibility = visibility
      ? PostVisibility.create(visibility)
      : undefined;

    post.update(
      title || post.getTitle(),
      content || post.getContent(),
      newVisibility,
    );

    await this.postRepository.update(post);

    return {
      id: post.getId(),
      ownerId: post.getOwnerId(),
      title: post.getTitle(),
      content: post.getContent(),
      visibility: post.getVisibility().getValue(),
      createdAt: post.getCreatedAt(),
      updatedAt: post.getUpdatedAt(),
    };
  }
}
