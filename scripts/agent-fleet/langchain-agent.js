/**
 * LangChain AI trading agent.
 * Uses OpenAI to reason about positions, market state, and decide what to do.
 * Tools: get_portfolio, get_quotes, place_order
 */

import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import { AzureChatOpenAI } from '@langchain/openai';
import { HumanMessage, SystemMessage, ToolMessage } from '@langchain/core/messages';
import { SYMBOLS } from './config.js';

const SYSTEM_PROMPT = `You are a paper trading AI agent. You have a portfolio with $100,000 starting cash. Tradable universe: stocks across sectors (tech, finance, healthcare, consumer, energy, industrials) plus indices/ETFs (SPY, QQQ, IWM, DIA, VOO, VTI, sector ETFs like XLK, XLF, XLE). Decide whether to buy, sell, or hold based on:

1. YOUR POSITIONS: Your current holdings (symbol, shares, avg_cost, current value)
2. MARKET STATE: Current prices from get_quotes
3. CASH: Available cash for buying

Guidelines:
- Use get_portfolio first to see your cash and positions
- Use get_quotes to check current prices for symbols you're interested in
- Consider: diversification, position sizing (don't put >10% in one stock), risk
- For sells: only sell if you hold the symbol; consider profit/loss vs avg_cost
- For buys: ensure you have enough cash (shares * price <= cash)
- Provide a concise reasoning for each trade
- You may decide to hold (place no order) if the market looks unfavorable
- Trade conservatively - this is paper trading for learning

You must call post_thought exactly once each turn with a short, interesting thought about your trading strategy or market view (1–2 sentences). Make it specific and trader-like: e.g. why you're holding, what you're watching, a sector view, or a brief reflection on your trade. Examples: "Staying defensive—keeping powder dry for a pullback in megacap tech." / "Adding to financials on the dip; rates narrative still supportive." / "Trimmed AAPL into strength; locking in gains and watching for re-entry."`;

/**
 * Create tools bound to the API and apiKey.
 */
function createTools(api, apiKey) {
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
      const toFetch = syms ?? SYMBOLS;
      const out = {};
      await Promise.all(
        toFetch.map(async (s) => {
          try {
            const r = await api.getQuote(apiKey, s);
            if (r?.price != null) out[s] = { price: r.price, symbol: r.symbol };
            else out[s] = { error: 'No price' };
          } catch (_) {
            out[s] = { error: 'No quote found' };
          }
        })
      );
      return JSON.stringify(out, null, 2);
    },
    {
      name: 'get_quotes',
      description: 'Get current stock prices. Pass an array of symbols like ["AAPL","MSFT"] or empty for all tradable symbols.',
      schema: z.object({
        symbols: z.array(z.string()).nullable().describe('Stock symbols to fetch, e.g. ["AAPL","MSFT"]. Pass null for all.'),
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
      description: 'Post a short strategic thought to your profile (required once per turn). Write 1–2 sentences: your market view, why you are holding, what you are watching, or a reflection on your trade. Be specific and interesting.',
      schema: z.object({
        content: z.string().describe('Your strategic thought or market insight (1–2 sentences, trader-like)'),
      }),
    }
  );

  return [getPortfolio, getQuotes, placeOrder, postThought];
}

/**
 * Run one agent decision cycle. Returns { action, symbol, shares, reasoning, success } or { action: 'hold' }.
 */
export async function runLangChainCycle(agent, api, options = {}) {
  const { api_key, name } = agent;
  const { verbose = false } = options;

  const llm = new AzureChatOpenAI({
    azureOpenAIApiKey: process.env.AZURE_OPENAI_API_KEY,
    azureOpenAIBasePath: process.env.AZURE_OPENAI_BASE_PATH || 'https://eteopenai.azure-api.net/openai/deployments',
    azureOpenAIApiDeploymentName: process.env.AZURE_OPENAI_DEPLOYMENT || 'gpt-4o-mini-2024-07-18',
    azureOpenAIApiVersion: process.env.AZURE_OPENAI_API_VERSION || '2024-02-15-preview',
    temperature: 0.3,
  });

  const tools = createTools(api, api_key);
  const toolMap = Object.fromEntries(tools.map((t) => [t.name, t]));
  const llmWithTools = llm.bindTools(tools);

  const messages = [
    new SystemMessage({ content: `${SYSTEM_PROMPT}\n\nYour name: ${name}` }),
    new HumanMessage({
      content: `Decide what to do. Call get_portfolio and get_quotes, then either place one trade (buy or sell) or hold. You must also call post_thought once with a short, interesting strategic thought (1–2 sentences) about your view or your trade. Be decisive.`,
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
