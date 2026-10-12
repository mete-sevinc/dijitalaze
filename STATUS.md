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

## 2026-10-11: A/B/C (ajan çekirdeği, hafıza, personele iş verme)
- A: `lib/ai/agent-loop.ts` ortak ajan döngüsü (Gemini hızlı model zinciri → GitHub Models yedeği, token varsa). Asistan (`lib/assistant/service.ts`) ve personel (`lib/agents/runtime.ts`, `lib/agents/work.ts`) bunu kullanır. Onay kapısı: `GATED_TOOLS` (create_task, create_meeting_action) Approval kaydı açar; Görevler sayfasında onay/ret.
- B: Asistan hafızası (`AssistantMemory`, `remember`/`forget`, prompta enjekte, /assistant'ta "Unut"). Personel: onay/düzeltme/ret → `EmployeeMemory` LESSON, sonraki işlerde prompta girer.
- C: Asistan `list_employees`/`assign_task_to_employee`/`create_employee` araçları; Görevler sayfasında iş ver, incele (Onayla/Düzelt), takılanı tekrar dene. İş `after()` ile arka planda çalışır.
- Canlıda doğrulandı: personel tanımlama, hafıza kaydı, iş verme→teslim→düzeltme→onay, öğrenilen stilin yeni işte uygulanması, onay kapısı (bekle/ret).
- Bilinen: ilk iş verme bir kez BLOCKED'a düştü (sebep görülemedi, tekrar denemede çalıştı); test sırasında kopya "Ayşe (Satış Uzmanı)" personeli oluştu, silinmedi.
- Doğrulanmadı: Gemini 400 şema hatası olasılığı tüm personel araçlarında; onay SONRASI eylemin uygulanması (approve yolu); push bildirimi (Vercel'de VAPID/CRON env yok).

## 2026-10-11: Asistan e-posta + zamanlayıcı
- Mail: `lib/assistant/mail.ts` (Graph `/me/sendMail`, refresh token AES-GCM şifreli, `AssistantMailAccount`), `emails.ts` (taslak→zamanlı→gönderim, 3 deneme, push bildirimi), asistan araçları `draft_email/update_email_draft/schedule_email/send_email/cancel_email/list_emails`. Aynı mesajda taslak+gönderim engelli (onay şart). /assistant'ta "E-postalar" paneli.
- Giriş kapsamı `offline_access Mail.Send` eklendi (`auth.ts`). GEREKLİ: Entra uygulamasında delegated `Mail.Send` izni + bir kez çıkış/giriş.
- Tetikleyici: `.github/workflows/scheduler.yml` her 5 dk `/api/cron/assistant` çağırır (repo secret `CRON_SECRET` gerekli). Vercel env: CRON_SECRET, VAPID_*, NEXT_PUBLIC_VAPID_PUBLIC_KEY.
- Doğrulandı: tsc/eslint temiz; zamanlı mail yaşam döngüsü (yetki yokken 3 deneme→FAILED) DB'de test edildi.
- Doğrulanmadı: gerçek Graph gönderimi, push, Actions tetikleyicisi (henüz commit/push edilmedi).

## Entra yeniden kayıt (karar: ana kayıt info@ dizininde, 2026-10-12)
Eski AZE Dijital kaydı info@azeotomasyon.com dizininde YOK (3 eski kayıt var). Yeni kayıt: Entra → Uygulama kayıtları → Yeni kayıt:
- Ad: AZE Dijital; hesap türü: yalnızca bu kuruluş; yönlendirme (Web): `https://dijital.aze.com.tr/api/auth/callback/microsoft-entra-id`
- API izinleri: Microsoft Graph → Delegated → `Mail.Send`, `offline_access`, `User.Read`, `openid`, `profile`, `email` → yönetici onayı ver (kullanıcıya ayrı onay ekranı çıkmaz).
- Kurumsal uygulama → Özellikler → "Atama gerekli" açık; kullanıcıları ata (mete dahil).
- Sertifikalar ve gizli diziler → yeni client secret.
- Vercel env güncelle (Production+Preview): `AUTH_MICROSOFT_ENTRA_ID_ID`, `AUTH_MICROSOFT_ENTRA_ID_SECRET`, `AUTH_MICROSOFT_ENTRA_ID_ISSUER` (= `https://login.microsoftonline.com/<info dizin tenant id>/v2.0`), `AUTH_ALLOWED_EMAIL` (tüm kullanıcı adresleri, virgüllü) → redeploy.
- Giriş çalışınca eski kaydı sil. Her kullanıcı yeniden giriş yapınca refresh token kaydedilir; mailler giriş yapan kullanıcının hesabından gider.
- NOT: kullanıcı adresleri, yeni dizinde olmalı (Entra'daki UPN ile `AUTH_ALLOWED_EMAIL` birebir aynı).

## 2026-10-12: Mail + giriş canlıda
- Giriş: yeni Entra kaydı (info@ dizini, tek kiracı) çalışıyor; kullanıcı `AUTH_ALLOWED_EMAIL`. Secret yanlış kopyalanınca `invalid_client` verir (Entra'da yalnızca oluşturma anında görünen **Değer**, Secret ID değil). `/giris` kurumsal giriş sayfası, üstte e-posta + "Çıkış yap".
- Mail: gerçek test maili SENT; zamanlı (DB `SCHEDULED`) mail zamanlayıcı çağrısıyla SENT oldu. Asistan araç çağırmadan "gönderdim" derse sunucu zorlar/dürüst hata verir (`CLAIMS_DONE`). Bekleyen taslak id'leri sistem istemine girer.
- ÇÖZÜLDÜ: GitHub `*/5` cron'u güvenilmezdi; `.github/workflows/scheduler.yml` artık dakikalık kendini yenileyen zincir (public repo, ücretsiz). Doğrulandı: zamanlı mail ve hatırlatma dakika içinde işlendi.
- (eski not) GitHub Actions `*/5` cron'u güvenilmez (saatlerce tetiklenmedi, yalnızca 22:10 ve 01:21 UTC). Uygulama kapalıyken zamanında gönderim/hatırlatma için harici dakikalık tetikleyici gerekli (cron-job.org ya da Cloudflare Worker cron; `GET /api/cron/assistant`, `Authorization: Bearer CRON_SECRET`).
- Doğrulanmadı: web push cihaza gerçek bildirim; Gemini 12 sn zaman aşımı arada "Asistan yanıt veremedi" veriyor.

## 2026-10-12 (genel kontrol sonrası)
- Oturum her istekte izin listesine karşı doğrulanır (`auth.ts` jwt callback); listeden çıkan kullanıcı düşer. İptal edilen mail yetkisi (`invalid_grant`) silinir, panel "yeniden giriş" uyarısı verir.
- LLM zaman aşımı 25 sn, asistan rotası `maxDuration=60`. Lint/tsc temiz. Push bu cihazda açık.
- Temizlik: "Ayşe (Satış Uzmanı)" test kopyası ARCHIVED, test mailleri silindi. Eski Entra kaydı (başka dizinde) elle silinmeli.
- Doğrulanmadı: push'un cihazda görünmesi (sunucu tarafı gönderdi), zincirin 6 saatlik devri.
