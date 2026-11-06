# 18 · Rancangan Tambah Lantai: lantai per gedung, gedung parkir, mode lihat per lantai

> **Status: disetujui owner 6 November 2026 ("APPROVE" lewat Telegram, ADR 010), sedang dibangun untuk 0.6.0. Belum lulus QA dan belum dirilis.** Brief `docs/tasks/20261105-tambah-lantai.md`. Bila dokumen ini dan brief berbeda, brief yang berlaku.
>
> - **Asal.** Ini versi rekaman dari rancangan fase 1, `docs/design/20261105-tambah-lantai/rancangan.md` (5–6 November 2026). Rancangan memuat semua pilihan, varian yang ditolak, dan keenam keputusan seperti saat diajukan; dokumen ini hanya memuat yang disetujui. Angka, AC, dan antarmuka sama dengan rancangan, kecuali yang ditetapkan brief sesudah APPROVE (bagian 11 dan 12).
> - **Harness dan bukti** tetap di repo tim, tidak ikut repo game: `sim/…` di dokumen ini berarti `docs/design/20261105-tambah-lantai/sim/`, dan `grafis/…` berarti `docs/design/20261105-tambah-lantai/grafis/` (purwarupa Panji, gambar, data ukur).
> - **Dibandingkan dengan kode 3712ef2** (Rilis 0.5.0). Angka grafis diukur Panji pada purwarupa di salinan scratchpad 3712ef2, bukan pada kode produksi. Dokumen ini diselaraskan dengan kode yang dibangun sesudah QA, seperti dokumen 16 dan 17.
> - **Keputusan berdiri yang tidak berubah:** tanpa reset dan tanpa prestige; slot denah tetap, tanpa penempatan bebas; kas tidak pernah minus; iklan berhadiah selalu opt-in dan tidak dipakai untuk lantai; save tetap skema 3; tilt-shift dan patokan tempo tidak diubah; lahan seberang K14–K17 (`CADANGAN_SEBERANG`) dan cadangan Gedung Antarpulau tanpa benda berdiri.
> - **Belum terukur saat disetujui** (bagian 14): mobil bergerak di gedung parkir, kaca malam khusus jendela lantai, dan fps. Owner menyetujui jendela malam dan jalan samping sebelum melihat gambarnya; gambarnya dikirim sebagai pratinjau saat bangun, dan owner masih bisa mengubahnya.

## Ringkasan

1. **Untuk pemain.** Mulai Perluasan 3, tab Bangun memuat kartu "Tambah lantai" untuk 4 gedung: Gedung parkir (lantai 2 di Lv 15, lantai 3 di Lv 38), Ruang tunggu (Lv 21), Sayap barat (Lv 26; di kartu "Gedung toilet", lantai 2-nya selasar penghubung dari lantai 2 Sayap 2 Lantai ke aula, bagian 8.10), dan Aula loket (Lv 33). Satu ketukan membangun lantainya langsung, lengkap dengan isinya (kursi, kios, toko, toilet, lahan parkir), dan gedungnya terlihat bertingkat di adegan. Gedung parkir memakai ramp lurus terbuka (bentuk A), dan mobil naik-turun ramp.
2. **Terukur di simulasi:** pendapatan parkir +58 % di lantai 2 dan +50 % di lantai 3; kenyamanan 89 → 100 %; fasilitas 64 → 76 % (toilet) dan 83 → 99 % (parkir); kepuasan median di 20–40 jam main 66–68 % → 78–80 %; arus +2 sampai +11 penumpang/jam per lantai.
3. **Harga** Rp 300 jt, Rp 500 jt, Rp 300 jt, Rp 1 M, dan Rp 2 M, ±1–3 hari terminal laba saat lantai itu terbuka, ditambah operasional Rp 1–2 jt per hari per lantai.
4. **Tempo tidak berubah** dan patokan tidak disentuh: Tipe A 5,08 → 5,06 jam, Terpadu 10,91 → 10,89 jam, bentang buntu 41 menit. Kas menipis 0, petugas berhenti 0.
5. **Tidak diselesaikan:** sesudah Terpadu tetap sepi (1.401 → 1.258 menit buntu dalam 40 jam main). Yang membukanya adalah lantai peron (jalur 10–11), yang menunggu bentuk Gedung Antarpulau (1.258 → 451 menit).
6. **Grafis:** lantai baru dipasang sebagai mezanin di sisi gedung, bukan ditumpuk penuh, supaya loket, antrean, kursi, gerbang, bus, dan halte tetap 0 % tertutup. Di tampilan biasa lantai digambar sebagai cangkang (+0 draw call, +4,5–5,0 rb segitiga); isinya dilihat lewat mode lihat per lantai.
7. **Teknis:** field save `terminal.lantai` opsional (skema tetap 3), `versiMinimal` 0.6.0 saat rilis, peristiwa GA4 `lantai_beli` dan `lantai_lihat`.

## 1. Masalah, tujuan, untuk siapa

**Permintaan owner** (5 November 2026, Telegram): "bagaimana jika semua gedung bisa dibuat lantai 2 ketika upgrade di level-level tertentu". Jawaban owner atas pertanyaan Sapto: lantai menambah kapasitas dan pendapatan; pemicunya tombol beli "Tambah lantai" per gedung; semua gedung; untuk 0.6.0. Tambahan owner: mode lihat per lantai, dan apakah itu mengurangi beban grafis.

| Masalah pemain | Fase | Bukti |
|---|---|---|
| Terminal berhenti tumbuh secara fisik sesudah Perluasan 3; naik level hanya menambah hiasan | Lv 15–60 | Dokumen 16; tahap 4–5 belum berbentuk (keputusan owner) |
| Dataran Lv 21–27 (S-4): pembelian kelas menengah tidak ada, jeda menabung 70–114 menit | Mid game | Dokumen 13 bagian 16; 114 menit untuk pemain serakah |
| Slot unit kecil penuh sejak Lv 5–19 (kursi 8/8, kios 3/3, toko 4/4, parkir 2/2); kepuasan merosot ke 66–68 % sesudah Terpadu | Late game | `sim/keluaran/V0-beli-6jam.txt`, `sim/hasil-probe-slot.txt` |
| Kas menumpuk tanpa sasaran (Rp 11 M di 24 jam, Rp 53 M di 40 jam main) | Late game | `sim/keluaran/` |

- **Untuk siapa:** pemain mid dan late game. Sesi pertama dan tutorial tidak tersentuh, karena lantai baru terbuka sesudah Perluasan 3 dan Lv 15.
- **Ukuran keberhasilan di simulasi:** tempo tetap di patokan; jeda beli terlama Lv 21–27 turun; kepuasan sesudah Terpadu naik; kas menipis tetap 0.
- **Ukuran sesudah rilis (GA4, bagian 10.2):** porsi pemain Lv ≥ 21 yang membeli lantai pertama dalam 2 sesi; porsi pemakai "Lihat"; sesi kedua dalam 24 jam pada pemain Lv 15–30, dibanding 0.5.0.
- **Asumsi:** pemain serakah (`tests/tycoon-sim.ts`) dan pemain kasual K3/K2 tetap wakil yang sah untuk tempo; pemain manusia memakai tarif bawaan; lantai tidak bisa dibongkar, unit di dalamnya bisa.

## 2. Keputusan owner (6 November 2026)

| # | Keputusan | Yang dipilih |
|---|---|---|
| 1 | Mekanik lantai | **Opsi B, ruang baru:** slot unit gedung itu bertambah dan unitnya langsung dibangun. Bukan pengali (opsi A) dan bukan proyek berwaktu (opsi C) |
| 2 | Cakupan 0.6.0 | **4 gedung, 5 lantai.** Peron, pangkalan, Sayap 2 Lantai lantai 3, Ruang tunggu lantai 3, dan dek bus ikut rancangan Perluasan 4–5 / Gedung Antarpulau |
| 3 | Mode lihat per lantai | **Ya, versi ringan:** tombol "👁 Lihat" di kartu dan toast, tanpa tombol global baru |
| 4 | Petugas saat membeli lantai toilet atau parkir | **Ikut direkrut**, bila semua unit sejenis yang sudah ada dijaga petugas |
| 5 | Save dan analitik | `terminal.lantai` opsional di skema 3, `versiMinimal` 0.6.0 saat rilis, peristiwa `lantai_beli` dan `lantai_lihat` |
| 6 | Jendela lantai di malam hari | **Hanya jendela lantai baru yang menyala**, setara emisif 1,0, dengan bahan sendiri; benda lain dan malam tahap 0–2 tidak berubah |
| – | Bentuk gedung parkir | **Bentuk A**, ramp lurus terbuka bertumpuk di sisi selatan (owner, terminal: "parkir A, mobil bergerak ya") |
| – | Mobil di gedung parkir | **Mobil bergerak** naik-turun ramp, hanya tampilan |
| – | Jalan samping ke pelataran SPBU | **Diterima** (CHANGE REQUEST Citra, disampaikan Sapto bersama ajakan APPROVE) |

Owner menjawab "APPROVE" atas ajakan "APPROVE untuk ikut semua saran"; Sapto menyampaikan bacaannya ke owner (brief bagian 1). Palet papan Mudik A (warna baru sebelum Musim 3) diputuskan bersama; nilainya (putih `#ffffff`, tulisan `#14532d`) dan alasannya ada di dokumen 17 bagian 4.2.

**Kenapa bukan "semua gedung".** Peron dan pangkalan tidak bisa ditumpuk tanpa menutup bus dan halte 50–100 % di tampilan biasa (bagian 8.2). Padanannya, jalur dan dek bus, sudah dijanjikan kartu Perluasan 4–5 dan menunggu bentuk Gedung Antarpulau. Pos retribusi adalah gardu, bukan gedung. Sayap 2 Lantai sudah dua lantai; lantai 3-nya menutup isi lantai 2.

## 3. Sistem sekarang (kode 3712ef2)

- **Slot unit:** `slotBangunan(id, perluasan, level)` di `src/sim/bangunan.ts` = tabel tahap `EKONOMI.tycoon.bangunan[id].slot` + izin level (hanya jendela dan jalur). UI dan tujuan memakainya lewat `slotBangunanState` (`src/sim/state.ts`). Save memotong unit ke slot saat dimuat (`bacaBangunan`, `src/sim/save.ts`).
- **Kapasitas** (`hitungKapasitas`, `src/sim/operasi.ts`): peron = halte, keberangkatan = gerbang (keduanya dari jalur), loket = jendela per PO, pangkalan = petak dari perluasan. Kursi, toilet, kios, toko, dan parkir tidak membatasi arus; mereka masuk ke kepuasan (`hitungKepuasan`), dan kepuasan menaikkan permintaan (daya tarik 0,6 + 0,8 × kepuasan).
- **Pendapatan** (`src/sim/keuangan.ts`): kontrak PO (±75–80 % di akhir permainan), sewa jendela, retribusi, parkir (lahan × 60 kendaraan/jam × Rp 5 rb), sewa kios & toko (Rp 300 rb/hari per unit).

| Unit | Slot tahap 0–5 | Pemain serakah penuh sejak |
|---|---|---|
| Blok kursi (60 kursi) | 4, 4, 4, 8 | Lv 19 (8/8) |
| Kios | 3 | Lv 5 |
| Toko | 2, 2, 2, 4 | Lv 11 |
| Toilet | 1, 1, 1, 2 | Toilet ke-2 tidak pernah dibeli |
| Lahan parkir | 1, 1, 2 | Lv 7 |
| Jalur | 5, …, 7 + izin Lv 16/26 = 9 | Lv 36 (9/9) |

Sesudah Lv 25 leher botolnya peron, dan keberangkatan tepat di belakangnya. Petak, loket, dan "+10 % keberangkatan" bernilai 0; satu-satunya cara menambah arus adalah jalur, yang mentok di 9.

