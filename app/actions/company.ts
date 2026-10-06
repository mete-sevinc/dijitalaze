'use server'

import { cookies } from 'next/headers'
import { prisma } from '@/lib/db'
import { requireAuth } from '@/lib/require-auth'
import { COMPANY_COOKIE } from '@/lib/active-company'

export async function switchCompany(id: string) {
  await requireAuth()
  const company = await prisma.company.findUnique({ where: { id }, select: { id: true } })
  if (!company) return { success: false as const, error: 'Firma bulunamadı' }
  ;(await cookies()).set(COMPANY_COOKIE, company.id, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
  })
  return { success: true as const }
}
