import { NextResponse, type NextRequest } from "next/server";

// React rebuilds server error stacks with eval in development only; production never allows it.
const DEV_EVAL = process.env.NODE_ENV === "development" ? ["'unsafe-eval'"] : [];

function newNonce(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return btoa(String.fromCharCode(...bytes));
}

/**
 * The one Content Security Policy for every page (C14). Scripts run only with this response's
 * nonce, which Next stamps on its own scripts, or when loaded by such a script ('strict-dynamic');
 * 'self' is the fallback for browsers without 'strict-dynamic'. Inline script without the nonce
 * never runs. Wallet Selector's modal uses inline styles, so style-src keeps the inline allowance.
 */
function contentSecurityPolicy(nonce: string): string {
  return [
    "default-src 'self'",
    ["script-src 'self'", `'nonce-${nonce}'`, "'strict-dynamic'", ...DEV_EVAL].join(" "),
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self'",
    "connect-src 'self' https://rpc.testnet.near.org",
    "child-src 'self'",
    "frame-src 'self'",
    "worker-src 'self'",
    "manifest-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join("; ");
}

/**
 * Gives every page request a fresh 16-byte nonce. Next reads it from the request's
 * Content-Security-Policy header and puts it on the scripts it renders; x-nonce carries it to
 * server components that load a script themselves. Both request headers are overwritten, so a
 * caller can never choose the nonce.
 */
export function proxy(request: NextRequest): NextResponse {
  const nonce = newNonce();
  const policy = contentSecurityPolicy(nonce);
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", policy);
  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("Content-Security-Policy", policy);
  return response;
}

// Pages only: the API sets its own headers in core's http.ts, and built assets carry no markup.
export const config = {
  matcher: ["/((?!api/|_next/static/|_next/image).*)"],
};
