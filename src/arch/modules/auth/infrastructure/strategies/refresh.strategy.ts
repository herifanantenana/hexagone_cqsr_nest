// Strategie Passport pour le refresh token (extrait depuis le body ou query)
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { Request } from 'express';
import { ExtractJwt, Strategy } from 'passport-jwt';

@Injectable()
export class RefreshStrategy extends PassportStrategy(Strategy, 'refresh') {
  constructor(private readonly configService: ConfigService) {
    super({
      // Extracteur custom : cherche le refreshToken dans le body ou les query params
      jwtFromRequest: ExtractJwt.fromExtractors([
        (request: Request) => {
          return (
            (request.body as Record<string, string> | undefined)
              ?.refreshToken ||
            (request.query as Record<string, string>)?.refreshToken ||
            null
          );
        },
      ]),
      ignoreExpiration: true, // Expiration geree manuellement dans le command handler
      secretOrKey:
        configService.get<string>('JWT_SECRET') ||
        'your-secret-key-change-in-production',
      passReqToCallback: false,
    });
  }

  // La vraie validation se fait dans RefreshTokenCommandHandler
  validate(payload: unknown): Promise<unknown> {
    return Promise.resolve(payload);
  }
}
