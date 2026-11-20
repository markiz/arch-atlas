/**
 * Reads a response into one buffer while reporting received bytes.
 *
 * Large atlas bundles arrive as compressed streams, so `Content-Length` is not
 * the package size. The manifest size is the source of truth for both the
 * buffer and the progress denominator.
 */
export async function readResponseBytes(
  response: Response,
  expectedSize: number,
  onProgress?: (loaded: number, total: number) => void,
): Promise<ArrayBuffer> {
  if (!response.body) {
    const buffer = await response.arrayBuffer();
    if (buffer.byteLength !== expectedSize)
      throw new Error('Размер файла не совпадает с манифестом');
    onProgress?.(buffer.byteLength, expectedSize);
    return buffer;
  }

  const bytes = new Uint8Array(expectedSize);
  const reader = response.body.getReader();
  let loaded = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (loaded + value.byteLength > expectedSize)
        throw new Error('Размер файла не совпадает с манифестом');
      bytes.set(value, loaded);
      loaded += value.byteLength;
      onProgress?.(loaded, expectedSize);
    }
  } catch (error) {
    await reader.cancel(error).catch(() => {});
    throw error;
  } finally {
    reader.releaseLock();
  }
  if (loaded !== expectedSize) throw new Error('Размер файла не совпадает с манифестом');
  return bytes.buffer;
}
