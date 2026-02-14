// Module NestJS du domaine Posts
// Assemble les handlers CQRS, les ports et les adapters
// Même structure que auth.module.ts et user.module.ts (cohérence hexagonale)

import { DrizzleModule } from '@common/db/drizzle.module';
import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';

// Controller
import { PostsController } from './interface/http/controllers/posts.controller';

// Command Handlers
import { CreatePostCommandHandler } from './application/commands/create-post.command';
import { DeletePostCommandHandler } from './application/commands/delete-post.command';
import { UpdatePostCommandHandler } from './application/commands/update-post.command';

// Query Handlers
import { GetPostByIdQueryHandler } from './application/queries/get-post-by-id.query';
import { ListPublicPostsQueryHandler } from './application/queries/list-public-posts.query';

// Port → Adapter binding (inversion de dépendance)
import { PostRepositoryPort } from './application/ports/post-repository.port';
import { PostRepositoryAdapter } from './infrastructure/adapters/post-repository.adapter';

const commandHandlers = [
  CreatePostCommandHandler,
  UpdatePostCommandHandler,
  DeletePostCommandHandler,
];

const queryHandlers = [ListPublicPostsQueryHandler, GetPostByIdQueryHandler];

const adapters = [
  {
    provide: PostRepositoryPort,
    useClass: PostRepositoryAdapter,
  },
];

@Module({
  imports: [CqrsModule, DrizzleModule],
  controllers: [PostsController],
  providers: [...commandHandlers, ...queryHandlers, ...adapters],
})
export class PostsModule {}
