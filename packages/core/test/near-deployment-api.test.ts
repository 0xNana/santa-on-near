import { afterEach, describe, expect, it, vi } from "vitest";
import { JsonRpcProvider, KeyPairEd25519 } from "near-api-js";
import * as rpc from "../src/near-contract.js";
import { GET as legacyGet } from "../../web/app/api/[...path]/route.js";
import { GET as health } from "../../web/app/api/near/health/route.js";

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllEnvs(); });

describe("NEAR deployment API", () => {
  it("keeps legacy EVM endpoints disabled by default", async () => {
    vi.stubEnv("SANTA_ENABLE_LEGACY_EVM_API", "");
    const response = await legacyGet(new Request("https://santa.example/api/stocks") as never);
    expect(response.status).toBe(410);
    expect(await response.json()).toEqual({ ok: false, error: "legacy_api_disabled" });
  });

  function configure() {
    vi.spyOn(JsonRpcProvider.prototype, "viewAccessKey").mockResolvedValue({ nonce: 1n, permission: "FullAccess", block_hash: "block", block_height: 1 });
    for (const [name, value] of Object.entries({ NEAR_CONTRACT_ACCOUNT: "santa.testnet",
      NEXT_PUBLIC_NEAR_CONTRACT_ACCOUNT: "santa.testnet", NEAR_RELAYER_ACCOUNT: "relayer.testnet",
      NEAR_RELAYER_SECRET_KEY: KeyPairEd25519.fromRandom().toString(),
      SANTA_PUBLIC_ORIGIN: "https://santa.example" })) vi.stubEnv(name, value);
  }

  it("does not report ready when the relayer key is missing or cannot register/transfer tokens", async () => {
    configure();
    vi.spyOn(rpc, "readNearContractView").mockResolvedValue({ relayer_id: "relayer.testnet" });
    vi.mocked(JsonRpcProvider.prototype.viewAccessKey).mockRejectedValue(new Error("missing key"));
    expect((await health()).status).toBe(503);
    vi.mocked(JsonRpcProvider.prototype.viewAccessKey).mockResolvedValue({ nonce: 1n, block_hash: "block", block_height: 1,
      permission: { FunctionCall: { receiver_id: "santa.testnet", method_names: ["claim_gift"], allowance: null } } });
    expect((await health()).status).toBe(503);
  });

  it("reports ready when the configured relayer matches the deployed contract", async () => {
    configure();
    vi.spyOn(rpc, "readNearContractView").mockResolvedValue({ owner_id: "owner.testnet", relayer_id: "relayer.testnet" });
    const response = await health();
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true, networkId: "testnet", contractId: "santa.testnet" });
  });

  it("refuses readiness for a different relayer or unavailable RPC", async () => {
    configure();
    vi.spyOn(rpc, "readNearContractView").mockResolvedValue({ relayer_id: "wrong.testnet" });
    expect((await health()).status).toBe(503);
    vi.mocked(rpc.readNearContractView).mockRejectedValue(new Error("private connection details"));
    expect((await health()).status).toBe(503);
  });

  it("refuses readiness without deployment settings", async () => {
    vi.stubEnv("NEAR_RELAYER_SECRET_KEY", "");
    expect((await health()).status).toBe(503);
  });
});
