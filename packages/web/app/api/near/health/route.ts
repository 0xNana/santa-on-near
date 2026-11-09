import { parseNearRelayerConfig } from "@santa/core/src/near-relayer.js";
import { readNearContractView } from "@santa/core/src/near-contract.js";
import { z } from "zod";
import { KeyPairSigner, type KeyPairString } from "near-api-js";
import { createNearClient } from "@santa/core/src/near.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  const headers = { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" };
  try {
    const config = parseNearRelayerConfig(process.env);
    const deployed = z.object({ relayer_id: z.string() }).parse(await readNearContractView(
      config.NEAR_RPC_URL, config.NEAR_CONTRACT_ACCOUNT, "get_config",
    ));
    if (deployed.relayer_id !== config.NEAR_RELAYER_ACCOUNT) throw new Error("Relayer mismatch");
    const signer = KeyPairSigner.fromSecretKey(config.NEAR_RELAYER_SECRET_KEY as KeyPairString);
    const client = await createNearClient({ rpcUrl: config.NEAR_RPC_URL });
    const access = await client.provider.viewAccessKey({ accountId: config.NEAR_RELAYER_ACCOUNT,
      publicKey: (await signer.getPublicKey()).toString(), finalityQuery: { finality: "final" } });
    if (access.permission !== "FullAccess") throw new Error("Relayer key cannot sponsor token registration");
    return Response.json({ ok: true, networkId: "testnet", contractId: config.NEAR_CONTRACT_ACCOUNT }, { headers });
  } catch {
    return Response.json({ ok: false, error: "near_not_ready" }, { status: 503, headers });
  }
}
