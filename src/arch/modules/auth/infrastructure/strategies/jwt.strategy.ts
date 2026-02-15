// Strategie Passport JWT : authentifie via un access token Bearer
// Les permissions sont extraites directement du payload JWT (pas de DB call)
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { Permission, UserPrincipal } from '@shared/types/user-principal.type';
import { ExtractJwt, Strategy } from 'passport-jwt';

// Structure du payload decode depuis le JWT (correspond au sign dans JwtTokenAdapter)
interface JwtPayload {
  sub: string;
  email: string;
  type: 'access';
  permissions: Permission[];
  iat: number;
  exp: number;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(private readonly configService: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(), // Extrait le token du header Authorization
      ignoreExpiration: false, // Rejette les tokens expires (passport-jwt verifie exp)
      secretOrKey:
        configService.get<string>('JWT_ACCESS_SECRET') ||
        'your-secret-key-change-in-production',
      // Tolerance d'horloge configurable (compense un leger decalage client/serveur)
      clockTolerance: configService.get<number>('CLOCK_SKEW_SECONDS') || 5,
    });
  }

  // Construit le UserPrincipal a partir du payload JWT
  // Les permissions sont embarquees dans le token au moment du login/refresh
  // → aucun appel DB ici (stateless, performant)
  validate(payload: JwtPayload): UserPrincipal {
    if (payload.type !== 'access') {
      throw new UnauthorizedException('Invalid token type');
    }

    return {
      userId: payload.sub,
      email: payload.email,
      status: 'active', // Si le token est valide, l'utilisateur etait actif au moment de l'emission
      permissions: payload.permissions || [],
    };
  }
}
