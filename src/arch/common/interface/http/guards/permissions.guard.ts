// Guard global qui vérifie les permissions déclarées par @Can(resource, action)
// Lit le metadata posé par le décorateur et compare avec les permissions du UserPrincipal
// Si aucun @Can n'est posé → laisse passer (pas de restriction)
// Si pas d'utilisateur (route publique / OptionalAuth) → laisse passer aussi
import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Permission, UserPrincipal } from '@shared/types/user-principal.type';
import { Request } from 'express';
import {
  REQUIRED_PERMISSION_KEY,
  RequiredPermission,
} from '../decorators/can.decorator';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    // Récupère le metadata @Can() sur le handler ou la classe
    const required = this.reflector.getAllAndOverride<RequiredPermission>(
      REQUIRED_PERMISSION_KEY,
      [context.getHandler(), context.getClass()],
    );

    // Pas de @Can() → pas de restriction de permission
    if (!required) return true;

    const request = context.switchToHttp().getRequest<Request>();
    const user = (request as Request & { user?: UserPrincipal }).user;

    // Pas d'utilisateur (OptionalAuth, route publique) → on laisse passer
    // C'est au controller/domain de gérer la visibilité (ex: post privé)
    if (!user) return true;

    // Vérifie que le principal porte la permission requise
    const hasPermission =
      Array.isArray(user.permissions) &&
      user.permissions.some(
        (p: Permission) =>
          p.resource === required.resource &&
          p.actions.includes(required.action),
      );

    if (!hasPermission) {
      throw new ForbiddenException(
        `Missing permission: ${required.resource}:${required.action}`,
      );
    }

    return true;
  }
}
