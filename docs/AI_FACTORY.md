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
- Test başarısız olursa Claude'a sınırlı sayıda düzeltme turu yaptırır (bkz. bölüm 8; tur sayısı bu depodaki dosyalarla doğrulanamadı).
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

## 8. İlk teslimat: kaynakla doğrulanmış bilgiler (#76)
Aşağıdakiler depodaki dosyalardan doğrulandı. Runner'ın kendi kaynak kodu bu depoda yok (yalnızca
`scripts/factory/claude-pro-bridge.mjs` var); bu yüzden runner'ın iç davranışı için "doğrulanamadı" yazıldı.

### 8.1 İki ayrı yol: karıştırmayın
| | `@factory` | `@claude` |
|---|---|---|
| Nerede çalışır | Depo sahibinin bilgisayarındaki yerel runner | GitHub Actions (`.github/workflows/claude.yml`) |
| Tetik | issue/yorumda `@factory` | issue veya PR inceleme yorumunda `@claude` (yalnızca OWNER/MEMBER/COLLABORATOR) |
| Kimlik | Yerel Claude Code oturumu | `CLAUDE_CODE_OAUTH_TOKEN` secret'ı |
| Sınır | Bilgisayar açık olmalı | `--max-turns 8`, 30 dk zaman aşımı |

Biri diğerinin yerine geçmez; hangisinin çalıştığını yorumdaki etiketten anlayın.

### 8.2 Testler ve CI
- Words 44'te runner'ın yerel komutu Node testleridir: `node --test --test-concurrency=1 --test-timeout=60000`
  (`tests.yml` ile aynı komut).
- PR açılınca CI ayrıca şunları çalıştırır: `tests.yml` (Testler; önce `node scripts/build-static.mjs`),
  `browsers.yml` (Tarayıcılar; Playwright ile WebKit ve Firefox), `guard.yml` (Koruma) ve Cloudflare'in PR önizlemesi
  (Cloudflare Git entegrasyonu; `CLOUDFLARE-DEPLOY.md`, bu depodaki bir iş akışından değil).
- **Bilinen açık:** Runner PR'ı açtıktan sonra bu asenkron CI sonuçlarını beklediği, depodaki dosyalarla
  doğrulanamadı. Bu açık kapatılmadı. "Onaya hazır" raporundan önce `gh pr checks <PR>` ile `test`, Tarayıcılar ve
  `guard` sonuçlarını ayrıca doğrulayın. Yerelde geçen test, CI'nin geçtiği anlamına gelmez.

### 8.3 Kurulum önkoşulları ve maliyet sınırları
- Node.js 18+, GitHub CLI (`gh`) giriş yapılmış, Claude Code kurulu ve Claude Pro hesabıyla giriş yapılmış
  (`docs/CLAUDE_PRO_LOCAL_BRIDGE.md`).
- API anahtarı yok: `ANTHROPIC_API_KEY` tanımlıysa köprü betiği başlamayı reddeder (plansız API faturasını önlemek için).
  Ücretli API/faturalama açık onay olmadan açılmaz.
- Yerel oturum, ayrı bir CLI çalıştırmasıdır; VS Code'daki canlı konuşmaya bağlanmaz. Pro kullanım limitleri geçerlidir.
- Köprü betiği salt okunurdur (`--permission-mode plan`, `--max-turns 8`). `@factory` runner'ının tur sınırı bu
  depodan doğrulanamadı; hedef, varsayılan en fazla bir otomatik düzeltme turudur (#76 gereksinimi). Bölüm 4'teki
  eski "2 kez" ifadesi bu hedefle uyuşmuyor; gerçek değer runner yapılandırmasından teyit edilmeli.
- `claude.yml` yolu ayrıca `.github/` altındadır; değişiklikleri `workflow-onay` etiketi ister.

### 8.4 Güvenli minimal PoC akışı
1. Depo sahibi, uygulama kodu gerektirmeyen küçük bir görevi (ör. belge düzeltmesi) `@factory` ile yazar.
2. Runner izole dalda çalışır, yerel Node testlerini çalıştırır, `factory/` dalına push eder, taslak PR açar ve
   issue'ya rapor yazar.
3. Depo sahibi PR'ı inceler; CI sonuçlarını (bölüm 8.2) kontrol eder.
4. Birleştirme ve yayın yalnızca depo sahibinin elindedir.

### 8.5 Merge ve deploy: manuel sahip onayı
Belge, uygulama, test ve otomasyon değişiklikleri `guard.yml` gereği depo sahibinin `onay` etiketi olmadan
birleşemez (`.github/` için `workflow-onay`). Etiket yalnızca depo sahibi eklediyse sayılır; onaydan sonra yeni commit
gelirse etiket kaldırılır. Yalnızca `content/articles/` içeriği kendiliğinden birleşebilir. Fabrika ve ajanlar etiket
eklemez, birleştirmez, `--admin` kullanmaz. `main` birleşmesi Cloudflare yayınını tetikler (`CLAUDE.md` bölüm 1);
bu yüzden her birleştirme fiilen bir yayındır ve sahip onayı gerektirir.
