import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  DOCUMENTS_DDL,
  DOCUMENTS_DDL_FLAG,
  migrateDocuments,
} from './db-documents';

describe('migrateDocuments DDL fragments', () => {
  it('exports migrateDocuments and documents_ddl_v1 settings flag key (D-11)', () => {
    expect(typeof migrateDocuments).toBe('function');
    expect(DOCUMENTS_DDL_FLAG).toBe('documents_ddl_v1');
  });

  it('creates document_catalog with stage CHECK including ALL (D-02)', () => {
    const ddl = DOCUMENTS_DDL.join('\n');
    expect(ddl).toMatch(/CREATE TABLE IF NOT EXISTS document_catalog/);
    expect(ddl).toMatch(/company_id INTEGER NOT NULL REFERENCES companies\(id\)/);
    expect(ddl).toMatch(/stage TEXT NOT NULL CHECK \(stage IN \('L0','L1','L2','L3','L4','L5','ALL'\)\)/);
    expect(ddl).toMatch(/mandatory BOOLEAN NOT NULL DEFAULT FALSE/);
    expect(ddl).toMatch(/active BOOLEAN NOT NULL DEFAULT TRUE/);
  });

  it('creates document_templates with template_url TEXT (D-05)', () => {
    const ddl = DOCUMENTS_DDL.join('\n');
    expect(ddl).toMatch(/CREATE TABLE IF NOT EXISTS document_templates/);
    expect(ddl).toMatch(/catalog_id INTEGER NOT NULL REFERENCES document_catalog\(id\)/);
    expect(ddl).toMatch(/template_url TEXT/);
    expect(ddl).toMatch(/UNIQUE \(catalog_id, version\)/);
  });

  it('creates project_document_checklist with UNIQUE (project_id, catalog_id) (D-04)', () => {
    const ddl = DOCUMENTS_DDL.join('\n');
    expect(ddl).toMatch(/CREATE TABLE IF NOT EXISTS project_document_checklist/);
    expect(ddl).toMatch(
      /status TEXT NOT NULL DEFAULT 'none' CHECK \(status IN \('none','drafting','pending_approval','approved','not_applicable'\)\)/,
    );
    expect(ddl).toMatch(/UNIQUE \(project_id, catalog_id\)/);
  });
});

describe('getDb wires migrateDocuments after migrateDashboards (D-11)', () => {
  it('awaits migrateDocuments immediately after migrateDashboards and before backfillWeightedCompletion', () => {
    const src = readFileSync(resolve(__dirname, 'db.ts'), 'utf8');
    const dashboardsIdx = src.indexOf('await migrateDashboards(pool)');
    const documentsIdx = src.indexOf('await migrateDocuments(pool)');
    const backfillIdx = src.indexOf('await backfillWeightedCompletion(pool)');
    expect(dashboardsIdx).toBeGreaterThan(-1);
    expect(documentsIdx).toBeGreaterThan(dashboardsIdx);
    expect(documentsIdx).toBeLessThan(backfillIdx);
  });
});
