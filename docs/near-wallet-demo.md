# Santa — NEAR wallet demo

The current NEAR demonstration is [NEAR recording](https://github.com/0xNana/santa-on-near/blob/2121b4f2571439d0ed71d75d4d9fd1164970556c/demo/near-demo.mp4), with [captions](https://github.com/0xNana/santa-on-near/blob/2121b4f2571439d0ed71d75d4d9fd1164970556c/demo/near-demo.en.srt) and [public transaction evidence](near-wallet-proof.json).

The 1 minute 42 second video records a fresh 25 TEST gift through the local production Santa app and deployed NEAR Testnet contracts. Two dedicated testnet accounts use the real Meteor Wallet UI: the sender signs the deposit, and the recipient signs a NEP-413 authorization. The production HTTP claim API verifies that signature and the relayer submits the onchain claim. No wallet provider or approval dialog is simulated, and no local-key claim signer substitutes for the wallet.

## Verified outcome

- Gift **#2**, 25 valueless TEST units, token `token.santa-gifts.testnet`.
- Sender `sender.santa-gifts.testnet`: 999975 → 999950 TEST.
- Recipient `recipient.santa-gifts.testnet`: 25 → 50 TEST.
- Escrow `gifts.santa-gifts.testnet`: 0 → 25 → 0 TEST.
- Recipient NEAR balance and full-access key nonce unchanged; `relayer.santa-gifts.testnet` paid the claim gas.
- Final claim callback returned `true`; the gift is `Claimed` by the expected recipient.
- Replaying the actual browser authorization returned HTTP 409 (`gift_not_open`) without another payout or relayer spend. Reloading preserves the claimed state.
- [Create receipt](https://testnet.nearblocks.io/txns/5WdthDhUbjJAr77VCZMLvXHPsCrpWizcMK3Ay6S8UKQD) and [claim receipt](https://testnet.nearblocks.io/txns/FT7ySuADLNcDjngY5eZswk71bc98CDzP1HneyDCbQv45).

## Recording and scope

Captured in an isolated, sandboxed Google Chrome profile using Playwright and native Chrome screencast frames at 1600 × 900 (wallet dialogs retain their native portrait proportions). Wallet setup and key import happened off-camera. The edit adds title/credit cards, burned-in captions, music, and a clearly labeled RPC verification card. Confirmation waits are shortened. Sender frames containing the private gift link are excluded entirely. The recipient account already had token storage registration from the earlier API test; this video demonstrates sponsored claim gas, not new registration.

The explorer displayed a browser challenge during recording. Its page is not shown or fabricated: the final verification card reports direct finalized NEAR RPC reads and the successful callback. The evidence JSON contains the public identifiers, timestamps, balances, and replay result.

The app runs at `http://localhost:3104`; this recording does not demonstrate a hosted deployment, mainnet use, or a real testnet expiry refund. The separate contract sandbox tests cover expiry/refund behavior. This video has not been posted or submitted.

## Export

1920 × 1080, 30 fps, H.264/yuv420p, stereo AAC with fast-start metadata. Instrumental soundtrack and captions; no narration. The accompanying SRT supplies accessible captions for players that support them.

Music: **“Uplifting Bass” by Lily J**, from [Mixkit](https://mixkit.co/free-stock-music/electronic/), under the [Mixkit Stock Music Free License](https://mixkit.co/license/modal/musicFree/). The source track is not distributed separately. Chimes: **Dr. Richard Boulanger et al.**, freedesktop sound theme, [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/), reduced in volume and timed to milestones. Credits also appear on the closing card.

Local media in `/demo/` is ignored and untracked. The link above pins the already published recording so removing media from the current tree does not break evidence availability. Its [checksum record](near-video-checks.json) is verified independently of the local folder.
