import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
const require = createRequire(import.meta.url);
const removeRemoteFont = require("../../web/loaders/wallet-selector-css.cjs") as (css: string) => string;

describe("Wallet Selector CSS under Santa's local-font CSP", () => {
  it("removes the vendor's external font request and preserves every modal rule", () => {
    const css = readFileSync(require.resolve("@near-wallet-selector/modal-ui/styles.css"), "utf8");
    const result = removeRemoteFont(css);
    expect(result).not.toContain("fonts.googleapis.com");
    expect(result).toBe(css.slice(css.indexOf("\n") + 1));
    expect(result).toContain("#near-wallet-selector-modal");
  });
  it("requires review if an upstream stylesheet changes its remote import", () => {
    expect(() => removeRemoteFont('@import url("https://other.example/font.css");\nbody {}')).toThrow("Review Wallet Selector");
  });
});
