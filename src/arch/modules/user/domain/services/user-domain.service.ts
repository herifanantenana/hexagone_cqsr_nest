// Service domaine : contient les regles de validation metier du User

import {
  InvalidBioError,
  InvalidDisplayNameError,
} from '../errors/user-errors';

export class UserDomainService {
  // Valide le nom d'affichage (obligatoire, entre 2 et 100 caracteres)
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

  // Valide la bio (optionnelle, max 500 caracteres)
  validateBio(bio: string): void {
    if (bio && bio.length > 500) {
      throw new InvalidBioError('Bio cannot exceed 500 characters');
    }
  }

  // Valide le type et la taille du fichier avatar
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
