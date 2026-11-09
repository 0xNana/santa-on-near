import { describe, expect, it, vi } from "vitest";
import { readNearContractView } from "../src/near-contract.js";

const read = (fetchImpl: typeof fetch) => readNearContractView(
  "https://rpc.testnet.near.org", "gifts.testnet", "get_gift", { gift_id: "1" }, fetchImpl,
);
const success = () => Response.json({ result: { result: [...new TextEncoder().encode('{"status":"Claimed"}')] } });

describe("NEAR contract view reliability", () => {
  it.each([
    new TypeError("fetch failed"),
    new DOMException("Read timed out", "TimeoutError"),
  ])("retries a transient transport failure once: %s", async (error) => {
    const fetchImpl = vi.fn<typeof fetch>().mockRejectedValueOnce(error).mockResolvedValueOnce(success());
    await expect(read(fetchImpl)).resolves.toEqual({ status: "Claimed" });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    const requests = fetchImpl.mock.calls.map(([, options]) => JSON.parse(String(options?.body)));
    expect(requests[1]).toEqual(requests[0]);
    expect(requests[0].method).toBe("query");
    expect(fetchImpl.mock.calls[0]?.[1]?.signal).not.toBe(fetchImpl.mock.calls[1]?.[1]?.signal);
  });

  it.each([502, 503, 504])("retries temporary HTTP %s once", async (status) => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValueOnce(new Response(null, { status })).mockResolvedValueOnce(success());
    await expect(read(fetchImpl)).resolves.toEqual({ status: "Claimed" });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("stops after two failed attempts and keeps transport details private", async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockRejectedValue(new TypeError("private endpoint detail"));
    await expect(read(fetchImpl)).rejects.toThrow("NEAR RPC request failed.");
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("stops after two temporary HTTP failures", async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockImplementation(async () => new Response(null, { status: 503 }));
    await expect(read(fetchImpl)).rejects.toThrow("NEAR RPC request failed.");
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it.each([400, 403, 429])("does not retry HTTP %s", async (status) => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(new Response(null, { status }));
    await expect(read(fetchImpl)).rejects.toThrow("NEAR RPC request failed.");
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it.each([
    { error: { message: "contract rejected query" } },
    { result: { result: [255] } },
  ])("does not retry contract errors or invalid view data", async (body) => {
    const fetchImpl = vi.fn<typeof fetch>().mockImplementation(async () => Response.json(body));
    await expect(read(fetchImpl)).rejects.toThrow();
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
});
