import { Injectable } from '@nestjs/common';
import { QueryBus } from '@nestjs/cqrs';
import { PassportStrategy } from '@nestjs/passport';
import { UserPrincipal } from '@shared/types/user-principal.type';
import { Strategy } from 'passport-local';
import { ValidateCredentialsQuery } from '../../application/queries/validate-credentials.query';

@Injectable()
export class LocalStrategy extends PassportStrategy(Strategy, 'local') {
  constructor(private readonly queryBus: QueryBus) {
    super({
      usernameField: 'email',
      passwordField: 'password',
    });
  }

  async validate(email: string, password: string): Promise<UserPrincipal> {
    return await this.queryBus.execute(
      new ValidateCredentialsQuery(email, password),
    );
  }
}
