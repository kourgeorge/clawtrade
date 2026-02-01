import { nanoid } from 'nanoid';
import crypto from 'crypto';

const API_KEY_PREFIX = 'clawtrader_';
const API_KEY_LENGTH = 32;

export function generateId() {
  return nanoid(21);
}

export function generateApiKey() {
  const randomPart = crypto.randomBytes(API_KEY_LENGTH).toString('base64url').slice(0, API_KEY_LENGTH);
  return `${API_KEY_PREFIX}${randomPart}`;
}

export function hashApiKey(apiKey) {
  return crypto.createHash('sha256').update(apiKey).digest('hex');
}

export function getApiKeyPrefix(apiKey) {
  return apiKey.slice(0, 15) + '...';
}
