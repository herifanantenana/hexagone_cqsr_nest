// Modele domaine Conversation
// Pur : aucune dependance technique (pas de Nest, Drizzle, etc.)
export interface Conversation {
  id: string;
  createdBy: string; // userId du createur
  title: string | null;
  createdAt: Date;
  updatedAt: Date;
}

// Donnees necessaires pour creer une conversation
export interface CreateConversationData {
  id: string;
  createdBy: string;
  title?: string;
}

// Snapshot enrichi pour la liste "mes conversations" (avec dernier message)
export interface ConversationWithLastMessage {
  id: string;
  createdBy: string;
  title: string | null;
  createdAt: Date;
  updatedAt: Date;
  lastMessageContent: string | null;
  lastMessageAt: Date | null;
  memberCount: number;
}
