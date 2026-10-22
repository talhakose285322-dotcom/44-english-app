# Words 44 — Android ve iOS mağaza yol haritası

Bu belge, mevcut statik HTML/PWA uygulamasını koruyarak mağaza sürümlerine hazırlanmak için güvenli geçiş planıdır.

## Mevcut ürünün temel kuralı
- Web uygulamasının ana kaynağı bu depodaki `index.html`, `manifest.json` ve `sw.js` dosyalarıdır.
- Canlı web uygulaması: https://44-english-app.pages.dev/
- Tanıtım sayfası: https://44-english-app.pages.dev/welcome.html
- Kullanıcının yerel kelime listeleri ve çalışmaları korunmalı; ilk mağaza sürümünde veri silen bir geçiş yapılmamalıdır.
- Giriş zorunlu olmamalı. Bulut yedekleme/senkronizasyon ayrı ve açık bir kullanıcı tercihi olarak kalmalıdır.

## Aşamalar

### 1. Web sürümünü sabitle ve yedekle
- Mağaza paketlemesine başlamadan önce çalışan web sürümünü ayrı bir Git etiketiyle işaretle.
- Test hesabı ve örnek verilerle dışa aktarma/geri yükleme senaryosunu doğrula.
- Gerçek kullanıcı verileri üzerinde otomatik migrasyon çalıştırma.

### 2. Android paketi
- Capacitor gibi bir web-to-native köprüyle mevcut uygulamayı paketlemek seçeneğini değerlendir.
- Önce ayrı bir dalda dene; mevcut Cloudflare Pages dağıtımını değiştirme.
- Android uygulama kimliği (applicationId), imzalama anahtarının güvenli saklanması ve sürüm numaralandırması belirlenmeden yayın yapma.
- Google Play'in güncel hedef API, gizlilik formu, veri güvenliği ve test gerekliliklerini yayın öncesinde doğrula.

### 3. iOS paketi
- iOS derleme ve imzalama için macOS/Xcode veya uyumlu bir bulut derleme ortamı gerekir.
- Bundle ID, Apple Developer üyeliği, imzalama/provisioning ve App Store Connect kayıtları gerekir.
- iOS paketinin aynı kökenli web uygulamasıyla karıştırılmaması ve yerel veriyi silmemesi için ayrı test yapılmalı.

### 4. Mağaza öncesi zorunlu testler
- Yeni kurulumda giriş yapmadan açılma.
- İnternet yokken desteklenen özelliklerin çalışması.
- Google girişi ve çıkış.
- Boş cihazdan yedek yükleme ve mevcut veriyi koruyarak geri yükleme.
- Uygulama güncellemesi sonrası kelime listeleri ve makalelerin kalması.
- Ekran boyutları, klavye, geri tuşu ve dış bağlantılar.
- Gizlilik açıklaması ve destek iletişim adresi.

## Şu an yapılmayanlar
Bu belge tek başına native uygulama üretmez, mağazaya yüklemez, Apple/Google hesaplarını veya imzalama anahtarlarını oluşturmaz. Bunlar ancak yapılandırma ve gerçek cihaz testlerinden sonra yapılmalıdır.
