// Erreurs metier du domaine auth, chaque classe represente un cas d'erreur specifique

// Email ou mot de passe incorrect
export class InvalidCredentialsError extends Error {
  constructor() {
    super('Invalid email or password');
    this.name = 'InvalidCredentialsError';
  }
}

// Email deja utilise lors de l'inscription
export class EmailAlreadyUsedError extends Error {
  constructor(email: string) {
    super(`Email ${email} is already registered`);
    this.name = 'EmailAlreadyUsedError';
  }
}

// Token invalide ou expire (access ou refresh)
export class InvalidTokenError extends Error {
  constructor(message?: string) {
    super(message || 'Invalid or expired token');
    this.name = 'InvalidTokenError';
  }
}

// Session introuvable en base
export class SessionNotFoundError extends Error {
  constructor() {
    super('Session not found or expired');
    this.name = 'SessionNotFoundError';
  }
}

// Session deja revoquee
export class SessionRevokedError extends Error {
  constructor() {
    super('Session has been revoked');
    this.name = 'SessionRevokedError';
  }
}

// Mot de passe ne respectant pas les regles de validation
export class InvalidPasswordError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidPasswordError';
  }
}

// Compte utilisateur désactivé
export class UserDisabledError extends Error {
  constructor() {
    super('User account is disabled');
    this.name = 'UserDisabledError';
  }
}

// Nom d'affichage ne respectant pas les contraintes (2-100 chars)
export class InvalidDisplayNameError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidDisplayNameError';
  }
}
