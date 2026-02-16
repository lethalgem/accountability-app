import type { User } from '../types';

export class UserRepository {
  constructor(private db: D1Database) {}

  async findById(id: number): Promise<User | null> {
    return this.db.prepare('SELECT * FROM users WHERE id = ?').bind(id).first<User>();
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.db.prepare('SELECT * FROM users WHERE email = ?').bind(email).first<User>();
  }

  async create(email: string, name: string, passwordHash: string): Promise<User> {
    const result = await this.db
      .prepare('INSERT INTO users (email, name, password_hash) VALUES (?, ?, ?) RETURNING *')
      .bind(email, name, passwordHash)
      .first<User>();
    return result!;
  }

  async getPartner(userId: number): Promise<User | null> {
    return this.db.prepare('SELECT * FROM users WHERE id != ? LIMIT 1').bind(userId).first<User>();
  }

  async count(): Promise<number> {
    const result = await this.db.prepare('SELECT COUNT(*) as cnt FROM users').first<{ cnt: number }>();
    return result?.cnt || 0;
  }
}
