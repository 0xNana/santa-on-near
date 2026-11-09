"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useWalletSelector } from "./NearWalletProvider";
import { actionCreators } from "@near-wallet-selector/core";
import { z } from "zod";
import {
  createClaimSecret,
  encryptGiftNote,
  formatTokenAmount,
  hashClaimSecret,
  giftMatchesDeposit,
  parseGiftCreatedId,
  parseTokenAmount,
} from "@/lib/near-gifts";

const metadataSchema = z.object({ symbol: z.string().min(1).max(24), decimals: z.number().int().min(0).max(24) });
const balanceSchema = z.string().regex(/^(0|[1-9][0-9]*)$/);
const nextIdSchema = z.string().regex(/^[1-9][0-9]{0,19}$/);
const statusClass = "text-sm text-[#70665e]";
const inputClass = "w-full rounded-lg border border-[#e3dcd1] bg-white px-3 py-2 text-[#302722]";
const buttonClass = "rounded-lg bg-[#8a293d] px-4 py-2.5 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50";

type TokenMetadata = z.infer<typeof metadataSchema>;
type SavedGift = { giftId: string; url: string; txHash: string; senderId: string; contractId: string };
type GiftStatus = { status: string; expiresAtNs: string };
const savedGiftSchema = z.object({
  giftId: z.string().regex(/^[1-9][0-9]{0,19}$/),
  url: z.string().url(),
  txHash: z.string(),
  senderId: z.string(),
  contractId: z.string(),
});
const pendingGiftSchema = z.object({
  giftId: nextIdSchema, secret: z.string().regex(/^0x[0-9a-f]{64}$/),
  secretHash: z.string().regex(/^0x[0-9a-f]{64}$/), tokenId: z.string(), senderId: z.string(),
  amount: balanceSchema, expiresAtNs: z.string().regex(/^[0-9]+$/), contractId: z.string(),
});
const giftStatusSchema = z.object({
  status: z.string(),
  expires_at_ns: z.string().regex(/^[0-9]+$/),
});

