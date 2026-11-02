# AI Factory kullanımı

Bu belge, depo sahibi ve ChatGPT'nin Words 44 için fabrikaya (Claude Code ile çalışan otomatik geliştirme)
nasıl görev vereceğini anlatır.

## 1. Görev verme
İki yol vardır:
- Yeni bir issue açın ve gövdeyi `@factory <görev>` ile başlatın.
- Mevcut bir issue'ya `@factory <görev>` yorumu yazın.

Yalnızca depo sahibinin hesabından gelen mesajlar işlenir. ChatGPT'nin GitHub bağlantısı depo sahibinin hesabını
kullandığı için onun yazdıkları da işlenir. Başka hesaplardan gelen `@factory` mesajları yok sayılır.

## 2. Geri bildirim
Aynı issue'ya ya da görevin açtığı PR'a yeni bir `@factory <mesaj>` yazın. Aynı Claude oturumu ve aynı çalışma
klasörü devam eder; önceki işin üzerine düzeltme yapılır.

## 3. Durum
`@factory durum` yazın. Fabrika görevin son durumunu bildirir.

## 4. Fabrikanın yaptıkları
- Her görevi izole bir `git worktree` içinde çalışır; başka yerel değişikliklere dokunmaz.
- Claude bitirdikten sonra testleri kendisi yeniden çalıştırır.
- Test başarısız olursa Claude'a en fazla 2 kez düzelttirir.
- İşi `factory/` ile başlayan bir dala push eder.
- Taslak (draft) PR açar.
- Sonucu issue'ya yorum olarak raporlar.

## 5. Fabrikanın yapmadıkları
- PR'ı birleştirmez (merge).
- `onay` ve `workflow-onay` etiketlerini eklemez.
- Yayın (deploy) yapmaz.

Bunları yalnızca depo sahibi yapar. `main` koruma kuralları (`CLAUDE.md` bölüm 4) aynen geçerlidir.

## 6. Bilgisayar kapalıyken
Fabrika depo sahibinin bilgisayarında çalışır. Bilgisayar kapalıyken yazılan görevler GitHub'da bekler;
bilgisayar açılınca işlenir.

## 7. Sorun giderme
- **Rapor gelmiyor:** Depo sahibinin bilgisayarının açık olduğunu ve fabrikanın çalıştığını kontrol edin.
- **Rapor ❌ diyor:** PR onaylanmaz. Aynı issue'ya `@factory <düzeltme isteği>` yazın.
