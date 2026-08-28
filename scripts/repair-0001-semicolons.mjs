/**
 * One-off repair: ensure every SQL statement in 0001-baseline-schema.sql ends with ';'.
 * Run: node scripts/repair-0001-semicolons.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BASELINE = path.resolve(__dirname, '../migrations/0001-baseline-schema.sql');

function nextMeaningfulLine(lines, from) {
  for (let j = from; j < lines.length; j++) {
    const t = lines[j].trim();
    if (t !== '') return t;
  }
  return null;
}

function startsNewStatement(text) {
  return /^(CREATE|ALTER|UPDATE|INSERT)\s+/i.test(text) || /^DO\s+\$\$/i.test(text) || /^--/.test(text);
}

function repairSemicolons(sql) {
  const lines = sql.split('\n');
  const result = [];
  let inDoBlock = false;

  for (let i = 0; i < lines.length; i++) {
    let line = lines[i];
    const trimmed = line.trim();

    if (/^DO\s+\$\$/i.test(trimmed)) inDoBlock = true;

    if (inDoBlock && /^END\s+\$\$/i.test(trimmed)) {
      inDoBlock = false;
      if (!trimmed.endsWith(';')) {
        line = line.replace(/END\s+\$\+\s*$/i, 'END $$;');
      }
    }

    if (
      !inDoBlock &&
      trimmed !== '' &&
      !trimmed.startsWith('--') &&
      !trimmed.endsWith(';')
    ) {
      const next = nextMeaningfulLine(lines, i + 1);
      if (next === null || startsNewStatement(next)) {
        line = line.replace(/\s*$/, ';');
      }
    }

    result.push(line);
  }

  return result.join('\n');
}

const original = readFileSync(BASELINE, 'utf8');
const repaired = repairSemicolons(original);
writeFileSync(BASELINE, repaired, 'utf8');
console.log('Repaired semicolons in', BASELINE);
