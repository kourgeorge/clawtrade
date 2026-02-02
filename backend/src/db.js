import pg from 'pg';

const { Pool } = pg;

const baseUrl = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/clawtrader';
const connectionString = baseUrl.includes('?')
  ? `${baseUrl}&options=-c%20timezone%3DUTC`
  : `${baseUrl}?options=-c%20timezone%3DUTC`;

export const pool = new Pool({ connectionString });
