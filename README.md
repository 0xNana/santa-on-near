<p align="center">
  <img src="packages/web/public/logo-square.png" alt="Santa" width="104">
</p>

<h1 align="center">Santa</h1>

<p align="center">Personal token gifts on NEAR.</p>

<p align="center">
  <a href="https://github.com/0xNana/santa-on-near/actions/workflows/near-validation.yml"><img src="https://github.com/0xNana/santa-on-near/actions/workflows/near-validation.yml/badge.svg" alt="NEAR validation"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue.svg" alt="MIT license"></a>
  <img src="https://img.shields.io/badge/network-NEAR%20Testnet-black" alt="NEAR Testnet">
</p>

<p align="center">
  <a href="https://santa-near-testnet.fly.dev">Live app</a> ·
  <a href="#demo">Video</a> ·
  <a href="#getting-started">Getting started</a> ·
  <a href="#configuration">Configuration</a> ·
  <a href="#development-and-testing">Testing</a> ·
  <a href="ARCHITECTURE.md">Architecture</a>
</p>

Santa lets someone turn NEP-141 tokens into a gift with a personal note and a private claim link. The sender deposits tokens into a Rust contract on NEAR. The recipient opens the link, connects a wallet, and signs a message; Santa's relayer pays for the claim transaction. If the gift expires unopened, the sender can request a refund.

The application currently runs on **NEAR Testnet**. The demonstrated TEST tokens have no monetary value.

## Features

- **Gift links:** share a gift without choosing the recipient's account in advance.
- **Personal notes:** encrypt a note in the browser before storing its ciphertext onchain.
- **Sponsored claims:** the relayer pays claim gas and eligible recipient token-storage registration.
- **Wallet authorization:** Meteor Wallet connects through NEAR Wallet Selector and signs NEP-413 claim messages.
- **Expiry and refunds:** choose a seven-, 30-, or 90-day expiry in the UI; the original sender can refund an expired, unclaimed gift.
- **Recovery:** saved gifts and pending deposits can recover after a reload when their details match the onchain record.
- **Onchain settlement:** the contract finalizes claims and refunds only after the token transfer succeeds.

## Demo

