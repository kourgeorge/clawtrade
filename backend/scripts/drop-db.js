import 'dotenv/config';
import pg from 'pg';

const { Pool } = pg;
const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/clawtrader';
const dbName = (connectionString.match(/\/([^/?]+)(\?|$)/) || [])[1] || 'clawtrader';
const postgresUrl = connectionString.replace(/\/([^/?]+)(\?|$)/, '/postgres$2');

const pool = new Pool({ connectionString: postgresUrl });

async function dropDb() {
  await pool.query(`
    SELECT pg_terminate_backend(pg_stat_activity.pid)
    FROM pg_stat_activity
    WHERE pg_stat_activity.datname = $1
      AND pid <> pg_backend_pid()
  `, [dbName]);
  await pool.query(`DROP DATABASE IF EXISTS "${dbName}"`);
  console.log(`Dropped database: ${dbName}`);
  await pool.end();
}

dropDb().catch((err) => {
  console.error(err);
  process.exit(1);
});
