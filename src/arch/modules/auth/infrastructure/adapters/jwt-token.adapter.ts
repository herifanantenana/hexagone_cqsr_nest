// Adapter infra : implementation du port Token avec jsonwebtoken
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
    // Charge la config JWT depuis les variables d'environnement
    this.jwtSecret =
      this.configService.get<string>('JWT_ACCESS_SECRET') ||
      'your-secret-key-change-in-production';
    this.jwtExpiresIn =
      this.configService.get<string>('JWT_ACCESS_EXPIRATION') || '15m';
  }

  // Signe un JWT avec le payload utilisateur et une duree courte
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

  // Le refresh token est un UUID aleatoire (pas un JWT), stocke hashe en base
  generateRefreshToken(_payload: { userId: string; email: string }): string {
    return IdGenerator.generate();
  }

  verifyAccessToken(token: string): TokenPayload {
    try {
      const decoded = jwt.verify(token, this.jwtSecret) as TokenPayload;
      return decoded;
    } catch (_error) {
      throw new Error('Invalid access token');
    }
  }

  // Non utilise : les refresh tokens sont des UUID, pas des JWT
  verifyRefreshToken(_token: string): TokenPayload {
    throw new Error(
      'Refresh token verification should be done via session lookup',
    );
  }
}
