import { beforeEach, describe, expect, it, vi } from 'vitest'

const prisma = vi.hoisted(() => ({
  company: { findUnique: vi.fn(), findFirst: vi.fn() },
  employee: { findMany: vi.fn(), update: vi.fn() },
}))
vi.mock('@/lib/db', () => ({ prisma }))
vi.mock('@/lib/require-auth', () => ({ requireAuth: vi.fn().mockResolvedValue(undefined) }))

import { getOrgChart, setManager } from '@/app/actions/employees'

beforeEach(() => {
  vi.resetAllMocks()
  vi.spyOn(console, 'error').mockImplementation(() => {})
  prisma.company.findUnique.mockResolvedValue({ id: 'demo_company' })
  prisma.employee.findMany.mockResolvedValue([{ id: 'a', managerId: null }, { id: 'b', managerId: 'a' }, { id: 'c', managerId: 'b' }])
})

describe('setManager', () => {
  it('sets a manager inside the company', async () => {
    prisma.employee.update.mockResolvedValue({})
    expect(await setManager('c', 'a')).toEqual({ success: true })
    expect(prisma.employee.update).toHaveBeenCalledWith({ where: { id: 'c', companyId: 'demo_company' }, data: { managerId: 'a' } })
  })
  it('clears the manager with null', async () => {
    prisma.employee.update.mockResolvedValue({})
    expect((await setManager('b', null)).success).toBe(true)
    expect(prisma.employee.update.mock.calls[0][0].data).toEqual({ managerId: null })
  })
  it('rejects a reporting loop, an unknown employee and a manager outside the company', async () => {
    expect(await setManager('a', 'c')).toEqual({ success: false, error: 'Bu atama raporlama döngüsü oluşturur' })
    expect(await setManager('zzz', 'a')).toEqual({ success: false, error: 'Çalışan bulunamadı' })
    expect(await setManager('c', 'foreign')).toEqual({ success: false, error: 'Yönetici bulunamadı' })
    expect(prisma.employee.update).not.toHaveBeenCalled()
  })
  it('hides database errors', async () => {
    prisma.employee.update.mockRejectedValue(Object.assign(new Error('db detail'), { code: 'P2025' }))
    expect(await setManager('c', 'a')).toEqual({ success: false, error: 'Yönetici atanamadı' })
  })
})

describe('getOrgChart', () => {
  it('lists non-archived employees of the company', async () => {
    prisma.employee.findMany.mockResolvedValue([])
    await getOrgChart()
    expect(prisma.employee.findMany.mock.calls[0][0].where).toEqual({ companyId: 'demo_company', status: { not: 'ARCHIVED' } })
  })
})
