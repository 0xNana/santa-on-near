"use client";

import "@near-wallet-selector/modal-ui/styles.css";
import { setupWalletSelector, type WalletSelector, type Transaction } from "@near-wallet-selector/core";
import { setupModal } from "@near-wallet-selector/modal-ui";
import { setupMeteorWallet } from "@near-wallet-selector/meteor-wallet";
import { Buffer } from "buffer";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { readNearContractView } from "@santa/core/src/near-contract.js";
import { NEAR_TESTNET_RPC_URL } from "@santa/core/src/near.js";

let selectorPromise: Promise<WalletSelector> | undefined;
function getSelector() {
  selectorPromise ??= setupWalletSelector({
    // A string network uses Wallet Selector's FastNEAR preset; pass the RPC explicitly so
    // Meteor's transaction preparation uses the same endpoint as our views and CSP.
    network: {
      networkId: "testnet",
      nodeUrl: NEAR_TESTNET_RPC_URL,
      helperUrl: "https://helper.testnet.near.org",
      explorerUrl: "https://testnet.nearblocks.io",
      indexerUrl: "https://test.api.fastnear.com/v0",
    },
    fallbackRpcUrls: [NEAR_TESTNET_RPC_URL],
    modules: [setupMeteorWallet()],
  }).catch((error: unknown) => {
    selectorPromise = undefined;
    throw error;
  });
  return selectorPromise;
}

// Stable across renders: chain reads must not restart on every UI update.
function viewFunction({ contractId, method, args = {} }: {
  contractId: string; method: string; args?: Record<string, unknown>;
}) {
  return readNearContractView<unknown>(NEAR_TESTNET_RPC_URL, contractId, method, args);
}

function useNearWallet() {
  const [signedAccountId, setSignedAccountId] = useState<string | null>(null);
  const [walletError, setWalletError] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    let unsubscribe: (() => void) | undefined;
    getSelector().then((selector) => {
      if (!active) return;
      const subscription = selector.store.observable.subscribe((state) => {
        if (active) setSignedAccountId(state.accounts.find((account) => account.active)?.accountId ?? null);
      });
      unsubscribe = () => subscription.unsubscribe();
    }).catch(() => {
      if (active) setWalletError("Your NEAR wallet could not be initialized. Reload to try again.");
    });
    return () => { active = false; unsubscribe?.(); };
  }, []);

  const signIn = useCallback(async () => {
    try {
      const selector = await getSelector();
      setupModal(selector, {}).show();
      setWalletError(null);
    } catch {
      setWalletError("Your NEAR wallet could not be opened. Please try again.");
    }
  }, []);
  const signOut = useCallback(async () => {
    try { await (await (await getSelector()).wallet()).signOut(); }
    catch { setWalletError("Your NEAR wallet could not be disconnected. Please try again."); }
  }, []);
  const signAndSendTransactions = useCallback(async (params: { transactions: Transaction[] }) => {
    const outcomes = await (await (await getSelector()).wallet()).signAndSendTransactions(params);
    if (!outcomes) throw new Error("Wallet transaction is pending.");
    return outcomes;
  }, []);
  const signMessage = useCallback(async (params: {
    message: string; recipient: string; nonce: Uint8Array; callbackUrl: string;
  }) => {
    const wallet = await (await getSelector()).wallet();
    return wallet.signMessage({ ...params, nonce: Buffer.from(params.nonce) });
  }, []);

  return useMemo(() => ({ signedAccountId, walletError, signIn, signOut, viewFunction,
    signAndSendTransactions, signMessage }),
  [signedAccountId, walletError, signIn, signOut, signAndSendTransactions, signMessage]);
}

const NearWalletContext = createContext<ReturnType<typeof useNearWallet> | null>(null);

export function NearWalletProvider({ children }: { children: ReactNode }) {
  const wallet = useNearWallet();
  return (
    <NearWalletContext.Provider value={wallet}>
      {wallet.walletError && <p role="alert" className="mx-auto max-w-2xl p-5 text-[#a1263e]">{wallet.walletError}</p>}
      {children}
    </NearWalletContext.Provider>
  );
}

export function useWalletSelector() {
  const wallet = useContext(NearWalletContext);
  if (!wallet) throw new Error("NEAR wallet provider is missing.");
  return wallet;
}
