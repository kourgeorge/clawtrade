/**
 * Single agent: uses LangChain AI to reason about positions and market, then trades via API.
 * Requires AZURE_OPENAI_API_KEY.
 */

import { runLangChainCycle } from './langchain-agent.js';

/**
 * Run one decision cycle for an agent (LangChain AI).
 */
export async function runCycle(agent, api, _agentIndex, options = {}) {
  const result = await runLangChainCycle(agent, api, options);
  if (result.action === 'hold') {
    return { agent: result.agent, action: 'hold', reason: result.reason };
  }
  return result;
}

/**
 * Run an agent for N cycles (trades).
 */
export async function runAgent(agent, api, agentIndex, cycles, options = {}) {
  const { delayBetweenCycles = 500, verbose = false } = options;
  const results = [];

  for (let i = 0; i < cycles; i++) {
    const r = await runCycle(agent, api, agentIndex, { verbose });
    results.push(r);
    if (delayBetweenCycles > 0) {
      await new Promise((res) => setTimeout(res, delayBetweenCycles));
    }
  }

  return results;
}
