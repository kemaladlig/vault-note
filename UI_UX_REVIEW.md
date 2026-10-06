# VaultNote — Prod öncesi UI/UX kontrolü

Tarih: 2026-10-06 · Yöntem: Playwright ile gerçek Chromium'da mobil (390×844) ve masaüstü
(1280 / 1024 / 860 / 768 / 640) gezinme. Sunucu: `npm run dev` (localhost:5173), tek bir test
kasası (parola + "kilit yok" açılış modu) ile gerçek Argon2id/Dexie/CodeMirror üzerinde.

> Not: İnceleme sırasında aynı çalışma ağacında başka bir oturum `NoteList`, `NotesShell`,
> `NoteEditor` dosyalarını düzenliyordu ve dev sunucusu birkaç kez yeniden başladı. Aşağıdaki
> bulgular o anki çalışma ağacına aittir; özellikle Düzenleyici ile ilgili maddeler yeniden
> doğrulanmalı. TopBar/Dialog/Admin tarafı etkilenmemiştir.

Severity: **P0** = görünür/kırık, **P1** = can sıkıcı, **P2** = cila.

## Aksiyon durumu
- ✅ **#1** üst bar sütun çökmesi — `src/features/shell/ui/TopBar.tsx` düzeltildi.
- ✅ **#2** düzenleyici başlık taşması — `src/features/notes/ui/NoteEditor.tsx` düzeltildi.
- ✅ **#4** Ayarlar yatay kaydırma çubuğu — `src/components/ui/modal.tsx` + `SettingsDialog.tsx` düzeltildi.
- ✅ **#10** Ayarlar sekmeleri 390px'te 2×2 — `SettingsDialog.tsx` düzeltildi.
- ✓ **#3** tasarım gereği: şerit zaten `overflow-x-auto` ile kaydırılabilir (yalnız ipucu yok).
- ✓ **#7** geçersiz çıktı (metin zaten doğru), aksiyon yok.
- ✓ **#8** kasıtlı: son commit (`bcf4688`) global arama vurgusunu notta koruyor.
- ⏸ **#5, #6, #9, #11, #12, #13** — iyileştirme/tasarım kararı gerektiriyor, kullanıcıya bırakıldı.
- Doğrulama: `npm run lint` (yalnız mevcut uyarılar), `npm run build` ✓, `npm test` ✓ (115/115).

---

## P0 — Kırık / görünür problemler

### 1. Üst bar markayı ve panel düğmesini kırpıyor (≈640–900 px) — ✅ DÜZELTİLDİ
- **Belirti:** `sm` (640px) ile ~900px arasında masaüstü üst barının sol sütunu 0 px'e çöküyor;
  VaultNote logosu ve "Gezinmeyi gizle" düğmesi ekran dışında kalıyor. 640–860 arasında marka
  görselinin genişliği **0 px**; 1024'te ancak 34 px'e çıkıyor.
- **Kanıt:** `t-02-topbar.png` (yalnızca logonun bir dilimi görünüyor), ölçüm:
  `640 → 0px / 495 / 84`, `768 → 0px / 559 / 140`, `860 → 39px / 612 / 140`,
  `1024 → 172px / 612 / 172`.
- **Kök neden:** `TopBar.tsx:52` — `sm:grid-cols-[1fr_minmax(0,36rem)_1fr]`. Orta sütun 36rem'e
  kadar yer kaplayınca, sağ kümenin (Yeni not + uygulama menüsü) min-content'i (~140px) baskın
  geliyor ve sol `1fr` (`min-w-0` yüzünden) 0'a düşüyor.
- **Yön:** orta sütunu `minmax(0,1fr)` yapıp ayrı bir `max-width` ver ya da sol kümeyi
  `minmax(min-content,1fr)` / `shrink-0` ikonla koru. Tablet aralığında marka + toggle kalmalı.
- **Uygulandı:** `sm:grid-cols-[1fr_minmax(0,36rem)_1fr]` →
  `[minmax(min-content,1fr)_minmax(0,36rem)_minmax(min-content,1fr)]`. Doğrulama: 640–1280 arası
  marka 34px görünür, 1024/1280 simetri korunuyor. (`fix-topbar-768.png`)

