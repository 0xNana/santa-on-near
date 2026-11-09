import { JsonRpcProvider } from "near-api-js";

export const NEAR_TESTNET_NETWORK_ID = "testnet";
export const NEAR_TESTNET_RPC_URL = "https://rpc.testnet.near.org";

export type NearClientConfig = {
  networkId?: string;
  rpcUrl?: string;
  accountId?: string;
};

export type NearClient = {
  networkId: string;
  rpcUrl: string;
  accountId?: string;
  provider: JsonRpcProvider;
};

export function validateNearRpcUrl(rpcUrl: string): string {
  const parsed = new URL(rpcUrl);
  if (parsed.protocol !== "https:" || parsed.username !== "" || parsed.password !== "") {
    throw new Error("NEAR RPC URLs must use https and must not contain credentials.");
  }
  return parsed.toString();
}

export async function createNearClient(opts: NearClientConfig = {}): Promise<NearClient> {
  const networkId = opts.networkId ?? NEAR_TESTNET_NETWORK_ID;
  if (networkId !== NEAR_TESTNET_NETWORK_ID) throw new Error("Santa supports NEAR Testnet only.");
  const rpcUrl = validateNearRpcUrl(opts.rpcUrl ?? NEAR_TESTNET_RPC_URL);
  return {
    networkId,
    rpcUrl,
    accountId: opts.accountId,
    provider: new JsonRpcProvider({ url: rpcUrl }),
  };
}

export async function createNearWalletSession(opts: NearClientConfig = {}) {
  const client = await createNearClient(opts);
  return {
    ...client,
    supportsWalletAuth: true,
    mode: "near-testnet",
  };
}
