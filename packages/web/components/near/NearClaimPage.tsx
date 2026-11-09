"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useWalletSelector } from "./NearWalletProvider";
import { z } from "zod";
import { canClaimGift, decryptGiftNote, formatTokenAmount, hashClaimSecret, randomNonce, readClaimSecret, sponsoredClaimMessage } from "@/lib/near-gifts";

const giftSchema = z.object({
  id: z.object({ "0": z.string().regex(/^[1-9][0-9]{0,19}$/) }).or(z.string()),
  sender_id: z.string(),
  token_id: z.string(),
  amount: z.object({ "0": z.string().regex(/^(0|[1-9][0-9]*)$/) }).or(z.string()),
  sealed_note: z.string().nullable(),
  expires_at_ns: z.object({ "0": z.string() }).or(z.string()),
  status: z.enum(["Open", "Claiming", "Claimed", "Refunding", "Refunded"]),
});
const tokenMetadataSchema = z.object({
  symbol: z.string().min(1).max(24),
  decimals: z.number().int().min(0).max(24),
});

function unwrapValue(value: unknown): string {
  if (typeof value === "string") return value;
  if (typeof value === "object" && value !== null && "0" in value && typeof value["0"] === "string") return value["0"];
  return "";
}

function safeResponse(value: unknown): { ok: true; txHash: string } | { ok: false; error: string } | null {
  const parsed = z.discriminatedUnion("ok", [
    z.object({ ok: z.literal(true), txHash: z.string().min(1) }),
    z.object({ ok: z.literal(false), error: z.string().min(1) }),
  ]).safeParse(value);
  return parsed.success ? parsed.data : null;
}

