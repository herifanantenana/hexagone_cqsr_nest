// Evenement applicatif emis apres une inscription reussie
// Permet aux autres modules (ex: user) de reagir a l'inscription
export class UserSignedUpEvent {
  constructor(
    public readonly userId: string,
    public readonly email: string,
    public readonly displayName: string,
  ) {}
}
