# NEAR HACKATHON readiness review

Reviewed against the live [HACKATHON.md](https://nearhackathon.com/HACKATHON.md) on 9 November 2026; its verified snapshot is the root `HACKATHON.md`. Deadline: **14 November 2026 at 23:59 UTC**, also 23:59 in Accra. Recheck the live rules before submitting. No change can guarantee a prize.

## Eligibility and presentation fixes

| Gap | Resolution / remaining gate |
| --- | --- |
| Missing license (Q-014) | MIT selected by the owner and added as `LICENSE`; third-party licenses remain separate. |
| Existing product disclosure (Q-002–005) | README identifies EVM baseline `042714b`, reused UI/libraries, AI assistance, and the exact new NEAR scope. |
| Separate reviewable work (Q-003) | Local branch `codex/near-hackathon` created. Reviewed milestone commits preserve the EVM parent history; the human approved publication and the seven milestones are on `main` at `2121b4f`, with both CI jobs passing. |
| Public repository | GitHub confirms `0xNana/santa-on-near` is public, with the approved milestone history published to `main` on 9 November; it is the confirmed submission repository. The original `0xNana/santa` is the EVM provenance source. Keep it public through judging; the approved push does not authorize changing repository visibility. |
| Weak track claim | README recommends Open Innovation for the present product. Social Money emphasizes community coordination that personal gifting does not yet demonstrate. The human chooses the final tracks. No unnecessary DAO/AI/Intents integration is fabricated. |
| Misleading demo | New NEAR walkthrough and recording plan added. The NEAR wallet video and create/claim receipts are complete. A public X video post remains required. A real expiry-refund receipt remains our own release verification gate, not a separate event-mandated receipt. |
| Incomplete reproduction | Judge instructions, locked Rust builds, local sandbox test, Node 22 pin, and validation workflow provided. Local-chain evidence is distinct from testnet evidence. |
| Replay/spending abuse | Relayer operations serialized; identical in-flight claims coalesced; competing gift claims refused; global hourly attempt limit independent of IP; used onchain nonces checked before registration. Limits are per-process and reset on restart; keep one instance. |
| Intermittent RPC reads | Live test reproduced connection timeouts. Contract views now retry transport failures and HTTP 502/503/504 once, with a fresh five-second timeout. No transaction-submission retry was added; contract errors and malformed data still fail closed. |
| Retired source and dependency graph | Superseded UI/API/CLI/contracts, their tests and dependencies are removed from the current tree. Baseline history remains reviewable. |

## Evidence gate

Run `npm run hackathon:check`. A failure is expected until the repository contains the reviewed NEAR source and genuine deployment/demo evidence. It must not be bypassed with invented IDs, unrelated footage, fake receipts, or a `reviewed` flag without inspection.

After real testnet verification, create `docs/near-evidence.json` with these **public** fields: `networkId` (`testnet`), `contractAccount`, `tokenAccount`, `createTx`, `claimTx`, `refundTx`, `submissionCommit` (full hash), `demoPostUrl`, `verifiedAt` (ISO date), and `reviewed` (true only after checking chain outcomes). Record actual before/after balances and explorer links alongside it. Local `/demo/` recordings are ignored and untracked. The checker verifies the pinned public artifact described by `docs/near-video-checks.json`, including its size, MP4 header and SHA-256. No template with fake evidence is provided.

The tested `submissionCommit` must be an ancestor of the final submission with identical application, contract, dependency, and tooling source. Documentation/evidence can be committed afterward without an impossible self-referential commit hash. The checker catches missing files and malformed evidence, not forged evidence. The human still verifies the transaction accounts, final callbacks, balances, public URLs, remote commit, demo contents, repository visibility, and that the project has not already been submitted. A public repo with unpushed NEAR changes is not ready.

## Remaining external gates

1. Account provisioning and the two explicitly approved contract deployments are complete. `santa-gifts.testnet` owns the `gifts`, `relayer`, `token`, `sender`, and `recipient` subaccounts. The ignored local `.env` contains the NEAR settings and relayer-only signer; key files have mode 600 and match registered access keys. `docs/near-testnet-deployment.json` records successful deployment receipts, matching WASM hashes, escrow configuration, and 1,000,000 test tokens in the sender account. The separate `docs/near-testnet-smoke.json` now proves a 25 TEST create/claim flow through the local production HTTP API, sponsored recipient registration, unchanged recipient NEAR balance/nonce, and wrong-secret/replay refusal. It records the network interruptions and build distinction. It is not browser-wallet or real expiry-refund evidence. Follow `docs/near-migration.md`; never paste private keys into chat.
2. The genuine Meteor browser-wallet acceptance test and NEAR video are complete for gift #2; public proof is in `docs/near-wallet-proof.json`. Complete a separate real testnet expiry refund. Any new signed transaction needs the human’s explicit confirmation under `HACKATHON.md`. Record that remaining receipt and balances.
3. The NEAR video is complete. The human publishes the demo post stating it was built at NEAR HACKATHON, tagging **@NEARProtocol** and **#NEARHackathon**, with the demo attached. A local-only app needs a video; screenshots alone are insufficient. Hosting is optional under Q-012; if provided, keep it up through 18 November, preferably 25 November.
4. The local changes are organized into milestone commits, with the baseline preserved and a map in `docs/build-milestones.md`. The human approved the push to `0xNana/santa-on-near`; all seven milestones are published, the baseline comparison is verified, and both CI jobs passed at `2121b4f`. The public comparison is linked in README; exact remote verification is in `docs/remote-ci.json`.
5. Collect, without guessing: project name, lead name, contact email, team size, final tracks, mainnet payout account, public repository URL, public demo-post URL, and approved 20–2000-character project description. Disclose any second independent project under Q-015.
6. Read the contact notice verbatim: **"I agree that the organizers may use these details to review our submission and contact us about this hackathon."** Obtain consent. Confirm whether Santa was already submitted.
7. Generate one request ID, validate the exact field contract, show the complete JSON to the human, and wait for explicit confirmation before POSTing once. Never add the `website` spam-trap field. Keep payloads and response records private; reuse the request ID on permitted retries. A saved submission is changed via the human's request-changes form, never a second project submission.

This review does not submit the project, create a payout account, publish an X post, or authorize spending or mainnet deployment.

## Historical validation before source cleanup

On 9 November 2026, 371 core tests (including 12 RPC-read and two wallet CSS regression checks), nine Rust contract tests, lint, web type checking, and the production build pass. The real NEAR Sandbox 2.14.0 test passes create/custody, failed-transfer recovery, consumed-nonce rejection, successful claim, private-callback access control, repeated-claim refusal, stale-ID deposit return, expiry enforcement, refund, and final balance conservation. It uses the same release Santa WASM, the official FT standard fixture, and a long local epoch to advance time efficiently. Test configuration never shortens the contract's production expiry policy.

The dependency audit passes its high/critical gate after removing superseded dependencies and resolving tar 7.5.22; 25 low/moderate findings remain documented in `docs/dependency-review.md`. Initial local validation used Node 26.13 and Rust 1.99.1. Both Node 22 CI and the contract/Sandbox job passed on the published `2121b4f` head; see [the public run](https://github.com/0xNana/santa-on-near/actions/runs/42699958583). Local Node 22.23.4 revalidation is recorded in the build history guide. The rebuilt production app and private-value leak scan pass. The retry-condition mutation is rejected by the regression tests. Live API and genuine Meteor wallet create/claim evidence are recorded separately. The NEAR video is complete; real testnet expiry refund, hosting, and public submission evidence remain incomplete.

## Submission handoff

The filled public checklist and X draft are in [submission.md](../submission.md). The human confirmed Santa, `0xNana/santa-on-near`, Open Innovation (`open`), and that this is the first submission. Contact details, team size, a mainnet payout account, contact consent, and the eventual X post URL still need private collection before an exact payload can be approved.

## Cleanup evidence

Public wallet proof and recording notes now live in `docs/near-wallet-proof.json` and `docs/near-wallet-demo.md`. The historical MP4 remains accessible at its immutable published commit. The cleaned tree is validated separately; the earlier 371-test count included retired-feature tests and is not the current suite size. All NEAR behavior tests are retained.

The [cleanup validation record](cleanup-validation.json) reports 57 current tests, nine Rust tests, the real Sandbox, browser and non-root Docker checks, and 13 private values scanned across 2,340 build files. The current audit has 15 low and eight moderate findings, zero high/critical. A fresh clone no longer needs a local media directory.
