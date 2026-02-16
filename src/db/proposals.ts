import type { Proposal, ProposalStatus } from '../types';

export class ProposalRepository {
  constructor(private db: D1Database) {}

  async findById(id: number): Promise<Proposal | null> {
    return this.db.prepare('SELECT * FROM proposals WHERE id = ?').bind(id).first<Proposal>();
  }

  async findByUser(userId: number, status?: string): Promise<Proposal[]> {
    let query = 'SELECT * FROM proposals WHERE (created_by = ? OR assigned_to = ?)';
    const binds: (number | string)[] = [userId, userId];

    if (status) {
      const statuses = status.split(',').map(s => s.trim());
      const placeholders = statuses.map(() => '?').join(',');
      query += ` AND status IN (${placeholders})`;
      binds.push(...statuses);
    }

    query += ' ORDER BY created_at DESC';
    const result = await this.db.prepare(query).bind(...binds).all<Proposal>();
    return result.results;
  }

  async findPendingForUser(userId: number): Promise<Proposal[]> {
    const result = await this.db
      .prepare('SELECT * FROM proposals WHERE assigned_to = ? AND status = ? ORDER BY created_at DESC')
      .bind(userId, 'pending')
      .all<Proposal>();
    return result.results;
  }

  async findActiveForUser(userId: number): Promise<Proposal[]> {
    const result = await this.db
      .prepare(
        'SELECT * FROM proposals WHERE (created_by = ? OR assigned_to = ?) AND status = ? ORDER BY deadline ASC'
      )
      .bind(userId, userId, 'accepted')
      .all<Proposal>();
    return result.results;
  }

  async create(data: {
    created_by: number;
    assigned_to: number;
    title: string;
    description?: string;
    deadline: number;
    penalty_amount: number;
  }): Promise<Proposal> {
    const result = await this.db
      .prepare(
        'INSERT INTO proposals (created_by, assigned_to, title, description, deadline, penalty_amount) VALUES (?, ?, ?, ?, ?, ?) RETURNING *'
      )
      .bind(
        data.created_by,
        data.assigned_to,
        data.title,
        data.description || null,
        data.deadline,
        data.penalty_amount
      )
      .first<Proposal>();
    return result!;
  }

  async updateStatus(id: number, status: ProposalStatus, extra?: Record<string, number | null>): Promise<Proposal> {
    let sets = 'status = ?';
    const binds: (string | number | null)[] = [status];

    if (extra) {
      for (const [key, value] of Object.entries(extra)) {
        sets += `, ${key} = ?`;
        binds.push(value);
      }
    }

    binds.push(id);
    const result = await this.db
      .prepare(`UPDATE proposals SET ${sets} WHERE id = ? RETURNING *`)
      .bind(...binds)
      .first<Proposal>();
    return result!;
  }

  async findOverdue(): Promise<Proposal[]> {
    const now = Math.floor(Date.now() / 1000);
    const result = await this.db
      .prepare('SELECT * FROM proposals WHERE status = ? AND deadline < ?')
      .bind('accepted', now)
      .all<Proposal>();
    return result.results;
  }
}
