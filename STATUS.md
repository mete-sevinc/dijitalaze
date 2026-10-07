# STATUS

Güncelleme: 2026-10-06

- Canlı adres: https://dijital.aze.com.tr (Vercel + Neon + GitHub `mete-sevinc/dijitalaze`; push'ta otomatik deploy). Eski `dijitalaze.aze.com.tr` kaldırıldı. DNS Cloudflare'de.
- Giriş: Auth.js v5 + Microsoft Entra ID (uygulama "AZE Dijital", kiracı AZE OTOMASYON AS). Yalnızca `AUTH_ALLOWED_EMAIL` (mete@aze.com.tr); Entra'da "atama gerekli" açık. Yeni kullanıcı için Entra'da ata + env listesine ekle. Client secret 05.10.2028'de dolar.
- DB: tablolar `prisma db push` ile oluşturuldu; seed yerelde `npm run db:seed` (`.env.local` içinde DATABASE_URL). `/api/seed` silindi.
- Doğrulanmadı: yetkisiz hesabın reddi, dashboard/görevler/toplantılar/raporlar/ayarlar sayfaları, sohbet (Anthropic çağrısı).
- Sızan GitHub token'ı silindi; git `gh` oturumuyla çalışıyor (azegen webhook token'ı silindi, gerekirse yenisi üretilmeli). Çalışma ağacında başka oturumun commit edilmemiş çoklu-şirket değişiklikleri var.
- Güvenlik notu: şu an tek kullanıcı (mete@aze.com.tr) var, firma yetkisi ayrımı yok. İkinci kullanıcı eklenmeden önce firma-üyelik tablosu, `getActiveCompany()`/`switchCompany` içinde üyelik doğrulaması ve action'larda firma kapsamı kontrolü şart (IDOR).
- Kişisel asistan (/assistant): Gemini (model yedek zinciri), görev/not/hatırlatma araçları, not düzenle/sil/ara, Web Push bildirimi + günlük özet cron'u (`/api/cron/assistant`). Vercel env gerekli: NEXT_PUBLIC_VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, CRON_SECRET (yerelde .env.local'de). Dakikalık hatırlatma için harici tetikleyici: GET /api/cron/assistant (Authorization: Bearer CRON_SECRET); Vercel Hobby'de cron günde 1.
- Doğrulanmadı: push bildirimi (cihaza gerçek gönderim), cron çalışması.
- Sıradaki: ana sayfa tasarımı, toplantılar, org chart.
- Karar (2026-10-07): Giriş DB'ye bağlanmayacak. Kullanıcı kaynağı auth (Entra + `AUTH_ALLOWED_EMAIL`); self-kayıt yok, listede olmayan giremez. Ayarlar > Kullanıcılar artık auth listesini salt-okunur gösteriyor (DB ekle/çıkar kaldırıldı).
- Firma: tek firma (`demo_company` kimliği, ad "AZE Otomasyon"). Çoklu-firma/seçici geri alındı (2ed00ca); `aze_company` DB'den kaldırıldı. `tool-executor.ts` firma kimliğini çalışanın DB kaydından alıyor.
