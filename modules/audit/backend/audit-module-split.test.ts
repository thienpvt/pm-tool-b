import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = resolve(__dirname, '../../..');

function readUtf8(relativePath: string): string {
  return readFileSync(resolve(root, relativePath), 'utf8');
}

describe('audit module split contract (24-02)', () => {
  it('S1: audit.service exposes auditLog or listAuditLogs from module path', async () => {
    const mod = await import('@/modules/audit/backend/services/audit.service');
    expect(typeof mod.auditLog === 'function' || typeof mod.listAuditLogs === 'function').toBe(true);
  });

  it('P2: app/api/audit/route.ts re-exports GET from module route', () => {
    const source = readUtf8('app/api/audit/route.ts');
    expect(source).toMatch(
      /export\s*\{\s*GET\s*\}\s*from\s*['"]@\/modules\/audit\/backend\/routes\/audit\/route['"]/,
    );
  });

  it('P1: app/audit/page.tsx still points at AuditLogPage', () => {
    const source = readUtf8('app/audit/page.tsx');
    expect(source).toContain('modules/audit/ui/AuditLogPage');
  });
});
