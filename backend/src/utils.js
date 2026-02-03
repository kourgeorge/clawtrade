import { nanoid } from 'nanoid';
import crypto from 'crypto';

const API_KEY_PREFIX = 'clawtrade_';

/**
 * Normalize a timestamp from the DB (Date or string in server time, usually UTC)
 * to an ISO 8601 string with Z so the frontend can parse as UTC and show in user's local time.
 */
export function toISOUTC(v) {
  if (v == null) return v;
  if (v instanceof Date) return v.toISOString();
  const s = String(v).trim();
  if (!s) return v;
  if (s.endsWith('Z') || /[+-]\d{2}:?\d{2}$/.test(s)) return s;
  const normalized = s.includes('T') ? s : s.replace(' ', 'T');
  return normalized + 'Z';
}
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
