import {
  createParamDecorator,
  ExecutionContext,
  SetMetadata,
} from '@nestjs/common';
import { AuthUser, IS_PUBLIC_KEY, ROLES_KEY } from './rbac.constants';

/** Marks a route as reachable without authentication. */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

/** Restricts a route to the listed roles (RolesGuard enforces). */
export const Roles = (...roles: AuthUser['role'][]) => SetMetadata(ROLES_KEY, roles);

/** Injects the authenticated user (or a field of it) into a handler param. */
export const CurrentUser = createParamDecorator(
  (field: keyof AuthUser | undefined, ctx: ExecutionContext) => {
    const req = ctx.switchToHttp().getRequest<{ user?: AuthUser }>();
    const user = req.user;
    return field && user ? user[field] : user;
  },
);
