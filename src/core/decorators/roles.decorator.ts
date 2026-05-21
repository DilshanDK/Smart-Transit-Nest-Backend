import { SetMetadata } from '@nestjs/common';

export const ROLES_KEY = 'roles';

/**
 * Decorator to set allowed roles on a route handler.
 * Usage: @Roles('passenger') or @Roles('driver', 'company')
 */
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);
