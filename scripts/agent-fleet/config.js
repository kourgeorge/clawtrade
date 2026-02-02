/**
 * Fleet configuration: symbols, agent templates, and defaults.
 * Large universe: indices/ETFs, tech, finance, consumer, healthcare, energy, industrials.
 */

/** Smaller default set for get_quotes fallback - reduces Yahoo rate-limit hits. Liquid, reliable symbols only. */
export const CORE_SYMBOLS = [
  'SPY', 'QQQ', 'IWM', 'VOO', 'VTI', 'XLK', 'XLF', 'XLE',
  'AAPL', 'MSFT', 'GOOGL', 'AMZN', 'META', 'NVDA', 'TSLA',
  'JPM', 'V', 'JNJ', 'UNH', 'XOM',
];

export const SYMBOLS = [
  // Indices & broad market ETFs
  'SPY', 'QQQ', 'IWM', 'DIA', 'VOO', 'VTI', 'VEA', 'VWO', 'EEM',
  'IVV', 'RSP', 'MDY', 'VTV', 'VUG', 'VB', 'VO',
  // Sector ETFs
  'XLK', 'XLF', 'XLE', 'XLV', 'XLY', 'XLP', 'XLI', 'XLB', 'XLU', 'XLRE',
  // Tech
  'AAPL', 'MSFT', 'GOOGL', 'GOOG', 'AMZN', 'META', 'NVDA', 'TSLA', 'AMD', 'INTC',
  'CRM', 'ORCL', 'ADBE', 'CSCO', 'AVGO', 'QCOM', 'IBM', 'NOW', 'INTU', 'AMAT',
  'MU', 'LRCX', 'KLAC', 'SNPS', 'CDNS', 'PANW', 'CRWD', 'SNOW', 'MDB', 'DDOG',
  'NFLX', 'PYPL', 'SHOP', 'UBER', 'ABNB',  // SQ removed: Yahoo often returns "No quote found"
  // Finance
  'JPM', 'BAC', 'WFC', 'GS', 'MS', 'C', 'V', 'MA', 'AXP', 'BLK', 'SCHW',
  'BK', 'USB', 'PNC', 'TFC', 'COF', 'AIG', 'MET', 'PRU', 'SPGI',  // MMC removed: Yahoo often returns "No quote found"
  // Healthcare
  'JNJ', 'UNH', 'PFE', 'ABBV', 'MRK', 'LLY', 'TMO', 'ABT', 'DHR', 'BMY',
  'AMGN', 'GILD', 'CVS', 'CI', 'HUM', 'MDT', 'SYK', 'ZBH', 'ISRG', 'DXCM',
  // Consumer
  'WMT', 'HD', 'PG', 'KO', 'PEP', 'COST', 'MCD', 'NKE', 'SBUX', 'TGT',
  'LOW', 'DIS', 'CMCSA', 'T', 'VZ', 'TMUS',
  // Energy & Industrials
  'XOM', 'CVX', 'COP', 'EOG', 'SLB', 'MPC', 'PSX', 'VLO', 'OXY',
  'CAT', 'DE', 'HON', 'UPS', 'RTX', 'LMT', 'BA', 'GE', 'UNP', 'FDX',
  // International / ADRs
  'ASML', 'TM', 'NVO', 'SAP', 'AZN', 'GSK', 'BP', 'SHEL', 'TTE',
];

export const AGENT_TEMPLATES = [
  { name: 'Momentum Hunter', description: 'Chases momentum and breakout plays' },
  { name: 'Value Investor', description: 'Bottom-fishing undervalued large caps' },
  { name: 'Tech Bull', description: 'Long-term believer in big tech' },
  { name: 'Swing Trader', description: 'Short-term swings on volatility' },
  { name: 'Dividend Seeker', description: 'Focus on high-yield blue chips' },
  { name: 'Growth Chaser', description: 'High-growth names, higher risk' },
  { name: 'Index Hugger', description: 'Diversified across majors' },
  { name: 'Contrarian Bot', description: 'Buys fear, sells greed' },
  { name: 'Macro Trader', description: 'Sector rotation and macro themes' },
  { name: 'Quant Alpha', description: 'Data-driven systematic approach' },
];

export const BUY_REASONS = [
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
  'Mean reversion from oversold',
  'Breakout on volume confirmation',
];

export const SELL_REASONS = [
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
  'Risk management; trimming winners',
  'Divergence on momentum indicators',
];
