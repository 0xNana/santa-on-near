import { z } from "zod";
import { validateNearRpcUrl } from "./near.js";

const rpcReply = z.object({
  result: z.object({ result: z.array(z.number().int().min(0).max(255)) }).optional(),
  error: z.unknown().optional(),
});

async function fetchView(url: string, body: string, fetchImpl: typeof fetch): Promise<Response> {
  // These are read-only JSON-RPC queries. Never apply this retry policy to transaction submission.
  for (let attempt = 0; attempt < 2; attempt += 1) {
    let response: Response;
    try {
      response = await fetchImpl(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
        signal: AbortSignal.timeout(5_000),
      });
    } catch {
      if (attempt === 0) continue;
      throw new Error("NEAR RPC request failed.");
    }
    if (attempt === 0 && [502, 503, 504].includes(response.status)) {
      await response.body?.cancel().catch(() => {});
      continue;
    }
    return response;
  }
  throw new Error("NEAR RPC request failed.");
}

export async function readNearContractView<T>(
  rpcUrl: string,
  contractId: string,
  methodName: string,
  args: Record<string, unknown> = {},
  fetchImpl: typeof fetch = globalThis.fetch,
): Promise<T> {
  const url = validateNearRpcUrl(rpcUrl);
  const response = await fetchView(url, JSON.stringify({
    jsonrpc: "2.0",
    id: "santa",
    method: "query",
    params: {
      request_type: "call_function",
      account_id: contractId,
      method_name: methodName,
      args_base64: btoa(Array.from(new TextEncoder().encode(JSON.stringify(args)), (byte) => String.fromCharCode(byte)).join("")),
      finality: "final",
    },
  }), fetchImpl);
  if (!response.ok) throw new Error("NEAR RPC request failed.");
  const parsed = rpcReply.safeParse(await response.json());
  if (!parsed.success || parsed.data.error !== undefined || parsed.data.result === undefined) {
    throw new Error("NEAR RPC returned an invalid view response.");
  }
  try {
    return JSON.parse(new TextDecoder().decode(Uint8Array.from(parsed.data.result.result))) as T;
  } catch {
    throw new Error("NEAR contract returned invalid view data.");
  }
}
