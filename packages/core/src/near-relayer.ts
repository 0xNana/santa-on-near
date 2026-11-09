import { createHash } from "node:crypto";
import { Account, actions, KeyPairSigner, PublicKey, type KeyPairString } from "near-api-js";
import { z } from "zod";
import { createNearClient, NEAR_TESTNET_RPC_URL, validateNearRpcUrl } from "./near.js";
import { readNearContractView } from "./near-contract.js";
import { NearClaimCoordinator } from "./near-claim-policy.js";
export { NearClaimPolicyError } from "./near-claim-policy.js";

const claimCoordinator = new NearClaimCoordinator();

const ACCOUNT_ID = /^(?=.{2,64}$)[a-z0-9]+([._-][a-z0-9]+)*$/;
const accountId = z.string().regex(ACCOUNT_ID);
const httpsUrl = z.string().refine((value) => {
  try {
    return new URL(validateNearRpcUrl(value)).protocol === "https:";
  } catch {
    return false;
  }
});
const appOrigin = z.string().refine((value) => {
  try {
    const url = new URL(value);
    return (url.protocol === "https:" || url.protocol === "http:")
      && url.username === ""
      && url.password === ""
      && url.pathname === "/"
      && url.search === ""
      && url.hash === "";
  } catch {
    return false;
  }
}).transform((value) => new URL(value).origin);
const schema = z.object({
  NEAR_NETWORK_ID: z.literal("testnet").default("testnet"),
  NEAR_RPC_URL: httpsUrl.default(NEAR_TESTNET_RPC_URL).transform(validateNearRpcUrl),
  NEAR_CONTRACT_ACCOUNT: accountId,
  NEAR_RELAYER_ACCOUNT: accountId,
  NEAR_MAX_SPONSORED_CLAIMS_PER_HOUR: z.coerce.number().int().min(1).max(1000).default(60),
  NEAR_RELAYER_SECRET_KEY: z.string().min(20).max(256).refine((value) => {
    try {
      KeyPairSigner.fromSecretKey(value as KeyPairString);
      return true;
    } catch {
      return false;
    }
  }),
  SANTA_PUBLIC_ORIGIN: appOrigin,
});

export type NearRelayerConfig = z.infer<typeof schema>;

export class NearRelayerConfigError extends Error {
  constructor() {
    super("NEAR sponsored claims are not configured. Set NEAR_CONTRACT_ACCOUNT, NEAR_RELAYER_ACCOUNT, NEAR_RELAYER_SECRET_KEY, and SANTA_PUBLIC_ORIGIN.");
    this.name = "NearRelayerConfigError";
  }
}

export function parseNearRelayerConfig(source: Readonly<Record<string, string | undefined>>): NearRelayerConfig {
  const result = schema.safeParse({
    NEAR_NETWORK_ID: source.NEAR_NETWORK_ID || undefined,
    NEAR_RPC_URL: source.NEAR_RPC_URL || undefined,
    NEAR_CONTRACT_ACCOUNT: source.NEAR_CONTRACT_ACCOUNT,
    NEAR_RELAYER_ACCOUNT: source.NEAR_RELAYER_ACCOUNT,
    NEAR_MAX_SPONSORED_CLAIMS_PER_HOUR: source.NEAR_MAX_SPONSORED_CLAIMS_PER_HOUR || undefined,
    NEAR_RELAYER_SECRET_KEY: source.NEAR_RELAYER_SECRET_KEY,
    SANTA_PUBLIC_ORIGIN: source.SANTA_PUBLIC_ORIGIN,
  });
  if (!result.success) throw new NearRelayerConfigError();
  const publicContract = source.NEXT_PUBLIC_NEAR_CONTRACT_ACCOUNT;
  if (publicContract !== undefined && publicContract !== "" && publicContract !== result.data.NEAR_CONTRACT_ACCOUNT) {
    throw new NearRelayerConfigError();
  }
  return result.data;
}

