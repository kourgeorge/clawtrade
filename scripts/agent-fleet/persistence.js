/**
 * Persist agents to file so they survive process restarts.
 * File contains api_keys - keep it out of version control.
 */

import { readFile, writeFile, mkdir } from 'fs/promises';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const DEFAULT_PATH = join(__dirname, '../../.fleet-agents.json');

export function getAgentsPath() {
  return process.env.FLEET_AGENTS_FILE || DEFAULT_PATH;
}

export async function loadAgents() {
  const path = getAgentsPath();
  try {
    const data = await readFile(path, 'utf8');
    const parsed = JSON.parse(data);
    const agents = Array.isArray(parsed) ? parsed : parsed?.agents ?? [];
    return agents.filter((a) => a?.id && a?.name && a?.api_key);
  } catch (err) {
    if (err.code === 'ENOENT') return null;
    throw err;
  }
}

export async function saveAgents(agents) {
  const path = getAgentsPath();
  const dir = dirname(path);
  await mkdir(dir, { recursive: true });
  await writeFile(
    path,
    JSON.stringify(
      {
        agents,
        updated_at: new Date().toISOString(),
      },
      null,
      2
    ),
    'utf8'
  );
}
