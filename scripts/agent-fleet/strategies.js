/**
 * Trading strategies: quote-aware, data-driven decision logic.
 * Simulates AI-like behavior without requiring an LLM.
 */

import { BUY_REASONS, SELL_REASONS, SYMBOLS } from './config.js';

export function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Fetch quotes for multiple symbols and build a price map.
 */
export function buildPriceMap(quotes) {
  const map = new Map();
  for (const [sym, data] of Object.entries(quotes)) {
    if (data && typeof data.price === 'number') map.set(sym, data.price);
  }
  return map;
}

/**
 * Strategy: Momentum Hunter
 * Prefers symbols with recent price movement. Buys on dips relative to avg.
 */
export function momentumDecision(positions, portfolio, quotes, symbols) {
  const prices = buildPriceMap(quotes);
  const cash = portfolio?.cash_balance ?? 0;
  const positionsMap = new Map(
    (positions || []).map((p) => [p.symbol, { shares: p.shares, avg_cost: p.avg_cost }])
  );

  const available = symbols.filter((s) => prices.has(s));
  if (available.length === 0) return null;

  const pricesArr = available.map((s) => ({ symbol: s, price: prices.get(s) }));
  const avgPrice = pricesArr.reduce((s, x) => s + x.price, 0) / pricesArr.length;

  const isBuy = Math.random() < 0.55 || positionsMap.size === 0;
  if (isBuy) {
    const belowAvg = pricesArr.filter((x) => x.price < avgPrice * 1.02);
    const candidates = belowAvg.length > 0 ? belowAvg : pricesArr;
    const chosen = pick(candidates);
    const maxShares = Math.floor((cash * 0.05) / chosen.price);
    if (maxShares < 5) return null;
    const shares = randomInt(5, Math.min(50, maxShares));
    return {
      action: 'buy',
      symbol: chosen.symbol,
      shares,
      reasoning: pick(BUY_REASONS),
    };
  }

  const held = [...positionsMap.keys()];
  if (held.length === 0) return null;
  const symbol = pick(held);
  const pos = positionsMap.get(symbol);
  const price = prices.get(symbol);
  if (!price || !pos) return null;
  const shares = Math.min(pos.shares, randomInt(5, Math.min(30, pos.shares)));
  if (shares < 1) return null;
  return {
    action: 'sell',
    symbol,
    shares,
    reasoning: pick(SELL_REASONS),
  };
}

/**
 * Strategy: Value Investor
 * Prefers lower-priced stocks; sells when price > avg_cost by threshold.
 */
export function valueDecision(positions, portfolio, quotes, symbols) {
  const prices = buildPriceMap(quotes);
  const cash = portfolio?.cash_balance ?? 0;
  const positionsMap = new Map(
    (positions || []).map((p) => [p.symbol, { shares: p.shares, avg_cost: p.avg_cost }])
  );

  const available = symbols.filter((s) => prices.has(s));
  if (available.length === 0) return null;

  const isBuy = Math.random() < 0.5 || positionsMap.size === 0;
  if (isBuy) {
    const sorted = [...available].sort((a, b) => prices.get(a) - prices.get(b));
    const chosen = sorted[randomInt(0, Math.min(3, sorted.length - 1))];
    const maxShares = Math.floor((cash * 0.04) / prices.get(chosen));
    if (maxShares < 5) return null;
    const shares = randomInt(5, Math.min(40, maxShares));
    return {
      action: 'buy',
      symbol: chosen,
      shares,
      reasoning: pick(BUY_REASONS),
    };
  }

  for (const [sym, pos] of positionsMap) {
    const price = prices.get(sym);
    if (!price) continue;
    const gain = (price - pos.avg_cost) / pos.avg_cost;
    if (gain > 0.08) {
      const sellShares = Math.min(pos.shares, randomInt(5, Math.min(25, pos.shares)));
      if (sellShares >= 1)
        return { action: 'sell', symbol: sym, shares: sellShares, reasoning: pick(SELL_REASONS) };
    }
  }

  const held = [...positionsMap.keys()];
  if (held.length === 0) return null;
  const symbol = pick(held);
  const pos = positionsMap.get(symbol);
  const shares = Math.min(pos.shares, randomInt(5, Math.min(20, pos.shares)));
  if (shares < 1) return null;
  return { action: 'sell', symbol, shares, reasoning: pick(SELL_REASONS) };
}

/**
 * Strategy: Tech Bull
 * Favors tech symbols (first 7 in SYMBOLS).
 */
export function techBullDecision(positions, portfolio, quotes, symbols) {
  const techSymbols = symbols.slice(0, 7);
  return momentumDecision(positions, portfolio, quotes, techSymbols);
}

/**
 * Strategy: Diversified (Index Hugger)
 * Spreads across many symbols, smaller positions.
 */