**Gedung di adegan** (`src/game/tata-letak.ts`):

| Gedung (sebutan pemain) | Letak | Unit sim di dalamnya | Lantai di 0.6.0 |
|---|---|---|---|
| Aula loket | `GEDUNG` x 11,6…29,14, y 11,2…15,0 | jendela 1–8, toko 1–2, ATM | Mezanin di belakang dinding utara |
| Ruang tunggu keberangkatan | `RUANG_TUNGGU` x 29,14…50,14, y 6,3…13,0 | blok kursi 1–4, kios 1–3, gerbang | Mezanin di sisi selatan |
| Sayap barat (toilet & musholla) | `SAYAP_BARAT` x 6,6…11,6, y 11,2…15,0 | toilet | Lantai 2 di separuh utara, di atas toilet; musholla tetap terlihat |
| Lahan parkir kendaraan | x 30,8…50,14, y 13,6…17,25 | lahan parkir 1–2 | Gedung parkir 2–3 dek di bagian barat (x < 36), bentuk A |
| Sayap 2 Lantai | `SAYAP_DUA` | jendela 9–24, kursi 5–8, toko 3–4 | Sudah 2 lantai; lantai 3 tahap berikut |
| Peron kedatangan, pangkalan, pos retribusi | `PERON`, `PANGKALAN`, `POS_RETRIBUSI` | halte, petak bus, pos | Tidak (bagian 2) |

## 4. Aturan

- **Lantai tambahan** per gedung disimpan sebagai angka: 0 berarti hanya lantai dasar. Lantai tidak pernah berkurang dan tidak bisa dibongkar.
- **Syarat membeli:** Perluasan 3 sudah selesai, level terminal cukup, kas ≥ harga, dan lantai belum maksimal. Tidak ada syarat lantai lain.
- **Membeli lantai** terjadi sekaligus:
  1. Kas berkurang sebesar harganya.
  2. Slot unit gedung itu bertambah sebesar `isi`.
  3. Unit isinya langsung dibangun dan masuk hitungan `bangunan` biasa: dirawat, bisa dibongkar, dan digambar di mode lantai.
  4. Petugas ikut direkrut bila semua unit sejenis yang sudah ada dijaga petugas: petugas toilet untuk toilet, juru parkir untuk lahan parkir. Pemain yang memilih tidak menjaga toilet lamanya tidak dipaksa.
  5. Biaya operasional lantai masuk pos "Operasional gedung" yang sudah ada.
- **Tantangan mingguan "bangun"** dan tugas musim *kelola* `bangun` menghitung lantai sebagai 1. Isinya tidak dihitung terpisah, supaya "Bangun 15 unit" tidak selesai dengan 2 lantai.
- **Tanpa hadiah, tanpa iklan,** dan tanpa pengurangan harga lewat iklan.
- **Tidak ada keadaan "sedang dibangun":** lantai langsung jadi.

## 5. Angka (`EKONOMI.tycoon.lantai`)

| Gedung (`GedungLantaiId`) | Lantai | Level | Harga | Operasional/hari | Isi per lantai (slot + langsung terpasang) | Kenapa level ini |
|---|---|---|---|---|---|---|
| `parkir` · Gedung parkir | 2 | 15 | Rp 300 jt | Rp 1 jt | +2 lahan parkir | Lahan parkir penuh 2/2 sejak Lv 7; pengantar (30 % penumpang) jauh melebihi 120 kendaraan/jam |
| | 3 | 38 | Rp 2 M | Rp 1 jt | +2 lahan parkir | Arus ±1.600: kebutuhan ±8 lahan |
| `ruangTunggu` · Ruang tunggu | 2 | 21 | Rp 500 jt | Rp 2 jt | +4 blok kursi, +1 kios | Kursi 8/8 sejak Lv 19; kenyamanan mulai turun (89 %) |
| `sayapBarat` · Sayap barat | 2 | 26 | Rp 300 jt | Rp 1 jt | +1 toilet | Toilet ke-2 berguna sejak arus ±800 (fasilitas 64 %) |
| `aula` · Aula loket | 2 | 33 | Rp 1 M | Rp 1 jt | +2 blok kursi, +2 toko | 12 blok kursi jenuh di arus ±1.440 (Lv 35); sebelum itu isi aula tidak bernilai |

```ts
// src/config/economy.config.ts
lantai: {
  parkir:      { level: [15, 38], tahap: 3, biaya: [300_000_000, 2_000_000_000], operasional: 1_000_000, isi: { lahanParkir: 2 } },
  ruangTunggu: { level: [21],     tahap: 3, biaya: [500_000_000],                operasional: 2_000_000, isi: { kursi: 4, kios: 1 } },
  sayapBarat:  { level: [26],     tahap: 3, biaya: [300_000_000],                operasional: 1_000_000, isi: { toilet: 1 } },
  aula:        { level: [33],     tahap: 3, biaya: [1_000_000_000],              operasional: 1_000_000, isi: { kursi: 2, toko: 2 } },
},
```

`isi` sekaligus menjadi tambahan slot, karena satu lantai berisi penuh. Panjang `level` = lantai tambahan maksimal; `tahap` = tahap perluasan minimal (3).

**Harga dalam hari laba** pemain serakah tanpa lantai pada level terbukanya (`sim/hasil-probe-slot.txt`; Lv 21, 26, dan 38 di antara dua titik probe, karena itu ±):

| Lantai | Laba/hari saat terbuka | Harga dalam hari laba |
|---|---|---|
| Gedung parkir 2 (Lv 15) | Rp 178 jt | 1,7 hari |
| Ruang tunggu 2 (Lv 21) | Rp 245 jt | 2 hari |
| Sayap barat 2 (Lv 26) | ±Rp 300 jt | 1 hari |
| Aula 2 (Lv 33) | Rp 527 jt | 1,9 hari |
| Gedung parkir 3 (Lv 38) | ±Rp 650 jt | 3 hari |

Lantai pertama sengaja langsung terjangkau: ia mengenalkan fitur sebagai hadiah, bukan tabungan. Yang lain menjadi sasaran menabung pendek di sela jalur dan perluasan. Harga ×0,5 dan ×2 hanya memajukan atau memundurkan pembelian ±2 level; tempo tidak bergeser (bagian 13).

**Efek tiap lantai saat dibeli** (pemain serakah, `sim/keluaran/G.txt` bagian A dan H, `KOMPONEN=1`):

| Lantai | Dibeli (tanpa / dengan hadiah) | Efek |
|---|---|---|
| Gedung parkir 2 | Lv 15 / Lv 15 | Pendapatan parkir Rp 14,4 → 22,8 jt/hari; fasilitas 83 → 99 %; arus +3 pnp/jam; laba/hari +Rp 7 jt |
| Ruang tunggu 2 | Lv 24 / Lv 21 | Kenyamanan 89 → 100 %; kepuasan 89 → 92 %; arus +8–9 pnp/jam; laba/hari −Rp 1 jt (operasional & perawatan) |
| Sayap barat 2 | Lv 28 / Lv 29 | Fasilitas 64 → 76 %; arus +5–7; laba/hari −Rp 1 jt |
| Aula 2 | Lv 38 / Lv 36 | Kenyamanan 89 → 100 %; fasilitas 66 → 70 %; arus +7–11; laba/hari −Rp 0,5–0,9 jt |
| Gedung parkir 3 | Lv 40 / Lv 38 | Pendapatan parkir Rp 28,8 → 43,2 jt/hari; fasilitas 70 → 78 %; arus +2 pnp/jam; laba/hari +Rp 12 jt |

Dalam Rupiah efeknya kecil, karena kontrak PO menguasai pendapatan: laba hari ke-100 Rp 1,04 → 1,07 M. Yang besar adalah persen kepuasan dan pendapatan parkir, jadi kartu menampilkan efek dalam satuan itu. Lantai ruang tunggu, sayap barat, dan aula menurunkan laba harian sedikit; imbalannya kepuasan, yang menaikkan permintaan dan menjaga PO premium (Sultan Garasi minta kepuasan ≥ 80 %, Telolet Jaya ≥ 65 %). Manfaat untuk PO premium tidak dinilai simulasi.

## 6. UI dan alur

**Tab Bangun.** Kartu lantai berada di grup yang sama dengan unit isinya, tepat sesudah unit-unit itu: Ruang tunggu dan Aula loket di "Ruang tunggu & toko"; Sayap barat dan Gedung parkir di "Fasilitas". Satu kartu per gedung, yang menampilkan lantai berikutnya. Kartu tampil sejak Perluasan 3 selesai. Portrait dan landscape memakai susunan kartu Bangun yang sama dengan kartu unit, tanpa panel baru; di 360 px kartu tetap 3 baris (judul, isi & efek, tombol).

**Keadaan kartu lantai:**

| Keadaan | Syarat | Tampilan |
|---|---|---|
| Tersembunyi | Perluasan 3 belum selesai | Tidak ada kartu; kartu Perluasan 3 menyebut "membuka Tambah lantai" |
| Terkunci level | Level < syarat | Judul, isi, "🔒 Terbuka di Lv 21"; tombol tidak ada |
| Terjangkau | Kas ≥ harga | Tombol "Tambah lantai · Rp 500 jt" aktif; peringatan bila kas sesudahnya < sehari biaya (seperti kartu perluasan) |
| Tidak terjangkau | Kas < harga | Tombol redup "Kurang Rp 120 jt" |
| Selesai, ada lantai berikutnya | Gedung parkir sesudah lantai 2 | "✓ 2 lantai · lantai 3 terbuka di Lv 38" dan "👁 Lihat" |
| Maksimal | Semua lantai dibangun | "✓ 2 lantai" (Gedung parkir "✓ 3 lantai") dan "👁 Lihat" |
| Gagal | Kas berubah antara ketuk dan aksi | Aksi tidak berlaku, kartu kembali ke "Kurang Rp X" (pola tombol beli yang sudah ada) |

- **Pratinjau** di kartu: dari aksi yang diterapkan pada salinan kaya kas (pola `sesudah` di `tujuan.ts`): kepuasan dan komponennya sebelum/sesudah, selisih laba operasi per hari (tarif pemain), dan selisih pendapatan parkir per hari. Paling banyak 2 bagian yang berubah paling besar.
- **Kartu unit yang slotnya penuh** menunjuk lantai bila lantai adalah sumber slot berikutnya: "Slot penuh: tambah lantai Ruang tunggu", atau "Slot penuh: lantai 2 Ruang tunggu di Lv 21". Bila sumbernya perluasan atau izin, teks lama tetap ("bertambah di Perluasan N", "+1 di Lv L").
- **Baris tujuan** (`src/app/tujuan.ts`): lantai tampil hanya sebagai perbaikan kepuasan. Bila komponen terlemah kenyamanan dan kursi penuh: "🪑 Kenyamanan 76 %: tambah lantai Ruang tunggu". Bila fasilitas, dan toilet atau parkir penuh: Sayap barat atau Gedung parkir. Aturannya sama dengan perbaikan lain: hanya bila kepuasan < 75 %, untuk komponen dengan kekurangan berbobot terbesar yang punya perbaikan, dengan cadangan B, dan perluasan yang sudah terbuka didahulukan. Lantai tidak menjadi tujuan "menabung" sendiri, supaya baris tujuan tidak menyaingi jalur dan perluasan. Kuncinya memuat gedung dan lantai (pola U-2). **Diterima untuk 0.6.0** (bagian 13): Gedung parkir dan Sayap barat tidak pernah disarankan ke pengikut tujuan. Baris tujuan hanya menyarankan unit fasilitas yang pertama, jadi lahan parkir dan toilet pengikut tetap 1/2 dan slotnya tidak pernah penuh. Kedua lantai itu tetap terjangkau lewat toast dan kartu.
- **Toast saat lantai terbuka** (naik level): satu kali. Bila level itu juga membuka izin, satu toast gabungan: "🏢 Lv 21: lantai 2 Ruang tunggu bisa dibangun".
- **Saat dibeli:** lantai muncul di adegan dengan kembang api kecil (`KembangApi`, palet P-3, +0 draw call), toast, dan tombol "👁 Lihat" di toast dan di kartu. Kamera tidak bergerak sendiri.
- **Mode lihat per lantai** (UI; adegannya di bagian 8.5):
  - **Masuk:** "👁 Lihat" di kartu atau toast. Yang dibuka: lantai tertinggi yang sudah dibangun.
  - **Chip** di atas: "Lantai 2 · Ruang tunggu ✕", dengan ‹ › ke lantai lain gedung itu, termasuk Lantai 1 (lantai dasar). Chip selalu tampil selama mode aktif.
  - **Keluar:** ✕, membuka tab mana pun, popup apa pun, atau kamera digeser jauh dari gedung.
  - **State** hanya UI, tidak disimpan. Simulasi tetap berjalan.

