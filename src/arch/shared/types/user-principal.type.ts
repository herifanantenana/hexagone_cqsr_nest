// Represente l'utilisateur authentifie extrait du JWT (stocke dans req.user)
// Porte par le guard Passport et propage dans les controllers via @CurrentUser()

// Une permission lie une ressource (ex: "posts") a des actions autorisees
export interface Permission {
  resource: string;
  actions: string[];
}

export interface UserPrincipal {
  userId: string;
  email: string;
  status: string;
  // Permissions generees au moment de l'authentification (pas stockees en DB)
  // Utilisees par PermissionsGuard + @Can() pour filtrer l'acces aux endpoints
  permissions: Permission[];
}

// Permissions par defaut embarquees dans le JWT au login et au refresh
// Chaque module ajoute ses ressources ici → pas de DB call dans le guard
// Source unique (DRY) : utilisee par LoginCommand et RefreshTokenCommand
export const DEFAULT_PERMISSIONS: Permission[] = [
  { resource: 'posts', actions: ['create', 'read', 'update', 'delete'] },
  { resource: 'user', actions: ['read', 'update'] },
  { resource: 'conversations', actions: ['read', 'create'] },
  { resource: 'messages', actions: ['read', 'create'] },
];
