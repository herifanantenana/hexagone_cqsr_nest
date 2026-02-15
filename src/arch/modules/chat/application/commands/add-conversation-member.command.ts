// Commande CQRS : ajout d'un membre a une conversation existante
// Seul le createur peut ajouter un membre (policy domaine)
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import {
  AlreadyConversationMemberError,
  ConversationNotFoundError,
} from '../../domain/errors';
import { ConversationPolicyService } from '../../domain/services';
import { ConversationMemberRepositoryPort } from '../ports/conversation-member-repository.port';
import { ConversationRepositoryPort } from '../ports/conversation-repository.port';

export class AddConversationMemberCommand {
  constructor(
    public readonly actorId: string, // L'utilisateur qui fait l'action
    public readonly conversationId: string,
    public readonly userId: string, // Le user a ajouter
  ) {}
}

@CommandHandler(AddConversationMemberCommand)
export class AddConversationMemberCommandHandler implements ICommandHandler<
  AddConversationMemberCommand,
  void
> {
  private readonly policy = new ConversationPolicyService();

  constructor(
    private readonly conversationRepo: ConversationRepositoryPort,
    private readonly memberRepo: ConversationMemberRepositoryPort,
  ) {}

  async execute(command: AddConversationMemberCommand): Promise<void> {
    const { actorId, conversationId, userId } = command;

    // Verifie que la conversation existe
    const conversation = await this.conversationRepo.findById(conversationId);
    if (!conversation) {
      throw new ConversationNotFoundError(conversationId);
    }

    // Policy : seul le createur peut ajouter des membres
    this.policy.assertCanAddMember(actorId, conversation.createdBy);

    // Verifie que le user n'est pas deja membre
    const alreadyMember = await this.memberRepo.isMember(
      conversationId,
      userId,
    );
    if (alreadyMember) {
      throw new AlreadyConversationMemberError(userId);
    }

    await this.memberRepo.addMember(conversationId, userId);
  }
}