## 7. Teks dalam game

Bahasa Indonesia; game ini belum berbahasa Inggris. Nama memakai spasi tak terputus seperti `Sayap 2 lantai` (playtest P-1).

| Kunci (`teks.ts`) | Teks | Catatan |
|---|---|---|
| `NAMA_GEDUNG_LANTAI` | parkir "Gedung parkir", ruangTunggu "Ruang tunggu", sayapBarat **"Gedung toilet"** (semula "Sayap barat"), aula "Aula loket" | Id `sayapBarat` tetap. Di dokumen ini "Sayap barat" tetap dipakai sebagai nama kerja gedung itu |
| `judulLantai` | `Lantai ${n} · ${nama}` | "Lantai 2 · Ruang tunggu" (24 huruf) |
| `isiLantai` | parkir "+2 lahan parkir (120 kendaraan/jam)"; ruangTunggu "+4 blok kursi (240 kursi) & 1 kios"; sayapBarat **"Selasar penghubung, +1 toilet di lantai dasar"** (cadangan bila tidak muat: "Selasar, +1 toilet di lantai dasar"; pendek: "selasar & +1 toilet"); aula "Mezanin: +2 blok kursi & 2 toko" | Ditambah ", langsung terpasang" bila muat. Lihat catatan di bawah tabel |
| `petugasLantai` | `Ikut direkrut: ${n} ${peran} (Rp ${gaji}/hari)` | Hanya bila aturan petugas berlaku |
| `pratinjauLantai` | `Kenyamanan 89 → 100 %` · `Parkir +Rp 8 jt/hari` · `Fasilitas 64 → 76 %` | Paling banyak 2 bagian |
| `biayaLantai` | `Operasional Rp 2 jt/hari` | |
| `tombolLantai` | `Tambah lantai · Rp 500 jt` / `Kurang Rp 120 jt` | |
| `lantaiTerkunci` | `🔒 Terbuka di Lv 21` | |
| `lantaiSelesai` | `✓ 2 lantai` · `✓ 2 lantai · lantai 3 di Lv 38` | |
| `slotPenuhLantai` | `Slot penuh: tambah lantai ${nama}` · `Slot penuh: lantai ${n} ${nama} di Lv ${L}` | |
| `toastLantaiTerbuka` | `🏢 Lantai ${n} ${nama} bisa dibangun: ${isi}` | Digabung dengan toast naik level bila jatuh di level yang sama |
| `toastLantaiDibeli` | `🏢 ${nama} kini ${n} lantai: ${isi}` | "🏢 Ruang tunggu kini 2 lantai: +4 blok kursi & 1 kios" |
| `tujuanLantai` | `🪑 Kenyamanan ${k} %: tambah lantai ${nama}` · `🚻 Fasilitas ${k} %: tambah lantai ${nama}` | |
| `lihatLantai` | `👁 Lihat` (kartu) · chip `Lantai ${n} · ${nama}  ✕` | |
| Catatan rilis 0.6.0 (Dodi) | `Gedung bisa ditambah lantai: ruang tunggu, aula loket, sayap barat, dan gedung parkir` | Satu catatan |

- Toast memakai isi versi pendek, tanpa keterangan dalam kurung ("+4 blok kursi & 1 kios"). Toast terpanjang ±60 huruf ("🏢 Lantai 2 Ruang tunggu bisa dibangun: +4 blok kursi & 1 kios"), jadi dicek di 360 px (AC-GP-04).
- **`isiLantai.sayapBarat`** semula "+1 toilet, musholla lantai 2", yang menjanjikan musholla di lantai 2. Musholla tetap di lantai dasar (bagian 3), dan isi lantai 2 hanya bilik toilet, wastafel, dan sekat. CHANGE REQUEST Citra "+1 toilet di lantai 2" diterima Sapto 6 November 2026 dan dipasang di `NAMA_GEDUNG_LANTAI` (`src/ui/teks.ts`).
- **Nama Sayap barat diganti menjadi "Gedung toilet": disetujui owner 6 November 2026** (Telegram pesan 270, "APPROVE A", atas gambar selasar dan tangga beserta nama kartu yang diajukan). Owner tidak mengoreksi namanya, dan Sapto sudah memberi tahu owner bahwa nama masih bisa diganti. Rincian dan alasan di rancangan 4.5.
  - **Latar.** Owner memilih A (Telegram 255–261): lantai 2 gedung toilet & musholla menjadi selasar penghubung dari lantai 2 Sayap 2 Lantai ke gedung loket/aula, dan celah 0,2 di antara keduanya ditutup. Hanya tampilan: id `sayapBarat`, harga, level, +1 toilet, save, dan analitik tetap. "Sayap barat" tertukar dengan "Sayap 2 lantai" yang berpapan LANTAI 2.
  - **Dipakai:** `nama` **"Gedung toilet"** (spasi tak terputus), `isi` **"Selasar penghubung, +1 toilet di lantai dasar"** (semula "Selasar penghubung: +1 toilet"; cadangan bila tidak muat di 360×800 atau 900×420: "Selasar, +1 toilet di lantai dasar"), `isiPendek` **"selasar & +1 toilet"**. Hasilnya: kartu dan chip "Lantai 2 · Gedung toilet", chip lantai dasar "Lantai 1 · Gedung toilet", toast "🏢 Gedung toilet kini 2 lantai: selasar & +1 toilet", baris tujuan "🚻 Fasilitas 64%: tambah lantai Gedung toilet".
  - **Alasan:** tanpa kata "Sayap" dan "lantai"; benar untuk kedua lantai; pola sama dengan "Mezanin: …" di Aula loket; sepanjang "Gedung parkir" (13 huruf, judul 900×420 tidak bertambah baris); tidak menjanjikan musholla di lantai 2.
  - **Selasar tanpa toilet** (owner, Telegram 272 "Selasar penghubung jgn ada toilet", lalu 274 "Ok, ikut saran", 6 November 2026):
    - selasar menjadi jalan murni;
    - lantai 2 Gedung toilet tetap memberi +1 toilet dengan harga, level, dan angka yang sama, tetapi toiletnya dihitung di lantai dasar;
    - teks kartu menyebutnya "di lantai dasar";
    - di adegan diatur lewat `GEDUNG_ISI_DI_DASAR` (bagian 11).
  - **Cadangan:** "Toilet & musholla", nama kartu unitnya. Lebih dikenal, tetapi 4 huruf lebih panjang, dan "Toilet & musholla kini 2 lantai" bisa dibaca sebagai musholla ikut naik.
  - **Tidak dipilih:** "Selasar penghubung" sebagai nama, karena "Lantai 1 · Selasar penghubung" salah untuk lantai dasar.

## 8. Grafis

Dasar: purwarupa Panji (`grafis/ukuran.md`, keluaran mentah `grafis/data/`, gambar `grafis/01`–`10` dan `grafis/lain/`; gedung parkir A di `grafis/parkir/`), dengan keputusan Sapto atas CR1–CR7 (brief bagian 9).

### 8.1 Prinsip

1. **Inti permainan tetap 0 % tertutup** di kamera normal (dokumen 16 bagian 1.3): loket 1–8, labirin, antrean luapan, kursi blok 1–4, gerbang, pangkalan, halte kedatangan.
2. **Tahap 0–2 tidak berubah:** +0 draw call. Lantai hanya ada sejak Perluasan 3.
3. **Lantai di tampilan biasa adalah cangkang:** dinding, pita jendela, atap, dan pagar memakai bahan `PustakaMaterial` yang sudah ada dan digabung ke mesh utama. Isinya (kursi, toko, toilet, orang) hanya digambar di mode lantai. Satu-satunya bahan baru yang mungkin adalah kaca malam jendela lantai (keputusan 6).
4. **Cadangan tanpa benda berdiri:** Gedung Antarpulau (x 36…50,14, y 13,2…18,1) dan lahan seberang K14–K17. Aspal rata akses gedung parkir boleh melewati cadangan Antarpulau, karena dokumen 16 menempatkan gedung itu di atas kolom dengan kolong tetap parkir. **Batasan untuk rancangan Antarpulau:** kolomnya menghindari lorong parkir y 15,45–16,25 dan lengkung S ke kaki ramp (x 36–38,4, sampai y 17,3), karena mobil bergerak melewati keduanya.

### 8.2 Letak lantai dan apa yang ditutupnya

| Lantai | Kotak (x, y, tinggi) | Catatan |
|---|---|---|
| **Aula loket 2**, mezanin di belakang dinding utara | x 11,6–29,14, y 10,0–11,2, h 1,9–3,2 | CR1. Kotak lama di dalam aula menutup papan loket 100 % |
| **Ruang tunggu 2**, mezanin selatan | x 29,6–50,14, y 12,0–13,0, muka 1,35–2,7 | Ujung barat mundur ke 29,6 supaya papan jadwal aula terbebas |
| **Sayap barat 2**, separuh utara | Semula x 6,6–11,25, y 11,2–13,1, muka 1,08–2,45. **Sejak 6 November 2026: selasar penghubung x 6,4–11,25, leher sampai x 11,6, lantai 1,35, atap 2,45** (bagian 8.10) | CR3. Tepi timur 11,25, di bawah tritisan atap aula |
| **Gedung parkir 2 + 3**, bentuk A di bagian barat lahan | x 30,8–35,96; dek y 13,6–16,5; lajur ramp y 16,5–17,25; dek 1,05 dan 2,1, tembok s.d. 2,38, papan P s.d. 3,02 | Margin 0,04 supaya lampu dan papan tetap di x < 36. CR2: dek naik dari 0,95/1,95 supaya muka ≥ 6 px di landscape |

**Uji sinar ke mesh** (Panji; titik sampel `grafis/purwarupa/uji-tutup.js` = titik `sim/tutup-lantai.ts` ditambah papan aula), lima layar: P540 (adegan 540×583), P412 (412×627), P360 (360×549), jendela 900×420 (adegan 667×420), jendela 667×420 (adegan 434×420).

| Benda | Letak akhir |
|---|---|
| Inti: loket 1–8 & pembeli, labirin, luapan, mulut antrean, kursi blok 1–4, gerbang, pangkalan, halte kedatangan & bus turun | **0 % di kelima layar** |
| Papan LOKET n, papan PO di atas loket, papan "LOKET TIKET BUS" | **0 %** (100 % dengan kotak lama) |
| Papan jadwal aula | 33 % di portrait, 0 % di landscape, diukur sebelum ruang tunggu 2 dimundurkan ke x 29,6; diukur ulang di fase bangun |
| ATM | 0 % |
| Toilet (di bawah Sayap barat 2) | 67 %; terlihat lewat "Lantai 1" di mode lantai |
| Meja makan ruang tunggu (di bawah mezanin) | 100 %; hiasan, bukan unit sim |
| Mobil tanah di bawah gedung parkir | Baris 1 (x < 36) 100 %, terlihat lewat "Lantai 1". Baris 2 83–100 % dan tertimpa ramp, jadi disembunyikan (bagian 8.6) |
| Kios ruang tunggu, toko aula, kursi aula, musholla, jendela lantai 2 Sayap 2 Lantai, mobil x > 36, menara jam | 0 % |

