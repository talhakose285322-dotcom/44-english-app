# Günlük seviyeli haberler — üretim kuralları

Bu belge, "Haberler" kategorisine her gün eklenen içeriğin nasıl hazırlanacağını tanımlar. Günlük otomatik görev
(Claude) ve elle haber ekleyen herkes bu kurallara uyar. Haberler **her zaman bir dal + PR ile** gelir. Günlük görevin
PR'ı **auto-merge** ile açılır: `main` korumalıdır ve zorunlu `test` denetimi (katalog doğrulaması dahil tüm testler)
geçmeden birleşmez; geçerse kullanıcı onayı beklemeden yayına girer. Yanlış bir haber, klasörü silen bir PR ile
kaldırılır. Uygun haber yoksa o gün hiçbir şey yayımlanmaz; haber zorla üretilmez.
Ayrıca zorunlu **Koruma** denetimi (`.github/workflows/guard.yml`, `main`'deki kopyadan çalışır) `news/` dallarının
`content/articles/` dışında dosya değiştirmesine izin vermez; `.github/` altındaki her değişiklik depo sahibinin
`workflow-onay` etiketini ister.

## Akış

1. `main`'den `news/YYYY-MM-DD` adlı dal aç. Önce `content/articles/catalog.json`'daki son 30 günün haberlerine bak;
   aynı olayı tekrar yazma.
2. Güvenilir kaynaklardan (NASA, ESA, üniversite basın bültenleri, hakemli dergi haberleri, Reuters/AP/BBC gibi
   ajanslar) son 3–7 günün gelişmelerini oku. Her olguyu en az bir birincil kaynaktan doğrula.
3. Öğrenmeye uygun **1–3 haber** seç: bilim, uzay, teknoloji, sağlık araştırması, çevre, kültür, spor, ekonomi.
   **Seçme:** savaş, terör, ölüm/felaket ayrıntıları, suç, seçim kampanyaları, tartışmalı siyasi figürler, tek bir
   şirketin reklamı gibi duran haberler, doğrulanamayan iddialar.
4. Her haber için `content/articles/<id>/` klasörü:
   - `meta.json`: `category: "news"`, başlık (İngilizce), Türkçe özet, `published` (bugün), lisans
     (`"Words 44 için kaynaklardaki bilgilerden özgün olarak yazılmıştır. © Words 44."`), `image`, `sources`, `vocab`.
   - `A1.json` … `C2.json`: her seviyede **aynı sayıda paragraf** (3 önerilir) ve 3 anlama sorusu (`questions`).
5. `node scripts/build-article-catalog.mjs` çalıştır, sonra en az
   `node --test --test-concurrency=1 tests/article-content.test.mjs tests/build.test.mjs` (tarayıcı varsa tüm
   testler: `node --test --test-concurrency=4 --test-timeout=60000`). Hata varsa düzelt; doğrulamayı ve testleri
   gevşetme. Düzeltilemeyen haber yayımlanmaz.
6. Yalnızca yeni klasörleri ve `catalog.json`'u stage et (`git add -- <yol>`), commit'le, dalı gönder, PR aç ve
   auto-merge'i aç. PR açıklamasında her haberin kaynaklarını ve görselin lisans sayfasını listele. `index.html`,
   `sw.js`, testler ve diğer dosyalar haber görevinde değiştirilmez.

## Metin

- Haberin metni kaynaktan **kopyalanmaz**; olgular kendi cümlelerimizle yazılır. Doğrudan alıntı en fazla bir kısa
  cümle ve tırnak içinde, kimin söylediği belirtilerek.
- Sayılar, tarihler, adlar kaynakla birebir aynı olmalı. Emin olunmayan ayrıntı yazılmaz.
- Seviyeler gerçekten farklı olmalı:
  - **A1:** şimdiki/geçmiş zaman, kısa cümleler (ortalama ≤ 12 kelime, doğrulama bunu denetler), temel kelimeler, ~60–80 kelime.
  - **A2:** basit bağlaçlar, ~90–120 kelime.
  - **B1:** ayrıntı ve neden-sonuç, ~130–170 kelime.
  - **B2:** karmaşık cümleler, alıntı, sınırlılıklar, ~160–200 kelime.
  - **C1/C2:** gazete ve akademik dil, deyimler, yorum; ~170–220 kelime.
  - A1 → B2 arasında her seviye bir öncekinden kısa olamaz (doğrulama denetler).
- Araştırma haberlerinde sınırlılıklar (örneklem, finansman, tek çalışma olması) en az B1'den itibaren yazılır.
- `vocab`: 5–8 önemli kelime ve Türkçe karşılığı. `questions`: seviyeye uygun 3 soru ve kısa cevap.

## Görsel

- Yalnızca **açık lisanslı** görsel: kamu malı (NASA, ESA'nın kamu malı olanları, ABD kamu kurumları), CC0, CC BY,
  CC BY-SA. Ajans, gazete ya da stok sitesi fotoğrafı **kullanılmaz**.
- Önerilen kaynak: Wikimedia Commons. Lisans, dosyanın Commons sayfasındaki bilgiden kontrol edilir (API
  `extmetadata.LicenseShortName`). Lisans belirsizse görsel kullanılmaz.
- Wikimedia çok sık istekte "429 Too Many Requests" döner ya da görsel yerine bir hata sayfası (HTML) indirir:
  istekleri tek tek ve aralarında birkaç saniye bekleyerek gönder, her istekte User-Agent başlığı olsun; 429 gelirse
  30–90 saniye bekleyip tekrar dene. İndirilen dosyanın gerçekten JPEG olduğunu (ör. `file image.jpg`) kontrol et.
- Olayın kendi fotoğrafı yoksa konuyla ilgili bir görsel seçilir ve `alt` metninde "örnek görsel" diye belirtilir.
- Dosya: `image.jpg`, Commons'ın 960 px küçük kopyası, en fazla 400 KB (doğrulama denetler).
- **Her makalenin fotoğrafı farklıdır.** Seçmeden önce `content/articles/*/meta.json` içindeki `image.source` değerlerine
  bak; aynı Commons sayfası ya da aynı dosya ikinci kez kullanılamaz (doğrulama reddeder). Benzer bir sahneyi de seçme
  (ör. iki haber için iki kapsül fotoğrafı yerine biri kapsül, biri ekip ya da gezegen).
- `image`: `alt` (Türkçe), `credit` (fotoğrafçı/kurum), `license` (ör. "Kamu malı (NASA)", "CC BY-SA 4.0"),
  `source` (Commons dosya sayfası, https).

## Kimlik ve adlandırma

- Klasör adı: küçük harf İngilizce kelimeler ve `-` (ör. `perseverance-sets-mars-driving-record`), en fazla 80 karakter.
- Aynı olay için ikinci haber açılmaz; gelişme varsa yeni bir haber yazılır ve ilk haberden söz edilir.
