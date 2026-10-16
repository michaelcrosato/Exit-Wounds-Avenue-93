import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
const exec=promisify(execFile);

test('packaged release strips the marked diagnostic hook while preserving game boot',async()=>{
  await exec(process.execPath,['tools/build.mjs']);
  const source=await readFile('src/main.js','utf8'),release=await readFile('dist/src/main.js','utf8');
  assert.match(source,/EWA93_DEBUG_START/);
  assert.doesNotMatch(release,/(?:window|globalThis)\.__exitWounds/);
  assert.doesNotMatch(release,/EWA93_DEBUG_START|EWA93_DEBUG_END/);
  assert.match(release,/app\.boot\(\)/);
  const html=await readFile('dist/index.html','utf8');
  assert.ok(!html.includes('"/vendor/'),'Import map stays relative for nested base paths');
});
