# AI Company OS

Kurumsal AI çalışanlarını yönetim sistemi. Next.js, Prisma, PostgreSQL ve Anthropic Claude API kullanılarak geliştirilmiş.

## Özellikler

- 🤖 AI Çalışan Yönetimi
- 💬 Gerçek Zamanlı Sohbet
- 📋 Görev Yönetimi
- 🔄 Multi-Agent Toplantılar
- 📊 Raporlama Sistemi
- 🧠 Employee Memory Management
- ✅ Approval Workflows
- 📝 Audit Logging

## Gereksinimler

- Node.js 18+
- Docker & Docker Compose
- npm veya yarn
- Anthropic API Key (opsiyonel, AI özellikleri için)

## Kurulum

### 1. Depoyu klonla ve bağımlılıkları yükle

```bash
git clone <repo-url>
cd ai-company
npm install
```

### 2. Environment dosyasını oluştur

```bash
cp .env.example .env
```

`.env` dosyasını düzenle ve gerçek değerleri ekle:

```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/ai_company_os"
ANTHROPIC_API_KEY="your-api-key-here"
ANTHROPIC_MODEL="claude-3-5-sonnet-20241022"
```

### 3. PostgreSQL veritabanını başlat

```bash
npm run db:up
```

Veritabanının başladığını kontrol et:

```bash
docker compose ps
```

### 4. Prisma Client'ı generate et

```bash
npm run db:generate
```

### 5. Database migrasyonlarını çalıştır

```bash
npm run db:migrate
```

### 6. Örnek veri yükle (seed)

```bash
npm run db:seed
```

Bu komut 6 AI çalışan ve örnek görevleri yükler:
- Murat Şahin — Genel Müdür
- Ayşe Demir — Satış Müdürü
- Mehmet Kaya — Satış Mühendisi
- Elif Yılmaz — Finans & Muhasebe
- Zeynep Aydın — Pazarlama Müdürü
- Can Özkan — Operasyon Müdürü

### 7. Development sunucusunu başlat

```bash
npm run dev
```

Tarayıcıda açı: [http://localhost:3000](http://localhost:3000)

## Kullanılabilir Komutlar

```bash
# Development
npm run dev                 # Geliştirme sunucusu
npm run build              # Production build
npm run start              # Production sunucusu
npm run lint               # ESLint kontrolü

# Database
npm run db:up              # Docker PostgreSQL'i başlat
npm run db:down            # Docker PostgreSQL'i durdur
npm run db:generate        # Prisma Client generate et
npm run db:migrate         # Migrasyonları çalıştır
npm run db:seed            # Örnek veri yükle
npm run db:push            # Schema'yı veritabanına ilet
npm run db:reset           # Veritabanını sıfırla (UYARI: Veri silinir)
```

## Proje Yapısı

```
ai-company/
├── app/                    # Next.js App Router
│   ├── (app)/             # Authenticated routes
│   │   ├── dashboard/     # Dashboard sayfası
│   │   ├── employees/     # Çalışan yönetimi
│   │   ├── tasks/         # Görev yönetimi
│   │   ├── meetings/      # Toplantı yönetimi
│   │   ├── reports/       # Raporlama
│   │   └── settings/      # Ayarlar
│   ├── actions/           # Server actions
│   ├── layout.tsx         # Root layout
│   └── page.tsx           # Index sayfası
├── lib/
│   ├── db.ts              # Prisma Client singleton
│   ├── types.ts           # TypeScript type definitions
│   ├── schemas.ts         # Zod validation schemas
│   ├── ai/                # Anthropic API integration
│   │   ├── provider.ts    # AI Provider interface
│   │   └── anthropic.ts   # Anthropic implementation
│   └── agents/            # AI Agent system
│       ├── runtime.ts     # Agent execution engine
│       ├── context-builder.ts  # Dynamic context generation
│       ├── tool-executor.ts    # Tool execution
│       └── tools.ts       # Tool definitions
├── prisma/
│   ├── schema.prisma      # Database schema
│   └── seed.ts            # Seed script
└── docker-compose.yml     # Docker PostgreSQL config
```

## Anthropic API Konfigürasyonu

### API Key Alma

1. [Anthropic Console](https://console.anthropic.com)'a git
2. API Keys sekmesinde yeni key oluştur
3. `.env` dosyasına ekle:

```env
ANTHROPIC_API_KEY="sk-ant-..."
```

### API Key Olmadan Çalışma

Uygulama API key olmadan çalışır ama AI özellikleri devre dışı olur.

## Sorun Giderme

### PostgreSQL bağlantı hatası

```bash
# Veritabanının çalışıp çalışmadığını kontrol et
docker compose ps

# Veritabanını yeniden başlat
npm run db:down
npm run db:up

# Bağlantıyı test et
psql -U postgres -h localhost -d ai_company_os -c "SELECT 1"
```

### Prisma Client hatası

```bash
# Client'ı yeniden generate et
npm run db:generate

# Package'leri temizle
rm -rf node_modules package-lock.json
npm install
npm run db:generate
```

### Migration hatası

```bash
# Veritabanını sıfırla (UYARI: Tüm veri silinir)
npm run db:reset

# Veya manuel olarak
npx prisma migrate reset --force
```

## Geliştirme Notları

- UI tamamen Türkçedir
- API'ler server-side'dedir, API key browser'a maruz kalmaz
- Tüm AI çağrıları server actions aracılığıyla yapılır
- Prisma 8 kullanılıyor (release candidate)

## Lisans

MIT
