import { Hono } from 'hono';
import type { Env, JwtPayload } from '../types';
import { LedgerRepository } from '../db/ledger';
import { UserRepository } from '../db/users';
import { authMiddleware } from '../middleware/auth';

type LedgerEnv = {
  Bindings: Env;
  Variables: { user: JwtPayload };
};

const ledger = new Hono<LedgerEnv>();

ledger.use('/*', authMiddleware);

// Get all ledger entries for the authenticated user
ledger.get('/', async (c) => {
  const user = c.get('user');
  const repo = new LedgerRepository(c.env.DB);
  const entries = await repo.findByUser(user.sub);
  return c.json({ success: true, data: { entries } });
});

// Get net balance
ledger.get('/balance', async (c) => {
  const user = c.get('user');
  const ledgerRepo = new LedgerRepository(c.env.DB);
  const users = new UserRepository(c.env.DB);
  const partner = await users.getPartner(user.sub);

  const balance = await ledgerRepo.getBalance(user.sub);

  return c.json({
    success: true,
    data: {
      balance,
      you: { id: user.sub, name: user.name },
      partner: partner ? { id: partner.id, name: partner.name } : null,
      summary:
        balance > 0
          ? `You owe ${partner?.name || 'your partner'} $${balance.toFixed(2)}`
          : balance < 0
            ? `${partner?.name || 'Your partner'} owes you $${Math.abs(balance).toFixed(2)}`
            : 'All settled up!',
    },
  });
});

export default ledger;
