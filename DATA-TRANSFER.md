# Words 44 — Cihaz değişimi, hesap erişimi ve veri saklama

Bu belge, veri kaybını önlemek için mevcut uygulamanın **bugünkü** davranışını açıklar. Otomatik cihazlar arası eşitleme veya sınırsız saklama taahhüdü değildir.

## Yeni telefona veya bilgisayara geçerken

1. Eski cihazda Words 44'ü açıp mevcut **yedek dışa aktarma** seçeneğiyle tam JSON yedeğini dosya olarak kaydet. Dosyayı eski cihazdan bağımsız, güvenli bir yerde tut.
2. Yeni cihazda uygulamayı aç; yedek **içe aktarma** bölümünden dosya içeriğini yükle ve önizlemesini kontrol et.
3. Önce **birleştir** seçeneğini tercih et. Bu seçenek mevcut kayıtları korumayı hedefler. **Tam değiştir** mevcut verilerin yerini alabileceği için yalnızca sonuçlarını anladığında kullan.
4. Yeni cihazda kelime listelerini, öğrenme ilerlemesini ve makaleleri kontrol etmeden eski cihazın site verilerini silme.

**Önemli:** Bir web sitesinin veya yüklü PWA'nın tarayıcı depolaması farklı alan adları, tarayıcılar, telefonlar veya uygulama paketleri arasında kendiliğinden taşınmaz. Cloudflare, GitHub Pages ve Netlify adresleri birbirinden ayrı depolama alanları kullanır. Bir adresten diğerine geçmek için ayrıca yedek aktarımı gerekir.

## Hesap erişimi kaybolursa

- Yerel kelimeler, makaleler ve ilerleme giriş yapılmadan da aynı cihazın ilgili site depolamasında bulunabilir. Ancak tarayıcı/site verisi silinmişse geri getirileceği garanti edilemez.
- Google/Supabase oturumuna erişemiyorsan bulut yedeğine erişimin de engellenebilir. **Yerel JSON yedeğini** hesap erişiminden bağımsız sakla.
- Google ile tekrar giriş yapmak, başka cihazdaki yerel kayıtları otomatik olarak aktarmış sayılmaz. Mevcut bulut yedekleme kullanıcı tarafından başlatılan ayrı bir işlemdir.
- Hesap kurtarma veya silme için doğrulanmış bir destek akışı tamamlanana kadar hesap kurtarmanın garanti edildiği söylenmemelidir.

## Saklama sınırları ve riskler

- Uygulama ana verileri tarayıcı `localStorage` alanında, yerel güvenlik kopyalarını `IndexedDB` içinde saklar. Bu alanlar tarayıcı/işletim sistemi temizliği, uygulamanın kaldırılması, gizli gezinme veya depolama kotası nedeniyle silinebilir.
- Aynı cihazdaki IndexedDB güvenlik kopyaları **en fazla 15 kayıt** tutar; harici yedek yerine geçmez.
- Bulut yedekleme, açıkça başlatılmadığı sürece otomatik senkronizasyon değildir. Bulutta saklama ve hesap erişimi ayrıca servis durumuna ve erişim politikalarına bağlıdır.
- Uygulamayı güncellemek normalde verileri silmemelidir; buna rağmen **cihaz veya alan adı değişiminden önce** harici JSON yedeği al.
- Verinin hassas olduğunu düşünüyorsan yedek dosyasını şifreli veya erişimi kısıtlı bir yerde sakla; paylaşılan bilgisayarlarda bırakma.

## Geliştirme sırasında doğrulanması gerekenler

- İndirilen JSON dosyasının başka tarayıcı/cihazda içe aktarılabilmesi ve tüm kayıt türlerinin korunması otomatik testle doğrulanmalı.
- iPhone ana ekran PWA'sı, Android PWA ve mağaza paketleri için gerçek cihaz geçişleri ayrıca doğrulanmalı.
- Bulut verisine yalnız oturum sahibi erişimi Supabase RLS ile gerçek oturumlar kullanılarak ayrıca doğrulanmalı.

İlgili teknik şema: [DATA-SAFETY.md](DATA-SAFETY.md).
