export class InvalidCredentialsError extends Error {
  constructor() {
    super('Invalid email or password');
    this.name = 'InvalidCredentialsError';
  }
}

export class EmailAlreadyUsedError extends Error {
  constructor(email: string) {
    super(`Email ${email} is already registered`);
    this.name = 'EmailAlreadyUsedError';
  }
}

export class InvalidTokenError extends Error {
  constructor(message?: string) {
    super(message || 'Invalid or expired token');
    this.name = 'InvalidTokenError';
  }
}

export class SessionNotFoundError extends Error {
  constructor() {
    super('Session not found or expired');
    this.name = 'SessionNotFoundError';
  }
}

export class SessionRevokedError extends Error {
  constructor() {
    super('Session has been revoked');
    this.name = 'SessionRevokedError';
  }
}

export class InvalidPasswordError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidPasswordError';
  }
}

export class UserDisabledError extends Error {
  constructor() {
    super('User account is disabled');
    this.name = 'UserDisabledError';
  }
}
