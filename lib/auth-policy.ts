// Who may sign in. Pure functions so the rules can be tested without NextAuth.

export function parseAllowedEmails(raw: string | undefined): string[] {
  return (raw ?? '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean)
}

export function emailFromProfile(profile: { email?: unknown; preferred_username?: unknown } | null | undefined): string {
  return String(profile?.email ?? profile?.preferred_username ?? '').toLowerCase()
}

// Fail closed: an empty list or empty email never matches.
export function isAllowedEmail(email: string, allowed: string[]): boolean {
  return !!email && allowed.includes(email.toLowerCase())
}
