import { pool } from '../db.js';
import { toISOUTC } from '../utils.js';
import { getQuote } from '../services/quotes.js';

export async function getPositions(request, reply) {
  const agentId = request.agent.id;
  const { rows } = await pool.query(
    'SELECT id, symbol, shares, avg_cost, created_at FROM positions WHERE agent_id = $1 ORDER BY symbol',
    [agentId]
  );

  const positions = rows.map((p) => ({
    ...p,
    created_at: toISOUTC(p.created_at),
    shares: parseFloat(p.shares),
    avg_cost: parseFloat(p.avg_cost),
  }));

  return reply.send({ success: true, positions });
}

export async function getTrades(request, reply) {
  const agentId = request.agent.id;
  const { limit = 50 } = request.query || {};
  const limitNum = Math.min(parseInt(limit) || 50, 100);

  const { rows } = await pool.query(
    'SELECT id, symbol, side, shares, price, total_value, reasoning, created_at FROM trades WHERE agent_id = $1 ORDER BY created_at DESC LIMIT $2',
    [agentId, limitNum]
  );

  const trades = rows.map((t) => ({
    ...t,
    created_at: toISOUTC(t.created_at),
    shares: parseFloat(t.shares),
    price: parseFloat(t.price),
    total_value: parseFloat(t.total_value),
  }));

  return reply.send({ success: true, trades });
}

export async function getPortfolio(request, reply) {
  const agentId = request.agent.id;

  const { rows: portfolio } = await pool.query(
    'SELECT cash_balance, starting_balance FROM portfolios WHERE agent_id = $1',
    [agentId]
  );

  let cashBalance = 0;
  let startingBalance = 100000;
  if (portfolio.length > 0) {
    cashBalance = parseFloat(portfolio[0].cash_balance);
    startingBalance = parseFloat(portfolio[0].starting_balance);
  } else {
    cashBalance = startingBalance;
  }

  const { rows: posRows } = await pool.query(
    'SELECT symbol, shares, avg_cost FROM positions WHERE agent_id = $1',
    [agentId]
  );

  const positions = [];
  let positionsValue = 0;
  for (const p of posRows) {
    const quote = await getQuote(p.symbol);
    const currentPrice = quote.error ? parseFloat(p.avg_cost) : quote.price;
    const shares = parseFloat(p.shares);
    const avgCost = parseFloat(p.avg_cost);
    const value = shares * currentPrice;
    positionsValue += value;
    positions.push({
      symbol: p.symbol,
      shares,
      avg_cost: avgCost,
      current_price: currentPrice,
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
