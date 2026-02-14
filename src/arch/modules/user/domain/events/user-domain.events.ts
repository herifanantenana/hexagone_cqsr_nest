// Evenements domaine emis lors de changements sur l'agregat User

// Emis quand le profil (nom, bio) est mis a jour
export class UserProfileUpdatedDomainEvent {
  constructor(
    public readonly userId: string,
    public readonly displayName: string,
    public readonly bio?: string,
  ) {}
}

// Emis quand un avatar est uploade
export class UserAvatarUploadedDomainEvent {
  constructor(
    public readonly userId: string,
    public readonly avatarKey: string,
    public readonly avatarUrl: string,
  ) {}
}

// Emis quand un avatar est supprime
export class UserAvatarDeletedDomainEvent {
  constructor(
    public readonly userId: string,
    public readonly avatarKey: string,
  ) {}
}
