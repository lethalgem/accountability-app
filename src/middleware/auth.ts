import { createMiddleware } from 'hono/factory';
import type { Env, JwtPayload } from '../types';
import { verifyJwt } from '../auth/jwt';

type AuthEnv = {
  Bindings: Env;
  Variables: { user: JwtPayload };
};

export const authMiddleware = createMiddleware<AuthEnv>(async (c, next) => {
  const authHeader = c.req.header('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return c.json({ success: false, error: 'Unauthorized' }, 401);
  }

  const token = authHeader.slice(7);
  const payload = await verifyJwt(token, c.env.JWT_SECRET);
  if (!payload) {
    return c.json({ success: false, error: 'Invalid or expired token' }, 401);
  }

  c.set('user', payload);
  await next();
});
