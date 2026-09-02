import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '@prisma/client';
import { ForbiddenError } from '../errors/domain-errors';
import { AuthUser, IS_PUBLIC_KEY, PERMS_KEY, ROLES_KEY } from './rbac.constants';
import { Permission, roleHasPermission } from './permissions';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const req = context.switchToHttp().getRequest<{ user?: AuthUser }>();
    const user = req.user;

    const requiredRoles = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (requiredRoles?.length) {
      if (!user || (user.role !== 'SUPER_ADMIN' && !requiredRoles.includes(user.role))) {
        throw new ForbiddenError('Insufficient role for this operation');
      }
    }

    const requiredPerms = this.reflector.getAllAndOverride<Permission[]>(PERMS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (requiredPerms?.length) {
      if (!user || !requiredPerms.every((p) => roleHasPermission(user.role, p))) {
        throw new ForbiddenError(`Missing permission: ${requiredPerms.join(', ')}`);
      }
    }

    return true;
  }
}
