import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

// One-time seed endpoint - remove after use
export async function POST() {
  try {
    // Clean existing data
    await prisma.auditLog.deleteMany()
    await prisma.approval.deleteMany()
    await prisma.meetingActionItem.deleteMany()
    await prisma.meetingMessage.deleteMany()
    await prisma.meetingParticipant.deleteMany()
    await prisma.meeting.deleteMany()
    await prisma.employeeReport.deleteMany()
    await prisma.task.deleteMany()
    await prisma.message.deleteMany()
    await prisma.conversation.deleteMany()
    await prisma.employeeMemory.deleteMany()
    await prisma.employeeInstruction.deleteMany()
    await prisma.employee.deleteMany()
    await prisma.companyMemory.deleteMany()
    await prisma.company.deleteMany()

    // Create company with fixed ID
    const company = await prisma.company.create({
      data: {
        id: 'demo_company',
        name: 'Demo Teknoloji A.Ş.',
        description: 'Kurumsal yazılım çözümleri sağlayan teknoloji firması',
      },
    })

    // Create employees
    const ceo = await prisma.employee.create({
      data: {
        companyId: company.id,
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
        companyId: company.id,
        name: 'Ayşe Kaya',
        title: 'CTO / Teknoloji Direktörü',
        department: 'Teknoloji',
        avatar: '👩‍💻',
        status: 'ACTIVE',
        personality: 'Teknik derinlik, inovasyon odaklı, problem çözücü',
        expertise: JSON.stringify(['Yazılım Mimarisi', 'Cloud', 'AI/ML', 'DevOps', 'Güvenlik']),
        systemPrompt: 'Sen Demo Teknoloji şirketinin CTO\'susun. Teknoloji kararları alır, teknik ekibi yönetirsin.',
      },
    })

    const pm = await prisma.employee.create({
      data: {
        companyId: company.id,
        name: 'Emre Demir',
        title: 'Ürün Müdürü',
        department: 'Ürün',
        avatar: '📊',
        status: 'ACTIVE',
        personality: 'Kullanıcı odaklı, analitik, çevik metodoloji uzmanı',
        expertise: JSON.stringify(['Ürün Yönetimi', 'UX/UI', 'Agile', 'Roadmap Planlama']),
        systemPrompt: 'Sen Demo Teknoloji şirketinin Ürün Müdürüsün. Ürün stratejisi ve roadmap\'i yönetirsin.',
      },
    })

    const hr = await prisma.employee.create({
      data: {
        companyId: company.id,
        name: 'Fatma Yıldız',
        title: 'İK Müdürü',
        department: 'İnsan Kaynakları',
        avatar: '🤝',
        status: 'ACTIVE',
        personality: 'Empati odaklı, organizasyon geliştirici, kültür oluşturucu',
        expertise: JSON.stringify(['İşe Alım', 'Performans Yönetimi', 'Eğitim', 'Organizasyon Tasarımı']),
        systemPrompt: 'Sen Demo Teknoloji şirketinin İK Müdürüsün. İnsan kaynakları süreçlerini yönetirsin.',
      },
    })

    // Add some tasks
    await prisma.task.createMany({
      data: [
        {
          companyId: company.id,
          title: 'Q4 Strateji Toplantısı Hazırlığı',
          description: 'Yıl sonu strateji toplantısı için sunum ve raporları hazırla',
          assigneeId: ceo.id,
          creatorId: ceo.id,
          status: 'IN_PROGRESS',
          priority: 'HIGH',
          dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        },
        {
          companyId: company.id,
          title: 'Yeni Mikroservis Mimarisi Tasarımı',
          description: 'Mevcut monolitik yapıyı mikroservislere geçiş planı',
          assigneeId: cto.id,
          creatorId: ceo.id,
          status: 'TODO',
          priority: 'URGENT',
          dueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
        },
        {
          companyId: company.id,
          title: 'Kullanıcı Araştırması Raporu',
          description: 'Yeni özellikler için kullanıcı ihtiyaç analizi',
          assigneeId: pm.id,
          creatorId: ceo.id,
          status: 'REVIEW',
          priority: 'MEDIUM',
        },
        {
          companyId: company.id,
          title: 'Yeni Yazılımcı İşe Alım Süreci',
          description: '3 senior yazılımcı pozisyonu için işe alım sürecini başlat',
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
