// Query CQRS : recupere le principal (identite minimale) d'un utilisateur par son id
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { UserPrincipal } from '@shared/types/user-principal.type';
import { UserAuthReadPort } from '../ports/user-auth-read.port';

export class GetUserPrincipalQuery {
  constructor(public readonly userId: string) {}
}

@QueryHandler(GetUserPrincipalQuery)
export class GetUserPrincipalQueryHandler implements IQueryHandler<
  GetUserPrincipalQuery,
  UserPrincipal | null
> {
  constructor(private readonly userAuthReadPort: UserAuthReadPort) {}

  async execute(query: GetUserPrincipalQuery): Promise<UserPrincipal | null> {
    const user = await this.userAuthReadPort.findById(query.userId);

    if (!user) {
      return null;
    }

    // Retourne uniquement les infos necessaires pour l'identite
    return {
      userId: user.id,
      email: user.email,
      status: user.status,
    };
  }
}
