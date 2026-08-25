import { Pool } from 'pg';

export const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL;

/** True when repository tests can run. Suites call `describe.skipIf(!hasTestDb)`. */
export const hasTestDb = Boolean(TEST_DATABASE_URL);

let pool: Pool | null = null;

export function testPool(): Pool {
  if (!TEST_DATABASE_URL) throw new Error('TEST_DATABASE_URL is not set');
  if (!pool) {
    // Refuse to point tests at anything that is not obviously a test database.
    const dbName = new URL(TEST_DATABASE_URL).pathname.replace(/^\//, '');
    if (!dbName.endsWith('_test')) {
      throw new Error(`Refusing to run tests against database "${dbName}" — name must end in _test`);
    }
    pool = new Pool({ connectionString: TEST_DATABASE_URL });
  }
  return pool;
}

export async function closeTestPool(): Promise<void> {
  await pool?.end();
  pool = null;
}
