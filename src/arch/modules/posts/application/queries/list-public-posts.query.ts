// Query CQRS : liste paginée des posts publics
// Utilise la vue postsPublicView qui filtre déjà sur visibility = 'public'
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { PaginatedResult } from '@shared/types/pagination.type';
import {
  PostRepositoryPort,
  PublicPostSnapshot,
} from '../ports/post-repository.port';

export class ListPublicPostsQuery {
  constructor(
    public readonly page: number = 1,
    public readonly pageSize: number = 20,
  ) {}
}

@QueryHandler(ListPublicPostsQuery)
export class ListPublicPostsQueryHandler implements IQueryHandler<
  ListPublicPostsQuery,
  PaginatedResult<PublicPostSnapshot>
> {
  constructor(private readonly postRepository: PostRepositoryPort) {}

  async execute(
    query: ListPublicPostsQuery,
  ): Promise<PaginatedResult<PublicPostSnapshot>> {
    // Clamp pageSize entre 1 et 100 pour éviter les abus
    const page = Math.max(1, query.page);
    const pageSize = Math.min(100, Math.max(1, query.pageSize));

    const { data, total } = await this.postRepository.findPublicPosts(
      page,
      pageSize,
    );

    return {
      data,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }
}
