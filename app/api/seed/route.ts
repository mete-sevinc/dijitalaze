import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export const dynamic = 'force-dynamic'

// One-time seed endpoint
export async function POST() {
  try {
    // Check if already seeded
    const existing = await prisma.company.findUnique({ where: { id: 'demo_company' } })
    if (existing) {
      const count = await prisma.employee.count({ where: { companyId: 'demo_company' } })
      return NextResponse.json({ success: true, message: 'Already seeded', employees: count })
    }

    // Create company with fixed ID
    await prisma.company.create({
      data: {
        id: 'demo_company',
        name: 'Demo Teknoloji A.Ş.',
        description: 'Kurumsal yazılım çözümleri sağlayan teknoloji firması',
      },
    })

    // Create employees
    const ceo = await prisma.employee.create({
      data: {
        companyId: 'demo_company',
        name: 'Murat Şahin',
        title: 'Genel Müdür / CEO',
        department: 'Yönetim',
        avatar: '👨‍💼',
        status: 'ACTIVE',
        personality: 'Stratejik düşünür, liderlik odaklı, veri driven karar verici',
        expertise: JSON.stringify(['Strateji', 'Liderlik', 'İş Geliştirme', 'Finansal Yönetim']),
        systemPrompt: 'Sen Demo Teknoloji şirketinin CEO\'susun. Stratejik kararlar alır, şirketi yönetirsin.',
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
        personality: 'Teknik derinlik, inovasyon odaklı, problem çözücü',
        expertise: JSON.stringify(['Yazılım Mimarisi', 'Cloud', 'AI/ML', 'DevOps']),
        systemPrompt: 'Sen Demo Teknoloji şirketinin CTO\'susun. Teknoloji kararları alır, teknik ekibi yönetirsin.',
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
        personality: 'Kullanıcı odaklı, analitik, çevik metodoloji uzmanı',
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
        expertise: JSON.stringify(['İşe Alım', 'Performans Yönetimi', 'Eğitim']),
        systemPrompt: 'Sen Demo Teknoloji şirketinin İK Müdürüsün.',
      },
    })

    // Add tasks
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
          dueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
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

    return NextResponse.json({
      success: true,
      message: 'Seed tamamlandı',
      employees: [ceo.name, cto.name, pm.name, hr.name],
    })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Seed hatası' },
      { status: 500 }
    )
  }
}
