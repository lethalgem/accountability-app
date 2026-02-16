import { Hono } from 'hono';
import type { Env, JwtPayload } from '../types';
import { ProposalRepository } from '../db/proposals';
import { LedgerRepository } from '../db/ledger';
import { UserRepository } from '../db/users';
import { authMiddleware } from '../middleware/auth';
import { EmailService } from '../services/email';

type ProposalEnv = {
  Bindings: Env;
  Variables: { user: JwtPayload };
};

const proposals = new Hono<ProposalEnv>();

proposals.use('/*', authMiddleware);

// List proposals for the authenticated user (also auto-fails overdue tasks)
proposals.get('/', async (c) => {
  const user = c.get('user');
  const status = c.req.query('status');
  const repo = new ProposalRepository(c.env.DB);

  // Lazy deadline enforcement: auto-fail overdue accepted proposals
  const overdue = await repo.findOverdue();
  if (overdue.length > 0) {
    const ledgerRepo = new LedgerRepository(c.env.DB);
    for (const p of overdue) {
      await repo.updateStatus(p.id, 'failed');
      await ledgerRepo.create({
        proposal_id: p.id,
        from_user: p.assigned_to,
        to_user: p.created_by,
        amount: p.penalty_amount,
        reason: `Overdue: ${p.title}`,
      });
    }
  }

  const items = await repo.findByUser(user.sub, status || undefined);
  return c.json({ success: true, data: { proposals: items } });
});

// Create a new proposal
proposals.post('/', async (c) => {
  const user = c.get('user');
  const { title, description, deadline, penalty_amount } = await c.req.json<{
    title: string;
    description?: string;
    deadline: string;
    penalty_amount: number;
  }>();

  if (!title || !deadline || penalty_amount == null) {
    return c.json({ success: false, error: 'Title, deadline, and penalty amount are required' }, 400);
  }

  const deadlineTs = Math.floor(new Date(deadline).getTime() / 1000);
  if (isNaN(deadlineTs) || deadlineTs <= Math.floor(Date.now() / 1000)) {
    return c.json({ success: false, error: 'Deadline must be a valid future date' }, 400);
  }

  if (penalty_amount < 0) {
    return c.json({ success: false, error: 'Penalty amount must be non-negative' }, 400);
  }

  const users = new UserRepository(c.env.DB);
  const partner = await users.getPartner(user.sub);
  if (!partner) {
    return c.json({ success: false, error: 'No partner found. Both users must be registered.' }, 400);
  }

  const repo = new ProposalRepository(c.env.DB);
  const proposal = await repo.create({
    created_by: user.sub,
    assigned_to: partner.id,
    title,
    description,
    deadline: deadlineTs,
    penalty_amount,
  });

  // Send email notification (non-blocking)
  const email = new EmailService(c.env.RESEND_API_KEY);
  c.executionCtx.waitUntil(
    email.sendProposalNotification(partner.email, user.name, title, penalty_amount)
  );

  return c.json({ success: true, data: { proposal } });
});

// Get proposal detail
proposals.get('/:id', async (c) => {
  const user = c.get('user');
  const id = parseInt(c.req.param('id'));
  const repo = new ProposalRepository(c.env.DB);
  const proposal = await repo.findById(id);

  if (!proposal || (proposal.created_by !== user.sub && proposal.assigned_to !== user.sub)) {
    return c.json({ success: false, error: 'Proposal not found' }, 404);
  }

  const users = new UserRepository(c.env.DB);
  const creator = await users.findById(proposal.created_by);
  const assignee = await users.findById(proposal.assigned_to);

  return c.json({
    success: true,
    data: {
      proposal,
      creator: creator ? { id: creator.id, name: creator.name, email: creator.email } : null,
      assignee: assignee ? { id: assignee.id, name: assignee.name, email: assignee.email } : null,
    },
  });
});

// Accept a pending proposal
proposals.post('/:id/accept', async (c) => {
  const user = c.get('user');
  const id = parseInt(c.req.param('id'));
  const repo = new ProposalRepository(c.env.DB);
  const proposal = await repo.findById(id);

  if (!proposal || proposal.assigned_to !== user.sub) {
    return c.json({ success: false, error: 'Proposal not found' }, 404);
  }
  if (proposal.status !== 'pending') {
    return c.json({ success: false, error: 'Proposal is not pending' }, 400);
  }

  const now = Math.floor(Date.now() / 1000);
  const updated = await repo.updateStatus(id, 'accepted', { accepted_at: now });

  const users = new UserRepository(c.env.DB);
  const creator = await users.findById(proposal.created_by);
  if (creator) {
    const email = new EmailService(c.env.RESEND_API_KEY);
    c.executionCtx.waitUntil(
      email.sendStatusNotification(creator.email, user.name, proposal.title, 'accepted')
    );
  }

  return c.json({ success: true, data: { proposal: updated } });
});

