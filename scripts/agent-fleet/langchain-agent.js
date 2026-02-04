/**
 * LangChain AI trading agent.
 * Uses OpenAI to reason about positions, market state, and decide what to do.
 * Tools: get_portfolio, get_quotes, get_news (Yahoo Finance), place_order
 */

import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import { AzureChatOpenAI } from '@langchain/openai';
import { HumanMessage, SystemMessage, ToolMessage } from '@langchain/core/messages';
import { SYMBOLS, CORE_SYMBOLS } from './config.js';
import { getNewsForSymbols } from './yahoo-news.js';

/** Throttle quote fetches to avoid Yahoo rate limits. Batch size and delay between batches. */
const QUOTE_BATCH_SIZE = 8;
const QUOTE_BATCH_DELAY_MS = 150;

async function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function fetchQuotesInBatches(api, apiKey, symbols, out) {
  for (let i = 0; i < symbols.length; i += QUOTE_BATCH_SIZE) {
    const batch = symbols.slice(i, i + QUOTE_BATCH_SIZE);
    await Promise.all(
      batch.map(async (s) => {
        try {
          const r = await api.getQuote(apiKey, s);
          if (r?.price != null) out[s] = { price: r.price, symbol: r.symbol };
          else out[s] = { error: 'No price' };
        } catch (_) {
          out[s] = { error: 'No quote found' };
        }
      })
    );
    if (i + QUOTE_BATCH_SIZE < symbols.length) await sleep(QUOTE_BATCH_DELAY_MS);
  }
}

const SYSTEM_PROMPT = `You are a paper trading AI agent. You have a portfolio with $100,000 starting cash. Tradable universe: stocks across sectors (tech, finance, healthcare, consumer, energy, industrials) plus indices/ETFs (SPY, QQQ, IWM, DIA, VOO, VTI, sector ETFs like XLK, XLF, XLE). Decide whether to buy, sell, or hold based on:

1. YOUR POSITIONS: Your current holdings (symbol, shares, avg_cost, current value)
2. MARKET STATE: Current prices from get_quotes
3. CASH: Available cash for buying
4. NEWS (optional): Use get_news to fetch recent Yahoo Finance headlines for symbols you hold or are evaluating—helps inform thesis and timing.

Guidelines:
- Use get_portfolio first to see your cash and positions
- Use get_quotes with only the symbols you hold or are evaluating (e.g. your positions + a few candidates)—avoid fetching every symbol
- Optionally use get_news for a small set of symbols (e.g. your top positions or candidates) to factor recent headlines into your decision
- Consider: diversification, position sizing (don't put >10% in one stock), risk
- For sells: only sell if you hold the symbol; consider profit/loss vs avg_cost
- For buys: ensure you have enough cash (shares * price <= cash)
- Provide a concise reasoning for each trade
- You may decide to hold (place no order) if the market looks unfavorable
- Trade conservatively - this is paper trading for learning

You must call post_thought exactly once each turn with a short thought (1–2 sentences) that sounds like a real trader—natural, opinionated, and sometimes provocative. Write as if you're posting to FinTwit or a trading chat:
- Take a stance: defend your approach, call out what the crowd might be missing, or admit when you're second-guessing
- Use a conversational tone: contractions, punchy sentences, conviction (or genuine doubt)
- Be specific: name sectors, names, or setups; avoid generic filler
- When you used get_news: your thought must reference the news—mention a headline, theme, or what the news made you do (e.g. "That AAPL downgrade headline had me trimming into the open." / "Nothing in the MSFT news changes the cloud thesis; adding on the dip.")
- Good vibes: "Sticking with the thesis—everyone's been wrong on rates before." / "Trimmed into strength and I don't care. Lock in gains first, FOMO later." / "Maybe I'm early on this one but the setup's too clean to pass." / "Was wrong on tech last week. Pivoting to financials—rates narrative hasn't changed." / "Holding. Not chasing here; I'll wait for my level."`;

/**
 * Create tools bound to the API, apiKey, and agent name (for console logging).
 */
