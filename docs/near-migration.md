# NEAR implementation and testnet handoff

Santa's `/send` and `/g/<id>` routes use NEAR Wallet Selector and a Rust NEP-141 escrow. The default deploy command targets NEAR Testnet. Verified deployment and live gift receipts are recorded in `docs/near-testnet-deployment.json` and `docs/near-testnet-smoke.json`; browser-wallet and real expiry-refund verification remain pending.

## Contract interface

All account arguments are NEAR account IDs. `U64` gift IDs and nanosecond timestamps and `U128` token amounts serialize as decimal JSON strings.

| Method | Caller / deposit | Result |
| --- | --- | --- |
| `new(owner_id, relayer_id, allowed_tokens)` | Fresh contract initialization | Initial state; no gifting fee |
| `ft_on_transfer(sender_id, amount, msg)` | Allowlisted NEP-141 contract | Unused amount; zero accepts the deposit |
| `claim_gift(gift_id, secret, recipient_id, nonce)` | Configured relayer; exactly 1 yoctoNEAR | Promise returning `true` only after token transfer succeeds |
| `refund_gift(gift_id)` | Original sender after expiry; exactly 1 yoctoNEAR | Promise returning transfer success |
| `get_gift(gift_id)` | Public view | Gift or `null` |
| `get_next_gift_id()` | Public view | Next expected ID |
| `get_config()` | Public view | `owner_id`, `relayer_id` |
| `is_claim_nonce_used(nonce)` | Public view | Reject replay before relayer spending |
| `is_token_allowed(token_id)` | Public view | Boolean |
| `set_token_allowed(token_id, allowed)` | Owner | Update allowlist |
| `set_relayer(relayer_id)` | Owner | Rotate authorized relayer |

Gift creation uses the token's `ft_transfer_call`, never an ERC-20 approval or a metadata-only `create_gift`. The `msg` is JSON with `gift_id`, `secret_hash`, `expires_at_ns`, and optional `sealed_note`. A lifetime must be between one hour and 90 days at execution. Amounts must be positive. The hash is lowercase `0x` plus SHA-256 of the UTF-8 claim secret. The encrypted note is at most 1024 bytes of base64; the browser limits plaintext to 740 UTF-8 bytes.

IDs use optimistic concurrency: if another sender consumes the expected ID first, `ft_on_transfer` returns the full transferred amount to the FT resolver. The browser verifies the stored secret commitment before publishing or recovering a link. A rejected transfer must be retried with the current ID. Refunds are available only after expiry; there is no early cancellation method.

Gift states are `Open → Claiming → Claimed` or `Open → Refunding → Refunded`. Failed transfers return to `Open`. Claim nonces remain consumed after failure. Private callbacks cannot be invoked by external accounts.

## Wallet and sponsorship boundary

Meteor uses Wallet Selector's `signMessage` method. The message binds the gift, recipient, secret commitment, timestamp, and random nonce. Verification accepts either no optional callback URL or the exact claim URL `${SANTA_PUBLIC_ORIGIN}/g/<id>`, and requires a registered full-access key. The backend accepts authorizations within two minutes, and the contract prevents nonce replay.

The relayer pays gas and, when necessary, the token's NEP-145 registration minimum up to 0.1 testnet NEAR. The owner funds contract state storage, and the sender funds Santa's initial token registration if required. The contract trusts its configured relayer to verify wallet authorization. Use trusted allowlisted tokens and one app instance until rate limiting and relayer transaction coordination are shared across instances.

The active wallet is Meteor; MyNearWallet's retirement blocked new connections and approvals. Meteor's adapter omits the optional NEP-413 callback URL. Verification therefore accepts a signature with no callback or with the exact configured gift URL, and refuses other signed callback URLs. Both forms must bind the configured contract, gift ID, recipient, secret commitment, nonce, and fresh timestamp, with an onchain full-access recipient key. See `wallet-demo.md` for the real browser test; the earlier local-key evidence does not establish wallet UI success.

The claim is a bearer link, with recipient identity chosen at redemption. Do not use it for a gift restricted to a predetermined account. The claim secret and thus the note's decryption key become public when the claim transaction is broadcast.

## Testnet deployment checklist

1. Create and fund distinct testnet contract, owner, sender, recipient, and relayer accounts. Configure the deployment key in `near-cli-rs`; keep the relayer key server-only.
2. Copy `.env.example` to `.env`. Set the NEAR account IDs, token allowlist, relayer secret, and exact public origin. Set matching public contract and token IDs before building. The deploy command reads this root `.env`; existing process values take precedence.
3. Use a trusted NEP-141 testnet token implementing NEP-145 storage management. Fund the sender with tokens and testnet NEAR. Keep enough NEAR on the contract for gift/nonce storage and on the relayer for gas and recipient registration.
4. Run `npm test`, web typecheck/lint/build, `npm run near:contract:test`, and `npm run near:contract:build`.
5. Run `npm run near:contract:deploy:testnet` against a fresh contract account. Verify the printed account, owner, relayer, next gift ID, and empty first-gift result. This command is not a state migration for an initialized contract.
6. Open `/send`, connect the sender, and create a small gift with a note. Verify that the token escrow balance increased and `get_gift` shows the expected amount and secret commitment. Reload to verify link recovery.
7. Open the complete link in a separate recipient session with no registration for that token. Connect, sign the message, and claim. Verify `Claimed` and the recipient's token balance. A repeated claim must fail.
8. Create a separate short-lived gift through the token CLI with an expiry at least one hour ahead. After expiry, connect the sender and refund. Verify `Refunded` and the sender's restored balance.
9. Record contract/token IDs, create/claim/refund transaction links, and the tested commit in a new deployment record. Replace historical deployment references only with verified evidence.

## Verified deployment and current source

The escrow `gifts.santa-gifts.testnet` and standard token fixture `token.santa-gifts.testnet` are deployed and initialized. Their code hashes and initialization receipts are in [near-testnet-deployment.json](near-testnet-deployment.json). Gift #1 exercised the production HTTP API with local test-account signatures and sponsored recipient registration; [the separate Meteor wallet run](near-wallet-demo.md) verifies gift #2 through actual wallet dialogs and final chain reads.

The current tree contains only the NEAR web app, four core NEAR modules, the Rust contract, and supporting tests/tooling. The former CLI, contracts, API fallback, unused UI, storage/geolocation backend and dependencies have been removed. Earlier source remains in the baseline history disclosed in README. Local historical checks are in [local-validation.json](local-validation.json); the original published milestone CI run is in [remote-ci.json](remote-ci.json). Cleanup validation is recorded separately so historical test counts are not presented as current.

The Docker image runs the standalone Next.js app as `node`, with no database volume, geolocation updater or privileged entrypoint. Follow [the Fly guide](fly-deployment.md) for optional hosting. The deploy script initializes fresh contract accounts; never rerun it against the already initialized demo escrow.

## Standards

- [NEP-141 token transfer and resolver](https://github.com/near/NEPs/blob/master/neps/nep-0141.md)
- [NEP-145 token storage registration](https://github.com/near/NEPs/blob/master/neps/nep-0145.md)
- [NEP-413 wallet message signing](https://github.com/near/NEPs/blob/master/neps/nep-0413.md)
- [Wallet Selector wallet API](https://github.com/near/wallet-selector/blob/main/packages/core/docs/api/wallet.md)
