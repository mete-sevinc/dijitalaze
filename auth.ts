import NextAuth from 'next-auth'
import MicrosoftEntraID from 'next-auth/providers/microsoft-entra-id'

// Env: AUTH_SECRET, AUTH_MICROSOFT_ENTRA_ID_ID, AUTH_MICROSOFT_ENTRA_ID_SECRET,
// AUTH_MICROSOFT_ENTRA_ID_ISSUER (https://login.microsoftonline.com/<tenant-id>/v2.0), AUTH_ALLOWED_EMAIL
// AUTH_ALLOWED_EMAIL may hold several comma-separated addresses.
const allowedEmails = (process.env.AUTH_ALLOWED_EMAIL ?? '')
  .split(',')
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean)

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [MicrosoftEntraID],
  session: { strategy: 'jwt' },
  pages: { error: '/giris-hatasi' },
  callbacks: {
    // Fail closed: no configured address means nobody gets in.
    signIn({ profile }) {
      const email = String(profile?.email ?? profile?.preferred_username ?? '').toLowerCase()
      return !!email && allowedEmails.includes(email)
    },
  },
})
