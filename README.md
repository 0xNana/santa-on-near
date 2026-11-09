<p align="center">
  <img src="packages/web/public/logo-square.png" alt="Santa" width="96">
</p>

# Santa

**Send a little something to someone you love.**

Santa is a NEAR Testnet gifting app for allowlisted NEP-141 tokens. A sender escrows tokens in the Santa contract, adds an optional note encrypted in their browser, and shares a private claim link. The recipient connects a NEAR wallet; Santa sponsors the claim transaction. An unclaimed gift can be refunded by its sender after expiry.

## Problem and NEAR's role

A small token gift can require the recipient to fund gas and register with the token before receiving it. Santa lets the sender create a gift now and the recipient choose a NEAR account at redemption. The relayer pays gas and token registration, while the Rust contract holds the gift, prevents duplicate payouts, enforces expiry, and lets the sender recover unclaimed tokens. NEAR account keys authorize the recipient; NEP-141/145 supply token transfers and storage registration. The relayer is trusted to verify the recipient's signature, so this is not a claim of trustless or permanently private delivery.

## Status and hackathon fit

The active `/send` and `/g/<id>` flows target NEAR Testnet. **Open Innovation (`open`) is the recommended primary track**, subject to the team's final choice. Santa's current feature is personal token gifting; it does not yet implement the community treasury, shared-budget, or reputation workflows emphasized by Social Money. No DAO, Intents, private inference, or agent-commerce integration is claimed. Testnet-only projects and custom NEAR contracts are eligible under the [event rules](https://nearhackathon.com/HACKATHON.md).

**A live NEAR Testnet gift and sponsored claim are verified.** The escrow is `gifts.santa-gifts.testnet`; its allowlisted token is `token.santa-gifts.testnet`. Gift #1 transferred 25 valueless TEST units from `sender.santa-gifts.testnet` to `recipient.santa-gifts.testnet` through the local production claim API. The relayer paid recipient registration and gas; the recipient spent no NEAR. Wrong-secret and replay requests were refused without relayer spending. See the [create receipt](https://testnet.nearblocks.io/txns/3AeD2nFtgZ7aQhf1FkcQ7nRQNYHQMGaSWDtMD16xd582), [claim receipt](https://testnet.nearblocks.io/txns/FGpEYRAs4j4twJKWJXLvAMFQTCCFwjxB2bbr9xQeMcUk), [balances and live-test evidence](docs/near-testnet-smoke.json), and [deployment verification](docs/near-testnet-deployment.json).

**The real two-wallet NEAR demo is recorded.** Gift #2 used the actual Meteor Wallet UI for the sender deposit and recipient NEP-413 authorization against the local production app. The recipient received 25 TEST, spent no NEAR, and a replay returned 409 without further spending. Watch the [1:42 NEAR video](https://github.com/0xNana/santa-on-near/blob/2121b4f2571439d0ed71d75d4d9fd1164970556c/demo/near-demo.mp4), read its [recording notes](docs/near-wallet-demo.md), and inspect the [public proof](docs/near-wallet-proof.json). Optional hosting, a real testnet expiry refund, and public submission remain pending. See [the judge walkthrough](docs/judges.md) and [submission readiness](docs/hackathon-readiness.md).

The current source tree contains only the NEAR application. Superseded contracts, CLI, API, UI and dependencies have been removed; their history remains available at the disclosed baseline.

## Hackathon scope and provenance

The review baseline for this NEAR migration is [`042714b`](https://github.com/0xNana/santa/tree/042714b), dated 8 November 2026. That baseline contains the earlier EVM application, visual design, stock-token escrow, CLI, and related documentation. This is a migration of an existing product; those baseline features are not presented as new NEAR work.

The NEAR contribution is the Rust NEP-141 escrow and asynchronous claim/refund state machine, Wallet Selector account/signature flow, sponsored NEAR claims, token registration, private-link recovery, NEAR hosting/configuration, and corresponding tests. The dedicated NEAR repository is [0xNana/santa-on-near](https://github.com/0xNana/santa-on-near). Its local `codex/near-hackathon` branch preserves the original EVM history and groups the migration into reviewable milestones; see [the build history guide](docs/build-milestones.md). Inspect the complete contribution with `git diff 042714b..HEAD` and `git log --reverse --oneline 042714b..HEAD`. The seven milestones were published to `main` at [`2121b4f`](https://github.com/0xNana/santa-on-near/commit/2121b4f2571439d0ed71d75d4d9fd1164970556c). Both jobs in the [public CI run](https://github.com/0xNana/santa-on-near/actions/runs/42699958583) passed. Review the [published NEAR contribution](https://github.com/0xNana/santa-on-near/compare/042714b49ea38060eaf92e38ecf9b4dc25fe07a1...main) and [recorded verification](docs/remote-ci.json). The [submission checklist](submission.md) records publication and remaining human decisions.

## Libraries, assistance, and license

Santa uses Next.js, React, Tailwind CSS, Fumadocs, NEAR Wallet Selector/Meteor Wallet, near-api-js, near-sdk-rs, and NEAR Contract Standards. NEAR Sandbox is a development-only integration-test dependency. The existing Santa UI is baseline reuse; the removed implementation remains inspectable at the baseline. Codex assisted with the NEAR migration, tests, documentation, and this readiness review; generated code is included in the same review scope. Source is [MIT licensed](LICENSE); third-party packages and historical demo audio retain their own licenses and attribution.

## How it works

1. Connect a NEAR Testnet wallet and choose a configured NEP-141 token.
2. The browser creates a random claim secret, hashes it for the contract, encrypts the optional note, and submits `ft_transfer_call` to the allowlisted Santa contract.
3. Santa stores the gift metadata and holds the transferred tokens. The complete claim secret stays in the URL fragment, which is not sent in the HTTP request.
4. The recipient connects a NEAR Testnet wallet and signs a NEP-413 message binding the claim to that wallet, gift, secret commitment, nonce, and timestamp.
5. The server verifies a full-access wallet signature and asks the configured relayer to register the recipient with the token if needed (up to 0.1 testnet NEAR), then submit the claim. The contract releases the token and the relayer pays testnet gas.
6. After expiry, the original sender may request a refund. Refunds are not automatic.

Anyone with the complete link can attempt to claim the gift. Keep it private. Losing the link means losing access to its secret.

The recipient's secret is retained in session storage for the current tab so wallet sign-in and reloads can resume a claim. Sender links and pending sends are retained in local storage, scoped to the contract account. A reload recovers a pending link only when its sender, token, amount, and secret commitment match the onchain gift.

## Requirements

- Node.js 22.22.2 or newer within the Node 22 line and npm (`nvm use` reads `.nvmrc`)
- Rust/Cargo with `wasm32-unknown-unknown`
- `near-cli-rs` and a NEAR Testnet account authorized to deploy the contract
- A NEAR Testnet relayer account with a separate server-only key and enough testnet NEAR to sponsor claims
- At least one NEP-141 Testnet token contract to allowlist and test balances for sending

## Install

```sh
git clone https://github.com/0xNana/santa-on-near.git
cd santa-on-near
npm ci --ignore-scripts
cp .env.example .env
```

Set `NEAR_CONTRACT_ACCOUNT`, `NEAR_OWNER_ACCOUNT`, `NEAR_RELAYER_ACCOUNT`, `NEAR_ALLOWLISTED_TOKEN_IDS`, `NEAR_RPC_URL`, and `SANTA_PUBLIC_ORIGIN` in the root `.env`. Set the matching `NEXT_PUBLIC_NEAR_CONTRACT_ACCOUNT` and comma-separated `NEXT_PUBLIC_NEAR_TOKEN_ACCOUNT_IDS` before building the web app. Only the server uses `NEAR_RELAYER_SECRET_KEY`; never prefix it with `NEXT_PUBLIC_` or commit it.

The deployment account must already exist on NEAR Testnet, and `near-cli-rs` must have its deployment key configured in the local keychain. The deploy script deploys and initializes a fresh contract account; do not run it against an initialized account.

```sh
npm run near:contract:test
npm run near:contract:deploy:testnet
npm run dev --workspace=@santa/web
```

Open [localhost:3000](http://localhost:3000). A contract can be built without deployment using `npm run near:contract:build`.

## Configuration

| Variable | Purpose |
| --- | --- |
| `NEAR_NETWORK_ID` | `testnet` only. |
| `NEAR_RPC_URL` | NEAR Testnet JSON-RPC endpoint (defaults to `https://rpc.testnet.near.org`). |
| `NEAR_CONTRACT_ACCOUNT` | Deployed Santa contract account ID. |
| `NEAR_OWNER_ACCOUNT` | Initial contract owner used by the deploy script. |
| `NEAR_DEPLOY_KEYCHAIN` | `legacy` for `~/.near-credentials` or `os` for the operating-system keychain. |
| `NEAR_RELAYER_ACCOUNT` | Account authorized by the contract to submit sponsored claims. |
| `NEAR_RELAYER_SECRET_KEY` | Server-only private key belonging to the configured relayer account. |
| `NEAR_MAX_SPONSORED_CLAIMS_PER_HOUR` | Maximum sponsored attempts per relayer/process/hour; defaults to 60. Failed attempts count. |
| `NEAR_ALLOWLISTED_TOKEN_IDS` | Comma-separated NEP-141 contract IDs supplied to contract initialization. |
| `NEXT_PUBLIC_NEAR_CONTRACT_ACCOUNT` | Public contract ID used by the browser; must match the deployment. |
| `NEXT_PUBLIC_NEAR_TOKEN_ACCOUNT_IDS` | Comma-separated token IDs offered by the browser; each must be allowlisted onchain. |
| `SANTA_PUBLIC_ORIGIN` | Exact public app origin used to reject cross-origin sponsored claims. |

Use testnet accounts and assets only. Never deploy from a wallet holding mainnet funds.

## Development and verification

```sh
npm test
npm run typecheck --workspace=@santa/core
npm run typecheck --workspace=@santa/web
npm run lint --workspace=@santa/web
npm run build --workspace=@santa/web
npm run near:contract:test
npm run near:contract:build
npm run near:integration:test
npm run hackathon:check
```

All retained application tests target the NEAR implementation and its public evidence checks. Tests belonging only to removed features were removed with those features.

## Repository map

```text
packages/web/                 Next.js app, NEAR Wallet Selector, send and claim flows
packages/core/src/near*.ts     NEAR RPC and sponsored-claim verification
packages/contracts/near/       Rust NEAR escrow contract
packages/contracts/deploy-near-testnet.sh
```

## Security notes

- NEAR contract state and token transfers are public. The note ciphertext and claim-secret hash are stored onchain; the decryption key is carried only in the link fragment.
- Claim transactions reveal the secret and therefore the note's decryption key. Notes are private before redemption; observers can decrypt them after redemption.
- The backend validates a NEP-413 signature against a public key registered to the recipient account before spending relayer gas.
- The signing key must have full access. NEP-413 signatures may omit the optional callback URL (Meteor), or include the exact claim-page URL; other signed callback URLs are refused.
- The owner funds Santa's contract-state storage; the sender pays any initial token registration for the escrow. The relayer sponsors recipient token registration up to 0.1 testnet NEAR per account/token pair. Only allowlist trusted token contracts.
- The claim nonce is marked used onchain before token transfer; a failed transfer requires a fresh signed authorization.
- Sponsored claim rate limits are currently in-memory per server process. Use a single application instance or add a shared limiter before running multiple replicas.
- A single-process coordinator coalesces identical concurrent claims, rejects competing claims for a gift, serializes the relayer signer, and limits sponsored attempts across all IPs. Counters reset on restart; this is not a durable spending cap. Used nonces are checked onchain before funding token registration.
- This code has not had an external security audit. Keep the system on testnet.

See [the NEAR deployment checklist](docs/near-migration.md) for the implemented interface, remaining testnet setup, and retained legacy entry points.

The local-chain integration test launches NEAR Sandbox 2.14.0, downloads the official node on first use, and uses only ephemeral localhost accounts. It needs no `.env`, public-chain funds, or wallet keys. `NEAR_SANDBOX_BIN_PATH` can point to an already installed official sandbox binary. The test fails on download/startup/assertion errors; it never skips chain execution. `hackathon:check` is expected to remain blocked until reviewed source and genuine public NEAR evidence are ready.

## Demo distribution

`/demo/` is ignored and untracked; local recordings stay on the creator’s machine. The [recorded NEAR video](https://github.com/0xNana/santa-on-near/blob/2121b4f2571439d0ed71d75d4d9fd1164970556c/demo/near-demo.mp4) remains publicly available at its immutable published commit. Public [wallet proof](docs/near-wallet-proof.json), [recording notes](docs/near-wallet-demo.md), and [video checksum](docs/near-video-checks.json) live in `docs/`. The submission check downloads that pinned artifact and verifies its exact size, MP4 header and SHA-256; a fresh clone needs no local recording folder. The human still attaches the video to the required public X post.