function createTools(api, apiKey, agentName) {
  const logPrefix = agentName ? `[${agentName}] ` : '';
  const getPortfolio = tool(
    async () => {
      const portfolio = await api.getPortfolio(apiKey);
      return JSON.stringify(portfolio, null, 2);
    },
    {
      name: 'get_portfolio',
      description: 'Get your portfolio: cash_balance, total_value, pnl, and current positions (symbol, shares, avg_cost, current_price, value)',
      schema: z.object({}),
    }
  );

  const getQuotes = tool(
    async (input = {}) => {
      const symbols = input?.symbols;
      const syms = Array.isArray(symbols) && symbols.length > 0 ? symbols : null;
      const toFetch = syms ?? CORE_SYMBOLS;
      const out = {};
      await fetchQuotesInBatches(api, apiKey, toFetch, out);
      return JSON.stringify(out, null, 2);
    },
    {
      name: 'get_quotes',
      description: 'Get current stock prices. Prefer passing only symbols you hold or are considering, e.g. ["AAPL","SPY","QQQ"]. Pass null for a core set of liquid indices and majors.',
      schema: z.object({
        symbols: z.array(z.string()).nullable().describe('Symbols to fetch, e.g. ["AAPL","MSFT","SPY"]. Pass null for core set only.'),
      }),
    }
  );

  const getNews = tool(
    async ({ symbols }) => {
      const list = Array.isArray(symbols) && symbols.length > 0 ? symbols : [];
      const limited = list.slice(0, 5);
      const out = await getNewsForSymbols(limited);
      for (const [sym, data] of Object.entries(out)) {
        if (data.error) {
          console.log(`${logPrefix}[News] ${sym}: error — ${data.error}`);
        } else if (data.news?.length) {
          console.log(`${logPrefix}[News] ${sym}:`);
          data.news.forEach((n, i) => {
            console.log(`${logPrefix}  ${i + 1}. ${n.title || '(no title)'} (${n.publisher || '?'})`);
          });
        } else {
          console.log(`${logPrefix}[News] ${sym}: no articles`);
        }
      }
      return JSON.stringify(out, null, 2);
    },
    {
      name: 'get_news',
      description: 'Get recent stock-related news headlines from Yahoo Finance for the given symbols. Use for symbols you hold or are evaluating. Pass a small list (e.g. 1–5 symbols) to avoid rate limits.',
      schema: z.object({
        symbols: z.array(z.string()).describe('Symbols to fetch news for, e.g. ["AAPL","MSFT"]. Prefer 1–5 symbols.'),
      }),
    }
  );

  const placeOrder = tool(
    async ({ symbol, side, shares, reasoning }) => {
      const result = await api.placeOrder(apiKey, {
        symbol: String(symbol).toUpperCase(),
        side: side.toLowerCase(),
        shares: Number(shares),
        reasoning: reasoning || null,
      });
      return JSON.stringify(result);
    },
    {
      name: 'place_order',
      description: 'Place a buy or sell order. side must be "buy" or "sell". shares must be a positive number. reasoning explains why.',
      schema: z.object({
        symbol: z.string().describe('Stock ticker, e.g. AAPL'),
        side: z.enum(['buy', 'sell']),
        shares: z.number().positive().describe('Number of shares to trade'),
        reasoning: z.string().nullable().describe('Brief reason for the trade'),
      }),
    }
  );

  const postThought = tool(
    async ({ content }) => {
      const result = await api.postThought(apiKey, String(content));
      return JSON.stringify(result);
    },
    {
      name: 'post_thought',
      description: 'Post a short thought to your profile (required once per turn). Sound like a real trader: natural, opinionated, provocative. Defend your thesis, call out what others miss, or admit uncertainty. If you called get_news, your thought must reference the news—mention a headline, theme, or how the news influenced your move. Use contractions, punchy language, conviction or doubt. 1–2 sentences, specific to your view, trade, or news.',
      schema: z.object({
        content: z.string().describe('Natural, provocative trader thought: stance, defense of approach, or second-guessing. When you used get_news, reference the news (headline/theme) in this thought. 1–2 sentences.'),
      }),
    }
  );

  return [getPortfolio, getQuotes, getNews, placeOrder, postThought];
}

/**
 * Run one agent decision cycle. Returns { action, symbol, shares, reasoning, success } or { action: 'hold' }.
 */
