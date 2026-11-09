import { afterEach, describe, expect, it, vi } from 'vitest';
import { createHash } from 'node:crypto';
import { verifyDemoVideo } from '../../../scripts/verify-demo-video.mjs';
const bytes = new Uint8Array(12_000);
bytes.set(new TextEncoder().encode('ftyp'), 4);
const artifact = {
  videoUrl: 'https://raw.githubusercontent.com/0xNana/santa-on-near/2121b4f2571439d0ed71d75d4d9fd1164970556c/demo/near-demo.mp4',
  sizeBytes: bytes.length,
  sha256: createHash('sha256').update(bytes).digest('hex'),
};
afterEach(() => vi.unstubAllGlobals());
describe('public demo integrity after local recordings are ignored', () => {
  it('accepts the exact published MP4 with no local demo directory', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(bytes)));
    await expect(verifyDemoVideo(artifact)).resolves.toBe(true);
    expect(fetch).toHaveBeenCalledWith(artifact.videoUrl, expect.objectContaining({ signal: expect.any(AbortSignal) }));
  });
  it('rejects unavailable, redirected, or HTML responses', async () => {
    for (const response of [new Response('', { status: 404 }), new Response('', { status: 302 }), new Response('<html>not a video</html>')]) {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response));
      await expect(verifyDemoVideo(artifact)).resolves.toBe(false);
    }
  });
  it('rejects a different video even when its size and MP4 header match', async () => {
    const changed = bytes.slice(); changed[100] = 1;
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(changed)));
    await expect(verifyDemoVideo(artifact)).resolves.toBe(false);
  });
  it('rejects declared size mismatches, missing MP4 headers, and oversized streams', async () => {
    for (const body of [bytes.slice(0, -1), new Uint8Array(bytes.length), new Uint8Array(bytes.length + 1)]) {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(body)));
      await expect(verifyDemoVideo(artifact)).resolves.toBe(false);
    }
  });
  it('rejects non-MP4 bytes even when the recorded hash and size match', async () => {
    const body = new Uint8Array(bytes.length);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(body)));
    const sha256 = createHash('sha256').update(body).digest('hex');
    await expect(verifyDemoVideo({ ...artifact, sha256 })).resolves.toBe(false);
  });
  it('fails closed on network errors', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('connection refused')));
    await expect(verifyDemoVideo(artifact)).resolves.toBe(false);
  });
  it('refuses mutable URLs, credentials, invalid hashes and unbounded sizes before fetching', async () => {
    vi.stubGlobal('fetch', vi.fn());
    for (const input of [null, {}, { ...artifact, videoUrl: artifact.videoUrl.replace(/2121b4f[0-9a-f]+/, 'main') },
      { ...artifact, videoUrl: artifact.videoUrl.replace('https://', 'https://user:pass@') },
      { ...artifact, sha256: '' }, { ...artifact, sizeBytes: 30_000_000 }]) {
      await expect(verifyDemoVideo(input)).resolves.toBe(false);
    }
    expect(fetch).not.toHaveBeenCalled();
  });
});