export type SponsoredClaim = {
  giftId: string;
  secret: string;
  recipientId: string;
  nonce: string;
};

export function sponsoredClaimMessage(input: {
  giftId: string;
  recipientId: string;
  secret: string;
  issuedAt: number;
  nonce: string;
}): string {
  const commitment = createHash("sha256").update(input.secret, "utf8").digest("hex");
  return [
    "SantaClaim:v1",
    `gift:${input.giftId}`,
    `recipient:${input.recipientId}`,
    `secret:${commitment}`,
    `issued_at:${input.issuedAt}`,
    `nonce:${input.nonce}`,
  ].join("\n");
}

function writeString(value: string): Uint8Array {
  const text = new TextEncoder().encode(value);
  const length = new Uint8Array(4);
  new DataView(length.buffer).setUint32(0, text.length, true);
  const encoded = new Uint8Array(length.length + text.length);
  encoded.set(length);
  encoded.set(text, length.length);
  return encoded;
}

export function nep413Hash(message: string, recipient: string, nonce: Uint8Array, callbackUrl?: string): Uint8Array {
  if (nonce.length !== 32) throw new RangeError("NEP-413 nonce must be 32 bytes.");
  const prefix = new Uint8Array(4);
  new DataView(prefix.buffer).setUint32(0, 2_147_484_061, true);
  const fields = [writeString(message), nonce, writeString(recipient),
    ...(callbackUrl === undefined ? [Uint8Array.of(0)] : [Uint8Array.of(1), writeString(callbackUrl)]),
  ];
  const serialized = new Uint8Array(prefix.length + fields.reduce((size, field) => size + field.length, 0));
  let offset = 0;
  for (const field of [prefix, ...fields]) {
    serialized.set(field, offset);
    offset += field.length;
  }
  return createHash("sha256").update(serialized).digest();
}

export type RecipientSignature = {
  accountId: string;
  publicKey: string;
  signature: string;
};

export async function verifyRecipientSignature(
  config: NearRelayerConfig,
  input: SponsoredClaim,
  signature: RecipientSignature,
  issuedAt: number,
  nonce: string,
  now: number = Date.now(),
): Promise<boolean> {
  if (!Number.isSafeInteger(issuedAt) || Math.abs(now - issuedAt) > 2 * 60_000) return false;
  if (signature.accountId !== input.recipientId) return false;
  if (!/^[a-f0-9]{64}$/.test(nonce)) return false;
  if (!/^0x[0-9a-f]{64}$/.test(input.secret)) return false;

  let publicKey: PublicKey;
  let signatureBytes: Uint8Array;
  try {
    publicKey = PublicKey.fromString(signature.publicKey);
    signatureBytes = Uint8Array.from(Buffer.from(signature.signature, "base64"));
  } catch {
    return false;
  }
  if (signatureBytes.length !== 64) return false;

  const message = sponsoredClaimMessage({
    giftId: input.giftId,
    recipientId: input.recipientId,
    secret: input.secret,
    issuedAt,
    nonce,
  });
  try {
    // NEP-413 callbackUrl is optional; Meteor's adapter omits it. Accept only its absence or
    // our exact gift URL. Both formats still bind the configured contract and all claim terms.
    // https://github.com/near/wallet-selector/blob/main/packages/meteor-wallet/src/lib/meteor-wallet.ts
    const valid = [undefined, `${config.SANTA_PUBLIC_ORIGIN}/g/${input.giftId}`].some((callbackUrl) =>
      publicKey.verify(nep413Hash(message, config.NEAR_CONTRACT_ACCOUNT,
        Uint8Array.from(Buffer.from(nonce, "hex")), callbackUrl), signatureBytes));
    if (!valid) return false;
  } catch {
    return false;
  }

  try {
    const client = await createNearClient({ rpcUrl: config.NEAR_RPC_URL });
    const key = await client.provider.viewAccessKey({
      accountId: input.recipientId,
      publicKey: signature.publicKey,
      finalityQuery: { finality: "final" },
    });
    return key.permission === "FullAccess";
  } catch {
    return false;
  }
}

