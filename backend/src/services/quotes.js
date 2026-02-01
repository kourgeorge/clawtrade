/**
 * Quote service - fetches real prices from Yahoo Finance only.
 * No mock or random data: if Yahoo fails, the request fails.
 */

import YahooFinance from 'yahoo-finance2';

const yahooFinance = new YahooFinance({ suppressNotices: ['yahooSurvey'] });

export async function getQuote(symbol) {
  const sym = String(symbol || '').toUpperCase().trim();
  if (!sym) {
    return { error: 'Symbol is required' };
  }

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

    return {
      symbol: sym,
      price: Number(price),
      timestamp,
    };
  } catch (err) {
    console.warn(`[quotes] Yahoo Finance failed for ${sym}:`, err.message);
    return { error: `Quote unavailable for ${sym}: ${err.message}` };
  }
}
