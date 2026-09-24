// ============================================
// CSRF Protection (Origin/Referer check)
// lib/security/origin.ts
// ============================================
//
// This API is cookie-authenticated (Supabase session cookies), which means
// a malicious page on another site could make the browser send a request
// here with the user's cookies attached. Since these routes only accept
// JSON (not form submissions) that's already a partial mitigation, but we
// add a same-origin check as a simple, dependency-free CSRF defense for
// every state-changing (POST/PUT/PATCH/DELETE) request.
//
// This intentionally does NOT rely on a token cookie/header pair — same
// origin checking is simpler to wire up correctly and is what Next.js's
// own Server Actions use under the hood for this exact purpose.

/**
 * Returns true if the request's Origin (or, failing that, Referer) header
 * matches this app's own origin. Requests with neither header (e.g. some
 * same-origin fetches, curl, server-to-server calls) are allowed through —
 * pair this with authentication, it is not a replacement for it.
 */
export function isSameOriginRequest(request: Request): boolean {
  const origin = request.headers.get('origin');
  const referer = request.headers.get('referer');
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;

  // If we don't know our own URL, we can't compare — fail open on this
  // specific check (auth still applies) rather than break local dev.
  if (!appUrl) return true;

  let appOrigin: string;
  try {
    appOrigin = new URL(appUrl).origin;
  } catch {
    return true;
  }

  if (origin) {
    return origin === appOrigin;
  }

  if (referer) {
    try {
      return new URL(referer).origin === appOrigin;
    } catch {
      return false;
    }
  }

  // No Origin or Referer header at all — allow (e.g. some native/mobile
  // clients, server-side calls). Don't use this as your only defense.
  return true;
}
