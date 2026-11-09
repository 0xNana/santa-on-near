# Santa demo video

The current **NEAR demo** is [near-demo.mp4](near-demo.mp4); see [its verification and recording notes](NEAR-README.md).

> **Legacy EVM demonstration — not the NEAR hackathon demo.** This video, its transaction evidence, and its OAuth entry point describe Robinhood Chain Testnet. Do not submit it as proof that the NEAR migration works. Record a new NEAR wallet-to-wallet flow using [the judge walkthrough](../docs/judges.md) and [NEAR recording plan](near-recording-plan.md).

**Runtime: 1 minute 53 seconds.** 1920 × 1080, 30 fps, stereo instrumental soundtrack.

The final video records a fresh, real AMD test-token gift on Robinhood Chain Testnet. The browser creates the gift, saves and copies its private link, and loads the recipient page. The claim then runs through Santa's real `claimGift` client, local API, and deployed SantaVault using a dedicated recipient test wallet. The app is reloaded to show the claimed state, followed by the public explorer receipt and verified balances.

Google/email sign-in is shown as an entry point; this recording does not complete OAuth or simulate an authenticated recipient. The claim section is explicitly labeled as a real client/API test-wallet demonstration. The isolated sender uses a test wallet provider that signs actual transactions; no wallet-extension approval dialog is staged. No private keys or usable gift links appear in the video.

## Fresh transaction evidence

- Gift ID: **12**.
- Asset: **1 AMD test token**, with no monetary value or equity ownership rights.
- Recipient balance: **0 → 1 AMD**.
- Recipient test ETH: **0 → 0 wei**.
- Claim fee payer: Santa relayer `0x0636448d75c5c2d688c5b62cc2ff0644138f636d`.
- Claim fee: `0.00000110864` test ETH.
- [Successful claim receipt](https://explorer.testnet.chain.robinhood.com/tx/0x8ae6aa2215b0afa2e95122ebf16155c698dc407f613600371f18aca4548078fb).

`transaction-proof.json` includes public identifiers, balances, and verified creation and claim receipts.

The dedicated recipient wallet recovery file is stored locally at `gifts/demo/recipient-wallet.json` with private file permissions; Git ignores it. Keep that file private.

## Recording retry

The first recording attempt created gift **#11**, but the recorder stopped at two matching Copy link buttons and closed its temporary session before its link was backed up. That **one valueless AMD test token remains escrowed**. Its original sender can request a refund after **8 December 2026, 10:47:19 UTC**. The public state and refund date are in `recording-attempt.json`. The corrected recorder used a persistent browser session and recovery backup; the successful demo is gift #12.

## Files

- `santa-demo.mp4` — final 1080p H.264 video, 30 fps, stereo AAC, with burned-in captions and audio.
- `santa-demo.en.srt` — accompanying captions.
- `thumbnail.png` — opening card.
- `timeline.json` — chapter timings.
- `transaction-proof.json` — fresh public blockchain proof.

## Audio and licenses

The soundtrack is the recorded instrumental **“Uplifting Bass” by Lily J**, from the [Mixkit electronic music catalog](https://mixkit.co/free-stock-music/electronic/), used under the [Mixkit Stock Music Free License](https://mixkit.co/license/modal/musicFree/). It is mixed with short chimes; there is no narration. The license permits commercial and noncommercial web/social video use, including YouTube. It excludes TV/radio, video games, and CDs/DVDs. The source music is not distributed separately here.

The `complete.oga` and `bell.oga` sound effects are from the freedesktop sound theme, credited to **Dr. Richard Boulanger et al.**, under [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/). They were lowered in volume and positioned at visual milestones. Attribution is included on the closing card. The installed source attribution is `/usr/share/doc/sound-theme-freedesktop/copyright`.

Santa is an independent testnet project. The tokens shown have no monetary value or equity ownership rights.
