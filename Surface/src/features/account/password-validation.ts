// Supabase's configured symbol group is ASCII punctuation; spaces and emoji
// may appear in a password but do not satisfy its symbol requirement.
const passwordSymbols = new Set("!\"#$%&'()*+,-./:;<=>?@[\\]^_`{|}~")

/** Match the password contract before sending a recovery update to the API. */
export function passwordResetError(password: string, confirmation: string): string | null {
  if ([...password].length < 8) return 'Use at least 8 characters for your new password.'
  if (new TextEncoder().encode(password).length > 72) {
    return 'Your password is too long. Use fewer characters.'
  }
  if (password !== confirmation) return 'The passwords do not match. Enter the same password in both fields.'
  const missing = []
  if (!/[a-z]/.test(password)) missing.push('a lowercase letter')
  if (!/[A-Z]/.test(password)) missing.push('an uppercase letter')
  if (!/[0-9]/.test(password)) missing.push('a number')
  if (![...password].some((character) => passwordSymbols.has(character))) missing.push('a symbol')
  if (missing.length > 0) return `Your password needs ${missing.join(', ')}.`
  return null
}
