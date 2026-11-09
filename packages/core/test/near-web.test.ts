import { describe, expect, it } from "vitest";
import { encryptGiftNote, decryptGiftNote, parseTokenAmount, readClaimSecret, giftMatchesDeposit, canClaimGift } from "../../web/lib/near-gifts.js";

describe("NEAR browser gift safety", () => {
  it("does not offer signing for expired, closed, or malformed gifts", () => {
    expect(canClaimGift("Open", "2000000", 1)).toBe(true);
    expect(canClaimGift("Open", "2000000", 2)).toBe(false);
    expect(canClaimGift("Claimed", "2000000", 1)).toBe(false);
    expect(canClaimGift("Open", "invalid", 1)).toBe(false);
  });
  const secret = `0x${"ab".repeat(32)}`;
  it("restores a claim secret after wallet sign-in or a reload in the same tab", () => {
    const values = new Map<string, string>();
    const storage = { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value); } };
    expect(readClaimSecret(storage, "santa.testnet", "7", `#${secret}`)).toBe(secret);
    expect(readClaimSecret(storage, "santa.testnet", "7", "")).toBe(secret);
    expect(readClaimSecret(storage, "santa.testnet", "8", "")).toBeNull();
    expect(readClaimSecret(storage, "other.testnet", "7", "")).toBeNull();
  });

  it("keeps Unicode notes within the contract's ciphertext size limit", async () => {
    const note = "🎁".repeat(250);
    await expect(encryptGiftNote(note, secret)).rejects.toThrow("too long");
    const valid = "Merry Christmas 🎁";
    const sealed = await encryptGiftNote(valid, secret);
    expect(sealed).not.toBeNull();
    expect(await decryptGiftNote(sealed!, secret)).toBe(valid);
  });

  it("rejects amounts that cannot be represented by NEP-141 U128", () => {
    expect(parseTokenAmount((2n ** 128n).toString(), 0)).toBeNull();
    expect(parseTokenAmount((2n ** 128n - 1n).toString(), 0)).toBe((2n ** 128n - 1n).toString());
  });

  it("does not recover a gift created by another tab with a different secret", () => {
    const deposit = { senderId: "alice.testnet", tokenId: "token.testnet", amount: "5", secretHash: secret };
    const gift = { sender_id: deposit.senderId, token_id: deposit.tokenId, amount: "5", secret_hash: secret };
    expect(giftMatchesDeposit(gift, deposit)).toBe(true);
    expect(giftMatchesDeposit({ ...gift, secret_hash: `0x${"cd".repeat(32)}` }, deposit)).toBe(false);
    expect(giftMatchesDeposit(null, deposit)).toBe(false);
  });
});
