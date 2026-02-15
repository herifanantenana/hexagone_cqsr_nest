// Policy domaine : regles d'acces aux messages
// Pur domaine : aucune dependance technique

import {
  EmptyMessageError,
  MessageTooLongError,
  NotConversationMemberError,
} from '../errors';
import { ConversationMember } from '../models/conversation-member.model';

const MAX_MESSAGE_LENGTH = 5000;

export class MessagePolicyService {
  // Un user peut lire les messages s'il est membre de la conversation
  canReadMessages(actorId: string, members: ConversationMember[]): boolean {
    return members.some((m) => m.userId === actorId);
  }

  // Un user peut envoyer un message s'il est membre de la conversation
  canSendMessage(actorId: string, members: ConversationMember[]): boolean {
    return members.some((m) => m.userId === actorId);
  }

  // Valide le contenu du message (non vide, longueur max)
  validateContent(content: string): void {
    if (!content || content.trim().length === 0) {
      throw new EmptyMessageError();
    }
    if (content.length > MAX_MESSAGE_LENGTH) {
      throw new MessageTooLongError(MAX_MESSAGE_LENGTH);
    }
  }

  // Assertion : lance NotConversationMemberError si non membre
  assertCanRead(actorId: string, members: ConversationMember[]): void {
    if (!this.canReadMessages(actorId, members)) {
      throw new NotConversationMemberError();
    }
  }

  // Assertion : lance NotConversationMemberError si non membre
  assertCanSend(actorId: string, members: ConversationMember[]): void {
    if (!this.canSendMessage(actorId, members)) {
      throw new NotConversationMemberError();
    }
  }
}
