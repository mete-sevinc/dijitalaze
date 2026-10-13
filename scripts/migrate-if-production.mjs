// Runs `prisma migrate deploy` only for Vercel production builds, so preview builds never touch the shared database.
// A failed migration fails the build, which keeps the previous deployment live.
import { spawnSync } from 'node:child_process'

if (process.env.VERCEL_ENV !== 'production') {
  console.log(`[migrate] skipped (VERCEL_ENV=${process.env.VERCEL_ENV ?? 'unset'})`)
  process.exit(0)
}
const r = spawnSync('npx', ['prisma', 'migrate', 'deploy'], { stdio: 'inherit' })
process.exit(r.status ?? 1)
