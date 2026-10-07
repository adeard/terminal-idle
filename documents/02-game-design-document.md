# 02 · Game Design Document (GDD)

Dokumen utama seluruh gameplay dan sistem **Bustation: Idle Bus**. Angka ekonomi rinci ada di [05 · Game Economy Design](05-game-economy-design.md), progres pemain di [06 · Player Progression Design](06-player-progression-design.md), dan alur layar di [07 · UI/UX Flow](07-ui-ux-flow.md).

Sumber kebenaran: `src/sim/` (logika murni & formula), `src/config/economy.config.ts` (angka tuning), `src/config/waktu.config.ts` (jam & ritme).

---

## 1. Ikhtisar permainan

Pemain mengelola terminal bus. Penumpang mengalir lewat tiga tahap berurutan:

```
Peron (turun dari bus) → Loket (beli tiket) → Keberangkatan (naik bus)
```

Arus penumpang terminal = kapasitas tahap **paling lambat**, dibatasi lagi oleh banyaknya penumpang yang datang. Penumpang yang datang ditentukan kepuasan, jam terminal, dan harga tiket. Uang masuk dari tiket, parkir bus, parkir kendaraan pengantar, dan sewa kios. Pemain membelanjakan uang untuk memperbesar kapasitas, membangun fasilitas, membuka jurusan, dan meningkatkan armada. Setelah cukup besar, pemain **naik kelas** (prestige): terminal dibangun ulang dengan bonus pendapatan permanen.

Terminal **selalu berjalan** sejak game dimulai, tanpa perlu diketuk. Saat game ditutup, terminal hanya terus menghasilkan uang bila ketiga tahap sudah punya **Kepala**.

---

## 2. Rantai tahap & bottleneck

| Tahap | Peran | Kapasitas awal | Biaya upgrade awal | Biaya Kepala |
|---|---|---|---|---|
| Peron | Penumpang turun dari bus kedatangan | 1,0 pnp/dtk | Rp 15 | Rp 50 |
| Loket | Penumpang membeli tiket | 0,8 pnp/dtk | Rp 22 | Rp 150 |
| Keberangkatan | Penumpang naik bus | 0,9 pnp/dtk | Rp 30 | Rp 400 |

- **Kapasitas** tahap di level L = `(kapAwal + tambahKap × (L − 1)) × 2^(jumlah milestone tercapai)`. Milestone ada di level 25, 50, 100, dan 200, masing-masing menggandakan kapasitas.
- **Biaya upgrade** = `biayaAwal × r^(L − 1)` (r = 1,08 / 1,085 / 1,09).
- **Throughput** = min(kapasitas ketiga tahap). Tahap dengan kapasitas terkecil adalah **bottleneck**. Di UI tahap itu ditandai "⚠ PALING LAMBAT" (kartu berkedip merah, label di peta, sorotan merah di lantai). Di adegan 3D, antrean orang menumpuk tepat di depannya.
- Pengali kapasitas lain:
  - **modernisasi** ×1,15–1,30 per tahap;
  - **jalur bus** +40% per jalur tambahan, hanya untuk Peron & Keberangkatan. Loket sengaja tidak ikut, supaya setelah membangun jalur pemain perlu mengejar loket lagi.
- Kapasitas tahap tidak pernah nol. Semua tahap selalu berjalan.

**Keputusan inti pemain**: selalu ada satu tahap yang membatasi. Meng-upgrade tahap lain hanya berguna untuk persiapan. Kepuasan "kelancaran" juga turun bila satu tahap tertinggal jauh dari tahap tercepat.

---

## 3. Kepala tahap & penghasilan offline

- Kepala direkrut **sekali bayar** per tahap (Rp 50 / 150 / 400). Kepala tidak mengubah arus saat game dibuka.
- Bila **ketiga** tahap punya Kepala, terminal menghasilkan uang saat game ditutup. Hitungannya: pendapatan/detik saat keluar (dari kapasitas, tanpa ritme jam) × min(waktu pergi, **4 jam**) × **50%**. Harga tiket ikut dihitung, tapi hasilnya tidak bisa melebihi harga normal.
- Kurang satu Kepala saja, penghasilan offline = 0. HUD menampilkan petunjuk "Rekrut Kepala di ketiga tahap supaya terminal tetap jalan saat kamu pergi" sampai ketiganya direkrut.
- Saat kembali (pergi ≥ 30 detik), muncul popup **"Selama kamu pergi…"** dengan durasi, penghasilan, dan tombol **Ambil**. Bila iklan tersedia, ada juga **Ambil 2×** lewat iklan.
- Kepala ikut direset saat naik kelas.

