import { PrismaClient } from '@prisma/client'

const EmployeeStatus = { ACTIVE: 'ACTIVE', PAUSED: 'PAUSED', ARCHIVED: 'ARCHIVED' } as const
const InstructionPriority = { LOW: 'LOW', NORMAL: 'NORMAL', HIGH: 'HIGH', CRITICAL: 'CRITICAL' } as const
const MemoryType = { FACT: 'FACT', PREFERENCE: 'PREFERENCE', DECISION: 'DECISION', CUSTOMER: 'CUSTOMER', PROCESS: 'PROCESS', LESSON: 'LESSON', GOAL: 'GOAL', OTHER: 'OTHER' } as const
const TaskStatus = { TODO: 'TODO', IN_PROGRESS: 'IN_PROGRESS', BLOCKED: 'BLOCKED', REVIEW: 'REVIEW', DONE: 'DONE', CANCELLED: 'CANCELLED' } as const
const TaskPriority = { LOW: 'LOW', MEDIUM: 'MEDIUM', HIGH: 'HIGH', URGENT: 'URGENT' } as const

const prisma = new PrismaClient()

async function main() {
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
  await prisma.user.deleteMany()

  // Create company
  const company = await prisma.company.create({
    data: {
      name: "Demo Teknoloji A.Ş.",
      description: "Kurumsal yazılım çözümleri sağlayan teknoloji firması"
    }
  })

  // Create CEO/General Manager
  const ceo = await prisma.employee.create({
    data: {
      companyId: company.id,
      name: "Murat Şahin",
      title: "Genel Müdür / CEO",
      department: "Yönetim",
      avatar: "👨‍💼",
      description: "Şirketi yönetir, stratejik kararlar alır",
      systemRole: "CEO",
      responsibilities: "Şirket stratejisi, büyük kararlar, kilit müşteriler",
      objectives: "Şirket gelirini 2 katına çıkarmak, yeni pazarlara girmek",
      kpis: "Toplam gelir, müşteri memnuniyeti, çalışan verimliliği",
      dailyRoutine: "08:00 E-posta kontrolü\n09:30 Yönetim toplantısı\n14:00 Müşteri görüşmeleri\n17:00 Günlük rapor",
      weeklyRoutine: "Pazartesi: Haftalık planlama\nPerşembe: Yönetim kurulu toplantısı",
      communicationStyle: "Resmi, karar odaklı, özlü",
      decisionRules: "10.000 EUR üzeri satışlarda CEO onayı gerekir",
      escalationRules: "Tüm riskler CEO'ye bildirilir",
      permissions: JSON.stringify(["ALL"]),
      status: EmployeeStatus.ACTIVE
    }
  })

  // Create Sales Manager
  const salesManager = await prisma.employee.create({
    data: {
      companyId: company.id,
      name: "Ayşe Demir",
      title: "Satış Müdürü",
      department: "Satış",
      avatar: "👩‍💼",
      description: "Satış ekibini yönetir, büyük müşterilerle çalışır",
      systemRole: "Sales Manager",
      managerId: ceo.id,
      responsibilities: "Satış hedefleri, müşteri ilişkileri, teklif yönetimi",
      objectives: "Aylık satış hedefini %120 ile kapatmak, yeni müşteriler kazanmak",
      kpis: "Satış hacmi, müşteri kazanımı, teklif başarı oranı",
      dailyRoutine: "08:30 Yeni müşteri e-postaları\n09:00 Aktif fırsatlar gözden geçir\n11:00 Geciken teklifler takip\n16:30 Günlük rapor hazırla",
      weeklyRoutine: "Pazartesi: Haftalık satış planı\nCuma: Haftalık rapor sunumu",
      communicationStyle: "Profesyonel, müşteri odaklı, sonuç driven",
      decisionRules: "%20 marjın altındaki teklifler CEO onayı gerekir",
      escalationRules: "Kayıp müşteri veya geciken teklif için derhal biller",
      permissions: JSON.stringify(["CAN_READ_SALES_PIPELINE", "CAN_ASSIGN_SALES_TASKS", "CAN_CREATE_REPORTS"]),
      status: EmployeeStatus.ACTIVE
    }
  })

  // Create Sales Engineer
  const salesEngineer = await prisma.employee.create({
    data: {
      companyId: company.id,
      name: "Mehmet Kaya",
      title: "Satış Mühendisi",
      department: "Satış",
      avatar: "👨‍💻",
      description: "Teknik şartnameleri hazırlar, çözüm tasarımı yapar",
      systemRole: "Sales Engineer",
      managerId: salesManager.id,
      responsibilities: "Teknik şartname hazırlama, çözüm tasarımı, teknik destek",
      objectives: "Teklif başarı oranını artırmak, müşteri tatminini maksimize etmek",
      kpis: "Teklif başarı oranı, müşteri memnuniyeti, teknik sorun çözüm süresi",
      dailyRoutine: "09:00 Yeni şartname istekleri\n10:00 Çözüm tasarımı\n13:00 Teknik görüşmeler\n17:00 Rapor hazırla",
      weeklyRoutine: "Pazartesi: Yeni teknolojiler incelemesi\nPerşembe: Ekip toplantısı",
      communicationStyle: "Teknik, detaylı, açık",
      decisionRules: "Teknik çözümlerde kendi kararı verebilir",
      escalationRules: "Teknik zorluklar Satış Müdürü'ne bildir",
      permissions: JSON.stringify(["CAN_READ_CUSTOMERS", "CAN_CREATE_TASKS", "CAN_CREATE_REPORTS"]),
      status: EmployeeStatus.ACTIVE
    }
  })

  // Create Finance Manager
  const financeManager = await prisma.employee.create({
    data: {
      companyId: company.id,
      name: "Elif Yılmaz",
      title: "Finans & Muhasebe",
      department: "Finans",
      avatar: "👩‍🔬",
      description: "Mali işleri yönetir, raporlar hazırlar",
      systemRole: "Finance Manager",
      managerId: ceo.id,
      responsibilities: "Finansal raporlama, hazine yönetimi, risk yönetimi",
      objectives: "Nakit akışını optimize etmek, maliyetleri kontrol etmek",
      kpis: "Marj oranı, tahsilat oranı, nakit akışı",
      dailyRoutine: "09:00 Faturalandırma kontrol\n11:00 Nakit akışı gözden geçir\n14:00 Masraflar analiz\n16:00 Rapor hazırla",
      weeklyRoutine: "Pazartesi: Haftalık finansal rapor\nCuma: Ödeme planı gözden geçir",
      communicationStyle: "Detaylı, analitik, kesin",
      decisionRules: "50.000 EUR üzeri harcamalarda CEO onayı gerekir",
      escalationRules: "Nakit sorunları derhal biller",
      permissions: JSON.stringify(["CAN_READ_FINANCIAL_DATA", "CAN_CREATE_FINANCE_REPORTS"]),
      status: EmployeeStatus.ACTIVE
    }
  })

  // Create Marketing Manager
  const marketingManager = await prisma.employee.create({
    data: {
      companyId: company.id,
      name: "Zeynep Aydın",
      title: "Pazarlama Müdürü",
      department: "Pazarlama",
      avatar: "👩‍🎨",
      description: "Pazarlama stratejisini uygular, kampanyaları yönetir",
      systemRole: "Marketing Manager",
      managerId: ceo.id,
      responsibilities: "Pazarlama kampanyaları, marka yönetimi, içerik üretimi",
      objectives: "Marka bilinirliğini artırmak, satışlara destek olmak",
      kpis: "Web site trafiği, kampanya dönüşüm oranı, marka bilinirliği",
      dailyRoutine: "08:30 Sosyal medya gözden geçir\n10:00 İçerik planlama\n13:00 Kampanya performansı analiz\n15:30 Rapor hazırla",
      weeklyRoutine: "Pazartesi: Haftalık kampanya planı\nPerşembe: Kreatif toplantı",
      communicationStyle: "Yaratıcı, etkili, veri driven",
      decisionRules: "Kampanya bütçesini esnek yönetir",
      escalationRules: "Brandı etkileyen sorunlar CEO'ye bildir",
      permissions: JSON.stringify(["CAN_CREATE_MARKETING_CONTENT", "CAN_CREATE_REPORTS"]),
      status: EmployeeStatus.ACTIVE
    }
  })

  // Create Operations Manager
  const operationsManager = await prisma.employee.create({
    data: {
      companyId: company.id,
      name: "Can Özkan",
      title: "Operasyon Müdürü",
      department: "Operasyon",
      avatar: "👨‍⚙️",
      description: "İş süreçlerini optimize eder, proje yönetimi yapar",
      systemRole: "Operations Manager",
      managerId: ceo.id,
      responsibilities: "Proje yönetimi, süreç iyileştirme, kalite kontrol",
      objectives: "Proje kapanış oranını artırmak, müşteri memnuniyetini maksimize etmek",
      kpis: "Proje başarı oranı, proje tamamlama süresi, müşteri tatmini",
      dailyRoutine: "08:30 Proje durumu kontrol\n09:30 Risk yönetimi\n13:00 Ekip koordinasyonu\n16:00 Rapor hazırla",
      weeklyRoutine: "Pazartesi: Haftalık proje revizyonu\nPerşembe: Kalite kontrol",
      communicationStyle: "Düzenli, prosedür odaklı, detaylı",
      decisionRules: "Proje değişiklikleri Satış ve CEO onayı gerekir",
      escalationRules: "Proje riskleri derhal bildir",
      permissions: JSON.stringify(["CAN_MANAGE_PROJECTS", "CAN_UPDATE_PROJECT_STATUS", "CAN_CREATE_REPORTS"]),
      status: EmployeeStatus.ACTIVE
    }
  })

  // Add instructions for each employee
  const instructionsData = [
    {
      employeeId: ceo.id,
      content: "Tüm riskler ve kararlar sana bildirilmelidir. Hızlı karar ver.",
      priority: InstructionPriority.CRITICAL
    },
    {
      employeeId: ceo.id,
      content: "10.000 EUR üzeri satışlarda mutlaka onay ver.",
      priority: InstructionPriority.HIGH
    },
    {
      employeeId: salesManager.id,
      content: "Tekliflerde %20'nin altında brüt marj varsa CEO onayı istet.",
      priority: InstructionPriority.CRITICAL
    },
    {
      employeeId: salesManager.id,
      content: "Müşteri e-postalarında profesyonel ve kısa iletişim kullan.",
      priority: InstructionPriority.NORMAL
    },
    {
      employeeId: salesManager.id,
      content: "Geciken teklifler için 2 gün içerisinde müşteri ile temas kur.",
      priority: InstructionPriority.HIGH
    },
    {
      employeeId: salesEngineer.id,
      content: "Teknik şartnameleri 48 saat içinde hazırla.",
      priority: InstructionPriority.HIGH
    },
    {
      employeeId: salesEngineer.id,
      content: "Müşteri görüşmelerinden sonra detaylı notlar al.",
      priority: InstructionPriority.NORMAL
    },
    {
      employeeId: financeManager.id,
      content: "Nakit akışı sorunlarını derhal CEO'ye bildir.",
      priority: InstructionPriority.CRITICAL
    },
    {
      employeeId: financeManager.id,
      content: "Her hafta Pazartesi günü finansal rapor hazırla.",
      priority: InstructionPriority.HIGH
    },
    {
      employeeId: marketingManager.id,
      content: "Kampanya performans metrikleri günlük takip et.",
      priority: InstructionPriority.NORMAL
    },
    {
      employeeId: operationsManager.id,
      content: "Proje riskleri haftalık CEO'ye bildir.",
      priority: InstructionPriority.HIGH
    }
  ]

  for (const instr of instructionsData) {
    await prisma.employeeInstruction.create({
      data: instr
    })
  }

  // Add memories for employees
  const memoriesData = [
    {
      employeeId: salesManager.id,
      type: MemoryType.CUSTOMER,
      content: "ABC Şirketi: 100.000 EUR satın alma bütçesi, Pazarlama Müdürü ile çalış",
      importance: 3,
      tags: JSON.stringify(["key_customer", "high_value"])
    },
    {
      employeeId: salesManager.id,
      type: MemoryType.CUSTOMER,
      content: "XYZ Ltd: 3 aylık teklif bekleme sürecinde, Pazartesi konuşma planla",
      importance: 2,
      tags: JSON.stringify(["pending_deal"])
    },
    {
      employeeId: salesManager.id,
      type: MemoryType.DECISION,
      content: "Delta Müşteri: %20 indirim var, daha düşük olamaz",
      importance: 2,
      tags: JSON.stringify(["pricing"])
    },
    {
      employeeId: financeManager.id,
      type: MemoryType.FACT,
      content: "Aylık operasyonel masraf: 15.000 EUR",
      importance: 3,
      tags: JSON.stringify(["budget", "monthly"])
    },
    {
      employeeId: financeManager.id,
      type: MemoryType.PROCESS,
      content: "Yeni müşteri onboarding'de %30 peşin ödeme gerekir",
      importance: 3,
      tags: JSON.stringify(["payment_policy"])
    }
  ]

  for (const mem of memoriesData) {
    await prisma.employeeMemory.create({
      data: mem
    })
  }

  // Add company memory
  const companyMemories = [
    {
      companyId: company.id,
      type: "STRATEGY",
      content: "Şirket stratejisi: B2B SaaS pazarında liderlik, aylık 50.000 EUR gelir hedefi",
      importance: 3,
      tags: JSON.stringify(["strategy"])
    },
    {
      companyId: company.id,
      type: "POLICY",
      content: "Fiyatlandırma politikası: Temel fiyattan %15 indirim maksimum",
      importance: 3,
      tags: JSON.stringify(["pricing"])
    },
    {
      companyId: company.id,
      type: "PROCESS",
      content: "Satış süreci: Şartname -> Teknik tasarım -> Teklif -> Müşteri onayı -> Kontrat",
      importance: 2,
      tags: JSON.stringify(["sales_process"])
    }
  ]

  for (const mem of companyMemories) {
    await prisma.companyMemory.create({
      data: mem
    })
  }

  // Create sample tasks
  await prisma.task.create({
    data: {
      companyId: company.id,
      title: "ABC Şirketi'ne teklif gönder",
      description: "ABC Şirketi'ne 100.000 EUR için hazırlanmış teklif gönder",
      assigneeId: salesManager.id,
      creatorId: ceo.id,
      status: TaskStatus.IN_PROGRESS,
      priority: TaskPriority.URGENT,
      dueDate: new Date(Date.now() + 24 * 60 * 60 * 1000) // Tomorrow
    }
  })

  await prisma.task.create({
    data: {
      companyId: company.id,
      title: "XYZ Müşteri takip et",
      description: "XYZ Müşteri'nin 3 aylık teklifi konusunda takip et",
      assigneeId: salesManager.id,
      creatorId: ceo.id,
      status: TaskStatus.TODO,
      priority: TaskPriority.HIGH,
      dueDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000)
    }
  })

  await prisma.task.create({
    data: {
      companyId: company.id,
      title: "Teknik şartname hazırla",
      description: "ABC Şirketi için teknik şartname ve çözüm tasarımı",
      assigneeId: salesEngineer.id,
      creatorId: salesManager.id,
      status: TaskStatus.IN_PROGRESS,
      priority: TaskPriority.HIGH,
      dueDate: new Date(Date.now() + 48 * 60 * 60 * 1000)
    }
  })

  // Create a sample conversation
  const conversation = await prisma.conversation.create({
    data: {
      employeeId: salesManager.id,
      companyId: company.id,
      title: "ABC Teklifinin Gözden Geçirilmesi"
    }
  })

  await prisma.message.create({
    data: {
      conversationId: conversation.id,
      role: "USER" as const,
      content: "ABC Şirketi'nin teklifi hazır mı?"
    }
  })

  // Create sample employee report
  await prisma.employeeReport.create({
    data: {
      employeeId: salesManager.id,
      companyId: company.id,
      type: "DAILY",
      periodStart: new Date(),
      periodEnd: new Date(),
      summary: "3 müşteri ile görüşme yapıldı, 2 teklif gönderildi",
      completedTasks: JSON.stringify(["2 müşteri görüşmesi", "1 teklif hazırlandı"]),
      activeTasks: JSON.stringify(["ABC teklifi", "XYZ takip"]),
      blockedTasks: JSON.stringify([]),
      risks: JSON.stringify(["ABC teklifi gecikmesi riski"]),
      recommendations: JSON.stringify(["ABC ile Pazartesi görüşme planla"]),
      nextPriorities: JSON.stringify(["ABC teklifi gönder", "XYZ müşteri takip et"])
    }
  })

  console.log("✅ Seed data created successfully!")
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
