# Haftalık kategori makalesi — üretim kuralları

Kütüphanede her gün haber eklenir; diğer kategoriler (akademik, bilim, sağlık, tarih…) ise kendiliğinden büyümez.
Bu yüzden haftada bir, haber olmayan **kalıcı (zamana bağlı olmayan)** bir makale eklenir. Haftalık otomatik görev
(Claude) ve elle makale ekleyen herkes bu kurallara uyar. Metin, seviye ve görsel kuralları için
`docs/NEWS_PIPELINE.md` geçerlidir; burada yalnızca farklı olanlar yazılıdır.

## Kategori seçimi

- `content/articles/catalog.json` içinde `news` ve `other` dışındaki her kategorinin makale sayısı sayılır
  (kategoriler: `scripts/build-article-catalog.mjs` → `CATEGORIES`).
- **En az makalesi olan kategori** seçilir. Eşitlikte şu sıra kullanılır: academic, science, health, psychology,
  environment, technology, economics, history, culture, law.
- Akademik makaleler sınava (YDS, YÖKDİL, IELTS) hazırlananlar için önemlidir: C1/C2 seviyesinde akademik metin
  diline (hedge, cohesion, nominalisation) özellikle yer verilir.

## Konu

- Zamana bağlı olmayan, öğretici bir konu: bir kavram, bir süreç, bir buluşun hikâyesi, bir araştırma yönteminin
  açıklaması (ör. "How Vaccines Train the Immune System", "What Is Opportunity Cost?").
- Kütüphanede olan bir konu tekrarlanmaz (başlıklara ve özetlere bakılır).
- **Seçilmez:** siyaset ve tartışmalı siyasi kişiler, din, savaş, suç, tıbbi tavsiye (genel sağlık bilgisi olur,
  "şu ilacı kullan" olmaz), reklam gibi okunan şirket konuları, doğrulanamayan iddialar.
- Bilgiler güvenilir kaynaklardan doğrulanır (üniversite, kamu kurumu, ansiklopedi, hakemli dergi özeti) ve
  `meta.sources` içinde listelenir. Metin özgündür; kaynaklardan cümle kopyalanmaz.

## Biçim

- Klasör: `content/articles/<id>/`, haberlerle aynı yapı: `meta.json`, `A1.json` … `C2.json`, `image.jpg`.
- `meta.category`: seçilen kategori (asla `news`). `meta.published`: bugünün tarihi (Europe/Istanbul).
- `meta.license`: `"Words 44 için özgün olarak yazılmıştır. © Words 44."`
- Altı seviyenin hepsi yazılır; her seviyede 4 paragraf, `vocab` (5–8 kelime) ve `questions` (3 soru) bulunur.
  Seviye uzunlukları `docs/NEWS_PIPELINE.md`'deki kuralların biraz üstünde olabilir (kalıcı makale daha uzundur),
  ama A1 kısa ve basit kalır (ortalama cümle ≤ 12 kelime) ve A1 → B2 her seviye bir öncekinden kısa olmaz.
- Görsel: haberlerle aynı kurallar (açık lisans, benzersiz fotoğraf, 960 px, ≤ 400 KB).

## Akış

- Dal: `news/haftalik-YYYY-MM-DD` (Koruma denetimi `news/` dallarında yalnızca `content/articles/` değişikliğine
  izin verir; birleşince e-posta bildirimi de gider).
- PR başlığı: `Haftalık makale YYYY-MM-DD: <başlık>`; otomatik birleştirme açılır, `test` ve `guard` geçince birleşir.
