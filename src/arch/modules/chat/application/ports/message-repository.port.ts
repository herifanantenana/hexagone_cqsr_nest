// Port abstrait pour la persistence des messages
import { CreateMessageData, MessageWithSender } from '../../domain/models';

export abstract class MessageRepositoryPort {
  // Returns MessageWithSender so the response always includes senderDisplayName
  abstract create(data: CreateMessageData): Promise<MessageWithSender>;
  // Pagination des messages d'une conversation (les plus recents en premier)
  abstract findByConversationId(
    conversationId: string,
    page: number,
    pageSize: number,
  ): Promise<{ data: MessageWithSender[]; total: number }>;
}
