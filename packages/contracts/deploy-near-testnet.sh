#!/usr/bin/env bash
set -euo pipefail

root="$(cd "$(dirname "$0")/../.." && pwd)"
wasm="$root/packages/contracts/near/target/wasm32-unknown-unknown/release/santa_near.wasm"

: "${NEAR_CONTRACT_ACCOUNT:?Set an existing NEAR Testnet contract account ID}"
: "${NEAR_OWNER_ACCOUNT:?Set the Santa contract owner account ID}"
: "${NEAR_RELAYER_ACCOUNT:?Set the sponsored-claim relayer account ID}"
: "${NEAR_ALLOWLISTED_TOKEN_IDS:?Set comma-separated allowlisted NEP-141 account IDs}"

case "${NEAR_DEPLOY_KEYCHAIN:-os}" in
    os) signer_command="sign-with-keychain" ;;
    legacy) signer_command="sign-with-legacy-keychain" ;;
    *) echo "NEAR_DEPLOY_KEYCHAIN must be os or legacy." >&2; exit 1 ;;
esac

command -v cargo >/dev/null || { echo "Install Rust and Cargo first." >&2; exit 1; }
command -v near >/dev/null || { echo "Install near-cli-rs first." >&2; exit 1; }
rustup target list --installed | grep -qx wasm32-unknown-unknown || {
    echo "Install wasm32-unknown-unknown with rustup target add wasm32-unknown-unknown." >&2
    exit 1
}

node --input-type=module - "$NEAR_CONTRACT_ACCOUNT" "$NEAR_OWNER_ACCOUNT" "$NEAR_RELAYER_ACCOUNT" "$NEAR_ALLOWLISTED_TOKEN_IDS" <<'NODE'
const [contract, owner, relayer, tokens] = process.argv.slice(2);
const account = /^(?=.{2,64}$)[a-z0-9]+([._-][a-z0-9]+)*$/;
const allowlist = tokens.split(",").map((id) => id.trim());
for (const [name, id] of [["NEAR_CONTRACT_ACCOUNT", contract], ["NEAR_OWNER_ACCOUNT", owner], ["NEAR_RELAYER_ACCOUNT", relayer], ...allowlist.map((id, index) => [`NEAR_ALLOWLISTED_TOKEN_IDS[${index}]`, id])]) {
  if (!account.test(id)) {
    console.error(`${name} is not a valid NEAR account ID.`);
    process.exit(1);
  }
}
if (allowlist.length === 0 || allowlist.some((id) => id.length === 0)) {
  console.error("NEAR_ALLOWLISTED_TOKEN_IDS must contain one or more valid account IDs.");
  process.exit(1);
}
NODE

cargo build \
    --locked \
    --manifest-path "$root/packages/contracts/near/Cargo.toml" \
    --target wasm32-unknown-unknown \
    --release

init_args="$(node --input-type=module - "$NEAR_OWNER_ACCOUNT" "$NEAR_RELAYER_ACCOUNT" "$NEAR_ALLOWLISTED_TOKEN_IDS" <<'NODE'
const [owner_id, relayer_id, tokens] = process.argv.slice(2);
console.log(JSON.stringify({
  owner_id,
  relayer_id,
  allowed_tokens: tokens.split(",").map((id) => id.trim()),
}));
NODE
)"

echo "Deploying to NEAR Testnet account $NEAR_CONTRACT_ACCOUNT."
echo "The NEAR CLI will sign with the selected keychain account. Confirm it is authorized to deploy this contract."
near contract deploy "$NEAR_CONTRACT_ACCOUNT" \
    use-file "$wasm" \
    with-init-call new json-args "$init_args" \
    prepaid-gas "100 Tgas" \
    attached-deposit "0 NEAR" \
    network-config testnet \
    "$signer_command" send

near contract call-function as-read-only "$NEAR_CONTRACT_ACCOUNT" \
    get_next_gift_id json-args '{}' network-config testnet

near contract call-function as-read-only "$NEAR_CONTRACT_ACCOUNT" \
    get_config json-args '{}' network-config testnet

near contract call-function as-read-only "$NEAR_CONTRACT_ACCOUNT" \
    get_gift json-args '{"gift_id":"1"}' network-config testnet
