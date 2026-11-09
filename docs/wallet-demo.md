# Real browser-wallet demo validation

**Completed on 9 November 2026:** gift #2 passed the real Meteor sender/recipient flow on the local production app at localhost:3104. See the [video and recording notes](near-wallet-demo.md) and [public evidence](near-wallet-proof.json). The commands below are a repeatable manual runbook; the recording used one isolated profile with an explicit sender disconnect and wallet switch.

Use the existing configured `.env`; do not replace it with `.env.example`. The accounts and contracts are already deployed. Never run deployment or initialization again for this test.

Santa now offers Meteor Wallet. MyNearWallet's official site announces that new app connections and approvals have stopped: https://testnet.mynearwallet.com/. Meteor's official Wallet Selector integration supports testnet: https://github.com/near/wallet-selector/tree/main/packages/meteor-wallet.

## Start the app

From a terminal:

```sh
cd /home/nana/projects/santa
nvm install 22
nvm use 22
SANTA_PUBLIC_ORIGIN=http://localhost:3000 npm run dev --workspace=@santa/web
```

If `nvm` is not installed, use your Node 22 installation. If port 3000 is occupied, stop the previous Santa server in its own terminal with Ctrl+C before starting this one. Use **localhost:3000** throughout, including in copied gift links; do not switch between localhost and 127.0.0.1.

In another terminal:

```sh
cd /home/nana/projects/santa
curl --fail-with-body --silent --show-error http://localhost:3000/api/near/health
```

Expect HTTP 200 with `ok: true`, network `testnet`, and contract `gifts.santa-gifts.testnet`. A failed health check is a stop condition; do not treat the UI loading as sufficient.

## Prepare two real wallets before recording

Use desktop Chrome with two separate profiles, one for the sender and one for the recipient. Allow wallet popups on localhost. Run:

```sh
google-chrome --user-data-dir="$HOME/.local/share/santa-demo-sender" http://localhost:3000/send
google-chrome --user-data-dir="$HOME/.local/share/santa-demo-recipient" https://wallet.meteorwallet.app
```

In each profile, use Meteor Wallet at https://wallet.meteorwallet.app and the **testnet** network. The app's connection popup also specifies testnet. Use desktop Chrome for the actual approval flow; the in-app browser check only establishes that the Meteor selector renders without console errors.

Restore the existing sender and recipient accounts using their locally saved recovery phrases. Open these files in a local editor **before recording**, import the `master_seed_phrase` into the wallet, then close the files:

- `/home/nana/.near-credentials/testnet/sender.santa-gifts.testnet.json`
- `/home/nana/.near-credentials/testnet/recipient.santa-gifts.testnet.json`

Import only these dedicated test-account keys. Never import the owner, escrow, token, or relayer keys into the browser. Verify the wallet displays the exact expected account ID and testnet before approving anything. Do not paste recovery phrases, private keys, `.env`, or full bearer links into chat or public evidence.

The recipient was registered by the earlier API test, so this run demonstrates wallet signing and sponsored gas, not a fresh registration subsidy. Gift #1 is already claimed; create a fresh gift.

## Record before/after balances

Run these commands before creating the gift, and again after claiming it:

```sh
near contract call-function as-read-only token.santa-gifts.testnet ft_balance_of json-args '{"account_id":"sender.santa-gifts.testnet"}' network-config testnet now
near contract call-function as-read-only token.santa-gifts.testnet ft_balance_of json-args '{"account_id":"recipient.santa-gifts.testnet"}' network-config testnet now
near contract call-function as-read-only token.santa-gifts.testnet ft_balance_of json-args '{"account_id":"gifts.santa-gifts.testnet"}' network-config testnet now
near account view-account-summary recipient.santa-gifts.testnet network-config testnet now
```

The earlier test ended with sender 999975 TEST, recipient 25 TEST, and escrow zero. Treat fresh reads as authoritative. The token has zero decimals: an amount of `25` means 25 TEST.

## Browser acceptance test

1. Sender profile: open http://localhost:3000/send, click **Connect NEAR wallet**, select **Meteor Wallet**, and connect `sender.santa-gifts.testnet`.
2. Select `token.santa-gifts.testnet`, enter `25`, add a non-personal note, and select the seven-day expiry. Click **Create gift**. Inspect the wallet transaction: testnet, sender account, token receiver, and `ft_transfer_call`. Approve it yourself in the real wallet UI.
3. Wait for a confirmed gift link. Reload the sender page and verify the same link is recoverable in saved gifts. Copy the complete link, including its `#` fragment, privately into the recipient profile. Keep the usable secret out of recording frames.
4. Recipient profile: verify the note, connect `recipient.santa-gifts.testnet` through Meteor, then click **Claim to recipient.santa-gifts.testnet**. Approve the **message signature** in the wallet popup. The recipient should not approve or pay for an onchain transfer.
5. In browser DevTools Network, confirm `POST /api/near/claim` returns HTTP 200 with a transaction hash. Do not export or publish the request payload or an unredacted HAR: it includes the gift secret.
6. Expect `Claimed`. Read back the gift with the command below. Verify its recipient and amount. Run the balance commands again: sender decreases by 25, recipient increases by 25, escrow returns to its original balance, and recipient NEAR is unchanged.
7. Reload the claimed link. It must remain claimed and offer no second payout. Compare balances again. The earlier API test separately verifies the original authorization replay returns 409.

Read back the **new** gift ID from the link, not the earlier gift #1:

```sh
read -r -p 'New gift ID: ' SANTA_DEMO_GIFT_ID
near contract call-function as-read-only gifts.santa-gifts.testnet get_gift json-args "{\"gift_id\":\"$SANTA_DEMO_GIFT_ID\"}" network-config testnet now
```

Expected final fields: `status: "Claimed"`, `recipient_id: "recipient.santa-gifts.testnet"`, `amount: "25"`, and the configured sender/token IDs. Capture the create and claim transaction hashes; inspect both at `https://testnet.nearblocks.io/txns/<hash>` and confirm receipt success and balance changes.

Canceling a wallet prompt must not display success. If the app reports an unconfirmed send, reload and inspect saved gifts and chain state before creating another gift. A canceled signature or failed claim must leave the gift unclaimed and the recipient unpaid.

## Video and X readiness

Record the actual sender wallet approval, recipient message-signing approval, final gift state, balance increase, and explorer receipts. Do not substitute the earlier local-key API test for a browser-wallet flow. Save the new video as `demo/near-demo.mp4` and review it for secrets before sharing.

Keep the real testnet expiry refund as a separate outstanding check; the UI's shortest expiry is seven days. Do not claim a live refund was demonstrated. The local sandbox already exercises expiry and refund.

After reviewing the new video and evidence, the human publishes the X post with **@NEARProtocol** and **#NEARHackathon**, stating that Santa was built at NEAR HACKATHON. See the X draft in [submission.md](../submission.md). A localhost URL is not publicly accessible; attach the actual video if public hosting is unavailable. Publication and hackathon submission remain separate human actions.
