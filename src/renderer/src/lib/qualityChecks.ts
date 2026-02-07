/**
 * Heuristic check for degenerate "apology-only" responses.
 * Returns false ONLY for responses that are pure apology with zero substance.
 * Designed to be conservative — most responses should pass.
 */
export function checkResponseQuality(text: string): boolean {
  if (!text || !text.trim()) return false

  const lower = text.toLowerCase().trim()

  // Pass anything with a question — model is engaging
  if (lower.includes('?')) return true

  // Pass anything reasonably long — has substance
  if (lower.length >= 80) return true

  // Only flag very short responses that are purely apologetic
  const apologyOnly =
    /^i'?m (so )?sorry/.test(lower) &&
    lower.length < 60
  if (apologyOnly) return false

  return true
}

export const AUTO_REGEN_PROMPT =
  'Can you say a little more about that?'
