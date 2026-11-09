import { describe, expect, it } from "vitest";
import { NearClaimCoordinator } from "../src/near-claim-policy.js";

describe("NEAR claim sponsorship policy", () => {
  it("coalesces identical retries and rejects a competing claim for the same gift", async () => {
    const policy = new NearClaimCoordinator();
    let complete!: (value: string) => void;
    const pending = new Promise<string>((resolve) => { complete = resolve; });
    let sent = 0;
    const run = () => { sent++; return pending; };
    const first = policy.run("relayer", "gift-1", "approval-1", 10, run);
    const retry = policy.run("relayer", "gift-1", "approval-1", 10, run);
    await expect(policy.run("relayer", "gift-1", "approval-2", 10, run)).rejects.toThrow("claim_in_progress");
    await Promise.resolve();
    complete("tx");
    expect(await first).toBe("tx");
    expect(await retry).toBe("tx");
    expect(sent).toBe(1);
  });

  it("serializes relayer operations across gifts to avoid access-key nonce races", async () => {
    const policy = new NearClaimCoordinator();
    const order: string[] = [];
    const work = (id: string) => async () => { order.push(`start-${id}`); await Promise.resolve(); order.push(`end-${id}`); return id; };
    await Promise.all([policy.run("relayer", "gift-1", "a", 10, work("1")), policy.run("relayer", "gift-2", "b", 10, work("2"))]);
    expect(order).toEqual(["start-1", "end-1", "start-2", "end-2"]);
  });

  it("caps all attempts regardless of IP headers and retains failed attempts in the budget", async () => {
    let now = 0;
    const policy = new NearClaimCoordinator(() => now);
    await expect(policy.run("relayer", "gift-1", "a", 1, async () => { throw new Error("RPC failed"); })).rejects.toThrow("RPC failed");
    await expect(policy.run("relayer", "gift-2", "b", 1, async () => "tx")).rejects.toThrow("sponsorship_limit");
    now = 3_600_000;
    expect(await policy.run("relayer", "gift-2", "b", 1, async () => "tx")).toBe("tx");
  });
});
