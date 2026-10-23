# Words 44 — Makale okuma ve içerik kütüphanesi planı

Durum: **Planlandı, geliştirmeye başlanmadı** (2026-10-23).
Öncelik: Önce merkezi güncelleme altyapısı tamamlanacak (iPhone ana ekran güncellemesi, kimlik doğrulama ve veri
güvenliği). Bu plan o önceliklerin önüne geçmez. Mevcut arayüz bu plan için şimdilik değiştirilmez.

## Hedef mimari
- **Paylaşılan içerik.** Makaleler kullanıcı başına ayrı ayrı depolanmaz. Ortak içerik herkes için bir kez saklanır.
- **İçerik deposu: Cloudflare R2** (değerlendirilecek). Her makale sürümü sabit bir anahtarla saklanır,
  örneğin `articles/<slug>/<seviye>/<sürüm>.json`. Sürümlü ve değişmeyen dosyalar CDN'de uzun süre önbelleğe
  alınabilir. R2'nin dışarı veri çıkışı ücretsiz olduğu için okuma maliyeti düşüktür.
- **Metadata: Supabase.** Tablo `articles`: kimlik, slug, başlık, kategori, etiketler, mevcut seviyeler, seviye
  başına okuma süresi, yayın durumu, kaynak ve lisans, güncellenme zamanı. Yalnızca "yayınlanmış" satırlar herkese
  açık okunur (RLS).
- **Katalog.** Liste ve arama için veritabanına her seferinde sorgu atmak yerine R2/CDN'de sürümlü küçük katalog
  dosyaları tutulur. Gerekirse kategori ve seviye bazında parçalanır. Binlerce makaleye bu şekilde ölçeklenir;
  çok büyürse Supabase tam metin araması eklenir.
- **CDN:** Cloudflare üzerinden sunum. Yeni makaleler yeni içerik ve yeni katalog sürümüyle yayımlanır;
  **uygulama güncellemesi gerekmez.**
- **Telefonda önbellek.** Yalnızca açılan makaleler ve katalog saklanır. Boyut sınırlıdır; en eski açılanlar
  silinir. Service worker'da bunun için ayrı ve sınırlı bir çalışma zamanı önbelleği gerekir. Bu, ileride `sw.js`
  değişikliği demektir: önbellek adı artırılır ve güncelleme akışı korunur.
- **Hesaba bağlı kullanıcı verisi.** Kaydedilen makaleler ve okuma ilerlemesi Supabase'de kullanıcı başına
  tutulur (RLS, yalnızca kendi satırları). Önerilen tablolar: `user_article_progress` (user_id, article_id,
  seviye, konum, updated_at) ve `user_saved_articles`. Kelime listeleri mevcut Words 44 kelime yapısında kalır;
  hesaba taşınması mevcut bulut yedeği/senkronizasyon kararlarıyla uyumlu yapılır.
- **Düşük maliyet.** Okumalar CDN'den yapılır. Veritabanına yalnızca ilerleme ve kayıt yazımları gider.
  İlerleme yazımları seyreltilir (ör. birkaç saniyede bir ve sayfadan çıkarken). Çeviriler önbelleğe alınır.

## Makale kütüphanesi
- Kategoriler: akademik, bilim, teknoloji, hukuk, ekonomi, psikoloji, tarih ve diğerleri (genişletilebilir liste).
- CEFR seviyeleri A1–C2.
- Arama ve filtreleme: kategori, seviye, okuma süresi, kaydedilenler.
- Seviye başına okuma süresi, okuma ilerlemesi, kaydedilen makaleler.
- Sürekli büyüyen koleksiyon; yayın uygulama güncellemesinden bağımsız.

## Seviye sistemi
- Aynı makalenin farklı CEFR seviyelerinde sürümleri olur; hepsi aynı makale kimliğini paylaşır.
- Kullanıcı makaleyi açtıktan sonra seviyeyi değiştirebilir. Okuma konumu, sürümler arasında eşleştirilmiş
  paragraf kimlikleriyle korunur.
- Konu, temel bilgiler ve içerik doğruluğu her seviyede aynı kalır. Basitleştirilmiş sürümler yayımlanmadan önce
  doğruluk açısından gözden geçirilir.

