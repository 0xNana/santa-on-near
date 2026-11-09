# Record the NEAR demo

Do not label the existing EVM video as a NEAR demo. Record only after the [wallet acceptance test](../docs/judges.md) succeeds against the deployed NEAR contract.

Aim for two minutes: state the gifting problem, show the configured NEAR token and sender wallet, create a gift, open it in a different recipient session, sign the claim, then show `Claimed` and the recipient's increased token balance. Finish with NEAR explorer receipts and a brief refund explanation. Cut setup and long architecture slides. Show genuine wallet approvals; do not stage approval dialogs or substitute a direct client call for a wallet flow without an explicit label.

Capture the contract ID, token ID, raw/human amounts, create and claim transaction hashes, and before/after balances in a public evidence record. Add a separate expiry-refund receipt when available. Never include private keys, local `.env`, a still-usable bearer link, or submission personal data. Recheck the final export for these before publication.

The human writes and publishes the X post. A suggested draft, to finalize only after the demo is recorded:

> Sending someone tokens should feel like giving a gift. We built Santa at NEAR HACKATHON: expiring NEP-141 gift links, optional encrypted notes, and recipient claims with sponsored testnet gas. This video shows one complete sender-to-recipient flow on NEAR. @NEARProtocol #NEARHackathon

Attach the new NEAR demo video and add the real public repository and working demo links before posting. Do not post the draft with invented links or claim the video shows a flow it does not. If judges cannot open the app, the event requires a video; screenshots alone are insufficient. Keep hosting available through 18 November 2026, preferably 25 November.
