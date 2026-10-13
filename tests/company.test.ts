import { beforeEach, describe, expect, it, vi } from 'vitest'

const prisma = vi.hoisted(() => ({
  company: { findUnique: vi.fn(), findFirst: vi.fn() },
  employee: { findFirst: vi.fn() },
}))
vi.mock('@/lib/db', () => ({ prisma }))

import { assertEmployeeInCompany, DEFAULT_COMPANY_ID, getCompanyId } from '@/lib/company'

beforeEach(() => vi.resetAllMocks())

describe('getCompanyId', () => {
  it('uses the default company when it exists', async () => {
    prisma.company.findUnique.mockResolvedValue({ id: DEFAULT_COMPANY_ID })
    expect(await getCompanyId()).toBe(DEFAULT_COMPANY_ID)
    expect(prisma.company.findFirst).not.toHaveBeenCalled()
  })
  it('falls back to the oldest company', async () => {
    prisma.company.findUnique.mockResolvedValue(null)
    prisma.company.findFirst.mockResolvedValue({ id: 'other' })
    expect(await getCompanyId()).toBe('other')
  })
  it('throws when no company is configured', async () => {
    prisma.company.findUnique.mockResolvedValue(null)
    prisma.company.findFirst.mockResolvedValue(null)
    await expect(getCompanyId()).rejects.toThrow('Company not configured')
  })
})

describe('assertEmployeeInCompany', () => {
  it('looks the employee up within the company and rejects foreign ids', async () => {
    prisma.employee.findFirst.mockResolvedValue(null)
    await expect(assertEmployeeInCompany('e1', 'c1')).rejects.toThrow()
    expect(prisma.employee.findFirst).toHaveBeenCalledWith({ where: { id: 'e1', companyId: 'c1' }, select: { id: true } })
  })
  it('passes for an employee of the company', async () => {
    prisma.employee.findFirst.mockResolvedValue({ id: 'e1' })
    await expect(assertEmployeeInCompany('e1', 'c1')).resolves.toBeUndefined()
  })
})
