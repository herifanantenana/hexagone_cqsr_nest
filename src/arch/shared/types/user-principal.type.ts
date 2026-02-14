// Représente l'utilisateur authentifié extrait du JWT (stocké dans req.user)
// Porté par le guard Passport et propagé dans les controllers via @CurrentUser()

// Une permission lie une ressource (ex: "posts") à des actions autorisées
export interface Permission {
  resource: string;
  actions: string[];
}

export interface UserPrincipal {
  userId: string;
  email: string;
  status: string;
  // Permissions générées au moment de l'authentification (pas stockées en DB)
  // Utilisées par PermissionsGuard + @Can() pour filtrer l'accès aux endpoints
  permissions: Permission[];
}
