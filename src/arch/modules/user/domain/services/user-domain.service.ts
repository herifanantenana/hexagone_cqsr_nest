import {
  InvalidBioError,
  InvalidDisplayNameError,
} from '../errors/user-errors';

export class UserDomainService {
  validateDisplayName(displayName: string): void {
    if (!displayName || displayName.trim().length === 0) {
      throw new InvalidDisplayNameError('Display name is required');
    }

    if (displayName.length < 2) {
      throw new InvalidDisplayNameError(
        'Display name must be at least 2 characters long',
      );
    }

    if (displayName.length > 100) {
      throw new InvalidDisplayNameError(
        'Display name cannot exceed 100 characters',
      );
    }
  }

  validateBio(bio: string): void {
    if (bio && bio.length > 500) {
      throw new InvalidBioError('Bio cannot exceed 500 characters');
    }
  }

  validateAvatarFile(mimetype: string, size: number): void {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(mimetype)) {
      throw new Error(
        'Invalid file type. Only JPEG, PNG, and WebP are allowed',
      );
    }

    const maxSize = 2 * 1024 * 1024; // 2MB
    if (size > maxSize) {
      throw new Error('File size exceeds 2MB limit');
    }
  }
}
