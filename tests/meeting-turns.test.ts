import { describe, expect, it } from 'vitest'
import { buildTurnPrompt, buildWrapUpPrompt, nextSpeaker, parseWrapUp } from '@/lib/meeting-turns'

describe('nextSpeaker', () => {
  it('goes round-robin by fewest turns, keeping participant order on ties', () => {
    const ids = ['a', 'b', 'c']
    const turns = new Map<string, number>()
    const order: string[] = []
    for (let i = 0; i < 6; i++) {
      const s = nextSpeaker(ids, turns)!
      order.push(s)
      turns.set(s, (turns.get(s) ?? 0) + 1)
    }
    expect(order).toEqual(['a', 'b', 'c', 'a', 'b', 'c'])
  })
  it('lets a participant who has spoken less go first', () => {
    expect(nextSpeaker(['a', 'b'], new Map([['a', 2]]))).toBe('b')
  })
  it('returns null once everyone reached the cap', () => {
    expect(nextSpeaker(['a', 'b'], new Map([['a', 3], ['b', 3]]))).toBeNull()
    expect(nextSpeaker([], new Map())).toBeNull()
  })
  it('respects a custom cap', () => {
    expect(nextSpeaker(['a'], new Map([['a', 1]]), 1)).toBeNull()
  })
})

describe('prompts', () => {
  it('fences meeting content as data and names the speaker', () => {
    const p = buildTurnPrompt({ title: 'Haftalık', agenda: null, transcript: [{ speaker: 'Ayşe', content: 'Merhaba' }], speaker: 'Mehmet' })
    expect(p).toContain('<toplanti>')
    expect(p).toContain('Ayşe: Merhaba')
    expect(p).toContain('Sıra sende, Mehmet')
    expect(p).toContain('(belirtilmedi)')
  })
  it('keeps only the latest messages and clips long ones', () => {
    const transcript = Array.from({ length: 50 }, (_, i) => ({ speaker: 'S', content: `m${i}` }))
    const p = buildWrapUpPrompt({ title: 't', agenda: 'a', transcript: [...transcript, { speaker: 'U', content: 'x'.repeat(5000) }] })
    expect(p).not.toContain('m0\n')
    expect(p).toContain('m25')
    expect(p).toContain('…')
    expect(p.length).toBeLessThan(5000)
  })
})

describe('parseWrapUp', () => {
  const people = [{ id: 'e1', name: 'Ayşe Demir' }, { id: 'e2', name: 'Mehmet Kaya' }]
  const text = `ÖZET:
Teklif süreci konuşuldu. Teknik şartname gecikiyor.
KARARLAR:
- Teklif cuma gönderilecek
- Şartname öne alınacak
AKSİYONLAR:
- Ayşe: ABC Şirketi'ne teklifi gönder
- Mehmet Kaya: Şartnameyi bitir
- Biri: sahipsiz iş`

  it('extracts summary, decisions and actions with assignees', () => {
    const w = parseWrapUp(text, people)
    expect(w.summary).toBe('Teklif süreci konuşuldu. Teknik şartname gecikiyor.')
    expect(w.decisions).toEqual(['Teklif cuma gönderilecek', 'Şartname öne alınacak'])
    expect(w.actions).toEqual([
      { content: "ABC Şirketi'ne teklifi gönder", assigneeId: 'e1' },
      { content: 'Şartnameyi bitir', assigneeId: 'e2' },
      { content: 'Biri: sahipsiz iş' },
    ])
  })
  it('handles bold headings and empty sections', () => {
    const w = parseWrapUp('**ÖZET:**\nKısa.\n**KARARLAR:**\n-\n**AKSİYONLAR:**\n-', people)
    expect(w).toEqual({ summary: 'Kısa.', decisions: [], actions: [] })
  })
  it('does not invent content from free text', () => {
    expect(parseWrapUp('rastgele metin', people)).toEqual({ summary: '', decisions: [], actions: [] })
  })
})
