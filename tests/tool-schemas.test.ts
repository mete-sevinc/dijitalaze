import { describe, expect, it } from 'vitest'
import { agentTools, GATED_TOOLS, getToolByName } from '@/lib/agents/tools'

// Gemini function declarations accept only an OpenAPI subset; anything else is a 400 for the whole request.
const ALLOWED_KEYS = new Set(['type', 'description', 'properties', 'required', 'items', 'enum', 'format', 'nullable'])
const TYPES = new Set(['string', 'number', 'integer', 'boolean', 'array', 'object'])

function check(node: unknown, path: string, errors: string[]) {
  if (!node || typeof node !== 'object') return
  const n = node as Record<string, unknown>
  for (const key of Object.keys(n)) if (!ALLOWED_KEYS.has(key)) errors.push(`${path}: unsupported key "${key}"`)
  if (typeof n.type !== 'string' || !TYPES.has(n.type)) errors.push(`${path}: bad type ${String(n.type)}`)
  if (n.type === 'array' && !n.items) errors.push(`${path}: array without items`)
  if (n.properties) for (const [k, v] of Object.entries(n.properties as object)) check(v, `${path}.${k}`, errors)
  if (n.items) check(n.items, `${path}[]`, errors)
  const props = Object.keys((n.properties as object) ?? {})
  for (const r of (n.required as string[]) ?? []) if (!props.includes(r)) errors.push(`${path}: required "${r}" is not a property`)
}

describe('agent tool declarations', () => {
  it('only use schema features Gemini accepts', () => {
    const errors: string[] = []
    for (const t of agentTools) check(t.inputSchema, t.name, errors)
    expect(errors).toEqual([])
  })

  it('have unique names, descriptions and an object root', () => {
    const names = agentTools.map((t) => t.name)
    expect(new Set(names).size).toBe(names.length)
    for (const t of agentTools) {
      expect(t.description.length).toBeGreaterThan(10)
      expect((t.inputSchema as { type: string }).type).toBe('object')
    }
  })

  it('only gate tools that exist', () => {
    for (const g of GATED_TOOLS) expect(getToolByName(g)).toBeDefined()
  })
})
