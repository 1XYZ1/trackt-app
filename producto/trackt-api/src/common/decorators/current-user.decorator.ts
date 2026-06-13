import {
  createParamDecorator,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthUser } from '../../auth/types';

/**
 * Inyecta el AuthUser autenticado (puesto en req.user por AuthGuard).
 * Para handlers que necesitan id/rol además del tenant.
 */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthUser => {
    const req = ctx.switchToHttp().getRequest<{ user?: AuthUser }>();
    if (!req.user) {
      throw new UnauthorizedException('Usuario no autenticado');
    }
    return req.user;
  },
);
