// Service domaine auth : contient les regles de validation metier (mot de passe, nom)
import { InvalidPasswordError } from '../errors';

export class AuthDomainService {
  // Verifie les regles de complexite du mot de passe
  validatePassword(password: string): void {
    if (password.length < 8) {
      throw new InvalidPasswordError(
        'Password must be at least 8 characters long',
      );
    }

    // Au moins une majuscule
    if (!/[A-Z]/.test(password)) {
      throw new InvalidPasswordError(
        'Password must contain at least one uppercase letter',
      );
    }

    // Au moins une minuscule
    if (!/[a-z]/.test(password)) {
      throw new InvalidPasswordError(
        'Password must contain at least one lowercase letter',
      );
    }

    // Au moins un chiffre
    if (!/[0-9]/.test(password)) {
      throw new InvalidPasswordError(
        'Password must contain at least one number',
      );
    }
  }

  // Verifie les contraintes sur le nom d'affichage (longueur min/max)
  validateDisplayName(displayName: string): void {
    if (!displayName || displayName.trim().length === 0) {
      throw new Error('Display name is required');
    }

    if (displayName.length < 2) {
      throw new Error('Display name must be at least 2 characters long');
    }

    if (displayName.length > 100) {
      throw new Error('Display name cannot exceed 100 characters');
    }
  }
}
