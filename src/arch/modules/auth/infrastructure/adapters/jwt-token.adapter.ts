import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { IdGenerator } from '@shared/utils/id-generator.util';
import * as jwt from 'jsonwebtoken';
import { TokenPayload, TokenPort } from '../../application/ports/token.port';

@Injectable()
export class JwtTokenAdapter implements TokenPort {
  private readonly jwtSecret: string;
  private readonly jwtExpiresIn: string | number;

  constructor(private readonly configService: ConfigService) {
    this.jwtSecret =
      this.configService.get<string>('JWT_ACCESS_SECRET') ||
      'your-secret-key-change-in-production';
    this.jwtExpiresIn =
      this.configService.get<string>('JWT_ACCESS_EXPIRATION') || '15m';
  }

  generateAccessToken(payload: { userId: string; email: string }): string {
    return jwt.sign(
      {
        sub: payload.userId,
        email: payload.email,
        type: 'access',
      },
      this.jwtSecret,
      {
        expiresIn: this.jwtExpiresIn as jwt.SignOptions['expiresIn'],
      },
    );
  }

  generateRefreshToken(payload: { userId: string; email: string }): string {
    // Generate a random UUID for refresh token (stored hashed in DB)
    return IdGenerator.generate();
  }

  verifyAccessToken(token: string): TokenPayload {
    try {
      const decoded = jwt.verify(token, this.jwtSecret) as TokenPayload;
      return decoded;
    } catch (error) {
      throw new Error('Invalid access token');
    }
  }

  verifyRefreshToken(token: string): TokenPayload {
    // Refresh tokens are UUIDs, not JWTs. Validation happens in the command handler.
    // This method shouldn't be used in the current implementation.
    throw new Error('Refresh token verification should be done via session lookup');
  }
}
