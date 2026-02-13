import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { UserNotFoundError } from '../../domain/errors/user-errors';
import {
  PublicUserProfileSnapshot,
  UserRepositoryPort,
} from '../ports/user-repository.port';

export class GetPublicProfileQuery {
  constructor(public readonly userId: string) {}
}

@QueryHandler(GetPublicProfileQuery)
export class GetPublicProfileQueryHandler implements IQueryHandler<
  GetPublicProfileQuery,
  PublicUserProfileSnapshot
> {
  constructor(private readonly userRepository: UserRepositoryPort) {}

  async execute(
    query: GetPublicProfileQuery,
  ): Promise<PublicUserProfileSnapshot> {
    const profile = await this.userRepository.findPublicProfile(query.userId);

    if (!profile) {
      throw new UserNotFoundError(query.userId);
    }

    return profile;
  }
}
