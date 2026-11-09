#!/usr/bin/env bash
# The default deployment entry point targets a fresh NEAR Testnet account.
set -euo pipefail
case "${1:-testnet}" in
    testnet) ;;
    *) echo "usage: ./deploy.sh [testnet]" >&2; exit 2 ;;
esac
root="$(cd "$(dirname "$0")/../.." && pwd)"
exec node "$root/scripts/deploy-near-testnet.mjs"
