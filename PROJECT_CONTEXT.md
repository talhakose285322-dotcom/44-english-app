# Words 44 — Proje bağlamı

Son güncelleme: 2026-10-20. Bu belge herkese açık depoda durur; gizli anahtar, parola veya kişisel bilgi içermez.

## Ne?
İngilizce kelime öğrenme, okuma ve sözlük uygulaması (PWA). Türkçe arayüz. Kartlar ve kelime çarkı ile tekrar,
makale/PDF okuma, sözlük, listeler (koleksiyonlar), yedekleme.

## Mimari
- **Tek dosya:** `index.html` (CSS + tek bir IIFE içinde tüm JavaScript). Derleme adımı ve npm bağımlılığı yok.
- **`sw.js`:** Service worker, önbellek adı `english-app-v10`. Önce ağ, çevrimdışı önbellek. Kurulumda yalnızca
  `./` ve `./index.html` zorunlu; diğer dosyalar isteğe bağlı. Etkinleşince yalnızca eski `english-app-*`
  önbelleklerini siler.
- **`manifest.json`:** `id` ve `start_url` `./index.html`, `scope` `./`, `display: standalone`.
- **`vendor/pdfjs/`:** pdf.js 6.3.289 (PDF metni yerelde çıkarılır). OCR (Tesseract) internetten yüklenir.
- **`yerel-sunucu.cjs`:** Bilgisayarda çalıştırmak ve testler için küçük yerel sunucu (yalnızca 127.0.0.1).
  `Uygulamayi-Ac.cmd` bunu başlatır.
- **Yayın:** GitHub `talhakose285322-dotcom/44-english-app`, `main` → Netlify, depo kökü olduğu gibi yayımlanır.
  Canlı adres: https://symphonious-donut-1c09bc.netlify.app
  - Bu adres **değiştirilmemeli**: kullanıcı verileri, ana ekrana kurulu uygulamalar ve Supabase dönüş adresi buna bağlı.
  - Eski site `zippy-gnome-0660dc.netlify.app` çok eski bir sürüm; oradan kurulanlar güncellenmez. Yönlendirme
    yapılırsa o adresin kullanıcıları kendi verilerini göremez (veriler adrese göre ayrı tutulur).

## Veri (tarayıcıda)
Anahtar adları **asla değiştirilmemeli**.
- `localStorage`
  - `kelimelerim-v1`: kelimeler. Alanlar: `id, w, m, d, e, t, x, alt, pos`, listeler `c`/`cs`,
    tekrar durumu `box (0–3), iv, due, n, ok, bad, last`.
  - `kelimelerim-v1-s`: ayarlar ve istatistikler (`S`): tema, ses, `drate` (sözlük okuma hızı), `days`, `tot`,
    `cmeta` (kelimesiz listeler), `study`, `wheel` vb.
  - `kelimelerim-v1-a`: makaleler (`title, text, pos` okuma ilerlemesi, `readAt, done, src`).
  - Diğer `kelimelerim-v1-*` anahtarları yedeğe "extra" olarak girer.
  - `sb-<proje>-auth-token`: Supabase oturumu; yedeğe girmez.
- `IndexedDB 44-guvenlik / snaps`: günlük ve her geri yüklemeden önce otomatik güvenlik kopyası (son 15).
- **Yedek biçimi:** `collect()` → `{format:'44-backup', version:1, keys, extra, unreadable, counts}`.
  Geri yükleme: `parseBackup` → önizleme (`checkBackup`) → `restore('merge'|'replace')`; öncesinde `safeguard()`.
- **Korumalar:** Okunamayan veri (`BLOCK`) üzerine yazılmaz; kayıt hatasında değişiklik geri alınır;
  kelime ekleme `upsertWord` üzerinden yapılır (yinelenen kayıt olmaz, ilerleme korunur).

## Hesap ve bulut (Supabase)
- Proje ve publishable (tarayıcıda kullanılabilir) anahtar `index.html` içinde. Gizli anahtar istemcide yok ve olmamalı.
- **Google ile giriş:** supabase-js 2.117.2 (jsDelivr, SRI ile, gerektiğinde yüklenir), PKCE. `redirectTo` =
  `location.origin + location.pathname`. Supabase **Redirect URLs** listesinde canlı adres (ve yerel deneme adresi)
  bulunmalı. Bilgisayarda çalışıyor.
