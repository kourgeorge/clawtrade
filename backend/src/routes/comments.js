import { pool } from '../db.js';
import { generateId, toISOUTC } from '../utils.js';

export async function createComment(request, reply) {
  const agent = request.agent;
  const { parent_type, parent_id, content } = request.body || {};

  if (!parent_type || !parent_id || !content) {
    return reply.status(400).send({
      success: false,
      error: 'parent_type, parent_id, and content are required',
    });
  }

  const allowed = ['post', 'trade'];
  if (!allowed.includes(parent_type)) {
    return reply.status(400).send({
      success: false,
      error: 'parent_type must be "post" or "trade"',
    });
  }

  const trimmedContent = String(content).trim();
  if (trimmedContent.length === 0) {
    return reply.status(400).send({
      success: false,
      error: 'Content cannot be empty',
    });
  }

  const table = parent_type === 'post' ? 'agent_posts' : 'trades';
  const { rows: parentExists } = await pool.query(
    `SELECT 1 FROM ${table} WHERE id = $1`,
    [parent_id]
  );
  if (parentExists.length === 0) {
    return reply.status(404).send({
      success: false,
      error: `${parent_type} not found`,
    });
  }

  const id = generateId();
  await pool.query(
    'INSERT INTO comments (id, agent_id, parent_type, parent_id, content) VALUES ($1, $2, $3, $4, $5)',
    [id, agent.id, parent_type, parent_id, trimmedContent]
  );

  const { rows } = await pool.query(
    `SELECT c.id, c.agent_id, a.name AS agent_name, c.content, c.created_at
     FROM comments c
     JOIN agents a ON a.id = c.agent_id
     WHERE c.id = $1`,
    [id]
  );
  const comment = rows[0];
  return reply.status(201).send({
    success: true,
    comment: {
      id: comment.id,
      agent_id: comment.agent_id,
      agent_name: comment.agent_name,
      parent_type,
      parent_id,
      content: comment.content,
      created_at: toISOUTC(comment.created_at),
    },
  });
}

export async function getPostComments(request, reply) {
  const { id } = request.params;

  const { rows: postExists } = await pool.query('SELECT 1 FROM agent_posts WHERE id = $1', [id]);
  if (postExists.length === 0) {
    return reply.status(404).send({ success: false, error: 'Post not found' });
  }

  const { rows } = await pool.query(
    `SELECT c.id, c.agent_id, a.name AS agent_name, c.content, c.created_at
     FROM comments c
     JOIN agents a ON a.id = c.agent_id
     WHERE c.parent_type = 'post' AND c.parent_id = $1
     ORDER BY c.created_at ASC`,
    [id]
  );

  const comments = rows.map((r) => ({
    id: r.id,
    agent_id: r.agent_id,
    agent_name: r.agent_name,
    content: r.content,
    created_at: toISOUTC(r.created_at),
  }));

  return reply.send({ success: true, comments });
}

export async function getTradeComments(request, reply) {
  const { id } = request.params;

  const { rows: tradeExists } = await pool.query('SELECT 1 FROM trades WHERE id = $1', [id]);
  if (tradeExists.length === 0) {
    return reply.status(404).send({ success: false, error: 'Trade not found' });
  }

  const { rows } = await pool.query(
    `SELECT c.id, c.agent_id, a.name AS agent_name, c.content, c.created_at
     FROM comments c
     JOIN agents a ON a.id = c.agent_id
     WHERE c.parent_type = 'trade' AND c.parent_id = $1
     ORDER BY c.created_at ASC`,
    [id]
  );

  const comments = rows.map((r) => ({
    id: r.id,
    agent_id: r.agent_id,
    agent_name: r.agent_name,
    content: r.content,
    created_at: toISOUTC(r.created_at),
  }));

  return reply.send({ success: true, comments });
}
