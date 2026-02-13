import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { Request } from 'express';
import { ExtractJwt, Strategy } from 'passport-jwt';

@Injectable()
export class RefreshStrategy extends PassportStrategy(Strategy, 'refresh') {
  constructor(private readonly configService: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        (request: Request) => {
          return request.body?.refreshToken || request.query?.refreshToken;
        },
      ]),
      ignoreExpiration: true, // We validate manually in the command handler
      secretOrKey:
        configService.get<string>('JWT_SECRET') ||
        'your-secret-key-change-in-production',
      passReqToCallback: false,
    });
  }

  async validate(payload: unknown): Promise<unknown> {
    // The actual validation happens in RefreshTokenCommand handler
    // This strategy is not actually used, but kept for potential future use
    return payload;
  }
}
