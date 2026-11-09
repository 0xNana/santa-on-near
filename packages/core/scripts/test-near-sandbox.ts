import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { Sandbox, DEFAULT_ACCOUNT_ID, DEFAULT_PRIVATE_KEY } from "near-sandbox";
import { Account, JsonRpcProvider, KeyPairEd25519, KeyPairSigner, type SerializedReturnValue } from "near-api-js";

// This test creates ephemeral local accounts only. It never reads .env or uses a public network.
// near-sandbox 0.3.5 leaves a piped stderr unread by default; inherit it to prevent node log backpressure.
process.env.NEAR_ENABLE_SANDBOX_LOG = "1";
process.env.RUST_LOG = "error";
let running: Sandbox | undefined;
const watchdog = setTimeout(() => {
  console.error("NEAR Sandbox integration test exceeded three minutes.");
  void (running?.tearDown() ?? Promise.resolve()).finally(() => process.exit(1));
}, 180_000);
watchdog.unref();
const sandbox = await Sandbox.start({ version: "2.14.0", config: {
  // Keep time advancement within one epoch; hundreds of epoch transitions are unrelated to gifting.
  additionalGenesis: { epoch_length: 1_000_000 },
} });
running = sandbox;
try {
  const provider = new JsonRpcProvider({ url: sandbox.rpcUrl });
  const root = new Account(DEFAULT_ACCOUNT_ID, provider, KeyPairSigner.fromSecretKey(DEFAULT_PRIVATE_KEY));
  async function account(prefix: string) {
    const key = KeyPairEd25519.fromRandom();
    const id = `${prefix}.${root.accountId}`;
    await root.createSubAccount({ accountOrPrefix: prefix, publicKey: key.getPublicKey(), nearToTransfer: 50_000_000_000_000_000_000_000_000n });
    return new Account(id, provider, KeyPairSigner.fromSecretKey(key.toString()));
  }
  const sender = await account("sender");
  const recipient = await account("recipient");
  const relayer = await account("relayer");
  const santa = await account("santa");
  const token = await account("token");
  const wasm = new URL("../../contracts/near/target/wasm32-unknown-unknown/release/", import.meta.url);
  await santa.deployContract(await readFile(new URL("santa_near.wasm", wasm)));
  await token.deployContract(await readFile(new URL("santa_test_token.wasm", wasm)));
  const call = <T extends SerializedReturnValue = SerializedReturnValue>(actor: Account, contract: Account, methodName: string, args: Record<string, unknown>, deposit = 0n) =>
    actor.callFunction<T>({ contractId: contract.accountId, methodName,
      args, deposit, gas: 150_000_000_000_000n, waitUntil: "FINAL" });
  const view = <T extends SerializedReturnValue>(contract: Account, method: string, args: Record<string, unknown> = {}) =>
    provider.callFunction<T>({ contractId: contract.accountId, method, args });
  const gift = (id: string) => view<{ status: string }>(santa, "get_gift", { gift_id: id });
  const balance = (who: Account) => view<string>(token, "ft_balance_of", { account_id: who.accountId });
  const register = (who: Account) => call(sender, token, "storage_deposit", {
    account_id: who.accountId, registration_only: true,
  }, 10_000_000_000_000_000_000_000n);
  await call(santa, santa, "new", { owner_id: root.accountId, relayer_id: relayer.accountId, allowed_tokens: [token.accountId] });
  await call(token, token, "new", { owner_id: sender.accountId, total_supply: "1000" });
  await register(santa);
  const secret = `0x${"ab".repeat(32)}`;
  const secretHash = `0x${createHash("sha256").update(secret).digest("hex")}`;
  const block = await provider.viewBlock({ finality: "final" });
  const expires = (BigInt(block.header.timestamp_nanosec) + 3_900_000_000_000n).toString();
  const depositGift = (id: string, amount: string) => call(sender, token, "ft_transfer_call", {
    receiver_id: santa.accountId, amount,
    msg: JSON.stringify({ gift_id: id, secret_hash: secretHash, expires_at_ns: expires, sealed_note: null }),
  }, 1n);
  const claim = (nonce: string, id = "1") => call<boolean>(relayer, santa, "claim_gift", {
    gift_id: id, secret, recipient_id: recipient.accountId, nonce: `0x${nonce.repeat(32)}`,
  }, 1n);
  await depositGift("1", "25");
  assert.equal(await balance(santa), "25");
  assert.equal((await gift("1"))?.status, "Open");
  assert.equal(await claim("11"), false, "unregistered recipient transfer must fail and reopen gift");
  assert.equal((await gift("1"))?.status, "Open");
  await register(recipient);
  await assert.rejects(claim("11"), "a failed claim still consumes its nonce");
  assert.equal(await claim("22"), true);
  assert.equal((await gift("1"))?.status, "Claimed");
  assert.equal(await balance(recipient), "25");
  await assert.rejects(claim("33"), "a gift cannot be claimed twice");
  await assert.rejects(call(sender, santa, "resolve_claim", { gift_id: "1" }), "callback must be private in deployed WASM");
  console.log("PASS local-chain escrow, failed-transfer recovery, nonce replay, claim, private callback, and balances");

  await depositGift("2", "10");
  const before = await balance(sender);
  await depositGift("2", "10");
  assert.equal(await balance(sender), before, "stale-ID deposit must be returned by the real FT resolver");
  assert.equal(await balance(santa), "10");
  await assert.rejects(call(sender, santa, "refund_gift", { gift_id: "2" }, 1n));
  const response = await fetch(sandbox.rpcUrl, { method: "POST", headers: { "Content-Type": "application/json" }, signal: AbortSignal.timeout(60_000),
    body: JSON.stringify({ jsonrpc: "2.0", id: "fast-forward", method: "sandbox_fast_forward", params: { delta_height: 15_000 } }) });
  const advanced = await response.json() as { error?: unknown };
  assert.equal(advanced.error, undefined);
  assert.equal(await call(sender, santa, "refund_gift", { gift_id: "2" }, 1n), true);
  assert.equal((await gift("2"))?.status, "Refunded");
  assert.equal(await balance(sender), "975");
  assert.equal(await balance(santa), "0");
  console.log("PASS local-chain stale-ID refund, expiry enforcement, sender refund, and escrow conservation");
} finally {
  clearTimeout(watchdog);
  await sandbox.tearDown();
}
