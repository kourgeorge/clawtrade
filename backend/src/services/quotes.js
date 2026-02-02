/**
 * Quote service - fetches real prices from Yahoo Finance only.
 * No mock or random data: if Yahoo fails, the request fails.
 * In-memory cache reduces Yahoo rate-limit hits when fleet agents blast quotes.
 */

import YahooFinance from 'yahoo-finance2';

const yahooFinance = new YahooFinance({ suppressNotices: ['yahooSurvey'] });

const CACHE_TTL_MS = 60_000; // 1 minute
const quoteCache = new Map();

function getCached(sym) {
  const entry = quoteCache.get(sym);
  if (!entry) return null;
  if (Date.now() - entry.at > CACHE_TTL_MS) {
    quoteCache.delete(sym);
    return null;
  }
  return entry.data;
}

function setCached(sym, data) {
  quoteCache.set(sym, { at: Date.now(), data });
}

export async function getQuote(symbol) {
  const sym = String(symbol || '').toUpperCase().trim();
  if (!sym) {
    return { error: 'Symbol is required' };
  }

  const cached = getCached(sym);
  if (cached) return cached;

  try {
    const quote = await yahooFinance.quote(sym);
    if (!quote) {
      return { error: `No quote found for ${sym}` };
    }

    const price =
      quote.regularMarketPrice ??
      quote.postMarketPrice ??
      quote.preMarketPrice ??
      quote.regularMarketPreviousClose;

    if (price == null || !Number.isFinite(price)) {
      return { error: `Invalid price for ${sym}` };
    }

    const ts = quote.regularMarketTime ?? new Date();
    const timestamp = ts instanceof Date ? ts.toISOString() : new Date(ts).toISOString();

    const result = {
      symbol: sym,
      price: Number(price),
      timestamp,
    };
    setCached(sym, result);
    return result;
  } catch (err) {
    console.warn(`[quotes] Yahoo Finance failed for ${sym}:`, err.message);
    return { error: `Quote unavailable for ${sym}: ${err.message}` };
  }
}
