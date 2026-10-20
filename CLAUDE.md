# Words 44 — Geliştirme kuralları

Önce `PROJECT_CONTEXT.md` ve `TASKS.md` okunmalı. Kullanıcıyla Türkçe, kısa ve somut iletişim.

## Korunacaklar
- **Kullanıcı verileri:** `localStorage` anahtarları (`kelimelerim-v1`, `-s`, `-a`, `kelimelerim-v1-*`) ve
  `IndexedDB 44-guvenlik` asla silinmez, sıfırlanmaz, yeniden adlandırılmaz. Veri yapısına yalnızca geriye dönük
  uyumlu ekleme yapılır. Geri yükleme her zaman önizleme + güvenlik kopyası (`safeguard`) akışından geçer.
- **Mevcut özellikler ve tasarım:** İstenmeyen arayüz değişikliği ve gereksiz refaktör yapılmaz. Yalnızca istenen
  ve gereken en küçük değişiklik.
- **PWA:** `sw.js` ve `manifest.json`'a gerekmedikçe dokunulmaz. `sw.js` değişirse önbellek adı (`CACHE`) artırılır.
  Uygulama adresi, `start_url`, `id`, `scope` değiştirilmez.
- **Canlı adres** (`symphonious-donut-1c09bc.netlify.app`) ve Netlify site adı değiştirilmez.
- **Gizli bilgiler:** İstemciye yalnızca Supabase publishable anahtarı girer. Service role anahtarı, OAuth client
  secret, token, parola veya kişisel bilgi koda ve belgelere yazılmaz.

## Git
- Her işten önce: `git branch --show-current` ve `git status`.
- Yerel `index.html` GitHub'dakinden farklıdır ve kopyası yoktur. **Asla:** `git reset --hard`, `git restore .`,
  `git checkout .`, `git checkout -- <dosya>`, `git pull`, `git add -A`, `git add .`, `git commit -a`, force push.
- Yalnızca açıkça adı verilen dosyalar stage edilir (`git add -- <yol>`). Commit öncesi
  `git diff --cached --name-only` ile doğrulanır; listede beklenmeyen dosya varsa durulur.
- `main`'e doğrudan push yapılmaz; değişiklik dal + pull request ile gelir. Birleştirme kullanıcı onayıyla.
- `44-english-app/` iç klasörü ve `index (1).html` yerelde silinmiş görünür; bilinçli karar olmadan commit'lenmez.
- Riskli bir adımdan önce durulur ve kullanıcıya sorulur. Gerekirse önce ZIP yedeği alınır.

## Test ve dağıtım
- Testler: `node --test` (Node 24, kurulu Chrome; npm paketi yok). Dış servisler sahtedir; gerçek Supabase'e
  istek gönderilmez. Testler geçici Chrome profili kullanır; kullanıcının Chrome profiline dokunulmaz.
- Başarısız test silinmez, beklentisi gevşetilmez, uygulama kodu testi geçirmek için çarpıtılmaz; neden raporlanır.
- Yayın: `main` → Netlify otomatik. Yayından sonra canlı dosyanın commit ile aynı olduğu doğrulanır.
- Sonuçlar açıkça raporlanır: kaç test geçti/başarısız, neyin test edilmediği (gerçek Supabase, iPhone/WebKit),
  push ve yayın sonucu. Test edilmeyen bir şey test edilmiş gibi gösterilmez.
