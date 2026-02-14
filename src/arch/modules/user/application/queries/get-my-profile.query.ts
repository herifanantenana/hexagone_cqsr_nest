// Query CQRS : recupere le profil complet de l'utilisateur connecte

import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { UserNotFoundError } from '../../domain/errors/user-errors';
import {
  UserProfileSnapshot,
  UserRepositoryPort,
} from '../ports/user-repository.port';

export class GetMyProfileQuery {
  constructor(public readonly userId: string) {}
}

@QueryHandler(GetMyProfileQuery)
export class GetMyProfileQueryHandler implements IQueryHandler<
  GetMyProfileQuery,
  UserProfileSnapshot
> {
  // Injecte le port de lecture (pas le write repository)
  constructor(private readonly userRepository: UserRepositoryPort) {}

  async execute(query: GetMyProfileQuery): Promise<UserProfileSnapshot> {
    const profile = await this.userRepository.findMyProfile(query.userId);

    if (!profile) {
      throw new UserNotFoundError(query.userId);
    }

    return profile;
  }
}
