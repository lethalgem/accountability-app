import { describe, it, expect, beforeEach } from 'vitest';
import { setupDb, api, registerUser, registerBothUsers } from './helpers';

describe('Auth', () => {
  beforeEach(async () => {
    await setupDb();
  });

  it('registers first user and returns a valid token', async () => {
    const res = await api('POST', '/auth/register', undefined, {
      name: 'Alice',
      email: 'alice@test.com',
      password: 'password123',
    });
    expect(res.success).toBe(true);
    expect(res.data.token).toBeTruthy();
    expect(res.data.user.name).toBe('Alice');
    expect(res.data.user.email).toBe('alice@test.com');
    expect(res.data.user.id).toBe(1);
  });

  it('registers second user', async () => {
    await registerUser('Alice', 'alice@test.com');
    const res = await api('POST', '/auth/register', undefined, {
      name: 'Bob',
      email: 'bob@test.com',
      password: 'password123',
    });
    expect(res.success).toBe(true);
    expect(res.data.user.name).toBe('Bob');
    expect(res.data.user.id).toBe(2);
  });

  it('rejects third registration (two-user limit)', async () => {
    await registerBothUsers();
    const res = await api('POST', '/auth/register', undefined, {
      name: 'Charlie',
      email: 'charlie@test.com',
      password: 'password123',
    });
    expect(res.success).toBe(false);
    expect(res.error).toMatch(/two users/i);
  });

  it('logs in with correct credentials', async () => {
    await registerUser('Alice', 'alice@test.com', 'mypassword');
    const res = await api('POST', '/auth/login', undefined, {
      email: 'alice@test.com',
      password: 'mypassword',
    });
    expect(res.success).toBe(true);
    expect(res.data.token).toBeTruthy();
    expect(res.data.user.email).toBe('alice@test.com');
  });

  it('rejects login with wrong password', async () => {
    await registerUser('Alice', 'alice@test.com', 'mypassword');
    const res = await api('POST', '/auth/login', undefined, {
      email: 'alice@test.com',
      password: 'wrongpassword',
    });
    expect(res.success).toBe(false);
    expect(res.error).toMatch(/invalid/i);
  });

  it('rejects login with nonexistent email', async () => {
    const res = await api('POST', '/auth/login', undefined, {
      email: 'nobody@test.com',
      password: 'password123',
    });
    expect(res.success).toBe(false);
    expect(res.error).toMatch(/invalid/i);
  });

  it('GET /me returns user info with valid token', async () => {
    const { token, user } = await registerUser('Alice', 'alice@test.com');
    const res = await api('GET', '/auth/me', token);
    expect(res.success).toBe(true);
    expect(res.data.id).toBe(user.id);
    expect(res.data.name).toBe('Alice');
  });

  it('GET /me returns 401 without token', async () => {
    const res = await api('GET', '/auth/me');
    expect(res.success).toBe(false);
    expect(res.error).toMatch(/unauthorized/i);
  });

  it('rejects registration with short password', async () => {
    const res = await api('POST', '/auth/register', undefined, {
      name: 'Alice',
      email: 'alice@test.com',
      password: '12345',
    });
    expect(res.success).toBe(false);
    expect(res.error).toMatch(/6 characters/i);
  });

  it('rejects registration with duplicate email', async () => {
    await registerUser('Alice', 'alice@test.com');
    const res = await api('POST', '/auth/register', undefined, {
      name: 'Alice 2',
      email: 'alice@test.com',
      password: 'password123',
    });
    expect(res.success).toBe(false);
    expect(res.error).toMatch(/already registered/i);
  });
});
