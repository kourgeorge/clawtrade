import { pool } from '../db.js';
import { hashApiKey } from '../utils.js';

export async function agentAuth(request, reply) {
  const authHeader = request.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return reply.status(401).send({
      success: false,
      error: 'Missing or invalid Authorization header',
      hint: 'Use: Authorization: Bearer YOUR_API_KEY',
    });
  }

  const apiKey = authHeader.slice(7);
  const apiKeyHash = hashApiKey(apiKey);

  const { rows } = await pool.query(
    'SELECT id, name, description, created_at FROM agents WHERE api_key_hash = $1',
    [apiKeyHash]
  );

  if (rows.length === 0) {
    return reply.status(401).send({
      success: false,
      error: 'Invalid API key',
      hint: 'Check that your API key is correct',
    });
  }

  request.agent = rows[0];
}
