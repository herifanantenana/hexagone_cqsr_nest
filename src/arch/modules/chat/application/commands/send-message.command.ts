// Commande CQRS : envoi d'un message dans une conversation
// Verifie la membership via policy domaine avant d'ecrire en DB
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { IdGenerator } from '@shared/utils/id-generator.util';
import { ConversationNotFoundError } from '../../domain/errors';
import { MessageWithSender } from '../../domain/models';
import { MessagePolicyService } from '../../domain/services';
import { ConversationMemberRepositoryPort } from '../ports/conversation-member-repository.port';
import { ConversationRepositoryPort } from '../ports/conversation-repository.port';
import { MessageRepositoryPort } from '../ports/message-repository.port';

export class SendMessageCommand {
  constructor(
    public readonly senderId: string,
    public readonly conversationId: string,
    public readonly content: string,
  ) {}
}

@CommandHandler(SendMessageCommand)
export class SendMessageCommandHandler implements ICommandHandler<
  SendMessageCommand,
  MessageWithSender
> {
  private readonly messagePolicy = new MessagePolicyService();

  constructor(
    private readonly conversationRepo: ConversationRepositoryPort,
    private readonly memberRepo: ConversationMemberRepositoryPort,
    private readonly messageRepo: MessageRepositoryPort,
  ) {}

  async execute(command: SendMessageCommand): Promise<MessageWithSender> {
    const { senderId, conversationId, content } = command;

    // Valide le contenu du message (non vide, longueur max)
    this.messagePolicy.validateContent(content);

    // Verifie que la conversation existe
    const conversation = await this.conversationRepo.findById(conversationId);
    if (!conversation) {
      throw new ConversationNotFoundError(conversationId);
    }

    // Policy : l'expediteur doit etre membre de la conversation
    const members = await this.memberRepo.findMembers(conversationId);
    this.messagePolicy.assertCanSend(senderId, members);

    // Persiste le message
    const messageId = IdGenerator.generate();
    return this.messageRepo.create({
      id: messageId,
      conversationId,
      senderId,
      content: content.trim(),
    });
  }
}
