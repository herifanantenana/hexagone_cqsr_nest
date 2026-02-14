// Query CQRS : récupère un post par son ID avec vérification de visibilité
// Si le post est privé, seul l'owner (identifié par requestingUserId) peut le voir
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import {
  ForbiddenPostAccessError,
  PostNotFoundError,
} from '../../domain/errors/post-errors';
import { PostPolicyService } from '../../domain/services/post-policy.service';
import { PostRepositoryPort } from '../ports/post-repository.port';

export class GetPostByIdQuery {
  constructor(
    public readonly postId: string,
    // undefined si l'utilisateur n'est pas authentifié (OptionalAuth)
    public readonly requestingUserId?: string,
  ) {}
}

export interface PostDetailResult {
  id: string;
  ownerId: string;
  title: string;
  content: string;
  visibility: string;
  createdAt: Date;
  updatedAt: Date;
}

@QueryHandler(GetPostByIdQuery)
export class GetPostByIdQueryHandler implements IQueryHandler<
  GetPostByIdQuery,
  PostDetailResult
> {
  private readonly policy = new PostPolicyService();

  constructor(private readonly postRepository: PostRepositoryPort) {}

  async execute(query: GetPostByIdQuery): Promise<PostDetailResult> {
    const { postId, requestingUserId } = query;

    const post = await this.postRepository.findById(postId);
    if (!post) {
      throw new PostNotFoundError(postId);
    }

    // Applique la règle de visibilité : public = OK, private = owner uniquement
    if (!this.policy.canView(post, requestingUserId)) {
      throw new ForbiddenPostAccessError(
        'This post is private and you are not the owner',
      );
    }

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
