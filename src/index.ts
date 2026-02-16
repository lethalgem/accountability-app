import { Hono } from 'hono';
import { cors } from 'hono/cors';
import type { Env } from './types';
import auth from './routes/auth';
import proposals from './routes/proposals';
import ledger from './routes/ledger';

const app = new Hono<{ Bindings: Env }>();

app.use('/*', cors());

app.route('/api/auth', auth);
app.route('/api/proposals', proposals);
app.route('/api/ledger', ledger);

app.get('/api/health', (c) => {
  return c.json({ status: 'ok', timestamp: new Date().toISOString() });
});

export default app;
