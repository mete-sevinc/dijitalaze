// İlk yükleme / elle senkron: tüm modüller bitene kadar çalışır. Kullanım: npm run crm:sync
import { syncCrm } from '../lib/crm-sync'
import { CRM_MODULES } from '../lib/crm-index'

async function main() {
  const finished = new Set<string>()
  for (let round = 1; ; round++) {
    const results = await syncCrm(50_000, finished)
    for (const r of results) if (r.done) finished.add(r.module)
    console.log(`tur ${round}:`, results.map((r) => `${r.module}=${r.fetched}${r.done ? '✓' : '…'}`).join(' '))
    if (finished.size === CRM_MODULES.length) break
  }
}

main().then(() => process.exit(0), (e) => { console.error(e instanceof Error ? e.message : e); process.exit(1) })
