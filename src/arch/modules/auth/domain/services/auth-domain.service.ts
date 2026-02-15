// Service domaine auth : règles de validation métier (mot de passe, nom d'affichage)
// Pur domaine — aucun import NestJS/Drizzle/Express
import { InvalidDisplayNameError, InvalidPasswordError } from '../errors';

export class AuthDomainService {
  // Vérifie les règles de complexité du mot de passe (8+ chars, majuscule, minuscule, chiffre)
  validatePassword(password: string): void {
    if (password.length < 8) {
      throw new InvalidPasswordError(
        'Password must be at least 8 characters long',
      );
    }
    if (!/[A-Z]/.test(password)) {
      throw new InvalidPasswordError(
        'Password must contain at least one uppercase letter',
      );
    }
    if (!/[a-z]/.test(password)) {
      throw new InvalidPasswordError(
        'Password must contain at least one lowercase letter',
      );
    }
    if (!/[0-9]/.test(password)) {
      throw new InvalidPasswordError(
        'Password must contain at least one number',
      );
    }
  }

  // Vérifie les contraintes sur le nom d'affichage (obligatoire, 2-100 caractères)
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
}
