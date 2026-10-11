import { z } from 'zod'
import { prisma } from '@/lib/db'
import { runAgent, ToolSpec } from '@/lib/ai/agent-loop'
import { assignTaskToEmployee } from '@/lib/agents/work'

const HISTORY_LIMIT = 20
const MEMORY_LIMIT = 40

const isoDate = z.string().datetime({ offset: true })

const addTaskInput = z.object({
  title: z.string().min(1).max(300),
  due_at: isoDate.optional(),
  remind_at: isoDate.optional(),
})
const listTasksInput = z.object({ include_done: z.boolean().optional() })
const completeTaskInput = z.object({ id: z.string().min(1) })
const addNoteInput = z.object({ content: z.string().min(1).max(5000) })
const listNotesInput = z.object({ query: z.string().max(200).optional() })
const rememberInput = z.object({
  content: z.string().trim().min(1).max(500),
  kind: z.enum(['fact', 'preference', 'routine', 'person']).default('fact'),
})
const forgetInput = z.object({ id: z.string().min(1) })
const assignInput = z.object({
  employee_id: z.string().min(1),
  title: z.string().trim().min(1).max(300),
  description: z.string().max(4000).optional(),
  due_at: isoDate.optional(),
})
const createEmployeeInput = z.object({
  name: z.string().trim().min(1).max(100),
  title: z.string().trim().min(1).max(100),
  department: z.string().trim().min(1).max(100),
  responsibilities: z.string().max(2000).optional(),
})

const str = (description?: string) => ({ type: 'string', ...(description ? { description } : {}) })

const tools: ToolSpec[] = [
  {
    name: 'add_task',
    description:
      'Sahibin kendi işini/hatırlatmasını ekler. Bir zamanda hatırlatılmak istiyorsa remind_at ver. Son tarih varsa due_at ver. (Personele iş vermek için assign_task_to_employee kullan.)',
    inputSchema: {
      type: 'object',
      properties: {
        title: str(),
        due_at: str('ISO 8601, saat dilimi ofsetli (+03:00)'),
        remind_at: str('ISO 8601, saat dilimi ofsetli (+03:00)'),
      },
      required: ['title'],
    },
  },
  {
    name: 'list_tasks',
    description: 'Sahibin görevlerini ve hatırlatmalarını listeler. Varsayılan: sadece tamamlanmamışlar.',
    inputSchema: { type: 'object', properties: { include_done: { type: 'boolean' } }, required: [] },
  },
  {
    name: 'complete_task',
    description: 'Görevi tamamlandı olarak işaretler. id list_tasks sonucundan alınır.',
    inputSchema: { type: 'object', properties: { id: str() }, required: ['id'] },
  },
  {
    name: 'add_note',
    description: 'Kullanıcının notunu kaydeder.',
    inputSchema: { type: 'object', properties: { content: str() }, required: ['content'] },
  },
  {
    name: 'list_notes',
    description: 'Notları listeler; query verilirse içinde arar. En yeni 20 not döner.',
    inputSchema: { type: 'object', properties: { query: str() }, required: [] },
  },
  {
    name: 'remember',
    description:
      'Sahibi hakkında kalıcı bir bilgiyi, tercihi, rutini ya da kişiyi hafızana kaydeder. Sahibi böyle bir şey söylediğinde sormadan kaydet. Tek seferlik işleri kaydetme (onlar için add_task).',
    inputSchema: {
      type: 'object',
      properties: {
        content: str('Kısa, tek cümlelik bilgi'),
        kind: { type: 'string', enum: ['fact', 'preference', 'routine', 'person'] },
      },
      required: ['content'],
    },
  },
  {
    name: 'forget',
    description: 'Hafızandaki bir kaydı siler (yanlış ya da eskimiş bilgi). id, hafıza listesinde köşeli parantez içindedir.',
    inputSchema: { type: 'object', properties: { id: str() }, required: ['id'] },
  },
  {
    name: 'list_employees',
    description: 'Tanımlı personeli (dijital çalışanları) listeler: id, ad, unvan, bölüm.',
    inputSchema: { type: 'object', properties: {}, required: [] },
  },
  {
    name: 'assign_task_to_employee',
    description:
      'Bir personele iş verir. Personel işi arka planda yapar ve sonucu sahibinin incelemesine sunar (Görevler sayfası). Çalışan id list_employees sonucundan alınır.',
    inputSchema: {
      type: 'object',
      properties: {
        employee_id: str(),
        title: str('İşin kısa başlığı'),
        description: str('Ayrıntılar, beklenen çıktı'),
        due_at: str('ISO 8601, saat dilimi ofsetli (+03:00)'),
      },
      required: ['employee_id', 'title'],
    },
  },
  {
    name: 'create_employee',
    description: 'Yeni bir personel (dijital çalışan) tanımlar. Önce list_employees ile aynı isimde biri olmadığını kontrol et.',
    inputSchema: {
      type: 'object',
      properties: {
        name: str(),
        title: str('Unvan, örn. Satış Uzmanı'),
        department: str('Bölüm, örn. Satış'),
        responsibilities: str('Sorumlulukları'),
      },
      required: ['name', 'title', 'department'],
    },
  },
]

