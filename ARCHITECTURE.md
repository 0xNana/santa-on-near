# Santa architecture

The active gifting experience runs on NEAR Testnet. It is composed of the Next.js web app, a Rust NEAR smart contract, a NEAR RPC client, and a sponsored-claim API backed by a separately funded relayer account.

| Component | Responsibility |
| --- | --- |
| `packages/web` | NEAR Wallet Selector, gift creation, private link handling, note encryption, and claim UX |
| `packages/core/src/near.ts` | NEAR Testnet constants, RPC validation, and provider creation |
| `packages/core/src/near-contract.ts` | Safe JSON-RPC contract view calls |
| `packages/core/src/near-relayer.ts` | NEP-413 verification and sponsored claim transaction submission |
| `packages/contracts/near` | NEP-141 escrow contract, gift state, claim, and refund |
| `packages/contracts/deploy-near-testnet.sh` | Compile, deploy, initialize, and verify a fresh Testnet contract |

The old EVM packages and Solidity contract are retained as legacy code; the active send and gift routes do not call them.

## Gift creation

1. The browser reads the selected token metadata and the contract's next gift ID.
2. The browser generates a 32-byte random secret and hashes its UTF-8 representation with SHA-256. The secret is never part of the transfer-call message.
3. Optional note content is encrypted using AES-GCM with the claim secret as key material. The contract stores only the resulting ciphertext.
4. The sender registers Santa with the token using NEP-145 `storage_deposit` if necessary, then signs NEP-141 `ft_transfer_call` to the Santa account. The transfer message contains gift ID, secret hash, expiration timestamp, and encrypted note.
5. `ft_on_transfer` accepts only allowlisted tokens and validates the expected ID, amount, secret commitment, expiry, and note size. Invalid deposits return the full amount to the FT contract for refund. A `gift_created` event identifies the created gift.

The contract stores gift state under the FT transfer's `sender_id`, and only the sender may refund an unclaimed gift after expiry.

## Sponsored claim

1. The page saves the secret to session storage scoped by contract and gift, removes it from the URL fragment before any claim request, loads the public gift, and decrypts the note locally. Reloads in the same tab can resume the claim.
2. The recipient connects a NEAR wallet and signs a NEP-413 message bound to gift ID, recipient account, secret commitment, issued-at time, and a random nonce.
3. `POST /api/near/claim` applies origin, request-size, and in-process rate checks; reads the gift state; checks the secret hash; verifies the NEP-413 signature (an omitted optional callback URL or the exact claim-page URL); and verifies that the signing key is currently a full-access key of the stated account.
4. The server-only relayer registers the recipient with the gift token when necessary, capped at 0.1 testnet NEAR, then submits `claim_gift`. The contract verifies the secret hash, relayer account, gift state, expiry, and one-use nonce before scheduling a NEP-141 transfer.
5. A private callback marks the gift claimed on success or returns it to open state on failure. The API checks the callback result before reporting success. The nonce remains consumed on failure, so a retry needs a new recipient signature.

The relayer is a trusted authorization boundary: the contract checks its account and the bearer secret, while the backend checks the recipient's wallet ownership. Keep the relayer key separate from the owner and deployment keys. The secret becomes public in the claim transaction; note encryption protects notes before redemption, not from observers after redemption.

Sponsored claim rate limits are currently process-local, not distributed. Multi-instance hosting must add a shared limiter before launch. The relayer key must never be exposed to the browser.

Before registration or claim spending, the relayer queue re-reads the open gift and checks its commitment, expiry, and `is_claim_nonce_used`. Identical in-flight approvals share one operation; competing approvals for that gift are refused. Transactions from one relayer are serialized across gifts to avoid key-nonce races. A signer-wide hourly attempt limit defaults to 60 and counts failures independently of client IP headers. These counters are process-local and reset on restart; run one instance and do not describe them as a persistent financial limit.

## Refund

The original sender may call `refund_gift` only after expiry and while the gift is open. The contract marks the gift as refunding before transferring tokens back and uses a private callback to finalize or reopen the record based on the FT transfer result.

## Testnet configuration

The contract and web app default to NEAR Testnet. `NEAR_CONTRACT_ACCOUNT` and `NEXT_PUBLIC_NEAR_CONTRACT_ACCOUNT` must identify the same deployed account. The onchain allowlist is configured at initialization; `NEXT_PUBLIC_NEAR_TOKEN_ACCOUNT_IDS` controls which configured tokens the UI offers. `NEAR_RELAYER_ACCOUNT` must match the relayer configured in the contract, and `NEAR_RELAYER_SECRET_KEY` must belong to that account.

Deployment is explicit and requires an existing testnet contract account, a local `near-cli-rs` keychain, and at least one allowlisted NEP-141 token. No contract is deployed automatically.

`npm run near:contract:deploy:testnet` loads the root `.env`, compiles with the Cargo lockfile, deploys and initializes atomically, then reads the next ID, owner/relayer configuration, and gift view. The default `packages/contracts/deploy.sh` uses this NEAR path; `deploy-evm-legacy.sh` retains the historical EVM deploy command.