---

## 4. Penumpang yang datang (permintaan)

Arus nyata tidak selalu sebesar kapasitas. Banyaknya calon penumpang ditentukan tiga hal:

1. **Daya tarik kepuasan** = `1 + 0,6 × kepuasan`. Makin puas penumpang, makin banyak yang datang.
2. **Ritme jam & hari** = `0,4 + 0,6 × keramaian`. Keramaian berkisar 0,11 (dini hari) sampai 0,9+ (jam sibuk 06–09 & 16–19), dengan penyesuaian per hari: Senin pagi, Jumat & Minggu sore, dan Sabtu lebih ramai, Minggu pagi lengang. Malam hari terminal berangsur sepi, tapi tidak pernah berhenti.
3. **Peminat karena harga tiket** (lihat bagian 6).

```
permintaan = daya tarik × ritme              (relatif terhadap kapasitas)
arus nyata = kapasitas × kursi terisi        (kursi terisi ≤ 100%)
```

- Di jam sibuk, permintaan bisa melebihi kapasitas, sehingga penumpang antre di bottleneck.
- Rata-rata sehari kapasitas terisi ±84% (kepuasan 30%), ±91% (67%, terminal baru), dan ±94% (90%). Dini hari terisi ±55–72%.
- HUD "Arus X pnp/dtk", uang, progres target penumpang, event, tantangan, dan skor papan peringkat semuanya mengikuti **arus nyata**.

---

## 5. Pendapatan: uang masuk per transaksi

Ada empat sumber uang. Uang **masuk per transaksi**, bukan sebagai aliran per detik.

| Sumber | Kapan dibayar | Besar dasar |
|---|---|---|
| **Tiket** | Tiap penumpang yang membeli tiket | Harga jurusan + tambahan kelas (normal: Rp 5 × bonus jurusan × bonus PO × bonus kelas bus) |
| **Parkir kendaraan** (pengantar & penjemput) | Tiap penumpang | Rp 0,15 × level Parkir Kendaraan |
| **Parkir bus jurusan** | Tiap bus (= 20 penumpang) | Rp 5 × level Parkir Bus Jurusan |
| **Sewa kios** | Sekali sehari saat hari terminal berganti (tengah malam) | Belanja Rp 0,2 × level Kios per penumpang × (1 + 10% × level Toilet), dikumpulkan sepanjang hari |

- Semua sumber dikali **pengali pendapatan**: prestige (+10% per poin) × event musiman × bonus kepuasan, dan boost iklan 2× bila aktif.
- Pecahan penumpang atau bus yang belum utuh disimpan (ikut save). Total uang jangka panjang = arus × harga, tanpa ada yang hilang.
- HUD tidak menampilkan laju per detik. Yang tampil adalah **"Hari ini Rp X · N tiket"** (hasil hari terminal ini). Laju per detik tetap dipakai di dalam sim untuk offline, boost, dan hadiah "N menit pendapatan".
- Di adegan, efek **"+Rp"** muncul di tempat transaksi: jendela loket, bus yang parkir, lorong parkir, dan kios. Saat hari berganti, sewa kios tampil sebagai "+Rp" emas besar.

---

## 6. Harga tiket per jurusan & kelas bus

Pemain mengatur harga dalam **Rupiah**:

```
tiket = harga jurusan + tambahan kelas bus
```

| Pengaturan | Tempat | Rentang | Langkah |
|---|---|---|---|
| Harga jurusan (tiap jurusan yang sudah dibuka) | Tab Jurusan → "Harga tiket per jurusan" | 50–200% harga normal | 10% harga normal per ketukan −/+ |
| Tambahan kelas (tiap kelas bus yang beroperasi) | Tab Armada | +Rp 0 sampai +100% harga normal | 10% harga normal per ketukan |

