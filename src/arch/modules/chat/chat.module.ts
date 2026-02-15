// Module NestJS du domaine Chat
// Assemble les handlers CQRS, les ports, les adapters, le controller HTTP et le gateway WS
// Meme structure que auth.module.ts / user.module.ts / posts.module.ts (coherence hexagonale)

import { DrizzleModule } from '@common/db/drizzle.module';
import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';

// Controller HTTP
import { ChatController } from './interface/http/controllers/chat.controller';

// Gateway WebSocket (temps reel)
import { ChatGateway } from './interface/ws/gateway/chat.gateway';

// Guard WS
import { WsJwtAuthGuard } from './interface/ws/guards/ws-jwt-auth.guard';

// Command Handlers
import { AddConversationMemberCommandHandler } from './application/commands/add-conversation-member.command';
import { CreateConversationCommandHandler } from './application/commands/create-conversation.command';
import { SendMessageCommandHandler } from './application/commands/send-message.command';

// Query Handlers
import { GetConversationByIdQueryHandler } from './application/queries/get-conversation-by-id.query';
import { ListMessagesQueryHandler } from './application/queries/list-messages.query';
import { ListMyConversationsQueryHandler } from './application/queries/list-my-conversations.query';

// Adapters (implementations concretes des ports)
import { ConversationMemberRepositoryAdapter } from './infrastructure/adapters/conversation-member-repository.adapter';
import { ConversationRepositoryAdapter } from './infrastructure/adapters/conversation-repository.adapter';
import { MessageRepositoryAdapter } from './infrastructure/adapters/message-repository.adapter';

// Ports (contrats abstraits)
import { ConversationMemberRepositoryPort } from './application/ports/conversation-member-repository.port';
import { ConversationRepositoryPort } from './application/ports/conversation-repository.port';
import { MessageRepositoryPort } from './application/ports/message-repository.port';

// Import AuthModule pour acceder au TokenPort (utilise par WsJwtAuthGuard et ChatGateway)
import { AuthModule } from '../auth/auth.module';

const commandHandlers = [
  CreateConversationCommandHandler,
  AddConversationMemberCommandHandler,
  SendMessageCommandHandler,
];

const queryHandlers = [
  ListMyConversationsQueryHandler,
  GetConversationByIdQueryHandler,
  ListMessagesQueryHandler,
];

// Binding port -> adapter (inversion de dependance)
const adapters = [
  {
    provide: ConversationRepositoryPort,
    useClass: ConversationRepositoryAdapter,
  },
  {
    provide: ConversationMemberRepositoryPort,
    useClass: ConversationMemberRepositoryAdapter,
  },
  { provide: MessageRepositoryPort, useClass: MessageRepositoryAdapter },
];

@Module({
  imports: [CqrsModule, DrizzleModule, AuthModule],
  controllers: [ChatController],
  providers: [
    ...commandHandlers,
    ...queryHandlers,
    ...adapters,
    ChatGateway, // Gateway WS temps reel
    WsJwtAuthGuard, // Guard WS utilise par ChatGateway
  ],
})
export class ChatModule {}
