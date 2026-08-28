import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = resolve(__dirname, '../../..');

function readUtf8(relativePath: string): string {
  return readFileSync(resolve(root, relativePath), 'utf8');
}

describe('documents module split contract (24-04)', () => {
  it('S1: document-catalog.service exposes listDocumentCatalog from module path', async () => {
    const mod = await import('@/modules/documents/backend/services/document-catalog.service');
    expect(typeof mod.listDocumentCatalog).toBe('function');
  });

  it('P2: app/api/document-catalog/route.ts re-exports GET and POST from module route', () => {
    const source = readUtf8('app/api/document-catalog/route.ts');
    expect(source).toMatch(
      /export\s*\{\s*GET\s*,\s*POST\s*\}\s*from\s*['"]@\/modules\/documents\/backend\/routes\/document-catalog\/route['"]/,
    );
  });

  it('P3: app/api/projects/[id]/document-checklist/route.ts contains withProjectAccess wrapper', () => {
    const source = readUtf8('app/api/projects/[id]/document-checklist/route.ts');
    expect(source).toMatch(/withProjectAccess[\(<]/);
    expect(source).not.toMatch(
      /export\s*\{\s*GET\s*\}\s*from\s*['"]@\/modules\/documents\/backend\/routes\/projects\/\[id\]\/document-checklist\/route['"]/,
    );
  });

  it('P1: app/documents/catalog/page.tsx still points at DocumentCatalogPage', () => {
    const source = readUtf8('app/documents/catalog/page.tsx');
    expect(source).toContain('modules/documents/ui/catalog/DocumentCatalogPage');
  });

  it('P1: app/documents/compliance/page.tsx still points at DocumentCompliancePage', () => {
    const source = readUtf8('app/documents/compliance/page.tsx');
    expect(source).toContain('modules/documents/ui/compliance/DocumentCompliancePage');
  });

  it('P1: app/projects/[id]/document-checklist/page.tsx still points at ProjectChecklistPage', () => {
    const source = readUtf8('app/projects/[id]/document-checklist/page.tsx');
    expect(source).toContain('modules/documents/ui/checklist/ProjectChecklistPage');
  });

  it('Wave 6 guard: app/projects/[id]/documents/page.tsx is a fat page, not a module re-export', () => {
    const source = readUtf8('app/projects/[id]/documents/page.tsx');
    expect(source).toContain('use client');
    expect(source).not.toMatch(
      /export\s*\{\s*default\s*\}\s*from\s*['"]@\/modules\/documents/,
    );
    expect(source.length).toBeGreaterThan(500);
  });

  it('P2: app/api/document-catalog/[id]/route.ts re-exports GET and PATCH from module route', () => {
    const source = readUtf8('app/api/document-catalog/[id]/route.ts');
    expect(source).toMatch(
      /export\s*\{\s*GET\s*,\s*PATCH\s*\}\s*from\s*['"]@\/modules\/documents\/backend\/routes\/document-catalog\/\[id\]\/route['"]/,
    );
  });

  it('P2: app/api/document-templates/route.ts re-exports GET and POST from module route', () => {
    const source = readUtf8('app/api/document-templates/route.ts');
    expect(source).toMatch(
      /export\s*\{\s*GET\s*,\s*POST\s*\}\s*from\s*['"]@\/modules\/documents\/backend\/routes\/document-templates\/route['"]/,
    );
  });

  it('P2: app/api/document-templates/[id]/route.ts re-exports GET and PATCH from module route', () => {
    const source = readUtf8('app/api/document-templates/[id]/route.ts');
    expect(source).toMatch(
      /export\s*\{\s*GET\s*,\s*PATCH\s*\}\s*from\s*['"]@\/modules\/documents\/backend\/routes\/document-templates\/\[id\]\/route['"]/,
    );
  });

  it('P2: app/api/dashboards/document-compliance/route.ts re-exports GET from module route', () => {
    const source = readUtf8('app/api/dashboards/document-compliance/route.ts');
    expect(source).toMatch(
      /export\s*\{\s*GET\s*\}\s*from\s*['"]@\/modules\/documents\/backend\/routes\/dashboards\/document-compliance\/route['"]/,
    );
  });

  const p3ChecklistRoutes = [
    'app/api/projects/[id]/document-checklist/route.ts',
    'app/api/projects/[id]/document-checklist/[itemId]/route.ts',
  ] as const;

  it.each(p3ChecklistRoutes)(
    'P3 ENF-01: %s contains withProjectAccess and module handler import',
    (routePath) => {
      const source = readUtf8(routePath);
      expect(source).toMatch(/withProjectAccess[\(<]/);
      expect(source).toContain('modules/documents/backend/routes');
    },
  );
});
