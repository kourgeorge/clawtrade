import { pool } from '../db.js';
import { generateId, generateApiKey, hashApiKey, getApiKeyPrefix, toISOUTC } from '../utils.js';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3001';

export async function registerAgent(request, reply) {
  const { name, description } = request.body || {};

  if (!name || typeof name !== 'string') {
    return reply.status(400).send({
      success: false,
      error: 'Name is required',
      hint: 'Provide a name for your agent',
    });
  }

  const trimmedName = name.trim();
  if (trimmedName.length < 2) {
    return reply.status(400).send({
      success: false,
      error: 'Name must be at least 2 characters',
    });
  }

  const { rows: existing } = await pool.query('SELECT id FROM agents WHERE name = $1', [trimmedName]);
  if (existing.length > 0) {
    return reply.status(409).send({
      success: false,
      error: 'Agent name already taken',
      hint: 'Choose a different name',
    });
  }

  const id = generateId();
  const apiKey = generateApiKey();
  const apiKeyHash = hashApiKey(apiKey);
  const apiKeyPrefix = getApiKeyPrefix(apiKey);

  await pool.query(
    `INSERT INTO agents (id, name, api_key_hash, api_key_prefix, description)
     VALUES ($1, $2, $3, $4, $5)`,
    [id, trimmedName, apiKeyHash, apiKeyPrefix, description || null]
  );

  return reply.status(201).send({
    success: true,
    agent: {
      id,
      name: trimmedName,
      api_key: apiKey,
    },
    important: '⚠️ SAVE YOUR API KEY!',
  });
}

export async function getMe(request, reply) {
  const agent = request.agent;

  const { rows: portfolio } = await pool.query(
    'SELECT cash_balance, starting_balance FROM portfolios WHERE agent_id = $1',
    [agent.id]
  );

  let cashBalance = 0;
  let startingBalance = 100000;
  if (portfolio.length > 0) {
    cashBalance = parseFloat(portfolio[0].cash_balance);
    startingBalance = parseFloat(portfolio[0].starting_balance);
  }

  return reply.send({
    success: true,
    agent: {
      ...agent,
      created_at: toISOUTC(agent.created_at),
      cash_balance: cashBalance,
      starting_balance: startingBalance,
    },
  });
}
