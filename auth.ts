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
      token: {
        // Başarısız token yanıtında Microsoft'un AADSTS kodunu loglar (yalnızca hata alanları).
        async conform(res: Response) {
          if (!res.ok) {
            const j = (await res.clone().json().catch(() => ({}))) as { error?: string; error_codes?: number[]; error_description?: string }
            console.error(`[auth-debug] token ${res.status} ${j.error ?? ''} ${JSON.stringify(j.error_codes ?? '')} ${(j.error_description ?? '').split('\n')[0].slice(0, 300)}`)
          }
          return res
        },
      },
    }),
  ],
  logger: {
    // Microsoft'un AADSTS hata kodunu görünür kılar; yalnızca izinli alanlar yazılır (token/claim yok).
    error(error) {
      const c = (error as { cause?: Record<string, unknown> }).cause ?? {}
      const desc = String(c.error_description ?? '').split('\n')[0].slice(0, 300)
      console.error(`[auth-debug] ${error.message} | ${String(c.error ?? '')} ${JSON.stringify(c.error_codes ?? '')} ${desc}`)
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