export function NearClaimPage({ giftId }: { giftId: string }) {
  const { signedAccountId, signIn, viewFunction, signMessage } = useWalletSelector();
  const contractId = process.env.NEXT_PUBLIC_NEAR_CONTRACT_ACCOUNT ?? "";
  const [secret, setSecret] = useState<string | null>(null);
  const [gift, setGift] = useState<z.infer<typeof giftSchema> | null>(null);
  const [tokenMetadata, setTokenMetadata] = useState<z.infer<typeof tokenMetadataSchema> | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [noteError, setNoteError] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [now, setNow] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  const claimable = gift !== null && now > 0 && canClaimGift(gift.status, unwrapValue(gift.expires_at_ns), now);

  useEffect(() => {
    let active = true;
    Promise.resolve().then(async () => {
        if (!active) return;
        const secret = readClaimSecret(window.sessionStorage, contractId, giftId, window.location.hash);
        window.history.replaceState(null, "", window.location.pathname);
        setSecret(secret);
        if (secret === null || contractId === "") return;
        const value = await viewFunction({ contractId, method: "get_gift", args: { gift_id: giftId } });
        const parsed = giftSchema.safeParse(value);
        if (!parsed.success) throw new Error("Gift not found.");
        if (active) setGift(parsed.data);
        const metadata = tokenMetadataSchema.safeParse(await viewFunction({
          contractId: parsed.data.token_id,
          method: "ft_metadata",
        }));
        if (active && metadata.success) setTokenMetadata(metadata.data);
        if (parsed.data.sealed_note) {
          try {
            const opened = await decryptGiftNote(parsed.data.sealed_note, secret);
            if (active) setNote(opened);
          } catch {
            if (active) setNoteError(true);
          }
        }
      })
      .catch(() => {
        if (active) setError("This gift could not be loaded from NEAR Testnet.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [contractId, giftId, viewFunction]);

  async function claim() {
    if (!signedAccountId || !secret || !contractId || !gift || !claimable || busy) return;
    setBusy(true);
    setError(null);
    try {
      const { bytes, hex: nonce } = randomNonce();
      const issuedAt = Date.now();
      const secretHash = await hashClaimSecret(secret);
      const message = sponsoredClaimMessage({
        giftId,
        recipientId: signedAccountId,
        secretHash,
        issuedAt,
        nonce,
      });
      const signed = await signMessage({ message, recipient: contractId, nonce: bytes,
        callbackUrl: `${window.location.origin}/g/${giftId}` });
      if (!signed) throw new Error("Wallet did not produce a claim signature.");
      const response = await fetch("/api/near/claim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          giftId,
          secret,
          recipientId: signedAccountId,
          issuedAt,
          nonce,
          signature: {
            accountId: signed.accountId,
            publicKey: signed.publicKey,
            signature: signed.signature,
          },
        }),
      });
      const result = safeResponse(await response.json());
      if (!response.ok || result?.ok !== true) {
        const code = result?.ok === false ? result.error : "claim_failed";
        throw new Error(code);
      }
      setTxHash(result.txHash);
      const latest = giftSchema.safeParse(await viewFunction({ contractId, method: "get_gift", args: { gift_id: giftId } }));
      if (latest.success) setGift(latest.data);
    } catch (failure) {
      const message = failure instanceof Error ? failure.message : "claim_failed";
      const safe = new Set([
        "claim_in_progress",
        "sponsorship_limit",
        "gift_not_found",
        "gift_not_open",
        "gift_expired",
        "invalid_claim_secret",
        "recipient_signature_refused",
        "near_claim_failed",
        "near_rpc_unavailable",
      ]);
      setError(safe.has(message) ? message.replaceAll("_", " ") : "The sponsored claim could not be completed. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main id="main-content" className="mx-auto min-h-screen max-w-xl px-5 py-12">
      <header className="mb-10"><Link href="/" className="font-display text-4xl text-[#8a293d]">santa</Link></header>
      <section className="rounded-2xl border border-[#e3dcd1] bg-white p-6 shadow-sm sm:p-9">
        <p className="mb-2 text-xs font-bold tracking-[0.2em] text-[#8a293d]">A LITTLE SOMETHING FOR YOU</p>
        <h1 className="font-display text-4xl">{txHash ? "Your gift is claimed" : "A gift for you"}</h1>
        {loading && <p role="status" className="mt-5 text-sm text-[#70665e]">Opening your gift…</p>}
        {!contractId && <p role="status" className="mt-5 text-sm">NEAR Testnet gifts have not been configured on this app yet.</p>}
        {!loading && secret === null && <p role="alert" className="mt-5 text-sm text-[#a1263e]">This link is missing its private claim key. Ask the sender to share the complete link again.</p>}
        {error && <p role="alert" className="mt-5 rounded-lg bg-[#f5e9e9] p-3 text-sm text-[#a1263e]">{error}</p>}

        {gift && (
          <div className="mt-6 space-y-4">
            <p className="text-sm text-[#70665e]">Gifted token: <span className="font-semibold text-[#302722]">{gift.token_id}</span></p>
            <p className="text-sm text-[#70665e]">
              Amount: <span className="font-semibold text-[#302722]">
                {formatTokenAmount(unwrapValue(gift.amount), tokenMetadata?.decimals ?? 0)}
                {tokenMetadata ? ` ${tokenMetadata.symbol}` : " raw token units"}
              </span>
            </p>
            {note && <blockquote className="rounded-lg bg-[#faf7f0] p-4 font-display text-xl">{note}</blockquote>}
            {noteError && <p role="status" className="text-sm text-[#70665e]">The encrypted personal note could not be opened; the gift is still claimable.</p>}
            {gift.status !== "Open" && <p role="status" className="text-sm">Gift status: {gift.status}</p>}
            {gift.status === "Open" && now > 0 && !claimable && <p role="status" className="text-sm">This gift has expired. Its sender can request a refund.</p>}
            {!signedAccountId && secret && claimable && <button className="rounded-lg bg-[#8a293d] px-4 py-2.5 font-semibold text-white" onClick={signIn}>Connect NEAR wallet</button>}
            {signedAccountId && claimable && !txHash && (
              <button className="rounded-lg bg-[#8a293d] px-4 py-2.5 font-semibold text-white disabled:opacity-50" disabled={busy} onClick={() => void claim()}>
                {busy ? "Claiming with sponsored gas…" : `Claim to ${signedAccountId}`}
              </button>
            )}
          </div>
        )}

        {txHash && (
          <a className="mt-5 inline-block font-semibold underline" href={`https://testnet.nearblocks.io/txns/${txHash}`} target="_blank" rel="noreferrer">
            View claim transaction
          </a>
        )}
      </section>
    </main>
  );
}
