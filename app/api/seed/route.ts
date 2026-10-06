import { timingSafeEqual } from 'node:crypto'

export const dynamic = 'force-dynamic'

function authorized(req: Request) {
  const secret = process.env.SEED_SECRET
  if (!secret) return false
  const given = Buffer.from(req.headers.get('authorization') ?? '')
  const expected = Buffer.from(`Bearer ${secret}`)
  return given.length === expected.length && timingSafeEqual(given, expected)
}

export async function POST(req: Request) {
  if (!authorized(req)) return Response.json({ error: 'unauthorized' }, { status: 401 })
  const { prisma } = await import('@/lib/db')

  try {
    const existing = await prisma.company.findUnique({ where: { id: 'demo_company' } })
    if (existing) {
      const count = await prisma.employee.count({ where: { companyId: 'demo_company' } })
      return Response.json({ success: true, message: 'Already seeded', employees: count })
    }

    await prisma.company.create({
      data: {
        id: 'demo_company',
        name: 'Demo Teknoloji A.Ş.',
        description: 'Kurumsal yazılım çözümleri sağlayan teknoloji firması',
      },
    })

    const ceo = await prisma.employee.create({
      data: {
        companyId: 'demo_company',
        name: 'Murat Şahin',
        title: 'Genel Müdür / CEO',
        department: 'Yönetim',
        avatar: '👨‍💼',
        status: 'ACTIVE',
        communicationStyle: 'Stratejik düşünür, liderlik odaklı',
        responsibilities: JSON.stringify(['Strateji', 'Liderlik', 'İş Geliştirme']),
        systemRole: "Sen Demo Teknoloji şirketinin CEO'susun. Stratejik kararlar alır, şirketi yönetirsin.",
      },
    })

    const cto = await prisma.employee.create({
      data: {
        companyId: 'demo_company',
        name: 'Ayşe Kaya',
        title: 'CTO / Teknoloji Direktörü',
        department: 'Teknoloji',
        avatar: '👩‍💻',
        status: 'ACTIVE',
        communicationStyle: 'Teknik derinlik, inovasyon odaklı',
        responsibilities: JSON.stringify(['Yazılım Mimarisi', 'Cloud', 'AI/ML']),
        systemRole: "Sen Demo Teknoloji şirketinin CTO'susun. Teknoloji kararları alır.",
      },
    })

    const pm = await prisma.employee.create({
      data: {
        companyId: 'demo_company',
        name: 'Emre Demir',
        title: 'Ürün Müdürü',
        department: 'Ürün',
        avatar: '📊',
        status: 'ACTIVE',
        communicationStyle: 'Kullanıcı odaklı, analitik',
        responsibilities: JSON.stringify(['Ürün Yönetimi', 'UX/UI', 'Agile']),
        systemRole: 'Sen Demo Teknoloji şirketinin Ürün Müdürüsün.',
      },
    })

    const hr = await prisma.employee.create({
      data: {
        companyId: 'demo_company',
        name: 'Fatma Yıldız',
        title: 'İK Müdürü',
        department: 'İnsan Kaynakları',
        avatar: '🤝',
        status: 'ACTIVE',
        communicationStyle: 'Empati odaklı, organizasyon geliştirici',
        responsibilities: JSON.stringify(['İşe Alım', 'Performans Yönetimi']),
        systemRole: 'Sen Demo Teknoloji şirketinin İK Müdürüsün.',
      },
    })

    await prisma.task.createMany({
      data: [
        {
          companyId: 'demo_company',
          title: 'Q4 Strateji Toplantısı Hazırlığı',
          assigneeId: ceo.id,
          creatorId: ceo.id,
          status: 'IN_PROGRESS',
          priority: 'HIGH',
          dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        },
        {
          companyId: 'demo_company',
          title: 'Yeni Mikroservis Mimarisi Tasarımı',
          assigneeId: cto.id,
          creatorId: ceo.id,
          status: 'TODO',
          priority: 'URGENT',
        },
        {
          companyId: 'demo_company',
          title: 'Kullanıcı Araştırması Raporu',
          assigneeId: pm.id,
          creatorId: ceo.id,
          status: 'REVIEW',
          priority: 'MEDIUM',
        },
        {
          companyId: 'demo_company',
          title: 'Yeni Yazılımcı İşe Alım Süreci',
          assigneeId: hr.id,
          creatorId: ceo.id,
          status: 'IN_PROGRESS',
          priority: 'HIGH',
        },
      ],
    })

    return Response.json({
      success: true,
      message: 'Seed tamamlandı',
      employees: [ceo.name, cto.name, pm.name, hr.name],
    })
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    console.error('SEED ERROR:', msg, error instanceof Error ? error.stack : '')
    return Response.json({ success: false, error: 'seed failed' }, { status: 500 })
  }
}
