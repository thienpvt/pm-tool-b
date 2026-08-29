import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import packageJson from '../../package.json';

const root = resolve(__dirname, '../..');

/** Non-comment lines only — ignore // and block-comment * prefixes (D-05). */
function codeLines(source: string): string[] {
  return source
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0 && !line.startsWith('//') && !line.startsWith('*'));
}

function collectRepoFiles(): string[] {
  const files: string[] = [];

  function walk(dir: string): void {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) {
        walk(full);
      } else if (entry.endsWith('.repo.ts')) {
        files.push(full);
      }
    }
  }

  walk(join(root, 'modules'));
  const libRepoDir = join(root, 'lib/repositories');
  for (const entry of readdirSync(libRepoDir)) {
    if (entry.endsWith('.repo.ts')) {
      files.push(join(libRepoDir, entry));
    }
  }

  return files.filter(f => !f.includes('_helpers') && !f.includes('_kysely-helpers'));
}

describe('kysely migration gates (25-15, ENF-02, D-05, D-09)', () => {
  const repoFiles = collectRepoFiles();

  it('D-09: package.json pins kysely 0.29.5', () => {
    expect(packageJson.dependencies?.kysely).toBe('0.29.5');
  });

  it('D-05: lib/auth.ts still imports getDb for session SQL', () => {
    const authSrc = readFileSync(join(root, 'lib/auth.ts'), 'utf8');
    expect(authSrc).toMatch(/import\s*\{[^}]*\bgetDb\b[^}]*\}\s*from\s*['"]\.\/db['"]/);
    expect(authSrc).toMatch(/\bgetDb\s*\(\s*\)/);
    expect(authSrc).toMatch(/INSERT\s+INTO\s+sessions/i);
  });

  it('D-05: every production *.repo.ts uses getKysely and does not bind getDb from @/lib/db', () => {
    expect(repoFiles.length).toBeGreaterThan(0);

    for (const file of repoFiles) {
      const rel = relative(root, file).replace(/\\/g, '/');
      const source = readFileSync(file, 'utf8');
      const lines = codeLines(source);

      expect(lines.some(line => line.includes('getKysely')), `${rel} must use getKysely`).toBe(true);

      const getDbImport = lines.find(
        line =>
          line.includes("from '@/lib/db'") &&
          line.includes('import') &&
          /\bgetDb\b/.test(line),
      );
      expect(getDbImport, `${rel} must not import getDb from @/lib/db`).toBeUndefined();
    }
  });

  it('D-05: zero production *.repo.ts files import buildUpdate from _helpers', () => {
    for (const file of repoFiles) {
      const rel = relative(root, file).replace(/\\/g, '/');
      const source = readFileSync(file, 'utf8');
      const lines = codeLines(source);

      const buildUpdateImport = lines.find(
        line =>
          line.includes("from '@/lib/repositories/_helpers'") ||
          line.includes("from './_helpers'") ||
          line.includes("from '../_helpers'"),
      );
      if (buildUpdateImport?.includes('buildUpdate')) {
        expect.fail(`${rel} must not import buildUpdate`);
      }
      expect(lines.some(line => line.includes('buildUpdate')), `${rel} must not reference buildUpdate`).toBe(
        false,
      );
    }
  });
});
