# STATUS

Güncelleme: 2026-10-14 (gece). Tüm dijitalaze oturumlarının (kurulum, Ayarlar, Asistan, Görünüm, analiz) işleri bu dosyada birleştirildi; yeni oturum buradan başlar.

## Sistem
- Canlı: https://dijital.aze.com.tr (Vercel + Neon PostgreSQL + GitHub `mete-sevinc/dijitalaze`; `main`'e push = otomatik deploy). DNS Cloudflare'de. Eski `dijitalaze.aze.com.tr` kaldırıldı.
- Tek firma: `demo_company` kimliği, ad "AZE Otomasyon". Çoklu-firma denendi ve geri alındı (2ed00ca).
- Giriş: Auth.js v5 + Microsoft Entra ID (uygulama "AZE Dijital", info@azeotomasyon.com dizini, tek kiracı). Kullanıcı kaynağı yalnız `AUTH_ALLOWED_EMAIL` (virgüllü); DB'ye bağlı değil, self-kayıt yok. Oturum her istekte listeye karşı doğrulanır (listeden çıkan düşer). Yeni kullanıcı = Entra'da ata ("atama gerekli" açık) + env listesine ekle. Mailler giriş yapanın hesabından gider (refresh token şifreli).
- Entra yeniden kayıt gerekirse: Web yönlendirmesi `https://dijital.aze.com.tr/api/auth/callback/microsoft-entra-id`; Graph delegated `Mail.Send`, `offline_access`, `User.Read`, `openid`, `profile`, `email` + yönetici onayı; client secret'ın **Değer**'i (Secret ID değil, yoksa `invalid_client`); Vercel env `AUTH_MICROSOFT_ENTRA_ID_ID/_SECRET/_ISSUER` (`.../<tenant-id>/v2.0`), `AUTH_SECRET`, `AUTH_ALLOWED_EMAIL`; redeploy.
- Env (Vercel): DATABASE_URL, AUTH_*, GOOGLE_GENERATIVE_AI_API_KEY (+ isteğe bağlı `GITHUB_MODELS_TOKEN` yedeği, `GEMINI_MODEL`/`AI_PROVIDER`), NEXT_PUBLIC_VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, CRON_SECRET, EMPLOYEE_MONTHLY_TOKEN_LIMIT (boş = sınırsız).

## Veri, dağıtım, kalite
- Vercel proje ayarında Build Command elle `npx prisma generate && next build` (Framework "Other") olduğundan `package.json` build'i yok sayılıyordu; `vercel.json` `buildCommand: npm run build` ile geçersiz kılar (migration adımı çalışsın diye).
- Migration: `prisma/migrations` (0_init baseline + `20261014_agent_usage`). Şema değişikliği = `npm run db:migrate` ile migration dosyası; `db push` kaldırıldı. Build (`scripts/migrate-if-production.mjs`) yalnız Vercel production'da `migrate deploy` çalıştırır; hata build'i düşürür. `prisma.config.ts` Neon `-pooler`'ı migration için atar.
- CI (`.github/workflows/ci.yml`): boş Postgres'e migration, şema sapma kontrolü, typecheck, lint, vitest, build.
- Testler `tests/` (vitest 3; vitest 5 `@types/node` ≥22 ister). Yerelde: `npm run typecheck && npm run lint && npm test`.
- Seed: `npm run db:seed` (`.env.local` içinde DATABASE_URL); `/api/seed` yok. Seed tüm iş verisini siler.
- Sunucu kapsamı: `companyId` istemciden gelmez (`lib/company.ts`); sorgular firmaya göre sınırlı; action hataları `lib/action-log.ts` ile loglanır, istemciye yalnız kasıtlı `UserError` mesajları gider.

