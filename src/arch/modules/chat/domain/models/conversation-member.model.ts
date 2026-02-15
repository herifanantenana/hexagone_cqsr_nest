// Modele domaine ConversationMember
// Represente l'appartenance d'un user a une conversation
export interface ConversationMember {
  conversationId: string;
  userId: string;
  joinedAt: Date;
}
