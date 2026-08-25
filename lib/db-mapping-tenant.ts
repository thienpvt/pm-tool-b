import type { Pool } from 'pg';

const TIMELINE_FLAG = 'mapping_tenant_timeline_import_mappings_v1';
const BUG_FLAG = 'mapping_tenant_bug_import_mappings_v1';
const JQL_FLAG = 'mapping_tenant_jira_jql_presets_v1';
const SYNC_FLAG = 'mapping_tenant_jira_sync_mappings_v1';

type MappingTableSpec = {
  table: string;
  nameColumn?: string;
  payloadColumns: string[];
  /** Composite UNIQUE columns; defaults to (company_id, nameColumn) when nameColumn is set. */
  uniqueIndexColumns?: string[];
};

const TIMELINE_SPEC: MappingTableSpec = {
  table: 'timeline_import_mappings',
  nameColumn: 'name',
  payloadColumns: ['mappings_json'],
};

const BUG_SPEC: MappingTableSpec = {
  table: 'bug_import_mappings',
  nameColumn: 'name',
  payloadColumns: ['mappings_json'],
};

const JQL_SPEC: MappingTableSpec = {
  table: 'jira_jql_presets',
  nameColumn: 'name',
  payloadColumns: ['jql', 'context'],
  uniqueIndexColumns: ['company_id', 'name', 'context'],
};

const SYNC_SPEC: MappingTableSpec = {
  table: 'jira_sync_mappings',
  payloadColumns: ['mappings_json'],
};

/**
 * Idempotent per-table mapping tenancy migration (D-01, D-02).
 * Order: nullable column → backfill → NOT NULL+FK → UNIQUE(company_id, name) → index.
 */
export async function migrateMappingTableTenancy(pool: Pool): Promise<void> {
  await migrateOneTable(pool, TIMELINE_SPEC, TIMELINE_FLAG);
  await migrateOneTable(pool, BUG_SPEC, BUG_FLAG);
  await migrateOneTable(pool, JQL_SPEC, JQL_FLAG);
  await migrateOneTable(pool, SYNC_SPEC, SYNC_FLAG);
}

async function uniqueIndexExists(pool: Pool, indexName: string): Promise<boolean> {
  const res = await pool.query(
    'SELECT 1 FROM pg_indexes WHERE indexname = $1 LIMIT 1',
    [indexName],
  );
  return res.rows.length > 0;
}

async function migrateOneTable(pool: Pool, spec: MappingTableSpec, flagKey: string): Promise<void> {
  const { table, nameColumn, payloadColumns } = spec;

  try {
    const done = await pool.query('SELECT value FROM settings WHERE key = $1', [flagKey]);
    if (done.rows.length > 0) return;

    try {
      await pool.query(
        `ALTER TABLE ${table} ADD COLUMN IF NOT EXISTS company_id INTEGER REFERENCES companies(id)`,
      );
    } catch {
      /* column already exists with different definition — proceed */
    }

    const nullRes = await pool.query(
      `SELECT COUNT(*)::int AS c FROM ${table} WHERE company_id IS NULL`,
    );
    const nullCount: number = nullRes.rows[0]?.c ?? 0;

    if (nullCount > 0) {
      const companyRes = await pool.query('SELECT COUNT(*)::int AS c FROM companies');
      const companyCount: number = companyRes.rows[0]?.c ?? 0;

      if (companyCount === 1) {
        await pool.query(
          `UPDATE ${table}
           SET company_id = (SELECT id FROM companies LIMIT 1)
           WHERE company_id IS NULL`,
        );
      } else if (companyCount > 1) {
        const dataCols = nameColumn ? [nameColumn, ...payloadColumns] : payloadColumns;
        const insertCols = [...dataCols, 'company_id', 'created_at'].join(', ');
        const selectCols = [
          ...(nameColumn ? [`t.${nameColumn}`] : []),
          ...payloadColumns.map(c => `t.${c}`),
          'c.id',
          't.created_at',
        ].join(', ');
        const client = await pool.connect();
        try {
          await client.query('BEGIN');
          await client.query(
            `INSERT INTO ${table} (${insertCols})
             SELECT ${selectCols}
             FROM ${table} t
             CROSS JOIN companies c
             WHERE t.company_id IS NULL`,
          );
          await client.query(`DELETE FROM ${table} WHERE company_id IS NULL`);
          await client.query('COMMIT');
        } catch (err) {
          await client.query('ROLLBACK');
          throw err;
        } finally {
          client.release();
        }
      }
    }

    const remainingRes = await pool.query(
      `SELECT COUNT(*)::int AS c FROM ${table} WHERE company_id IS NULL`,
    );
    const remainingNull: number = remainingRes.rows[0]?.c ?? 0;

    if (remainingNull === 0) {
      try {
        await pool.query(`ALTER TABLE ${table} ALTER COLUMN company_id SET NOT NULL`);
      } catch {
        /* already NOT NULL */
      }

      await pool.query(`DROP INDEX IF EXISTS ${table}_name_key`).catch(() => {});
      await pool.query(`DROP INDEX IF EXISTS idx_${table}_name`).catch(() => {});

      const uniqueCols =
        spec.uniqueIndexColumns ?? (nameColumn ? ['company_id', nameColumn] : undefined);
      const uniqueIndexName = `idx_${table}_company_unique`;
      if (uniqueCols && uniqueCols.length > 0) {
        await pool.query(
          `CREATE UNIQUE INDEX IF NOT EXISTS ${uniqueIndexName}
           ON ${table} (${uniqueCols.join(', ')})`,
        );
        if (!(await uniqueIndexExists(pool, uniqueIndexName))) {
          return;
        }
      }

      try {
        await pool.query(
          `CREATE INDEX IF NOT EXISTS idx_${table}_company_id ON ${table} (company_id)`,
        );
      } catch {
        /* index exists */
      }

      await pool.query(
        `INSERT INTO settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO NOTHING`,
        [flagKey, new Date().toISOString()],
      );
    }
  } catch {
    /* settings table may not exist yet on first run — will retry next boot */
  }
}
