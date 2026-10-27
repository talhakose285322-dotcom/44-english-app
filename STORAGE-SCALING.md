# Words 44 — Depolama ve maliyet güvenlik planı

Bu belge hedefleri tanımlar; tamamlanmış özellik iddiası değildir.

## Mimari
- localStorage: mevcut küçük yerel kayıtlar; büyüyen veri kümeleri için kademeli IndexedDB geçişi.
- IndexedDB: kişisel kelimeler, listeler, ilerleme ve kullanıcıya ait makaleler için hedef cihaz deposu.
- Supabase: kimlik, kullanıcıya özel güvenli yedekler; gelecekte testli artımlı senkronizasyon.
- Cloudflare Worker: uygulama ve ortak hazır makale dağıtımı.
- Service Worker: geçici çevrimdışı önbellek; kullanıcı verilerinin tek kalıcı kaynağı değil.

## Değişmez güvenlik ilkeleri
1. Kullanıcı verisini açık onay olmadan silme veya üzerine yazma.
2. Migrasyon sırasında eski veriyi kopyala, doğrula, sonra yeni okuma yolunu etkinleştir.
3. Kota dolması, ağ kopması, iOS PWA kapanması ve iki cihazda eşzamanlı değişiklik senaryolarını test et.
4. Hazır makaleleri merkezi tut; kullanıcının içe aktardığı özel makaleleri ayrı koru.
5. Kişisel kelime veya okuma geçmişini maliyet ölçüm loglarına gönderme.
6. Sunucu tarafında RLS, kullanıcı izolasyonu, hız ve AI harcama limitleri olmadan yeni bulut özelliklerini açma.

## Uygulama sırası
1. PR #57 veri koruma düzeltmesini gözden geçir.
2. Cihaz üzerinde localStorage yaklaşık byte boyutu, IndexedDB ve Cache Storage kullanım tahmini ölçümü yap; API desteklemiyorsa bilinmiyor göster.
3. 1.000, 10.000 ve 50.000 kelimelik sentetik veride açılış, arama, kaydetme, tekrar ve yedeklemeyi test et.
4. Ölçümlere göre IndexedDB için sürümlü, geri alınabilir migrasyon tasarla.
5. Mevcut JSON yedeğini koruyarak artımlı senkronizasyonu ayrı PR'da tasarla: kayıt ID'si, revizyon, silme işareti, çakışma politikası ve RLS testleri.
6. Geçici önbellek için kota/LRU uygula; kullanıcı kayıtlarını asla otomatik temizleme.

## Maliyet denetimi
Aylık maliyet kalemleri: GB-ay depolama, veritabanı işlemleri, trafik/egress, istek sayısı, kimlik doğrulama, yedekleme ve AI kullanımı.

10.000 kullanıcı x 5 MB = yaklaşık 50 GB ham veri; indeksler, kopyalar ve trafik dahil değildir.

Cloudflare/Supabase kullanım panolarında uyarıları yapılandır; uyarılar harcamayı kendiliğinden durdurmayabilir. AI için sunucu tarafında kullanıcı ve toplam bütçe limiti gerekir. Gerçek sağlayıcı fiyatları doğrulanmadan kesin bütçe vaadi verilmez.

## Başarı ölçütleri
- Yerel veriler güncelleme, migrasyon ve geri yükleme sonrasında korunur.
- Büyük sentetik veri testleri ve gerçek cihaz testleri kayıt altındadır.
- Bulut maliyeti, aktif kullanıcı başına ve toplam aylık bazda takip edilebilir.
- Hiçbir adım sırf bu belge yazıldığı için tamamlandı sayılmaz.
