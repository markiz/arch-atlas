import test from 'node:test';
import assert from 'node:assert/strict';
import { readResponseBytes } from '../src/fetch-progress.ts';

function streamed(chunks) {
  return new Response(
    new ReadableStream({
      start(controller) {
        for (const chunk of chunks) controller.enqueue(chunk);
        controller.close();
      },
    }),
  );
}

test('reports cumulative bytes while reading a response body', async () => {
  const seen = [];
  const bytes = await readResponseBytes(
    streamed([new Uint8Array([1, 2]), new Uint8Array([3]), new Uint8Array([4, 5, 6])]),
    6,
    (loaded, total) => seen.push([loaded, total]),
  );

  assert.deepEqual([...new Uint8Array(bytes)], [1, 2, 3, 4, 5, 6]);
  assert.deepEqual(seen, [
    [2, 6],
    [3, 6],
    [6, 6],
  ]);
});

test('falls back to arrayBuffer when the response has no stream', async () => {
  const seen = [];
  const bytes = await readResponseBytes(
    { arrayBuffer: async () => new Uint8Array([7, 8, 9]).buffer },
    3,
    (loaded, total) => seen.push([loaded, total]),
  );

  assert.deepEqual([...new Uint8Array(bytes)], [7, 8, 9]);
  assert.deepEqual(seen, [[3, 3]]);
});

test('rejects a body that is shorter than the manifest size', async () => {
  await assert.rejects(
    readResponseBytes(streamed([new Uint8Array([1, 2])]), 3),
    /Размер файла не совпадает с манифестом/,
  );
});

test('rejects a body that is longer than the manifest size', async () => {
  await assert.rejects(
    readResponseBytes(streamed([new Uint8Array([1, 2, 3, 4])]), 3),
    /Размер файла не совпадает с манифестом/,
  );
});
