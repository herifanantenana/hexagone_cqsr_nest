// Evenements du domaine auth, emis lors des actions utilisateur

// Emis apres une inscription reussie
export class UserRegisteredEvent {
  constructor(
    public readonly userId: string,
    public readonly email: string,
  ) {}
}

// Emis apres une connexion reussie
export class UserLoggedInEvent {
  constructor(
    public readonly userId: string,
    public readonly sessionId: string,
  ) {}
}

// Emis apres une deconnexion
export class UserLoggedOutEvent {
  constructor(
    public readonly userId: string,
    public readonly sessionId: string,
  ) {}
}

// Emis apres un changement de mot de passe
export class PasswordChangedEvent {
  constructor(public readonly userId: string) {}
}
