# Words 44 — Ortak geliştirme kuralları (Claude Code + ChatGPT)

Bu dosya, Words 44'ü birlikte geliştiren Claude Code ve ChatGPT için ortak kurallardır. Bu bir proje devri değildir;
iki araç da geliştirmeye devam eder. Ayrıntılı son durum için `CLAUDE_HANDOFF.md` de okunur.
Herkese açık depoda durur: gizli anahtar, parola, token veya kişisel bilgi yazılmaz.

Son doğrulama: 2026-10-23, bu dosya eklenmeden önce `main` = `43e1ec8`.

## 1. Mimari (kaynak koddan doğrulandı)
- **Web uygulaması (PWA):** `index.html` (CSS + JavaScript tek dosyada), `sw.js` (önbellek `english-app-v18`; makale fotoğrafları ayrı `words44-img`, en fazla 40),
  `manifest.json`, `version.json` (`1.1.0`), `vendor/pdfjs/` (PDF okuma), `icons/`.
  Tanıtım ve yasal sayfalar: `welcome.html`, `privacy.html`, `terms.html`.
- **Yayın:**
  - Ana adres Cloudflare Worker: https://words44.words44.workers.dev (`wrangler.jsonc`; Cloudflare Workers Builds
    her `main` push'unda `node scripts/build-static.mjs` + `npx wrangler deploy`). Kalıcı adres: ana ekran uygulaması
    bu adrese bağlıdır, değişirse herkes yeniden kurar ve veriyi taşır.
  - Cloudflare Pages https://44-english-app.pages.dev hâlâ `main`'den yayımlanıyor ama `*.pages.dev` Türkiye
    ağlarında engelli; kullanıcıya verilmez (bkz. `CLOUDFLARE-DEPLOY.md`).
  - Yedek GitHub Pages (`pages-backup.yml`): https://talhakose285322-dotcom.github.io/44-english-app
  - Eski Netlify sitesi `symphonious-donut-1c09bc.netlify.app` güncellenmiyor (service worker `v10`'da kaldı).
- **Masaüstü:** `desktop/` (Electron: `main.cjs`, `preload.cjs`, `package.json` `1.0.10`). `desktop-release.yml`
  GitHub Releases'e Windows `.exe`, macOS `.dmg` ve `SHA256SUMS` yükler.
- **Testler:** `tests/` (9 dosya) ve `scripts/`. CI: `.github/workflows/tests.yml`
  (`node --test --test-concurrency=1 --test-timeout=60000`). Diğer iş akışı: `claude.yml`.
- **Hesap ve bulut:** Supabase. Google OAuth (PKCE, hesap seçimi `prompt=select_account`). Bulut yedeği tablosu
  `cloud_backups` (`data` metin, RLS ile kullanıcı başına).
- **Veri (tarayıcıda):** `localStorage` anahtarları `kelimelerim-v1` (kelimeler), `kelimelerim-v1-s` (ayarlar ve
  istatistikler), `kelimelerim-v1-a` (makaleler), diğer `kelimelerim-v1-*`; `IndexedDB 44-guvenlik` (otomatik
  güvenlik kopyaları); `IndexedDB 44-metin` (localStorage dolmaya başlayınca büyük makale metinleri; o makale
  `kelimelerim-v1-a`'da `{text:'', xt:<uzunluk>}` yer tutucusuyla durur). İkisi de kullanıcı verisidir, silinmez.
  Yedekler (`collect()`) metinler yüklenmeden alınmaz (`ready`).
- **Diğer belgeler:** `ROADMAP.md`, `APP_STORE_ROADMAP.md`, `DATA-SAFETY.md`, `DATA-TRANSFER.md`.

## 2. Doğrulanmış son geliştirmeler (2026-10-23, GitHub üzerinden)
| Bildirilen | Durum | Kanıt |
|---|---|---|
| Web 1.0.10, Service Worker v17 | Doğrulandı | `version.json`, `sw.js`; GitHub Pages yedeği 1.0.10 / v17 sunuyor |
| Masaüstü v1.0.10, `.exe` ve `.dmg` | Doğrulandı | En son yayın **`desktop-v1.0.10-build.16`** (`bc4bbcf`). `build.14` de var ama en son değil |
| GitHub Actions otomatik yayın | Doğrulandı | `Testler`, `Build Words 44 desktop installers`, `Publish Words 44 backup site` son commit'lerde başarılı |
| Masaüstü indirme bağlantıları | Doğrulandı | `welcome.html` → `releases/latest/download` |
| GitHub Pages yedek yayın | Doğrulandı | Yedek adres 1.0.10 / v17 sunuyor |
| Google OAuth hesap seçimi | Kodda ve testte var | `8ad883c`, `5539932` |
| Bulut yedeğinde kullanıcılar arası izolasyon | Kodda ve testte var | `a805c63`, `e7abe7d`, `0d3fc62`, `458412b` |
| Cloudflare Pages'in en yeni sürümü sunması | **Doğrulanamadı** | Bu ortamdan bağlantı kurulamadı |
| iPhone'da güncelleme, Google girişi, gerçek Supabase RLS | **Doğrulanmadı** | Gerçek cihaz/erişim testi yok |

Commit, başarılı CI, yayın ve gerçek cihaz davranışı ayrı şeylerdir; biri diğerini kanıtlamaz.

## 3. Devam eden sorunlar
1. iPhone ana ekran uygulamasının yeni sürümü alamaması (öncelik 1; bkz. `CLAUDE_HANDOFF.md`).
2. iPhone'da Google OAuth dönüşü ve geçiş anahtarı/QR ekranı. Gerçek cihazda doğrulanmadan "düzeldi" denmez.
3. Eski Netlify sitesi 21 Ekim'de durmuş: `index.html` = `1616b9e`, service worker `v10` (23 Ekim kontrolü).
   Oradan ana ekrana kurulan uygulamalar yeni sürüm almaz. Yönlendirme yapılırsa o adresteki kullanıcılar kendi
   verilerini göremez (veriler adrese göre ayrı tutulur). Bunun için ayrıca karar gerekir.
   - **Erişim sorunu:** 23 Ekim'de geliştirici bilgisayarının ağından `*.pages.dev` adreslerine TLS bağlantısı
     kurulamadı. DNS ve TCP çalışıyor, TLS el sıkışması takılıyor; `developers.cloudflare.com` açılıyor.
     Kullanıcının telefonu aynı ağdaysa (aynı Wi-Fi ya da operatör) ana ekrandaki uygulama sunucuya ulaşamaz ve
     önbellekteki eski sürümle açılmaya devam eder. Bunun çözümü kodda değil, alan adında (ör. özel alan adı).
     Alan adı değişirse veriler adrese göre ayrı tutulduğu için yedekle taşınmaları gerekir.
   - Bir sonraki adım: gerçek cihazda hangi adresin kurulu olduğunu ve o ağda `pages.dev`'in açılıp açılmadığını
     doğrulamak.
4. Taslak PR #22 (`android-capacitor-experiment`) açık. Birleştirilmemiş çok sayıda dal var.
5. Claude Code'un yerel `pending-app-changes` dalı eski bir `main`'e (`7f4841f`) dayanır. Yerelde kaydedilmemiş
   `index.html` değişiklikleri vardır (ör. e-postayla kodla giriş; `main`'de yok). `main`'deki bulut yedeği ayrı
   olarak geliştirilmiştir. Bu yerel değişiklikler silinmez; `main` ile karşılaştırılmadan birleştirilmez.

## Şu an kim neyi düzenliyor
- Şu an `index.html` üzerinde açık bir iş yok. Bitenler (2026-10-23, Claude Code): Word (.docx) yükleme
  (`e77b59f`), hazır makale içerikleri `content/articles/` (`65813de`), okuyucuda hazır makaleler kütüphanesi
  (`72c040a`; ilerleme/kayıtlar `kelimelerim-v1-lib` anahtarında). Yeni makale eklemek uygulama sürümü gerektirmez:
  `content/articles/<id>/` + `node scripts/build-article-catalog.mjs`.

## Planlanan büyük özellikler
- **Makale okuma ve içerik kütüphanesi:** Ortak içerik Cloudflare R2/CDN'de, metadata Supabase'de, CEFR seviye
  sürümleri, mevcut okuyucu ve sözlüğün yeniden kullanımı. Ayrıntılar: `docs/ARTICLE_LIBRARY_PLAN.md`.
  Kullanıcı onayıyla ilk sürüme başlandı (bkz. yukarı). Merkezi güncelleme ve erişim sorunu ayrı görev olarak sürüyor.

## 4. Ortak çalışma düzeni
- ChatGPT ve Claude Code aynı projede çalışır; birbirlerinin geliştirmelerini silmez veya geri almaz.
- Kod değiştirmeden önce GitHub'daki son durum alınır: `git fetch`, `git log origin/main`, son Actions sonuçları,
  bu dosya ve `CLAUDE_HANDOFF.md`.
- Yerel kaydedilmemiş değişiklikler korunur. Başka bir dalda çalışmak gerekirse `git worktree` ile ayrı klasör
  kullanılır.
- Aynı dosyada eş zamanlı düzenleme yapılmaz. Hangi aracın hangi dosyada çalıştığı kullanıcıyla netleştirilir.
  Özellikle `index.html`'de bir seferde tek araç çalışır.
- Her geliştirme küçük, tek amaçlı ve açıklayıcı mesajlı commit'lerle kaydedilir.
- Başarılı ve güvenli değişiklikler GitHub'a gönderilir. Push öncesi yalnızca ilgili dosyaların commit'te olduğu
  doğrulanır.
- `main` korumalıdır: değişiklik PR ile gelir, zorunlu `test` ve **Koruma** denetimleri geçince (auto-merge) birleşir.
  Koruma (`.github/workflows/guard.yml`, `main`'deki kopyadan çalışır) `news/` dallarına yalnızca `content/articles/`
  altını değiştirtir; `.github/` altındaki her değişiklik depo sahibinin `workflow-onay` etiketini ister — bu etiketi
  ajanlar eklemez. `guard`'ın `main` kuralında zorunlu denetim olarak ekli olması gerekir (Settings → Branches);
  bu ayarı yalnızca depo sahibi değiştirir. `gh api repos/<repo>/branches/main/protection/required_status_checks`
  ile `contexts` içinde `test` ve `guard` görülmelidir.
- Her değişiklikten sonra kısa bir özet verilir: ne değişti, commit SHA, CI sonucu, yayın durumu ve neyin
  doğrulanmadığı.
- Gereksiz proje taraması, uzun planlama ve tekrar eden test/durum raporları yapılmaz.

## 5. Kullanıcı verileri
- `localStorage` ve `IndexedDB` anahtarları asla silinmez, sıfırlanmaz veya yeniden adlandırılmaz. Veri yapısına
  yalnızca geriye dönük uyumlu ekleme yapılır.
- Geri yükleme her zaman önizleme ve otomatik güvenlik kopyasından geçer. Bulut yedeğinde hesap sahipliği ve
  izolasyon testleri zayıflatılmaz.
- Kullanıcıya ilk adım olarak uygulamayı silip yeniden kurması önerilmez.

## 6. Arayüz
Mevcut arayüz ve tasarım korunur. Yeniden tasarım yapılmaz. Yalnızca istenen özellik için gereken en küçük
arayüz değişikliği yapılır.

## 7. Refactor ve testler
- Gereksiz refactor yapılmaz; yalnızca gereken en küçük değişiklik.
- `sw.js` ve `manifest.json`'a kanıt olmadan dokunulmaz. `sw.js` değişirse önbellek adı artırılır.
- Yalnızca değişiklikle ilgili testler çalıştırılır; tam paketi CI çalıştırır. Başarısız test silinmez,
  beklentisi gevşetilmez, sonucu olduğu gibi raporlanır.

## 8. GitHub'dan güncel durum takibi
- Doğruluk kaynağı GitHub `main` dalıdır. Önceki oturum raporları doğrulanmadan tamamlanmış kabul edilmez.
- Kontrol edilecekler: son commit'ler, Actions sonuçları, Releases (en son masaüstü yayını) ve canlı sürüm.
  Canlı sürüm için `version.json` ve `sw.js` önbellek adı kontrol edilir.
- Git güvenliği:
  - **Kullanılmaz:** `git reset --hard`, `git restore .`, `git checkout .`, `git pull` (yerel değişiklik varken),
    `git add -A`, `git add .`, force push.
  - Yalnızca adı verilen dosyalar stage edilir.
- Gizli bilgiler: istemciye yalnızca Supabase publishable anahtarı girer. Service role anahtarı, OAuth client
  secret ve token'lar koda, belgelere ve sohbete yazılmaz.
