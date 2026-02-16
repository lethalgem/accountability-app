import { describe, it, expect, beforeEach } from 'vitest';
import { setupDb, api, registerBothUsers, createProposal, futureDeadline, pastDeadline } from './helpers';

describe('Proposals', () => {
  let user1Token: string;
  let user2Token: string;
  let user1: { id: number; name: string };
  let user2: { id: number; name: string };

  beforeEach(async () => {
    await setupDb();
    const users = await registerBothUsers();
    user1Token = users.user1Token;
    user2Token = users.user2Token;
    user1 = users.user1;
    user2 = users.user2;
  });

  // ---- Creation & Assignment ----

  it('creates a proposal auto-assigned to partner', async () => {
    const proposal = await createProposal(user1Token);
    expect(proposal.status).toBe('pending');
    expect(proposal.created_by).toBe(user1.id);
    expect(proposal.assigned_to).toBe(user2.id);
    expect(proposal.title).toBe('Test task');
    expect(proposal.penalty_amount).toBe(10);
  });

  it('rejects proposal with past deadline', async () => {
    const res = await api('POST', '/proposals', user1Token, {
      title: 'Late task',
      deadline: pastDeadline(1),
      penalty_amount: 5,
    });
    expect(res.success).toBe(false);
    expect(res.error).toMatch(/future/i);
  });

  it('rejects proposal with negative penalty', async () => {
    const res = await api('POST', '/proposals', user1Token, {
      title: 'Bad penalty',
      deadline: futureDeadline(24),
      penalty_amount: -5,
    });
    expect(res.success).toBe(false);
    expect(res.error).toMatch(/non-negative/i);
  });

  it('filters proposals by status', async () => {
    await createProposal(user1Token, { title: 'Task A' });
    const p2 = await createProposal(user1Token, { title: 'Task B' });
    await api('POST', `/proposals/${p2.id}/accept`, user2Token);

    const pending = await api('GET', '/proposals?status=pending', user1Token);
    expect(pending.data.proposals.length).toBe(1);
    expect(pending.data.proposals[0].title).toBe('Task A');

    const accepted = await api('GET', '/proposals?status=accepted', user1Token);
    expect(accepted.data.proposals.length).toBe(1);
    expect(accepted.data.proposals[0].title).toBe('Task B');
  });

  // ---- State Transitions ----

  it('assignee accepts a pending proposal', async () => {
    const p = await createProposal(user1Token);
    const res = await api('POST', `/proposals/${p.id}/accept`, user2Token);
    expect(res.success).toBe(true);
    expect(res.data.proposal.status).toBe('accepted');
    expect(res.data.proposal.accepted_at).toBeTruthy();
  });

  it('assignee rejects a pending proposal', async () => {
    const p = await createProposal(user1Token);
    const res = await api('POST', `/proposals/${p.id}/reject`, user2Token);
    expect(res.success).toBe(true);
    expect(res.data.proposal.status).toBe('rejected');
  });

  it('assignee marks accepted task as complete', async () => {
    const p = await createProposal(user1Token);
    await api('POST', `/proposals/${p.id}/accept`, user2Token);
    const res = await api('POST', `/proposals/${p.id}/complete`, user2Token);
    expect(res.success).toBe(true);
    expect(res.data.proposal.status).toBe('completed');
    expect(res.data.proposal.completed_at).toBeTruthy();
  });

  it('creator verifies a completed task', async () => {
    const p = await createProposal(user1Token);
    await api('POST', `/proposals/${p.id}/accept`, user2Token);
    await api('POST', `/proposals/${p.id}/complete`, user2Token);
    const res = await api('POST', `/proposals/${p.id}/verify`, user1Token);
    expect(res.success).toBe(true);
    expect(res.data.proposal.status).toBe('verified');
  });

  it('happy path: create → accept → complete → verify (no penalty)', async () => {
    const p = await createProposal(user1Token, { penalty_amount: 25 });
    await api('POST', `/proposals/${p.id}/accept`, user2Token);
    await api('POST', `/proposals/${p.id}/complete`, user2Token);
    await api('POST', `/proposals/${p.id}/verify`, user1Token);

    // No ledger entries should exist
    const ledger = await api('GET', '/ledger', user1Token);
    expect(ledger.data.entries.length).toBe(0);

    // Balance should be zero
    const balance = await api('GET', '/ledger/balance', user1Token);
    expect(balance.data.balance).toBe(0);
  });

  it('creator marks accepted task as failed (penalty applied)', async () => {
    const p = await createProposal(user1Token, { penalty_amount: 15 });
    await api('POST', `/proposals/${p.id}/accept`, user2Token);
    const res = await api('POST', `/proposals/${p.id}/fail`, user1Token);
    expect(res.success).toBe(true);
    expect(res.data.proposal.status).toBe('failed');
    expect(res.data.ledger_entry.amount).toBe(15);
    expect(res.data.ledger_entry.from_user).toBe(user2.id);
    expect(res.data.ledger_entry.to_user).toBe(user1.id);
  });

  it('creator marks completed task as failed (disputes claim)', async () => {
    const p = await createProposal(user1Token, { penalty_amount: 20 });
    await api('POST', `/proposals/${p.id}/accept`, user2Token);
    await api('POST', `/proposals/${p.id}/complete`, user2Token);
    const res = await api('POST', `/proposals/${p.id}/fail`, user1Token);
    expect(res.success).toBe(true);
    expect(res.data.proposal.status).toBe('failed');
    expect(res.data.ledger_entry.amount).toBe(20);
  });

  it('creator overrides a failed task (penalty reversed)', async () => {
    const p = await createProposal(user1Token, { penalty_amount: 10 });
    await api('POST', `/proposals/${p.id}/accept`, user2Token);
    await api('POST', `/proposals/${p.id}/fail`, user1Token);
    const res = await api('POST', `/proposals/${p.id}/override`, user1Token);
    expect(res.success).toBe(true);
    expect(res.data.proposal.status).toBe('verified');
    // Counter-entry reverses the penalty
    expect(res.data.ledger_entry.from_user).toBe(user1.id);
    expect(res.data.ledger_entry.to_user).toBe(user2.id);
    expect(res.data.ledger_entry.amount).toBe(10);
  });

  it('failure + override end-to-end: balance returns to $0', async () => {
    const p = await createProposal(user1Token, { penalty_amount: 50 });
    await api('POST', `/proposals/${p.id}/accept`, user2Token);
    await api('POST', `/proposals/${p.id}/fail`, user1Token);

    // Balance should show debt
    let balance = await api('GET', '/ledger/balance', user2Token);
    expect(balance.data.balance).toBe(50);

    // Override
    await api('POST', `/proposals/${p.id}/override`, user1Token);

    // Balance should be zero again
    balance = await api('GET', '/ledger/balance', user2Token);
    expect(balance.data.balance).toBe(0);
  });

  // ---- Invalid State Transitions ----

  it('cannot accept an already-accepted proposal', async () => {
    const p = await createProposal(user1Token);
    await api('POST', `/proposals/${p.id}/accept`, user2Token);
    const res = await api('POST', `/proposals/${p.id}/accept`, user2Token);
    expect(res.success).toBe(false);
  });

  it('cannot complete a pending proposal', async () => {
    const p = await createProposal(user1Token);
    const res = await api('POST', `/proposals/${p.id}/complete`, user2Token);
    expect(res.success).toBe(false);
    expect(res.error).toMatch(/accepted/i);
  });

  it('cannot verify a pending proposal', async () => {
    const p = await createProposal(user1Token);
    const res = await api('POST', `/proposals/${p.id}/verify`, user1Token);
    expect(res.success).toBe(false);
  });

  it('cannot fail a pending proposal', async () => {
    const p = await createProposal(user1Token);
    const res = await api('POST', `/proposals/${p.id}/fail`, user1Token);
    expect(res.success).toBe(false);
  });

  it('cannot override a non-failed proposal', async () => {
    const p = await createProposal(user1Token);
    await api('POST', `/proposals/${p.id}/accept`, user2Token);
    const res = await api('POST', `/proposals/${p.id}/override`, user1Token);
    expect(res.success).toBe(false);
  });

  it('cannot transition from rejected', async () => {
    const p = await createProposal(user1Token);
    await api('POST', `/proposals/${p.id}/reject`, user2Token);

    const accept = await api('POST', `/proposals/${p.id}/accept`, user2Token);
    expect(accept.success).toBe(false);
    const complete = await api('POST', `/proposals/${p.id}/complete`, user2Token);
    expect(complete.success).toBe(false);
  });

  it('cannot transition from verified', async () => {
    const p = await createProposal(user1Token);
    await api('POST', `/proposals/${p.id}/accept`, user2Token);
    await api('POST', `/proposals/${p.id}/complete`, user2Token);
    await api('POST', `/proposals/${p.id}/verify`, user1Token);

    const fail = await api('POST', `/proposals/${p.id}/fail`, user1Token);
    expect(fail.success).toBe(false);
    const complete = await api('POST', `/proposals/${p.id}/complete`, user2Token);
    expect(complete.success).toBe(false);
  });

  // ---- Authorization ----

  it('assignee cannot fail or verify', async () => {
    const p = await createProposal(user1Token);
    await api('POST', `/proposals/${p.id}/accept`, user2Token);
    await api('POST', `/proposals/${p.id}/complete`, user2Token);

    // Assignee tries to verify (only creator can)
    const verify = await api('POST', `/proposals/${p.id}/verify`, user2Token);
    expect(verify.success).toBe(false);

    // Assignee tries to fail (only creator can)
    const fail = await api('POST', `/proposals/${p.id}/fail`, user2Token);
    expect(fail.success).toBe(false);
  });

  it('creator cannot accept or complete', async () => {
    const p = await createProposal(user1Token);
    // Creator tries to accept (only assignee can)
    const accept = await api('POST', `/proposals/${p.id}/accept`, user1Token);
    expect(accept.success).toBe(false);

    // Accept properly, then creator tries to complete
    await api('POST', `/proposals/${p.id}/accept`, user2Token);
    const complete = await api('POST', `/proposals/${p.id}/complete`, user1Token);
    expect(complete.success).toBe(false);
  });

  // ---- Deadline Enforcement ----

  it('auto-fails overdue accepted proposals on next fetch', async () => {
    // Create proposal with a past deadline by inserting directly
    const p = await createProposal(user1Token);
    await api('POST', `/proposals/${p.id}/accept`, user2Token);

    // Manually set deadline to the past via direct DB update
    const pastTs = Math.floor(Date.now() / 1000) - 3600;
    await import('cloudflare:test').then(({ env }) =>
      env.DB.prepare('UPDATE proposals SET deadline = ? WHERE id = ?')
        .bind(pastTs, p.id)
        .run()
    );

    // Fetching proposals should trigger auto-fail
    const res = await api('GET', '/proposals', user1Token);
    const proposal = res.data.proposals.find((pr: any) => pr.id === p.id);
    expect(proposal.status).toBe('failed');

    // Ledger entry should be created
    const ledger = await api('GET', '/ledger', user1Token);
    expect(ledger.data.entries.length).toBe(1);
    expect(ledger.data.entries[0].reason).toMatch(/overdue/i);
  });
});
