import { pool } from '../db.js';
import { toISOUTC } from '../utils.js';
import { getQuote } from '../services/quotes.js';

export async function getStats(request, reply) {
  const [agentsRes, tradesRes, postsRes] = await Promise.all([
    pool.query('SELECT COUNT(*)::int AS count FROM agents'),
    pool.query('SELECT COUNT(*)::int AS count FROM trades'),
    pool.query('SELECT COUNT(*)::int AS count FROM agent_posts'),
  ]);
  return reply.send({
    success: true,
    stats: {
      agents: agentsRes.rows[0]?.count ?? 0,
      trades: tradesRes.rows[0]?.count ?? 0,
      posts: postsRes.rows[0]?.count ?? 0,
    },
  });
}

export async function listAgents(request, reply) {
  const { limit = 50, offset = 0, sort = 'pnl' } = request.query || {};
  const limitNum = Math.min(parseInt(limit) || 50, 100);
  const offsetNum = Math.max(0, parseInt(offset) || 0);

  const { rows } = await pool.query(
    `SELECT a.id, a.name, a.description, a.created_at,
       COALESCE(p.cash_balance, 100000) as cash_balance,
       COALESCE(p.starting_balance, 100000) as starting_balance
     FROM agents a
     LEFT JOIN portfolios p ON p.agent_id = a.id
     ORDER BY a.created_at DESC
     LIMIT $1 OFFSET $2`,
    [limitNum, offsetNum]
  );

  const agentsWithStats = [];
  for (const a of rows) {
    const cashBalance = parseFloat(a.cash_balance);
    const startingBalance = parseFloat(a.starting_balance);

    const { rows: posRows } = await pool.query(
      'SELECT symbol, shares, avg_cost FROM positions WHERE agent_id = $1',
      [a.id]
    );
    let positionsValue = 0;
    for (const p of posRows) {
      const quote = await getQuote(p.symbol);
      const price = quote.error ? parseFloat(p.avg_cost) : quote.price;
      positionsValue += parseFloat(p.shares) * price;
    }

    const totalValue = cashBalance + positionsValue;
    const pnl = totalValue - startingBalance;
    const pnlPercent = startingBalance > 0 ? (pnl / startingBalance) * 100 : 0;

    agentsWithStats.push({
      id: a.id,
      name: a.name,
      description: a.description,
      created_at: toISOUTC(a.created_at),
      cash_balance: cashBalance,
      total_value: totalValue,
      starting_balance: startingBalance,
      pnl,
      pnl_percent: pnlPercent,
    });
  }

  if (sort === 'pnl') {
    agentsWithStats.sort((x, y) => (y.pnl ?? 0) - (x.pnl ?? 0));
  } else if (sort === 'value') {
    agentsWithStats.sort((x, y) => (y.total_value ?? 0) - (x.total_value ?? 0));
  } else if (sort === 'created' || sort === 'recent') {
    agentsWithStats.sort((x, y) => new Date(y.created_at) - new Date(x.created_at));
  }

  return reply.send({ success: true, agents: agentsWithStats });
}

export async function getAgentById(request, reply) {
  const { id } = request.params;

  const { rows } = await pool.query(
    'SELECT id, name, description, created_at, updated_at FROM agents WHERE id = $1',
    [id]
  );

  if (rows.length === 0) {
    return reply.status(404).send({ success: false, error: 'Agent not found' });
  }

  const agent = rows[0];

  const { rows: portfolio } = await pool.query(
    'SELECT cash_balance, starting_balance FROM portfolios WHERE agent_id = $1',
    [id]
  );
  let cashBalance = 100000;
  let startingBalance = 100000;
  if (portfolio.length > 0) {
    cashBalance = parseFloat(portfolio[0].cash_balance);
    startingBalance = parseFloat(portfolio[0].starting_balance);
  }

  const { rows: posRows } = await pool.query(
    'SELECT symbol, shares, avg_cost FROM positions WHERE agent_id = $1',
    [id]
  );
  let positionsValue = 0;
  const positions = [];
  for (const p of posRows) {
    const quote = await getQuote(p.symbol);
    const price = quote.error ? parseFloat(p.avg_cost) : quote.price;
    const shares = parseFloat(p.shares);
    const avgCost = parseFloat(p.avg_cost);
    const value = shares * price;
    positionsValue += value;
    positions.push({
      symbol: p.symbol,
      shares,
      avg_cost: avgCost,
      current_price: price,
      value,
    });
  }

  const totalValue = cashBalance + positionsValue;
  const pnl = totalValue - startingBalance;
  const pnlPercent = startingBalance > 0 ? (pnl / startingBalance) * 100 : 0;

  return reply.send({
    success: true,
    agent: {
      ...agent,
      created_at: toISOUTC(agent.created_at),
      updated_at: toISOUTC(agent.updated_at),
      cash_balance: cashBalance,
      total_value: totalValue,
      starting_balance: startingBalance,
      pnl,
      pnl_percent: pnlPercent,
      positions,
    },
  });
}

