import type { LedgerEntry } from '../types';

export class LedgerRepository {
  constructor(private db: D1Database) {}

  async create(data: {
    proposal_id: number;
    from_user: number;
    to_user: number;
    amount: number;
    reason: string;
  }): Promise<LedgerEntry> {
    const result = await this.db
      .prepare(
        'INSERT INTO ledger (proposal_id, from_user, to_user, amount, reason) VALUES (?, ?, ?, ?, ?) RETURNING *'
      )
      .bind(data.proposal_id, data.from_user, data.to_user, data.amount, data.reason)
      .first<LedgerEntry>();
    return result!;
  }

  async findByUser(userId: number): Promise<LedgerEntry[]> {
    const result = await this.db
      .prepare(
        'SELECT * FROM ledger WHERE from_user = ? OR to_user = ? ORDER BY created_at DESC'
      )
      .bind(userId, userId)
      .all<LedgerEntry>();
    return result.results;
  }

  async getBalance(userId: number): Promise<number> {
    // Positive = user owes partner, negative = partner owes user
    const owed = await this.db
      .prepare('SELECT COALESCE(SUM(amount), 0) as total FROM ledger WHERE from_user = ?')
      .bind(userId)
      .first<{ total: number }>();
    const owedTo = await this.db
      .prepare('SELECT COALESCE(SUM(amount), 0) as total FROM ledger WHERE to_user = ?')
      .bind(userId)
      .first<{ total: number }>();
    return (owed?.total || 0) - (owedTo?.total || 0);
  }
}
