// Port abstrait pour la generation et verification des tokens JWT

// Structure du payload contenu dans un token
export interface TokenPayload {
  sub: string; // identifiant utilisateur
  email: string;
  type: 'access' | 'refresh';
}

export abstract class TokenPort {
  // Genere un access token JWT (courte duree)
  abstract generateAccessToken(payload: {
    userId: string;
    email: string;
  }): string;
  // Genere un refresh token (longue duree, stocke hashe en base)
  abstract generateRefreshToken(payload: {
    userId: string;
    email: string;
  }): string;
  abstract verifyAccessToken(token: string): TokenPayload;
  abstract verifyRefreshToken(token: string): TokenPayload;
}
