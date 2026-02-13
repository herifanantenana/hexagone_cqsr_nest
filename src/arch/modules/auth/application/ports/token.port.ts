export interface TokenPayload {
  sub: string;
  email: string;
  type: 'access' | 'refresh';
}

export abstract class TokenPort {
  abstract generateAccessToken(payload: {
    userId: string;
    email: string;
  }): string;
  abstract generateRefreshToken(payload: {
    userId: string;
    email: string;
  }): string;
  abstract verifyAccessToken(token: string): TokenPayload;
  abstract verifyRefreshToken(token: string): TokenPayload;
}
