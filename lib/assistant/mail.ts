import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from 'node:crypto'
import { prisma } from '@/lib/db'

// Env: AUTH_SECRET, AUTH_MICROSOFT_ENTRA_ID_ID, AUTH_MICROSOFT_ENTRA_ID_SECRET, AUTH_MICROSOFT_ENTRA_ID_ISSUER
export const MAIL_SCOPE = 'openid profile email offline_access User.Read Mail.Send'

function key(): Buffer {
  const secret = process.env.AUTH_SECRET
  if (!secret) throw new Error('AUTH_SECRET yok')
  return Buffer.from(hkdfSync('sha256', secret, 'assistant-mail', 'refresh-token', 32))
}

function encrypt(plain: string): string {
  const iv = randomBytes(12)
  const c = createCipheriv('aes-256-gcm', key(), iv)
  const enc = Buffer.concat([c.update(plain, 'utf8'), c.final()])
  return [iv, c.getAuthTag(), enc].map((b) => b.toString('base64')).join('.')
}

function decrypt(blob: string): string {
  const [iv, tag, enc] = blob.split('.').map((p) => Buffer.from(p, 'base64'))
  const d = createDecipheriv('aes-256-gcm', key(), iv)
  d.setAuthTag(tag)
  return Buffer.concat([d.update(enc), d.final()]).toString('utf8')
}

export async function saveRefreshToken(owner: string, refreshToken: string) {
  const data = encrypt(refreshToken)
  await prisma.assistantMailAccount.upsert({
    where: { ownerEmail: owner },
    create: { ownerEmail: owner, refreshToken: data },
    update: { refreshToken: data },
  })
}

export async function hasMailAccount(owner: string): Promise<boolean> {
  return (await prisma.assistantMailAccount.count({ where: { ownerEmail: owner } })) > 0
}

async function accessToken(owner: string): Promise<string> {
  const acc = await prisma.assistantMailAccount.findUnique({ where: { ownerEmail: owner } })
  if (!acc) throw new Error('Mail yetkisi yok: çıkış yapıp Microsoft ile tekrar giriş yapın')
  const issuer = process.env.AUTH_MICROSOFT_ENTRA_ID_ISSUER?.replace(/\/v2\.0\/?$/, '')
  const res = await fetch(`${issuer}/oauth2/v2.0/token`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.AUTH_MICROSOFT_ENTRA_ID_ID ?? '',
      client_secret: process.env.AUTH_MICROSOFT_ENTRA_ID_SECRET ?? '',
      grant_type: 'refresh_token',
      refresh_token: decrypt(acc.refreshToken),
      scope: MAIL_SCOPE,
    }),
    signal: AbortSignal.timeout(15000),
  })
  const json = (await res.json().catch(() => ({}))) as { access_token?: string; refresh_token?: string; error?: string }
  if (!res.ok || !json.access_token) throw new Error(`Token yenilenemedi (${json.error ?? res.status}); tekrar giriş gerekli`)
  if (json.refresh_token) await saveRefreshToken(owner, json.refresh_token)
  return json.access_token
}

const list = (s: string | null | undefined) => (s ?? '').split(',').map((x) => x.trim()).filter(Boolean)

// Sahibin kendi hesabından gönderir (Graph /me/sendMail). Hata atarsa gönderilmemiştir.
export async function sendMailAs(owner: string, m: { toEmails: string; ccEmails?: string | null; subject: string; body: string }) {
  const token = await accessToken(owner)
  const rcpt = (a: string[]) => a.map((address) => ({ emailAddress: { address } }))
  const res = await fetch('https://graph.microsoft.com/v1.0/me/sendMail', {
    method: 'POST',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify({
      message: {
        subject: m.subject,
        body: { contentType: 'Text', content: m.body },
        toRecipients: rcpt(list(m.toEmails)),
        ccRecipients: rcpt(list(m.ccEmails)),
      },
      saveToSentItems: true,
    }),
    signal: AbortSignal.timeout(20000),
  })
  if (!res.ok) throw new Error(`Graph sendMail ${res.status}`)
}