const MUTATING_TOOLS = new Set(['add_task', 'complete_task', 'add_note', 'remember', 'forget', 'assign_task_to_employee', 'create_employee'])

function istanbulNow(): string {
  const text = new Intl.DateTimeFormat('tr-TR', {
    timeZone: 'Europe/Istanbul',
    dateStyle: 'full',
    timeStyle: 'short',
  }).format(new Date())
  return `${text} (Europe/Istanbul, UTC+03:00)`
}

async function systemPrompt(owner: string): Promise<string> {
  const memories = await prisma.assistantMemory.findMany({
    where: { ownerEmail: owner },
    orderBy: { createdAt: 'desc' },
    take: MEMORY_LIMIT,
  })
  const memoryBlock = memories.length
    ? memories.map((m) => `- [${m.id}] (${m.kind}) ${m.content}`).join('\n')
    : '(henüz kayıt yok)'
  return `Sen Mete'nin kişisel asistanısın. Türkçe, kısa ve net yaz.
Görevlerin: günlük işlerini takip etmek, hatırlatma kurmak, notlarını saklamak, planlarını özetlemek ve personele iş vermek.
Şu an: ${istanbulNow()}. Göreli zamanları ("yarın 10'da", "2 saat sonra") bu saate göre hesapla ve araçlara +03:00 ofsetli ISO 8601 ver.
Kayıt/silme/tamamlama/iş verme gibi işlemleri yalnızca araçlarla yap; araç çalışmadan "yaptım" deme.
Tarih/saat belirsizse tahmin etme, tek kısa soru sor.

Öğrenme: Sahibinin kalıcı tercihlerini, rutinlerini, çevresindeki kişileri ve işiyle ilgili sabit bilgileri fark ettiğinde remember ile kaydet. Aşağıdaki hafızayı kullanarak kişiselleştir; yanlış/eskimiş kayıt görürsen forget ile sil.
Personel: Sahibi bir personele iş vermek isterse önce list_employees ile doğru kişiyi bul, sonra assign_task_to_employee kullan. Personel işi arka planda yapar; sonuç Görevler sayfasında sahibinin onayına düşer, sen sonucu uydurma.

Hafıza:
${memoryBlock}`
}

async function getCompanyId(): Promise<string> {
  const company = await prisma.company.findFirstOrThrow({ orderBy: { createdAt: 'asc' }, select: { id: true } })
  return company.id
}

function fmt(d: Date | null): string | null {
  return d ? d.toISOString() : null
}

