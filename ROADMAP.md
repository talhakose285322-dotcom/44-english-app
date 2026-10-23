# Words 44 — Ürünleştirme ve Yayına Hazırlık Görev Listesi

Bu, Words 44'ü güvenilir, veri kaybına dayanıklı ve ileride ücretli sunulabilecek bir ürüne dönüştürmek için ana takip listesidir. Bir madde yalnızca kod eklendiğinde değil, uygun test veya kanıt elde edilince tamamlandı sayılır. Gerçek cihaz, mağaza veya ödeme sağlayıcısı gerektiren adımlar masaüstü otomatik testleriyle tamamlanmış kabul edilmez.

## Çalışma ilkeleri
- Mevcut arayüzü sebepsiz yere yeniden tasarlama.
- Kelimeleri, listeleri, makaleleri, öğrenme ilerlemesini ve yedekleri koru.
- Küçük ve odaklı değişiklikler yap; ilgili testleri çalıştır.
- Yayın/cihaz doğrulaması olmadan “canlı” veya “tamamlandı” deme.
- Gizli anahtarları depoya veya tarayıcı koduna koyma.
- Ücretsiz kullanım seçeneğini koru; fiyatları ve ücretli özellikleri doğrulamadan uydurma.
- Gerçek cihaz veya hesap gerektiren işleri açıkça ayır.