- Harga disimpan relatif terhadap harga normal. Jadi saat nilai tiket terminal naik (jurusan, PO, atau kelas bus baru), harga yang sudah diatur pemain ikut naik. Pengaturan harga **tetap** walau naik kelas.
- **Jatah kursi**: tiap pasangan jurusan × kelas punya jatah kursi tetap, sebanding peminat keduanya:
  - jurusan: Jakarta 3, Bandung 2, Semarang/Yogya/Surabaya 1,5 … Banda Aceh 0,4;
  - kelas: ekonomi 4, patas 3, eksekutif 2, sleeper & double decker 1.

  Kursi yang kosong karena harga mahal **tidak** diisi penumpang segmen lain.
- **Peminat** segmen = `hj^(−elastisitas jurusan) × (tiket ÷ hj)^(−elastisitas kelas)`, dengan hj = harga jurusan ÷ normal.
  - Peka harga: bus ekonomi 2,0; Jakarta/Bandung 1,8.
  - Kurang peka: antarpulau 1,15–1,25; Sleeper 1,2; Double Decker 1,15.
- **Saran harga**: tiap baris punya tombol "Saran Rp X (ketuk untuk pakai)". Saran adalah harga yang paling banyak mendatangkan uang tiket dalam sehari biasa pada kepuasan saat ini, tanpa membuat penumpang kecewa. Contoh: terminal baru 110%; rute jauh 120%; tambahan eksekutif +20%.
- **Terlalu mahal**: tiket di atas **125%** harga normal membuat penumpang kecewa:
  - kepuasan × (1 − 0,6 × kelebihan rata-rata), paling banyak −60%;
  - akibatnya peminat di semua jurusan turun, bonus kepuasan hilang, dan syarat kontrak PO besar bisa gagal;
  - baris penyebabnya ditandai merah: "⚠ Terlalu mahal, penumpang kecewa · saran Rp X";
  - tab Jurusan menampilkan batas wajar atau "kepuasan −N%", dan popup kepuasan ikut menyebutnya.
- **Umpan balik per baris**: "Peminat −20% · kursi terisi 78%", atau "kursi penuh, 15% tak terangkut" yang berarti harga bisa dinaikkan.
- **Anti-curang**: hadiah "N menit pendapatan", target, dan rekor arus memakai harga normal.

---

## 7. Kepuasan penumpang

Nilai turunan 0–100% (tidak disimpan). Tampil sebagai pil wajah di HUD, dan bisa diketuk untuk melihat rinciannya.

| Komponen | Bobot | 100% bila |
|---|---|---|
| Kelancaran antartahap | 40% | Kapasitas tahap paling lambat ≥ 85% tahap tercepat (0% bila ≤ 25%) |
| Kios & Toilet | 30% | Level Kios + Toilet ≥ `1 + 1,5 × log₂(1 + arus)` |
| Jalur bus | 30% | Jalur ≥ `1 + ⌊1,6 × log₁₀(1 + arus)⌋` (maks. 5) |

Total kepuasan = rata-rata berbobot × (1 − penalti harga mahal).

**Efek kepuasan**:

- **Bonus pendapatan**: mulai di kepuasan 70%, naik linear sampai **+25%** di kepuasan 100%.
- **Lebih banyak penumpang datang**: lewat daya tarik kepuasan (bagian 4).
- **Syarat kontrak PO besar**: Peuyeum Kilat 50%, Telolet Jaya 65%, Sultan Garasi 80%.
- **Tantangan mingguan "jaga kepuasan ≥ 75%"**.

Popup rincian menyarankan langkah per komponen: upgrade tahap yang tertinggal, level fasilitas yang dibutuhkan, dan jumlah jalur.

---

## 8. Sistem pengelolaan terminal

Panel bawah punya enam tab: **Tahap**, **Fasilitas**, **Jurusan**, **Armada**, **Modern**, dan **Target**.

### 8.1 Fasilitas (tab Fasilitas)

