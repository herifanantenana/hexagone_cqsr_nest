// Port abstrait pour la persistence des membres de conversation
import { ConversationMember } from '../../domain/models';

export abstract class ConversationMemberRepositoryPort {
  abstract addMember(
    conversationId: string,
    userId: string,
  ): Promise<ConversationMember>;
  abstract addMembers(conversationId: string, userIds: string[]): Promise<void>;
  abstract findMembers(conversationId: string): Promise<ConversationMember[]>;
  abstract isMember(conversationId: string, userId: string): Promise<boolean>;
}
