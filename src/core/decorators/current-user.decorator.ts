import { createParamDecorator, ExecutionContext } from '@nestjs/common';

/**
 * Custom decorator to extract the current user from the request.
 * Usage: @CurrentUser() user  → gives { userId, role }
 * Usage: @CurrentUser('userId') userId → gives just the userId string
 */
export const CurrentUser = createParamDecorator(
  (data: string | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    if (!data) return request.user;
    return request.user?.[data];
  },
);
