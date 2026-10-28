-- Prisma şemasında ifade indeksi tanımlanamadığı için elle yazıldı (crm_search: tam metin + ILIKE).
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX "CrmRecord_fts_idx" ON "CrmRecord" USING GIN (to_tsvector('turkish', "title" || ' ' || "content"));

CREATE INDEX "CrmRecord_trgm_idx" ON "CrmRecord" USING GIN (("title" || ' ' || "content") gin_trgm_ops);
