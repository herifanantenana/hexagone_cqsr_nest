// Controller HTTP du module Posts
// Situé dans Interface car il est la porte d'entrée HTTP vers le domaine
// Délègue toute la logique aux handlers CQRS (commands/queries)

import { Can } from '@common/interface/http/decorators';
import { OptionalAuthGuard } from '@common/interface/http/guards';
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { PaginatedResult } from '@shared/types/pagination.type';
import { UserPrincipal } from '@shared/types/user-principal.type';
import { CurrentUser } from '../../../../auth/interface/http/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../../../auth/interface/http/guards/jwt-auth.guard';
import {
  CreatePostCommand,
  CreatePostResult,
} from '../../../application/commands/create-post.command';
import { DeletePostCommand } from '../../../application/commands/delete-post.command';
import {
  UpdatePostCommand,
  UpdatePostResult,
} from '../../../application/commands/update-post.command';
import { PublicPostSnapshot } from '../../../application/ports/post-repository.port';
import {
  GetPostByIdQuery,
  PostDetailResult,
} from '../../../application/queries/get-post-by-id.query';
import { ListPublicPostsQuery } from '../../../application/queries/list-public-posts.query';
import { CreatePostDto } from '../dtos/create-post.dto';
import { ListPostsQueryDto } from '../dtos/list-posts-query.dto';
import { PaginatedPostsResponseDto } from '../dtos/paginated-posts-response.dto';
import { PostResponseDto } from '../dtos/post-response.dto';
import { UpdatePostDto } from '../dtos/update-post.dto';

@ApiTags('Posts')
@Controller('posts')
export class PostsController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
  ) {}

  // ─── POST /posts ─────────────────────────────────────────────────────────
  @Post()
  @UseGuards(JwtAuthGuard)
  @Can('posts', 'create')
  @HttpCode(HttpStatus.CREATED)
  @ApiBearerAuth('BearerAuth')
  @ApiOperation({ summary: 'Create a new post' })
  @ApiBody({ type: CreatePostDto })
  @ApiResponse({
    status: 201,
    description: 'Post created',
    type: PostResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Invalid post data' })
  @ApiResponse({ status: 401, description: 'Unauthorized – JWT required' })
  @ApiResponse({ status: 403, description: 'Missing permission' })
  async create(
    @CurrentUser() user: UserPrincipal,
    @Body() dto: CreatePostDto,
  ): Promise<PostResponseDto> {
    const result = await this.commandBus.execute<
      CreatePostCommand,
      CreatePostResult
    >(
      new CreatePostCommand(
        user.userId,
        dto.title,
        dto.content,
        dto.visibility || 'public',
      ),
    );
    return {
      id: result.id,
      ownerId: result.ownerId,
      title: result.title,
      content: result.content,
      visibility: result.visibility,
      createdAt: result.createdAt,
      updatedAt: result.updatedAt ?? result.createdAt,
    };
  }

  // ─── GET /posts ──────────────────────────────────────────────────────────
  @Get()
  @ApiOperation({ summary: 'List public posts (paginated)' })
  @ApiResponse({
    status: 200,
    description: 'Paginated list',
    type: PaginatedPostsResponseDto,
  })
  async list(
    @Query() query: ListPostsQueryDto,
  ): Promise<PaginatedPostsResponseDto> {
    return this.queryBus.execute<
      ListPublicPostsQuery,
      PaginatedResult<PublicPostSnapshot>
    >(new ListPublicPostsQuery(query.page, query.pageSize));
  }

  // ─── GET /posts/:id ──────────────────────────────────────────────────────
  // OptionalAuthGuard : tente l'auth JWT, continue sans erreur si pas de token
  // Owner d'un post private peut le voir, les autres obtiennent 403
  @Get(':id')
  @UseGuards(OptionalAuthGuard)
  @Can('posts', 'read')
  @ApiOperation({ summary: 'Get a post by ID (public or private if owner)' })
  @ApiParam({ name: 'id', description: 'Post UUID', type: String })
  @ApiResponse({
    status: 200,
    description: 'Post found',
    type: PostResponseDto,
  })
  @ApiResponse({
    status: 403,
    description: 'Post is private and you are not the owner',
  })
  @ApiResponse({ status: 404, description: 'Post not found' })
  async getById(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: UserPrincipal | null,
  ): Promise<PostResponseDto> {
    return this.queryBus.execute<GetPostByIdQuery, PostDetailResult>(
      new GetPostByIdQuery(id, user?.userId),
    );
  }

  // ─── PATCH /posts/:id ────────────────────────────────────────────────────
  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  @Can('posts', 'update')
  @ApiBearerAuth('BearerAuth')
  @ApiOperation({ summary: 'Update a post (owner only)' })
  @ApiParam({ name: 'id', description: 'Post UUID', type: String })
  @ApiBody({ type: UpdatePostDto })
  @ApiResponse({
    status: 200,
    description: 'Post updated',
    type: PostResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Invalid post data' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Not the owner' })
  @ApiResponse({ status: 404, description: 'Post not found' })
  async update(
    @CurrentUser() user: UserPrincipal,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdatePostDto,
  ): Promise<PostResponseDto> {
    return this.commandBus.execute<UpdatePostCommand, UpdatePostResult>(
      new UpdatePostCommand(
        user.userId,
        id,
        dto.title,
        dto.content,
        dto.visibility,
      ),
    );
  }

  // ─── DELETE /posts/:id ───────────────────────────────────────────────────
  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  @Can('posts', 'delete')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiBearerAuth('BearerAuth')
  @ApiOperation({ summary: 'Delete a post (owner only)' })
  @ApiParam({ name: 'id', description: 'Post UUID', type: String })
  @ApiResponse({ status: 204, description: 'Post deleted' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Not the owner' })
  @ApiResponse({ status: 404, description: 'Post not found' })
  async delete(
    @CurrentUser() user: UserPrincipal,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    await this.commandBus.execute<DeletePostCommand, void>(
      new DeletePostCommand(user.userId, id),
    );
  }
}
