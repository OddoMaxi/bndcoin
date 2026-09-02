import { createParamDecorator, ExecutionContext, SetMetadata } from '@nestjs/common';
import { Role } from '@prisma/client';
import { AuthUser, IS_PUBLIC_KEY, PERMS_KEY, ROLES_KEY } from './rbac.constants';
import { Permission } from './permissions';

/** Marks a route as reachable without authentication. */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

/** Restricts a route to the listed roles. */
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);

/** Restricts a route to holders of ALL listed permissions (SUPER_ADMIN bypasses). */
export const RequirePermission = (...perms: Permission[]) => SetMetadata(PERMS_KEY, perms);

/** Injects the authenticated user (or a field of it) into a handler param. */
export const CurrentUser = createParamDecorator(
  (field: keyof AuthUser | undefined, ctx: ExecutionContext) => {
    const req = ctx.switchToHttp().getRequest<{ user?: AuthUser }>();
    const user = req.user;
    return field && user ? user[field] : user;
  },
);
