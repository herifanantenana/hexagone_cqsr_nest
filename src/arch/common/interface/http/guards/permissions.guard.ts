// Guard global qui vérifie les permissions déclarées par @Can(resource, action)
// Lit le metadata posé par le décorateur et compare avec les permissions du UserPrincipal
// Si aucun @Can n'est posé → laisse passer (pas de restriction)
// Si @Can est posé et pas d'utilisateur → 401 (sauf si OptionalAuthGuard est utilisé)
import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Permission, UserPrincipal } from '@shared/types/user-principal.type';
import { Request } from 'express';
import {
  REQUIRED_PERMISSION_KEY,
  RequiredPermission,
} from '../decorators/can.decorator';

// Clé posée par OptionalAuthGuard pour signaler que l'absence de token est acceptable
export const OPTIONAL_AUTH_KEY = 'isOptionalAuth';

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

    if (!user) {
      // Vérifie si OptionalAuthGuard a posé un flag sur la requête
      const isOptional = (request as unknown as Record<string, unknown>)[
        OPTIONAL_AUTH_KEY
      ];

      if (isOptional) {
        // Route avec OptionalAuth : on laisse passer, le domain gère la visibilité
        return true;
      }

      // @Can est posé mais pas de token → 401 Unauthorized
      throw new UnauthorizedException(
        'Authentication required to access this resource',
      );
    }

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
