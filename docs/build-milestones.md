# Build milestones and agent handoff

The NEAR work is on local branch `codex/near-hackathon`, targeting the confirmed public repository [0xNana/santa-on-near](https://github.com/0xNana/santa-on-near). On 9 November 2026 GitHub reported that repository public but empty. These checkpoints organize the completed working tree on that date; they do not invent an earlier development chronology. Publication and remote CI remain pending.

## Review the contribution

The parent baseline is the original EVM Santa commit `042714b49ea38060eaf92e38ecf9b4dc25fe07a1`, dated 8 November, preserved with its real history from [0xNana/santa](https://github.com/0xNana/santa/tree/042714b49ea38060eaf92e38ecf9b4dc25fe07a1). The UI, branding and retained EVM utilities are reused; the NEAR contract and integration are the contribution being presented. The repositories are provenance and submission locations for the same project, not two entries.

```sh
git log --reverse --oneline 042714b..HEAD
git diff --stat 042714b..HEAD
git show --stat 5cb4ed9
```

| Commit | Milestone | Review / verification |
| --- | --- | --- |
| `1461941` | Rust NEP-141 escrow and test-token fixture | Allowlist, custody, asynchronous claim/refund recovery, one-use nonce; nine Rust tests and formatting pass. |
| `5cb4ed9` | Complete NEAR application | Real Meteor deposit and NEP-413 claim, relayer policy, encrypted notes, link recovery, RPC retries, CSP/SDK fixes, matched lockfile and integration harness. Privy UI retained under `legacy/web`. |
| `4f7792f` | Reproduction, CI and deployment tooling | Node 22 pin, read-only CI, explicit testnet deploy path, health checks and single-instance Fly configuration. Hosting is configured, not deployed. |
| `8fc1720` | Existing legacy SQLite settings | Separate preservation of the prior working-tree timeout/NORMAL synchronization change; NORMAL has weaker power-loss durability than FULL. It does not store active NEAR gift state. |
| `eb11136` | Public chain evidence and wallet video | Actual gift #2, final callback, balances, gas payer, replay result, 1:42 MP4, captions and private-data/export checks. Earlier EVM media is labeled legacy. |

The documentation checkpoint adds this map, reproducible judge instructions, provenance, current rules and release boundaries. A following `docs(submission)` checkpoint contains the filled public submission checklist and human-reviewed X draft. Use the log above to identify their exact hashes; no self-referential commit hash is embedded in a file.

The complete wallet/API migration and its dependency lockfile are one coupled build milestone. Splitting the SDK removal from the active UI migration would leave an intermediate checkout unable to install/build consistently. Source changes are not disguised as later documentation changes.

## Reproduce validation

Use the README installation steps and `.nvmrc`. The [local validation record](local-validation.json) describes checks actually executed with Node 22.23.4 and Rust 1.99.1 against application/tooling source matching `8fc1720`:

```sh
npm ci --ignore-scripts
npm test --workspace=@santa/agent
npm test --workspace=@santa/core -- --maxWorkers=2
npm run lint --workspace=@santa/web
npm run build --workspace=@santa/web
npm audit --audit-level=high
cargo fmt --manifest-path packages/contracts/near/Cargo.toml --check
npm run near:contract:test
npm run near:integration:test
```

Results: 371 core tests, one CLI test, nine Rust tests, production build/type checking, lint, and the real local Sandbox 2.14.0 claim/refund integration pass. The production leak scan checked seven private values across 3,148 output files and passed. Audit: zero high/critical, 17 low and eight moderate findings, with reachability and disposition in [dependency-review.md](dependency-review.md). No remote CI result is claimed.

The first restricted Node 22 build could not read its TypeScript child-process output; the unrestricted retry completed. The isolated build directory did not replace the running demo server. No test was skipped or threshold reduced.

## Continue from here

1. Read [the public submission checklist](../submission.md), [README](../README.md), [judge walkthrough](judges.md) and canonical [HACKATHON.md](../HACKATHON.md). `HACKATHON (1).md` preserves the originally supplied copy, including its malformed pasted lines; it is not the canonical rules snapshot.
2. Review the active boundaries: `packages/contracts/near/src/lib.rs`, `packages/core/src/near-relayer.ts`, `near-claim-policy.ts`, the `/api/near` routes, and `packages/web/components/near`. The old CLI/Solidity/Privy flows are legacy.
3. Keep the real wallet evidence separate from the older local-key API test. The video uses a local production app; recipient token storage was already registered. Real testnet expiry-refund evidence remains absent. Sandbox refund success does not establish a public-testnet refund.
4. Obtain the explicitly required push approval before publishing. Push the preserved ancestry to `main` in the empty confirmed repository, verify its exact remote head, and wait for both CI jobs. Do not rewrite or force-push the history.
5. The human publishes the X video and supplies its exact public post URL. Collect contact, size, payout and consent privately. Validate and show the exact payload before the single submission; follow the official retry/request-change rules.

`npm run hackathon:check` is intentionally blocked until genuine refund/X evidence is recorded in `docs/near-evidence.json`. That is the project's stronger internal evidence gate, not a claim that the event mandates a refund receipt. Do not fabricate evidence or weaken the checker to manufacture readiness. Hosting is optional under event Q-012.
