import 'dotenv/config';
import pg from 'pg';

const { Pool } = pg;
const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/clawtrader';
const dbName = (connectionString.match(/\/([^/?]+)(\?|$)/) || [])[1] || 'clawtrader';
const postgresUrl = connectionString.replace(/\/([^/?]+)(\?|$)/, '/postgres$2');

const pool = new Pool({ connectionString: postgresUrl });

async function createDb() {
  const { rows } = await pool.query(
    "SELECT 1 FROM pg_database WHERE datname = $1",
    [dbName]
  );
  if (rows.length === 0) {
    await pool.query(`CREATE DATABASE ${dbName}`);
    console.log(`Created database: ${dbName}`);
  } else {
    console.log(`Database ${dbName} already exists`);
  }
  await pool.end();
}

createDb().catch((err) => {
  console.error(err);
  process.exit(1);
});