Ditolak (uji kotak, `sim/keluaran/tutup-lantai.txt`): aula ditumpuk penuh (loket 100 %, labirin 33–100 %, toko 100 %, toilet 50–83 %); ruang tunggu ditumpuk penuh (kursi, gerbang, kios 100 %); sayap barat ditumpuk penuh (toilet 100 %, musholla 67 %); gedung parkir di seluruh lahan (menempati cadangan Antarpulau); dek di atas peron kedatangan (halte & bus turun 50–100 %); dek bus di atas pangkalan (pangkalan 100 %).

**Terbaca di HP**, tinggi muka lantai di layar dalam px CSS, kamera bingkai awal (`grafis/ukuran.md`):

| Lantai | P540 | P412 | P360 | Jendela 900×420 | Jendela 667×420 |
|---|---|---|---|---|---|
| Aula loket 2 | 15,3 | 10,8 | 8,9 | 8,6 | 6,6 |
| Ruang tunggu 2 | 14,7 | 10,6 | 8,7 | 8,3 | 6,3 |
| Sayap barat 2 | 14,6 | 10,4 | 8,6 | 8,3 | 6,3 |
| Gedung parkir 2 (dek 1,05) | 11,1 | 8,1 | 6,7 | 6,3 | **4,8** |
| Gedung parkir 3 (dek 2,1) | 11,4 | 8,2 | 6,7 | 6,4 | **4,9** |

Batas 6 px (dokumen 16) lolos di jendela 360×800 dan 900×420. Gedung parkir di jendela landscape 667 px (adegan 434×420) 4,8–4,9 px: diterima, karena gedung parkir terbaca dari mobil di dek atasnya. Di 412 di bawah tilt-shift, dek parkir dengan mobil terbaca jelas; mezanin aula terbaca sebagai pita panjang berjendela di belakang atap lengkung.

### 8.3 Beban dan batas

Diukur Panji pada purwarupa: jendela 900×420, `?tingkat=1`, jam 12, save tahap 3 Lv 40 dengan bangunan penuh; A/B di halaman yang sama, median (`grafis/data/ukur-beban.txt`, `grafis/parkir/data/log-ukur.txt`, `log-ulang.txt`).

| Keadaan | Hasil |
|---|---|
| Kelima lantai, tampilan biasa, gedung parkir A (4 × 24 frame / ulang 6 × 24 frame) | **+0 draw call / +4,5 rb** dan **+0 / +5,0 rb** segitiga |
| Mode lantai Gedung parkir 2, kamera tetap | +1 draw call / −0,9…+0,6 rb di atas tampilan biasa |
| Mode lantai Ruang tunggu / Aula, kamera tetap (bentuk parkir lama) | +1 / +4,9 dan +3,4 rb |
| Mode lantai, kamera mendekat ke Ruang tunggu | −40…−41 draw call / −14,8 rb dibanding tampilan biasa |
| Tahap 2 Lv 13, ada lantai di save | +0 / +0 |
| Ditolak: isi keempat gedung selalu digambar | +1 / +16,1 rb |
| Ditolak: cangkang sebagai grup sendiri | +18 / +4,8 rb |

Derau: draw call bergerak 254–257 antar-frame; hanya median A/B di halaman yang sama yang sah. Sisa terhadap batas +7 rb: ±2,0–2,5 rb untuk fase bangun.

**Belum masuk angka itu** (perkiraan hitung tangan, bukan ukuran): 7 mobil tanah yang disembunyikan −1,3 rb (sampai −2,6 rb dengan bayangan); mobil bergerak, 4 mobil, +0 draw call, ±370 segitiga per mobil di tingkat 1 dengan bayangan dan kolong; jumlah sekitar +3,4…+5,2 rb. Pengukurannya kewajiban Panji di fase bangun (AC-GFX-10).

**Batas (brief, mengikat):**

| Kasus | Batas |
|---|---|
| Tahap 0–2 | +0 draw call |
| Tampilan biasa, kelima lantai, termasuk mobil bergerak | ≤ +2 draw call, ≤ +7 rb segitiga |
| Mode lantai aktif, kamera tetap, di atas tampilan biasa | ≤ +2 draw call, ≤ +6 rb segitiga |
| fps | Tidak bisa dinilai di mesin ini; dicek owner di HP saat uji rilis |

Batas lama (+4 draw call, +15 rb) diperketat karena +15 rb sendirian melewati sisa anggaran tahap 3+ dokumen 16 (±7–10 rb), yang juga dibutuhkan Gedung Antarpulau dan lantai peron.

### 8.4 Mode lihat per lantai: jawaban untuk owner

**Apakah mengurangi beban grafis?**

- **Di tampilan biasa: tidak.** Pemain hampir selalu di tampilan biasa. Beban tetap kecil karena dua keputusan lain: lantai digambar sebagai cangkang (+4,6 rb, dibanding +16,1 rb bila isi selalu digambar) dan cangkang digabung ke mesh utama (+0 draw call, dibanding +18).
- **Selama mode aktif: ya, sementara.** Modenya sendiri +1 draw call; karena kamera mendekat ke satu gedung, layar memuat −40 sampai −41 draw call dan −14,8 rb segitiga.
- **Beban puncak tetap di tampilan biasa**, jadi mode lantai tidak menurunkan syarat HP.

Mode lantai tidak menghemat; ia membuat penghematan cangkang bisa diterima, karena tanpa mode pemain tidak pernah melihat kursi dan toko yang dibelinya. Menumpuk penuh lalu memakai mode lantai untuk melihat lantai dasar tidak bisa dipakai: sorotan leher botol, antrean, dan "+N tiket" adalah umpan balik inti, dan pemain tidak boleh harus berpindah mode untuk melihatnya.

### 8.5 Mode lantai di adegan

- Kamera bergeser ke gedung itu dengan perbesaran dan margin per gedung (pola geser label area yang sudah ada); gedung jatuh di pita tajam tilt-shift. Sayap barat terlalu dekat di purwarupa (`grafis/09`).
- Lantai di atas lantai yang dilihat disembunyikan; atap dan jendela lantai itu dibuka, pagar kaca rendah menggantikannya, dan isinya digambar. Isi satu `KumpulanUnit` tanpa bayangan, dibangun saat pertama dibutuhkan.
- Gedung parkir: ramp 1 ikut dek 2, ramp 2 ikut dek 3. Di "Lantai 1" ramp tersembunyi, aspal dan gapura tetap.
- Gambar purwarupa: `grafis/09` (P412), `grafis/10` (landscape 900×420), keempat gedung di `grafis/lain/mode-*`, gedung parkir A di `grafis/parkir/gambar/A-mode-L1.png` sampai `L3`.

### 8.6 Gedung parkir bentuk A

Purwarupa `grafis/parkir/purwarupa/parkir-opsi.ts` fungsi `parkirA`; pilihan B dan C dibuang. Owner mengeluh ramp purwarupa lama tidak mungkin dilewati mobil, jadi ukuran "bisakah mobil lewat" dipakai untuk setiap perubahan ramp.

| Bagian | Isi |
|---|---|
| Ramp | Dua ramp lurus bertumpuk di sisi selatan, naik ke barat. Ramp 1: x 35,96 → 31,2, h 0,03 → 1,05 (21 %). Ramp 2: x 35,6 → 31,2, h 1,05 → 2,1 (24 %). Lajur y 16,5–17,25, lebar 0,75, bersih 0,65, pagar di kedua sisi |
| Dek | Lorong berwarna y 14,65–15,45 dengan sambungan di sisi barat dan timur. Baris mobil y 14,17 (8 petak) dan y 15,93 (6 petak): 14 petak per dek |
| Tanda | Papan "P GEDUNG PARKIR" di muka timur, papan P di dek teratas, strip lampu malam di muka timur dan tembok selatan ramp |
| Sambungan | Lajur paving x 50,14–51,6 di timur ruang tunggu dari ujung timur jalan dalam (awal kurva `KELUAR`, x 50,8) ke lorong parkir y 15,85; aspal ke barat, lalu lengkung S ke kaki ramp di x 36. Gapura "P MASUK PARKIR" di y 13,35 |
| Jalan samping | Aspal rata x 51,2–57,8, y 4,5–5,3, menyambung ke pelataran SPBU (beton mulai x 57,8). Asal dan tujuan mobil bergerak (bagian 8.7) |
| Lampu taman | Pindah permanen dari (50,74, 9,6) ke (51,49, 9,6), di semua tahap |

- **14 petak per dek tidak bertentangan dengan "+2 lahan parkir".** Pendapatan dihitung dari lahan, bukan petak. Di adegan 1 lahan = 1 baris (`barisParkir`), jadi dua baris per dek = 2 lahan per lantai: lahan mana yang tampil di dek dan di tanah mengikuti aturan isi lantai di bagian 11 (dek diisi lebih dulu). Kartu tidak menyebut petak.
- **Mobil tanah:** baris 2 (y 16,75) di x 30,5–37,75 tertimpa ramp dan lengkung S: 7 mobil. Mereka disembunyikan selama `lantai.parkir ≥ 1` lewat pemilihan unit (+0 draw call); tanpa gedung parkir semuanya sama dengan 0.5.0. Baris 1 di x < 36 tetap di kolong. Urutan `acak()` benih 61 tidak berubah.
- **Perubahan dari purwarupa karena mobil kini bergerak:** palang melintang lajur dibuang atau diganti palang berdiri terbuka; mobil statis di ramp dibuang; bukaan dek 2 ke ramp 2 dilebarkan (celah lama 0,30 lebih sempit dari mobil 0,36: ujung pagar utara ramp 2 dipendekkan ke x ≈ 35,1 dan kolom dek 3 di x 35,81–35,95 dipindah); bibir dek teratas ditutup tembok; panah pindah ke masing-masing lajur.
- **Kemiringan** 21 % dan 24 % masih lebih curam dari perkiraan Panji untuk gedung parkir sungguhan (±15–20 %, belum diverifikasi). Menurunkan dek melanggar batas 6 px, memanjangkan gedung masuk cadangan Antarpulau; tidak dinaikkan lagi di fase bangun.
- **Terbaca:** detail ramp jelas dari kamera dekat. Dari kamera awal, di 412 dek terbaca tetapi sisi selatan masuk pita kabur tilt-shift; di landscape 900×420 hanya warna dan siluet. Ramp bukan umpan balik inti.

### 8.7 Mobil bergerak (hanya tampilan)

Gedung yang dibeli terlihat dipakai, dan ramp terbukti bisa dilewati mobil. Tanpa angka ekonomi, state tersimpan, aksi, atau suara baru. Jumlah mobil mengikuti lantai dan jam, bukan arus atau pendapatan parkir.

