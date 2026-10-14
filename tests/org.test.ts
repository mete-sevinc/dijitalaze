import { describe, expect, it } from 'vitest'
import { buildOrgTree, wouldCreateCycle, type OrgPerson } from '@/lib/org'

const p = (id: string, managerId: string | null = null, name = id): OrgPerson => ({ id, name, title: 't', department: 'd', avatar: null, status: 'ACTIVE', managerId })

describe('buildOrgTree', () => {
  it('nests reports under their manager and sorts by name', () => {
    const tree = buildOrgTree([p('c', 'a', 'Cem'), p('a', null, 'Ali'), p('b', 'a', 'Bora'), p('d', 'b', 'Deniz')])
    expect(tree.map((n) => n.id)).toEqual(['a'])
    expect(tree[0].reports.map((n) => n.id)).toEqual(['b', 'c'])
    expect(tree[0].reports[0].reports.map((n) => n.id)).toEqual(['d'])
  })
  it('treats a missing manager as a root instead of dropping the person', () => {
    expect(buildOrgTree([p('a', 'ghost')]).map((n) => n.id)).toEqual(['a'])
  })
  it('survives corrupt data: self-manager and a reporting loop never hide anyone or recurse forever', () => {
    const tree = buildOrgTree([p('a', 'a'), p('b', 'c'), p('c', 'b')])
    const ids: string[] = []
    const walk = (ns: typeof tree) => ns.forEach((n) => (ids.push(n.id), walk(n.reports)))
    walk(tree)
    expect(ids.sort()).toEqual(['a', 'b', 'c'])
  })
})

describe('wouldCreateCycle', () => {
  const people = [p('a'), p('b', 'a'), p('c', 'b')]
  it('rejects self and descendants as manager', () => {
    expect(wouldCreateCycle(people, 'a', 'a')).toBe(true)
    expect(wouldCreateCycle(people, 'a', 'c')).toBe(true)
    expect(wouldCreateCycle(people, 'b', 'c')).toBe(true)
  })
  it('allows unrelated or upward moves and clearing the manager', () => {
    expect(wouldCreateCycle(people, 'c', 'a')).toBe(false)
    expect(wouldCreateCycle(people, 'c', null)).toBe(false)
    expect(wouldCreateCycle([...people, p('x')], 'x', 'c')).toBe(false)
  })
  it('does not hang on an existing loop', () => {
    expect(wouldCreateCycle([p('a', 'b'), p('b', 'a'), p('z')], 'z', 'a')).toBe(false)
  })
})
