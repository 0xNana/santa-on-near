import { createHash } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { KeyPairEd25519 } from "near-api-js";
import * as relayer from "../src/near-relayer.js";
import * as rpc from "../src/near-contract.js";
import { POST } from "../../web/app/api/near/claim/route.js";

describe("NEAR sponsored claim API", () => {
  const secret = `0x${"ab".repeat(32)}`;
  const claim = {
    giftId: "1", recipientId: "alice.testnet", secret, issuedAt: Date.now(), nonce: "cd".repeat(32),
    signature: { accountId: "alice.testnet", publicKey: `ed25519:${"a".repeat(44)}`, signature: "a".repeat(88) },
  };
  const gift = { token_id: "token.testnet", status: "Open",
    secret_hash: `0x${createHash("sha256").update(secret).digest("hex")}`,
    expires_at_ns: (BigInt(Date.now() + 86_400_000) * 1_000_000n).toString() };
  let requestNumber = 0;
  function request(body: unknown = claim, headers: Record<string, string> = {}) {
    return new Request("https://santa.example/api/near/claim", {
      method: "POST", headers: { origin: "https://santa.example", "content-type": "application/json",
        "fly-client-ip": `test-${++requestNumber}`, ...headers }, body: JSON.stringify(body),
    });
  }
  beforeEach(() => {
    for (const [name, value] of Object.entries({ NEAR_CONTRACT_ACCOUNT: "santa.testnet",
      NEXT_PUBLIC_NEAR_CONTRACT_ACCOUNT: "santa.testnet", NEAR_NETWORK_ID: "testnet",
      NEAR_RELAYER_ACCOUNT: "relayer.testnet", NEAR_RELAYER_SECRET_KEY: KeyPairEd25519.fromRandom().toString(),
      SANTA_PUBLIC_ORIGIN: "https://santa.example", NEAR_RPC_URL: "https://rpc.testnet.near.org" })) vi.stubEnv(name, value);
    vi.spyOn(rpc, "readNearContractView").mockResolvedValue(gift);
    vi.spyOn(relayer, "verifyRecipientSignature").mockResolvedValue(true);
    vi.spyOn(relayer, "submitSponsoredClaim").mockResolvedValue("claimed-tx");
  });
  afterEach(() => { vi.restoreAllMocks(); vi.unstubAllEnvs(); });

  it("returns a verified sponsored claim transaction", async () => {
    const response = await POST(request());
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true, txHash: "claimed-tx" });
    expect(response.headers.get("cache-control")).toBe("no-store");
  });
  it("rejects cross-origin submissions before spending gas", async () => {
    expect((await POST(request(claim, { origin: "https://attacker.example" }))).status).toBe(403);
    expect(relayer.submitSponsoredClaim).not.toHaveBeenCalled();
  });
  it("requires deployment configuration", async () => {
    vi.stubEnv("NEAR_RELAYER_SECRET_KEY", "");
    expect((await POST(request())).status).toBe(503);
    expect(relayer.submitSponsoredClaim).not.toHaveBeenCalled();
  });
  it("caps the body and gift ID before reading chain state", async () => {
    expect((await POST(request({ ...claim, secret: "x".repeat(5000) }))).status).toBe(413);
    expect((await POST(request({ ...claim, giftId: "18446744073709551616" }))).status).toBe(400);
    expect(rpc.readNearContractView).not.toHaveBeenCalled();
  });
  it("returns 404 for a gift that does not exist", async () => {
    vi.mocked(rpc.readNearContractView).mockResolvedValue(null);
    expect((await POST(request())).status).toBe(404);
    expect(relayer.submitSponsoredClaim).not.toHaveBeenCalled();
  });
  it("rejects wrong secrets and invalid wallet signatures without sponsoring", async () => {
    expect((await POST(request({ ...claim, secret: `0x${"ef".repeat(32)}` }))).status).toBe(403);
    vi.mocked(relayer.verifyRecipientSignature).mockResolvedValue(false);
    expect((await POST(request())).status).toBe(403);
    expect(relayer.submitSponsoredClaim).not.toHaveBeenCalled();
  });
  it("rejects expired and already claimed gifts", async () => {
    vi.mocked(rpc.readNearContractView).mockResolvedValueOnce({ ...gift, expires_at_ns: "1" });
    expect((await POST(request())).status).toBe(409);
    vi.mocked(rpc.readNearContractView).mockResolvedValueOnce({ ...gift, status: "Claimed" });
    expect((await POST(request())).status).toBe(409);
    expect(relayer.submitSponsoredClaim).not.toHaveBeenCalled();
  });
  it("does not return success for a failed token transfer", async () => {
    vi.mocked(relayer.submitSponsoredClaim).mockRejectedValue(new Error("private RPC details"));
    const response = await POST(request());
    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({ ok: false, error: "near_claim_failed" });
  });
});
