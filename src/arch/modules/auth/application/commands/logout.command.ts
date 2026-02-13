import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { SessionRepositoryPort } from '../ports/session-repository.port';

export class LogoutCommand {
  constructor(
    public readonly userId: string,
    public readonly sessionId?: string,
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
      // Revoke specific session
      const session = await this.sessionRepository.findById(sessionId);
      if (session && session.userId === userId) {
        await this.sessionRepository.revokeSession(sessionId);
      }
    } else {
      // Revoke all user sessions
      await this.sessionRepository.revokeAllUserSessions(userId);
    }
  }
}
