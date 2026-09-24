// ============================================
// Safe Logging
// lib/logger.ts
// ============================================
//
// Wraps console logging so that raw error objects (which can include
// database error codes, table/column names, stack traces, or other
// internal details) never reach production logs verbatim without at
// least being labeled and structured. In development you still get the
// full object for debugging.
//
// This does not send logs anywhere — it's a drop-in replacement for
// console.error/console.warn call sites. Wire it up to Sentry/Datadog/etc
// by editing the `report()` function below.

type LogMeta = Record<string, unknown>;

function report(level: 'error' | 'warn' | 'info', message: string, meta?: LogMeta) {
  const entry = {
    level,
    message,
    timestamp: new Date().toISOString(),
    ...meta,
  };

  // Structured JSON logging is easy to pipe into CloudWatch/Datadog/ELK.
  if (level === 'error') {
    // eslint-disable-next-line no-console
    console.error(JSON.stringify(entry));
  } else if (level === 'warn') {
    // eslint-disable-next-line no-console
    console.warn(JSON.stringify(entry));
  } else {
    // eslint-disable-next-line no-console
    console.log(JSON.stringify(entry));
  }

  // TODO: forward to Sentry/monitoring in production, e.g.:
  // if (level === 'error' && process.env.NODE_ENV === 'production') {
  //   Sentry.captureException(meta?.error ?? new Error(message));
  // }
}

/**
 * Log an error safely. Pass the original error only as `meta.error` — in
 * development the full error is logged for debugging; in production only
 * a safe summary (name + message, no stack/internals) is included.
 */
export function logError(message: string, error?: unknown, meta?: LogMeta) {
  const isDev = process.env.NODE_ENV !== 'production';

  let errorInfo: LogMeta = {};
  if (error) {
    if (isDev) {
      errorInfo = { error: error instanceof Error ? { name: error.name, message: error.message, stack: error.stack } : error };
    } else {
      errorInfo = {
        error: error instanceof Error ? { name: error.name, message: error.message } : { message: 'unknown error' },
      };
    }
  }

  report('error', message, { ...meta, ...errorInfo });
}

export function logWarn(message: string, meta?: LogMeta) {
  report('warn', message, meta);
}

export function logInfo(message: string, meta?: LogMeta) {
  report('info', message, meta);
}