| Hal | Aturan |
|---|---|
| Kapan muncul | `lantaiAdegan(...).parkir ≥ 1` dan ada lahan parkir. Ronde perbaikan: total `bangunan.lahanParkir > 0`, bukan `barisParkir`, karena dengan aturan isi lantai (bagian 11) baris lantai dasar bisa 0. Lantai 3 membuka ramp kedua |
| Paling banyak | Lantai 2: 3 mobil. Lantai 3: 4 mobil (ramp satu lajur; hitung tangan: satu putaran ±100 satuan, ±76 detik di 1×) |
| Mengikuti jam | `kepadatanLuar` (pola `LaluLintas.kepadatan`), ambang mobil ke-1…4: 0; 0,4; 0,65; 0,85 |
| Ikut atau berhenti | Hanya di titik muncul; tidak ada mobil yang hilang di depan mata |
| Saat dibeli dan dimuat | Mobil langsung ditempatkan merata di jalur (pola `aturKepadatanSegera`) |
| Tujuan | Lantai 2: dek 2. Lantai 3: separuh dek 2, separuh dek 3; mobil ambang 0 ke dek 3 |
| Ramp bergantian | Satu arah pada satu waktu per zona (lengkung S + ramp 1 + sisi barat dek 2; landasan timur + ramp 2 + sisi barat dek 3). Mobil searah beriringan dengan jarak aman 0,5; yang berlawanan menunggu di titik tunggu di lajurnya sendiri |
| Cara keluar | Memutar di ujung timur lorong dek, turun lewat ramp yang sama, kembali lewat lajur keluar |
| Mode lantai Gedung parkir | Lantai 1: semua mobil bergerak tersembunyi. Lantai 2: hanya yang bertujuan dek 2. Lantai 3: semua. Mobil tetap berjalan walau tersembunyi |
| Malam, hujan, kecepatan | Tetap berjalan tanpa lampu; hujan tidak mengubah jumlah; ikut `dt`, jadi 1×/2×/3× konsisten; offline tidak dihitung |
| Tingkat kualitas | Tidak dimatikan per tingkat; polanya tidak ada di kode (`TINGKAT` hanya mengatur render) |

**Jalur** (lajur kiri, seperti jalan belakang):

| Ruas | Letak | Masuk | Keluar | Laju |
|---|---|---|---|---|
| Asal | Pelataran SPBU dan jalan samping, x 63,5 → 51,2 | y 5,1 | y 4,7 | 2,0 |
| Lajur timur | Paving x 50,14–51,6, y 5,6 → 14,9 | x 51,05 | x 50,65 | 1,4 |
| Lorong parkir | y 15,45–16,25, x 49,9 → 38,6 | y 16,05 | y 15,65 | 1,4 |
| Zona ramp 1 | Lengkung S ke (35,96, 16,875), ramp 1, sisi barat dek x 30,85–31,45 | Bergantian; tunggu di x ≈ 38,6 | Bergantian; tunggu di lorong dek x ≈ 31,9 | 1,0 |
| Lorong dek | y 14,65–15,45 | y 14,85 ke timur | y 15,25 ke barat | 1,0 |
| Putar balik | x 34,82–35,91, y 14,65–16,3, radius ≥ 0,35 | | | 1,0 |
| Zona ramp 2 (lantai 3) | Ruang putar → landasan timur → ramp 2 → sisi barat dek 3 → lorong dek 3 dan putar balik yang sama | Bergantian | Bergantian | 1,0 |

Pembanding laju: mobil jalan belakang 2,0–2,8, bus 3,4.

- **Kenapa jalan samping.** Jalan raya searah ke timur (bus dari `X_MUNCUL` ke `X_HILANG`), jalan dalam searah dan padat bus, dan ujung timurnya hanya tersambung ke kurva `KELUAR`. Mobil butuh asal di luar kamera awal. Jalan samping tidak bersinggungan dengan bus (bus di `KELUAR.dari` paling jauh y 4,28; lajur keluar mobil mulai y 4,52), tidak mengenai tiang SPBU (58,1, 4,2) atau pohon timur, dan berada di luar bingkai awal (x ≥ 51,5 0 % di portrait; x 57,7 di luar landscape). Jalan raya dan bukaan median tidak berubah.
- **Orang dari parkir.** 28 % calon penumpang muncul di lorong x 31,2–42,0, y 15,85 ± 0,15. Selama gedung parkir ada, rentang munculnya x 31,2–36 (di kolong, barat kaki ramp), sehingga mereka terlihat keluar dari gedung parkir. Urutan `acak()` tetap; tanpa gedung parkir tidak berubah.
- **Kapasitas `LaluLintas3D(48)`:** kolongnya dipakai juga oleh 50 kendaraan jalan belakang, sehingga meluap pada kepadatan 1: 2 bayangan kolong terakhir tidak digambar (dibuktikan Panji di tonggak 1). Kapasitas dinaikkan ke 54, dengan tes.
- **Penyimpangan saat dibangun, diterima Sapto (6 November 2026):**
  - dua kunci tambahan di tikungan dua lajur (jalan samping → lajur timur, lajur timur → lorong parkir). Lajur masuk dan keluar hanya berjarak 0,4, sehingga pojok mobil yang berbelok menyapu mobil di lajur sebelah. Akibatnya mobil kadang menunggu sebentar di tikungan;
  - titik tunggu turun di lorong dek x 32,4 (bukan ±31,9), dan mulut ruang putar dikunci mulai x 33,4, supaya 4 mobil tidak saling kunci;
  - petak dek baris 1 ke-1, 7, dan 8 tanpa mobil diam; marka 14 petak tetap;
  - juru parkir dipindah dari dalam kolom ke (30,9, 16,12).
- **Beban terukur** (Panji, 6 November 2026): tampilan biasa +1 draw call (kaca malam lantai) / +3,0…3,3 rb segitiga dengan 4 mobil bergerak; mode lantai +1 (derau ±1) / ≤ +5,3 rb di atas tampilan biasa; tahap 2 +0. Semua di dalam batas bagian 8.3, jadi urutan penurunan di bawah tidak dipakai.
- **Bila beban melewati +7 rb** (diukur pada jumlah paling banyak, kepadatan 1, mobil tanah sudah disembunyikan), berurutan: (1) sembunyikan juga mobil tanah baris 1 di x < 36 kecuali di Lantai 1 (100 % tertutup di tampilan biasa); (2) turunkan jumlah paling banyak satu per satu (lantai 3: 4 → 3 → 2, lantai 2: 3 → 2), sebagai konstanta; (3) masih lewat dengan 2 mobil: berhenti dan CHANGE REQUEST. Batas tidak dilonggarkan, dan bayangan lalu lintas jalan belakang tidak diubah.

### 8.8 Jendela lantai di malam hari (keputusan 6)

Pita jendela purwarupa memakai kaca gelap `m.kaca`, dengan emisif malam 0,35 (`src/game/material3d.ts`), sehingga lantai baru hampir hilang di malam hari (`grafis/05`). Malam penuh jam 19.45–04.30 hari game, ±36 % waktu main.

- **Yang dipilih:** jendela lantai baru menyala setara emisif 1,0, benda lain tidak berubah. Contohnya bahan kaca malam sendiri untuk pita jendela lantai. Perkiraan +1 draw call di tampilan biasa, **belum diukur**; tahap 0–2 tetap +0.
- **Kenapa bukan menaikkan `m.kaca` ke 1,0:** bahan itu dipakai di 8 tempat (kaca kios ruang tunggu dan kios teras, jendela masjid, kaca pos retribusi, layar mesin tiket, jendela ruko, rumah kampung, toko SPBU). Ruko, kampung, dan SPBU dibangun tanpa syarat, jadi malam di tahap 0–2, termasuk sesi pertama, ikut berubah, dan lantai baru tidak lagi menonjol. Kios tutup 22.30–05.00, tetapi kacanya justru paling terang saat itu.
- **Kenapa bukan pita gaya aula atau fasad kota:** pita krem terbaca sebagai dinding di siang hari, saat pemain paling lama melihat; fasad kota menyatu dengan gedung kota yang meninggi per level, sehingga lantai terbaca sebagai gedung latar.
- **Bila cara itu lebih dari +1 draw call** (brief AC-GFX-02): berhenti, CHANGE REQUEST, dan gambar malam tahap 1 sebelum/sesudah untuk owner.

### 8.9 Lain-lain

- Baliho PO Lv 13 dan Lv 22 pindah ke y ≥ 13,05, di depan muka mezanin ruang tunggu (CR6).
- Atap hujan (`ATAP_DAFTAR`) mencakup keempat cangkang, termasuk gedung parkir dan bagian aula di belakang dinding (CR7).
- Kembang api kecil di gedung saat dibeli, tanpa suara baru; dipicu dari kenaikan `lantai` antar-frame, tidak saat muat.
- Pemain lama dengan save tahap ≥ 3 tidak melihat apa pun yang baru sampai membeli lantai; tidak perlu peresmian susulan.

### 8.10 Selasar penghubung dan tangga Sayap 2 Lantai (pilihan owner A)

**Keputusan:** owner memilih A (Telegram 255–261) dan memberi "APPROVE A" atas gambar selasar, tangga, dan nama kartu (pesan 270, 6 November 2026). Sebabnya, kartu "Lantai 2 · Sayap barat" tertukar dengan Sayap 2 Lantai yang berpapan LANTAI 2. Hanya tampilan: id `sayapBarat`, harga, level, +1 toilet, save, dan analitik tetap. Nama kartunya "Gedung toilet" (bagian 7). Rincian koordinat ada di rancangan 6.8, gambar sebelum dan sesudah di `grafis/selasar/01`–`10`.

- **Selasar penghubung** (lantai 2 Sayap barat): jembatan berkaca dari lantai 2 Sayap 2 Lantai ke gedung loket/aula.
  - Denah x 6,4–11,25, y 11,2–13,1.
  - Pelat dari atap kaca (h 1,08) dipertebal sampai `H_LANTAI_2` 1,35, setinggi lantai 2 Sayap 2 Lantai.
  - Leher x 11,25–11,6, beratap rendah (h 2,2) di bawah tritisan aula, berakhir di pintu kaca dinding barat aula.
  - Pita kaca kedua sisi memakai `m.kacaLantai`, jadi menyala di malam hari (keputusan 6); atap logam rata h 2,45.
  - **Jalan murni, tanpa toilet** (owner, Telegram 272 dan 274): karpet jalan berpanah, dan orang lewat sebagai bagian tetap. +1 toilet lantai ini dihitung di lantai dasar Gedung toilet (`GEDUNG_ISI_DI_DASAR`, bagian 11). Bilik toilet purwarupa awal dibuang.
  - Beban **+354 segitiga, +0 draw call**.
- **Dinding pengisi celah** x 6,4–6,6, y 11,2–15,0: plester h 0–1,0 dan lis h 1,0–1,08, sehingga Sayap 2 Lantai dan gedung toilet & musholla terbaca satu gedung. Dinding ini ikut Sayap 2 Lantai, jadi berdiri sejak Perluasan 3.
- **Tangga Sayap 2 Lantai A ("lurus")** menggantikan tangga dan eskalator dua lajur A3 dokumen 16.
  - Satu bentang terbuka x 11,1–13,15, y 16,75–17,45, sejajar pagar kompleks, naik ke barat (±33°) sampai bordes x 10,4–11,1 di tepi teras.
  - Pijakan tipis tanpa tegakan, balok sisi baja, pagar tiang tipis. Warna biru tangga lama hilang.
  - Kakinya di plaza, dekat jalan dari gerbang MASUK.
  - **Di semua tahap**, tiang bendera pindah dari (12,2, 16,8) ke (14,6, 16,6), dan lampu plaza dari (12,9, 17,2) ke (13,75, 16,45).
  - Pilihan "balik" ditolak. Dokumen 16 bagian 3.1 dan 4.3 diberi catatan.

## 9. Edge case

