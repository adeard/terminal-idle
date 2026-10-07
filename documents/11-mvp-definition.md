# 11 · MVP Definition

Batasan versi pertama yang dibuat dan dirilis, beserta kriteria selesainya.

## 1. Tujuan MVP

**Membuktikan bahwa loop inti "lihat bottleneck → upgrade → terminal tumbuh" menyenangkan dan membuat pemain kembali**, dengan biaya operasional mendekati nol. Data dikumpulkan lewat GA4 untuk memutuskan arah Phase 2 (monetisasi & distribusi).

Pertanyaan yang harus dijawab MVP:

1. Apakah pemain baru menyelesaikan tutorial (sampai Jalur 2)?
2. Apakah pemain kembali besok dan minggu depan?
3. Berapa lama sesi khas, dan sampai mana progres pemain (kelas terminal, jurusan)?
4. Apakah adegan 3D berjalan cukup lancar di HP kelas menengah ke bawah?

## 2. Bentuk rilis

| Aspek | Keputusan MVP |
|---|---|
| Platform | **Web PWA** di `bustation.games` (Cloudflare Pages), bisa dipasang ke layar utama |
| Perangkat utama | HP Android lewat browser; desktop juga didukung |
| Bahasa | Indonesia |
| Akun | Opsional (tamu bisa bermain penuh); login Google untuk cloud save |
| Monetisasi | **Tidak diwajibkan di MVP.** Iklan berhadiah terpasang tapi nonaktif sampai AdSense disetujui |
| Versi | `0.1.0` tayang (±1 Oktober 2026); kandidat `0.2.0` berisi fitur terbaru di repo |

## 3. Cakupan

### 3.1 Wajib (Must): semua ✅ di kode

| Area | Isi |
|---|---|
| Loop inti | Tiga tahap, upgrade eksponensial, milestone, bottleneck terlihat, terminal berjalan sendiri |
| Offline | Kepala tahap, penghasilan offline 4 jam × 50%, popup "Selama kamu pergi…" |
| Pengelolaan | Fasilitas (4), jalur bus (5), jurusan Jawa–Bali (8), kelas bus, modernisasi |
| Prestige | Naik kelas Tipe C → B → A → Terpadu dengan bonus permanen |
| Onboarding | Tutorial 4 langkah yang tidak menghalangi |
| Tujuan | Target harian, 18 penghargaan |
| Dunia | Adegan 3D maket dengan keramaian yang mencerminkan bottleneck; kualitas adaptif; fallback tanpa WebGL |
| Simpan | Save lokal, autosave 10 dtk, perlindungan save korup |
| Rilis | PWA, pembaruan in-game, kebijakan privasi |
| Data | Analitik GA4: corong tutorial, ringkasan sesi, error |

### 3.2 Sebaiknya (Should): ✅ sudah ikut di MVP

- Cloud save Google dengan deteksi konflik & hapus akun.
- Rute antarpulau, mitra PO dengan livery, event musiman, tantangan mingguan, rekor.
- Kepuasan penumpang dan pengaruhnya ke jumlah penumpang & pendapatan.
- Papan peringkat mingguan (web, login + persetujuan).
- Klakson telolet, siang–malam, cuaca, suara sintesis, pengumuman.
- Foto terminal & mode sinema (bahan promosi).

### 3.3 Kandidat v0.2.0 (sudah di repo, belum tentu dirilis)

- Tanpa tombol PROSES (terminal selalu berjalan).
- Penumpang datang mengikuti kepuasan & jam (malam berangsur sepi).
- Uang masuk per transaksi; HUD "Hari ini Rp X · N tiket".
- Harga tiket per jurusan & tambahan kelas dalam Rupiah, saran harga, penalti terlalu mahal.

### 3.4 Di luar MVP

| Tidak termasuk | Rencana |
|---|---|
| Pendapatan iklan aktif | Phase 2 (setelah AdSense & H5 Games Ads disetujui) |
| Rilis Play Store, login & iklan native di APK | Phase 2 |
| Portal web (CrazyGames/GameDistribution) | Phase 2 |
| Terminal kedua, skill aktif Kepala, event tambahan | Phase 3 (usulan) |
| Pembelian dalam aplikasi, mata uang premium, iklan paksa | Tidak direncanakan |
| Multiplayer, chat, perdagangan | Tidak direncanakan |

## 4. Kebutuhan non-fungsional

