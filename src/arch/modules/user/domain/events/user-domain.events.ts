export class UserProfileUpdatedDomainEvent {
  constructor(
    public readonly userId: string,
    public readonly displayName: string,
    public readonly bio?: string,
  ) {}
}

export class UserAvatarUploadedDomainEvent {
  constructor(
    public readonly userId: string,
    public readonly avatarKey: string,
    public readonly avatarUrl: string,
  ) {}
}

export class UserAvatarDeletedDomainEvent {
  constructor(
    public readonly userId: string,
    public readonly avatarKey: string,
  ) {}
}
