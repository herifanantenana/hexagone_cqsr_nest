import { CreateSessionData, Session } from '../../domain/models';

export abstract class SessionRepositoryPort {
  abstract create(data: CreateSessionData): Promise<Session>;
  abstract findById(id: string): Promise<Session | null>;
  abstract findByRefreshTokenHash(hash: string): Promise<Session | null>;
  abstract revokeSession(sessionId: string): Promise<void>;
  abstract revokeAllUserSessions(userId: string): Promise<void>;
  abstract deleteExpiredSessions(): Promise<void>;
}
