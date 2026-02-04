/**
 * Fetch stock-related news from Yahoo Finance (fleet only; backend does not use this).
 * Uses yahoo-finance2 search(symbol, { newsCount }) which returns related news articles.
 */

import YahooFinance from 'yahoo-finance2';

const yahoo = new YahooFinance({ suppressNotices: ['yahooSurvey'] });

const NEWS_PER_SYMBOL = 5;
const DELAY_BETWEEN_SYMBOLS_MS = 300;

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Get recent news for one symbol from Yahoo Finance.
 * @param {string} symbol - Ticker (e.g. AAPL)
 * @returns {Promise<{ symbol: string, news: Array<{ title: string, publisher: string, link: string, time: string }> }>}
 */
export async function getNewsForSymbol(symbol) {
  const sym = String(symbol || '').toUpperCase().trim();
  if (!sym) {
    return { symbol: sym || symbol, news: [], error: 'Symbol required' };
  }
  try {
    const result = await yahoo.search(sym, { newsCount: NEWS_PER_SYMBOL });
    const news = (result.news || []).slice(0, NEWS_PER_SYMBOL).map((n) => ({
      title: n.title || '',
      publisher: n.publisher || '',
      link: n.link || '',
      time: n.providerPublishTime instanceof Date ? n.providerPublishTime.toISOString() : String(n.providerPublishTime || ''),
    }));
    return { symbol: sym, news };
  } catch (err) {
    return { symbol: sym, news: [], error: err.message };
  }
}

/**
 * Get news for multiple symbols with throttling to avoid Yahoo rate limits.
 * @param {string[]} symbols - Tickers (e.g. ['AAPL', 'MSFT'])
 * @returns {Promise<Object<string, { symbol: string, news: Array }>>}
 */
export async function getNewsForSymbols(symbols) {
  const list = Array.isArray(symbols) ? [...symbols] : [];
  const out = {};
  for (const sym of list) {
    const key = String(sym).toUpperCase().trim();
    if (!key) continue;
    out[key] = await getNewsForSymbol(key);
    if (list.indexOf(sym) < list.length - 1) await sleep(DELAY_BETWEEN_SYMBOLS_MS);
  }
  return out;
}