- **iPhone:** Safari'de giriş çalışıyor. Ana ekrana eklenmiş uygulamanın depolaması Safari'den ayrı olduğu için
  Safari oturumu oraya geçmez. Ana ekran uygulaması içinden Google girişi henüz doğrulanmadı (bkz. TASKS.md).
- **E-postayla 6 haneli kod** (`signInWithOtp` / `verifyOtp`): yalnızca yerelde. Gerçek kullanım için Supabase
  e-posta şablonlarında (Magic Link, Confirm signup) `{{ .Token }}` gerekir. Hazır e-posta servisi yalnızca proje
  ekibine gönderir; gerçek kullanıcılar için özel SMTP gerekir.
- **Bulut yedeği:** Tablo `public.cloud_backups` (`user_id uuid` birincil anahtar, `data text`, `created_at`,
  `updated_at`). RLS açık ve zorunlu; kullanıcı yalnızca kendi satırını okur/ekler/günceller, silme yok.
  Şema `supabase/001_cloud_backups.sql`. Uygulamada elle "Buluta yedekle / Buluttan geri yükle" (yalnızca yerelde);
  geri yükleme mevcut önizleme ve güvenlik kopyası akışını kullanır.

## Sözlük
İngilizce Vikisözlük + Türkçe Vikisözlük (anlamlar, türüne göre gruplu), dictionaryapi.dev (yedek), Datamuse
(sıklık/öneri), MyMemory (makine çevirisi; anonim günde ~5.000 karakter) ve varsa Chrome'un yerleşik çevirmeni.
İlk 3 örnek cümle otomatik çevrilir. "＋ Listeye ekle" ve okuma hızı (Yavaş 0.6 / Normal 0.85 / Hızlı 1.0).
DOCX içe aktarma yok; PDF, TXT/MD (makale), TXT/CSV (toplu kelime), JSON (yedek) var.

## Otomatik güncelleme
`sw.js` her yüklemede sunucudan kontrol edilir (`updateViaCache: 'none'`), uygulama öne gelince `reg.update()`.
Açık kalmış sayfa yalnızca güvenli koşullarda bir kez yenilenir: 5 dk+ arka plandan dönüş, dönüşten sonra 10 sn
içinde, dokunuş yokken, `window.__44busy()` meşgul değilken ve düzenlenmemiş alanlar varken değil. Yalnızca
`index.html` değişen yayınlar ETag ile algılanır. Bilgisayarda test edildi; iPhone'da gerçek cihaz testi yok.

## Yerel sürüm ile canlı sürüm farkı
Canlı: `main` = `7f4841f`. Yerel `index.html` canlıdan farklıdır ve **GitHub'da kopyası yoktur**:
- Bulut yedeği arayüzü ve kodu, e-postayla kodla giriş, hesap panelinde giriş yöntemleri.
- Geri yükleme birleştirmesinde liste üyelikleri ve boş listeler.
- Ekle formu ve toplu eklemede yinelenen kayıt düzeltmesi (`upsertWord`, toplu kip).
- Profil'deki "Uygulamayı yükle" paneli kaldırıldı (canlıda hâlâ var).

## Git ve testler
- Yerel klasör 2026-10-20'den beri git deposu. Çalışma dalı `pending-app-changes` (`main`'den). `index.html`
  değiştirilmiş, testler ve bazı dosyalar henüz izlenmiyor. `44-english-app/` iç klasörü ve `index (1).html`
  yalnızca GitHub'da (yerelde silinmiş görünür; bilinçli karar verilmeden commit'lenmemeli).
- Tam yedek: proje klasörünün bir üst klasöründe `44-english-app-yedek-2026-10-20.zip`.
- **Testler:** `tests/`, Node'un kendi test çalıştırıcısı + kurulu Chrome (headless, geçici profil), sahte
  Supabase/ses/sözlük servisleri, dış ağ engelli. Komut: `node --test`. 13 dosya, 57 test.
- **`tests-ci` dalı** (GitHub'da): canlı kodla uyumlu 6 test dosyası (25 test) + `.github/workflows/tests.yml`.
  Pull request henüz açılmadı; GitHub Actions hiç çalışmadı.
