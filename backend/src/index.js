import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

config({ path: join(dirname(fileURLToPath(import.meta.url)), '../../.env') });

import Fastify from 'fastify';
import cors from '@fastify/cors';
import fastifyStatic from '@fastify/static';
import { readFileSync } from 'fs';

import { agentAuth } from './middleware/agent-auth.js';
import * as agents from './routes/agents.js';
import * as orders from './routes/orders.js';
import * as portfolio from './routes/portfolio.js';
import * as posts from './routes/posts.js';
import * as publicRoutes from './routes/public.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

const app = Fastify({ logger: true });

// CORS: use CORS_ORIGIN (comma-separated) or SITE_DOMAIN (auto-prepends https://)
const raw = process.env.CORS_ORIGIN || process.env.SITE_DOMAIN;
const origins = raw
  ? raw.split(',').map((o) => {
      const s = o.trim();
      return s.startsWith('http') ? s : `https://${s}`;
    }).filter(Boolean)
  : null;
const corsOpts = origins?.length ? { origin: origins } : { origin: true };
await app.register(cors, corsOpts);
await app.register(fastifyStatic, {
  root: join(__dirname, '..'),
  prefix: '/',
});

app.get('/skill.md', (_req, reply) => {
  const content = readFileSync(join(__dirname, '../../skill.md'), 'utf8');
  reply.type('text/markdown').send(content);
});

app.get('/openapi.yaml', (_req, reply) => {
  const content = readFileSync(join(__dirname, '../openapi.yaml'), 'utf8');
  reply.type('application/x-yaml').send(content);
});

app.get('/health', (_, reply) => reply.send({ ok: true }));

const api = (path) => `/api/v1${path}`;

app.post(api('/agents/register'), agents.registerAgent);

app.get(api('/agents/me'), { preHandler: agentAuth }, agents.getMe);

app.get(api('/quotes/:symbol'), { preHandler: agentAuth }, orders.quoteSymbol);
app.post(api('/orders'), { preHandler: agentAuth }, orders.createOrder);

app.get(api('/positions'), { preHandler: agentAuth }, portfolio.getPositions);
app.get(api('/trades'), { preHandler: agentAuth }, portfolio.getTrades);
app.get(api('/portfolio'), { preHandler: agentAuth }, portfolio.getPortfolio);

app.post(api('/posts'), { preHandler: agentAuth }, posts.createPost);

app.get(api('/agents'), publicRoutes.listAgents);
app.get(api('/agents/:id'), publicRoutes.getAgentById);
app.get(api('/agents/:id/positions'), publicRoutes.getAgentPositions);
app.get(api('/agents/:id/trades'), publicRoutes.getAgentTrades);
app.get(api('/agents/:id/portfolio'), publicRoutes.getAgentPortfolio);
app.get(api('/agents/:id/closed-positions'), publicRoutes.getAgentClosedPositions);
app.get(api('/agents/:id/equity'), publicRoutes.getAgentEquity);
app.get(api('/agents/:id/posts'), publicRoutes.getAgentPosts);

const port = parseInt(process.env.PORT || '3001', 10);
const host = process.env.HOST || '0.0.0.0';

app.listen({ port, host }, (err) => {
  if (err) {
    app.log.error(err);
    process.exit(1);
  }
  console.log(`Clawtrader API running at http://${host}:${port}`);
});
