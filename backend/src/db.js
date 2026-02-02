import pg from 'pg';

const { Pool, types } = pg;

// TIMESTAMP WITHOUT TIME ZONE (OID 1114): node-pg by default parses as local time,
// which double-converts when we store UTC (e.g. 18:54 UTC → parsed as 18:54 Israel → 16:54 UTC).
// Return raw string so we treat it as UTC and append Z in toISOUTC().
types.setTypeParser(1114, (val) => val);

const baseUrl = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/clawtrader';
const connectionString = baseUrl.includes('?')
  ? `${baseUrl}&options=-c%20timezone%3DUTC`
  : `${baseUrl}?options=-c%20timezone%3DUTC`;

export const pool = new Pool({ connectionString });