| Fasilitas | Biaya awal (pertumbuhan) | Efek per level |
|---|---|---|
| Kios & Minimarket | Rp 80 (×1,11) | Belanja Rp 0,2/penumpang, dibayar sebagai sewa harian; membuka minimarket, apotek & kios di adegan |
| Parkir Kendaraan | Rp 200 (×1,11) | Rp 0,15/penumpang |
| Toilet & Musholla | Rp 50 (×1,11) | Belanja kios +10% (tidak menghasilkan uang sendiri) |
| Parkir Bus Jurusan | Rp 500 (×1,12) | Rp 5/bus |

Petugas fasilitas (penjaga kios, juru parkir, petugas kebersihan toilet, petugas pos retribusi) baru tampil di adegan setelah fasilitasnya dibangun.

### 8.2 Jalur bus (baris teratas tab Fasilitas)

- Terminal baru punya 1 jalur, paling banyak 5. Biaya jalur 2–5: Rp 300 → 25 rb → 1,5 jt → 60 jt.
- Tiap jalur tambahan: kapasitas Peron & Keberangkatan **+40%**.
- Di adegan, halte & gerbang jalur yang belum dibangun ditutup palang. Dengan sedikit jalur, bus mengantre di jalan raya. **Jalur 2 adalah tujuan pertama pemain baru** (langkah terakhir tutorial).
- Jalur kembali ke 1 saat naik kelas.

### 8.3 Jurusan & rute antarpulau (tab Jurusan)

- Game baru melayani **Jakarta & Bandung**. Jurusan dibuka berurutan dan menaikkan harga tiket rata-rata (bonus dijumlahkan):

| # | Jurusan | Biaya | Bonus tiket | Syarat |
|---|---|---|---|---|
| 1–2 | Jakarta, Bandung | awal | 0 | – |
| 3 | Semarang | Rp 2 rb | +10% | – |
| 4 | Yogyakarta | Rp 12 rb | +15% | – |
| 5 | Solo | Rp 70 rb | +20% | – |
| 6 | Surabaya | Rp 400 rb | +25% | – |
| 7 | Malang | Rp 2,5 jt | +35% | – |
| 8 | Denpasar | Rp 15 jt | +50% | – |
| 9 | Lampung ⛴ | Rp 60 jt | +50% | Tipe B |
| 10 | Palembang ⛴ | Rp 250 jt | +55% | Tipe B |
| 11 | Mataram ⛴ | Rp 1 M | +60% | Tipe A |
| 12 | Jambi ⛴ | Rp 4 M | +65% | Tipe A |
| 13 | Padang ⛴ | Rp 15 M | +70% | Tipe A |
| 14 | Bima ⛴ | Rp 60 M | +80% | Terpadu |
| 15 | Medan ⛴ | Rp 250 M | +90% | Terpadu |
| 16 | Banda Aceh ⛴ | Rp 1 T | +100% | Terpadu |

- Tiap jurusan Jawa–Bali membuka satu jendela loket di adegan (8 jendela). Rute antarpulau dijual di jendela yang sudah ada.
- Papan pulau parkir, papan loket, pengumuman, dan label keberangkatan mengikuti jurusan yang dibuka. Rute antarpulau menambahkan rambu pelabuhan di jalan raya.
- Jurusan diulang dari awal saat naik kelas.

### 8.4 Kelas bus (bagian atas tab Armada)

| Kelas | Biaya | Bonus tiket | Syarat |
|---|---|---|---|
| Ekonomi | sejak awal | 0 | – |
| Patas AC | Rp 25 rb | +10% | – |
| Eksekutif | Rp 750 rb | +20% | – |
| Sleeper | Rp 6 jt | +30% | Terminal Tipe B |
| Double Decker | Rp 50 jt | +40% | Terminal Tipe A |

Kelas dibeli berurutan. Bonusnya dijumlahkan lalu dikalikan bonus jurusan & PO. Bus yang datang di adegan memakai kelas yang beroperasi, sebanding bagian penumpangnya. Kelas bus diulang saat naik kelas.

### 8.5 Mitra PO (tab Armada)

Dua puluh perusahaan otobus fiktif. Tiap PO menaikkan harga tiket **+3%**, memberi livery bus di adegan, dan bersifat **permanen** (tidak direset prestige).

