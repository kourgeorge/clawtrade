/**
 * Persist agents to file so they survive process restarts.
 * Target server = CLAWTRADE_API_URL in .env.fleet; agents file is derived from that URL (e.g. .fleet-agents-localhost.json, .fleet-agents-clawtrade_net.json).
 * File contains fleet_server (API base URL), agents, api_keys - keep out of version control.
 */

import { readFile, writeFile, mkdir } from 'fs/promises';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DEFAULT_DIR = __dirname;

function getServerSlug() {
  const url = process.env.CLAWTRADE_API_URL || '';
  if (!url || url.trim() === '') return 'default';
  try {
    const u = new URL(url.trim());
    return (u.hostname || 'default').replace(/\./g, '_');
  } catch {
    return 'default';
  }
}

export function getFleetServerId() {
  return getServerSlug();
}

export function getAgentsPath() {
  if (process.env.FLEET_AGENTS_FILE) {
    return process.env.FLEET_AGENTS_FILE;
  }
  return join(DEFAULT_DIR, `.fleet-agents-${getServerSlug()}.json`);
}

/**
 * Load agents and fleet_server from the server-specific file.
 * @returns {{ fleet_server: string | null, agents: Array | null }} fleet_server from file (or null), agents array (or null if no file / empty)
 */
export async function loadAgents() {
  const path = getAgentsPath();
  try {
    const data = await readFile(path, 'utf8');
    const parsed = JSON.parse(data);
    const agents = Array.isArray(parsed) ? parsed : parsed?.agents ?? [];
    const valid = agents.filter((a) => a?.id && a?.name && a?.api_key);
    const fleet_server =
      parsed?.fleet_server != null && String(parsed.fleet_server).trim() !== ''
        ? String(parsed.fleet_server).trim()
        : null;
    return { fleet_server, agents: valid.length ? valid : null };
  } catch (err) {
    if (err.code === 'ENOENT') return { fleet_server: null, agents: null };
    throw err;
  }
}

/**
 * Save agents to the server-specific file, including fleet_server (API base URL).
 * @param {Array} agents
 * @param {string} fleetServerUrl - API base URL for this fleet (e.g. http://localhost:3001 or https://clawtrade.net)
 */
export async function saveAgents(agents, fleetServerUrl) {
  const path = getAgentsPath();
  const dir = dirname(path);
  await mkdir(dir, { recursive: true });
  const payload = {
    fleet_server: fleetServerUrl,
    agents,
    updated_at: new Date().toISOString(),
  };
  await writeFile(path, JSON.stringify(payload, null, 2), 'utf8');
}
