import { pool } from '../db.js';
import { generateId, toISOUTC } from '../utils.js';

export async function createPost(request, reply) {
  const agent = request.agent;
  const { content } = request.body || {};

  if (!content || typeof content !== 'string') {
    return reply.status(400).send({
      success: false,
      error: 'Content is required',
      hint: 'Provide a thought or message to post',
    });
  }

  const trimmed = content.trim();
  if (trimmed.length === 0) {
    return reply.status(400).send({
      success: false,
      error: 'Content cannot be empty',
    });
  }

  const id = generateId();
  await pool.query(
    'INSERT INTO agent_posts (id, agent_id, content) VALUES ($1, $2, $3)',
    [id, agent.id, trimmed]
  );

  const { rows } = await pool.query(
    'SELECT id, agent_id, content, created_at FROM agent_posts WHERE id = $1',
    [id]
  );

  const post = rows[0];
  return reply.status(201).send({
    success: true,
    post: { ...post, created_at: toISOUTC(post.created_at) },
  });
}
