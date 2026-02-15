// Port abstrait pour la persistence des conversations
// Implemente par DrizzleConversationRepositoryAdapter dans l'infra

import {
  Conversation,
  ConversationWithLastMessage,
  CreateConversationData,
} from '../../domain/models';

export abstract class ConversationRepositoryPort {
  abstract create(data: CreateConversationData): Promise<Conversation>;
  abstract findById(id: string): Promise<Conversation | null>;
  // Liste les conversations d'un user avec le dernier message (optimise pour la liste)
  abstract findByUserId(userId: string): Promise<ConversationWithLastMessage[]>;
}