// Reject a pending proposal
proposals.post('/:id/reject', async (c) => {
  const user = c.get('user');
  const id = parseInt(c.req.param('id'));
  const repo = new ProposalRepository(c.env.DB);
  const proposal = await repo.findById(id);

  if (!proposal || proposal.assigned_to !== user.sub) {
    return c.json({ success: false, error: 'Proposal not found' }, 404);
  }
  if (proposal.status !== 'pending') {
    return c.json({ success: false, error: 'Proposal is not pending' }, 400);
  }

  const updated = await repo.updateStatus(id, 'rejected');

  const users = new UserRepository(c.env.DB);
  const creator = await users.findById(proposal.created_by);
  if (creator) {
    const email = new EmailService(c.env.RESEND_API_KEY);
    c.executionCtx.waitUntil(
      email.sendStatusNotification(creator.email, user.name, proposal.title, 'rejected')
    );
  }

  return c.json({ success: true, data: { proposal: updated } });
});

// Mark a proposal as completed (assignee claims they did it)
proposals.post('/:id/complete', async (c) => {
  const user = c.get('user');
  const id = parseInt(c.req.param('id'));
  const repo = new ProposalRepository(c.env.DB);
  const proposal = await repo.findById(id);

  if (!proposal || proposal.assigned_to !== user.sub) {
    return c.json({ success: false, error: 'Proposal not found' }, 404);
  }
  if (proposal.status !== 'accepted') {
    return c.json({ success: false, error: 'Proposal must be accepted first' }, 400);
  }

  const now = Math.floor(Date.now() / 1000);
  const updated = await repo.updateStatus(id, 'completed', { completed_at: now });

  const users = new UserRepository(c.env.DB);
  const creator = await users.findById(proposal.created_by);
  if (creator) {
    const email = new EmailService(c.env.RESEND_API_KEY);
    c.executionCtx.waitUntil(
      email.sendCompletionNotification(creator.email, user.name, proposal.title)
    );
  }

  return c.json({ success: true, data: { proposal: updated } });
});

// Verify completion (creator confirms assignee completed it)
proposals.post('/:id/verify', async (c) => {
  const user = c.get('user');
  const id = parseInt(c.req.param('id'));
  const repo = new ProposalRepository(c.env.DB);
  const proposal = await repo.findById(id);

  if (!proposal || proposal.created_by !== user.sub) {
    return c.json({ success: false, error: 'Proposal not found' }, 404);
  }
  if (proposal.status !== 'completed') {
    return c.json({ success: false, error: 'Proposal must be marked complete first' }, 400);
  }

  const updated = await repo.updateStatus(id, 'verified');
  return c.json({ success: true, data: { proposal: updated } });
});

// Mark as failed (creator says assignee didn't do it, or deadline passed)
proposals.post('/:id/fail', async (c) => {
  const user = c.get('user');
  const id = parseInt(c.req.param('id'));
  const repo = new ProposalRepository(c.env.DB);
  const proposal = await repo.findById(id);

  if (!proposal || proposal.created_by !== user.sub) {
    return c.json({ success: false, error: 'Proposal not found' }, 404);
  }
  if (proposal.status !== 'accepted' && proposal.status !== 'completed') {
    return c.json({ success: false, error: 'Can only fail accepted or completed proposals' }, 400);
  }

  const updated = await repo.updateStatus(id, 'failed');

  // Create ledger entry: assignee owes creator
  const ledgerRepo = new LedgerRepository(c.env.DB);
  const entry = await ledgerRepo.create({
    proposal_id: id,
    from_user: proposal.assigned_to,
    to_user: proposal.created_by,
    amount: proposal.penalty_amount,
    reason: `Failed: ${proposal.title}`,
  });

  // Notify both users
  const users = new UserRepository(c.env.DB);
  const assignee = await users.findById(proposal.assigned_to);
  if (assignee) {
    const email = new EmailService(c.env.RESEND_API_KEY);
    c.executionCtx.waitUntil(
      email.sendFailureNotification(assignee.email, proposal.title, proposal.penalty_amount)
    );
  }

  return c.json({ success: true, data: { proposal: updated, ledger_entry: entry } });
});

// Override a failed proposal (creator acknowledges it was actually completed)
proposals.post('/:id/override', async (c) => {
  const user = c.get('user');
  const id = parseInt(c.req.param('id'));
  const repo = new ProposalRepository(c.env.DB);
  const proposal = await repo.findById(id);

  if (!proposal || proposal.created_by !== user.sub) {
    return c.json({ success: false, error: 'Proposal not found' }, 404);
  }
  if (proposal.status !== 'failed') {
    return c.json({ success: false, error: 'Can only override failed proposals' }, 400);
  }

  const updated = await repo.updateStatus(id, 'verified');

  // Reverse the penalty with a counter ledger entry
  const ledgerRepo = new LedgerRepository(c.env.DB);
  const entry = await ledgerRepo.create({
    proposal_id: id,
    from_user: proposal.created_by,
    to_user: proposal.assigned_to,
    amount: proposal.penalty_amount,
    reason: `Override: ${proposal.title}`,
  });

  return c.json({ success: true, data: { proposal: updated, ledger_entry: entry } });
});

export default proposals;
