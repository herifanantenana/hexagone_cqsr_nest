// Commande CQRS : deconnexion (revoque une ou toutes les sessions)
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { SessionRepositoryPort } from '../ports/session-repository.port';

export class LogoutCommand {
  constructor(
    public readonly userId: string,
    public readonly sessionId?: string, // Si fourni, revoque uniquement cette session
  ) {}
}

@CommandHandler(LogoutCommand)
export class LogoutCommandHandler implements ICommandHandler<
  LogoutCommand,
  void
> {
  constructor(private readonly sessionRepository: SessionRepositoryPort) {}

  async execute(command: LogoutCommand): Promise<void> {
    const { userId, sessionId } = command;

    if (sessionId) {
      // Revoque une session specifique apres verification du proprietaire
      const session = await this.sessionRepository.findById(sessionId);
      if (session && session.userId === userId) {
        await this.sessionRepository.revokeSession(sessionId);
      }
    } else {
      // Revoque toutes les sessions de l'utilisateur
      await this.sessionRepository.revokeAllUserSessions(userId);
    }
  }
}
