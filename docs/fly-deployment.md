# Deploy the NEAR app on Fly.io

Deploy the NEAR contract first using the [NEAR checklist](near-migration.md). The root Dockerfile and `fly.toml` build the Wallet Selector app and check readiness at `/api/near/health`. The previous hosting configuration is retained in `fly.evm-legacy.toml` and `docs/fly-evm-legacy.md`; it is not the default deployment target.

## Configure

The public account settings in `fly.toml` now match the verified Santa testnet deployment. The Fly app name `santa-near-testnet` and its origin remain proposed hosting settings, not proof of an existing app. Confirm an available Fly app name and update `app` and both public-origin values before deployment. The configured fields are:

- `build.args.NEXT_PUBLIC_NEAR_CONTRACT_ACCOUNT`: deployed Santa account.
- `build.args.NEXT_PUBLIC_NEAR_TOKEN_ACCOUNT_IDS`: comma-separated allowlisted token contracts.
- `env.NEAR_CONTRACT_ACCOUNT`: the same Santa account.
- `env.NEAR_RELAYER_ACCOUNT`: the relayer configured in the contract.

The Docker build rejects empty public contract, token, or origin values. Rebuild whenever public settings change. Keep exactly one Machine while rate limits and relayer transaction coordination are local to each instance. Gift state and replay nonces live in the NEAR contract; the active NEAR routes do not require a SQLite volume or the historical GeoIP database.

Create the Fly app using the name you configured, validate the configuration, and provision the server-only `NEAR_RELAYER_SECRET_KEY` through Fly secrets. Import only that dedicated relayer key. Do not import the whole local `.env` or upload the contract owner/deployer keys. Never put the relayer key in build arguments or `NEXT_PUBLIC_` variables.

```sh
fly apps create YOUR_APP_NAME
fly config validate --strict
# Provision NEAR_RELAYER_SECRET_KEY through Fly's secret-management flow.
fly deploy --ha=false
fly scale count 1
fly checks list
```

No hosting app is created or deployed by the repository's contract deployment command.

The local production HTTP API passed the approved 25 TEST gift and sponsored-claim test, including recipient registration and wrong-secret/replay refusal; see `near-testnet-smoke.json`. That test does not establish public hosting or a browser-wallet demo.

## Readiness and smoke checks

`GET /api/near/health` returns 200 only when server settings parse, the Santa contract's `get_config` view responds, its relayer matches, and the configured signer is a registered full-access key of that relayer account. It returns a fixed 503 response on failure. This does not prove sufficient relayer balance or token funding; verify those with a complete gift transaction.

After deployment, open `/send`, create a small testnet gift, and claim it from a separate recipient session. Confirm the contract's gift state and token balances, not merely a transaction hash. Repeat with an expired gift and refund. Keep testnet only until the flow has been externally reviewed.

The catch-all historical EVM API returns 410 by default, even when old EVM environment variables exist. It requires `SANTA_ENABLE_LEGACY_EVM_API=1` to opt in; leave that unset on the NEAR app. The old CLI remains a legacy EVM client.

The Docker context excludes `.env` files, wallet keys, private gift files, generated Next.js output, and Git history. The image runs the standalone Next.js server as the `node` user.
