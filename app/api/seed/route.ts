export const dynamic = 'force-dynamic'

export async function POST() {
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
        personality: 'Stratejik düşünür, liderlik odaklı',
        expertise: JSON.stringify(['Strateji', 'Liderlik', 'İş Geliştirme']),
        systemPrompt: "Sen Demo Teknoloji şirketinin CEO'susun. Stratejik kararlar alır, şirketi yönetirsin.",
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
        personality: 'Teknik derinlik, inovasyon odaklı',
        expertise: JSON.stringify(['Yazılım Mimarisi', 'Cloud', 'AI/ML']),
        systemPrompt: "Sen Demo Teknoloji şirketinin CTO'susun. Teknoloji kararları alır.",
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
        personality: 'Kullanıcı odaklı, analitik',
        expertise: JSON.stringify(['Ürün Yönetimi', 'UX/UI', 'Agile']),
        systemPrompt: 'Sen Demo Teknoloji şirketinin Ürün Müdürüsün.',
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
        personality: 'Empati odaklı, organizasyon geliştirici',
        expertise: JSON.stringify(['İşe Alım', 'Performans Yönetimi']),
        systemPrompt: 'Sen Demo Teknoloji şirketinin İK Müdürüsün.',
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
    const stack = error instanceof Error ? error.stack : ''
    console.error('SEED ERROR:', msg, stack)
    return Response.json(
      { success: false, error: msg, stack },
      { status: 500 }
    )
  }
}