| Kasus | Perilaku |
|---|---|
| Save lama tanpa `lantai` | Semua 0; unit lama tidak berubah |
| Save 0.6.0 dimuat 0.5.0 (cloud save, rollback) | 0.5.0 memotong kursi, toilet, kios, toko, dan lahan parkir ke slot lamanya, lalu menyimpannya permanen (`bacaBangunan`). Karena itu `versiMinimal` 0.6.0. Rollback hanya aman sebelum ada pemain yang membeli lantai |
| Urutan baca save | `lantai` dibaca sebelum `bangunan`, karena slot memakai lantai |
| Nilai `lantai` tidak sah (negatif, pecahan, di atas maksimal, gedung tak dikenal) | Dijepit ke 0…maks dan dibulatkan ke bawah; gedung tak dikenal dibuang. Save tidak pernah ditolak |
| Kas Rp 0 / kas menipis | Tombol redup. Baris tujuan tidak menyarankan lantai (aturan aman). Operasional lantai ikut "kas menipis" lewat laba operasi |
| Petugas berhenti karena kas habis | Seperti biasa: yang terakhir direkrut keluar lebih dulu; lantai dan unit tetap |
| Bongkar unit di lantai | Boleh, 30 % kembali; slot tetap dan bisa diisi lagi dengan harga unit biasa |
| Offline | Lantai tidak berjalan offline. Efeknya ikut rumus offline (unit, operasional, kepuasan). Popup offline belum menyebut lantai yang terbuka selama pergi ("Lantai 2 Ruang tunggu bisa dibangun"; rancangan 4.6, prioritas rendah, pola P-7): **tidak dikerjakan di 0.6.0** (keputusan Sapto, 6 November 2026), masuk sisa (bagian 15). Kartu lantai di tab Bangun tetap menunjukkan lantai yang terbuka |
| Kecepatan 1×/2×/3× | Tidak ada pewaktu lantai; mobil bergerak ikut `dt` |
| Event musiman | Efek kepuasan ikut pasar event; tidak ada aturan khusus |
| Musim Terminal | Lantai dihitung 1 untuk tugas *kelola* `bangun` dan tantangan "bangun". Tuas tugas tidak menunjuk lantai. Tanpa poin tambahan |
| Papan peringkat | Arus naik +0,3–1 % per lantai; batas server (`ARUS_WAJAR_MAKS`) jauh di atas |
| Tutorial | Tidak tersentuh |
| Terjebak | Tidak mungkin: lantai tidak wajib, tidak mengunci apa pun, dan tidak membuat kas minus |

## 10. Save dan analitik

### 10.1 Save

- **Field baru:** `terminal.lantai?: Partial<Record<GedungLantaiId, number>>` di `SaveV3` dan `TerminalState.lantai`. Opsional; skema tetap 3. Tanpa field berarti semua 0. Ukuran save bertambah < 80 karakter.
- **`bacaLantai`** menyaring nilainya (bilangan bulat 0…`level.length`, gedung tak dikenal dibuang) dan dipanggil sebelum `bacaBangunan`.
- **`versiMinimal` 0.6.0** saat rilis (AC-PLT-01): klien 0.5.0 mengabaikan `lantai`, memotong unit di atas slot lama, lalu menyimpan potongan itu, termasuk ke cloud save. Alasan yang sama dengan 0.4.0 (dokumen 13 bagian 13).
- **Rollback 0.6.0 → 0.5.0:** pemain yang sudah membeli lantai kehilangan unit lantai dan uangnya. Rollback hanya di jam-jam pertama sesudah deploy; sesudahnya hotfix.

### 10.2 Analitik

| Peristiwa | Parameter | Untuk menjawab |
|---|---|---|
| `lantai_beli` | `gedung` (parkir, ruangTunggu, sayapBarat, aula), `lantai` (angka), `level` (angka) | Berapa lama sesudah terbuka lantai dibeli; lantai mana yang dilewati |
| `lantai_lihat` | `gedung`, `lantai` | Apakah mode lantai dipakai |

- `ringkasan_sesi` mendapat parameter `lantai` (jumlah lantai tambahan); `tujuan_ketuk.jenis` mendapat nilai baru bila baris tujuan menyarankan lantai.
- Tanpa data pribadi; jenis pemrosesan data tidak berubah, jadi `privasi.html` cukup diperiksa Dodi. Owner mendaftarkan dimensi `gedung` dan `lantai` di GA4. Tidak ada peristiwa dari mesin tim ke GA4 sungguhan.

## 11. Antarmuka antar-area (brief bagian 5)

- **Id** di `src/sim/fitur.ts`: `GEDUNG_LANTAI_IDS = ['parkir','ruangTunggu','sayapBarat','aula'] as const`, `type GedungLantaiId`, `type LantaiDilihat = { readonly gedung: GedungLantaiId; readonly lantai: number }`.
- **Penomoran:** `TerminalState.lantai: Readonly<Record<GedungLantaiId, number>>` menghitung lantai tambahan (0 = hanya lantai dasar, tidak pernah turun). `LantaiDilihat.lantai` adalah nomor lantai: 1 = lantai dasar, sampai `1 + state.terminal.lantai[gedung]`. Chip menampilkan nomor lantai.
- **Config** `EKONOMI.tycoon.lantai: Readonly<Record<GedungLantaiId, KonfigLantaiGedung>>` dengan `level`, `tahap`, `biaya`, `operasional`, `isi` (bagian 5).
- **Aksi:** `{ jenis: 'tambahLantai'; gedung: GedungLantaiId }` → `tambahLantai(state, gedung, cfg)` di `src/sim/state.ts`; ia juga memanggil `catatBangun`, dan `nilaiTugasKelola` menghitung jenis ini.
- **Slot:** `slotBangunan(id, perluasan, level, cfg, lantai)` menambah `Σ lantai[g] × isi[g][id]`; `slotBangunanState` meneruskan `state.terminal.lantai`. Operasional: `operasionalGedung` ditambah `Σ lantai × operasional`, jadi baris "Operasional gedung" di laporan tidak berubah.
- **Helper sim** `src/sim/lantai.ts` (Raka): `syaratLantai(gedung, lantai, perluasan, level, cfg)` → `{ jenis: 'tahap', tahap } | { jenis: 'level', level } | { jenis: 'maks' } | null`; `biayaLantai(...)` → `number | null`; `petugasIkutLantai(state, gedung, cfg)` → `PetugasId[]`; `lantaiUntukUnit(id, lantai, perluasan, level, cfg)` → `{ gedung, lantai, level } | null` (teks "Slot penuh"); `lantaiTerbukaAntara(dari, ke, perluasan, cfg)` (toast naik level, popup offline). UI: `pratinjauLantai(state, gedung, cfg)`.
- **Mode lantai, satu jalur dari UI ke adegan:** UI memegang `lantaiDilihat: LantaiDilihat | null` (tidak disimpan); `src/main.ts` meneruskannya lewat `t.aturLantaiDilihat(v)`, method Terminal3D dengan pola `t.aturSinema`. Chip, ‹ ›, dan aturan keluar ada di UI. Keluar karena kamera digeser jauh: Panji menyediakan `t.saatLantaiDilepas(cb)` atau cara setara.
- **Helper murni adegan** `src/game/lantai-adegan.ts` dan `src/game/mobil-parkir.ts` (keduanya di `GAME_MURNI`): `lantaiAdegan(lantai, perluasan)` (cangkang yang digambar; 0 di tahap < 3), `cangkangTerlihat`, `isiTerlihat`, `isiLantaiAdegan(gedung, nomor, lantai, bangunan, perluasan)` (unit yang terlihat di mode lantai, `ada` menurut aturan isi lantai di bawah). `mobil-parkir.ts` memuat jalur, titik tunggu, zona bergantian, dan ambang; masukannya hanya `lantaiAdegan(...).parkir`, ada lahan parkir, `kepadatan`, dan `dt`.
- **Aturan isi lantai: lantai diisi lebih dulu, lantai dasar menampilkan sisanya** (keputusan Sapto, 6 November 2026, ronde perbaikan; rincian, contoh, dan tes di rancangan 8.4). Aturan ini menggantikan penomoran slot (kursi ke-9…12, kios ke-4, toko ke-5…6, lahan ke-3…6) dan aturan khusus toilet `≥ 2`. Dengan penomoran slot, pengikut tujuan yang membeli lantai dengan kios 1/3, toko 0/4, atau toilet 1/2 melihat lantai barunya kosong di mode lantai (bagian 13).
  - **Fungsi murni** di `src/game/lantai-adegan.ts` (`GAME_MURNI`): `bagiIsiLantai(bangunan, lantai, perluasan, cfg?) → { dasar: Record<JenisIsi, number>; perLantai: Record<GedungLantaiId, Partial<Record<JenisIsi, number>>[]> }`, dengan `perLantai[g][nomor − 2]` = unit tiap jenis yang ada di lantai itu.
  - **Aturan per jenis** (kursi, kios, toko, toilet, lahan parkir):
    - `L = lantaiAdegan(lantai, perluasan)`; `n = bangunan[j]`; kapasitas lantai `K = Σ L[g] × isi[g][j]`, **kecuali gedung di `GEDUNG_ISI_DI_DASAR`** (kini `['sayapBarat']`). Isi gedung itu tetap di `dasar`, dan lantainya hanya bagian tetap (selasar);
    - `keLantai = min(n, K)`, `dasar = n − keLantai`;
    - `keLantai` mengisi lantai menurut level terbukanya, naik (seri: urutan `GEDUNG_LANTAI_IDS`): kursi Ruang tunggu 2 lalu Aula 2, lahan dek 2 lalu dek 3. Tiap lantai mengambil paling banyak `isi`-nya, dan di dalam lantai unit urut 1 … k ada.
  - **Akibat:**
    - membeli lantai tidak mengubah lantai dasar, dan lantai baru langsung penuh (kursi 6 + RT2 → dasar 6, RT2 4; kios 1 → dasar 1, RT2 1; toilet 1 + Gedung toilet 2 → dasar 2, dan selasar tampil sebagai jalan);
    - bongkar mengurangi lantai dasar lebih dulu, dan lantai yang terbuka paling akhir kosong lebih dulu;
    - tanpa lantai, `dasar = bangunan`, sama dengan 0.5.0;
    - `dasar ≤ slot tahap` untuk kursi, kios, toko, dan lahan; toilet bisa sampai 3, tetapi digambar ada/tidak;
    - toilet selalu di lantai dasar (selasar tanpa toilet); aturan `toilet ≥ 2` tidak berlaku lagi.
  - **Pemakai:**
    - `fasilitasAdegan` (`blokKursi`, `kios`, `toko`, `barisParkir`) memakai `dasar`;
    - pengantar dari parkir (`dunia-visual.ts:1179`) dan mobil bergerak (`terminal3d.ts:788`) memakai **total** `lahanParkir > 0`;
    - singgah toilet dan musholla (`FasilitasAdegan.toilet`) memakai **total** `toilet > 0`;
    - isi mode lantai memakai `perLantai`.
- **Tata letak:** satu konstanta per gedung di `src/game/tata-letak.ts` (letak bagian 8.2), dan `CADANGAN_ANTARPULAU` (x 36…50,14, y 13,2…18,1) dengan tes: benda berdiri 0, aspal rata boleh.
- **Adegan hanya membaca** `state.terminal.lantai`, `bangunan`, `perluasan`, dan nilai dari `aturLantaiDilihat`. Tidak mengirim aksi. `LaluLintas3D.perbarui` mendapat masukan x, y, h, yaw, pitch untuk mobil di ramp; kolong ikut h dan pitch.
- **Server dan data:** tidak berubah.

## 12. Kriteria penerimaan

Teks lengkap ada di rancangan bagian 8.5; brief bagian 6 menetapkan yang di bawah sesudah APPROVE.

**Gameplay & UI**

