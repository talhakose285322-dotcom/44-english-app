# Words 44 — Görevler

Son güncelleme: 2026-10-20.

## Tamamlananlar (canlıda)
- Güvenli otomatik güncelleme (service worker, ETag ile yalnız `index.html` yayınları, güvenli yenileme).
- Sözlük: Türkçe Vikisözlük, türe göre gruplu karşılıklar, ilk 3 örneğin otomatik çevirisi.
- Sözlük: "＋ Listeye ekle", okuma hızı.
- Google ile giriş (Supabase, PKCE) — bilgisayarda çalışıyor.
- Profil'de "Uygulamayı yükle" paneli (yerelde kaldırıldı, bkz. bekleyenler).

## Tamamlananlar (yalnızca yerelde, `pending-app-changes`)
- Elle bulut yedeği / geri yükleme (`cloud_backups`, RLS).
- E-postayla 6 haneli kodla giriş.
- Geri yükleme birleştirmesinde liste üyelikleri ve boş listeler.
- Ekle formu ve toplu eklemede yinelenen kayıt düzeltmesi.
- Profil'deki yükleme panelinin kaldırılması.
- Otomatik test paketi (13 dosya, 57 test) ve GitHub Actions iş akışı.
- Yerel klasörün git deposu yapılması (dosyalara dokunulmadan), tam ZIP yedeği.

## Bekleyen sorunlar
1. **Testlerde Chrome temizleme hatası.** Yerel toplu çalıştırmada 57 testin hepsi geçti, ama 6 dosyanın kapanışında
   geçici Chrome profil klasörü silinemedi (`EPERM`) ve çalıştırma testler bittikten sonra takıldı (dış süre
   sınırıyla durduruldu). Ayrı ayrı çalıştırmalarda sorun yok. Muhtemel neden: Chrome kapandıktan sonra alt
   işlemlerin klasörü kısa süre kilitli tutması. Önerilen düzeltme yalnızca `tests/lib/browser.mjs` `close()`:
   önce DevTools `Browser.close`, işlemin bitmesini bekle, klasör silinemezse uyarı ver. İş akışına
   `--test-timeout=60000`. `%TEMP%` altında 8 artık `words44-test-*` klasörü var.
2. **iPhone'da Google girişi.** Safari'de çalışıyor; ana ekran uygulamasının depolaması ayrı olduğu için Safari
   oturumu oraya geçmez. Ana ekran uygulamasının içinden girişte Google bazen geçiş anahtarı/QR ekranı gösteriyor
   ve "Başka bir yol dene" görünmeyebiliyor. Kalıcı çözüm adayı: e-postayla kodla giriş (yerelde hazır; Supabase
   şablonlarına `{{ .Token }}` gerekir, gerçek kullanıcılar için özel SMTP).
3. **Gerçek Supabase testleri yapılmadı:** bulut yedeği (yükle → test kelimesini sil → geri yükle) ve e-postayla
   giriş (aynı e-postanın Google hesabıyla aynı kullanıcıya bağlandığını "Giriş yöntemleri" ve Supabase Users
   listesiyle doğrula).
4. **`tests-ci` pull request'i açılmadı;** GitHub Actions hiç çalışmadı. Ardından `main` için branch protection
   (PR zorunlu, `test` kontrolü zorunlu, force push yok).
5. **Ekle sekmesindeki eski "Telefona uygulama olarak ekle" metni** duruyor (kaldırılması istenebilir).
6. **Depo temizliği kararı:** GitHub'daki `44-english-app/` iç klasörü ve `index (1).html` gerekli mi?

## Sonraki mantıklı adımlar
1. Test altyapısının kapanış/temizleme düzeltmesi (yalnızca `tests/`), ardından aynısını `tests-ci`'ye ekle.
2. `tests-ci` için PR aç, Actions sonucunu doğrula, birleştir, branch protection'ı aç.
3. Gerçek Supabase ile bulut yedeği ve e-postayla giriş testi (bilgisayar, sonra iPhone ana ekran uygulaması).
4. Bekleyen uygulama değişikliklerini ve kalan 7 test dosyasını tek PR ile yayımla.
5. Mağazalar öncesi: hesap silme, gizlilik politikası, Apple ile giriş; tanıtım sitesi ayrı bir Netlify sitesi
   olarak (`site/` klasörü), uygulama adresine dokunmadan.
