// Pure org-chart helpers: build the reporting tree and guard against reporting cycles.

export interface OrgPerson {
  id: string
  name: string
  title: string
  department: string
  avatar: string | null
  status: string
  managerId: string | null
}
export interface OrgNode extends OrgPerson {
  reports: OrgNode[]
}

// Roots are people without a manager or whose manager is not in the list. Cycle-safe, sorted by name.
export function buildOrgTree(people: OrgPerson[]): OrgNode[] {
  const byId = new Map(people.map((p) => [p.id, p]))
  const children = new Map<string, OrgPerson[]>()
  const roots: OrgPerson[] = []
  for (const p of people) {
    if (p.managerId && p.managerId !== p.id && byId.has(p.managerId)) {
      children.set(p.managerId, [...(children.get(p.managerId) ?? []), p])
    } else roots.push(p)
  }
  const byName = (a: OrgPerson, b: OrgPerson) => a.name.localeCompare(b.name, 'tr')
  const seen = new Set<string>()
  const node = (p: OrgPerson): OrgNode => {
    seen.add(p.id)
    return { ...p, reports: (children.get(p.id) ?? []).sort(byName).filter((c) => !seen.has(c.id)).map(node) }
  }
  const tree = roots.sort(byName).map(node)
  // Anyone left over sits in a pure cycle (A↔B); show them as extra roots instead of hiding them.
  for (const p of people.sort(byName)) if (!seen.has(p.id)) tree.push(node(p))
  return tree
}

// True when making `managerId` the manager of `employeeId` would loop (self, or managerId already reports up to employeeId).
export function wouldCreateCycle(people: Pick<OrgPerson, 'id' | 'managerId'>[], employeeId: string, managerId: string | null): boolean {
  if (!managerId) return false
  if (managerId === employeeId) return true
  const byId = new Map(people.map((p) => [p.id, p]))
  const visited = new Set<string>()
  let cur: string | null | undefined = managerId
  while (cur && !visited.has(cur)) {
    if (cur === employeeId) return true
    visited.add(cur)
    cur = byId.get(cur)?.managerId
  }
  return false
}
