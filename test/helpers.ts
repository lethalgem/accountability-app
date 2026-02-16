import { env, SELF } from 'cloudflare:test';

export async function setupDb() {
  // Use prepare().run() instead of exec() to avoid D1 newline-splitting bug in test runtime
  await env.DB.prepare('DROP TABLE IF EXISTS ledger').run();
  await env.DB.prepare('DROP TABLE IF EXISTS proposals').run();
  await env.DB.prepare('DROP TABLE IF EXISTS users').run();

  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY AUTOINCREMENT, email TEXT NOT NULL UNIQUE, name TEXT NOT NULL, password_hash TEXT NOT NULL, created_at INTEGER NOT NULL DEFAULT (unixepoch()))`).run();

  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS proposals (id INTEGER PRIMARY KEY AUTOINCREMENT, created_by INTEGER NOT NULL, assigned_to INTEGER NOT NULL, title TEXT NOT NULL, description TEXT, deadline INTEGER NOT NULL, penalty_amount REAL NOT NULL DEFAULT 0, status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','accepted','rejected','completed','failed','verified')), created_at INTEGER NOT NULL DEFAULT (unixepoch()), accepted_at INTEGER, completed_at INTEGER, FOREIGN KEY (created_by) REFERENCES users(id), FOREIGN KEY (assigned_to) REFERENCES users(id))`).run();

  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS ledger (id INTEGER PRIMARY KEY AUTOINCREMENT, proposal_id INTEGER NOT NULL, from_user INTEGER NOT NULL, to_user INTEGER NOT NULL, amount REAL NOT NULL, reason TEXT NOT NULL, created_at INTEGER NOT NULL DEFAULT (unixepoch()), FOREIGN KEY (proposal_id) REFERENCES proposals(id), FOREIGN KEY (from_user) REFERENCES users(id), FOREIGN KEY (to_user) REFERENCES users(id))`).run();
}

export async function api(
  method: string,
  path: string,
  token?: string,
  body?: Record<string, unknown>
) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await SELF.fetch(`https://test.local/api${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  return res.json() as Promise<any>;
}

export async function registerUser(name: string, email: string, password = 'password123') {
  const res = await api('POST', '/auth/register', undefined, { name, email, password });
  return res.data as { token: string; user: { id: number; email: string; name: string } };
}

export async function registerBothUsers() {
  const u1 = await registerUser('Alice', 'alice@test.com');
  const u2 = await registerUser('Bob', 'bob@test.com');
  return {
    user1: u1.user,
    user1Token: u1.token,
    user2: u2.user,
    user2Token: u2.token,
  };
}

export async function createProposal(
  token: string,
  overrides: Record<string, unknown> = {}
) {
  const defaults = {
    title: 'Test task',
    description: 'A test task',
    deadline: futureDeadline(72),
    penalty_amount: 10,
  };
  const res = await api('POST', '/proposals', token, { ...defaults, ...overrides });
  return res.data.proposal;
}

export function futureDeadline(hours: number) {
  return new Date(Date.now() + hours * 3600 * 1000).toISOString();
}

export function pastDeadline(hours: number) {
  return new Date(Date.now() - hours * 3600 * 1000).toISOString();
}
