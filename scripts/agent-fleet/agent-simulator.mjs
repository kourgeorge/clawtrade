/**
 * Clawtrade agent simulator: registers agents and places trades to populate the UI.
 * No AI required - uses procedural trading logic. Part of agent-fleet (stress/testing).
 *
 * Run: npm run simulate
 * Env: scripts/agent-fleet/.env.fleet (CLAWTRADE_API_URL, NUM_AGENTS, TRADES_PER_AGENT)
 * Requires: Backend running at CLAWTRADE_API_URL (default http://localhost:3001)
 */

import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: join(__dirname, '.env.fleet') });

const API_URL = process.env.CLAWTRADE_API_URL || 'http://localhost:3001';
const API_BASE = `${API_URL}/api/v1`;

const SYMBOLS = ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'META', 'TSLA', 'NVDA', 'JPM', 'V', 'WMT'];

const AGENTS = [
  { name: 'Momentum Hunter', description: 'Chases momentum and breakout plays' },
  { name: 'Value Investor', description: 'Bottom-fishing undervalued large caps' },
  { name: 'Tech Bull', description: 'Long-term believer in big tech' },
  { name: 'Swing Trader', description: 'Short-term swings on volatility' },
  { name: 'Dividend Seeker', description: 'Focus on high-yield blue chips' },
  { name: 'Growth Chaser', description: 'High-growth names, higher risk' },
  { name: 'Index Hugger', description: 'Diversified across majors' },
  { name: 'Contrarian Bot', description: 'Buys fear, sells greed' },
];

const BUY_REASONS = [
  'Strong momentum; RSI oversold rebound',
  'Dip buying on sector weakness',
  'Earnings beat expectations',
  'Technical breakout above resistance',
  'Value entry; P/E below sector avg',
  'Institutional accumulation detected',
  'Sector rotation into tech',
  'Oversold bounce setup',
  'Dividend yield attractive here',
  'Growth story intact; adding to position',
];

const SELL_REASONS = [
  'Taking partial profits after 10% gain',
  'Cutting loss; thesis invalidated',
  'Reducing exposure ahead of earnings',
  'Rebalancing portfolio',
  'Technical breakdown; exit signal',
  'Profit target hit',
  'Sector rotation out',
  'Raising cash for better opportunity',
  'Stop loss triggered',
  'Taking gains; position size too large',
];

async function api(path, { apiKey, method = 'GET', body } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;
  const url = path.startsWith('/') ? `${API_BASE}${path}` : `${API_BASE}/${path}`;
  const res = await fetch(url, { method, headers, body: body ? JSON.stringify(body) : undefined });
  return res.json();
}

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

async function registerAgent({ name, description }) {
  const json = await api('agents/register', {
    method: 'POST',
    body: { name, description },
  });
  if (!json.agent?.api_key) {
    throw new Error(`Registration failed: ${JSON.stringify(json)}`);
  }
  return json.agent;
}

async function placeOrder(apiKey, { symbol, side, shares, reasoning }) {
  return api('orders', {
    apiKey,
    method: 'POST',
    body: { symbol, side, shares, reasoning },
  });
}

async function getQuote(apiKey, symbol) {
  const json = await api(`quotes/${symbol}`, { apiKey });
  return json.price;
}

async function getPortfolio(apiKey) {
  const json = await api('portfolio', { apiKey });
  return json.portfolio;
}

async function runAgent(agent, tradesPerAgent = 8) {
  const { api_key, name } = agent;
  console.log(`  Trading: ${name}`);

  const positions = new Map(); // symbol -> shares

  for (let i = 0; i < tradesPerAgent; i++) {
    const isBuy = Math.random() < 0.6 || positions.size === 0;
    const symbol = pick(SYMBOLS);

    if (isBuy) {
      const shares = randomInt(5, 50);
      const result = await placeOrder(api_key, {
        symbol,
        side: 'buy',
        shares,
        reasoning: pick(BUY_REASONS),
      });
      if (result.success) {
        positions.set(symbol, (positions.get(symbol) || 0) + shares);
      }
    } else {
      const held = positions.get(symbol) || 0;
      if (held > 0) {
        const sellShares = Math.min(held, randomInt(5, Math.min(held, 30)));
        const result = await placeOrder(api_key, {
          symbol,
          side: 'sell',
          shares: sellShares,
          reasoning: pick(SELL_REASONS),
        });
        if (result.success) {
          const newHeld = held - sellShares;
          if (newHeld <= 0) positions.delete(symbol);
          else positions.set(symbol, newHeld);
        }
      }
    }
    await new Promise((r) => setTimeout(r, 100));
  }
}

async function main() {
  const numAgents = parseInt(process.env.NUM_AGENTS || '8', 10);
  const tradesPerAgent = parseInt(process.env.TRADES_PER_AGENT || '10', 10);

  console.log('Clawtrade Agent Simulator');
  console.log('=========================\n');
  console.log(`API: ${API_URL}`);
  console.log(`Registering ${numAgents} agents, ~${tradesPerAgent} trades each...\n`);

  const agentsToUse = AGENTS.slice(0, numAgents);
  const registered = [];

  for (const cfg of agentsToUse) {
    const agent = await registerAgent(cfg);
    registered.push(agent);
    console.log(`  Registered: ${agent.name}`);
  }

  console.log('\nPlacing trades...\n');
  for (const agent of registered) {
    await runAgent(agent, tradesPerAgent);
  }

  console.log('\nDone. Visit the app to see the leaderboard.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
