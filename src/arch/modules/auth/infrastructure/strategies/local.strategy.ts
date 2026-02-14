// Strategie Passport locale : authentifie via email + mot de passe
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
      usernameField: 'email', // Utilise le champ email au lieu de username
      passwordField: 'password',
    });
  }

  // Appele automatiquement par Passport pour valider les identifiants
  async validate(email: string, password: string): Promise<UserPrincipal> {
    return await this.queryBus.execute(
      new ValidateCredentialsQuery(email, password),
    );
  }
}
