// Modele domaine pour les sessions d'authentification

// Representation complete d'une session en base
export interface Session {
  id: string;
  userId: string;
  refreshTokenHash: string; // Hash du refresh token (jamais stocke en clair)
  expiresAt: Date;
  revokedAt: Date | null; // null = session active, date = session revoquee
  createdAt: Date;
  userAgent?: string;
  ip?: string;
}

// Donnees necessaires pour creer une nouvelle session
export interface CreateSessionData {
  userId: string;
  refreshTokenHash: string;
  expiresAt: Date;
  userAgent?: string;
  ip?: string;
}