| Cara bergabung | PO |
|---|---|
| Bersama jurusannya (11) | Lumpia Kilat (Semarang), Bakpia Rasa (Yogyakarta), Wayang Lestari (Solo), Arek Ekspres (Surabaya), Apel Batu (Malang), Kecak Laju (Denpasar), Siger Sakti (Lampung), Rinjani Indah (Mataram), Rumah Gadang (Padang), Danau Toba (Medan), Kopi Gayo (Banda Aceh) |
| Kontrak sekali bayar (4) | Ondel-Ondel Rp 5 rb; Peuyeum Kilat Rp 150 rb + kepuasan 50%; Telolet Jaya Rp 3 jt + kepuasan 65%; Sultan Garasi Rp 80 jt + kepuasan 80% |
| Hadiah naik kelas (2) | Juara Kelas (Tipe B), Juara Umum (Tipe A) |
| Hadiah akhir event (3) | Mudik Ceria (Mudik Lebaran), Merah Putih (HUT RI), Kembang Api (Nataru) |

### 8.6 Modernisasi (tab Modern)

Pembelian sekali yang menambah kapasitas satu tahap. Ada dua tingkat per tahap, dan tingkat kedua butuh tingkat pertama.

| Tahap | Tingkat 1 | Tingkat 2 |
|---|---|---|
| Peron | Marka & rambu halte Rp 3 rb (×1,15) | Petugas pengatur bus Rp 150 rb (×1,25) |
| Loket | Mesin tiket mandiri Rp 1,5 rb (×1,2) | Tiket online Rp 80 rb (×1,3) |
| Keberangkatan | Papan jadwal digital Rp 5 rb (×1,15) | Gate e-boarding Rp 400 rb (×1,25) |

Perlengkapannya muncul di adegan 3D setelah dibeli.

---

## 9. Naik kelas terminal (prestige)

Detail di [06 · Player Progression Design](06-player-progression-design.md).

- Kelas: **Tipe C → Tipe B → Tipe A → Terpadu ★1, ★2, …**.
- Syarat: poin prestige dari pendapatan run ini minimal **3 / 8 / 15**, lalu +10 tiap kelas berikutnya. Poin = `⌊(pendapatan run ÷ Rp 100 rb)^0,5⌋`.
- **Yang direset**: uang (kembali Rp 20), level & Kepala, fasilitas, jalur, jurusan, modernisasi, kelas bus.
- **Yang tetap**: poin prestige (+10% pendapatan permanen per poin), mitra PO, penghargaan, statistik, nama terminal, rekor, tantangan mingguan, pengaturan harga.
- Hadiah: PO Juara Kelas (Tipe B), PO Juara Umum (Tipe A), penghargaan, dan perubahan tampilan gapura (papan nama, umbul-umbul, lampu hias, bintang).
- Naik kelas selalu lewat popup konfirmasi.

---

## 10. Tujuan berkala

| Sistem | Ritme | Isi | Hadiah |
|---|---|---|---|
| Target harian | Tiap hari terminal (24 menit main) | Bergantian "lakukan 10 upgrade tahap" / "berangkatkan N penumpang" (N = ½ arus sehari) | 2 menit pendapatan (2× lewat iklan) |
| Tantangan mingguan | Tiap Senin 00.00 WIB (jam nyata) | 3 dari 5 jenis, sama untuk semua pemain: penumpang (arus × 2 jam main), pendapatan (pendapatan/dtk × 3 jam main), 40 upgrade, 8 level fasilitas, kepuasan ≥ 75% selama 60 menit main | 15 menit pendapatan per tantangan; yang lupa diklaim dikirim otomatis minggu berikutnya |
| Event musiman | Kalender WIB | Mudik Lebaran (H−10 s.d. H+7, ×1,5), HUT RI (10–20 Agustus, ×1,17), Nataru (20 Des – 5 Jan, ×1,3). Tiga tahap target penumpang (arus × 20 menit / 1 jam / 3 jam main) | 5 / 15 / 30 menit pendapatan; tahap terakhir: PO eksklusif |
| Penghargaan | Sekali per pencapaian | 18 pencapaian (lihat dokumen 06) | 3 menit pendapatan (2× lewat iklan) |
| Rekor | Tiap hari terminal | Penumpang & pendapatan terbanyak sehari, arus tertinggi | Notifikasi "🏅 Rekor baru" |
| Papan peringkat | Mingguan (WIB) | Penumpang minggu ini, 50 teratas | Gengsi saja (tanpa hadiah gameplay) |

