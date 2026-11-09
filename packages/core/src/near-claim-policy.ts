export class NearClaimPolicyError extends Error {
  constructor(public readonly code: "claim_in_progress" | "sponsorship_limit") { super(code); }
}

/** Single-instance guard. Never trust caller-selected IP headers as a spending budget. */
export class NearClaimCoordinator {
  private readonly pending = new Map<string, { approval: string; promise: Promise<string> }>();
  private readonly queues = new Map<string, Promise<unknown>>();
  private readonly budgets = new Map<string, { hour: number; count: number }>();
  constructor(private readonly now: () => number = Date.now) {}

  async run(signer: string, gift: string, approval: string, hourlyLimit: number, send: () => Promise<string>): Promise<string> {
    const existing = this.pending.get(gift);
    if (existing) {
      if (existing.approval !== approval) throw new NearClaimPolicyError("claim_in_progress");
      return existing.promise;
    }
    const hour = Math.floor(this.now() / 3_600_000);
    const budget = this.budgets.get(signer);
    const count = budget?.hour === hour ? budget.count : 0;
    if (count >= hourlyLimit) throw new NearClaimPolicyError("sponsorship_limit");
    this.budgets.set(signer, { hour, count: count + 1 });
    const promise = (this.queues.get(signer) ?? Promise.resolve()).catch(() => undefined).then(send);
    this.queues.set(signer, promise);
    this.pending.set(gift, { approval, promise });
    try { return await promise; }
    finally {
      this.pending.delete(gift);
      if (this.queues.get(signer) === promise) this.queues.delete(signer);
    }
  }
}
