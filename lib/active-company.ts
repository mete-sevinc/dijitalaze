import { cookies } from 'next/headers'
import { prisma } from '@/lib/db'

export const COMPANY_COOKIE = 'companyId'
export const DEFAULT_COMPANY_ID = 'demo_company'

// Active company comes from a cookie, validated against the DB; falls back to Demo.
export async function getActiveCompany() {
  const id = (await cookies()).get(COMPANY_COOKIE)?.value
  const company =
    (id ? await prisma.company.findUnique({ where: { id } }) : null) ??
    (await prisma.company.findUnique({ where: { id: DEFAULT_COMPANY_ID } })) ??
    (await prisma.company.findFirst({ orderBy: { createdAt: 'asc' } }))
  return company
}
