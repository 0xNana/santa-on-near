# Santa on Fly.io

**Live app:** [https://santa-near-testnet.fly.dev](https://santa-near-testnet.fly.dev)
**Readiness:** [GET /api/near/health](https://santa-near-testnet.fly.dev/api/near/health)
**Verification:** [fly-deployment.json](fly-deployment.json)

The Next.js frontend and its claim/health route handlers are deployed together. Browser requests use the same HTTPS origin, so this deployment needs neither a separate frontend host nor a new API layer.

## Deployed configuration

- App: `santa-near-testnet`.
- One shared-CPU Machine, one vCPU, 1 GB RAM, in `lhr` (London).
- Automatic stopping disabled; one Machine kept running.
- Non-root `node` container user.
- Escrow: `gifts.santa-gifts.testnet`.
- Token: `token.santa-gifts.testnet`.
- Relayer: `relayer.santa-gifts.testnet`.
- One runtime secret: `NEAR_RELAYER_SECRET_KEY`, provisioned after explicit user approval.

Only the dedicated relayer key was exported. Owner, escrow, token, sender and recipient keys were excluded. The Docker build context excludes environment files, credentials, private gift files, local recordings and generated builds. No private key is passed as a build argument.

Gift state and nonces live on NEAR. This app does not need a database volume. Keep one Machine while relayer queues and rate limits are process-local; additional instances need shared coordination and spending limits.

## Build and deploy

The public account IDs and HTTPS origin are set in `fly.toml`. Browser settings are compiled at build time, so rebuild when they change. Supply the dedicated signer using Fly's secret manager; never import the whole local `.env`.

```sh
fly config validate --strict
fly deploy --app santa-near-testnet --local-only --depot=false --ha=false
fly status --app santa-near-testnet
fly checks list --app santa-near-testnet
fly machines list --app santa-near-testnet
```

The first deployment created one Machine and allocated shared IPv4 and dedicated IPv6 addresses. Do not enable redundant Machines until the app has shared relayer coordination. Contract deployment is separate; the already initialized demo escrow must not be reinitialized.

## Verification

On 10 November 2026, public checks verified:

- Homepage, send page, docs and contract docs return 200.
- Dynamic gift share images render with their bundled fonts.
- `/api/near/health` returns `ok: true`, `testnet` and the correct escrow ID.
- Cross-origin claims return 403; malformed JSON objects return 400; unsupported content types return 415.
- A request for an already claimed gift returns 409 before signing. Unsupported API paths return 404.
- Isolated Chrome renders the gift preview, Meteor selector, contract docs and 320px missing-link state without console errors, failed requests or horizontal overflow.

These deployment checks signed no new transaction. They establish hosted pages, network access, authorized signer readiness and request rejection. They do not substitute for a fresh hosted wallet-to-wallet transfer or a real testnet expiry refund. The earlier [wallet video and proof](near-wallet-demo.md) remain explicitly scoped to the local production run.

## Operations and rollback

`/api/near/health` checks configuration, the deployed relayer and the registered full-access key. It does not prove sufficient token/NEAR balances. Monitor Fly checks and logs, keep the relayer funded with testnet NEAR, and verify any transaction by its final callback and token balances.

Retain the image reference from [the deployment record](fly-deployment.json) for reproducible redeployment. Subsequent releases can select a known-good Fly image with `fly deploy --image <recorded-image> --ha=false`. If the first release becomes unsafe or unready, stop its Machine while investigating; do not change unrelated apps or overwrite onchain state. Restarts reset the in-memory attempt budget, so it is not a durable financial cap.