## Faz 0 — Yayın zinciri ve sürüm doğruluğu
- [x] 0.1 Üretim paketinin gerekli dosyaları ve yasal sayfaları içerdiğini doğrula (üretim paketi testi başarılı; tanıtım/gizlilik/koşullar yedek yayında açıldı).
- [x] 0.2 Sürüm numarası testini düzelt ve otomatik testleri yeşile getir (c162c4a; testler başarıyla tamamlandı).
- [x] 0.3 version.json ile uygulama içindeki sürümün eşleştiğini doğrula (kaynak + üretim sürümü eşleşmezse build başarısız; bd97215 commit'inde otomatik test başarılı).
- [x] 0.4 GitHub Pages yedek yayınını tamamla; tanıtım, gizlilik ve kullanım koşulları sayfalarını canlı adresten aç (c162c4a yayını başarılı; üç sayfa erişilebilir).
- [x] 0.5 Ana Cloudflare Pages yayın yöntemini ve GitHub main dalına otomatik dağıtımı doğrula; 2026-10-23 tarihinde `version.json` (1.0.10), `sw.js` (english-app-v17) ve güncel `index.html` üretim adresinde doğrulandı.
- [x] 0.6 Test hatası, yayın hatası ve dağıtım beklemesini birbirinden ayır (önceki Chrome başlatma hatası paralel test kaynak çakışmasıydı; sıralı çalıştırma ile testler geçti).

Çıkış ölçütü: otomatik testler başarılı, sürüm bilgisi doğru, yedek yayın erişilebilir ve ana yayın yöntemi belgelenmiş.

## Faz 1 — Veri güvenliği ve geri yükleme
- [x] 1.1 Kelimeler, listeler, makaleler ve öğrenme ilerlemesi için veri şemasını belgele (DATA-SAFETY.md; kaynak kodda görülen yerel anahtarlar, IndexedDB kopyaları ve yedek biçimi).
- [x] 1.2 Veriyi ezebilecek işlemlerde açık onay ve güvenli hata davranışını test et (backup-restore.test.mjs: tam değiştirme onayını iptal etme ve veri koruma; bulut yedekleme hatası testleri).
- [x] 1.3 Bozuk/eksik/eski yedeklerde yerel verinin değişmeden kaldığını doğrula (bozuk JSON, gelecek sürüm, eski dizi biçimi ve bulut yedeği hata senaryoları test edildi).
- [ ] 1.4 Bulut yedeğinin yalnızca oturum açmış kullanıcının verisine eriştiğini doğrula.
- [x] 1.5 Dışa/içe aktarma akışını ve yedek biçiminin taşınabilirliğini kontrol et (83447e6: JSON dışa aktarımı ve temiz tarayıcı depolamasına içe aktarma; kelime, öğrenme kutusu, makale ve ayar korunumu otomatik testte başarılı. Gerçek cihaz aktarımı ayrıca Faz 2.5/7.6'da).
- [x] 1.6 Cihaz değişimi, hesap kaybı ve veri saklama sınırlarını açıkça anlat (DATA-TRANSFER.md: JSON aktarımı, farklı alan adları, hesap erişimi, IndexedDB 15 kopya sınırı ve otomatik senkronizasyonun bulunmaması).

Çıkış ölçütü: güncelleme veya geri yükleme kullanıcının verisini sessizce silmez ya da ezmez.

## Faz 2 — Web/PWA güncellemeleri
- [ ] 2.1 Service worker önbelleğini incele; gereksiz manifest veya service worker değişikliği yapma.
- [ ] 2.2 İlk kurulum, eski önbellek, çevrimdışı açılış, ağ hatası ve yeni sürüm algılama senaryolarını test et.
- [ ] 2.3 Kullanıcı yazarken, kelime kaydederken veya işlem sürerken otomatik yenileme olmadığını doğrula.
- [ ] 2.4 version.json önbellekleme başlıklarını ve sürüm göstergesini canlıda doğrula.
- [ ] 2.5 Masaüstü, iPhone ana ekran PWA'sı ve Android PWA için ayrı gerçek cihaz sonuçları kaydet.
- [ ] 2.6 Güncelleme başarısız olduğunda eski çalışan sürümün kullanılabilirliğini doğrula.

Çıkış ölçütü: web güncelleme ve veri koruma otomatik testlerle; iOS/Android PWA davranışı gerçek cihazlarda doğrulanmış.

## Faz 3 — Giriş, oturum ve bulut senkronizasyonu
- [ ] 3.1 Giriş yapmadan kullanımın sürdüğünü doğrula.
- [ ] 3.2 Google OAuth dönüş adreslerini web, iOS ve Android akışlarına göre yapılandır.
- [ ] 3.3 iPhone Google girişini gerçek cihazda doğrula; passkey/QR ve uygulamaya dönüş sorunlarını çöz.
- [ ] 3.4 Android Google girişini gerçek cihazda doğrula.
- [ ] 3.5 Oturum süresi dolması, çıkış ve ağ kesintisinde verilerin korunduğunu test et.
- [ ] 3.6 Cihazlar arası yedekleme, birleştirme ve çakışma kurallarını test et.
- [ ] 3.7 Hesap ve kullanıcı verisi silme sürecini belirle.

Çıkış ölçütü: giriş isteğe bağlı, desteklenen hedeflerde Google girişi doğrulanmış, kullanıcıların bulut verileri birbirine karışmıyor.

## Faz 4 — Öğrenme özelliklerinin kalite kontrolü
- [ ] 4.1 Sözlük sonuçları, kelime türleri, Türkçe karşılıklar ve boş sonuç durumlarını kontrol et.
- [ ] 4.2 Örnek cümle çevirilerinin kalite ve kaynak sınırlarını doğru anlat.
- [ ] 4.3 Listeye ekleme, tekrar ekleme, birden fazla liste ve silme senaryolarını test et.
- [ ] 4.4 Kart tekrar planlaması ile Biliyorum/Bilmiyorum ilerlemesini test et.
- [ ] 4.5 Makale okuma, kelime seçme, ilerleme ve PDF içe aktarma/inceleyip kaydetme akışlarını test et.
- [ ] 4.6 Çevrimdışı temel özellikleri ve çevrimiçi servis arızalarını test et.
- [ ] 4.7 Mobil ekran, klavye, erişilebilir etiketler ve hata mesajlarını kontrol et.

Çıkış ölçütü: temel öğrenme akışlarında kritik hata yok; hata durumları tekrarlanabilir testlerle kapsanmış.

## Faz 5 — Ürün ve satış modeli
- [ ] 5.1 İlk hedef kullanıcıyı ve temel ürün vaadini netleştir.
- [ ] 5.2 Ücretsiz ve ücretli özellikleri ayır; çalışan temel özellikleri sebepsiz kilitleme.
- [ ] 5.3 Ücretli özellikleri kullanıcı geri bildirimi ve gerçek kullanım sinyalleriyle doğrula.
- [ ] 5.4 Fiyat, deneme, yenileme, iptal ve iade koşulları belirlenmeden satış metni yayımlama.
- [ ] 5.5 Web ödeme ve mağaza içi satın alma gereksinimlerini seçilecek sağlayıcı ve mağaza kurallarına göre belirle.
- [ ] 5.6 Satın alma doğrulama, abonelik durumu, yenileme, iptal ve ödeme hatası akışlarını kur.
- [ ] 5.7 Ücretli erişimini yalnızca arayüzde değil, güvenli sunucu tarafı kontrollerle doğrula.
- [ ] 5.8 Vergi, komisyon ve destek maliyetlerini içeren gelir senaryoları oluştur.

Çıkış ölçütü: gerçek test ortamında satın alma ve iptal uçtan uca çalışıyor; kullanıcı koşulları satın almadan önce anlıyor.

## Faz 6 — Tanıtım, destek ve güven
- [ ] 6.1 Tanıtım sayfasında gerçek özellikleri ve platform durumunu doğru anlat.
- [ ] 6.2 Gizlilik ve kullanım koşullarını gerçek veri ve ödeme modeliyle uyumlu tut.
- [ ] 6.3 Hata bildirimi ve kullanıcı desteği kanalı belirle.
- [ ] 6.4 Analitik gerekiyorsa veri minimizasyonu ve açık bilgilendirmeyle uygula.
- [ ] 6.5 İlk kullanım rehberi ve geri bildirim akışı oluştur.
- [ ] 6.6 Arama motoru, paylaşım meta etiketleri ve alan adı yönlendirmelerini doğrula.

Çıkış ölçütü: kullanıcı ürünü anlayıp deneyebilir ve destek/gizlilik bilgilerine ulaşabilir.

## Faz 7 — App Store ve Google Play
- [ ] 7.1 iOS ve Android paketleme yaklaşımını seç; PWA ile yerel paket arasındaki farkları belgele.
- [ ] 7.2 Apple Developer ve Google Play Console hesap, ücret ve doğrulama gereksinimlerini kontrol et.
- [ ] 7.3 Paket kimlikleri, imzalama, ikonlar, açılış ekranları, izinler ve OAuth dönüşlerini yapılandır.
- [ ] 7.4 Mağaza gizlilik beyanları, ekran görüntüleri, açıklamalar ve yaş derecelendirmesini hazırla.
- [ ] 7.5 TestFlight ve Google Play internal testing sürümleri oluştur.
- [ ] 7.6 Gerçek cihazlarda giriş, çevrimdışı kullanım, veri koruma, güncelleme ve satın almayı test et.
- [ ] 7.7 Mağaza incelemesine gönder ve düzeltme taleplerini ele al.
- [ ] 7.8 Web içeriği güncellemeleriyle yeni yerel paket gerektiren değişiklikleri ayır.

Çıkış ölçütü: mağazada yayımlandığı ancak mağaza bağlantısı ve sürümü doğrulanınca söylenir; paket üretmek yayınlanmış olmak değildir.

## Faz 8 — Lansman ve büyüme
- [ ] 8.1 İlk 20–50 test kullanıcısını bul ve geri bildirim topla.
- [ ] 8.2 Aktivasyon, haftalık geri dönüş, öğrenme oturumları ve ödeme dönüşümünü mahremiyete uygun biçimde ölç.
- [ ] 8.3 Kritik hataları önceliklendir; sırf kapsamı büyütmek için özellik ekleme.
- [ ] 8.4 İlk ücretli kullanıcıları kazanmak için küçük deneyler yap; sonuçları ve maliyetleri kaydet.
- [ ] 8.5 Yedekleme, geri alma ve olay müdahale adımlarını belgele.

Çıkış ölçütü: ürün kullanımı ve ödeme isteği hakkında gerçek verilere dayanarak karar verilebiliyor.

## Mevcut durum ve ilk iş
- Tamamlanan işler yalnızca kanıtı görüldükten sonra işaretlenir.
- Öncelik: Faz 0.5 — ana Cloudflare yayınının güncel commit'i sunmasını sağlamak; ardından Faz 1 veri güvenliği testlerine devam etmek.
- Doğrulanan: bd97215 commit'inde üretim paketi doğrulaması ve tüm otomatik testler başarılı; GitHub Pages yedek yayını başarılı. Veri geri yükleme testleri bozuk/gelecek/eski biçimli yedekleri, birleştirmeyi, açık değiştirme onayını ve yalnız ayarlar varken güvenlik kopyasını kapsıyor.
- Canlı GitHub Pages yedek sürümü 1.0.8; tanıtım, gizlilik ve kullanım koşulları sayfaları erişilebilir.
- Önemli açık sorun (23 Ekim 2026 canlı kontrol): ana Cloudflare Pages `https://44-english-app.pages.dev/version.json` hâlâ 1.0.6 gösteriyor; GitHub Pages yedeği 1.0.8. Cloudflare kontrol panelinde üretim dalı ve Git entegrasyonu doğrulanmadan 0.5 tamamlanmış sayılmaz; adımlar CLOUDFLARE-DEPLOY.md'de kayıtlı.
- Veri şeması ve yedek davranışı DATA-SAFETY.md dosyasında belgelenmiştir. Restore öncesi koruma mantığı, yalnız ayarlar saklıyken de yedek alacak şekilde düzeltildi ve otomatik testten geçti (fcd2017).
- App Store/Google Play yayınları ve uçtan uca ödeme henüz doğrulanmış değil.
