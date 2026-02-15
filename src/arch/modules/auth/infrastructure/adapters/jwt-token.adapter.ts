// Adapter infra : implementation du port Token avec jsonwebtoken + crypto
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Permission } from '@shared/types/user-principal.type';
import { IdGenerator } from '@shared/utils/id-generator.util';
import { createHash } from 'crypto';
import * as jwt from 'jsonwebtoken';
import { TokenPayload, TokenPort } from '../../application/ports/token.port';

@Injectable()
export class JwtTokenAdapter implements TokenPort {
  private readonly jwtSecret: string;
  private readonly accessTtlSeconds: number;
  private readonly refreshTtlDays: number;
  private readonly clockSkewSeconds: number;

  constructor(private readonly configService: ConfigService) {
    // Charge la config JWT depuis .env (voir .env.example pour les valeurs par défaut)
    this.jwtSecret =
      this.configService.get<string>('JWT_ACCESS_SECRET') ||
      'your-secret-key-change-in-production';
    // Durée de vie de l'access token en secondes (15 min = 900s par défaut)
    this.accessTtlSeconds =
      this.configService.get<number>('JWT_ACCESS_TTL_SECONDS') || 900;
    // Durée de vie du refresh token en jours (7 par défaut)
    this.refreshTtlDays =
      this.configService.get<number>('REFRESH_TTL_DAYS') || 7;
    // Tolérance d'horloge en secondes (compense le décalage client/serveur)
    this.clockSkewSeconds =
      this.configService.get<number>('CLOCK_SKEW_SECONDS') || 5;
  }

  // Signe un JWT avec le payload utilisateur, les permissions et une duree courte
  generateAccessToken(payload: {
    userId: string;
    email: string;
    permissions: Permission[];
  }): string {
    return jwt.sign(
      {
        sub: payload.userId,
        email: payload.email,
        type: 'access',
        permissions: payload.permissions,
      },
      this.jwtSecret,
      {
        expiresIn: this.accessTtlSeconds, // secondes (900 = 15 min)
      },
    );
  }

  // Le refresh token est un UUID aleatoire (pas un JWT), stocke hashe en base
  generateRefreshToken(): string {
    return IdGenerator.generate();
  }

  verifyAccessToken(token: string): TokenPayload {
    const decoded = jwt.verify(token, this.jwtSecret, {
      clockTolerance: this.clockSkewSeconds,
    }) as TokenPayload;
    return decoded;
  }

  // Hash deterministe SHA-256 pour stocker et retrouver le refresh token en base
  // SHA-256 est choisi car le refresh token (UUID v4) a 122 bits d'entropie,
  // rendant les attaques par force brute impraticables
  hashRefreshToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  getAccessTtlSeconds(): number {
    return this.accessTtlSeconds;
  }

  getRefreshTtlDays(): number {
    return this.refreshTtlDays;
  }
}
