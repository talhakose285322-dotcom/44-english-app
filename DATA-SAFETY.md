# Words 44 — Veri şeması ve yedekleme davranışı

Bu belge, `index.html` içindeki mevcut veri saklama ve yedekleme kodunun özetidir. Kaynak koddaki anahtar adları uyumluluk için sabit tutulmalıdır.

## Yerel tarayıcı verileri

| Anahtar / alan | İçerik | Davranış |
| --- | --- | --- |
| `kelimelerim-v1` | Kelime kayıtları ve okunamayan/geçersiz kayıtların korunmuş bölümü | JSON dizisi. Geçerli kelimede `w` metin olmalı; `m` varsa metin olmalı. Eksik `id` oluşturulur; `box` 0–3 aralığına normalize edilir. |
| `kelimelerim-v1-s` | Ayarlar ve çalışma/öğrenme istatistikleri | JSON nesnesi. Ayarlar kaydedilirken aynı anahtar adı korunmalı. |
| `kelimelerim-v1-a` | Makaleler | JSON dizisi. Geçerli makalede `title` ve `text` metin olmalı; eksik `id` oluşturulur. |
| `kelimelerim-v1-` önekli diğer anahtarlar | Gelecekteki/ek özelliklere ait veriler | Tam yedeğe `extra` alanı olarak eklenir; geri yüklemede var olan değerler birleştirme modunda ezilmez. |

Depolama okunamıyorsa veya bir anahtarın JSON'u bozuksa, uygulama özgün ham değeri `BLOCK` içinde tutar ve normal kaydetme yoluyla üstüne yazmayı engeller. Geçersiz kelime/makale kayıtları da yedek toplama ve kaydetme sırasında korunmak üzere ayrı tutulur. Depolama hatası oluştuğunda kullanıcıya uyarı gösterilir.

## Otomatik yerel güvenlik kopyaları

- IndexedDB veritabanı: `44-guvenlik`.
- Object store: `snaps` (otomatik artan `id`).
- Kopya kaydı zaman damgası, neden, kelime/makale sayıları ve tam yedek JSON'unu içerir.
- Günlük otomatik kopya alınabilir; geri yüklemeden önce de güvenlik kopyası denenir.
- En fazla 15 kopya tutulur. Bunlar aynı tarayıcı/uygulama depolamasına bağlıdır; site verileri silinirse kaybolabilir ve cihazlar arasında eşitlenmez.

## Taşınabilir yedek biçimi

Tam yedek biçimi:

- `format: "44-backup"`
- `version: 1`
- `app: "44"`
- `created`: ISO tarih/saat
- `counts`: kelime ve makale sayıları
- `keys`: üç ana yerel anahtarın değerleri
- `extra`: `kelimelerim-v1-` önekli ek anahtarlar
- `unreadable`: kurtarma amacıyla okunamayan özgün değerler

İçe aktarma JSON'u ayrıştırır, biçim/sürüm ve temel veri tiplerini kontrol eder, geçerli kelime/makale kayıtlarını ayırır ve önizleme sunar. Sürüm 1'den daha yeni yedekler reddedilir; eski dizi biçimi ve `kelime-paketi` biçimi de tanınır. Geri yükleme öncesinde mevcut verinin kopyası alınmaya çalışılır; kopya alınamazsa dosya indirme/onay yolu kullanılır. Birleştirme modu mevcut veriyi silmez; değiştirme modu açık kullanıcı seçimi gerektirir.

## Bulut yedekleme

Bulut yedekleme yerel saklamadan ayrıdır ve kullanıcı oturum açtığında kullanılabilir. Yedekleme/geri yükleme kullanıcı tarafından başlatılır; bu, cihazlar arası otomatik senkronizasyon anlamına gelmez. Bulut satırı kullanıcı kimliğiyle ilişkilendirilir. Her bulut isteği yanıtından sonra aktif hesabın değişmediği kontrol edilir; hesap istek sürerken değişirse yanıt yerel geri yükleme önizlemesine aktarılmaz. Bu istemci kontrolü Supabase RLS politikalarının yerine geçmez; üretim RLS politikaları ayrıca doğrulanmalıdır. Bu davranışın güvenliği otomatik testlerle ve Supabase RLS politikalarıyla ayrıca doğrulanmalıdır.

## Veri güvenliği için değişmez kurallar

1. Anahtar adlarını veya yedek `format/version` alanlarını geriye dönük uyumluluk planı olmadan değiştirme.
2. Hatalı/eksik yedeği uygulamadan önce yerel veriyi silme.
3. Üzerine yazan geri yüklemeden önce güvenlik kopyası ve açık onay sağla.
4. Başarısız kaydetme veya yedekleme işlemini başarılı gibi gösterme.
5. Yedekleme kodunda gerçek kullanıcı verisi veya gizli anahtar bulundurma.
6. Yedek dosyasını farklı cihazda geri yükleme senaryosunu otomatik testlerle kapsa.
