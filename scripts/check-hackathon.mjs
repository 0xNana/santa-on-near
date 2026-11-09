import { existsSync, readFileSync, statSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const failures = [];
function check(ok, label) { console.log(`${ok ? "PASS" : "BLOCKED"} ${label}`); if (!ok) failures.push(label); }
const git = (...args) => execFileSync("git", args, { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
const file = (path) => new URL(`../${path}`, import.meta.url);
const baseline = "042714b";

check(Date.now() <= Date.parse("2026-11-14T23:59:00Z"), "submission deadline: 14 November 2026, 23:59 UTC");
check(existsSync(file("LICENSE")), "repository license present");
check(existsSync(file("HACKATHON.md")), "canonical rules snapshot present; re-fetch before submission");
check(git("branch", "--show-current") === "codex/near-hackathon", "dedicated local NEAR branch");
check(git("status", "--porcelain").length === 0, "all reviewed submission source committed; no forgotten untracked files");
check(git("rev-parse", "HEAD") !== git("rev-parse", baseline), "submission head differs from the disclosed EVM baseline");
for (const path of ["packages/contracts/near/src/lib.rs", "packages/core/src/near-relayer.ts", "packages/web/components/near/NearSendPage.tsx"]) {
  let tracked = true;
  try { git("ls-files", "--error-unmatch", path); } catch { tracked = false; }
  check(tracked, `${path} is included in Git`);
}
const evidencePath = file("docs/near-evidence.json");
if (!existsSync(evidencePath)) {
  check(false, "verified NEAR create/claim/refund evidence and new demo post recorded in docs/near-evidence.json");
} else {
  try {
    const evidence = JSON.parse(readFileSync(evidencePath, "utf8"));
    const account = /^(?=.{2,64}$)[a-z0-9]+([._-][a-z0-9]+)*$/;
    const tx = /^[1-9A-HJ-NP-Za-km-z]{40,50}$/;
    check(evidence.networkId === "testnet", "evidence is for NEAR Testnet");
    check(account.test(evidence.contractAccount ?? "") && account.test(evidence.tokenAccount ?? ""), "real NEAR contract and token account IDs recorded");
    check(["createTx", "claimTx", "refundTx"].every((key) => tx.test(evidence[key] ?? "")), "NEAR transaction hashes present; EVM 0x hashes cannot pass");
    let matchesCode = false;
    if (/^[a-f0-9]{40}$/.test(evidence.submissionCommit ?? "")) {
      try {
        git("merge-base", "--is-ancestor", evidence.submissionCommit, "HEAD");
        matchesCode = git("diff", "--name-only", evidence.submissionCommit, "HEAD", "--", "packages", "scripts", "package.json", "package-lock.json", "Dockerfile", "fly.toml").length === 0;
      } catch { /* A missing or unrelated commit is not evidence for this tree. */ }
    }
    check(matchesCode, "tested commit is an ancestor with identical application/contract/tooling source");
    check(/^https:\/\/(x\.com|twitter\.com)\/[^/]+\/status\/[0-9]+$/.test(evidence.demoPostUrl ?? ""), "human-published demo post URL recorded");
    const video = file("demo/near-demo.mp4");
    check(existsSync(video) && statSync(video).size > 10_000 && readFileSync(video).subarray(4, 8).toString() === "ftyp", "new NEAR MP4 present; legacy EVM video is not substituted");
    check(evidence.reviewed === true && Number.isFinite(Date.parse(evidence.verifiedAt ?? "")), "human-reviewed transaction evidence has a verification date");
  } catch { check(false, "evidence file parses and follows the documented schema"); }
}
console.log("This read-only check never submits, pushes, changes visibility, signs transactions, or validates personal submission fields.");
console.log("Repository visibility, remote commit availability, demo availability/content, team details, final tracks, payout account, consent, and prior-submission status still require human verification.");
process.exitCode = failures.length === 0 ? 0 : 1;
