import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { listOpenProjectDependencies } from '@/modules/projects/backend/repositories/project-dependencies.repo';
import { listPeriodShells } from '@/modules/weekly/backend/services/weekly-reports.service';

const root = resolve(__dirname, '../../../..');

/** Non-comment lines only — ignore // and block-comment * prefixes. */
function codeLines(source: string): string[] {
  return source
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0 && !line.startsWith('//') && !line.startsWith('*'));
}

/** Require a live import of `token` (not merely a comment/string mention). */
function hasImportToken(source: string, token: string): boolean {
  const namedImport = new RegExp(
    String.raw`import\s+(?:type\s+)?\{[\s\S]*?\b${token}\b[\s\S]*?\}\s+from\s+['"]`,
  );
  const defaultImport = new RegExp(String.raw`import\s+\b${token}\b\s+from\s+['"]`);
  return namedImport.test(source) || defaultImport.test(source);
}

function readRepoFile(relativePath: string): string {
  return readFileSync(join(root, relativePath), 'utf8');
}

describe('NIT-01 listPeriodShells (D-01)', () => {
  it('listPeriodShells is a named export function', () => {
    expect(typeof listPeriodShells).toBe('function');
  });

  it('weekly-reports.service.ts defines export async function listPeriodShells', () => {
    const lines = codeLines(readRepoFile('modules/weekly/backend/services/weekly-reports.service.ts'));
    expect(lines.some(line => line.includes('export async function listPeriodShells'))).toBe(true);
  });

  it('spec-dashboards.service.ts imports listPeriodShellsRepo', () => {
    const source = readRepoFile('modules/dashboards/backend/services/spec-dashboards.service.ts');
    expect(hasImportToken(source, 'listPeriodShellsRepo')).toBe(true);
  });

  it('weekly-tracking.service.ts imports listPeriodShellsRepo', () => {
    const source = readRepoFile('modules/weekly/backend/services/weekly-tracking.service.ts');
    expect(hasImportToken(source, 'listPeriodShellsRepo')).toBe(true);
  });
});

describe('NIT-01 listOpenProjectDependencies (D-01)', () => {
  it('listOpenProjectDependencies is a named export function', () => {
    expect(typeof listOpenProjectDependencies).toBe('function');
  });

  it('project-dependencies.repo.ts defines export async function listOpenProjectDependencies', () => {
    const lines = codeLines(readRepoFile('modules/projects/backend/repositories/project-dependencies.repo.ts'));
    expect(lines.some(line => line.includes('export async function listOpenProjectDependencies'))).toBe(true);
  });

  it('project-dependencies.repo.test.ts imports listOpenProjectDependencies', () => {
    const source = readRepoFile('modules/projects/backend/repositories/project-dependencies.repo.test.ts');
    expect(hasImportToken(source, 'listOpenProjectDependencies')).toBe(true);
  });
});
