import { createHash } from 'node:crypto';

/** Verify an immutable public recording without requiring the ignored local demo directory. */
export async function verifyDemoVideo(artifact) {
  if (!artifact || !Number.isSafeInteger(artifact.sizeBytes) || artifact.sizeBytes <= 10_000
    || artifact.sizeBytes > 25_000_000 || !/^[a-f0-9]{64}$/.test(artifact.sha256 ?? '')) return false;
  try {
    const url = new URL(artifact.videoUrl);
    if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash
      || url.hostname !== 'raw.githubusercontent.com'
      || !/^\/0xNana\/santa-on-near\/[a-f0-9]{40}\/demo\/near-demo\.mp4$/.test(url.pathname)) return false;
    const response = await fetch(url.href, { signal: AbortSignal.timeout(15_000), redirect: 'error' });
    if (!response.ok || !response.body) return false;
    const reader = response.body.getReader();
    const chunks = [];
    let size = 0;
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.length;
        if (size > artifact.sizeBytes) return false;
        chunks.push(value);
      }
    } finally {
      await reader.cancel().catch(() => {});
    }
    const bytes = Buffer.concat(chunks, size);
    return size === artifact.sizeBytes && bytes.subarray(4, 8).toString() === 'ftyp'
      && createHash('sha256').update(bytes).digest('hex') === artifact.sha256;
  } catch {
    return false;
  }
}
