// Evenement applicatif emis apres la mise a jour du profil utilisateur
// Peut etre ecoute par d'autres modules (notifications, logs, etc.)

export class UserProfileUpdatedEvent {
  constructor(
    public readonly userId: string,
    public readonly displayName: string,
    public readonly bio?: string,
  ) {}
}