async function runTool(owner: string, name: string, input: unknown): Promise<unknown> {
  switch (name) {
    case 'add_task': {
      const p = addTaskInput.parse(input)
      const t = await prisma.assistantTask.create({
        data: {
          ownerEmail: owner,
          title: p.title,
          dueAt: p.due_at ? new Date(p.due_at) : null,
          remindAt: p.remind_at ? new Date(p.remind_at) : null,
        },
      })
      return { id: t.id, title: t.title, dueAt: fmt(t.dueAt), remindAt: fmt(t.remindAt) }
    }
    case 'list_tasks': {
      const p = listTasksInput.parse(input)
      const rows = await prisma.assistantTask.findMany({
        where: { ownerEmail: owner, ...(p.include_done ? {} : { doneAt: null }) },
        orderBy: [{ dueAt: 'asc' }, { createdAt: 'desc' }],
        take: 50,
      })
      return rows.map((t) => ({
        id: t.id,
        title: t.title,
        dueAt: fmt(t.dueAt),
        remindAt: fmt(t.remindAt),
        done: !!t.doneAt,
      }))
    }
    case 'complete_task': {
      const p = completeTaskInput.parse(input)
      const r = await prisma.assistantTask.updateMany({
        where: { id: p.id, ownerEmail: owner, doneAt: null },
        data: { doneAt: new Date() },
      })
      return { updated: r.count }
    }
    case 'add_note': {
      const p = addNoteInput.parse(input)
      const n = await prisma.assistantNote.create({ data: { ownerEmail: owner, content: p.content } })
      return { id: n.id }
    }
    case 'list_notes': {
      const p = listNotesInput.parse(input)
      const rows = await prisma.assistantNote.findMany({
        where: {
          ownerEmail: owner,
          ...(p.query ? { content: { contains: p.query, mode: 'insensitive' } } : {}),
        },
        orderBy: { createdAt: 'desc' },
        take: 20,
      })
      return rows.map((n) => ({ id: n.id, content: n.content, createdAt: n.createdAt.toISOString() }))
    }
    case 'remember': {
      const p = rememberInput.parse(input)
      const existing = await prisma.assistantMemory.findFirst({ where: { ownerEmail: owner, content: p.content } })
      if (existing) return { id: existing.id, duplicate: true }
      const m = await prisma.assistantMemory.create({ data: { ownerEmail: owner, content: p.content, kind: p.kind } })
      return { id: m.id }
    }
    case 'forget': {
      const p = forgetInput.parse(input)
      const r = await prisma.assistantMemory.deleteMany({ where: { id: p.id, ownerEmail: owner } })
      return { deleted: r.count }
    }
    case 'list_employees': {
      const companyId = await getCompanyId()
      const rows = await prisma.employee.findMany({
        where: { companyId, status: 'ACTIVE' },
        orderBy: { name: 'asc' },
        select: { id: true, name: true, title: true, department: true },
      })
      return rows
    }
    case 'assign_task_to_employee': {
      const p = assignInput.parse(input)
      const companyId = await getCompanyId()
      const emp = await prisma.employee.findFirst({ where: { id: p.employee_id, companyId, status: 'ACTIVE' } })
      if (!emp) throw new Error('Çalışan bulunamadı')
      const taskId = await assignTaskToEmployee({
        employeeId: emp.id,
        title: p.title,
        description: p.description,
        dueDate: p.due_at ? new Date(p.due_at) : undefined,
      })
      return { taskId, employee: emp.name, status: 'Arka planda çalışıyor; sonuç Görevler sayfasında incelemeye düşecek' }
    }
    case 'create_employee': {
      const p = createEmployeeInput.parse(input)
      const companyId = await getCompanyId()
      const dup = await prisma.employee.findFirst({
        where: { companyId, name: { contains: p.name.split(' ')[0], mode: 'insensitive' } },
        select: { id: true, name: true, title: true },
      })
      if (dup) throw new Error(`Benzer isimde personel zaten var: ${dup.name} (${dup.title}), id ${dup.id}. Yeni oluşturma, onu kullan.`)
      const emp = await prisma.employee.create({
        data: {
          companyId,
          name: p.name,
          title: p.title,
          department: p.department,
          responsibilities: p.responsibilities,
          permissions: JSON.stringify(['CAN_UPDATE_TASKS']),
        },
      })
      await prisma.auditLog.create({
        data: { companyId, action: 'EMPLOYEE_CREATED', entityType: 'Employee', entityId: emp.id, changes: JSON.stringify(p) },
      })
      return { id: emp.id, name: emp.name }
    }
    default:
      throw new Error(`Bilinmeyen araç: ${name}`)
  }
}

export async function chatWithAssistant(owner: string, userText: string): Promise<string> {
  const past = await prisma.assistantMessage.findMany({
    where: { ownerEmail: owner },
    orderBy: { createdAt: 'desc' },
    take: HISTORY_LIMIT,
  })

  let mutated = false
  let reply = await runAgent({
    system: await systemPrompt(owner),
    history: past.reverse(),
    userText,
    tools,
    run: async (name, args) => {
      const out = await runTool(owner, name, args)
      if (MUTATING_TOOLS.has(name)) mutated = true
      return out
    },
    hasSideEffects: () => mutated,
  })

  reply = reply || 'Bir yanıt üretemedim, tekrar dener misin?'
  // Aynı createdAt sıralamayı belirsiz yapmasın diye yanıt 1 ms sonraya yazılır.
  const now = Date.now()
  await prisma.assistantMessage.createMany({
    data: [
      { ownerEmail: owner, role: 'user', content: userText, createdAt: new Date(now) },
      { ownerEmail: owner, role: 'assistant', content: reply, createdAt: new Date(now + 1) },
    ],
  })
  return reply
}
