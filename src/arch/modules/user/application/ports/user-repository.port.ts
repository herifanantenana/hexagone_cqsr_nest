// Port de lecture (read) pour les profils utilisateur
// Utilise des snapshots (projections plates) au lieu du modele domaine

// Snapshot complet du profil (pour l'utilisateur connecte)
export interface UserProfileSnapshot {
  id: string;
  email: string;
  displayName: string;
  bio?: string;
  avatarUrl?: string;
  status: string;
  createdAt: Date;
  updatedAt: Date;
}

// Snapshot public (sans email ni statut)
export interface PublicUserProfileSnapshot {
  id: string;
  displayName: string;
  bio?: string;
  avatarUrl?: string;
  createdAt: Date;
}

// Classe abstraite servant de contrat d'injection pour NestJS
export abstract class UserRepositoryPort {
  abstract findMyProfile(userId: string): Promise<UserProfileSnapshot | null>;
  abstract findPublicProfile(
    userId: string,
  ): Promise<PublicUserProfileSnapshot | null>;
}