- **AC-GP-01** Config `EKONOMI.tycoon.lantai` persis bagian 5. Tes: slot naik sebesar `isi` tiap lantai; membeli mengurangi kas sebesar harga, membangun isinya, dan merekrut petugas menurut aturan; tidak bisa dibeli sebelum tahap 3 atau level, saat kas kurang, atau saat maksimal; tidak bisa dibongkar.
- **AC-GP-02** `tests/tycoon-tempo.test.ts` dan `tests/tycoon-kasual.test.ts` lulus tanpa diubah. `tests/tycoon-sim.ts` boleh diberi aksi lantai mengikuti `sim/tycoon-sim-lantai.ts`; angka bagian 13 kolom G diulang: Tipe A 5,0–5,1 jam, Terpadu 10,8–11,0 jam, buntu 41 menit.
- **AC-GP-03** Save: bolak-balik mempertahankan `lantai` dan unit lantai; save 0.5.0 tanpa `lantai` dimuat tanpa perubahan unit; nilai rusak dijepit tanpa menolak save; unit di slot lantai tidak terpotong saat dimuat (urutan baca).
- **AC-GP-04** Kartu lantai dengan tujuh keadaan bagian 6. Teks bagian 7 muat tanpa terpotong di 360×800 dan 900×420.
- **AC-GP-05** "Slot penuh" pada kursi, kios, toko, toilet, dan lahan parkir menunjuk lantai bila lantai adalah sumber slot berikutnya.
- **AC-GP-06** Baris tujuan menyarankan lantai hanya sebagai perbaikan kepuasan yang aman (cadangan B). Harness pengikut dijalankan Citra sesudah dibangun: kas menipis 0.
- **AC-GP-07** Lantai dihitung 1 pada tantangan "bangun" dan tugas kelola `bangun`.
- **AC-GP-08** Mode lantai masuk dan keluar sesuai bagian 6, tidak disimpan, simulasi tetap jalan.
- **AC-GP-09** `lantai_beli` dan `lantai_lihat` lewat `PencatatAnalitik`, diuji dengan pencatat palsu. Tidak ada peristiwa ke GA4 sungguhan.

**Grafis & audio**

- **AC-GFX-01** Empat cangkang di letak bagian 8.2. Uji sinar ke mesh di kelima layar: benda inti 0 %; papan LOKET n, papan PO, "LOKET TIKET BUS", dan papan jadwal aula 0 %; cadangan Antarpulau dan K14–K17 tanpa benda berdiri (`CADANGAN_ANTARPULAU` dan tes baru), aspal rata boleh di cadangan Antarpulau.
- **AC-GFX-02** Tinggi muka ≥ 6 px di jendela 360×800 (adegan 360×549) dan 900×420 (adegan 667×420). Jendela malam menurut keputusan 6: hanya jendela lantai baru setara emisif 1,0, benda lain tidak berubah, tahap 0–2 +0. Lebih dari +1 draw call: berhenti, CHANGE REQUEST, gambar malam tahap 1 sebelum/sesudah untuk owner. Hujan tidak menembus atap baru, termasuk gedung parkir dan aula di belakang dinding.
- **AC-GFX-03** Beban: tahap 0–2 +0; tampilan biasa ≤ +2 draw call dan ≤ +7 rb segitiga; mode lantai ≤ +2 dan ≤ +6 rb di atas tampilan biasa. A/B di halaman yang sama, median 4 putaran × 24 frame, state asli, mobil tanah tersembunyi, dengan dan tanpa mobil bergerak pada jumlah paling banyak.
- **AC-GFX-04** Mode lantai keempat gedung: lantai di atasnya tersembunyi, isinya terlihat, ‹ › sampai Lantai 1, kamera dengan margin per gedung di pita tajam; gambar 412 dan landscape. Lantai 1 Gedung parkir: ramp tersembunyi, aspal dan gapura tetap.
- **AC-GFX-05** Kembang api kecil di gedung saat dibeli, tanpa suara baru, tidak saat muat. Terlihat siang di 412.
- **AC-GFX-06** Baliho PO Lv 13 dan Lv 22 di y ≥ 13,05, tetap terlihat sesudah mezanin ruang tunggu dibangun.
- **AC-GFX-07** Gedung parkir A: tapak x 30,8–35,96, benda berdiri, lampu, dan papan di x < 36; dek y 13,6–16,5, lajur ramp y 16,5–17,25; kemiringan ramp 1 ≤ 21,5 %, ramp 2 ≤ 24 %; lajur bersih ≥ 0,65; pagar di kedua sisi; baris mobil dek y 14,17 dan 15,93, 14 petak per dek; tanpa mobil statis di ramp dan tanpa palang melintang lajur; bukaan dek 2 ke ramp 2 dilebarkan, bibir dek teratas ditutup. Gambar kamera awal dan dekat di 412 dan 900×420, siang, malam, dan hujan.
- **AC-GFX-08** Sambungan aspal: lajur timur x 50,14–51,6, lorong y 15,45–16,25, lengkung S ke x 36, dan jalan samping x 51,2–57,8, y 4,5–5,3 (diterima); aspal, panah per lajur, dan gapura di bagian geometri sendiri: tidak ada sebelum lantai parkir dibeli, tetap ada di Lantai 1; di cadangan Antarpulau hanya aspal rata; jalan dalam, kurva `KELUAR`, dan bukaan median tidak berubah; lampu taman di (51,49, 9,6). Ada gambar kamera digeser ke timur.
- **AC-GFX-09** Mobil tanah baris 2 di x 30,5–37,75 (7 mobil) tersembunyi selama `lantai.parkir ≥ 1` lewat pemilihan unit, +0 draw call; tanpa gedung parkir semua mobil tanah sama dengan 0.5.0 (warna dan letak); baris 1 dan baris 2 di x > 37,75 tidak berubah.
- **AC-GFX-10** Mobil bergerak (bagian 8.7), tanpa state tersimpan, aksi, angka ekonomi, atau suara baru:
  - muncul bila `lantaiAdegan(...).parkir ≥ 1` dan ada lahan parkir (ronde perbaikan: total `bangunan.lahanParkir > 0`, bagian 11); lantai 3 membuka ramp 2; langsung tersebar saat dibeli dan dimuat;
  - paling banyak 3 / 4 mobil; ambang 0; 0,4; 0,65; 0,85; ikut atau berhenti hanya di titik muncul;
  - jalur lajur kiri; tidak ada mobil yang muncul atau hilang di bingkai kamera awal;
  - tes murni di `mobil-parkir.ts`: zona ramp tidak pernah berisi dua arah; dengan 4 mobil dan kepadatan 1 semua mobil menyelesaikan putaran dalam 10 menit detik main tanpa macet; jarak antarmobil searah ≥ 0,5;
  - tes sapuan: kotak 0,36 × 0,90 sepanjang jalur tidak memotong tembok, kolom, pagar, papan, gapura, tiang SPBU, atau mobil tanah yang terlihat (toleransi 0,02), berjarak ≥ 0,46 dari kurva `KELUAR`; mobil miring mengikuti ramp dan tidak menembus permukaannya;
  - mode lantai: Lantai 1 tanpa mobil bergerak, Lantai 2 hanya bertujuan dek 2, Lantai 3 semua;
  - malam tanpa lampu; 1×/2×/3× konsisten; tanpa saklar per tingkat;
  - orang dari parkir muncul di x 31,2–36 selama gedung ada; tes `dunia-visual` lulus tanpa diubah;
  - ukuran kerja S dipastikan Panji di awal; beban +0 draw call, segitiga per mobil dengan bayangan dilaporkan, total di batas AC-GFX-03, dan bila lewat ikuti urutan penurunan bagian 8.7;
  - gambar berurutan dari kamera dekat (kaki ramp, ramp, dek) dan satu gambar kamera awal di 412 dan 900×420.
- **AC-GFX-11** `papan-mudik` memakai warna baru dari Citra di `src/config/hiasan-musim.ts`: latar `#ffffff`, tulisan `#14532d` (dokumen 17 bagian 4.2), dengan gambar siang dan malam. Id tema tidak berubah.

**Platform** (saat rilis 0.6.0, hanya bila owner meminta)

- **AC-PLT-01** `versiMinimal` 0.6.0, catatan rilis satu baris (bagian 7), rencana rollback menyebut kehilangan unit lantai.
- **AC-PLT-02** Daftar dimensi GA4 untuk owner; `privasi.html` diperiksa; tanpa perubahan server atau migrasi D1.
- **AC-PLT-03** Ingatkan `npm run cap:sync` sebelum APK berikutnya.

## 13. Bukti simulasi (ringkas)

**Harness** (`sim/`): `tycoon-sim-lantai.ts` (salinan `tests/tycoon-sim.ts` dengan lantai; tanpa lantai hasilnya identik dengan tes asli), `varian.ts` (varian; yang dipakai `G`, tahap berikut `GP`), `lantai.ts` (runner: bagian T patokan tes, A serakah 40 jam, H serakah + hadiah 24 jam, K kasual K3/K2 28 hari), `probe-slot.ts`, `tutup-lantai.ts`, `jalankan-urut.mjs` (varian satu per satu, cek RAM). Keluaran lengkap di `sim/keluaran/` (19 varian, dijalankan ulang satu per satu 5 November 2026 malam; semua patokan bagian T lulus di semua varian).

```
cd D:\projects\game_dev\projects\bustation
npx rolldown D:\projects\game_dev\docs\design\20261105-tambah-lantai\sim\lantai.ts --platform node --format esm --file <scratch>\lantai.mjs
$env:BUNDEL='<scratch>\lantai.mjs'; node D:\projects\game_dev\docs\design\20261105-tambah-lantai\sim\jalankan-urut.mjs V0 G GP
```

**Kesetaraan** (`V0`, tanpa lantai, sama dengan `tests/tycoon-tempo.test.ts`, `tests/tycoon-kasual.test.ts`, dan dokumen 13 bagian 14): PO kedua menit 0, Perluasan 1 menit 3, Jalur 2 menit 27, Lv 6 32 menit, Lv 10 97 menit; Tipe A 5,08 jam, Terpadu 10,91 jam, Perluasan 5 selesai 11,40 jam; bentang buntu 41 menit (Lv 7); K3 Terpadu hari 2, XP offline 94,0 %; K2 Terpadu hari 3.

| Ukuran | Tanpa lantai | **G (0.6.0)** | GP (tahap berikut) | Harga ×0,5 / ×2 |
|---|---|---|---|---|
| Patokan tes tempo (17,5 jam) | lulus | **lulus semua, tanpa diubah** | lulus | lulus / lulus |
| Tipe A (Lv 20) | 5,08 jam | **5,06** | 5,06 | 5,06 / 5,08 |
| Terpadu (Lv 30), batas 10–17,5 | 10,91 jam | **10,89** | 10,89 | 10,88 / 11,07 |
| Perluasan 5 selesai | 11,40 jam | 11,65 | 11,65 | |
| Bentang buntu terpanjang sebelum Terpadu (gerbang ≤ 45) | 41 mnt (Lv 7) | **41 (Lv 7)** | 41 | 41 / 41 |
| Serakah + hadiah: bentang buntu terpanjang | 49 mnt (Lv 17) | 49 (Lv 17) | 49 | 49 / 41 |
| Jeda beli terlama Lv 21–27, tanpa / dengan hadiah | 114 / 54 mnt | **57 / 65** | 57 / 65 | 76 / 99 (tanpa hadiah) |
| Level berisi pembelian Lv 20–30 / 40–50 | 5/10 · 0/10 | 6/10 · 1/10 | 6/10 · 4/10 | |
| Menit buntu sesudah Terpadu sampai 40 jam | 1.401 | 1.258 | **451** | 1.284 / 1.126 |
| Kepuasan median 20–40 jam | 66–68 % | **78–80 %** | 83–86 % | |
| Laba/hari hari ke-40 / ke-100 | Rp 663 jt / 1,04 M | 664 jt / 1,07 M | 664 jt / 1,09 M | |
| Kas menipis (serakah) / sesi kasual dengan kas menipis | 0 mnt / 0 | **0 / 0** | 0 / 0 | 0 / 0 |
| Petugas berhenti karena kas habis | 0 | 0 | 0 | 0 |
| K3 (14 hari): keputusan terakhir, batas ≥ 10 | hari 12 | **hari 11** | 13 | 11 / 11 |
| K3: sesi berkeputusan hari 4–7, batas ≥ 20 % | 25 % | **33 %** | 42 % | 33 / 42 % |
| K2: sesi berkeputusan hari 4–7, batas ≥ 50 % | 75 % | 75 % | 75 % | 88 / 75 % |
| K3 / K2 (28 hari): keputusan terakhir | hari 19 / 25 | 18 / 24 | 20 / 28 | 18 / 24 |
| Lantai dibeli kasual K3 / K2 | – | semua 5 di hari 2–4 / 2–5 | semua 8 di hari 2–5 / 2–8 | |

