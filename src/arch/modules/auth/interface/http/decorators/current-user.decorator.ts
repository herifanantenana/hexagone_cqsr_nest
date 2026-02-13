import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { UserPrincipal } from '@shared/types/user-principal.type';

export const CurrentUser = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): UserPrincipal => {
    const request = ctx.switchToHttp().getRequest();
    return request.user;
  },
);
