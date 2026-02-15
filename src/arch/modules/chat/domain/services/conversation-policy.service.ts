// Policy domaine : regles d'acces aux conversations
// Pur domaine : aucune dependance technique
// Regle choisie : seul le createur peut ajouter des membres (simple et claire)

import { CannotAddMemberError, NotConversationMemberError } from '../errors';
import { ConversationMember } from '../models/conversation-member.model';

export class ConversationPolicyService {
  // Un user peut lire une conversation s'il en est membre
  canReadConversation(actorId: string, members: ConversationMember[]): boolean {
    return members.some((m) => m.userId === actorId);
  }

  // Un user peut envoyer un message s'il est membre de la conversation
  canSendMessage(actorId: string, members: ConversationMember[]): boolean {
    return members.some((m) => m.userId === actorId);
  }

  // Seul le createur de la conversation peut ajouter des membres
  canAddMember(actorId: string, createdBy: string): boolean {
    return actorId === createdBy;
  }

  // Variante assertion : lance une erreur si non membre
  assertIsMember(actorId: string, members: ConversationMember[]): void {
    if (!this.canReadConversation(actorId, members)) {
      throw new NotConversationMemberError();
    }
  }

  // Variante assertion : lance une erreur si pas createur
  assertCanAddMember(actorId: string, createdBy: string): void {
    if (!this.canAddMember(actorId, createdBy)) {
      throw new CannotAddMemberError();
    }
  }
}