export async function submitSponsoredClaim(config: NearRelayerConfig, claim: SponsoredClaim): Promise<string> {
  const signerScope = `${config.NEAR_RPC_URL}:${config.NEAR_RELAYER_ACCOUNT}`;
  const giftScope = `${config.NEAR_RPC_URL}:${config.NEAR_CONTRACT_ACCOUNT}:${claim.giftId}`;
  const approval = createHash("sha256").update(`${claim.recipientId}:${claim.nonce}:${claim.secret}`).digest("hex");
  return claimCoordinator.run(signerScope, giftScope, approval, config.NEAR_MAX_SPONSORED_CLAIMS_PER_HOUR,
    () => sendSponsoredClaim(config, claim));
}

async function sendSponsoredClaim(config: NearRelayerConfig, claim: SponsoredClaim): Promise<string> {
  try {
    const signer = KeyPairSigner.fromSecretKey(config.NEAR_RELAYER_SECRET_KEY as KeyPairString);
    const account = new Account(config.NEAR_RELAYER_ACCOUNT, config.NEAR_RPC_URL, signer);
    const gift = z.object({ token_id: accountId, status: z.literal("Open"),
      secret_hash: z.string(), expires_at_ns: z.string().regex(/^[0-9]+$/),
    }).parse(await readNearContractView(
      config.NEAR_RPC_URL, config.NEAR_CONTRACT_ACCOUNT, "get_gift", { gift_id: claim.giftId },
    ));
    if (gift.secret_hash !== `0x${createHash("sha256").update(claim.secret).digest("hex")}`
      || BigInt(gift.expires_at_ns) <= BigInt(Date.now()) * 1_000_000n) throw new Error();
    const used = await readNearContractView(config.NEAR_RPC_URL, config.NEAR_CONTRACT_ACCOUNT,
      "is_claim_nonce_used", { nonce: `0x${claim.nonce}` });
    if (used !== false) throw new Error();
    const storage = await readNearContractView(
      config.NEAR_RPC_URL, gift.token_id, "storage_balance_of", { account_id: claim.recipientId },
    );
    if (storage === null) {
      const bounds = z.object({ min: z.string().regex(/^[0-9]{1,39}$/) }).parse(await readNearContractView(
        config.NEAR_RPC_URL, gift.token_id, "storage_balance_bounds",
      ));
      const deposit = BigInt(bounds.min);
      // Allowlisted token contracts may require registration, but cannot set an unlimited subsidy.
      if (deposit > 100_000_000_000_000_000_000_000n) throw new Error("Storage subsidy exceeds 0.1 NEAR");
      const registration = await account.signAndSendTransaction({
        receiverId: gift.token_id,
        actions: [actions.functionCall("storage_deposit", {
          account_id: claim.recipientId, registration_only: true,
        }, 30_000_000_000_000n, deposit)],
        waitUntil: "FINAL",
      });
      if (typeof registration.status !== "object" || !("SuccessValue" in registration.status)) throw new Error();
    }
    const result = await account.signAndSendTransaction({
      receiverId: config.NEAR_CONTRACT_ACCOUNT,
      actions: [
        actions.functionCall(
          "claim_gift",
          {
            gift_id: claim.giftId,
            secret: claim.secret,
            recipient_id: claim.recipientId,
            nonce: `0x${claim.nonce}`,
          },
          75_000_000_000_000n,
          1n,
        ),
      ],
      waitUntil: "FINAL",
    });
    // A successful receipt can still contain false from resolve_claim after a failed FT transfer.
    if (typeof result.status !== "object" || !("SuccessValue" in result.status)
      || Buffer.from(result.status.SuccessValue, "base64").toString("utf8") !== "true") throw new Error();
    const hash = result.transaction?.hash;
    if (typeof hash !== "string" || hash.length === 0) throw new Error();
    return hash;
  } catch {
    throw new Error("NEAR sponsored claim transaction failed.");
  }
}
