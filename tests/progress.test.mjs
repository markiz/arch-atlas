import test from 'node:test';
import assert from 'node:assert/strict';
import {Progress} from '../scripts/lib/progress.mjs';

class BufferStream {
  constructor() { this.value = ''; }
  write(chunk) { this.value += chunk; }
}

function make(total, options = {}) {
  const stream = new BufferStream();
  return {stream, progress: new Progress(total, {label: 'test job', stream, minInterval: 0, ...options})};
}

test('known total shows percent, ETA and a single final line', async () => {
  const {stream, progress} = make(4);
  progress.start();
  await new Promise(resolve => setTimeout(resolve, 5));
  progress.update(2);
  progress.update(4);
  progress.finish();
  const lines = stream.value.trimEnd().split('\n');
  assert.equal(lines.length, 3);
  assert.match(lines[1], /\[2\/4\s+50%\]/);
  assert.match(lines[1], /left/);
  assert.match(lines[2], /\[4\/4 100%\]/);
  assert.match(lines[2], /done/);
});

test('unknown total reports a count without inventing an ETA', () => {
  const {stream, progress} = make(null);
  progress.start();
  progress.update(3);
  progress.finish();
  assert.match(stream.value, /\[3\]/);
  assert.doesNotMatch(stream.value, /left/);
});

test('finish is idempotent', () => {
  const {stream, progress} = make(1);
  progress.start();
  progress.advance('one');
  progress.finish();
  progress.finish();
  assert.equal(stream.value.trimEnd().split('\n').length, 2);
});
