import { AsyncLocalStorage } from 'node:async_hooks';
import type { Pool, PoolClient } from 'pg';

type Queryable = Pick<Pool, 'query'>;

const txStore = new AsyncLocalStorage<PoolClient>();

/** Active transaction client, if `runInTransactionOnPool` is on the stack. */
export function txQueryTarget(fallback: Queryable): Queryable {
  return txStore.getStore() ?? fallback;
}

/**
 * Run `fn` inside BEGIN/COMMIT on a dedicated pool client.
 * `get`/`all`/`run` on PostgresClient and TestDbClient join this client
 * for the duration of `fn` so RAID + weekly writes share one rollback.
 */
export async function runInTransactionOnPool<T>(
  pool: Pool,
  fn: (client: PoolClient) => Promise<T>,
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await txStore.run(client, () => fn(client));
    await client.query('COMMIT');
    return result;
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch {
      /* connection may already be dead */
    }
    throw err;
  } finally {
    client.release();
  }
}
