import type { Metadata } from "next";
import { headers } from "next/headers";
import { Fraunces, JetBrains_Mono, Manrope } from "next/font/google";
import type { ReactNode } from "react";
import "./globals.css";
import { siteOrigin } from "@/lib/site";

const display = Fraunces({
  subsets: ["latin"],
  axes: ["opsz", "SOFT", "WONK"],
  variable: "--font-display",
  display: "swap",
});

const body = Manrope({
  subsets: ["latin"],
  variable: "--font-body",
  display: "swap",
});

const mono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});

// Each response has its own script nonce from proxy.ts, and only a page rendered for that request
// can carry it; a page prerendered at build time would have its scripts blocked.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  metadataBase: new URL(siteOrigin()),
  title: { default: "Santa: send a little something to someone you love", template: "%s · Santa" },
  description: "Gift allowlisted NEAR Testnet tokens with encrypted notes, private claim links, and sponsored claims.",
  openGraph: { type: "website", siteName: "Santa" },
  twitter: { card: "summary_large_image" },
};

// Wallet state can still render when a browser blocks site data. A memory fallback keeps the
// page usable, while __santaStorageBlocked prevents sending a gift whose link cannot be saved.
const STORAGE_GUARD = `(function () {
  function memory() {
    var data = {};
    return {
      getItem: function (k) { return Object.prototype.hasOwnProperty.call(data, k) ? data[k] : null; },
      setItem: function (k, v) { data[k] = String(v); },
      removeItem: function (k) { delete data[k]; },
      clear: function () { data = {}; },
      key: function (i) { var keys = Object.keys(data); return i < keys.length ? keys[i] : null; },
      get length() { return Object.keys(data).length; }
    };
  }
  ["localStorage", "sessionStorage"].forEach(function (name) {
    try { void window[name].length; } catch (e) {
      try { Object.defineProperty(window, name, { value: memory(), configurable: true }); window.__santaStorageBlocked = true; } catch (e2) {}
    }
  });
})();`;

export default async function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  const nonce = (await headers()).get("x-nonce") ?? undefined;
  return (
    <html lang="en" className={`${display.variable} ${body.variable} ${mono.variable}`}>
      <head>
        <script nonce={nonce} dangerouslySetInnerHTML={{ __html: STORAGE_GUARD }} />
      </head>
      <body className="bg-bg text-ink font-body antialiased">
        <a className="skip-link" href="#main-content">Skip to content</a>
        {children}
      </body>
    </html>
  );
}
