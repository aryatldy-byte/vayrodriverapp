// ============================================
// Input Sanitization
// lib/security/sanitize.ts
// ============================================
//
// Strips HTML/script content out of free-text user input before it's
// stored. Defense-in-depth: React already escapes text when rendering
// (no dangerouslySetInnerHTML is used in this codebase), but sanitizing
// at write-time also protects any future consumer of this data that
// might not escape it (emails, admin dashboards, exports, other apps
// reading the same database, etc).

/**
 * Remove HTML tags, script/style content, and null bytes from a string.
 * Returns plain text safe to store and safe to render without escaping.
 */
export function sanitizeInput(input: string | null | undefined, maxLength = 1000): string {
  if (!input) return '';

  let cleaned = input
    // strip script/style blocks (and their contents) first
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    // strip all remaining tags
    .replace(/<[^>]*>/g, '')
    // strip null bytes / control chars that can break downstream parsers
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
    .trim();

  if (cleaned.length > maxLength) {
    cleaned = cleaned.slice(0, maxLength);
  }

  return cleaned;
}