### 2. Düzenleyici başlık araç çubuğu taşıp kırpılıyor (~768 px) — ✅ DÜZELTİLDİ
- **Belirti:** 768px'te düzenleyici başlığındaki ikon satırı panelden geniş; son düğmeler
  ("Sürüm geçmişi" / "Diğer işlemler") kesiliyor.
- **Kanıt:** `t-01-768.png`; ölçüm: başlık `scrollWidth 448 > clientWidth 400`, son düğme
  `right=800` vs panel `right=754`. 860px ve üzerinde taşma yok.
- **Kök neden:** `toolsOpen` `localStorage` yoksa `(min-width:768px)`'te açık varsayılıyor ve
  satır `shrink-0`; 768–1023 arası ikonlar sığmıyor.
- **Uygulandı:** `NoteEditor.tsx` — `isLg` eklendi; "Araçlar" düğmesi ve açılır grup `lg` altında
  gizlendi, `⋯` menüsü `lg` altında `mobileMenuItems`'ı (Sabitle/Bağlantılar/Sürüm geçmişi dahil)
  kullanıyor. Doğrulama: 768/900/1024/1280'de başlık `scrollWidth == clientWidth`, ⋯ menüsü
  Sabitle/Bağlantılar/Sürüm geçmişi'ni içeriyor. (`fix2-editor-768.png`, `fix2-editor-menu-768.png`)

### 3. Mobil biçimlendirme çubuğunun son düğmesi ekranın dışında — tasarım gereği (geçersiz)
- **Belirti:** Alttaki `EditorToolbar` şeridinde son düğme **"Yazı görünümü"** `right=421`,
  görüntü alanı 390 → ilk bakışta ekran dışında.
- **Düzeltme:** Şerit zaten `overflow-x-auto` + `no-scrollbar` (`EditorToolbar.tsx` docstring
  "horizontal scroll, safe touch targets") → parmakla kaydırılıp erişilebiliyor. Hata değil;
  yalnızca görünür kaydırma ipucu yok. İstenirse sağ kenara bir fade/gradient eklenebilir.

### 4. Ayarlar diyaloğunda yatay kaydırma çubuğu — ✅ DÜZELTİLDİ
- **Belirti:** Ayarlar diyaloğunun içeriğinde ince bir yatay kaydırma çubuğu (oklarla) görünüyor;
  masaüstünde de mobilde de.
- **Kanıt:** `ui-10-settings.png`, `ui-13-settings-data.png`, `m-05-settings.png`; ölçüm:
  `<dialog class="… overflow-y-auto …">` → `overflow-x` hesaplanan değeri `auto`
  (içerik 538 vs 534). Tek bir eksene `overflow-y:auto` verilince diğer eksen `visible`dan
  `auto`ya döner.
- **Yön:** diyaloğa `overflow-x-hidden` ekle (veya yalnız gerekli yerde `overflow-y-auto`).
- **Uygulandı:** `modal.tsx` `<dialog>` ve `SettingsDialog.tsx` tabpanel'e `overflow-x-hidden`
  eklendi. Doğrulama: diyaloğun `overflow-x` hesaplanan değeri `hidden`, alt scrollbar kayboldu
  (masaüstü + 390px). (`fix-settings.png`, `fix-settings-mobile.png`)

---

## P1 — İyileştirme

### 5. Mobil sekme şeridi sıkışık
- Aktif sekme "Alışveriş…" kırpılıyor; açık sekme sayısı **"2"** etiketsiz biçimde aktif sekmeyle
  `⋯` arasına sıkışıyor; mobilde sekmeyi kapatmanın görünür yolu yok (`⋯` içinde).
- Kanıt: `m-07-dark-editor.png`, `m-01-list.png`.
- Yön: sayaç rozetini `⋯` düğmesine taşı veya çıkar; sekmeleri kaydırılabilir/ küçültülebilir yap.

### 6. Boş Çöp / Arşiv için özel boş durum yok
- Çöp boşken genel **"Eşleşen not yok."** metni görünüyor; saklama süresi / "Asla" ayarı gibi
  bağlam yok. Kanıt: `d-02-trash.png`.
- Yön: kapsama özel boş durum metni (`Çöp boş`, `Arşivde not yok`) ve kısa açıklama.

