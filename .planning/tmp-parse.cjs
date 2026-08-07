const r = JSON.parse(require('fs').readFileSync(process.argv[2], 'utf8'));
console.log('success:', r.success, 'tests:', r.numTotalTests, 'pass:', r.numPassedTests, 'fail:', r.numFailedTests, 'pending:', r.numPendingTests);
for (const s of r.testResults || []) {
  if (s.status === 'failed') console.log('SUITE FAILED:', s.name, '\n  ', (s.message || '(no message)').split('\n').slice(0, 6).join('\n   '));
  for (const t of s.assertionResults || []) {
    if (t.status === 'failed') console.log('FAIL ::', t.title, '\n   ', (t.failureMessages || []).join(' ').split('\n').slice(0, 4).join('\n    '));
  }
}
