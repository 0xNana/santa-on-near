# Judge walkthrough

Santa turns a token transfer into an expiring gift link: the sender escrows NEP-141 tokens, shares a bearer link, and the recipient connects a NEAR account to redeem it. Santa's relayer pays claim gas. This reduces the extra transfer/gas setup a recipient would otherwise need, while keeping escrow, redemption, and refunds visible on NEAR.

## Current evidence boundary

The escrow `gifts.santa-gifts.testnet` and standard test token `token.santa-gifts.testnet` are deployed on NEAR Testnet. Their code hashes and initialization receipts are in `docs/near-testnet-deployment.json`. Gift #1 created 25 TEST units in escrow and paid them to `recipient.santa-gifts.testnet` through the local production HTTP claim API; the relayer sponsored recipient registration and gas. The recipient's NEAR balance and transaction nonce stayed unchanged. Wrong-secret requests returned 403 and replay returned 409, without further spending. Exact receipts, before/after balances, and test interruptions are recorded in `docs/near-testnet-smoke.json`.

Gift #1 used a locally signed NEP-413 message. A separate real Meteor Wallet UI run now proves gift #2 end to end: sender transaction, recipient message signature, production HTTP claim, finalized callback `true`, recipient balance 25 → 50 TEST, unchanged recipient NEAR/nonce, and replay HTTP 409 without additional spending. See the [1:42 NEAR recording](../demo/near-demo.mp4), [scope and edit notes](../demo/NEAR-README.md), and [public evidence](../demo/near-transaction-proof.json). Saved-link recovery and the claimed state after reload were also checked. The recipient was already token-registered. The app ran locally; a hosted NEAR URL and real testnet expiry refund remain unverified. The older `demo/santa-demo.mp4` and `docs/deployment-testnet.json` remain EVM evidence.

## Reproduce locally

1. Use Node 22.22.2 or later within the Node 22 line, Rust/Cargo, and the `wasm32-unknown-unknown` target. Run `npm ci --ignore-scripts`, then `npm test`, `npm run near:contract:test`, and `npm run near:contract:build`. Expect passing tests and `santa_near.wasm`.
2. Run `npm run near:integration:test`. It compiles the test-only standard FT and launches an isolated local NEAR node. Expect real FT custody, failed-transfer recovery, nonce replay rejection, a successful claim, private callback rejection, stale-deposit return, and expiry refund balance assertions. The first run downloads the official NEAR Sandbox binary; it never loads `.env` or uses public-network accounts. Any startup/download failure is a failure, not a skipped pass.
3. For the browser flow, copy `.env.example` to `.env`, configure the actual NEAR deployment and relayer, and start `npm run dev --workspace=@santa/web`. Check `/api/near/health`: expect 200 only after the contract's configured relayer matches and the signer key is authorized. Health does not prove sufficient token or NEAR balances, or the recipient wallet flow.

For exact local commands, Chrome profiles, wallet recovery setup, and balance reads, follow [the browser-wallet runbook](wallet-demo.md).

## Complete wallet-to-wallet acceptance test

Use two distinct NEAR Testnet wallets. The sender needs test tokens and testnet NEAR. The recipient can begin unregistered with the token. The contract and relayer must have enough testnet NEAR. Use the configured, trusted NEP-141 token; no token represents equity or has claimed monetary value.

1. **Create:** connect the sender at `/send`, choose an amount, add a note, and approve the wallet transaction. Expect a private `/g/<id>#<secret>` link. In `get_gift`, verify sender, token, raw amount, expiry, and `Open`. Verify the escrow's token balance increased.
2. **Recover:** reload the sender page. Expect the confirmed link in saved gifts. A pending record must recover only if its sender, token, amount, and secret hash match the contract record.
3. **Claim:** open the complete link in a separate recipient session. Connect the recipient's NEAR wallet and sign the displayed claim authorization. Expect `Claimed`, the recipient's account as `recipient_id`, and its token balance increasing by the gift amount. Verify the explorer receipt and callback result; a transaction hash alone is insufficient.
4. **Replay:** submit the original authorization again and try a second claim. Expect refusal and no second payout. Invalid links, wrong secrets, and expired gifts must not consume a sponsored token transfer.
5. **Refund:** create a separate gift with a contract-valid short expiry, at least one hour ahead. After expiry, use the original sender's refund action. Expect `Refunded` and restored sender balance. The local sandbox covers this with time advancement; a real testnet refund requires real elapsed time.

Keep bearer links and keys out of recordings. The secret becomes public when redeemed; notes are encrypted before redemption, not permanently confidential. Claims trust the configured relayer to check wallet ownership. Refunds remain sender-controlled.
