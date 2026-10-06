import Anthropic from '@anthropic-ai/sdk'
import { z } from 'zod'
import { prisma } from '@/lib/db'

const MAX_TOOL_ROUNDS = 6
const HISTORY_LIMIT = 30

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

const tools: Anthropic.Tool[] = [
  {
    name: 'add_task',
    description:
      'İş/görev veya hatırlatma ekler. Kullanıcı bir zamanda hatırlatılmak istiyorsa remind_at ver. Son tarih varsa due_at ver.',
    input_schema: {
      type: 'object',
      properties: {
        title: { type: 'string' },
        due_at: { type: 'string', description: 'ISO 8601, saat dilimi ofsetli (+03:00)' },
        remind_at: { type: 'string', description: 'ISO 8601, saat dilimi ofsetli (+03:00)' },
      },
      required: ['title'],
    },
  },
  {
    name: 'list_tasks',
    description: 'Görevleri ve hatırlatmaları listeler. Varsayılan: sadece tamamlanmamışlar.',
    input_schema: { type: 'object', properties: { include_done: { type: 'boolean' } } },
  },
  {
    name: 'complete_task',
    description: 'Görevi tamamlandı olarak işaretler. id list_tasks sonucundan alınır.',
    input_schema: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] },
  },
  {
    name: 'add_note',
    description: 'Kullanıcının notunu kaydeder.',
    input_schema: { type: 'object', properties: { content: { type: 'string' } }, required: ['content'] },
  },
  {
    name: 'list_notes',
    description: 'Notları listeler; query verilirse içinde arar. En yeni 20 not döner.',
    input_schema: { type: 'object', properties: { query: { type: 'string' } } },
  },
]

function istanbulNow(): string {
  const d = new Date()
  const text = new Intl.DateTimeFormat('tr-TR', {
    timeZone: 'Europe/Istanbul',
    dateStyle: 'full',
    timeStyle: 'short',
  }).format(d)
  return `${text} (Europe/Istanbul, UTC+03:00)`
}

function systemPrompt(): string {
  return `Sen Mete'nin kişisel asistanısın. Türkçe, kısa ve net yaz.
Görevlerin: günlük işlerini takip etmek, hatırlatma kurmak, notlarını saklamak ve planlarını özetlemek.
Şu an: ${istanbulNow()}. Göreli zamanları ("yarın 10'da", "2 saat sonra") bu saate göre hesapla ve araçlara +03:00 ofsetli ISO 8601 ver.
Kayıt/silme/tamamlama gibi işlemleri yalnızca araçlarla yap; araç çalışmadan "yaptım" deme.
Tarih/saat belirsizse tahmin etme, tek kısa soru sor.`
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
    default:
      throw new Error(`Bilinmeyen araç: ${name}`)
  }
}

export async function chatWithAssistant(owner: string, userText: string): Promise<string> {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  const model = process.env.ANTHROPIC_MODEL || 'claude-sonnet-5-5'

  const past = await prisma.assistantMessage.findMany({
    where: { ownerEmail: owner },
    orderBy: { createdAt: 'desc' },
    take: HISTORY_LIMIT,
  })
  const messages: Anthropic.MessageParam[] = past
    .reverse()
    .map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content }))
  messages.push({ role: 'user', content: userText })

  let reply = ''
  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    const res = await client.messages.create({
      model,
      max_tokens: 1500,
      system: systemPrompt(),
      tools,
      messages,
    })
    reply = res.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('')
    if (res.stop_reason !== 'tool_use') break

    messages.push({ role: 'assistant', content: res.content })
    const results: Anthropic.ToolResultBlockParam[] = []
    for (const block of res.content) {
      if (block.type !== 'tool_use') continue
      try {
        const out = await runTool(owner, block.name, block.input)
        results.push({ type: 'tool_result', tool_use_id: block.id, content: JSON.stringify(out) })
      } catch (e) {
        results.push({
          type: 'tool_result',
          tool_use_id: block.id,
          is_error: true,
          content: e instanceof Error ? e.message : 'Araç hatası',
        })
      }
    }
    messages.push({ role: 'user', content: results })
  }

  reply = reply || 'Bir yanıt üretemedim, tekrar dener misin?'
  await prisma.assistantMessage.createMany({
    data: [
      { ownerEmail: owner, role: 'user', content: userText },
      { ownerEmail: owner, role: 'assistant', content: reply },
    ],
  })
  return reply
}
