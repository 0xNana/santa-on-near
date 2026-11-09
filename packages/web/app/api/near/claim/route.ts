import { createHash } from "node:crypto";
import { NearClaimPolicyError, parseNearRelayerConfig, submitSponsoredClaim, verifyRecipientSignature } from "@santa/core/src/near-relayer.js";
import { readNearContractView } from "@santa/core/src/near-contract.js";
import { NEAR_TESTNET_RPC_URL } from "@santa/core/src/near.js";
import { z } from "zod";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

const MAX_BODY_BYTES = 4096;
const ACCOUNT_ID = /^(?=.{2,64}$)[a-z0-9]+([._-][a-z0-9]+)*$/;
const requestSchema = z.strictObject({
  giftId: z.string().regex(/^[1-9][0-9]{0,19}$/),
  secret: z.string().regex(/^0x[0-9a-f]{64}$/),
  recipientId: z.string().regex(ACCOUNT_ID),
  issuedAt: z.number().int().safe(),
  nonce: z.string().regex(/^[a-f0-9]{64}$/),
  signature: z.strictObject({
    accountId: z.string().regex(ACCOUNT_ID),
    publicKey: z.string().min(20).max(128),
    signature: z.string().min(80).max(128),
  }),
});

type RateWindow = { start: number; count: number };
const rateWindows = new Map<string, RateWindow>();
const WINDOW_MS = 60_000;
const PER_IP_LIMIT = 12;

async function readCappedBody(request: Request): Promise<{ text: string; tooLarge: boolean }> {
  const declared = Number(request.headers.get("content-length") ?? 0);
  if (Number.isFinite(declared) && declared > MAX_BODY_BYTES) return { text: "", tooLarge: true };
  if (request.body === null) return { text: "", tooLarge: false };
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_BODY_BYTES) {
        await reader.cancel();
        return { text: "", tooLarge: true };
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  return { text: Buffer.concat(chunks).toString("utf8"), tooLarge: false };
}

function limited(request: Request, now = Date.now()): boolean {
  for (const [key, value] of rateWindows) {
    if (now - value.start >= WINDOW_MS) rateWindows.delete(key);
  }
  if (rateWindows.size >= 10_000) return true;
  const key = request.headers.get("fly-client-ip") ?? request.headers.get("x-real-ip") ?? "unknown";
  const current = rateWindows.get(key);
  if (current === undefined || now - current.start >= WINDOW_MS) {
    rateWindows.set(key, { start: now, count: 1 });
    return false;
  }
  current.count += 1;
  return current.count > PER_IP_LIMIT;
}

function json(status: number, body: unknown): Response {
  return Response.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

export async function POST(request: Request): Promise<Response> {
  let config;
  try {
    config = parseNearRelayerConfig(process.env);
  } catch {
    return json(503, { ok: false, error: "near_claims_not_configured" });
  }
  if (request.headers.get("origin") !== config.SANTA_PUBLIC_ORIGIN) {
    return json(403, { ok: false, error: "origin_refused" });
  }
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) {
    return json(415, { ok: false, error: "content_type_refused" });
  }
  if (limited(request)) return json(429, { ok: false, error: "rate_limited" });

  const body = await readCappedBody(request);
  if (body.tooLarge) return json(413, { ok: false, error: "body_too_large" });
  let input;
  try {
    input = requestSchema.parse(JSON.parse(body.text));
  } catch {
    return json(400, { ok: false, error: "invalid_claim_request" });
  }
  if (BigInt(input.giftId) > 18_446_744_073_709_551_615n) {
    return json(400, { ok: false, error: "invalid_claim_request" });
  }
  const claim = {
    giftId: input.giftId,
    secret: input.secret,
    recipientId: input.recipientId,
    nonce: input.nonce,
  };

  try {
    const gift = await readNearContractView<{
      secret_hash: string;
      status: string;
      expires_at_ns: string;
    } | null>(
      config.NEAR_RPC_URL || NEAR_TESTNET_RPC_URL,
      config.NEAR_CONTRACT_ACCOUNT,
      "get_gift",
      { gift_id: input.giftId },
    );
    if (gift === null) return json(404, { ok: false, error: "gift_not_found" });
    if (gift.status !== "Open") return json(409, { ok: false, error: "gift_not_open" });
    if (BigInt(gift.expires_at_ns) <= BigInt(Date.now()) * 1_000_000n) {
      return json(409, { ok: false, error: "gift_expired" });
    }
    const secretHash = `0x${createHash("sha256").update(input.secret, "utf8").digest("hex")}`;
    if (gift.secret_hash !== secretHash) return json(403, { ok: false, error: "invalid_claim_secret" });
  } catch {
    return json(503, { ok: false, error: "near_rpc_unavailable" });
  }

  const signatureValid = await verifyRecipientSignature(
    config,
    claim,
    input.signature,
    input.issuedAt,
    input.nonce,
  );
  if (!signatureValid) return json(403, { ok: false, error: "recipient_signature_refused" });

  try {
    const txHash = await submitSponsoredClaim(config, claim);
    return json(200, { ok: true, txHash });
  } catch (error) {
    if (error instanceof NearClaimPolicyError) return json(429, { ok: false, error: error.code });
    return json(502, { ok: false, error: "near_claim_failed" });
  }
}