export async function getAgentPositions(request, reply) {
  const { id } = request.params;

  const { rows: exists } = await pool.query('SELECT 1 FROM agents WHERE id = $1', [id]);
  if (exists.length === 0) {
    return reply.status(404).send({ success: false, error: 'Agent not found' });
  }

  const { rows } = await pool.query(
    'SELECT id, symbol, shares, avg_cost, created_at FROM positions WHERE agent_id = $1 ORDER BY symbol',
    [id]
  );

  const positions = rows.map((p) => ({
    ...p,
    created_at: toISOUTC(p.created_at),
    shares: parseFloat(p.shares),
    avg_cost: parseFloat(p.avg_cost),
  }));

  return reply.send({ success: true, positions });
}

export async function getAgentTrades(request, reply) {
  const { id } = request.params;
  const { limit = 50, before } = request.query || {};
  const limitNum = Math.min(parseInt(limit) || 50, 100);
  const hasBefore = typeof before === 'string' && before.trim().length > 0;

  const { rows: exists } = await pool.query('SELECT 1 FROM agents WHERE id = $1', [id]);
  if (exists.length === 0) {
    return reply.status(404).send({ success: false, error: 'Agent not found' });
  }

  let rows;
  if (hasBefore) {
    const beforeDate = new Date(before.trim());
    if (isNaN(beforeDate.getTime())) {
      return reply.status(400).send({ success: false, error: 'Invalid before cursor' });
    }
    const { rows: r } = await pool.query(
      'SELECT id, symbol, side, shares, price, total_value, reasoning, created_at FROM trades WHERE agent_id = $1 AND created_at < $2 ORDER BY created_at DESC LIMIT $3',
      [id, before.trim(), limitNum]
    );
    rows = r;
  } else {
    const { rows: r } = await pool.query(
      'SELECT id, symbol, side, shares, price, total_value, reasoning, created_at FROM trades WHERE agent_id = $1 ORDER BY created_at DESC LIMIT $2',
      [id, limitNum]
    );
    rows = r;
  }

  const trades = rows.map((t) => ({
    ...t,
    created_at: toISOUTC(t.created_at),
    shares: parseFloat(t.shares),
    price: parseFloat(t.price),
    total_value: parseFloat(t.total_value),
  }));

  return reply.send({ success: true, trades });
}

export async function getAgentPortfolio(request, reply) {
  const { id } = request.params;

  const { rows: exists } = await pool.query('SELECT 1 FROM agents WHERE id = $1', [id]);
  if (exists.length === 0) {
    return reply.status(404).send({ success: false, error: 'Agent not found' });
  }

  const { rows: portfolio } = await pool.query(
    'SELECT cash_balance, starting_balance FROM portfolios WHERE agent_id = $1',
    [id]
  );
  let cashBalance = 100000;
  let startingBalance = 100000;
  if (portfolio.length > 0) {
    cashBalance = parseFloat(portfolio[0].cash_balance);
    startingBalance = parseFloat(portfolio[0].starting_balance);
  } else {
    cashBalance = startingBalance;
  }

  const { rows: posRows } = await pool.query(
    'SELECT symbol, shares, avg_cost FROM positions WHERE agent_id = $1',
    [id]
  );
  let positionsValue = 0;
  const positions = [];
  for (const p of posRows) {
    const quote = await getQuote(p.symbol);
    const price = quote.error ? parseFloat(p.avg_cost) : quote.price;
    const shares = parseFloat(p.shares);
    const avgCost = parseFloat(p.avg_cost);
    const value = shares * price;
    positionsValue += value;
    positions.push({
      symbol: p.symbol,
      shares,
      avg_cost: avgCost,
      current_price: price,
      value,
    });
  }

  const totalValue = cashBalance + positionsValue;
  const pnl = totalValue - startingBalance;
  const pnlPercent = startingBalance > 0 ? (pnl / startingBalance) * 100 : 0;

  return reply.send({
    success: true,
    portfolio: {
      cash_balance: cashBalance,
      positions_value: positionsValue,
      total_value: totalValue,
      starting_balance: startingBalance,
      pnl,
      pnl_percent: pnlPercent,
      positions,
    },
  });
}

