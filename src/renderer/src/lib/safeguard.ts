const BANNED_PATTERN = /\b(therapist|licensed|diagnose|treatment|medical advice)\b/i

const FALLBACK_RESPONSE =
  "I'm not a licensed professional, but I can help you think through this."

export function sanitizeResponse(text: string): string {
  if (BANNED_PATTERN.test(text)) {
    return FALLBACK_RESPONSE
  }
  return text
}