| Kebutuhan | Kriteria |
|---|---|
| Performa | Adegan tetap bisa dimainkan di HP kelas menengah ke bawah lewat kualitas adaptif; UI & simulasi berjalan sebelum 3D siap |
| Ketahanan data | Tidak ada kehilangan progres karena crash/tutup tab: autosave 10 dtk + simpan saat ke latar; save korup dicadangkan |
| Offline | Game bisa dibuka & dimainkan tanpa jaringan setelah dipasang (PWA); cloud & peringkat menyusul saat online |
| Keadilan | Hadiah tidak bisa digelembungkan lewat jam perangkat, harga tiket, mode sinema, atau parameter URL |
| Privasi | Kebijakan privasi ID/EN (UU PDP); nama terminal tidak dikirim ke analitik; hapus akun menghapus cloud save & skor papan |
| Biaya | Berjalan dalam kuota gratis Cloudflare (Pages, Workers, D1) & Firebase untuk ribuan pemain aktif |
| Kualitas kode | Typecheck strict lulus; seluruh tes Vitest lulus (645 tes per 6 Oktober 2026); simulasi greedy sesuai spreadsheet |

## 5. Kriteria selesai (Definition of Done)

- [x] Seluruh jalur dari game baru sampai naik kelas tersedia di UI. Naik kelas lewat popup konfirmasi di tab Target; logikanya dites.
- [x] Tutorial selesai otomatis saat Jalur 2 dibangun dan bisa dilewati kapan saja (dites).
- [x] Menutup & membuka lagi game mempertahankan progres; penghasilan offline benar (dites).
- [x] Layout portrait & landscape mengisi layar penuh; isi panel bisa digulir (dicek lewat screenshot).
- [x] Tanpa WebGL2, game menampilkan pesan dan tetap bisa dimainkan lewat panel (penanganan ada di `src/main.ts`).
- [x] PWA bisa dipasang; pembaruan versi tampil sebagai popup.
- [x] Peristiwa GA4 corong & ringkasan sesi terpasang (`tests/analitik.test.ts`); periksa di DebugView dengan `?analitik=debug`.
- [x] `npm run build` lulus (typecheck + build) dan `npm run test` hijau.
- [ ] Uji main dari 0 sampai Tipe B oleh pemain baru tanpa bantuan (belum dilakukan secara terstruktur).
- [ ] Rilis v0.2.0 dengan catatan "Yang baru" (fitur 3.3).
- [ ] Parameter peristiwa GA4 didaftarkan sebagai custom dimension/metric.
- [ ] Anggaran performa 3D ditinjau ulang (±300 draw call terukur vs target ±210 di tingkat 1).

## 6. Metrik keberhasilan

Ambang di bawah ini **usulan awal**. Tetapkan ulang setelah 2 minggu data dasar.

| Metrik | Sumber GA4 | Ambang awal usulan |
|---|---|---|
| Penyelesaian tutorial | `tutorial_begin` → `tutorial_complete` | ≥ 50% |
| Jalur 2 dibangun di sesi pertama | `buka_jalur` (jalur 2) / `mulai_game` (save baru) | ≥ 50% |
| Retensi D1 / D7 | Laporan retensi GA4 | ≥ 25% / ≥ 8% |
| Rata-rata sesi per pengguna aktif per hari | `ringkasan_sesi` | ≥ 2 |
| Pemain yang naik kelas pertama dalam 7 hari | `naik_kelas` (kelas 1) | ≥ 15% |
| Adegan 3D gagal dimuat | `adegan_gagal` / `mulai_game` | ≤ 3% |
| Error fatal per sesi | `exception` (`fatal`) | Mendekati 0 |

## 7. Daftar periksa rilis

1. Naikkan `version` di `package.json`; isi `catatan` di `src/config/rilis.config.ts`. Naikkan `versiMinimal` hanya bila format save tidak lagi kompatibel.
2. `npm run test` dan `npm run build` lulus.
3. Bila skema D1 berubah: `npx wrangler d1 migrations apply bustation-peringkat --remote` lebih dulu.
4. Bila `firestore.rules` berubah: tempel ulang di Firebase console.
5. Bila pemrosesan data berubah: perbarui `public/privasi.html` (ID & EN, tanggal berlaku).
6. `npm run deploy:web`.
7. Cek di situs: popup "Versi baru tersedia" muncul di klien lama; papan peringkat & login berjalan; DebugView GA4 menerima peristiwa.

## 8. Setelah MVP

Lihat [04 · Feature List & Scope](04-feature-list-scope.md):

- **Phase 2**: aktifkan iklan berhadiah, Play Store, portal web, video promosi.
- **Phase 3**: usulan konten (terminal kedua, skill Kepala, event tambahan).
