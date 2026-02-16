import { describe, it, expect, beforeEach } from 'vitest';
import { setupDb, api, registerBothUsers, createProposal } from './helpers';

describe('Ledger & Balance', () => {
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

  it('no ledger entries when all tasks succeed', async () => {
    const p = await createProposal(user1Token, { penalty_amount: 100 });
    await api('POST', `/proposals/${p.id}/accept`, user2Token);
    await api('POST', `/proposals/${p.id}/complete`, user2Token);
    await api('POST', `/proposals/${p.id}/verify`, user1Token);

    const ledger = await api('GET', '/ledger', user1Token);
    expect(ledger.data.entries.length).toBe(0);
  });

  it('failed task creates debit for assignee', async () => {
    const p = await createProposal(user1Token, { penalty_amount: 25 });
    await api('POST', `/proposals/${p.id}/accept`, user2Token);
    await api('POST', `/proposals/${p.id}/fail`, user1Token);

    const ledger = await api('GET', '/ledger', user2Token);
    expect(ledger.data.entries.length).toBe(1);
    expect(ledger.data.entries[0].from_user).toBe(user2.id);
    expect(ledger.data.entries[0].to_user).toBe(user1.id);
    expect(ledger.data.entries[0].amount).toBe(25);
  });

  it('balance reflects who owes whom', async () => {
    const p = await createProposal(user1Token, { penalty_amount: 30 });
    await api('POST', `/proposals/${p.id}/accept`, user2Token);
    await api('POST', `/proposals/${p.id}/fail`, user1Token);

    // User2 (assignee who failed) should owe user1
    const b2 = await api('GET', '/ledger/balance', user2Token);
    expect(b2.data.balance).toBe(30);
    expect(b2.data.summary).toMatch(/you owe/i);

    // User1 (creator) should be owed
    const b1 = await api('GET', '/ledger/balance', user1Token);
    expect(b1.data.balance).toBe(-30);
    expect(b1.data.summary).toMatch(/owes you/i);
  });

  it('override creates counter-entry that cancels penalty', async () => {
    const p = await createProposal(user1Token, { penalty_amount: 40 });
    await api('POST', `/proposals/${p.id}/accept`, user2Token);
    await api('POST', `/proposals/${p.id}/fail`, user1Token);
    await api('POST', `/proposals/${p.id}/override`, user1Token);

    const ledger = await api('GET', '/ledger', user1Token);
    expect(ledger.data.entries.length).toBe(2);

    const balance = await api('GET', '/ledger/balance', user2Token);
    expect(balance.data.balance).toBe(0);
    expect(balance.data.summary).toMatch(/settled/i);
  });

  it('multiple penalties accumulate correctly', async () => {
    // First failure: $10
    const p1 = await createProposal(user1Token, { penalty_amount: 10, title: 'Task 1' });
    await api('POST', `/proposals/${p1.id}/accept`, user2Token);
    await api('POST', `/proposals/${p1.id}/fail`, user1Token);

    // Second failure: $15
    const p2 = await createProposal(user1Token, { penalty_amount: 15, title: 'Task 2' });
    await api('POST', `/proposals/${p2.id}/accept`, user2Token);
    await api('POST', `/proposals/${p2.id}/fail`, user1Token);

    const balance = await api('GET', '/ledger/balance', user2Token);
    expect(balance.data.balance).toBe(25);

    const ledger = await api('GET', '/ledger', user2Token);
    expect(ledger.data.entries.length).toBe(2);
  });

  it('balance summary text is correct for each state', async () => {
    // Zero balance
    let b = await api('GET', '/ledger/balance', user1Token);
    expect(b.data.summary).toMatch(/settled/i);

    // User2 owes user1
    const p = await createProposal(user1Token, { penalty_amount: 5 });
    await api('POST', `/proposals/${p.id}/accept`, user2Token);
    await api('POST', `/proposals/${p.id}/fail`, user1Token);

    b = await api('GET', '/ledger/balance', user2Token);
    expect(b.data.summary).toContain('Alice');
    expect(b.data.summary).toMatch(/\$5\.00/);

    b = await api('GET', '/ledger/balance', user1Token);
    expect(b.data.summary).toContain('Bob');
    expect(b.data.summary).toMatch(/\$5\.00/);
  });
});
