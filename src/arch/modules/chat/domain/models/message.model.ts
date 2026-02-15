// Modele domaine Message
// Un message appartient a une conversation et a un expediteur
export interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  content: string;
  createdAt: Date;
}

// Snapshot enrichi avec le displayName de l'expediteur (pour les queries)
export interface MessageWithSender {
  id: string;
  conversationId: string;
  senderId: string;
  senderDisplayName: string;
  content: string;
  createdAt: Date;
}

// Donnees necessaires pour creer un message
export interface CreateMessageData {
  id: string;
  conversationId: string;
  senderId: string;
  content: string;
}
