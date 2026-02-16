-- Users table
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- Proposals table
CREATE TABLE IF NOT EXISTS proposals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  created_by INTEGER NOT NULL,
  assigned_to INTEGER NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  deadline INTEGER NOT NULL,
  penalty_amount REAL NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK(status IN ('pending', 'accepted', 'rejected', 'completed', 'failed', 'verified')),
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  accepted_at INTEGER,
  completed_at INTEGER,
  FOREIGN KEY (created_by) REFERENCES users(id),
  FOREIGN KEY (assigned_to) REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS idx_proposals_created_by ON proposals(created_by);
CREATE INDEX IF NOT EXISTS idx_proposals_assigned_to ON proposals(assigned_to);
CREATE INDEX IF NOT EXISTS idx_proposals_status ON proposals(status);
CREATE INDEX IF NOT EXISTS idx_proposals_deadline ON proposals(deadline);

-- Ledger table
CREATE TABLE IF NOT EXISTS ledger (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  proposal_id INTEGER NOT NULL,
  from_user INTEGER NOT NULL,
  to_user INTEGER NOT NULL,
  amount REAL NOT NULL,
  reason TEXT NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  FOREIGN KEY (proposal_id) REFERENCES proposals(id),
  FOREIGN KEY (from_user) REFERENCES users(id),
  FOREIGN KEY (to_user) REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS idx_ledger_from_user ON ledger(from_user);
CREATE INDEX IF NOT EXISTS idx_ledger_to_user ON ledger(to_user);
