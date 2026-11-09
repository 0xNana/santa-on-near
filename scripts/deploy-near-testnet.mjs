import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const root = fileURLToPath(new URL("../", import.meta.url));
const envFile = new URL("../.env", import.meta.url);
if (existsSync(envFile)) {
  try { process.loadEnvFile(fileURLToPath(envFile)); }
  catch { throw new Error("The repo-root .env could not be parsed."); }
}
const result = spawnSync("bash", ["packages/contracts/deploy-near-testnet.sh"], {
  cwd: root, env: process.env, stdio: "inherit",
});
if (result.error) throw new Error("Could not start the NEAR deployment script.");
process.exitCode = result.status ?? 1;