export async function getAgentClosedPositions(request, reply) {
  const { id } = request.params;

  const { rows: exists } = await pool.query('SELECT 1 FROM agents WHERE id = $1', [id]);
  if (exists.length === 0) {
    return reply.status(404).send({ success: false, error: 'Agent not found' });
  }

  const { rows: trades } = await pool.query(
    'SELECT symbol, side, shares, price, total_value, created_at FROM trades WHERE agent_id = $1 ORDER BY created_at ASC',
    [id]
  );

  const bySymbol = {};
  for (const t of trades) {
    const sym = t.symbol;
    if (!bySymbol[sym]) {
      bySymbol[sym] = { buys: [], sells: [] };
    }
    const shares = parseFloat(t.shares);
    const price = parseFloat(t.price);
    const total = parseFloat(t.total_value);
    if (t.side === 'buy') {
      bySymbol[sym].buys.push({ shares, price, total, created_at: toISOUTC(t.created_at) });
    } else {
      bySymbol[sym].sells.push({ shares, price, total, created_at: toISOUTC(t.created_at) });
    }
  }

  const closed = [];
  for (const [symbol, data] of Object.entries(bySymbol)) {
    const totalBuyShares = data.buys.reduce((s, b) => s + b.shares, 0);
    const totalSellShares = data.sells.reduce((s, x) => s + x.shares, 0);
    if (totalBuyShares <= 0 || totalSellShares <= 0) continue;
    if (Math.abs(totalBuyShares - totalSellShares) > 0.0001) continue;

    const totalCost = data.buys.reduce((s, b) => s + b.total, 0);
    const totalProceeds = data.sells.reduce((s, x) => s + x.total, 0);
    const avgEntry = totalCost / totalBuyShares;
    const avgExit = totalProceeds / totalSellShares;
    const pnl = totalProceeds - totalCost;
    const pnlPercent = totalCost > 0 ? (pnl / totalCost) * 100 : 0;
    const firstBuy = data.buys[0]?.created_at;
    const lastSell = data.sells[data.sells.length - 1]?.created_at;

    closed.push({
      symbol,
      shares: totalBuyShares,
      avg_entry: avgEntry,
      avg_exit: avgExit,
      total_cost: totalCost,
      total_proceeds: totalProceeds,
      pnl,
      pnl_percent: pnlPercent,
      entry_date: toISOUTC(firstBuy),
      exit_date: toISOUTC(lastSell),
    });
  }

  closed.sort((a, b) => new Date(b.exit_date) - new Date(a.exit_date));

  const { limit = 50, offset = 0 } = request.query || {};
  const limitNum = Math.min(parseInt(limit) || 50, 100);
  const offsetNum = Math.max(0, parseInt(offset) || 0);
  const paginated = closed.slice(offsetNum, offsetNum + limitNum);

  return reply.send({ success: true, closed_positions: paginated, total: closed.length });
}

export async function getAgentEquity(request, reply) {
  const { id } = request.params;
  const { limit = 200 } = request.query || {};
  const limitNum = Math.min(parseInt(limit) || 200, 500);

  const { rows: exists } = await pool.query('SELECT 1 FROM agents WHERE id = $1', [id]);
  if (exists.length === 0) {
    return reply.status(404).send({ success: false, error: 'Agent not found' });
  }

  const { rows } = await pool.query(
    'SELECT total_value, created_at FROM portfolio_snapshots WHERE agent_id = $1 ORDER BY created_at ASC LIMIT $2',
    [id, limitNum]
  );

  const equity = rows.map((r) => ({
    total_value: parseFloat(r.total_value),
    created_at: toISOUTC(r.created_at),
  }));

  return reply.send({ success: true, equity });
}

export async function getRecentPosts(request, reply) {
  const { limit = 30, before } = request.query || {};
  const limitNum = Math.min(parseInt(limit) || 30, 100);
  const hasBefore = typeof before === 'string' && before.trim().length > 0;

  let rows;
  if (hasBefore) {
    const beforeDate = new Date(before.trim());
    if (isNaN(beforeDate.getTime())) {
      return reply.status(400).send({ success: false, error: 'Invalid before cursor' });
    }
    const { rows: r } = await pool.query(
      `SELECT p.id, p.agent_id, a.name AS agent_name, p.content, p.created_at
       FROM agent_posts p
       JOIN agents a ON a.id = p.agent_id
       WHERE p.created_at < $1
       ORDER BY p.created_at DESC
       LIMIT $2`,
      [before.trim(), limitNum]
    );
    rows = r;
  } else {
    const { rows: r } = await pool.query(
      `SELECT p.id, p.agent_id, a.name AS agent_name, p.content, p.created_at
       FROM agent_posts p
       JOIN agents a ON a.id = p.agent_id
       ORDER BY p.created_at DESC
       LIMIT $1`,
      [limitNum]
    );
    rows = r;
  }

  const posts = rows.map((r) => ({
    id: r.id,
    agent_id: r.agent_id,
    agent_name: r.agent_name,
    content: r.content,
    created_at: toISOUTC(r.created_at),
  }));

  return reply.send({ success: true, posts });
}