---

## 11. Papan peringkat mingguan

- Skor = **penumpang yang diberangkatkan minggu ini** selama main aktif. Reset Senin 00.00 WIB, tetap walau naik kelas.
- Hanya web dan hanya pemain yang **login Google** dan **menyetujui** tampil publik. Yang ditampilkan: nama terminal, tipe terminal, skor. Tamu hanya bisa melihat.
- Nama terminal wajib diisi dan disaring dari kata kasar.
- Popup: 50 teratas dengan medali 🥇🥈🥉, tab Minggu lalu, dan baris sendiri disorot. Kartu menampilkan "Peringkatmu #N dari M terminal".
- Skor dikirim otomatis paling sering tiap 3 menit, segera saat nama atau kelas berubah, dan saat game ke latar.
- **Keluar dari papan** menghapus skor di server. **Hapus akun** juga menghapusnya.

---

## 12. Iklan berhadiah & Bus Emas

Pemain **memilih sendiri** menonton iklan. Tanpa iklan yang siap, tombol hadiah tidak muncul. Tidak ada iklan paksa.

| Hadiah | Pemicu | Efek |
|---|---|---|
| Boost 2× | Tombol ⚡ di kolom kontrol | Semua pendapatan ×2 selama +30 menit main per iklan, ditumpuk sampai 4 jam; ikut berjalan saat offline |
| Bus Emas | Muncul tiap 5–10 menit main, bisa diketuk 60 detik | Bonus 10 menit pendapatan |
| Ambil 2× offline | Popup "Selama kamu pergi…" | Penghasilan offline laporan itu diberikan sekali lagi |
| Klaim 2× | Target harian & penghargaan | Hadiah ×2 |

---

## 13. Waktu, kecepatan & cuaca

- **Jam terminal** diturunkan dari waktu main aktif: 1 jam terminal = 60 detik nyata, jadi 1 hari = 24 menit dan sepekan ≈ 2,8 jam. Game baru mulai **Senin 06:00**. Jam berhenti saat game ditutup.
- **Kecepatan 1× / 2× / 3×**: seluruh simulasi (termasuk pendapatan) berjalan lebih cepat. Penghasilan offline tetap memakai waktu nyata.
- **Siang–malam**: pencahayaan, lampu jalan, jendela kota, lampu bus, dan jam buka toko (apotek 07–22, kios 05–22.30; separuh loket tutup 22–05).
- **Cuaca**: 1–3 hari hujan per pekan (pagi / siang berpetir / malam), diacak dari benih game. Efeknya visual: payung, genangan, tanah basah, dan orang berteduh.

---

## 14. Dunia 3D & keramaian

Model keramaian (`src/game/dunia-visual.ts`) adalah **dekoratif**: tidak mengubah ekonomi, tapi lajunya diturunkan dari state sim. Akibatnya antrean menumpuk di bottleneck dan jumlah bus serta penumpang mengikuti permintaan.

- **Siklus bus**: masuk → turunkan penumpang di peron kedatangan (5 halte) → parkir serong di pulau jurusannya (20 petak, 4 kelompok) → dicuci kenek & sopir → istirahat → ngetem di halte keberangkatan → berangkat.
- **Penumpang**:
  - yang turun pulang lewat pintu keluar;
  - calon penumpang datang dari trotoar atau parkir mobil, antre di labirin, membeli tiket di jendela loket jurusannya, kadang mampir (toilet, musholla dengan waktu sholat, ATM, minimarket), duduk di ruang tunggu, lalu dipanggil ke bus;
  - ±20% membawa rombongan, ±5% diantar.
- **Kehidupan terminal**: satpam berkeliling malam hari, petugas kebersihan, pangkalan ojek, ojol, pedagang asongan, anak "OM TELOLET OM", papan jadwal yang mengikuti bus sungguhan, dan tampilan event.

---

