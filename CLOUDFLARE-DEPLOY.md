# Cloudflare deployment

Words 44 is a static PWA. `scripts/build-static.mjs` creates a production-only `dist/` folder from the source app.

## Güncel durum (12 Kasım 2026; Cloudflare API ve canlı `version.json` ile doğrulandı)

| Adres | Rolü | Nasıl yayımlanıyor | Durum |
|---|---|---|---|
| https://words44.words44.workers.dev | **Ana adres (production).** Kullanıcıya bu verilir. | Worker `words44`, `wrangler.jsonc` (yalnızca statik dosyalar, `./dist`; betik, API ya da binding yok). Workers Builds her `main` push'unda `node scripts/build-static.mjs` + `npx wrangler deploy` çalıştırır. | `main` ile aynı (1.3.0) |
| https://talhakose285322-dotcom.github.io/44-english-app | Yedek | `.github/workflows/pages-backup.yml` | `main` ile aynı (1.3.0) |
| https://44-english-app.pages.dev | İkincil; kullanıcıya verilmez | Cloudflare Pages `44-english-app`, Git'e bağlı, `main` + tüm dallar için önizleme. Cloudflare'daki build command ve output directory **boş** (aşağıdaki ayarlarla uyuşmuyor; #130). | `*.pages.dev` Türkiye ağlarında engelli. Masaüstü uygulaması hâlâ bu adrese bağlı (#129). |
| https://symphonious-donut-1c09bc.netlify.app | Eski | Güncellenmiyor | Service worker `v10`; depo dosyalarını ham sunuyor (#131) |

Google girişi dönüşü `location.origin + location.pathname` olduğundan her adres Supabase izin listesinde ayrıca bulunmalıdır; liste doğrulanmadı (#132). Veriler adrese göre ayrı tutulur: adres değişirse kullanıcı verisi yedekle taşınır.

Aşağıdaki bölümler geçmiş kayıttır; o tarihteki ölçümleri ve Pages'e geçiş planını anlatır.


## 24 Ekim 2026 — erişim ve yayın durumu (geliştirici bilgisayarının Türkiye bağlantısından ölçüldü)

- `*.pages.dev` bu bağlantıda **SNI ile engelli**: TCP bağlanıyor, TLS el sıkışması kesiliyor; aynı Cloudflare IP'si
  başka bir adla (`developers.cloudflare.com`) ve `*.workers.dev` adlarıyla yanıt veriyor. Sorun sitede değil, ağda.
  Telefon operatörlerinde aynı engelin olup olmadığı ölçülmedi.
- GitHub Pages yedeği her `main` push'unda otomatik yayımlanıyor ve güncel (1.0.10, hazır makaleler dahil).
- Netlify (`symphonious-donut-1c09bc`) `1616b9e` (21 Ekim 21:11) sonrasında hiç yayımlamadı; sonraki commit yalnızca
  test dosyası, yani neden kod değil Netlify'daki derleme ayarı/durumu.
- Güncelleme kodu (network-first `sw.js`, `no-store` sürüm kontrolü, `_headers`) değişiklik gerektirmiyor. Ana ekran
  uygulaması yalnızca kurulduğu adresten güncellenir; adres değişirse yerel veri yedek/geri yükleme ile taşınmalıdır.
- Özel alan adı teknik olarak zorunlu değil: Netlify yeniden yayımlarsa ya da Cloudflare `workers.dev` kullanılırsa
  güncelleme bu ağdan erişilebilir bir adresten gelir.

## 23 Ekim 2026 — doğrulanmış yayın uyuşmazlığı

- Kaynak `main` dalında uygulama ve takip edilen `version.json` sürümü: **1.0.8**.
- Ana Cloudflare Pages `https://44-english-app.pages.dev/version.json` yanıtı: **1.0.6**, `builtAt: managed-by-git`.
- GitHub Pages yedeği `https://talhakose285322-dotcom.github.io/44-english-app/version.json` yanıtı: **1.0.8**; derleme zaman damgası mevcut.
- Bu sonuç, ana Cloudflare adresinin güncel `main` içeriğini **sunmadığını** kanıtlar. Tek başına GitHub bağlantısının neden çalışmadığını veya Cloudflare projesinin hangi kaynakla yayımlandığını göstermez.
- Cloudflare hesabındaki **Workers & Pages → 44-english-app → Deployments** bölümünde son production deployment commit'ini, Git repository bağlantısını, production branch `main` değerini, build command `node scripts/build-static.mjs` ve output `dist` ayarlarını doğrula. Bağlantı yoksa Git entegrasyonunu kur; varsa yeni production deployment başlat. Bu hesap işlemleri yapılmış gibi raporlanmamalı.
- Düzeltme sonrasında iki URL'nin `version.json` sürümü ve üretim `builtAt` alanı yeniden kontrol edilmeli; gerçek iPhone PWA güncellemesi ayrıca test edilmeli.

## Cloudflare Pages settings

- **Connect repository:** `talhakose285322-dotcom/44-english-app`
- **Production branch:** `main`
- **Build command:** `node scripts/build-static.mjs`
- **Build output directory:** `dist`
- **Root directory:** leave blank (repository root)
- **Environment variables:** none required for the static build

The script copies only the app's runtime files (`index.html`, PWA manifest/service worker, icons, and PDF.js assets). It excludes tests, old backup HTML files, and other repository-only files from the deployed site.

## Safe migration order

1. Create a new Cloudflare Pages project connected to GitHub; do not change or delete the existing Netlify project.
2. Deploy `main` and test the generated `pages.dev` URL: app loads, install/PWA behavior works, PDF import works, Google login and cloud backup work.
3. Add the existing custom domain only after the preview is verified. Update DNS only when ready to switch.
4. Keep Netlify available until the new host and the production domain are confirmed working.

Cloudflare's Git integration creates preview deployments for pull requests. The app's Google OAuth redirect allowlist in Supabase must include the final production URL; temporary preview URLs may not be allowed. After switching domains, test Google sign-in on iPhone and desktop before announcing the migration.
