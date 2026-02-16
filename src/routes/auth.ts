import { Hono } from 'hono';
import type { Env, JwtPayload } from '../types';
import { UserRepository } from '../db/users';
import { hashPassword, verifyPassword } from '../auth/password';
import { signJwt } from '../auth/jwt';
import { authMiddleware } from '../middleware/auth';

type AuthEnv = {
  Bindings: Env;
  Variables: { user: JwtPayload };
};

const auth = new Hono<AuthEnv>();

auth.post('/register', async (c) => {
  const { email, name, password } = await c.req.json<{
    email: string;
    name: string;
    password: string;
  }>();

  if (!email || !name || !password) {
    return c.json({ success: false, error: 'Email, name, and password are required' }, 400);
  }

  if (password.length < 6) {
    return c.json({ success: false, error: 'Password must be at least 6 characters' }, 400);
  }

  const users = new UserRepository(c.env.DB);

  const count = await users.count();
  if (count >= 2) {
    return c.json({ success: false, error: 'Registration is closed. This app supports only two users.' }, 403);
  }

  const existing = await users.findByEmail(email);
  if (existing) {
    return c.json({ success: false, error: 'Email already registered' }, 409);
  }

  const passwordHash = await hashPassword(password);
  const user = await users.create(email, name, passwordHash);
  const token = await signJwt(
    { sub: user.id, email: user.email, name: user.name },
    c.env.JWT_SECRET
  );

  return c.json({
    success: true,
    data: {
      token,
      user: { id: user.id, email: user.email, name: user.name },
    },
  });
});

auth.post('/login', async (c) => {
  const { email, password } = await c.req.json<{
    email: string;
    password: string;
  }>();

  if (!email || !password) {
    return c.json({ success: false, error: 'Email and password are required' }, 400);
  }

  const users = new UserRepository(c.env.DB);
  const user = await users.findByEmail(email);
  if (!user) {
    return c.json({ success: false, error: 'Invalid email or password' }, 401);
  }

  const valid = await verifyPassword(password, user.password_hash);
  if (!valid) {
    return c.json({ success: false, error: 'Invalid email or password' }, 401);
  }

  const token = await signJwt(
    { sub: user.id, email: user.email, name: user.name },
    c.env.JWT_SECRET
  );

  return c.json({
    success: true,
    data: {
      token,
      user: { id: user.id, email: user.email, name: user.name },
    },
  });
});

auth.get('/me', authMiddleware, (c) => {
  const user = c.get('user');
  return c.json({
    success: true,
    data: { id: user.sub, email: user.email, name: user.name },
  });
});

export default auth;
