import { defineConfig } from 'prisma/config'

// Migrations need a direct (non-pooled) Neon connection; the app itself uses the pooled DATABASE_URL.
const url = process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL?.replace('-pooler', '')

export default defineConfig({
  datasource: {
    url: url as string,
  },
})
