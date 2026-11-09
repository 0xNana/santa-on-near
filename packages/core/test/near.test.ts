import { afterEach, describe, expect, it, vi } from "vitest";
import { Account, JsonRpcProvider, KeyPairEd25519, KeyPairSigner } from "near-api-js";
import { createNearClient, NEAR_TESTNET_RPC_URL, validateNearRpcUrl } from "../src/near.js";
import {
  nep413Hash,
  parseNearRelayerConfig,
  sponsoredClaimMessage,
  submitSponsoredClaim,
  verifyRecipientSignature,
} from "../src/near-relayer.js";
import { readNearContractView } from "../src/near-contract.js";
import { createHash } from "node:crypto";

describe("NEAR Testnet support", () => {
  afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

  const secret = `0x${"12".repeat(32)}`;
  const nonce = "ab".repeat(32);
  const claim = { giftId: "7", secret, recipientId: "alice.testnet", nonce };
  function config() {
    return parseNearRelayerConfig({
      NEAR_CONTRACT_ACCOUNT: "santa.testnet",
      NEAR_RELAYER_ACCOUNT: "relayer.testnet",
      NEAR_RELAYER_SECRET_KEY: KeyPairEd25519.fromRandom().toString(),
      SANTA_PUBLIC_ORIGIN: "https://santa.example",
    });
  }

  it("verifies browser wallet signatures including their callback URL", async () => {
    const signer = KeyPairSigner.fromSecretKey(KeyPairEd25519.fromRandom().toString());
    const issuedAt = Date.now();
    const signed = await signer.signNep413Message(claim.recipientId, {
      message: sponsoredClaimMessage({ ...claim, issuedAt }),
      recipient: "santa.testnet",
      nonce: Buffer.from(nonce, "hex"),
      callbackUrl: "https://santa.example/g/7",
    });
    vi.spyOn(JsonRpcProvider.prototype, "viewAccessKey").mockResolvedValue({
      nonce: 1n, permission: "FullAccess", block_hash: "block", block_height: 1,
    });
    await expect(verifyRecipientSignature(config(), claim, {
      accountId: signed.accountId,
      publicKey: signed.publicKey.toString(),
      signature: Buffer.from(signed.signature).toString("base64"),
    }, issuedAt, nonce)).resolves.toBe(true);
  });

  it("verifies Meteor's standard NEP-413 signature without an optional callback URL", async () => {
    const signer = KeyPairSigner.fromSecretKey(KeyPairEd25519.fromRandom().toString());
    const issuedAt = Date.now();
    const signed = await signer.signNep413Message(claim.recipientId, {
      message: sponsoredClaimMessage({ ...claim, issuedAt }),
      recipient: "santa.testnet",
      nonce: Buffer.from(nonce, "hex"),
    });
    vi.spyOn(JsonRpcProvider.prototype, "viewAccessKey").mockResolvedValue({
      nonce: 1n, permission: "FullAccess", block_hash: "block", block_height: 1,
    });
    const signature = {
      accountId: signed.accountId, publicKey: signed.publicKey.toString(),
      signature: Buffer.from(signed.signature).toString("base64"),
    };
    await expect(verifyRecipientSignature(config(), claim, signature, issuedAt, nonce)).resolves.toBe(true);
    await expect(verifyRecipientSignature(config(), { ...claim, giftId: "8" }, signature, issuedAt, nonce)).resolves.toBe(false);
    await expect(verifyRecipientSignature(config(), { ...claim, recipientId: "bob.testnet" }, signature, issuedAt, nonce)).resolves.toBe(false);
    await expect(verifyRecipientSignature(config(), claim, signature, issuedAt - 300_000, nonce)).resolves.toBe(false);
  });

  it("rejects signatures for another contract or an unexpected callback URL", async () => {
    const signer = KeyPairSigner.fromSecretKey(KeyPairEd25519.fromRandom().toString());
    const issuedAt = Date.now();
    const viewKey = vi.spyOn(JsonRpcProvider.prototype, "viewAccessKey").mockResolvedValue({
      nonce: 1n, permission: "FullAccess", block_hash: "block", block_height: 1,
    });
    for (const payload of [
      { recipient: "other.testnet" },
      { recipient: "santa.testnet", callbackUrl: "https://other.example/g/7" },
    ]) {
      const signed = await signer.signNep413Message(claim.recipientId, {
        message: sponsoredClaimMessage({ ...claim, issuedAt }), nonce: Buffer.from(nonce, "hex"), ...payload,
      });
      await expect(verifyRecipientSignature(config(), claim, {
        accountId: signed.accountId, publicKey: signed.publicKey.toString(),
        signature: Buffer.from(signed.signature).toString("base64"),
      }, issuedAt, nonce)).resolves.toBe(false);
    }
    expect(viewKey).not.toHaveBeenCalled();
  });

  it("rejects signatures made with a limited function-call key", async () => {
    const signer = KeyPairSigner.fromSecretKey(KeyPairEd25519.fromRandom().toString());
    const issuedAt = Date.now();
    const signed = await signer.signNep413Message(claim.recipientId, {
      message: sponsoredClaimMessage({ ...claim, issuedAt }),
      recipient: "santa.testnet", nonce: Buffer.from(nonce, "hex"),
      callbackUrl: "https://santa.example/g/7",
    });
    vi.spyOn(JsonRpcProvider.prototype, "viewAccessKey").mockResolvedValue({
      nonce: 1n,
      block_hash: "block", block_height: 1,
      permission: { FunctionCall: { receiver_id: "unrelated.testnet", method_names: [], allowance: null } },
    });
    await expect(verifyRecipientSignature(config(), claim, {
      accountId: signed.accountId,
      publicKey: signed.publicKey.toString(),
      signature: Buffer.from(signed.signature).toString("base64"),
    }, issuedAt, nonce)).resolves.toBe(false);
  });

  function mockTokenStorage(registered: boolean, min = "1250000000000000000000", usedNonce = false) {
    vi.stubGlobal("fetch", vi.fn(async (_url, options) => {
      const request = JSON.parse(options.body);
      const value = request.params.method_name === "get_gift" ? { token_id: "token.testnet", status: "Open",
        secret_hash: `0x${createHash("sha256").update(secret).digest("hex")}`,
        expires_at_ns: (BigInt(Date.now() + 86_400_000) * 1_000_000n).toString(),
      } : request.params.method_name === "is_claim_nonce_used" ? usedNonce
        : request.params.method_name === "storage_balance_of" ? (registered ? { total: min, available: "0" } : null)
        : { min, max: min };
      return Response.json({ result: { result: [...Buffer.from(JSON.stringify(value))] } });
    }));
  }

  it("refuses an already consumed onchain nonce before paying for registration or gas", async () => {
    mockTokenStorage(false, "1250000000000000000000", true);
    const submit = vi.spyOn(Account.prototype, "signAndSendTransaction");
    await expect(submitSponsoredClaim(config(), claim)).rejects.toThrow();
    expect(submit).not.toHaveBeenCalled();
  });

  it("does not report a claim as successful when its transfer callback returns false", async () => {
    mockTokenStorage(true);
    vi.spyOn(Account.prototype, "signAndSendTransaction").mockResolvedValue({
      status: { SuccessValue: Buffer.from("false").toString("base64") },
      transaction: { hash: "failed-transfer" },
    } as never);
    await expect(submitSponsoredClaim(config(), claim)).rejects.toThrow("transaction failed");
  });

  it("sponsors token registration before claiming to a new recipient", async () => {
    mockTokenStorage(false);
    const submit = vi.spyOn(Account.prototype, "signAndSendTransaction")
      .mockResolvedValueOnce({ status: { SuccessValue: "" } } as never)
      .mockResolvedValueOnce({
        status: { SuccessValue: Buffer.from("true").toString("base64") },
        transaction: { hash: "claimed" },
      } as never);
    await expect(submitSponsoredClaim(config(), claim)).resolves.toBe("claimed");
    expect(submit.mock.calls[0]?.[0]).toMatchObject({ receiverId: "token.testnet" });
    expect(submit.mock.calls[1]?.[0]).toMatchObject({ receiverId: "santa.testnet" });
  });

  it("refuses excessive token registration costs before signing a transaction", async () => {
    mockTokenStorage(false, "1000000000000000000000000");
    const submit = vi.spyOn(Account.prototype, "signAndSendTransaction");
    await expect(submitSponsoredClaim(config(), claim)).rejects.toThrow();
    expect(submit).not.toHaveBeenCalled();
  });
  it("uses the NEAR testnet endpoint and rejects insecure RPC URLs", async () => {
    expect(NEAR_TESTNET_RPC_URL).toBe("https://rpc.testnet.near.org");
    expect(() => validateNearRpcUrl("http://rpc.testnet.near.org")).toThrow();
    expect(() => validateNearRpcUrl("https://user:secret@rpc.testnet.near.org")).toThrow();
    expect((await createNearClient()).networkId).toBe("testnet");
  });

  it("requires a valid sponsored-claim relayer configuration", () => {
    const secretKey = KeyPairEd25519.fromRandom().toString();
    const config = parseNearRelayerConfig({
      NEAR_CONTRACT_ACCOUNT: "santa.testnet",
      NEAR_RELAYER_ACCOUNT: "relayer.testnet",
      NEAR_RELAYER_SECRET_KEY: secretKey,
      SANTA_PUBLIC_ORIGIN: "https://santa.example",
    });
    expect(config.NEAR_RPC_URL).toBe(`${NEAR_TESTNET_RPC_URL}/`);
    expect(config.SANTA_PUBLIC_ORIGIN).toBe("https://santa.example");
    expect(() => parseNearRelayerConfig({
      NEAR_CONTRACT_ACCOUNT: "Santa.testnet",
      NEAR_RELAYER_ACCOUNT: "relayer.testnet",
      NEAR_RELAYER_SECRET_KEY: secretKey,
      SANTA_PUBLIC_ORIGIN: "https://santa.example",
    })).toThrow();
  });

  it("matches the NEP-413 digest used by the NEAR SDK signer", async () => {
    const signer = KeyPairSigner.fromSecretKey(KeyPairEd25519.fromRandom().toString());
    const message = "SantaClaim:v1\ngift:7\nrecipient:alice.testnet\nsecret:abc\nissued_at:123\nnonce:nonce";
    const nonce = Uint8Array.from({ length: 32 }, (_, index) => index);
    const signed = await signer.signNep413Message("alice.testnet", {
      message,
      recipient: "santa.testnet",
      nonce,
    });
    expect(signed.publicKey.verify(
      nep413Hash(message, "santa.testnet", nonce),
      signed.signature,
    )).toBe(true);
    expect(signed.publicKey.verify(
      nep413Hash(`${message}x`, "santa.testnet", nonce),
      signed.signature,
    )).toBe(false);
  });

  it("reads a contract view from the NEAR JSON-RPC response", async () => {
    const value = { gift_id: "42", status: "Open" };
    const fetchImpl: typeof fetch = async (_input, init) => {
      const request = JSON.parse(String(init?.body)) as {
        method: string;
        params: { method_name: string; account_id: string };
      };
      expect(request.method).toBe("query");
      expect(request.params.method_name).toBe("get_gift");
      expect(request.params.account_id).toBe("santa.testnet");
      return Response.json({
        result: { result: [...new TextEncoder().encode(JSON.stringify(value))] },
      });
    };
    await expect(readNearContractView(
      NEAR_TESTNET_RPC_URL,
      "santa.testnet",
      "get_gift",
      { gift_id: "42" },
      fetchImpl,
    )).resolves.toEqual(value);
  });

  it("binds sponsored claim approval to gift, recipient, secret, timestamp, and nonce", () => {
    const params = {
      giftId: "7",
      recipientId: "alice.testnet",
      secret: `0x${"12".repeat(32)}`,
      issuedAt: 123,
      nonce: "ab".repeat(32),
    };
    const message = sponsoredClaimMessage(params);
    expect(message).toContain("gift:7");
    expect(message).toContain("recipient:alice.testnet");
    expect(message).toContain("issued_at:123");
    expect(message).toContain(`nonce:${params.nonce}`);
    expect(sponsoredClaimMessage({ ...params, recipientId: "mallory.testnet" })).not.toBe(message);
  });
});
