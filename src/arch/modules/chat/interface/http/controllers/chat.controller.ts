// Controller HTTP du module Chat
// Delegue toute la logique aux handlers CQRS (commands/queries)
// Les policies de membership sont verifiees dans les handlers, pas ici
import { Can } from '@common/interface/http/decorators';
import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
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
import { AddConversationMemberCommand } from '../../../application/commands/add-conversation-member.command';
import {
  CreateConversationCommand,
  CreateConversationResult,
} from '../../../application/commands/create-conversation.command';
import { SendMessageCommand } from '../../../application/commands/send-message.command';
import {
  ConversationDetailResult,
  GetConversationByIdQuery,
} from '../../../application/queries/get-conversation-by-id.query';
import { ListMessagesQuery } from '../../../application/queries/list-messages.query';
import { ListMyConversationsQuery } from '../../../application/queries/list-my-conversations.query';
import {
  ConversationWithLastMessage,
  MessageWithSender,
} from '../../../domain/models';
import { AddMemberDto } from '../dtos/add-member.dto';
import {
  ConversationDetailResponseDto,
  ConversationListItemDto,
  ConversationResponseDto,
} from '../dtos/conversation-response.dto';
import { CreateConversationDto } from '../dtos/create-conversation.dto';
import { ListMessagesQueryDto } from '../dtos/list-messages-query.dto';
import {
  MessageResponseDto,
  PaginatedMessagesResponseDto,
} from '../dtos/message-response.dto';
import { SendMessageDto } from '../dtos/send-message.dto';

@ApiTags('Chat')
@ApiBearerAuth('BearerAuth')
@Controller('chat/conversations')
@UseGuards(JwtAuthGuard) // Toutes les routes chat requierent un JWT valide
export class ChatController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
  ) {}

  // ─── POST /chat/conversations ──────────────────────────────────────────────
  @Post()
  @Can('conversations', 'create')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new conversation with members' })
  @ApiBody({ type: CreateConversationDto })
  @ApiResponse({
    status: 201,
    description: 'Conversation created',
    type: ConversationResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Invalid data' })
  @ApiResponse({ status: 401, description: 'Unauthorized – JWT required' })
  @ApiResponse({ status: 403, description: 'Missing permission' })
  @ApiResponse({ status: 429, description: 'Too many requests' })
  async createConversation(
    @CurrentUser() user: UserPrincipal,
    @Body() dto: CreateConversationDto,
  ): Promise<ConversationResponseDto> {
    const result = await this.commandBus.execute<
      CreateConversationCommand,
      CreateConversationResult
    >(new CreateConversationCommand(user.userId, dto.memberIds, dto.title));

    return {
      id: result.id,
      createdBy: result.createdBy,
      title: result.title,
      createdAt: result.createdAt,
      members: result.members,
    };
  }

  // ─── GET /chat/conversations ───────────────────────────────────────────────
  @Get()
  @Can('conversations', 'read')
  @ApiOperation({ summary: 'List my conversations (with last message)' })
  @ApiResponse({
    status: 200,
    description: 'List of conversations',
    type: [ConversationListItemDto],
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Missing permission' })
  async listMyConversations(
    @CurrentUser() user: UserPrincipal,
  ): Promise<ConversationListItemDto[]> {
    return this.queryBus.execute<
      ListMyConversationsQuery,
      ConversationWithLastMessage[]
    >(new ListMyConversationsQuery(user.userId));
  }

  // ─── GET /chat/conversations/:id ──────────────────────────────────────────
  @Get(':id')
  @Can('conversations', 'read')
  @ApiOperation({ summary: 'Get conversation details (members only)' })
  @ApiParam({ name: 'id', description: 'Conversation UUID', type: String })
  @ApiResponse({
    status: 200,
    description: 'Conversation details',
    type: ConversationDetailResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({
    status: 403,
    description: 'Not a member of this conversation',
  })
  @ApiResponse({ status: 404, description: 'Conversation not found' })
  async getConversation(
    @CurrentUser() user: UserPrincipal,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ConversationDetailResponseDto> {
    const result = await this.queryBus.execute<
      GetConversationByIdQuery,
      ConversationDetailResult
    >(new GetConversationByIdQuery(id, user.userId));

    return {
      id: result.conversation.id,
      createdBy: result.conversation.createdBy,
      title: result.conversation.title,
      createdAt: result.conversation.createdAt,
      updatedAt: result.conversation.updatedAt,
      members: result.members.map((m) => ({
        userId: m.userId,
        joinedAt: m.joinedAt,
      })),
    };
  }

  // ─── POST /chat/conversations/:id/members ─────────────────────────────────
  @Post(':id/members')
  @Can('conversations', 'create')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Add a member to a conversation (creator only)' })
  @ApiParam({ name: 'id', description: 'Conversation UUID', type: String })
  @ApiBody({ type: AddMemberDto })
  @ApiResponse({ status: 201, description: 'Member added' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Only the creator can add members' })
  @ApiResponse({ status: 404, description: 'Conversation not found' })
  @ApiResponse({ status: 409, description: 'User is already a member' })
  async addMember(
    @CurrentUser() user: UserPrincipal,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AddMemberDto,
  ): Promise<{ message: string }> {
    await this.commandBus.execute<AddConversationMemberCommand, void>(
      new AddConversationMemberCommand(user.userId, id, dto.userId),
    );
    return { message: 'Member added successfully' };
  }

  // ─── POST /chat/conversations/:id/messages ─────────────────────────────────
  @Post(':id/messages')
  @Can('messages', 'create')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Send a message in a conversation (members only)' })
  @ApiParam({ name: 'id', description: 'Conversation UUID', type: String })
  @ApiBody({ type: SendMessageDto })
  @ApiResponse({
    status: 201,
    description: 'Message sent',
    type: MessageResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Empty message or too long' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({
    status: 403,
    description: 'Not a member of this conversation',
  })
  @ApiResponse({ status: 404, description: 'Conversation not found' })
  async sendMessage(
    @CurrentUser() user: UserPrincipal,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SendMessageDto,
  ): Promise<MessageResponseDto> {
    const message = await this.commandBus.execute<
      SendMessageCommand,
      MessageWithSender
    >(new SendMessageCommand(user.userId, id, dto.content));

    return {
      id: message.id,
      conversationId: message.conversationId,
      senderId: message.senderId,
      senderDisplayName: message.senderDisplayName,
      content: message.content,
      createdAt: message.createdAt,
    };
  }

  // ─── GET /chat/conversations/:id/messages ──────────────────────────────────
  @Get(':id/messages')
  @Can('messages', 'read')
  @ApiOperation({
    summary: 'List messages in a conversation (members only, paginated)',
  })
  @ApiParam({ name: 'id', description: 'Conversation UUID', type: String })
  @ApiResponse({
    status: 200,
    description: 'Paginated messages',
    type: PaginatedMessagesResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({
    status: 403,
    description: 'Not a member of this conversation',
  })
  @ApiResponse({ status: 404, description: 'Conversation not found' })
  async listMessages(
    @CurrentUser() user: UserPrincipal,
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: ListMessagesQueryDto,
  ): Promise<PaginatedMessagesResponseDto> {
    return this.queryBus.execute<
      ListMessagesQuery,
      PaginatedResult<MessageWithSender>
    >(new ListMessagesQuery(user.userId, id, query.page, query.pageSize));
  }
}