export function diversifiedDecision(positions, portfolio, quotes, symbols) {
  const prices = buildPriceMap(quotes);
  const cash = portfolio?.cash_balance ?? 0;
  const positionsMap = new Map(
    (positions || []).map((p) => [p.symbol, { shares: p.shares, avg_cost: p.avg_cost }])
  );

  const available = symbols.filter((s) => prices.has(s));
  if (available.length === 0) return null;

  const notHeld = available.filter((s) => !positionsMap.has(s));
  const isBuy = (notHeld.length > 0 && Math.random() < 0.6) || positionsMap.size === 0;
  if (isBuy && notHeld.length > 0) {
    const chosen = pick(notHeld);
    const maxShares = Math.floor((cash * 0.02) / prices.get(chosen));
    if (maxShares < 3) return null;
    const shares = randomInt(3, Math.min(25, maxShares));
    return {
      action: 'buy',
      symbol: chosen,
      shares,
      reasoning: pick(BUY_REASONS),
    };
  }

  const held = [...positionsMap.keys()];
  if (held.length === 0) return null;
  const symbol = pick(held);
  const pos = positionsMap.get(symbol);
  const shares = Math.min(pos.shares, randomInt(3, Math.min(15, pos.shares)));
  if (shares < 1) return null;
  return { action: 'sell', symbol, shares, reasoning: pick(SELL_REASONS) };
}

/**
 * Strategy: Contrarian
 * Buys when others might panic; sells into strength.
 */
export function contrarianDecision(positions, portfolio, quotes, symbols) {
  const prices = buildPriceMap(quotes);
  const cash = portfolio?.cash_balance ?? 0;
  const positionsMap = new Map(
    (positions || []).map((p) => [p.symbol, { shares: p.shares, avg_cost: p.avg_cost }])
  );

  const available = symbols.filter((s) => prices.has(s));
  if (available.length === 0) return null;

  const sorted = [...available].sort((a, b) => prices.get(a) - prices.get(b));
  const isBuy = Math.random() < 0.6 || positionsMap.size === 0;
  if (isBuy) {
    const chosen = sorted[0];
    const maxShares = Math.floor((cash * 0.06) / prices.get(chosen));
    if (maxShares < 5) return null;
    const shares = randomInt(5, Math.min(60, maxShares));
    return {
      action: 'buy',
      symbol: chosen,
      shares,
      reasoning: pick(BUY_REASONS),
    };
  }

  const held = [...positionsMap.keys()];
  if (held.length === 0) return null;
  const withPrice = held.map((s) => ({ symbol: s, price: prices.get(s), pos: positionsMap.get(s) })).filter((x) => x.price);
  if (withPrice.length === 0) return null;
  const sortedByPrice = withPrice.sort((a, b) => b.price - a.price);
  const chosen = sortedByPrice[0];
  const shares = Math.min(chosen.pos.shares, randomInt(5, Math.min(40, chosen.pos.shares)));
  if (shares < 1) return null;
  return { action: 'sell', symbol: chosen.symbol, shares, reasoning: pick(SELL_REASONS) };
}

/**
 * Default strategy: procedural (similar to original simulator).
 */
export function proceduralDecision(positions, portfolio, quotes, symbols) {
  const prices = buildPriceMap(quotes);
  const cash = portfolio?.cash_balance ?? 0;
  const positionsMap = new Map(
    (positions || []).map((p) => [p.symbol, { shares: p.shares, avg_cost: p.avg_cost }])
  );

  const available = symbols.filter((s) => prices.has(s));
  if (available.length === 0) return null;

  const isBuy = Math.random() < 0.6 || positionsMap.size === 0;
  if (isBuy) {
    const chosen = pick(available);
    const maxShares = Math.floor((cash * 0.05) / prices.get(chosen));
    if (maxShares < 5) return null;
    const shares = randomInt(5, Math.min(50, maxShares));
    return {
      action: 'buy',
      symbol: chosen,
      shares,
      reasoning: pick(BUY_REASONS),
    };
  }

  const held = [...positionsMap.keys()];
  if (held.length === 0) return null;
  const symbol = pick(held);
  const pos = positionsMap.get(symbol);
  const shares = Math.min(pos.shares, randomInt(5, Math.min(30, pos.shares)));
  if (shares < 1) return null;
  return { action: 'sell', symbol, shares, reasoning: pick(SELL_REASONS) };
}

export const STRATEGIES = {
  momentum: momentumDecision,
  value: valueDecision,
  tech: techBullDecision,
  diversified: diversifiedDecision,
  contrarian: contrarianDecision,
  procedural: proceduralDecision,
};

export function getStrategyForAgent(agentIndex) {
  const keys = Object.keys(STRATEGIES);
  return STRATEGIES[keys[agentIndex % keys.length]];
}
