import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from './roles.decorator';
import { AuthUser, UserRole } from './types';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<UserRole[] | undefined>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    const req = context.switchToHttp().getRequest<{ user?: AuthUser }>();
    const user = req.user;

    // Fail-safe: aunque no se declaren @Roles, exigir usuario autenticado.
    // Evita acceso anonimo si el guard se montara sin AuthGuard delante.
    if (!user) {
      throw new ForbiddenException('No authenticated user');
    }

    if (!required || required.length === 0) {
      return true;
    }

    if (!required.includes(user.role)) {
      throw new ForbiddenException(
        `Role "${user.role}" not allowed. Required: ${required.join(', ')}`,
      );
    }

    return true;
  }
}
