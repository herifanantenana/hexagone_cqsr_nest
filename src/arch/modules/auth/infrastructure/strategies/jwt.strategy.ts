// Strategie Passport JWT : authentifie via un access token Bearer
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { QueryBus } from '@nestjs/cqrs';
import { PassportStrategy } from '@nestjs/passport';
import { UserPrincipal } from '@shared/types/user-principal.type';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { GetUserPrincipalQuery } from '../../application/queries/get-user-principal.query';

// Structure du payload decode depuis le JWT
interface JwtPayload {
  userId: string;
  email: string;
  status: string;
  sub: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    private readonly configService: ConfigService,
    private readonly queryBus: QueryBus,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(), // Extrait le token du header Authorization
      ignoreExpiration: false, // Rejette les tokens expires
      secretOrKey:
        configService.get<string>('JWT_SECRET') ||
        'your-secret-key-change-in-production',
    });
  }

  // Recupere l'utilisateur complet a partir du payload JWT
  async validate(payload: JwtPayload): Promise<UserPrincipal> {
    return await this.queryBus.execute(
      new GetUserPrincipalQuery(payload.userId),
    );
  }
}
