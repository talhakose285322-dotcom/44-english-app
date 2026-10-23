# Cloudflare Pages deployment

> **Migration status:** Do not treat Cloudflare as production until the deployed `pages.dev` site serves the current GitHub `main` commit and the production domain is verified. Keep Netlify available until that check passes. The existence of a `pages.dev` URL alone does not prove GitHub auto-deploy is connected.


Words 44 is a static PWA. This repository now includes a build script that creates a production-only `dist/` folder without changing the source app or the current Netlify setup.


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
