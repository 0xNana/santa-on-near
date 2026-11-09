# Dependency review — 9 November 2026

The unused Privy web UI is now outside the active Next.js package under `legacy/web`, and the active app no longer installs `@privy-io/react-auth`. That removed 569 packages, including the reported high-severity legacy wallet dependency chains. The NEAR Sandbox development dependency's pinned `tar@7.5.13` was overridden and actually resolved to `7.5.22` to address the [archive-parser advisories](https://github.com/isaacs/node-tar/security/advisories). `npm ls tar` confirms the resolved version; an override declaration alone was not accepted as proof.

`npm audit --audit-level=high` passes after these changes: zero high and critical findings. The full audit still reports 25 low/moderate findings across three upstream roots. This is not a clean bill of security and does not replace review of the contract or wallet flow.

| Root advisory | Reachability and current disposition |
| --- | --- |
| [elliptic risky primitive](https://github.com/advisories/GHSA-848j-6mx2-7j84), low | Transitive through Wallet Selector's `@near-js` stack. Santa's browser transaction fixture keys and backend recipient verification use Ed25519, while Meteor Wallet handles the user's signing. No locally held secp256k1 key is required by Santa's active flow. Keep the vendor-supported Wallet Selector version; the audit's automatic downgrade is breaking. Recheck upstream before final submission and before any mainnet release. |
| [KaTeX prototype-pollution trust bypass](https://github.com/advisories/GHSA-238p-pmpm-9mq7), low | Transitive through Mermaid documentation rendering. Documentation is repository-authored; gift notes are rendered as escaped React text, not Mermaid/KaTeX. No untrusted diagram renderer was added. Review the proposed Mermaid upgrade separately; never enable user-supplied diagram rendering under this dependency set. Recheck before final submission. |
| [minimatch glob amplification](https://github.com/advisories/GHSA-g3hv-75wg-m249), moderate | Build/lint tooling through TypeScript ESLint. Inputs are source-controlled file paths, not gifting API parameters. No fix is applied by forcing a breaking eslint-config-next downgrade. CI uses read-only permissions, no app keys, and does not retain checkout credentials. Recheck upstream before final submission. |

The validation workflow enforces the high/critical audit gate and preserves the lockfile with `npm ci --ignore-scripts`. No `npm audit fix --force`, skipped test, disabled lint rule, or lowered timeout was used to hide findings.

Meteor Wallet replaces the retired MyNearWallet adapter for the browser demo. Meteor SDK 1.0.24 pins nanoid 5.1.5; the scoped override resolves it to 5.1.16, the patched release for [GHSA-28wg-ghj8-5hjv](https://github.com/advisories/GHSA-28wg-ghj8-5hjv). The current audit has zero high/critical findings and 25 low/moderate findings (17 low, eight moderate).

Meteor SDK 1.0.24 also logs a generated access key inside `requestSignIn`. The Next configuration explicitly transpiles that SDK and removes debug console calls, retaining warnings and errors. The built client method is inspected to verify that the log is absent; changing compiler or SDK settings must repeat that check.
