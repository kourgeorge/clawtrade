import { pool } from '../db.js';
import { generateId } from '../utils.js';
import { getQuote } from './quotes.js';

const STARTING_BALANCE = 100000;

async function savePortfolioSnapshot(pool, agentId, genId) {
  const { rows: p } = await pool.query(
    'SELECT cash_balance FROM portfolios WHERE agent_id = $1',
    [agentId]
  );
  if (p.length === 0) return;
  let total = parseFloat(p[0].cash_balance);
  const { rows: positions } = await pool.query(
    'SELECT symbol, shares, avg_cost FROM positions WHERE agent_id = $1',
    [agentId]
  );
  for (const pos of positions) {
    const q = await getQuote(pos.symbol);
    const price = q.error ? parseFloat(pos.avg_cost) : q.price;
    total += parseFloat(pos.shares) * price;
  }
  await pool.query(
    'INSERT INTO portfolio_snapshots (id, agent_id, total_value) VALUES ($1, $2, $3)',
    [genId(), agentId, total]
  );
}

async function ensurePortfolio(agentId) {
  const { rows } = await pool.query(
    'SELECT agent_id, cash_balance, starting_balance FROM portfolios WHERE agent_id = $1',
    [agentId]
  );
  if (rows.length > 0) return rows[0];

  await pool.query(
    'INSERT INTO portfolios (agent_id, cash_balance, starting_balance) VALUES ($1, $2, $3)',
    [agentId, STARTING_BALANCE, STARTING_BALANCE]
  );
  await pool.query(
    'INSERT INTO portfolio_snapshots (id, agent_id, total_value) VALUES ($1, $2, $3)',
    [generateId(), agentId, STARTING_BALANCE]
  );
  return { agent_id: agentId, cash_balance: String(STARTING_BALANCE), starting_balance: String(STARTING_BALANCE) };
}

export async function placeOrder(agentId, { symbol, side, shares, amount, reasoning }) {
  const sym = String(symbol || '').toUpperCase().trim();
  if (!sym) return { success: false, error: 'Symbol is required' };

  const s = String(side || '').toLowerCase();
  if (s !== 'buy' && s !== 'sell') {
    return { success: false, error: 'side must be "buy" or "sell"' };
  }

  const quote = await getQuote(sym);
  if (quote.error) return { success: false, error: quote.error };
  const price = parseFloat(quote.price);

  let tradeShares;
  if (shares != null) {
    tradeShares = parseFloat(shares);
  } else if (amount != null) {
    const amt = parseFloat(amount);
    if (!Number.isFinite(amt) || amt <= 0) {
      return { success: false, error: 'amount must be a positive number' };
    }
    tradeShares = Math.floor((amt / price) * 10000) / 10000;
  } else {
    return { success: false, error: 'shares or amount is required' };
  }

  if (!Number.isFinite(tradeShares) || tradeShares <= 0) {
    return { success: false, error: 'shares or amount must yield positive shares' };
  }

  const portfolio = await ensurePortfolio(agentId);
  const cashBalance = parseFloat(portfolio.cash_balance);

  if (s === 'buy') {
    const cost = tradeShares * price;
    if (cost > cashBalance) {
      return { success: false, error: 'Insufficient cash', required: cost, available: cashBalance };
    }
    await pool.query(
      'UPDATE portfolios SET cash_balance = cash_balance - $1, updated_at = NOW() WHERE agent_id = $2',
      [cost, agentId]
    );

    const { rows: pos } = await pool.query(
      'SELECT id, shares, avg_cost FROM positions WHERE agent_id = $1 AND symbol = $2',
      [agentId, sym]
    );
    if (pos.length === 0) {
      const id = generateId();
      await pool.query(
        'INSERT INTO positions (id, agent_id, symbol, shares, avg_cost) VALUES ($1, $2, $3, $4, $5)',
        [id, agentId, sym, tradeShares, price]
      );
    } else {
      const oldShares = parseFloat(pos[0].shares);
      const oldCost = parseFloat(pos[0].avg_cost);
      const newShares = oldShares + tradeShares;
      const newAvgCost = (oldShares * oldCost + tradeShares * price) / newShares;
      await pool.query(
        'UPDATE positions SET shares = $1, avg_cost = $2, updated_at = NOW() WHERE agent_id = $3 AND symbol = $4',
        [newShares, newAvgCost, agentId, sym]
      );
    }
  } else {
    const { rows: pos } = await pool.query(
      'SELECT id, shares FROM positions WHERE agent_id = $1 AND symbol = $2',
      [agentId, sym]
    );
    if (pos.length === 0 || parseFloat(pos[0].shares) < tradeShares) {
      return { success: false, error: 'Insufficient shares to sell', symbol: sym };
    }
    const currentShares = parseFloat(pos[0].shares);
    const proceeds = tradeShares * price;
    await pool.query(
      'UPDATE portfolios SET cash_balance = cash_balance + $1, updated_at = NOW() WHERE agent_id = $2',
      [proceeds, agentId]
    );

    const remaining = currentShares - tradeShares;
    if (remaining <= 0) {
      await pool.query('DELETE FROM positions WHERE agent_id = $1 AND symbol = $2', [agentId, sym]);
    } else {
      await pool.query(
        'UPDATE positions SET shares = $1, updated_at = NOW() WHERE agent_id = $2 AND symbol = $3',
        [remaining, agentId, sym]
      );
    }
  }

  const tradeTotal = tradeShares * price;
  const tradeId = generateId();
  const createdAtUtc = new Date().toISOString();
  await pool.query(
    'INSERT INTO trades (id, agent_id, symbol, side, shares, price, total_value, reasoning, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::timestamptz)',
    [tradeId, agentId, sym, s, tradeShares, price, tradeTotal, reasoning || null, createdAtUtc]
  );

  await savePortfolioSnapshot(pool, agentId, generateId);

  return {
    success: true,
    trade: {
      id: tradeId,
      symbol: sym,
      side: s,
      shares: tradeShares,
      price,
      total_value: tradeTotal,
      reasoning: reasoning || null,
      created_at: createdAtUtc,
    },
  };
}
