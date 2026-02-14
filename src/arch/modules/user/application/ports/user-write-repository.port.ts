// Port d'ecriture (write) pour les utilisateurs
// Manipule le modele domaine User pour les operations de mutation

import { User } from '../../domain/models/user.model';

// Donnees necessaires a la creation d'un utilisateur
export interface CreateUserData {
  id: string;
  email: string;
  passwordHash: string;
  displayName: string;
  status: string;
}

// Classe abstraite servant de contrat d'injection pour NestJS
export abstract class UserWriteRepositoryPort {
  abstract create(data: CreateUserData): Promise<void>;
  abstract update(user: User): Promise<void>;
  abstract findById(userId: string): Promise<User | null>;
  abstract findByEmail(email: string): Promise<User | null>;
}
