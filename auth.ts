import NextAuth from 'next-auth'
import MicrosoftEntraID from 'next-auth/providers/microsoft-entra-id'
import { MAIL_SCOPE, saveRefreshToken } from '@/lib/assistant/mail'

// Env: AUTH_SECRET, AUTH_MICROSOFT_ENTRA_ID_ID, AUTH_MICROSOFT_ENTRA_ID_SECRET,
// AUTH_MICROSOFT_ENTRA_ID_ISSUER (https://login.microsoftonline.com/<tenant-id>/v2.0), AUTH_ALLOWED_EMAIL
// AUTH_ALLOWED_EMAIL may hold several comma-separated addresses.
const allowedEmails = (process.env.AUTH_ALLOWED_EMAIL ?? '')
  .split(',')
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean)

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    MicrosoftEntraID({
      clientId: process.env.AUTH_MICROSOFT_ENTRA_ID_ID?.trim(),
      clientSecret: process.env.AUTH_MICROSOFT_ENTRA_ID_SECRET?.trim(),
      issuer: process.env.AUTH_MICROSOFT_ENTRA_ID_ISSUER?.trim(),
      authorization: { params: { scope: MAIL_SCOPE } },
    }),
  ],
  logger: {
    // Microsoft'un AADSTS hata kodunu görünür kılar; yalnızca izinli alanlar yazılır (token/claim yok).
    error(error) {
      const e = error as Error & { cause?: { err?: Error & { error?: string; error_description?: string; cause?: unknown } } }
      const inner = e.cause?.err
      const c = inner?.cause && typeof inner.cause === 'object' ? (inner.cause as Record<string, unknown>) : undefined
      const safe = c ? { error: c.error, error_codes: c.error_codes, trace_id: c.trace_id, correlation_id: c.correlation_id } : undefined
      console.error(`[auth-debug] ${e.name} ${inner?.error ?? ''} ${(inner?.error_description ?? '').split('\n')[0]} ${safe ? JSON.stringify(safe) : ''}`)
    },
  },
  session: { strategy: 'jwt' },
  pages: { signIn: '/giris', error: '/giris-hatasi' },
  callbacks: {
    // Fail closed: no configured address means nobody gets in.
    async signIn({ profile, account }) {
      const email = String(profile?.email ?? profile?.preferred_username ?? '').toLowerCase()
      if (!email || !allowedEmails.includes(email)) return false
      // Asistanın bu kullanıcı adına mail gönderebilmesi için yenileme belirteci saklanır.
      if (account?.refresh_token) {
        try {
          await saveRefreshToken(email, account.refresh_token)
        } catch (e) {
          console.error('mail token kaydedilemedi', e)
        }
      }
      return true
    },
  },
})
