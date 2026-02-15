// Erreurs metier du domaine Chat
// Pur domaine : pas de dependance technique

export class ConversationNotFoundError extends Error {
  constructor(conversationId: string) {
    super(`Conversation not found: ${conversationId}`);
    this.name = 'ConversationNotFoundError';
  }
}

export class NotConversationMemberError extends Error {
  constructor() {
    super('You are not a member of this conversation');
    this.name = 'NotConversationMemberError';
  }
}

export class AlreadyConversationMemberError extends Error {
  constructor(userId: string) {
    super(`User ${userId} is already a member of this conversation`);
    this.name = 'AlreadyConversationMemberError';
  }
}

export class CannotAddMemberError extends Error {
  constructor() {
    super('Only the conversation creator can add members');
    this.name = 'CannotAddMemberError';
  }
}

export class EmptyMessageError extends Error {
  constructor() {
    super('Message content cannot be empty');
    this.name = 'EmptyMessageError';
  }
}

export class MessageTooLongError extends Error {
  constructor(maxLength: number) {
    super(`Message content cannot exceed ${String(maxLength)} characters`);
    this.name = 'MessageTooLongError';
  }
}
