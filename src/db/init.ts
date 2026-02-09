import { Pool, PoolConfig } from 'pg';
import { config as dotenvConfig } from 'dotenv';
import { SQL } from './schema';

dotenvConfig();

const poolConfig: PoolConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'talmudic_scholar',
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  max: 20,
  min: 5,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
};

export const pool = new Pool(poolConfig);

export async function initDatabase(): Promise<void> {
  const client = await pool.connect();

  try {
    // Create database if not exists
    await client.query(`CREATE DATABASE ${process.env.DB_NAME}`);
  } catch (e: any) {
    if (e.code !== '42P04') {
      throw e;
    }
  }

  client.release();

  // Connect to the database
  const dbClient = await pool.connect();

  // Enable vector extension
  await dbClient.query(SQL.CREATE_EXTENSION);

  // Create documents table
  await dbClient.query(SQL.CREATE_DOCUMENTS_TABLE);

  // Create indexes
  await dbClient.query(SQL.CREATE_INDEX_VECTOR);
  await dbClient.query(SQL.CREATE_INDEX_REF);
  await dbClient.query(SQL.CREATE_INDEX_SOURCE);

  console.log('Database initialized successfully');
  dbClient.release();
}

export async function closePool(): Promise<void> {
  await pool.end();
}

// Run if executed directly
const isDirectRun = import.meta.url === `file://${process.argv[1]}`;
if (isDirectRun) {
  initDatabase()
    .then(() => {
      console.log('✓ Initialization complete');
      process.exit(0);
    })
    .catch((err) => {
      console.error('✗ Initialization failed:', err);
      process.exit(1);
    });
}
