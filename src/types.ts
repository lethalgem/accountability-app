export interface Env {
  DB: D1Database;
  JWT_SECRET: string;
  RESEND_API_KEY: string;
  FRONTEND_URL: string;
  ASSETS?: Fetcher;
}

export interface User {
  id: number;
  email: string;
  name: string;
  password_hash: string;
  created_at: number;
}

export interface Proposal {
  id: number;
  created_by: number;
  assigned_to: number;
  title: string;
  description: string | null;
  deadline: number;
  penalty_amount: number;
  status: ProposalStatus;
  created_at: number;
  accepted_at: number | null;
  completed_at: number | null;
}

export type ProposalStatus = 'pending' | 'accepted' | 'rejected' | 'completed' | 'failed' | 'verified';

export interface LedgerEntry {
  id: number;
  proposal_id: number;
  from_user: number;
  to_user: number;
  amount: number;
  reason: string;
  created_at: number;
}

export interface JwtPayload {
  sub: number;
  email: string;
  name: string;
  iat: number;
  exp: number;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}