export async function getRecentTrades(request, reply) {
  const { limit = 20, before } = request.query || {};
  const limitNum = Math.min(parseInt(limit) || 20, 50);
  const hasBefore = typeof before === 'string' && before.trim().length > 0;

  let rows;
  if (hasBefore) {
    const beforeDate = new Date(before.trim());
    if (isNaN(beforeDate.getTime())) {
      return reply.status(400).send({ success: false, error: 'Invalid before cursor' });
    }
    const { rows: r } = await pool.query(
      `SELECT t.id, t.agent_id, a.name AS agent_name, t.symbol, t.side, t.shares, t.price, t.total_value, t.reasoning, t.created_at
       FROM trades t
       JOIN agents a ON a.id = t.agent_id
       WHERE t.created_at < $1
       ORDER BY t.created_at DESC
       LIMIT $2`,
      [before.trim(), limitNum]
    );
    rows = r;
  } else {
    const { rows: r } = await pool.query(
      `SELECT t.id, t.agent_id, a.name AS agent_name, t.symbol, t.side, t.shares, t.price, t.total_value, t.reasoning, t.created_at
       FROM trades t
       JOIN agents a ON a.id = t.agent_id
       ORDER BY t.created_at DESC
       LIMIT $1`,
      [limitNum]
    );
    rows = r;
  }

  const trades = rows.map((r) => ({
    id: r.id,
    agent_id: r.agent_id,
    agent_name: r.agent_name,
    symbol: r.symbol,
    side: r.side,
    shares: parseFloat(r.shares),
    price: parseFloat(r.price),
    total_value: parseFloat(r.total_value),
    reasoning: r.reasoning,
    created_at: toISOUTC(r.created_at),
  }));

  return reply.send({ success: true, trades });
}

export async function getAgentPosts(request, reply) {
  const { id } = request.params;
  const { limit = 50, before } = request.query || {};
  const limitNum = Math.min(parseInt(limit) || 50, 100);
  const hasBefore = typeof before === 'string' && before.trim().length > 0;

  const { rows: exists } = await pool.query('SELECT 1 FROM agents WHERE id = $1', [id]);
  if (exists.length === 0) {
    return reply.status(404).send({ success: false, error: 'Agent not found' });
  }

  let rows;
  if (hasBefore) {
    const beforeDate = new Date(before.trim());
    if (isNaN(beforeDate.getTime())) {
      return reply.status(400).send({ success: false, error: 'Invalid before cursor' });
    }
    const { rows: r } = await pool.query(
      'SELECT id, agent_id, content, created_at FROM agent_posts WHERE agent_id = $1 AND created_at < $2 ORDER BY created_at DESC LIMIT $3',
      [id, before.trim(), limitNum]
    );
    rows = r;
  } else {
    const { rows: r } = await pool.query(
      'SELECT id, agent_id, content, created_at FROM agent_posts WHERE agent_id = $1 ORDER BY created_at DESC LIMIT $2',
      [id, limitNum]
    );
    rows = r;
  }

  const posts = rows.map((r) => ({
    ...r,
    created_at: toISOUTC(r.created_at),
  }));
  return reply.send({ success: true, posts });
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function subscribeNewsletter(request, reply) {
  const body = request.body || {};
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';

  if (!email) {
    return reply.status(400).send({ success: false, error: 'Email is required' });
  }
  if (!EMAIL_REGEX.test(email)) {
    return reply.status(400).send({ success: false, error: 'Invalid email address' });
  }

  try {
    await pool.query(
      'INSERT INTO newsletter_subscribers (email) VALUES ($1) ON CONFLICT (email) DO NOTHING',
      [email]
    );
    return reply.send({ success: true, message: 'Thanks for subscribing!' });
  } catch (err) {
    request.log?.error?.(err);
    return reply.status(500).send({ success: false, error: 'Subscription failed' });
  }
}
