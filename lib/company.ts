import { prisma } from '@/lib/db'

export const DEFAULT_COMPANY_ID = 'demo_company'

// Single-tenant: the company is resolved on the server, never taken from the client.
// When a second user/company is introduced, derive this from the session's membership instead.
export async function getCompanyId(): Promise<string> {
  const company =
    (await prisma.company.findUnique({ where: { id: DEFAULT_COMPANY_ID }, select: { id: true } })) ??
    (await prisma.company.findFirst({ orderBy: { createdAt: 'asc' }, select: { id: true } }))
  if (!company) throw new Error('Company not configured')
  return company.id
}

export async function assertEmployeeInCompany(employeeId: string, companyId: string) {
  const employee = await prisma.employee.findFirst({ where: { id: employeeId, companyId }, select: { id: true } })
  if (!employee) throw new Error('Employee not found in company')
}
