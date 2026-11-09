export function createClaimSecret(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return `0x${Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("")}`;
}

export async function hashClaimSecret(secret: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(secret));
  return `0x${Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("")}`;
}

function fromHex(value: string): Uint8Array {
  if (!/^0x[0-9a-f]{64}$/.test(value)) throw new Error("Invalid claim secret.");
  return Uint8Array.from(value.slice(2).match(/.{2}/g) ?? [], (byte) => Number.parseInt(byte, 16));
}

function encodeBase64(value: Uint8Array): string {
  let binary = "";
  for (const byte of value) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function decodeBase64(value: string): Uint8Array {
  const binary = atob(value);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

export async function encryptGiftNote(note: string, secret: string): Promise<string | null> {
  if (note.length === 0) return null;
  // Base64(12-byte IV + plaintext + 16-byte GCM tag) must fit the contract's 1024-byte field.
  if (new TextEncoder().encode(note).length > 740) throw new Error("Personal note is too long.");
  const key = await crypto.subtle.importKey("raw", new Uint8Array(fromHex(secret)), "AES-GCM", false, ["encrypt"]);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = new Uint8Array(await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    new TextEncoder().encode(note),
  ));
  const sealed = new Uint8Array(iv.length + ciphertext.length);
  sealed.set(iv);
  sealed.set(ciphertext, iv.length);
  return encodeBase64(sealed);
}

export async function decryptGiftNote(sealedNote: string, secret: string): Promise<string> {
  const sealed = decodeBase64(sealedNote);
  if (sealed.length < 29 || sealed.length > 1024) throw new Error("Encrypted note is invalid.");
  const key = await crypto.subtle.importKey("raw", new Uint8Array(fromHex(secret)), "AES-GCM", false, ["decrypt"]);
  const plaintext = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: new Uint8Array(sealed.slice(0, 12)) },
    key,
    new Uint8Array(sealed.slice(12)),
  );
  return new TextDecoder().decode(plaintext);
}

export function sponsoredClaimMessage(input: {
  giftId: string;
  recipientId: string;
  secretHash: string;
  issuedAt: number;
  nonce: string;
}): string {
  return [
    "SantaClaim:v1",
    `gift:${input.giftId}`,
    `recipient:${input.recipientId}`,
    `secret:${input.secretHash.slice(2)}`,
    `issued_at:${input.issuedAt}`,
    `nonce:${input.nonce}`,
  ].join("\n");
}

export function randomNonce(): { bytes: Uint8Array; hex: string } {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return {
    bytes,
    hex: Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join(""),
  };
}

export function encodeSignature(signature: Uint8Array): string {
  let binary = "";
  for (const byte of signature) binary += String.fromCharCode(byte);
  return btoa(binary);
}

export function parseGiftCreatedId(logs: readonly string[]): string | null {
  for (const log of logs) {
    if (!log.startsWith("EVENT_JSON:")) continue;
    try {
      const event: unknown = JSON.parse(log.slice("EVENT_JSON:".length));
      if (typeof event !== "object" || event === null || !("event" in event) || event.event !== "gift_created" || !("data" in event) || !Array.isArray(event.data)) continue;
      const id = event.data[0]?.gift_id;
      if (typeof id === "string" && /^[1-9][0-9]{0,19}$/.test(id)) return id;
    } catch {
      continue;
    }
  }
  return null;
}

export function formatTokenAmount(raw: string, decimals: number): string {
  if (!/^(0|[1-9][0-9]*)$/.test(raw) || !Number.isInteger(decimals) || decimals < 0 || decimals > 24) return raw;
  const padded = raw.padStart(decimals + 1, "0");
  if (decimals === 0) return padded;
  const whole = padded.slice(0, -decimals);
  const fractional = padded.slice(-decimals).replace(/0+$/, "");
  return fractional.length > 0 ? `${whole}.${fractional}` : whole;
}

export function parseTokenAmount(value: string, decimals: number): string | null {
  const text = value.trim();
  if (!/^(0|[1-9][0-9]*)(\.[0-9]+)?$/.test(text) || !Number.isInteger(decimals) || decimals < 0 || decimals > 24) return null;
  const [whole = "0", fractional = ""] = text.split(".");
  if (fractional.length > decimals) return null;
  const raw = BigInt(whole) * 10n ** BigInt(decimals) + BigInt(fractional.padEnd(decimals, "0") || "0");
  return raw > 0n && raw < 2n ** 128n ? raw.toString() : null;
}

export function readClaimSecret(storage: Pick<Storage, "getItem" | "setItem">, contractId: string, giftId: string, fragment: string): string | null {
  const key = `santa.near.claim.${contractId}.${giftId}`;
  const provided = fragment.startsWith("#") ? fragment.slice(1) : fragment;
  if (/^0x[0-9a-f]{64}$/.test(provided)) {
    try { storage.setItem(key, provided); } catch { /* The current visit can still claim without persistence. */ }
    return provided;
  }
  try {
    const saved = storage.getItem(key);
    return saved !== null && /^0x[0-9a-f]{64}$/.test(saved) ? saved : null;
  } catch { return null; }
}

export function giftMatchesDeposit(gift: unknown, deposit: {
  senderId: string; tokenId: string; amount: string; secretHash: string;
}): boolean {
  return typeof gift === "object" && gift !== null
    && "sender_id" in gift && gift.sender_id === deposit.senderId
    && "token_id" in gift && gift.token_id === deposit.tokenId
    && "amount" in gift && gift.amount === deposit.amount
    && "secret_hash" in gift && gift.secret_hash === deposit.secretHash;
}

export function canClaimGift(status: string, expiresAtNs: string, nowMs: number): boolean {
  return status === "Open" && /^[0-9]{1,20}$/.test(expiresAtNs)
    && Number.isSafeInteger(nowMs) && nowMs >= 0
    && BigInt(expiresAtNs) > BigInt(nowMs) * 1_000_000n;
}
