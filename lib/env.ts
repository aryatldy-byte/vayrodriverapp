// ============================================
// Environment Variable Validation
// lib/env.ts
// ============================================
//
// Fails loudly (and early) at server startup if required env vars are
// missing, instead of silently falling back to placeholder Supabase
// credentials and failing mysteriously on the first request.

const REQUIRED_ENV_VARS = ['NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_ANON_KEY'] as const;

// Vars that are recommended but not fatal if missing (feature-specific).
const RECOMMENDED_ENV_VARS = ['NEXT_PUBLIC_GOOGLE_MAPS_KEY', 'NEXT_PUBLIC_APP_URL'] as const;

let validated = false;

export function validateEnv() {
  // Only run this once per process, and only on the server.
  if (validated || typeof window !== 'undefined') return;
  validated = true;

  const missing = REQUIRED_ENV_VARS.filter((key) => !process.env[key]);

  if (missing.length > 0) {
    const message = `Missing required environment variable(s): ${missing.join(', ')}. Copy .env.local.example to .env.local and fill in real values.`;
    if (process.env.NODE_ENV === 'production') {
      // In production, missing core config should stop the app from
      // silently serving broken auth/database calls.
      throw new Error(message);
    } else {
      // eslint-disable-next-line no-console
      console.warn(`[Vayro] ${message}`);
    }
  }

  const missingRecommended = RECOMMENDED_ENV_VARS.filter((key) => !process.env[key]);
  if (missingRecommended.length > 0) {
    // eslint-disable-next-line no-console
    console.warn(
      `[Vayro] Missing recommended environment variable(s): ${missingRecommended.join(', ')}. Some features may not work.`
    );
  }
}
