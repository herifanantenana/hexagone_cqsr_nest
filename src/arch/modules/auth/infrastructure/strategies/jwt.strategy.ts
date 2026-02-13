import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { QueryBus } from '@nestjs/cqrs';
import { PassportStrategy } from '@nestjs/passport';
import { UserPrincipal } from '@shared/types/user-principal.type';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { GetUserPrincipalQuery } from '../../application/queries/get-user-principal.query';

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
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey:
        configService.get<string>('JWT_SECRET') ||
        'your-secret-key-change-in-production',
    });
  }

  async validate(payload: JwtPayload): Promise<UserPrincipal> {
    return await this.queryBus.execute(
      new GetUserPrincipalQuery(payload.userId),
    );
  }
}
