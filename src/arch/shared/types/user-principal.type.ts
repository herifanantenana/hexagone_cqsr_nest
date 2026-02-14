// Représente l'utilisateur authentifié extrait du JWT (stocké dans req.user)
export interface UserPrincipal {
  userId: string;
  email: string;
  status: string;
}
