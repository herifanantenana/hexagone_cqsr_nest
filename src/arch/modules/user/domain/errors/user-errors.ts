export class UserNotFoundError extends Error {
  constructor(identifier: string) {
    super(`User not found: ${identifier}`);
    this.name = 'UserNotFoundError';
  }
}

export class InvalidEmailError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidEmailError';
  }
}

export class InvalidDisplayNameError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidDisplayNameError';
  }
}

export class InvalidBioError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidBioError';
  }
}

export class InvalidFileTypeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidFileTypeError';
  }
}

export class FileSizeLimitExceededError extends Error {
  constructor(maxSize: number) {
    super(`File size exceeds limit of ${maxSize} bytes`);
    this.name = 'FileSizeLimitExceededError';
  }
}
