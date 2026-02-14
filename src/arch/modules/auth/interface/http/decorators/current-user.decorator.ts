// Decorator custom : extrait l'utilisateur connecte depuis la requete HTTP
// Usage : @CurrentUser() user: UserPrincipal dans un controller
import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { UserPrincipal } from '@shared/types/user-principal.type';

export const CurrentUser = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): UserPrincipal => {
    const request = ctx.switchToHttp().getRequest<{ user: UserPrincipal }>();
    return request.user; // Injecte par Passport apres validation du guard
  },
);
