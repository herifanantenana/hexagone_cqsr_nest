export interface UserProfileSnapshot {
  id: string;
  email: string;
  displayName: string;
  bio?: string;
  avatarUrl?: string;
  status: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface PublicUserProfileSnapshot {
  id: string;
  displayName: string;
  bio?: string;
  avatarUrl?: string;
  createdAt: Date;
}

export abstract class UserRepositoryPort {
  abstract findMyProfile(userId: string): Promise<UserProfileSnapshot | null>;
  abstract findPublicProfile(
    userId: string,
  ): Promise<PublicUserProfileSnapshot | null>;
}
