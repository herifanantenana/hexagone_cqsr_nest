// Port abstrait pour la persistence des sessions (implementé par Drizzle en infra)
import { CreateSessionData, Session } from '../../domain/models';

export abstract class SessionRepositoryPort {
  abstract create(data: CreateSessionData): Promise<Session>;
  abstract findById(id: string): Promise<Session | null>;
  // Recherche une session par le hash du refresh token
  abstract findByRefreshTokenHash(hash: string): Promise<Session | null>;
  // Revoque une session specifique (met revokedAt a maintenant)
  abstract revokeSession(sessionId: string): Promise<void>;
  // Revoque toutes les sessions actives d'un utilisateur
  abstract revokeAllUserSessions(userId: string): Promise<void>;
  // Supprime les sessions expirees (nettoyage)
  abstract deleteExpiredSessions(): Promise<void>;
}
