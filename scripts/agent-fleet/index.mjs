#!/usr/bin/env node
/**
 * Clawtrade Agent Fleet (stress testing / load)
 *
 * Long-running process: agents wake periodically to check portfolio and adjust.
 * Not part of the core app — uses its own env file so app config stays separate.
 *
 * Env: loaded from scripts/agent-fleet/.env.fleet (copy from .env.fleet.example in this dir).
 *   AZURE_OPENAI_API_KEY   - Required (Azure OpenAI API key)
 *   CLAWTRADE_API_URL      - API base (default https://clawtrade.net)
 *   NUM_AGENTS             - Number of agents to create if none persisted (default 5)
 *   FLEET_WAKE_INTERVAL_MS - Ms between each agent wake (default 900000 = 15 min)
 *   (target server = CLAWTRADE_API_URL; agents file derived from it, e.g. .fleet-agents-localhost.json)
 *   FLEET_AGENTS_FILE      - Override path to agents JSON (optional)
 *   FLEET_VERBOSE          - "1" to log each trade
 *
 * Run: npm run fleet
 */

import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: join(__dirname, '.env.fleet') });

import { createApiClient } from './api.js';
import { AGENT_TEMPLATES } from './config.js';
import { runCycle } from './agent.js';
import { loadAgents, saveAgents, getAgentsPath, getFleetServerId } from './persistence.js';

const DEFAULT_API_URL = process.env.CLAWTRADE_API_URL || 'https://clawtrade.net';
const NUM_AGENTS = parseInt(process.env.NUM_AGENTS || '5', 10);
const WAKE_INTERVAL_MS = parseInt(process.env.FLEET_WAKE_INTERVAL_MS || '900000', 10); // 15 min
const VERBOSE = process.env.FLEET_VERBOSE === '1';

let API_URL = DEFAULT_API_URL;
let api = createApiClient(API_URL);

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

function setApiFromUrl(url) {
  API_URL = url;
  api = createApiClient(API_URL);
}

async function ensureAgents() {
  const { fleet_server: fileFleetServer, agents: loadedAgents } = await loadAgents();

  const envUrl = process.env.CLAWTRADE_API_URL;
  if (envUrl && envUrl.trim() !== '') {
    setApiFromUrl(envUrl.trim());
  } else if (fileFleetServer) {
    setApiFromUrl(fileFleetServer);
  } else {
    setApiFromUrl(DEFAULT_API_URL);
  }

  if (loadedAgents && loadedAgents.length > 0) {
    const source = envUrl ? 'CLAWTRADE_API_URL' : `${getFleetServerId()} file`;
    console.log(`  Fleet server: ${API_URL} (from ${source})`);
    console.log(`  Loaded ${loadedAgents.length} persisted agents`);
    const agents = enrichAgentsWithDescription(loadedAgents);
    return agents;
  }

  console.log(`  Fleet server: ${API_URL} (no persisted agents for ${getFleetServerId()})`);
  const agents = await registerFleet(NUM_AGENTS);
  await saveAgents(agents, API_URL);
  console.log(`  Saved agents to ${getAgentsPath()}`);
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

  console.log('Clawtrade Agent Fleet (LangChain + Azure OpenAI)');
  console.log('==========================================\n');
  console.log(`Fleet server id: ${getFleetServerId()}`);
  console.log(`Agents file: ${getAgentsPath()}`);
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