## Özellikler
- Çalışanlar: tanım, talimat, hafıza, iş birliği düzeni, silme. Ortak ajan döngüsü `lib/ai/agent-loop.ts` (Gemini hızlı model zinciri, GitHub Models yedeği, 25 sn zaman aşımı).
- Görevler: personele iş verme (arka planda `after()`), inceleme (Onayla/Düzelt), takılanı tekrar dene; onay kapısı `GATED_TOOLS` (create_task, create_meeting_action) → Approval.
- Asistan (/assistant): görev/not/hatırlatma/hafıza, personel araçları, e-posta taslak→zamanlı→gönderim, Web Push. Zamanlayıcı: `.github/workflows/scheduler.yml` dakikalık kendini yenileyen zincir → `/api/cron/assistant` (repo secret CRON_SECRET).
- Denetim ve maliyet: her araç çağrısı `AuditLog` (`TOOL_CALL`, yalnız alan adları); çalışan başına token `AgentUsage`; aylık limit dolunca iş/sohbet/toplantı konuşması başlamaz. UI'da kullanım göstergesi yok.
- SuiteCRM (crm.aze.com.tr, v7, v4.1 REST, salt okunur): asistanda `crm_pending_quotes` (bekleyen teklifler: Draft/Negotiation/Delivered/On Hold, en çok 25). Env: SUITECRM_URL/USER/PASSWORD (Vercel + .env.local). CRM kullanıcısı `azebotdonotdelete` ("Portal API Kullanıcısı" kapalı olmalı, yoksa Invalid Login; rol "Kisitli"). Canlıda doğrulandı 2026-10-28. Kod: `lib/suitecrm.ts`.
- CRM indeksi (2026-10-29, migration Neon'a uygulandı, ilk yükleme yapıldı: 33.775 kayıt; arama gerçek veriyle doğrulandı, sorgu hızı için GIN indeksleri (fts + trigram) eklendi (migration 20261029_crm_search_indexes)): `CrmRecord`/`CrmSyncState` (migration `20261029_crm_index`), `lib/crm-sync.ts` (modül başına sayfalı artımlı senkron, haftalık tam geçiş silinenleri temizler), `lib/crm-index.ts` (alan→metin), asistan aracı `crm_search` (Postgres Türkçe tam metin + ILIKE). 26 modül (e-posta ve sistem modülleri hariç, ≈33 bin kayıt). İlk yükleme: `npm run crm:sync`; günlük cron `/api/cron/crm-sync` (vercel.json). CRM bot kullanıcısı `azebotdonotdelete` 2026-10-29'da yeniden oluşturuldu (silinmişti); rolünün yalnız okuma olduğu CRM'de doğrulanmadı. SuiteCRM `order_by` tablo öneksiz olmalı (önekliyi yok sayar). Dijital yalnız Mete kullanır: kullanıcı bazlı CRM yetkisi gerekmiyor.
- Raporlar (/reports): görev verisinden deterministik günlük/haftalık/aylık rapor (LLM yok), tekil silme.
- Canlıda doğrulandı (2026-10-14): çok-ajanlı tur (gerçek Gemini, 2 ajan sırayla konuştu, kullanım kayıtları yazıldı) ve yapay zekâ özet/karar/aksiyon taslağı; migration Vercel build'inde otomatik uygulandı. Not: özet taslağı bazen önerileri "kararlaştırılmıştır" diye yazar; sahibi kontrol eder.
- Toplantılar (/meetings): planla → başlat → **çok-ajanlı tur** (her istekte tek konuşmacı, sıra ve kişi başı 3 söz sınırı sunucuda, araçsız, içerik veri olarak çerçevelenir) → not → aksiyon (atanırsa görev açılır) → yapay zekâ özet/karar/aksiyon **taslağı** (kaydedilmez, sahibi onaylar) → tamamla/iptal; silme (aksiyondan açılan görevler kalır).

## Analiz maddeleri (analiz oturumu, 24 madde) durumu
| # | Madde | Durum |
|---|---|---|
| 1 | IDOR / firma kapsamı | Yapıldı (tek firma için). İkinci kullanıcıdan önce üyelik tablosu + `getCompanyId()` oturumdan türetilmeli |
| 2 | Rate limit yok | Yapıldı: model çağrıları tüm çalışanlar toplamında dakikada 40 (`assertWithinBudget`), asistan sohbeti kullanıcı başına dakikada 15 mesaj. HTTP düzeyinde genel sınır yok (tek kullanıcı, Entra arkasında) |
| 3 | `catch {}` hatayı yutuyor | Yapıldı |
| 4 | Güvenlik başlıkları/CSP | Yapıldı: `next.config.ts` başlıkları (X-Frame-Options, nosniff, Referrer-Policy, Permissions-Policy, HSTS) + `proxy.ts`'te istek başına nonce'lu CSP (`lib/csp.ts`: script-src nonce + strict-dynamic, style'da `unsafe-inline` çünkü React inline style kullanıyor). Canlıda doğrulandı: sayfalar, 404, giriş/çıkış akışı, konsolda ihlal yok. Kök layout nonce için sayfaları dinamik yapar |
| 5 | `../ai-company-clean.zip` (içinde `.git`) | Yapıldı: çöp kutusuna taşındı (`~/.Trash/ai-company-clean-2026-10-05.zip`), geri alınabilir |
| 6 | Entra secret rotasyonu | Canlı kayıt `80d2a375-624c-44ab-b649-f1d7851db0bb` (info@ dizini), secret `dijital` **12.10.2027**'de dolar: takvime yaz. Eski kayıt `a86cba04-…` silindi |
| 7 | Toplantılar/Raporlar stub | Yapıldı (+ çok-ajanlı tur, silme) |
| 8 | Ajanlar arası otomatik devir | Yapıldı ve canlıda doğrulandı: Ayşe `delegate_task` çağırdı → onay bekledi → onaylanınca görev Mehmet'e geçti (devir notuyla), Mehmet işi yapıp İNCELEME'ye düşürdü. Onay kapılı olduğu için ajanlar arası ping-pong olmaz |
| 9 | Org chart | Yapıldı: `/org` (yönetici ağacı, yönetici ataması döngü korumalı `setManager`, `lib/org.ts`) |
| 10 | `create_meeting_action` aracı | Yapıldı: toplantı/atanan firmaya göre doğrulanır, kayıt+görev tek işlemde, kapalı toplantıya eklenmez |
| 11 | Onay SONRASI eylemin uygulanması | Yapıldı: birim testler (`tests/approval.test.ts`) + canlıda uçtan uca (onay → eylem uygulandı, denetim kaydı yazıldı) |
| 12 | Gemini 400 şema hatası olasılığı | Yapıldı: `tests/tool-schemas.test.ts` + canlıda gerçek Gemini (`gemini-flash-lite-latest`) tüm araç tanımlarıyla hatasız yanıt verdi ve aracı doğru parametreyle çağırdı |
| 13 | Push'un cihazda görünmesi | Yapıldı: sunucudan gerçek push gönderildi, service worker bildirimi bu cihazda gösterdi (`getNotifications()` ile doğrulandı); sabah özeti bildirimi de gösterilmiş |
| 14 | Zamanlayıcı zinciri | Yapıldı: zincir 5 kez ardışık devredildi (≈29 saat kesintisiz, GitHub Actions geçmişinde `workflow_dispatch` success zinciri) |
| 15 | Yetkisiz hesabın reddi; sayfalar | Sayfalar canlıda doğrulandı (dashboard, görevler, toplantılar, raporlar, ayarlar). Yetkisiz hesap reddi canlıda doğrulandı (2026-10-14): izin listesinde olmayan `info@azeotomasyon.com` ile giriş → `/giris-hatasi?error=AccessDenied` "Erişim yok", oturum açılmadı, `/dashboard` giriş sayfasına yönlendi |
| 16 | Test yok | Yapıldı (vitest) |
| 17 | Migration yok | Yapıldı |
| 18 | CI yok | Yapıldı |
| 19 | Gözlemlenebilirlik | Kısmen (hesap gerektiren kısım hariç): AuditLog yazılıyor, action hataları bağlamıyla loglanıyor (Vercel Logs), `app/(app)/error.tsx` arayüz hatalarını hata koduyla gösterir. Harici hata izleme (Sentry vb.) hesap/DSN gerektirir, kurulmadı |
| 20 | Bağımlılık temizliği | Yapıldı: `postgresql` paketi kaldırıldı, `lib/ai/base.ts` ile döngüsel import çözüldü (`require()` yok), Anthropic varsayılanı `claude-sonnet-5-5` |
| 21 | `tsconfig.tsbuildinfo` | Yapıldı (`*.tsbuildinfo` ignore, izlenmiyor) |
| 22 | STATUS'ta eski "commit edilmemiş" notu | Yapıldı (bu yeniden yazım) |
| 23 | İlk iş hatasının sebebi UI'da | Yapıldı: BLOCKED görevde sebep `result`'a yazılıyor ve Görevler'de gösteriliyor |
| 24 | Gemini zaman aşımında tekrar dene | Yapıldı: asistan sohbetinde hata sonrası "Tekrar dene" (aynı mesaj yeniden gönderilir; ilk deneme kaydedildiyse sohbette tekrar görünebilir) |

## Doğrulanmamış (özet)
Gerçek Graph (Entra) ile toplu kullanıcı senaryoları (tek kullanıcı var); harici hata izleme yok; Vercel Hobby'de Fluid süre sınırları ağır toplantı turlarında denenmedi (tur her istekte tek konuşmacı olduğu için beklenmiyor).

## Sıradaki
`EmployeeResource` (klasör bazlı erişim) + Graph dosya araçları (Entra'ya `Files.ReadWrite.All`/`Sites.Read.All` gerekir; önce hangi SharePoint sitesi/klasör yapısı olacağı belirlenmeli) → ana sayfa tasarımı → ikinci kullanıcı gelmeden firma-üyelik tablosu (IDOR notu) → harici hata izleme. Tüm analiz maddeleri kapalı; yalnızca 1 (ikinci kullanıcı öncesi üyelik) ve 19 (harici izleme) notlu.