## Okuma arayüzü
Mevcut Words 44 tasarım kimliği korunur. Profesyonel tipografi ve rahat okuma (mevcut okuma yazı tipi ve yazı
boyutu ayarları). Kullanıcı:
1. Tek kelimeye dokunarak Türkçe anlamını görür.
2. Kelimenin telaffuzunu dinler.
3. Kelimeyi mevcut Words 44 listelerine kaydeder.
4. Bir cümleyi seçerek Türkçeye çevirir.
5. Cümleyi sesli dinler.
6. Makalenin seviyesini değiştirir.
7. Kaldığı yerden devam eder.

## Mevcut sistemin yeniden kullanımı (ikinci bir sistem kurulmaz)
- Uygulamada zaten kişisel makale okuyucusu var: yapıştırılan veya içe aktarılan makaleler, dokunarak kelime
  anlamı, cümle çevirisi, okuma ilerlemesi. Kütüphane makaleleri **aynı okuyucu ve aynı kelime paneliyle** açılır.
- Kelime anlamı ve kaydetme: mevcut sözlük ve kelime paneli, `upsertWord` ve "＋ Listeye ekle" (aynı listede
  tekrar kaydı engeller, ilerlemeyi korur).
- Telaffuz ve sesli okuma: mevcut `speak()` (cihazın ses motoru, sözlükteki hız ayarı).
- Cümle çevirisi: mevcut makine çevirisi akışı (cihaz içi çevirmen, sonra MyMemory), "makine çevirisi" etiketiyle.
- Kullanıcının kendi yüklediği makaleler (`kelimelerim-v1-a`) aynen kalır. Silinmez, taşınmaz, kütüphaneyle
  karıştırılmaz.
- Bu belge yazıldığında bu parçaların `main`'deki güncel hali kodda yeniden doğrulanmalıdır.

## Çeviri ve maliyet
- Çeviri yalnızca kullanıcı istediğinde yapılır; tüm makale önceden çevrilmez.
- Sonuçlar cihazda önbelleğe alınır; aynı cümle tekrar çevrilmez. İleride sık cümleler için paylaşılan bir
  sunucu önbelleği değerlendirilebilir.
- Ücretsiz servis sınırları aşılınca sürekli yeniden deneme yapılmaz; kullanıcıya açıkça bildirilir.

## Güvenlik ve kalite
- **Telif hakkı:** Yalnızca özgün, lisanslı ya da kamu malı içerik. Her makalede kaynak ve lisans alanı zorunludur
  (ör. CC BY / CC BY-SA ise atıf gösterilir).
- **Güvenli metin işleme:** İçerik düz metin veya sınırlı ve doğrulanmış bir biçimde saklanır. Ekranda her zaman
  kaçışlı (escape) gösterilir; ham HTML çalıştırılmaz. Katalog ve içerik dosyaları şemaya göre doğrulanır.
- **Yayın yetkisi:** Makale ekleme ve değiştirme yalnızca yetkili bir yayın akışından yapılır (ör. CI veya
  yönetici aracı). R2 yazma anahtarları ve Supabase service role anahtarı yalnızca orada, gizli değişken olarak
  bulunur; istemciye asla girmez. İstemci yalnızca yayınlanmış içeriği okuyabilir.
- **Kullanıcı verileri korunur.** Mevcut localStorage/IndexedDB anahtarları değişmez; yalnızca geriye dönük
  uyumlu eklemeler yapılır.
- **Mevcut özellikler bozulmaz.** Her aşama kendi regresyon testleriyle gelir.

## Aşamalar (merkezi güncelleme altyapısı tamamlandıktan sonra)
1. **Okuma, salt okunur:** R2 + CDN'den birkaç makale ve katalog; mevcut okuyucuda açma; telefonda sınırlı önbellek.
2. **Hesaba bağlı veri:** Okuma ilerlemesi ve kaydedilen makaleler Supabase'de (RLS).
3. **Seviye sürümleri:** Seviye değiştirme ve konum eşleştirme.
4. **Ölçek:** Arama, filtreler, kategori ve seviye bazında katalog parçaları.
5. **Yayın akışı:** Yetkili yayın aracı, şema doğrulama, lisans kontrolü.

## Açık sorular
- İçeriği kim hazırlayacak ve nasıl gözden geçirilecek (özgün yazım, lisanslı kaynak, seviye uyarlaması)?
- Cloudflare R2 hesabı ve maliyet sınırları; Supabase ücretsiz katman sınırları.
- Ücretli sürümle ilişkisi (ör. bazı içerikler veya seviyeler premium mu olacak?).
