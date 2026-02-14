// Query CQRS : recherche un utilisateur par email (utilise par le module auth)

import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { User } from '../../domain/models/user.model';
import { UserWriteRepositoryPort } from '../ports/user-write-repository.port';

export class FindUserByEmailQuery {
  constructor(public readonly email: string) {}
}

@QueryHandler(FindUserByEmailQuery)
export class FindUserByEmailQueryHandler implements IQueryHandler<
  FindUserByEmailQuery,
  User | null
> {
  // Utilise le write repository car on a besoin du modele domaine complet
  constructor(private readonly userWriteRepository: UserWriteRepositoryPort) {}

  async execute(query: FindUserByEmailQuery): Promise<User | null> {
    return await this.userWriteRepository.findByEmail(query.email);
  }
}