- **Dampak tempo:** tidak ada yang perlu APPROVE patokan. Tipe A dan Terpadu −0,02 jam, di dalam derau. Kasual tetap Terpadu di hari 2 (K3) dan 3 (K2), XP offline 94,1–96,5 %.
- **Satu margin menipis:** "keputusan terakhir K3 ≥ hari 10" turun 12 → 11. Sebabnya lantai menaikkan arus jam sepi sedikit, sehingga slot PO Lv 90 terbuka sehari lebih awal; pendaftaran PO itulah keputusan terakhir pemain kasual (`LOGK=1`). Bila tugas lain menggesernya lagi, laporkan; jangan ubah patokan diam-diam.

**Pengikut baris tujuan pada kode yang dibangun** (AC-GP-06, 6 November 2026, rancangan bagian 5.6; `sim/pengikut-inti.ts`, badan pemain `pt-izin-hadiah.ts`, 3×, reaksi 20 detik, klaim target 1×, Bus Emas tiap ke-3; keluaran `sim/keluaran/pengikut-*.txt`, `pih-0.5.0-300-3x.txt`, `pt30-*.txt`):

| Ukuran | 0.5.0 | 0.6.0 |
|---|---|---|
| Kas menipis / petugas berhenti | 0 / 0 | **0 / 0** (30 jam main sampai Lv 48; `playtest-30` P20 dan P45 juga 0 / 0) |
| Jeda terpanjang Lv 10–30 / Lv 21–27 (menit main) | 70 / 52 | **70 / 52** |
| Tujuan lantai yang diperiksa terhadap aturan aman | – | 101, **0 pelanggaran**; kas menipis 24 jam main sesudah beli 0; laba offline 8 jam tetap positif |
| Lantai dibeli pengikut (level terbuka → dibeli) | – | Ruang tunggu 2 Lv 21 → **24**; Aula 2 Lv 33 → 40; Gedung parkir 2–3 dan Sayap barat 2 tidak disarankan |
| Kepuasan median Lv ≥ 21 | – | 67 % (pemain serakah 78–80 %) |

- **Ruang tunggu 2 di Lv 24** (3 level sesudah terbuka) diterima. Lantai itu layak di Lv 23, saat kursi penuh dan kepuasan < 75 %, lalu aman di Lv 24 sesudah kas pulih dari Jalur 6. Ia dibeli 1 menit main sesudah tampil. Sasaran lama "≤ 2 level" diganti: **paling lambat 1 level sesudah layak, dan tidak lebih lambat dari pemain serakah tanpa hadiah (Lv 24)**.
- **Gedung parkir dan Sayap barat tidak pernah disarankan** (bagian 6). Varian yang mengisi slot lahan parkir dan toilet dulu (`sim/pengikut-varian.ts`, `VARIAN=PT`) membuat kelima lantai dibeli (Gedung parkir 2 Lv 24, 3 Lv 38, Sayap barat 2 Lv 41). Keselamatannya tetap 0, tetapi kepuasan median hanya +2 poin, dan Ruang tunggu 2 mundur ke Lv 26. Kekurangan fasilitas pengikut terutama toko, sisa lama "baris tujuan tidak pernah menyarankan toko". Usulannya menjadi satu tugas "baris tujuan fasilitas" (bagian 15).

**Varian yang ditolak** (rinciannya di rancangan bagian 3 dan 5.4):

| Varian | Hasil | Kenapa ditolak |
|---|---|---|
| Opsi A, pengali | Perluasan 5 mundur 11,40 → 15,23 jam; keputusan kasual berakhir hari 16 | Abstrak, mengulang modernisasi |
| Opsi C, proyek 6 menit | Sama dengan B (Terpadu 10,94, buntu sesudah Terpadu 247) | Kerja lebih banyak tanpa manfaat tambahan |
| Aula = kantor PO (`B2`) | K3 keputusan terakhir hari 19 → 11, K2 25 → 15 | Slot PO maju menghabiskan katalog PO; menyentuh keputusan owner soal slot PO |
| Aula = +8 slot jendela (`F`) | Tidak dibeli dalam 40 jam; dengan hadiah efek arus 0 | Slot jendela sudah longgar karena izin level |
| Dek bus pangkalan | Perluasan 4 mundur 6,17 → 7,60 jam | Menggantikan Perluasan 4 dan menutup pangkalan 100 % |
| Semua lantai ke-2 dibuka Lv 12–20 (`B_AW`) | Perluasan 5 selesai 15,23 jam | Kas tersedot ke lantai yang isinya belum berguna |
| Ruang tunggu 3 tanpa peron (`B_TP`) | Tidak dibeli dalam 40 jam | Tanpa jalur 10–11 kursi sudah 100 % di 14 blok |
| Sayap 2 Lantai 3 (+2 kursi & 2 toko) | Dibeli bila ia satu-satunya lantai kursi & toko (`F`, `F2`, `F05`, `B_TP`, Lv 37–40); tidak dibeli bila aula sudah berisi kursi & toko (`B2K`) | Isinya sama dengan mezanin aula, dan hanya satu lantai kursi & toko yang bernilai; mezanin aula menutup 0 %, lantai 3 Sayap 2 Lantai menutup isi lantai 2 |
| Tanpa rekrut petugas otomatis (`GR`) | Lantai Sayap barat: kepuasan 89 → 86 %, arus −8 | Membeli lantai lalu memperburuk keadaan adalah jebakan |

## 14. Belum terukur dan yang diuji

**Belum terukur saat disetujui (NOT ASSESSED):**

| Hal | Keadaan | Yang mengujinya |
|---|---|---|
| **Mobil bergerak** | Saat disetujui belum diukur. **Terukur di fase bangun** (Panji, 6 November 2026): tampilan biasa +1 / +3,0…3,3 rb segitiga dengan 4 mobil; mode lantai +1 (derau ±1) / ≤ +5,3 rb; tahap 2 +0 (bagian 8.7). Ukuran kerja M, bukan S (keputusan Sapto) | QA grafis (AC-GFX-03, AC-GFX-10) |
| **Kaca malam khusus** jendela lantai | Saat disetujui perkiraan +1 draw call. **Terukur di tonggak 1: tepat +1**, diterima Sapto | QA grafis (AC-GFX-02) |
| **fps** | Tidak bisa dinilai di mesin tim (`docs/projects/bustation.md`) | Owner di HP saat uji rilis |

Pengikut baris tujuan di GameState asli: **dinilai di fase 2** (6 November 2026, bagian 13 dan rancangan 5.6). Kas menipis 0, petugas berhenti 0, jeda sama dengan 0.5.0, 0 pelanggaran aturan aman; sasaran Ruang tunggu dibetulkan menjadi "paling lambat 1 level sesudah layak, tidak lebih lambat dari Lv 24" (terukur Lv 24).

Juga belum dinilai: syarat kepuasan PO premium dan perpanjangan kontrak; pemain yang memakai "Saran" tarif sewa kios; hujan pada gedung parkir A; papan jadwal aula pada letak akhir; gambar landscape 667 px.

**Risiko dan uji playtest:**

| Risiko | Mitigasi / uji |
|---|---|
| "Lantainya kecil": Rupiah hampir tidak bergerak | Pratinjau dalam persen kepuasan dan Rupiah parkir; toast menyebut isinya. Playtest: "apa yang berubah sesudah membeli lantai?" |
| Cangkang abu-abu terasa murah | Jendela menyala di malam hari, mode lantai, gambar purwarupa `grafis/03`, `05` |
| Mezanin aula di belakang dinding terbaca sebagai gedung lain atau atap | Kembang api dan toast saat dibeli, "👁 Lihat", jendela menyala. Papan "LANTAI 2" tidak dipakai (huruf 2–3 px). Playtest: "tunjukkan lantai yang baru kamu beli" |
| Aula 2 dan Sayap barat 2 kurang terbedakan dari lantai 1 di mode lantai landscape (laporan Panji, 6 November 2026), karena mezanin di belakang dinding utara | Usulan Panji: azimut kamera khusus aula di mode lantai. Playtest fase 4 |
| Isi lantai yang baru dibeli tidak tampak di mode lantai: pengikut membeli lantai dengan kios 1/3, toko 0/4, dan toilet 1/2, sehingga dengan penomoran slot isinya muncul di lantai dasar | Ditutup oleh aturan isi lantai (bagian 11): lantai diisi lebih dulu. Playtest: "tunjukkan lantai yang baru kamu beli" |
| Ramp curam (21–24 %) dan samar dari kamera awal | Detail dari kamera dekat dan mode lantai; tidak ada informasi permainan yang bergantung pada ramp. Playtest: "apa yang berubah di gedung parkir?" |
| Mobil bergerak terbaca sebagai titik kabur, dan memutar di dek tanpa masuk petak | Owner melihatnya di HP. Bila memutar terasa aneh: tugas lanjutan 1–2 petak kosong per dek, mobil masuk, diam, mundur keluar (±S) |
| Pengikut baris tujuan tidak membeli lantai, atau membelinya saat kas tipis | Diuji (bagian 13): tidak pernah saat kas tipis. Gedung parkir dan Sayap barat tidak disarankan, diterima untuk 0.6.0; usulan tugas "baris tujuan fasilitas" (bagian 15) |
| Rollback menghapus unit lantai | `versiMinimal` 0.6.0; rollback hanya segera sesudah deploy |
| Margin tes kasual K3 menipis 12 → 11 | Diketahui sebabnya (bagian 13) |

## 15. Tahap berikut (bukan 0.6.0)

- **Bentuk Gedung Antarpulau dan Perluasan 4–5**, bersama lantai peron (jalur 10–11, Lv 33 dan 50, Rp 8 M dan Rp 15 M di varian `GP`), Ruang tunggu lantai 3 (Lv 42, Rp 3,5 M di `GP`), Sayap 2 Lantai lantai 3, dan dek bus. Di simulasi inilah yang membuka permainan akhir (buntu sesudah Terpadu 1.258 → 451 menit). Kolom Antarpulau menghindari lorong parkir dan lengkung S (bagian 8.1).
- **Apakah lantai suatu saat memberi pendapatan sendiri** (sewa kantor) tanpa memakan slot PO.
- **Baris tujuan fasilitas** (usulan tugas sendiri, rancangan 5.6). Isinya: di cabang fasilitas `perbaikanKepuasan`, isi slot kosong lahan parkir dan toilet sebelum menyarankan lantai (`bangun(id) ?? lantai(id)`); tambahkan kios dan toko; teks baru untuk unit kedua dan seterusnya ("🙂 Lahan parkir kendaraan kurang: bangun · Rp 6 jt", bukan "Belum ada …"); kunci tujuan memuat nomor unit. Dari harness: dengan aturan itu kelima lantai disarankan dan dibeli pengikut, keselamatannya tetap 0, tetapi Ruang tunggu 2 mundur ke Lv 26. Ini menggabungkan sisa lama "baris tujuan tidak pernah menyarankan toko". Kepuasan pengikut sesudah Lv 21 tetap 60–70 % selama kios dan toko tidak disarankan.
- **Sisa 0.6.0, prioritas rendah:** popup offline menyebut lantai yang terbuka selama pemain pergi ("🏢 Lantai 2 Ruang tunggu bisa dibangun"), dengan `lantaiTerbukaAntara` seperti toast naik level (rancangan 4.6, pola P-7). Ditunda oleh Sapto 6 November 2026.
- **Rencana dokumen 16 tahap 5, "Gedung parkir mobil x 51…57,7, y 6…14,8",** digantikan Gedung parkir A di x 30,8–35,96 (dokumen 16 bagian 3.1 diberi catatan, bersama batasan kolom Antarpulau).
