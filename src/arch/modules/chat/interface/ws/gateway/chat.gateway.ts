// Gateway WebSocket pour le chat temps reel
// Le Gateway est un "transport" : il ne contient pas de logique metier
// Toute ecriture passe par le CommandBus (SendMessageCommand)
// Le Gateway broadcast les messages aux membres connectes a la room

import { Logger, UseGuards } from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { UserPrincipal } from '@shared/types/user-principal.type';
import { Server, Socket } from 'socket.io';
import { TokenPort } from '../../../../auth/application/ports/token.port';
import { SendMessageCommand } from '../../../application/commands/send-message.command';
import {
  ConversationDetailResult,
  GetConversationByIdQuery,
} from '../../../application/queries/get-conversation-by-id.query';
import { MessageWithSender } from '../../../domain/models';
import { WsJwtAuthGuard } from '../guards/ws-jwt-auth.guard';

// Type-safe wrapper for socket.data (Socket.IO stores custom data here)
interface WsSocketData {
  user?: UserPrincipal;
}

// NOTE scaling : si multi-instance, ajouter @WebSocketGateway({ adapter: RedisIoAdapter })
// Voir README section "WebSocket scaling" pour les details
@WebSocketGateway({
  namespace: '/chat', // Namespace dedie au chat (evite les collisions avec d'autres WS)
  cors: { origin: '*' }, // A restreindre en production
})
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(ChatGateway.name);

  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
    private readonly tokenPort: TokenPort,
  ) {}

  // Connexion : valide le JWT et attache le principal
  handleConnection(client: Socket) {
    const token =
      (client.handshake.auth as Record<string, string>)?.token ||
      (client.handshake.query as Record<string, string>)?.token;

    if (!token) {
      this.logger.warn(`Client ${client.id} rejected: no token`);
      client.disconnect();
      return;
    }

    try {
      const payload = this.tokenPort.verifyAccessToken(token);
      const principal: UserPrincipal = {
        userId: payload.sub,
        email: payload.email,
        status: 'active',
        permissions: payload.permissions || [],
      };
      (client.data as WsSocketData).user = principal;
      this.logger.log(
        `Client ${client.id} connected (user: ${principal.userId})`,
      );
    } catch {
      this.logger.warn(`Client ${client.id} rejected: invalid token`);
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    const user = (client.data as WsSocketData).user;
    this.logger.log(
      `Client ${client.id} disconnected (user: ${user?.userId || 'unknown'})`,
    );
  }

  // ─── chat.join : rejoindre une room de conversation ────────────────────────
  // Verifie la membership via query CQRS + policy avant de join la room
  @UseGuards(WsJwtAuthGuard)
  @SubscribeMessage('chat.join')
  async handleJoin(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { conversationId: string },
  ) {
    const user = (client.data as WsSocketData).user!;

    try {
      // La query verifie la membership (policy dans le handler)
      await this.queryBus.execute<
        GetConversationByIdQuery,
        ConversationDetailResult
      >(new GetConversationByIdQuery(data.conversationId, user.userId));

      // Join la room socket.io (format: "conv:<uuid>")
      const room = `conv:${data.conversationId}`;
      await client.join(room);
      this.logger.log(`User ${user.userId} joined room ${room}`);

      client.emit('chat.joined', {
        conversationId: data.conversationId,
        message: 'Joined conversation successfully',
      });
    } catch (error) {
      client.emit('chat.error', {
        event: 'chat.join',
        message:
          error instanceof Error
            ? error.message
            : 'Failed to join conversation',
      });
    }
  }

  // ─── chat.send : envoyer un message dans une conversation ─────────────────
  // Persiste via CommandBus puis broadcast a la room
  @UseGuards(WsJwtAuthGuard)
  @SubscribeMessage('chat.send')
  async handleSend(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { conversationId: string; content: string },
  ) {
    const user = (client.data as WsSocketData).user!;

    try {
      // La commande verifie la membership + valide le contenu (policy dans le handler)
      const message = await this.commandBus.execute<
        SendMessageCommand,
        MessageWithSender
      >(new SendMessageCommand(user.userId, data.conversationId, data.content));

      // Broadcast le message a tout le monde dans la room (y compris l'expediteur)
      const room = `conv:${data.conversationId}`;
      this.server.to(room).emit('chat.message', {
        conversationId: data.conversationId,
        message: {
          id: message.id,
          senderId: message.senderId,
          senderDisplayName: message.senderDisplayName,
          content: message.content,
          createdAt: message.createdAt,
        },
      });
    } catch (error) {
      client.emit('chat.error', {
        event: 'chat.send',
        message:
          error instanceof Error ? error.message : 'Failed to send message',
      });
    }
  }
}
