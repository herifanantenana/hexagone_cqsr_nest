// Guard d'authentification optionnelle : tente de valider le JWT Bearer
// Si le token est présent et valide → req.user est peuplé (UserPrincipal)
// Si absent ou invalide → req.user reste undefined et la requête continue
// Utilisé sur les routes publiques qui affichent du contenu différent selon le statut auth
// Exemple : GET /posts/:id → un post privé n'est visible que par son owner authentifié
import { ExecutionContext, Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Request } from 'express';
import { OPTIONAL_AUTH_KEY } from './permissions.guard';

@Injectable()
export class OptionalAuthGuard extends AuthGuard('jwt') {
  // Pose un flag sur la requête pour que PermissionsGuard sache qu'on est en mode optionnel
  canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<Request>();
    (request as unknown as Record<string, unknown>)[OPTIONAL_AUTH_KEY] = true;
    return super.canActivate(context);
  }

  // Override : au lieu de throw UnauthorizedException, retourne null
  handleRequest<TUser>(err: Error | null, user: TUser | false): TUser | null {
    if (err || !user) return null as unknown as TUser;
    return user;
  }
}
