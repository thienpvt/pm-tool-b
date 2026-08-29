import { AsyncLocalStorage } from 'node:async_hooks';
import { Kysely, PostgresDialect } from 'kysely';
import type { Pool, PoolClient } from 'pg';
import type { Database } from '@/lib/db/database';

type Queryable = Pick<Pool, 'query'>;

const txStore = new AsyncLocalStorage<PoolClient>();
const txKyselyStore = new AsyncLocalStorage<Kysely<Database>>();

/** Active transactional Kysely, if set by runInTransactionOnPool (25-02). */
export function txKyselyTarget(): Kysely<Database> | undefined {
  return txKyselyStore.getStore();
}

export { txKyselyStore };

/**
 * Minimal pool adapter so Kysely reuses the active BEGIN client.
 * Must not clone the pg Client (that double-parses the wire protocol).
 * release() is a no-op — the outer runInTransactionOnPool finally still releases.
 */
function transactionalPool(client: PoolClient): Pool {
  const txClient = {
    query: client.query.bind(client),
    release() {
      /* no-op — outer finally owns the real client.release() */
    },
    get processID() {
      return (client as PoolClient & { processID?: number }).processID;
    },
  };

  return {
    connect() {
      return Promise.resolve(txClient);
    },
    end() {
      return Promise.resolve();
    },
    query(...args: Parameters<Pool['query']>) {
      return client.query(...args);
    },
    totalCount: 1,
    idleCount: 0,
    waitingCount: 0,
  } as unknown as Pool;
}

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
    const txKysely = new Kysely<Database>({
      dialect: new PostgresDialect({ pool: transactionalPool(client) }),
    });
    const result = await txStore.run(client, () =>
      txKyselyStore.run(txKysely, () => fn(client)),
    );
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
