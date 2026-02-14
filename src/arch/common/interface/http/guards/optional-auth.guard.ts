// Guard d'authentification optionnelle : tente de valider le JWT Bearer
// Si le token est présent et valide → req.user est peuplé (UserPrincipal)
// Si absent ou invalide → req.user reste undefined et la requête continue
// Utilisé sur les routes publiques qui affichent du contenu différent selon le statut auth
// Exemple : GET /posts/:id → un post privé n'est visible que par son owner authentifié
import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class OptionalAuthGuard extends AuthGuard('jwt') {
  // Override : au lieu de throw UnauthorizedException, retourne null
  handleRequest<TUser>(err: Error | null, user: TUser | false): TUser | null {
    if (err || !user) return null as unknown as TUser;
    return user;
  }
}
