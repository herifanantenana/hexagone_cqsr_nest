// Commande CQRS : suppression d'un post (owner uniquement)
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { PostNotFoundError } from '../../domain/errors/post-errors';
import { PostPolicyService } from '../../domain/services/post-policy.service';
import { PostRepositoryPort } from '../ports/post-repository.port';

export class DeletePostCommand {
  constructor(
    public readonly userId: string,
    public readonly postId: string,
  ) {}
}

@CommandHandler(DeletePostCommand)
export class DeletePostCommandHandler implements ICommandHandler<
  DeletePostCommand,
  void
> {
  private readonly policy = new PostPolicyService();

  constructor(private readonly postRepository: PostRepositoryPort) {}

  async execute(command: DeletePostCommand): Promise<void> {
    const { userId, postId } = command;

    const post = await this.postRepository.findById(postId);
    if (!post) {
      throw new PostNotFoundError(postId);
    }

    // Vérifie que l'utilisateur est le propriétaire avant suppression
    this.policy.assertCanModify(post, userId);

    await this.postRepository.delete(postId);
  }
}
