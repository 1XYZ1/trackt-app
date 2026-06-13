import {
  createParamDecorator,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthUser } from '../../auth/types';

/**
 * Inyecta el tenantId del usuario autenticado (puesto en req.user por
 * AuthGuard). Reemplaza el patrón `tenantService.resolveTenantId(req.user)`
 * que se repetía en cada handler.
 */
export const TenantId = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string => {
    const req = ctx.switchToHttp().getRequest<{ user?: AuthUser }>();
    if (!req.user?.tenantId) {
      throw new UnauthorizedException('Usuario sin tenant asociado');
    }
    return req.user.tenantId;
  },
);