## 15. Interaksi & fitur pendukung

| Fitur | Deskripsi |
|---|---|
| Klakson telolet | Ketuk bus mana pun → klakson telolet (4 melodi) + label "♪ TELOLET!"; anak-anak di seberang jalan melompat kegirangan |
| Kamera | Geser, zoom ke titik, putar dengan dua jari / klik kanan / Q-E, kompas untuk kembali ke arah awal |
| Nama terminal | Maks. 18 huruf; tampil di papan gapura, kartu kelas, foto, dan papan peringkat |
| Foto terminal (web) | Memotret adegan tanpa UI, menambah bingkai bermerek & keterangan, lalu Bagikan (Web Share) atau Simpan |
| Mode sinema | Adegan layar penuh, kamera berputar pelan, jam tampilan dipercepat (ekonomi tidak ikut), untuk video promosi |
| Panel ringkas | Panel dilipat menjadi rel ikon tahap; HUD ikut diringkas |
| Suara | Tombol speaker; pilihan disimpan |

---

## 16. Tutorial

Tutorial berjalan untuk game yang benar-benar baru. Dimulai dengan sambutan, lalu **empat langkah**:

1. Upgrade tahap PALING LAMBAT.
2. Rekrut Kepala termurah.
3. Bangun Kios & Minimarket.
4. Bangun Jalur 2.

- Tiap langkah selesai sendiri begitu syaratnya terpenuhi, dalam urutan apa pun. Tutorial tidak pernah menghalangi pemain.
- Tombol yang dituju berkedip. Bila tombolnya tersembunyi, yang disorot adalah tab atau tombol buka panelnya.
- Gelembung menampilkan kemajuan uang ("Uang Rp 6 / Rp 50"). Ada tombol "Lewati" kapan saja.
- Ditutup dengan tips klakson telolet. Status disimpan per perangkat.

---

## 17. Audio

Semua bunyi disintesis Web Audio, tanpa file:

- **Lapisan latar**: riuh orang, mesin bus, lalu lintas, air cuci, jangkrik, hujan.
- **Bunyi sesaat**: rem angin, deru berangkat, klakson, guntur, telolet.
- **Pengumuman**: bel + kalimat bahasa Indonesia lewat `speechSynthesis` bila ada suara Indonesia; jarak minimal 35 detik.
- Volume mengikuti jarak dari titik pandang kamera, dan bunyi sesaat diposisikan stereo.

---

## 18. Simpan, offline & akun

- **Autosave**: tiap 10 detik waktu main, saat app ke background, dan setelah penghasilan offline diterapkan.
- **Save lokal** (localStorage / Capacitor Preferences) adalah tempat simpan utama.
- **Cloud save (web, opsional)**: login Google lalu salin ke Firestore. Unggahan paling sering tiap 60 detik dan saat ke background. Konflik dua save yang sama-sama berprogres selalu ditanyakan ke pemain. Logout = mulai sebagai tamu baru.
- Save korup tidak membuat crash: salinannya disimpan, lalu game baru dimulai.
- **Pembaruan versi**: popup "Versi baru tersedia" (bisa "Nanti"). Popup wajib hanya bila versi lama tidak boleh dipakai lagi.

---

## 19. Analitik

Peristiwa GA4 (web saja) mengukur corong pemain baru (tutorial → upgrade → Kepala → fasilitas → Jalur 2), pemakaian fitur, iklan, error, dan ringkasan sesi. Daftar lengkap ada di [10 · API Specification](10-api-specification.md#5-google-analytics-4-keluar). Nama terminal tidak pernah dikirim.

---

## 20. Parameter tuning

Semua angka di `src/config/economy.config.ts` (`EKONOMI`, `SIMULASI`) dan `src/config/waktu.config.ts` (`WAKTU`, `RITME`, `PILIHAN_KECEPATAN`). Banyak nilai masih ditandai **PLACEHOLDER** (belum dari spreadsheet model). Setelah mengubah angka, jalankan `npm run test`. `tests/greedy.test.ts` membandingkan simulasi dengan spreadsheet: 134 pembelian greedy menghasilkan Peron 43 / Loket 49 / Keberangkatan 44 dalam ±5 menit.
