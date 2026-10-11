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
    // Microsoft'un AADSTS hata kodunu görünür kılar (gizli değer içermez).
    error(error) {
      const err = (error as { cause?: { err?: { error?: string; error_description?: string } } }).cause?.err
      console.error('[auth]', error.name, err?.error ?? '', (err?.error_description ?? '').split('\n')[0])
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