function configuredTokens(): string[] {
  return (process.env.NEXT_PUBLIC_NEAR_TOKEN_ACCOUNT_IDS ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter((value) => /^[a-z0-9]+([._-][a-z0-9]+)*$/.test(value));
}

function outcomeTransactionId(outcome: unknown): string {
  if (typeof outcome !== "object" || outcome === null || !("transaction_outcome" in outcome)) return "";
  const transaction = outcome.transaction_outcome;
  if (typeof transaction !== "object" || transaction === null || !("id" in transaction) || typeof transaction.id !== "string") return "";
  return transaction.id;
}

export function NearSendPage() {
  const { signedAccountId, signIn, signOut, signAndSendTransactions, viewFunction } = useWalletSelector();
  const contractId = process.env.NEXT_PUBLIC_NEAR_CONTRACT_ACCOUNT ?? "";
  const tokens = useMemo(() => configuredTokens(), []);
  const [tokenId, setTokenId] = useState(tokens[0] ?? "");
  const [tokenState, setTokenState] = useState<{
    accountId: string; tokenId: string; metadata: TokenMetadata; balance: string;
  } | null>(null);
  const tokenIsCurrent = tokenState?.accountId === signedAccountId && tokenState?.tokenId === tokenId;
  const metadata = tokenIsCurrent ? tokenState?.metadata ?? null : null;
  const balance = tokenIsCurrent ? tokenState?.balance ?? null : null;
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [days, setDays] = useState(30);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [gift, setGift] = useState<SavedGift | null>(null);
  const [savedGifts, setSavedGifts] = useState<SavedGift[]>([]);
  const [giftStatuses, setGiftStatuses] = useState<Record<string, GiftStatus>>({});
  const [now, setNow] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    let active = true;
    if (!tokenId || !signedAccountId || !contractId) return () => { active = false; };
    Promise.all([
      viewFunction({ contractId, method: "is_token_allowed", args: { token_id: tokenId } }),
      viewFunction({ contractId: tokenId, method: "ft_metadata" }),
      viewFunction({ contractId: tokenId, method: "ft_balance_of", args: { account_id: signedAccountId } }),
    ]).then(([allowed, rawMetadata, rawBalance]) => {
      if (allowed !== true) throw new Error("The selected NEP-141 contract is not allowlisted by Santa.");
      const parsedMetadata = metadataSchema.safeParse(rawMetadata);
      const parsedBalance = balanceSchema.safeParse(rawBalance);
      if (!parsedMetadata.success || !parsedBalance.success) throw new Error("This NEP-141 contract returned invalid metadata.");
      if (active) {
        setTokenState({ accountId: signedAccountId, tokenId, metadata: parsedMetadata.data, balance: parsedBalance.data });
      }
    }).catch(() => {
      if (active) setError("Could not read the selected NEP-141 token. Verify its testnet contract ID and RPC.");
    });
    return () => { active = false; };
  }, [contractId, signedAccountId, tokenId, viewFunction]);

  useEffect(() => {
    let active = true;
    if (!signedAccountId || !contractId) return () => { active = false; };
    Promise.resolve().then(async () => {
      if (!active) return;
      const saved = JSON.parse(localStorage.getItem("santa.near.links") ?? "[]") as unknown;
      const parsed = z.array(savedGiftSchema).safeParse(saved);
      if (!parsed.success) throw new Error("Saved gift links are invalid.");
      const links = [...parsed.data];
      // A reload after wallet approval must not strand the secret in an invisible pending record.
      const keys = Array.from({ length: localStorage.length }, (_, index) => localStorage.key(index));
      for (const key of keys) {
        if (!key?.startsWith(`santa.near.pending.${contractId}.`)) continue;
        const pending = pendingGiftSchema.safeParse(JSON.parse(localStorage.getItem(key) ?? "null"));
        if (!pending.success || pending.data.senderId !== signedAccountId || pending.data.contractId !== contractId) continue;
        const record = await viewFunction({ contractId, method: "get_gift", args: { gift_id: pending.data.giftId } });
        if (!giftMatchesDeposit(record, pending.data)) continue;
        const recovered: SavedGift = { giftId: pending.data.giftId, senderId: signedAccountId, contractId,
          url: `${window.location.origin}/g/${pending.data.giftId}#${pending.data.secret}`, txHash: "" };
        if (!links.some((entry) => entry.contractId === contractId && entry.giftId === recovered.giftId)) links.push(recovered);
        localStorage.setItem("santa.near.links", JSON.stringify(links));
        localStorage.removeItem(key);
      }
      const owned = links.filter((entry) => entry.senderId === signedAccountId && entry.contractId === contractId);
      if (active) setSavedGifts(owned);
      await Promise.all(owned.map(async (entry) => {
        const raw = await viewFunction({ contractId, method: "get_gift", args: { gift_id: entry.giftId } });
        const status = giftStatusSchema.parse(raw);
        if (active) {
          setGiftStatuses((current) => ({
            ...current,
            [entry.giftId]: { status: status.status, expiresAtNs: status.expires_at_ns },
          }));
        }
      }));
    }).catch(() => {
      if (active) setError("Saved gift links could not be refreshed. Reload to try again.");
    });
    return () => { active = false; };
  }, [contractId, signedAccountId, viewFunction]);

  const rawAmount = metadata === null ? null : parseTokenAmount(amount, metadata.decimals);
  const noteTooLong = new TextEncoder().encode(note.trim()).byteLength > 740;
  const amountExceedsBalance = rawAmount !== null && balance !== null && BigInt(rawAmount) > BigInt(balance);
  const canSend = Boolean(
    signedAccountId
    && contractId
    && tokenId
    && metadata
    && rawAmount
    && !amountExceedsBalance
    && !noteTooLong
    && !busy,
  );

  async function sendGift() {
    if (!canSend || signedAccountId === null || metadata === null || rawAmount === null) return;
    setBusy(true);
    setError(null);
    setGift(null);
    let pendingKey: string | null = null;
    try {
      const secret = createClaimSecret();
      const secretHash = await hashClaimSecret(secret);
      const sealedNote = await encryptGiftNote(note.trim(), secret);
      const storage = await viewFunction({ contractId: tokenId, method: "storage_balance_of", args: { account_id: contractId } });
      const storageActions = [];
      if (storage === null) {
        const bounds = z.object({ min: z.string().regex(/^[0-9]{1,39}$/) }).parse(await viewFunction({ contractId: tokenId, method: "storage_balance_bounds" }));
        const deposit = BigInt(bounds.min);
        if (deposit > 100_000_000_000_000_000_000_000n) throw new Error("Token registration is too expensive.");
        storageActions.push(actionCreators.functionCall("storage_deposit", {
          account_id: contractId, registration_only: true,
        }, 30_000_000_000_000n, deposit));
      }
      const nextId = nextIdSchema.parse(await viewFunction({
        contractId,
        method: "get_next_gift_id",
      }));
      const expiresAtNs = (
        BigInt(Date.now()) * 1_000_000n
        + BigInt(days) * 86_400_000_000_000n
        - 300_000_000_000n
      ).toString();
      const pending = { giftId: nextId, secret, secretHash, tokenId, senderId: signedAccountId, amount: rawAmount, expiresAtNs, contractId };
      pendingKey = `santa.near.pending.${contractId}.${secretHash}`;
      localStorage.setItem(pendingKey, JSON.stringify(pending));
      if (localStorage.getItem(pendingKey) !== JSON.stringify(pending)
        || (window as Window & { __santaStorageBlocked?: boolean }).__santaStorageBlocked) throw new Error("Gift link storage is unavailable.");

      const outcomes = await signAndSendTransactions({
        transactions: [{
          signerId: signedAccountId,
          receiverId: tokenId,
          actions: [...storageActions, actionCreators.functionCall(
            "ft_transfer_call",
            {
                receiver_id: contractId,
                amount: rawAmount,
                memo: "Santa gift escrow",
                msg: JSON.stringify({
                  gift_id: nextId,
                  secret_hash: secretHash,
                  expires_at_ns: expiresAtNs,
                  sealed_note: sealedNote,
                }),
              },
            80_000_000_000_000n,
            1n,
          )],
        }],
      });
      if (outcomes.length !== 1) throw new Error("The wallet returned an unexpected number of transaction outcomes.");
      const giftId = parseGiftCreatedId(outcomes.flatMap((outcome) => [
        ...outcome.transaction_outcome.outcome.logs,
        ...outcome.receipts_outcome.flatMap((receipt) => receipt.outcome.logs),
      ])) ?? nextId;
      const created = await viewFunction({ contractId, method: "get_gift", args: { gift_id: giftId } });
      if (!giftMatchesDeposit(created, pending)) {
        throw new Error("The gift transaction could not be verified on NEAR Testnet.");
      }
      const url = `${window.location.origin}/g/${giftId}#${secret}`;
      const saved = { giftId, url, txHash: outcomeTransactionId(outcomes[0]), senderId: signedAccountId, contractId };
      const existing = JSON.parse(localStorage.getItem("santa.near.links") ?? "[]") as unknown;
      const links = z.array(savedGiftSchema).parse(existing);
      localStorage.setItem("santa.near.links", JSON.stringify([...links, saved]));
      localStorage.removeItem(pendingKey);
      setGift(saved);
      setSavedGifts((current) => [...current, saved]);
      setGiftStatuses((current) => ({
        ...current,
        [giftId]: { status: "Open", expiresAtNs },
      }));
      setAmount("");
      setNote("");
    } catch {
      setError("The gift was not confirmed. If your wallet submitted it, reload to recover a confirmed gift link before retrying. Unaccepted token deposits are returned by the token contract.");
    } finally {
      setBusy(false);
    }
  }

  async function refundGift(giftId: string) {
    if (!signedAccountId || !contractId || busy) return;
    setBusy(true);
    setError(null);
    try {
      await signAndSendTransactions({
        transactions: [{
          signerId: signedAccountId,
          receiverId: contractId,
          actions: [actionCreators.functionCall(
            "refund_gift",
            { gift_id: giftId },
            50_000_000_000_000n,
            1n,
          )],
        }],
      });
      const raw = await viewFunction({ contractId, method: "get_gift", args: { gift_id: giftId } });
      const status = giftStatusSchema.parse(raw);
      setGiftStatuses((current) => ({
        ...current,
        [giftId]: { status: status.status, expiresAtNs: status.expires_at_ns },
      }));
    } catch {
      setError("The refund was not confirmed. Check the gift state and try again after its expiry.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main id="main-content" className="mx-auto min-h-screen max-w-2xl px-5 py-12">
      <header className="mb-10 flex items-center justify-between">
        <Link href="/" className="font-display text-4xl text-[#8a293d]">santa</Link>
        {signedAccountId
          ? <button className="text-sm underline" onClick={() => void signOut()}>{signedAccountId}</button>
          : <button className={buttonClass} onClick={signIn}>Connect NEAR wallet</button>}
      </header>

      <section className="rounded-2xl border border-[#e3dcd1] bg-white p-6 shadow-sm sm:p-9">
        <p className="mb-2 text-xs font-bold tracking-[0.2em] text-[#8a293d]">NEAR TESTNET</p>
        <h1 className="font-display text-4xl">Send a little something</h1>
        <p className={`${statusClass} mt-3`}>Escrow allowlisted NEP-141 tokens in a private gift link. You pay the token transfer gas; Santa sponsors the recipient’s claim.</p>

        {!contractId && <p role="status" className="mt-5 rounded-lg bg-[#f5e9e9] p-3 text-sm">Configure NEXT_PUBLIC_NEAR_CONTRACT_ACCOUNT to enable gifts.</p>}
        {tokens.length === 0 && <p role="status" className="mt-5 rounded-lg bg-[#f5e9e9] p-3 text-sm">Configure NEXT_PUBLIC_NEAR_TOKEN_ACCOUNT_IDS with comma-separated, allowlisted NEP-141 contract IDs.</p>}

        <div className="mt-7 space-y-5">
          <label className="block text-sm font-semibold">
            Token contract
            <select className={`${inputClass} mt-1`} value={tokenId} onChange={(event) => setTokenId(event.target.value)} disabled={tokens.length === 0}>
              {tokens.map((token) => <option key={token} value={token}>{token}</option>)}
            </select>
          </label>

          {metadata && balance !== null && (
            <p className={statusClass}>Balance: {formatTokenAmount(balance, metadata.decimals)} {metadata.symbol}</p>
          )}

          <label className="block text-sm font-semibold">
            Amount {metadata ? `(${metadata.symbol})` : ""}
            <input className={`${inputClass} mt-1`} inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="1.00" />
          </label>
          {amountExceedsBalance && <p role="alert" className="text-sm text-[#a1263e]">That amount is greater than your token balance.</p>}

          <label className="block text-sm font-semibold">
            Personal note <span className="font-normal text-[#70665e]">(encrypted before it reaches NEAR)</span>
            <textarea className={`${inputClass} mt-1 min-h-24 resize-y`} maxLength={500} value={note} onChange={(event) => setNote(event.target.value)} />
          </label>

          <label className="block text-sm font-semibold">
            Gift expires
            <select className={`${inputClass} mt-1`} value={days} onChange={(event) => setDays(Number(event.target.value))}>
              <option value={7}>7 days</option>
              <option value={30}>30 days</option>
              <option value={90}>90 days</option>
            </select>
          </label>

          {noteTooLong && <p role="alert" className="text-sm text-[#a1263e]">This personal note is too long. Shorten it before sending.</p>}

          {error && <p role="alert" className="rounded-lg bg-[#f5e9e9] p-3 text-sm text-[#a1263e]">{error}</p>}
          <button className={buttonClass} disabled={!canSend} onClick={() => void sendGift()}>
            {busy ? "Waiting for NEAR Testnet…" : "Create gift"}
          </button>
        </div>
      </section>

      {gift && gift.senderId === signedAccountId && (
        <section className="mt-6 rounded-2xl border border-[#cbded1] bg-white p-6">
          <h2 className="font-display text-2xl">Your gift link is ready</h2>
          <p className={`${statusClass} mt-2`}>Anyone with this link can claim the gift. Keep it private.</p>
          <input className={`${inputClass} mt-4`} readOnly value={gift.url} aria-label="Private gift link" />
          <div className="mt-4 flex flex-wrap gap-4 text-sm">
            <button className="font-semibold underline" onClick={() => void navigator.clipboard.writeText(gift.url)}>Copy link</button>
            {gift.txHash && <a className="font-semibold underline" href={`https://testnet.nearblocks.io/txns/${gift.txHash}`} target="_blank" rel="noreferrer">View NEAR transaction</a>}
          </div>
        </section>
      )}

      {signedAccountId && savedGifts.some((saved) => saved.senderId === signedAccountId && saved.contractId === contractId) && (
        <section className="mt-6 rounded-2xl border border-[#e3dcd1] bg-white p-6">
          <h2 className="font-display text-2xl">Your saved gifts</h2>
          <ul className="mt-4 divide-y divide-[#e3dcd1]">
            {savedGifts.filter((saved) => saved.senderId === signedAccountId && saved.contractId === contractId).map((saved) => {
              const status = giftStatuses[saved.giftId];
              const refundable = status?.status === "Open" && BigInt(status.expiresAtNs) <= BigInt(now) * 1_000_000n;
              return (
                <li className="flex flex-wrap items-center justify-between gap-3 py-3" key={saved.giftId}>
                  <div className="text-sm">
                    <p className="font-semibold">Gift {saved.giftId}</p>
                    <p className={statusClass}>{status?.status ?? "Checking status…"}</p>
                  </div>
                  <div className="flex gap-4 text-sm">
                    <a className="underline" href={saved.url}>Open link</a>
                    {refundable && (
                      <button className="font-semibold underline disabled:opacity-50" disabled={busy} onClick={() => void refundGift(saved.giftId)}>
                        Refund
                      </button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </main>
  );
}