**[Open Santa on NEAR Testnet](https://santa-near-testnet.fly.dev)** · [API readiness](https://santa-near-testnet.fly.dev/api/near/health)

The hosted frontend and API run together on Fly.io. Public route, readiness and isolated-browser checks are recorded in [deployment verification](docs/fly-deployment.json).

[Watch the 1 minute 42 second wallet demo](https://github.com/0xNana/santa-on-near/blob/2121b4f2571439d0ed71d75d4d9fd1164970556c/demo/near-demo.mp4).

The recording shows a real Meteor sender deposit and recipient message signature, followed by a sponsored claim on NEAR Testnet. Gift #2 delivered **25 TEST**, increased the recipient's balance from **25 to 50 TEST**, and left their NEAR balance unchanged. Replaying the authorization returned HTTP 409 without another payout or relayer spend.

- [Create transaction](https://testnet.nearblocks.io/txns/5WdthDhUbjJAr77VCZMLvXHPsCrpWizcMK3Ay6S8UKQD)
- [Claim transaction](https://testnet.nearblocks.io/txns/FT7ySuADLNcDjngY5eZswk71bc98CDzP1HneyDCbQv45)
- [Public transaction proof](docs/near-wallet-proof.json)
- [Recording notes and credits](docs/near-wallet-demo.md)

The video uses a local production server and an already token-registered recipient. It demonstrates sponsored claim gas; it does not demonstrate public hosting or a real testnet expiry refund. Expiry/refund behavior is covered by the local NEAR Sandbox integration test.

Local recordings in `/demo/` are ignored and untracked. The video link pins the original published recording; its [size and checksum](docs/near-video-checks.json) remain verifiable from a fresh clone.

### Testnet deployment

| Component | Account |
| --- | --- |
| Escrow contract | `gifts.santa-gifts.testnet` |
| Allowlisted test token | `token.santa-gifts.testnet` |
| Claim relayer | `relayer.santa-gifts.testnet` |
| Contract owner | `santa-gifts.testnet` |

The fixture token's symbol is `TEST` and it has zero decimals: `25` means 25 units. Contract hashes and initialization receipts are recorded in [deployment verification](docs/near-testnet-deployment.json).

These public account IDs do not grant signing access. Running sponsored claims against this escrow requires its configured relayer's authorized key. For an independent installation, use your own contract, relayer, and allowlisted test token.

## How it works

1. **Create:** the sender connects a NEAR Testnet wallet, selects a token and amount, adds an optional note, and chooses an expiry.
2. **Deposit:** the browser generates a random secret, hashes it, encrypts the note, and asks the wallet to submit `ft_transfer_call` to the escrow.
3. **Share:** after confirming the deposit, Santa saves a private link. Its URL fragment carries the secret; the fragment is not included in ordinary HTTP requests.
4. **Authorize:** the recipient opens that link and signs a NEP-413 message binding the gift, recipient account, secret commitment, nonce, and timestamp.
5. **Claim:** the API verifies the signature against an onchain full-access key. The relayer registers token storage if needed and submits the claim. A successful transfer callback marks the gift claimed.
6. **Refund:** after expiry, the original sender can request a refund from their saved gifts. Refunds are explicit, not automatic.

Gift state follows `Open → Claiming → Claimed` or `Open → Refunding → Refunded`. A failed token transfer reopens the gift; a failed claim still consumes its nonce and requires a fresh authorization.

### Who pays?

| Participant | Responsibility |
| --- | --- |
| Sender | Gift tokens, deposit transaction gas, and the escrow's initial token registration when required. |
| Relayer | Claim gas and recipient token registration, capped at 0.1 testnet NEAR per registration. |
| Contract owner | Funding the escrow account's contract-state storage. |
| Recipient | Offchain wallet authorization; the sponsored claim does not charge them transaction gas. |

## Getting started

### Prerequisites

- **Node.js 22** and npm. `.nvmrc` selects the Node 22 line; validation used Node 22.23.4.
- **Rust/Cargo** and the `wasm32-unknown-unknown` target for contract builds and tests.
- **near-cli-rs** and funded testnet accounts only if deploying a new contract.
- **Meteor Wallet on testnet**, an allowlisted token balance, and a funded relayer for a complete browser gift flow.

Rust and deployment credentials are not required just to preview the web interface.

### Install

For a fresh clone:

```sh
git clone https://github.com/0xNana/santa-on-near.git
cd santa-on-near
npm ci --ignore-scripts
cp .env.example .env
```

If you use nvm, run `nvm install` and `nvm use` before installing dependencies. Preserve an existing `.env` and edit it rather than replacing it.

### Configure and run

Edit the root `.env` using the [configuration table](#configuration), then start the web app:

```sh
npm run dev --workspace=@santa/web
```

Open [http://localhost:3000](http://localhost:3000). The homepage and documentation can be previewed without signing credentials; the composer shows configuration guidance until public contract/token settings are supplied.

A complete send/claim flow additionally requires:

- A deployed escrow and a trusted NEP-141 token in its onchain allowlist.
- A sender with that token and enough testnet NEAR for the deposit.
- An existing recipient account with a full-access signing key.
- A server-only relayer key authorized by the escrow and funded for gas/storage.

Use the [browser walkthrough](docs/judges.md) to verify the resulting gift state and balances. Private demo wallet keys are not distributed with the repository.

### Production build

Set the public configuration before building:

```sh
npm run build --workspace=@santa/web
npm run start --workspace=@santa/web
```

The start command uses port 3000. Keep `SANTA_PUBLIC_ORIGIN` aligned with the actual origin, and use the same hostname throughout wallet connection and claiming.

## Configuration

The web configuration loads the repository-root `.env` for local runs. Existing process environment values take precedence. Hosted deployments supply server secrets at runtime.

| Variable | Used by | Description |
| --- | --- | --- |
| `NEAR_NETWORK_ID` | Server | `testnet`; other networks are rejected. |
| `NEAR_RPC_URL` | Server | HTTPS RPC URL; defaults to `https://rpc.testnet.near.org`. The browser uses the canonical testnet RPC. |
| `NEAR_CONTRACT_ACCOUNT` | Server, deployer | Escrow account ID. Must match the browser's contract setting. |
| `NEAR_RELAYER_ACCOUNT` | Server, deployer | Relayer account configured in the contract. |
| `NEAR_RELAYER_SECRET_KEY` | Server only | Private key authorized for that relayer. Never expose it through a `NEXT_PUBLIC_` variable. |
| `NEAR_MAX_SPONSORED_CLAIMS_PER_HOUR` | Server | Per-process sponsored-attempt limit; defaults to 60. Failed attempts count. |
| `SANTA_PUBLIC_ORIGIN` | Web, server | Exact app origin, such as `http://localhost:3000`; used for same-origin claim validation and absolute metadata URLs. |
| `NEXT_PUBLIC_NEAR_CONTRACT_ACCOUNT` | Browser build | Public escrow account ID. |
| `NEXT_PUBLIC_NEAR_TOKEN_ACCOUNT_IDS` | Browser build | Comma-separated token IDs offered by the composer; every token must also be allowlisted onchain. |
| `NEAR_OWNER_ACCOUNT` | Deployer | Initial contract owner. |
| `NEAR_ALLOWLISTED_TOKEN_IDS` | Deployer | Comma-separated token IDs used during initialization. |
| `NEAR_DEPLOY_KEYCHAIN` | Deployer | `legacy` for local `~/.near-credentials` files, or `os` for the operating-system keychain. |

Rebuild the app after changing `NEXT_PUBLIC_` values. Use a separate relayer key rather than the owner/deployer key. Keep `.env`, wallet credentials, private gift links, and request payloads out of Git, logs, and public issues.

## Architecture

| Component | Purpose |
| --- | --- |
| `packages/web` | Next.js/React interface, Wallet Selector, browser encryption, documentation, and claim/health routes. |
| `packages/core` | NEAR RPC helpers, NEP-413 verification, serialized relayer operations, and spending-attempt coordination. |
| `packages/contracts/near` | Rust escrow, allowlist, gift lifecycle, replay protection, and asynchronous transfer callbacks. |
| `packages/contracts/near/test-token` | Standards-based fungible-token fixture for local integration tests. |

NEP-141 provides token transfers, NEP-145 provides token-storage registration, and NEP-413 authorizes the recipient. Gift state and used nonces live onchain. The application does not require a database for its supported gift flow.

See [ARCHITECTURE.md](ARCHITECTURE.md) for the trust boundaries and transaction sequence.

### Repository layout

```text
packages/
  web/                       Web app and API routes
  core/
    src/near*.ts             RPC, signatures, relayer, and claim policy
    test/                    NEAR and evidence regression tests
    scripts/                 Local Sandbox integration runner
  contracts/
    near/                    Rust escrow, test token, and Cargo lockfile
    deploy-near-testnet.sh   Fresh-account deployment script
scripts/                     Deployment and evidence-checking tools
docs/                        Setup guides, technical notes, and public proof
.github/workflows/           Node and contract CI
```

## API and contract interface

| HTTP endpoint | Behavior |
| --- | --- |
| `GET /api/near/health` | Returns 200 when server configuration, contract relayer, and the relayer's registered full-access key agree; otherwise returns a fixed 503 response. |
| `POST /api/near/claim` | Validates a strict gift/recipient/nonce/timestamp/signature request and submits a sponsored claim after checking its authorization. |

Health does not establish sufficient balances or prove that a full wallet flow succeeds. Claim errors use fixed codes; raw signer/RPC errors are not returned. The [API documentation](packages/web/content/docs/api.mdx) describes the request boundary.

| Contract method | Purpose |
| --- | --- |
| `ft_on_transfer` | Accept a validated deposit from an allowlisted token contract. |
| `claim_gift` | Relayer-only redemption using the secret and a one-use nonce. |
| `refund_gift` | Sender-only recovery of an expired, open gift. |
| `get_gift`, `get_next_gift_id`, `get_config` | Read gift and escrow configuration. |
| `is_token_allowed`, `is_claim_nonce_used` | Read allowlist and nonce state. |
| `set_token_allowed`, `set_relayer` | Owner-managed token allowlist and relayer rotation. |

The contract accepts lifetimes from one hour to 90 days; the web composer offers seven, 30, or 90 days. Gift IDs, amounts, and nanosecond timestamps are represented as decimal strings in JSON. See the [contract and deployment guide](docs/near-migration.md) for argument shapes and deposits.

## Development and testing

From the repository root:

```sh
npm test
npm run typecheck --workspace=@santa/core
npm run typecheck --workspace=@santa/web
npm run lint --workspace=@santa/web
npm run build --workspace=@santa/web
npm audit --audit-level=high
```

For contracts and real local-chain integration:

```sh
rustup target add wasm32-unknown-unknown
cargo fmt --manifest-path packages/contracts/near/Cargo.toml --check
npm run near:contract:test
npm run near:contract:build
npm run near:integration:test
```

The Sandbox test uses ephemeral local accounts and needs no `.env`, wallet keys, or public-network funds. It covers custody, failed-transfer recovery, nonce rejection, successful claims, private callbacks, stale deposits, expiry refunds, and balance conservation. Its first run downloads NEAR Sandbox 2.14.0; `NEAR_SANDBOX_BIN_PATH` can point to an already installed official binary.

The cleaned implementation passed **57 JavaScript tests, nine Rust tests, production build/type checking, lint, browser smoke checks, and a Docker build/runtime check**. Both jobs in the [published cleanup CI run](https://github.com/0xNana/santa-on-near/actions/runs/42706049867) passed. The [validation record](docs/cleanup-validation.json) identifies the tested source and the scope of each check.

Additional local checks:

```sh
npm run check:leaks --workspace=@santa/web
SANTA_TEST_ORIGIN=http://localhost:3000 npm run check:setup --workspace=@santa/web
```

`check:leaks` requires a local `.env` containing at least one private value, builds isolated production output, and scans it for those values. `check:setup` requires a running local production server and checks rendered routes and unsupported-API handling.

## Deployment

### Fresh NEAR contract

Create and fund separate testnet contract, owner, and relayer accounts. Configure their IDs, the token allowlist, and the deployer's NEAR CLI keychain before running:

```sh
npm run near:contract:deploy:testnet
```

This command signs a testnet transaction, deploys the WASM, initializes the contract, and reads back its configuration. It is for a **fresh, uninitialized account**; do not run it against the already initialized demo escrow. Set matching public web settings and rebuild after deployment.

### Web application

The root Dockerfile builds a standalone Next.js image and runs it as the non-root `node` user. Supply public contract/token/origin values at build time and the relayer secret through the host's runtime secret manager. Run one application instance while coordination and rate limits remain process-local.

The application is deployed at [santa-near-testnet.fly.dev](https://santa-near-testnet.fly.dev). [The Fly deployment guide](docs/fly-deployment.md) covers the single-Machine setup, runtime secret and smoke checks. The frontend and API share this origin; a separate frontend host is not required.

## Security and limitations

- **Bearer links:** possession of the complete link permits a claim attempt. The recipient is chosen at redemption; a gift is not restricted to a predetermined account.
- **Note privacy:** encryption protects notes before redemption. Broadcasting the claim reveals the secret, allowing observers to decrypt the note afterward. Contract state, token amounts, and transfers are public.
- **Trusted relayer:** the backend checks wallet ownership; the contract trusts its configured relayer to perform that verification. Recipient signatures require a currently registered full-access key.
- **Replay and retries:** authorization binds the gift, recipient, commitment, nonce, and a timestamp within two minutes. An omitted optional callback URL or the exact gift-page URL is accepted; other signed callback URLs are rejected. A failed transfer requires a new nonce and signature.
- **Local storage:** sender recovery depends on local storage; recipient reload recovery uses session storage in the same tab. Losing that data or the complete link can lose access to the claim secret.
- **Operational limits:** identical in-flight claims are coalesced, competing claims are rejected, and relayer transactions are serialized. Counters are in memory, reset on restart, and do not provide a durable financial spending cap.
- **Token policy:** only trusted, allowlisted NEP-141 contracts should be enabled. The owner funds contract storage; the relayer needs enough balance for gas and eligible token registration.
- **Review scope:** the code has no external security audit. The latest dependency review records zero high/critical findings and 23 low/moderate findings; see [dependency review](docs/dependency-review.md). Keep this implementation on testnet.

## Contributing

Open an issue describing the problem or propose a focused pull request. Include behavior tests for changes to authorization, token accounting, expiry, or recovery, and run the relevant checks above. Explain user-visible changes and verification in the pull request. Never include private keys, live gift links, or unredacted claim payloads.

## Provenance and acknowledgements

The NEAR implementation builds on Santa's earlier interface and branding. The disclosed baseline is [`042714b`](https://github.com/0xNana/santa/tree/042714b49ea38060eaf92e38ecf9b4dc25fe07a1), which contained the earlier EVM product. The new contribution is the Rust NEAR escrow, wallet/signature flow, sponsored claims and token registration, recovery, deployment tooling, and tests. The current source tree is NEAR-only. [Review the contribution](https://github.com/0xNana/santa-on-near/compare/042714b49ea38060eaf92e38ecf9b4dc25fe07a1...main) or follow the [milestone history](docs/build-milestones.md).

Santa uses Next.js, React, Tailwind CSS, Fumadocs, NEAR Wallet Selector/Meteor Wallet, near-api-js, near-sdk-rs, and NEAR Contract Standards. NEAR Sandbox supplies the local integration environment. Codex assisted with implementation, tests, and documentation; the resulting source remains available for review.

## Hackathon Disclosure
> Santa is one of two NEAR HACKATHON entries by elegant. The other is [CareCart](https://github.com/0xNana/carecart), a separate project for clinic inventory and policy-controlled procurement. Santa focuses on personal token gifts and sponsored claims; the projects have distinct product and contract workflows.

## License

[MIT](LICENSE). Third-party dependencies retain their own licenses. Demo audio and visual assets have separate attribution in the [recording notes](docs/near-wallet-demo.md) and [brand asset guide](docs/brand-assets.md).