### 7. ~~Metin hatası: "2 bekleyen değişiklikler."~~ (geçersiz)
- İlk okumada yanlış görüldü. Kaynak `shared/locales.ts` zaten `'{n} bekleyen değişiklik.'` (tekil).
  Kanıt: `ui-12-settings-sync.png` → "2 bekleyen değişiklik." Aksiyon gerekmiyor.

### 8. Global arama, nota içi arama çubuğunu da eşzamanlı açıyor — kasıtlı (bilgi)
- Üst bardaki global aramaya yazınca, açık notta nota-içi arama çubuğu aynı terimle açılıp
  "0 eşleşme" gösterebiliyor; iki arama alanı üst üste. Kanıt: `d-01-nomatch.png`.
- `NotesShell` `initialSearch={query}` aktarıyor; son commit `bcf4688` ("keep global search
  highlights in the open editor") bunu bilinçli yapıyor → hata değil. İstenirse yalnız sonuca
  tıklanınca açılacak şekilde daraltılabilir.

### 9. Komut paleti boş durumu
- "Son notlar" ilk ekranda görünmüyor; 8 eylem satırının altına düşüyor, kaydırma gerekiyor.
- Mobilde masaüstü kısayol ipuçları gösteriliyor (ör. **Ctrl B**). Kanıt: `ui-16-palette-empty.png`, `m-12-palette.png`.
- Yön: son notları üstte/flat göster; kısayol ipuçlarını dokunmatikte gizle.

### 10. Ayarlar sekme etiketleri 390px'te bitişik — ✅ DÜZELTİLDİ
- "GüvenlikSenkronizasyonVeri" neredeyse boşluksuz; dört sekme kenara dayanıyor.
  Kanıt: `m-05-settings.png`.
- **Uygulandı:** `SettingsDialog.tsx` sekme listesi `grid-cols-2 sm:grid-cols-4` — 390px'te 2×2,
  her etiket ~146px ve kırpılmıyor. (`fix2-settings-390.png`)
- Ayrıca `PROJECT_MAP.md` "Şablonlar" ve "Sürüm geçmişi"ni ayrı ayar bölümleri gibi anıyor ama
  tek "Veri" sekmesindeler; harita ile gerçek sekmeler çelişiyor.

---

## P2 — Cila

- **11.** Mobilde liste satırlarında pin/arşiv düğmeleri her zaman görünüyor (hover yok) → görsel
  gürültü; taşma menüsü veya kaydırma ile yapılabilir. Kanıt: `m-02-list.png`.
- **12.** `VaultNoteIcon` (`src/components/ui/vault-note-icon.tsx`) yükleme hatasında geri dönüşü
  yok; PNG yüklenmezse kırık resim + kırpık alt metin. Basit bir `onError` fallback eklenebilir.
  (İnceleme sırasında kilit ekranında geçici olarak gözlemlendi — sunucu yeniden başlıyordu.)
- **13.** Aynı anda birden çok diyalog/popover DOM'da bağlı (14 gizli input). Çift `aria-label`
  ve gereksiz mount riski; NotesShell düzenlemesi sonrası yeniden bakılmalı.

---

## İyi duranlar (korunmalı)
- Bağlamsal arama placeholder'ı: Çöp'te "Çöp içinde ara…".
- Arama paletinde eşleşme parçacıkları + vurgu; Türkçe-duyarlı arama.
- Live preview, boş durum ("İlk notunu oluştur"), no-flash boot, kilit onay akışı.
- Karanlık/açık tema tutarlı; mobil çekmece ve FAB düzeni temiz.

## Önerilen öncelik sırası
1 ✅ · 2 ✅ · 4 ✅ · 10 ✅ · 3/7/8 (geçersiz/kasıtlı) → **5 → 6 → 9 → 11 → 12 → 13.**

## Ekler (`.playwright-mcp/`)
`t-01-768.png`, `t-02-topbar.png`, `m-07-dark-editor.png`, `m-05-settings.png`,
`ui-10-settings.png`, `ui-12-settings-sync.png`, `ui-16-palette-empty.png`, `m-12-palette.png`,
`d-01-nomatch.png`, `d-02-trash.png`, `m-02-list.png`.
