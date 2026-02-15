// Port abstrait pour la generation et verification des tokens JWT
import { Permission } from '@shared/types/user-principal.type';

// Structure du payload contenu dans un access token
export interface TokenPayload {
  sub: string; // identifiant utilisateur
  email: string;
  type: 'access' | 'refresh';
  permissions: Permission[];
}

export abstract class TokenPort {
  // Genere un access token JWT (courte duree) avec les permissions embarquees
  abstract generateAccessToken(payload: {
    userId: string;
    email: string;
    permissions: Permission[];
  }): string;
  // Genere un refresh token UUID (longue duree, stocke hashe en base)
  abstract generateRefreshToken(): string;
  // Verifie et decode un access token JWT
  abstract verifyAccessToken(token: string): TokenPayload;
  // Hash deterministe (SHA-256) du refresh token pour lookup en base
  // Utilise SHA-256 et non bcrypt car le lookup necessite un hash reproductible
  abstract hashRefreshToken(token: string): string;
  // TTL de l'access token en secondes (depuis la config)
  abstract getAccessTtlSeconds(): number;
  // TTL du refresh token en jours (depuis la config)
  abstract getRefreshTtlDays(): number;
}
