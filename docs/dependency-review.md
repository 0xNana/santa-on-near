# Dependency review — NEAR-only source

The cleanup removes the former CLI, storage/geolocation/auth backend, unused animation stack and unused diagram renderer. The lockfile shrank from 1,176 to 979 package entries. A clean Node 22 installation from that lockfile succeeds. The remaining workspaces are `@santa/core` and `@santa/web`.

The current `npm audit --audit-level=high` passes: **zero high/critical findings**, with **15 low and eight moderate findings** remaining. Those are not waived or hidden. The active advisory roots reported by npm are:

| Root advisory | Reachability and disposition |
| --- | --- |
| [elliptic risky primitive](https://github.com/advisories/GHSA-848j-6mx2-7j84), low | Transitive through Wallet Selector's NEAR key stack. Santa's claim verifier and demonstrated wallet use Ed25519. Keep the supported SDK and review upstream fixes; do not force an incompatible downgrade. |
| [minimatch glob amplification](https://github.com/advisories/GHSA-g3hv-75wg-m249), moderate | Build/lint tooling through TypeScript ESLint. Inputs are repository paths, not gifting API parameters. Recheck upstream before release; no breaking downgrade or forced audit fix is applied. |

Retained security overrides resolve `decode-uri-component` to 0.5.1, Zod 4 to 4.6.6, the Sandbox archive parser to `tar@7.5.22`, and Meteor's `nanoid` to 5.1.16. Overrides for three no-longer-installed packages were removed; the installed package graph is unchanged by that metadata cleanup. No unused package is kept solely to preserve an override.

Meteor SDK 1.0.24 logs a generated key in its sign-in method. The Next build explicitly transpiles that SDK and removes debug console calls while retaining errors/warnings. Production output must continue to pass the private-value scan and compiled SDK inspection. Compiler/SDK changes must repeat those checks.

CI retains locked installation with `npm ci --ignore-scripts`, the high/critical audit gate, core tests, lint, production build/type checking, Rust formatting/tests and real Sandbox integration. Tests dedicated to removed features were removed with their source; every NEAR behavior test remains. There is no `npm audit fix --force`, skipped NEAR test, disabled lint rule or relaxed security gate.
