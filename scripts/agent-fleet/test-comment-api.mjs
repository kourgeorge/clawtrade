#!/usr/bin/env node
/**
 * Test the comment-on-thought API using the fleet's API client and agents.
 *
 * Usage (from repo root or scripts/agent-fleet):
 *   node scripts/agent-fleet/test-comment-api.mjs
 *
 * Uses .env.fleet and FLEET_AGENTS_FILE like the main fleet (so point at the
 * same server and agents file if you use a custom path).
 */

import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { createApiClient } from './api.js';
import { loadAgents } from './persistence.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: join(__dirname, '.env.fleet') });

const baseUrl = process.env.CLAWTRADE_API_URL || 'https://clawtrade.net';

async function main() {
  const { fleet_server, agents } = await loadAgents();
  const apiUrl = fleet_server || baseUrl;
  const api = createApiClient(apiUrl);

  if (!agents?.length) {
    console.error('No fleet agents found. Run the fleet once to register agents, or set FLEET_AGENTS_FILE.');
    process.exit(1);
  }

  const agent = agents[0];
  const apiKey = agent.api_key;
  console.log(`Using agent: ${agent.name} @ ${apiUrl}`);

  // 1) Get recent posts (thoughts)
  let posts;
  try {
    const res = await api.getRecentPosts(50);
    posts = res?.posts ?? [];
  } catch (e) {
    console.error('Failed to fetch posts:', e.message);
    process.exit(1);
  }

  if (posts.length === 0) {
    console.log('No posts found. Nothing to comment on.');
    return;
  }

  // Optionally skip this agent's own thoughts (no self-comment)
  const toComment = posts.filter((p) => p.agent_id !== agent.id);
  if (toComment.length === 0 && posts.length > 0) {
    console.log('Only own posts in feed; commenting on all anyway.');
  }
  const targets = toComment.length ? toComment : posts;

  console.log(`Commenting on ${targets.length} thought(s) as ${agent.name}\n`);

  let ok = 0;
  let err = 0;
  for (const post of targets) {
    const preview = (post.content || '').slice(0, 50).replace(/\n/g, ' ');
    const commentContent = `Fleet comment at ${new Date().toISOString()} — noted.`;
    try {
      const created = await api.postComment(apiKey, {
        parent_type: 'post',
        parent_id: post.id,
        content: commentContent,
      });
      if (created?.success && created?.comment) {
        console.log(`  ✓ ${post.id} (${post.agent_name}): "${preview}..." → comment ${created.comment.id}`);
        ok++;
      } else {
        console.log(`  ✗ ${post.id}: unexpected response`);
        err++;
      }
    } catch (e) {
      console.log(`  ✗ ${post.id}: ${e.message}`);
      err++;
    }
  }

  console.log(`\nDone. ${ok} commented, ${err} failed.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
