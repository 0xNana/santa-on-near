# Santa — NEAR HACKATHON submission

Updated 9 November 2026 after the approved GitHub push and passing CI. **Submission has not been sent.** The human confirmed **Santa**, **[0xNana/santa-on-near](https://github.com/0xNana/santa-on-near)**, **Open Innovation (`open`)**, and that this is the project's first submission.

The [live rules](https://nearhackathon.com/HACKATHON.md) were fetched again and matched [HACKATHON.md](HACKATHON.md) byte-for-byte: SHA-256 `903794f4b656b456eaee087941517d024a33633641d167b90c3f060d381d9aed`. Recheck them immediately before submission. Deadline: **14 November 2026, 23:59 UTC / Accra time**. Judging starts 16 November; results by 18 November.

## X post draft

The human reviews and publishes this text, with **[near-demo.mp4](demo/near-demo.mp4) attached**:

> Token gifts should feel personal.
>
> We built Santa at NEAR HACKATHON: NEP-141 gift links, encrypted notes and claims with sponsored gas on NEAR Testnet.
>
> Would you use it for birthdays?
> https://github.com/0xNana/santa-on-near
> @NEARProtocol #NEARHackathon

This is a draft, not a published post. Publish only after the repository's NEAR commits are visible. The video is 1:42, 1080p H.264 with AAC audio, music, burned-in captions and an [SRT](demo/near-demo.en.srt). It shows a real sender deposit, recipient Meteor message signature and sponsored claim. It does not show mainnet use, a hosted deployment, a new recipient storage registration or a real testnet expiry refund.

Copy the exact public X post URL after publishing. The submission's `demoUrl` is that **X post URL**, not localhost, a proposed Fly address, or the local MP4 path. Hosting is optional under Q-012; because this is a local app, the X post needs the actual video, not screenshots alone.

## Project description draft

The human must approve this wording before it becomes the API's `idea` field:

> Small token gifts should not require recipients to fund gas before receiving them. Santa turns allowlisted NEP-141 tokens into expiring gift links with an optional note encrypted in the sender's browser. A Rust contract on NEAR Testnet holds the tokens; the recipient connects Meteor Wallet and signs a NEP-413 message. Santa verifies account-key ownership and sponsors token registration when needed and the claim transaction. Unclaimed gifts can be refunded by the sender after expiry. The demo verifies a real 25 TEST gift, unchanged recipient NEAR and rejection of a repeated claim. Notes are encrypted before redemption; the relayer is trusted to verify recipient authorization. The NEAR product reuses the earlier Santa UI and EVM baseline disclosed in README.

The confirmed track is **Open Innovation (`open`)**. Do not add Social Money, DeFi, privacy/AI or agent tracks solely because those words resemble features: the current product does not demonstrate their advertised integrations or workflows.

## Filled submission facts

| Field / decision | Actual value or status |
| --- | --- |
| `projectName` | **Santa** — confirmed by the human. |
| `projectUrl` | **https://github.com/0xNana/santa-on-near** — confirmed; seven milestones published to `main` at `2121b4f`. |
| `tracks` | **`["open"]`** — confirmed. |
| `idea` | Draft above; exact wording awaits human approval. |
| `leadName` | Awaiting the human's chosen name; collect privately, 2–80 characters. Do not infer it from a GitHub username. |
| `email` | Awaiting private collection; valid email, at most 160 characters. Do not copy Git author configuration as submission consent. |
| `size` | Awaiting human selection: `1`, `2 - 4`, `4 - 6`, `6 - 8`, or `8+`. |
| `nearAddress` | Awaiting the human's **mainnet** payout account. `santa-gifts.testnet` and all demo subaccounts are testnet accounts, not payout values. |
| `demoUrl` | Awaiting the human-published X video post URL. |
| `consent` | Not collected. Read the exact notice below; set true only after an explicit agreement. |
| `requestId` | Generate one UUID when preparing the real private payload; retain it for permitted retries. No request has been generated or sent here. |
| Prior submission | Human confirmed this is the first. Do not submit the same project again under the original Santa repository. |
| Additional entries | No second entry is being prepared here. If another independent project is entered, disclose it in both READMEs (Q-015). |

These are the only allowed API fields. This public document intentionally contains no invented field values or personal payload. Store a real completed payload in an ignored `submission*.json` file with private permissions. Never add `website`: it is a spam-trap field.

Contact notice, verbatim:

> I agree that the organizers may use these details to review our submission and contact us about this hackathon.

## Event submission checklist

- [x] Project, repository, primary track and first-submission status confirmed by the human.
- [x] Official rules reread; canonical local snapshot matches the live version.
- [x] Public submission repository exists; original EVM source and reuse are disclosed in README.
- [x] Original baseline `042714b49ea38060eaf92e38ecf9b4dc25fe07a1` preserved as an ancestor; NEAR work is organized into [milestone commits](docs/build-milestones.md).
- [x] MIT `LICENSE` and third-party/demo credits included.
- [x] Reproducible README, judge walkthrough, locked dependencies and Node 22 instructions included.
- [x] Real wallet-to-wallet NEAR video and public chain proof recorded; private link/credential frames excluded.
- [x] Explicit push approval received; seven milestones published to `main` at `2121b4f2571439d0ed71d75d4d9fd1164970556c`. Public source/comparison verified and anonymous video download returned HTTP 200.
- [x] Both `node` and `contract` jobs passed on the published milestone head: [NEAR validation run](https://github.com/0xNana/santa-on-near/actions/runs/42699958583). [Public CI evidence](docs/remote-ci.json) records the exact head and jobs.
- [ ] Human reviews the X draft, attaches the NEAR video, publishes it publicly with **@NEARProtocol** and **#NEARHackathon**, and provides the exact post URL.
- [ ] Human approves the description and supplies name, email, team size and mainnet payout account privately.
- [ ] Read the contact notice and obtain explicit consent.
- [ ] Reconfirm no earlier saved submission immediately before sending; do not use a different repository/email to work around a 409.
- [ ] Validate the exact 12-field payload, maximum 12,000 bytes and all field constraints. Print that concrete payload privately for the human and obtain explicit approval to send once.
- [ ] Submit during the official window, then retain the returned status/response privately. Mark submitted only after HTTP 201.
- [ ] Keep the repo public through judging. If hosting is added, keep it available through 18 November, preferably 25 November.

## Engineering evidence and remaining release checks

These checks support review; distinguish our own quality gate from official eligibility requirements.

| Check | Result / evidence |
| --- | --- |
| Deployed NEAR escrow | `gifts.santa-gifts.testnet`; [deployment proof](docs/near-testnet-deployment.json). |
| Allowlisted fixture token | `token.santa-gifts.testnet`, zero decimals, valueless TEST units. |
| Real Meteor demo | Gift **#2**, 25 TEST; sender and recipient are separate dedicated testnet accounts. [Public proof](demo/near-transaction-proof.json). |
| Create transaction | [5WdthDhUbjJAr77VCZMLvXHPsCrpWizcMK3Ay6S8UKQD](https://testnet.nearblocks.io/txns/5WdthDhUbjJAr77VCZMLvXHPsCrpWizcMK3Ay6S8UKQD). |
| Claim transaction | [FT7ySuADLNcDjngY5eZswk71bc98CDzP1HneyDCbQv45](https://testnet.nearblocks.io/txns/FT7ySuADLNcDjngY5eZswk71bc98CDzP1HneyDCbQv45); final callback `true`. |
| Balances / recipient gas | Sender 999975 → 999950 TEST; recipient 25 → 50; escrow 0 → 25 → 0. Recipient NEAR and nonce unchanged; relayer paid. |
| Abuse / recovery | Actual authorization replay returned 409 without another payout/spend; nonce consumed, saved link recovered, reload stayed claimed. Earlier API test separately verifies wrong-secret refusal and first storage registration. |
| Node 22 local validation | 371 core tests, one CLI test, production build/type checks, lint; [validation record](docs/local-validation.json). |
| Contract validation | Nine Rust tests and real Sandbox 2.14.0 claim, failed-transfer recovery, expiry/refund and balance conservation pass. |
| Dependency and secret review | Zero high/critical; 17 low/eight moderate findings documented. Production private-value scan passes; keys, `.env`, gift files and generated builds are ignored. |
| Tested application source | `8fc1720` — identical application/contract/dependency/tooling source; subsequent commits add evidence/documentation. |
| Real testnet expiry refund | **Still unverified.** An internal release gate, not a separate mandatory event receipt. Any new public-chain transaction requires explicit human confirmation. Do not substitute Sandbox results or gift #2's claim receipt. |
| Hosting | **Optional, not deployed.** Proposed Fly settings are not a working demo URL. Local-only submission is allowed with public reproducible source and the X video (Q-012). |
| Aggregate evidence check | `npm run hackathon:check` intentionally remains blocked until genuine public refund/X evidence is recorded in `docs/near-evidence.json`. Never fabricate the missing file, invent hashes, or weaken the gate to claim readiness. |

## Publication and submission handoff

The human approved publication, and this normal, non-forced push published all seven milestones successfully:

```sh
git push --set-upstream origin codex/near-hackathon:main
```

Verify the remote commit and CI afterward; do not run the submission API as part of pushing. The human posts the X demo. The final submission endpoint is **POST https://nearhackathon.com/api/applications**, or the human can use [the form](https://nearhackathon.com/#apply).

- **201:** saved; record it and stop submitting.
- **400:** correct only the reported field errors, reusing the same request ID.
- **403:** stop and tell the human; do not retry.
- **409:** stop; clarify prior submission/entry limit. Do not change repository/email to bypass it.
- **413:** shorten the actual payload to the stated size limit.
- **503 or uncertain network delivery:** preserve the same request ID; for 503 wait a minute before a permitted retry. Never generate a new ID to retry an uncertain submission.

After a saved submission, the human requests corrections at [request-changes](https://nearhackathon.com/request-changes). Never send a second project submission to fix a saved one.
