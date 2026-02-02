#!/usr/bin/env node
/**
 * Clawtrader Agent Fleet
 *
 * Long-running process: agents wake every 15 minutes to check portfolio and adjust.
 * Agents are persisted to .fleet-agents.json so they survive restarts.
 *
 * Env:
 *   AZURE_OPENAI_API_KEY   - Required (Azure OpenAI API key)
 *   CLAWTRADER_API_URL     - API base (default http://localhost:3001)
 *   NUM_AGENTS             - Number of agents to create if none persisted (default 5)
 *   FLEET_WAKE_INTERVAL_MS - Minutes between each agent wake (default 900000 = 15 min)
 *   FLEET_AGENTS_FILE      - Path to agents JSON (default .fleet-agents.json)
 *   FLEET_VERBOSE          - "1" to log each trade
 *
 * Run: npm run fleet
 */

import 'dotenv/config';

import { createApiClient } from './api.js';
import { AGENT_TEMPLATES } from './config.js';
import { runCycle } from './agent.js';
import { loadAgents, saveAgents } from './persistence.js';

const API_URL = process.env.CLAWTRADER_API_URL || 'http://localhost:3001';
const NUM_AGENTS = parseInt(process.env.NUM_AGENTS || '5', 10);
const WAKE_INTERVAL_MS = parseInt(process.env.FLEET_WAKE_INTERVAL_MS || '900000', 10); // 15 min
const VERBOSE = process.env.FLEET_VERBOSE === '1';

const api = createApiClient(API_URL);

function uniqueSuffix() {
  return Math.random().toString(36).slice(2, 8);
}

async function registerFleet(count) {
  const templates = AGENT_TEMPLATES.slice(0, count);
  const agents = [];
  const suffix = uniqueSuffix();
  for (let i = 0; i < templates.length; i++) {
    const t = templates[i];
    const name = count > 1 ? `${t.name} ${suffix}-${i + 1}` : `${t.name} ${suffix}`;
    const agent = await api.registerAgent({ name, description: t.description });
    agents.push({ ...agent, description: agent.description ?? t.description });
    console.log(`  Registered: ${agent.name}`);
  }
  return agents;
}

function enrichAgentsWithDescription(agents) {
  return agents.map((a) => {
    if (a.description) return a;
    const template = AGENT_TEMPLATES.find((t) => a.name.startsWith(t.name));
    return { ...a, description: template?.description ?? 'General trading approach' };
  });
}

async function ensureAgents() {
  let agents = await loadAgents();
  if (agents && agents.length > 0) {
    console.log(`  Loaded ${agents.length} persisted agents`);
    agents = enrichAgentsWithDescription(agents);
    return agents;
  }
  agents = await registerFleet(NUM_AGENTS);
  await saveAgents(agents);
  console.log(`  Saved agents to ${process.env.FLEET_AGENTS_FILE || '.fleet-agents.json'}`);
  return agents;
}

function scheduleAgent(agent, index, total) {
  const staggerMs = total > 1 ? (WAKE_INTERVAL_MS / total) * index : 0;

  const runAndReschedule = async () => {
    try {
      const result = await runCycle(agent, api, index, { verbose: VERBOSE });
      if (result.action !== 'hold') {
        const price = result.price != null ? ` @ $${Number(result.price).toFixed(2)}` : '';
        const amount = result.shares != null ? ` ${result.shares} shares` : '';
        const status = result.success ? 'ok' : (result.error || 'failed');
        const line = `[${agent.name}] ${String(result.action).toUpperCase()}${amount} ${result.symbol || ''}${price} — ${status}`;
        if (result.success && VERBOSE) {
          console.log(`  ${line}`);
        } else if (!result.success) {
          console.error(`  ${line}`);
        }
      }
      // Post thought to profile: agent posts via post_thought tool; only fallback if they didn't
      if (agent.api_key && result.thought == null) {
        let fallback = '';
        if (result.action === 'hold') {
          fallback = result.reason ? String(result.reason).slice(0, 500) : 'Holding—watching for a better setup.';
        } else {
          const side = (result.action || '').toUpperCase();
          const sym = result.symbol || '';
          const qty = result.shares != null ? ` ${result.shares} shares` : '';
          const price = result.price != null ? ` @ $${Number(result.price).toFixed(2)}` : '';
          fallback = `${side} ${qty} ${sym}${price}. ${result.reasoning || result.reason || ''}`.trim();
        }
        if (fallback) {
          try {
            await api.postThought(agent.api_key, fallback);
          } catch (e) {
            console.error(`  [${agent.name}] Post thought failed:`, e.message);
          }
        }
      }
    } catch (err) {
      console.error(`  [${agent.name}] Error:`, err.message);
      if (err.cause) console.error(`  [${agent.name}] Cause:`, err.cause);
    }
    setTimeout(runAndReschedule, WAKE_INTERVAL_MS);
  };

  setTimeout(runAndReschedule, staggerMs);
}

async function main() {
  if (!process.env.AZURE_OPENAI_API_KEY) {
    console.error('Error: AZURE_OPENAI_API_KEY is required. Set it in .env or environment.');
    process.exit(1);
  }

  console.log('Clawtrader Agent Fleet (LangChain + Azure OpenAI)');
  console.log('==========================================\n');
  console.log(`API: ${API_URL}`);
  console.log(`Wake interval: ${WAKE_INTERVAL_MS / 60000} minutes per agent`);
  console.log('');

  const agents = await ensureAgents();
  if (agents.length === 0) {
    console.error('No agents available. Check persistence or registration.');
    process.exit(1);
  }

  console.log(`\nScheduling ${agents.length} agents. Ctrl+C to stop.\n`);

  agents.forEach((agent, i) => scheduleAgent(agent, i, agents.length));

  process.on('SIGINT', () => {
    console.log('\nShutting down...');
    process.exit(0);
  });
  process.on('SIGTERM', () => {
    console.log('\nShutting down...');
    process.exit(0);
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