export async function runLangChainCycle(agent, api, options = {}) {
  const { api_key, name, description } = agent;
  const { verbose = false } = options;

  const llm = new AzureChatOpenAI({
    azureOpenAIApiKey: process.env.AZURE_OPENAI_API_KEY,
    azureOpenAIBasePath: process.env.AZURE_OPENAI_BASE_PATH || 'https://eteopenai.azure-api.net/openai/deployments',
    azureOpenAIApiDeploymentName: process.env.AZURE_OPENAI_DEPLOYMENT || 'gpt-4o-mini-2024-07-18',
    azureOpenAIApiVersion: process.env.AZURE_OPENAI_API_VERSION || '2024-02-15-preview',
    temperature: 0.5, // Slightly higher for more natural, varied, opinionated thoughts
  });

  const tools = createTools(api, api_key, name);
  const toolMap = Object.fromEntries(tools.map((t) => [t.name, t]));
  const llmWithTools = llm.bindTools(tools);

  const strategyBlock = description
    ? `\n\nYour trading strategy (follow this): ${description}. Your decisions must align with this style.`
    : '';
  const messages = [
    new SystemMessage({ content: `${SYSTEM_PROMPT}\n\nYour name: ${name}${strategyBlock}` }),
    new HumanMessage({
      content: `Decide what to do. Call get_portfolio and get_quotes; optionally call get_news for symbols you care about. Then either place one trade (buy or sell) or hold. You must also call post_thought once: if you used get_news, your thought must talk about the news (headlines, themes, or how it influenced you); otherwise defend your approach, take a stance, or admit second-guessing. Be decisive.`,
    }),
  ];

  let iterations = 0;
  const maxIterations = 10;
  let postedThought = null;

  while (iterations < maxIterations) {
    iterations++;
    let response;
    try {
      response = await llmWithTools.invoke(messages);
    } catch (err) {
      const msg = err?.message ?? String(err);
      const detail = err?.response?.data ?? err?.response ?? err?.status ?? '';
      const full = detail ? `${msg} — ${JSON.stringify(detail)}` : msg;
      console.error(`  [${name}] LLM request failed:`, full);
      throw err;
    }

    if (!response.tool_calls?.length) {
      if (verbose) console.log(`  [${name}] Decided to hold: ${(response.content || '').slice(0, 100)}`);
      return { agent: name, action: 'hold', reason: String(response.content || 'No trade'), thought: postedThought };
    }

    let placeOrderResult = null;
    let placeOrderArgs = null;

    messages.push(response);

    for (const tc of response.tool_calls) {
      const toolFn = toolMap[tc.name];
      if (!toolFn) continue;

      let args = tc.args;
      if (typeof args === 'string') {
        try {
          args = JSON.parse(args);
        } catch {
          args = {};
        }
      }

      const result = await toolFn.invoke(args);

      if (tc.name === 'place_order') {
        placeOrderArgs = args;
        try {
          placeOrderResult = typeof result === 'string' ? JSON.parse(result) : result;
        } catch {
          placeOrderResult = { success: false, error: 'Parse error' };
        }
      }
      if (tc.name === 'post_thought' && args?.content) {
        postedThought = String(args.content).trim();
      }

      messages.push(
        new ToolMessage({
          content: typeof result === 'string' ? result : JSON.stringify(result),
          tool_call_id: tc.id,
        })
      );
    }

    if (placeOrderArgs && placeOrderResult !== null) {
      const success = placeOrderResult?.success === true;
      const trade = placeOrderResult?.trade || {};
      return {
        agent: name,
        action: placeOrderArgs?.side || 'hold',
        symbol: placeOrderArgs?.symbol,
        shares: placeOrderArgs?.shares ?? trade?.shares,
        price: trade?.price,
        total_value: trade?.total_value,
        reasoning: placeOrderArgs?.reasoning,
        success,
        error: placeOrderResult?.error,
        thought: postedThought || null,
      };
    }

    if (postedThought !== null) {
      return { agent: name, action: 'hold', reason: postedThought, thought: postedThought };
    }
  }

  return { agent: name, action: 'hold', reason: 'Max iterations reached', thought: null };
}
