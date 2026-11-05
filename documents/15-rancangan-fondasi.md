# 15 · Rancangan Fondasi: patokan kasual, izin level, hadiah armada, tantangan yang adil

> **Status: dirilis di 0.4.0 (3 November 2026, 8d9520b, `versiMinimal` 0.4.0).** Dibangun 31 Oktober–1 November 2026 (7cd2c0a, 956f9aa), bersama dokumen 14. Disetujui owner 31 Oktober 2026 (Telegram, "APPROVE semua"). Dibangun dalam tiga ronde: ronde 1 = saran 3, saran 6, perbaikan U-2; ronde 2 = saran 4, saran 5, patokan tempo baru; ronde perbaikan teks dari playtest ronde 2 (bagian 3.5 dan 4.4). Jawaban owner atas pertanyaan a–c, keputusan Sapto atas CHANGE REQUEST, dan hasil playtest ada di bagian 10. Brief `docs/tasks/20261031-fondasi-saran-3-6.md` (repo tim). Dasar: evaluasi keseruan 0.3.1 saran 3–6 dan tahap 0 peta jalan ADR 004. Catatan kerja, semua tabel bukti, dan harness simulasi ada di `docs/design/20261031-fondasi-saran-3-6.md` dan folder `sim/`-nya. Laporan playtest: `docs/design/20261031-fondasi-saran-3-6-playtest.md`. Keduanya di repo tim, tidak ikut repo game.
>
> **Yang berubah:** angka ekonomi (slot jendela, jalur, petak bus, slot PO), tempo pemain aktif (Tipe A dan Terpadu lebih cepat), isi hadiah target, tantangan, dan iklan berhadiah, serta cara menghitung tantangan laba, target harian laba, dan tantangan kepuasan. **Save:** satu field opsional baru (`TantanganAktif.ambang`), skema tetap 3. **Analitik:** tanpa peristiwa baru. **Adegan 3D:** tidak ada model baru. Aturan offline (Manajer, 8 jam, 60 %) tidak berubah.
>
> Dokumen 13 sudah diperbarui (31 Oktober 2026) di bagian 2, 4.1, 6.5, 8, 10, 11, 14, 15, dan 16 (daftar di bagian 9). Penanda "ronde 1" dan "ronde 2" di sana sudah dihapus, karena semuanya kini ada di kode.

## Ringkasan

1. **Saran 3, patokan kasual.** Tes baru `tests/tycoon-kasual.test.ts`: pemain 3 sesi dan 2 sesi sehari dengan Manajer Operasional, 14 hari nyata. Tes ini mengukur hari nyata ke Tipe B, Tipe A, dan Terpadu, porsi XP dari offline, sesi yang berisi keputusan, dan petugas berhenti.
2. **Saran 4, "izin level".** Sejak Perluasan 3, tiap naik level di Tipe B dan Tipe A membuka satu slot jendela loket. Di Terpadu, slot jendela bertambah tiap 2 level. Slot jalur ke-6 dan ke-8 datang di Lv 16 dan Lv 26, lebih awal dari perluasan. Petak bus tahap 3 naik 20 → 30. Slot PO ke-7, 8, dan 9 dimajukan ke Lv 17, 19, dan 27.
   - Bentang terpanjang tanpa aksi bernilai sebelum Terpadu turun **257 → 41 menit**.
   - Slot PO 9–20 akhirnya terpakai: pemain kasual punya 15/15 PO di hari ke-14 (sekarang 7/14).
3. **Saran 5, hadiah non-uang.** Ada dua jenis hadiah baru:
   - **armada PO**: XP untuk PO berlevel terendah. Level PO membuka kelas bus dan jurusan baru;
   - **percepat proyek**: −6 menit proyek perluasan yang sedang berjalan.
   Keduanya bisa didapat dari target harian dan tantangan, dan juga dari iklan (Bus Emas, klaim 2×, tombol percepat). Iklan tetap pilihan.
4. **Saran 6, tantangan.** Tiga perubahan:
   - laba mingguan dan target harian laba menghitung kontrak PO **dirata-rata**, bukan sekaligus;
   - target harian laba ikut tumbuh, tidak lagi selalu Rp 2,4 jt;
   - tantangan kepuasan memakai ambang dari kepuasan awal minggu, dan barisnya membuka popup kepuasan.
5. **Satu perbaikan wajib (U-2):** kunci histeresis baris tujuan memuat unit yang disarankan. Tanpa perbaikan ini, saran berbiaya berikutnya lolos tanpa cadangan kas, dan izin level memperlihatkannya.
6. **Dampak tempo aktif** (pemain serakah): Tipe A 6,3 → 5,1 jam, Terpadu 13,1 → 10,9 jam. Ini di bawah patokan Terpadu lama (12–17,5 jam); owner menyetujui patokan baru (bagian 10). Di kode: Tipe A 5,08 jam, Terpadu 10,91 jam. Tempo kasual tidak berubah, karena offline yang menentukan.

## 1. Masalah, tujuan, cara mengukur

**Masalah (bukti di catatan kerja):**

| # | Masalah | Angka sekarang |
|---|---|---|
| 1 | Dinding mid-game | 257 menit main aktif tanpa satu pun aksi yang menambah laba atau penumpang (Lv 11 → 20); 3 bentang > 45 menit sebelum Terpadu |
| 2 | Pemain kasual kehabisan keputusan | Dengan Manajer, 3 sesi/hari: tidak ada keputusan sejak hari nyata ke-4. Slot PO 9–20 tidak pernah terpakai (7/14 di hari 14) |
| 3 | Hadiah tidak terasa | 2 menit laba = 0,5–1,6 % kas setelah Tipe B. Semua hadiah iklan berupa uang |
| 4 | Tantangan laba minggu pertama | Selesai di menit main ke-1–2 (8/8 run), karena kontrak PO kedua masuk sekaligus |
| 5 | Target harian laba | Selalu Rp 2,4 jt di level berapa pun; tercapai hanya di hari ada kontrak (9/13, 11/17, 26/39 hari) |
| 6 | Tantangan kepuasan ≥ 75 % | Tercapai di 3/8 minggu pertama dan 0/8 minggu kedua (pengikut tujuan); pemain serakah pun 66–71 % sesudah Terpadu |

**Untuk siapa:** pemain aktif di mid-game (2–13 jam main), pemain kasual di hari nyata 2–14, dan semua pemain tiap minggu.

**Tanda berhasil:**

- Harness (gerbang tahap 0 ADR 004): pemain serakah tidak punya bentang buntu > 45 menit sebelum Terpadu.
- Tes kasual: sesi yang berisi keputusan di hari 4–7 naik dari 0 % ke ≥ 20 % (3 sesi/hari).
- GA4 (peristiwa yang sudah ada):
  - `iklan_hadiah` per sesi pada sesi dengan `ringkasan_sesi.level_terminal` ≥ 10 tidak lebih rendah dari sesi < 10;
  - `klaim_tantangan` per jenis: kepuasan dan laba diklaim sesering penumpang;
  - `daftar_po` dengan jumlah PO ≥ 9 muncul sama sekali (sekarang praktis tidak mungkin).

## 2. Saran 3: patokan tempo pemain kasual

### 2.1 Bentuk tes

`tests/tycoon-kasual.test.ts`, di atas pemain serakah `tests/tycoon-sim.ts`. Fungsi baru di sana:

- `jalankanKasual(jadwal, hari, cfg)`;
- konstanta `JADWAL_KASUAL`.

Isinya pindahan bagian B harness `docs/design/20261031-fondasi-saran-3-6/sim/fondasi.ts`:

- **Sesi**: pemain serakah bermain di jam dinding yang ditentukan, langkah 10 detik main, keputusan tiap jam terminal (sama dengan tes tempo).
- **Offline di antara sesi**: rumus `jalankanOffline` (`src/sim/state.ts`) di atas `SimTycoon`:
  - pendapatan dan kontrak dirata-rata profil hari × 60 %, dikurangi biaya penuh;
  - XP terminal dan XP PO × 60 %;
  - paling lama 8 jam; kontrak tidak berkurang; proyek perluasan tetap berjalan;
  - hanya bila ada Manajer Operasional.
- **Manajer Operasional** direkrut di akhir sesi bila aturan baris tujuan terpenuhi (dokumen 14 bagian 3.1): laba rata-rata sesudahnya ≥ 0 **dan** laba offline sehari terminal sesudahnya ≥ 0.
- **Waktu jalan**: 1–3 detik per jadwal 14 hari.

| Profil | Sesi per hari (jam dinding, menit main) | Manajer |
|---|---|---|
| K3 | 07.30 · 15, 12.30 · 10, 21.00 · 20 | ya |
| K2 | 08.00 · 10, 20.00 · 10 | ya |

**Diukur:**

- hari dan sesi ke-berapa Tipe B, Tipe A, Terpadu tercapai, dan kapan Perluasan 5 selesai;
- porsi XP terminal dari offline;
- **sesi berisi keputusan** (≥ 1 aksi berbayar atau PO baru) di hari 1–3, 4–7, 8–14;
- hari terakhir yang berisi keputusan;
- petugas yang berhenti karena kas habis.

### 2.2 Nilai sebelum dan sesudah saran 4

| Ukuran | K3 sekarang | K3 sesudah saran 4 | K2 sekarang | K2 sesudah saran 4 |
|---|---|---|---|---|
| Tipe B / Tipe A / Terpadu | hari 1 / 2 / 2 | hari 1 / 2 / 2 | hari 1 / 2 / 3 | hari 1 / 2 / 3 |
| Perluasan 5 selesai | hari 3 | hari 3 | hari 4 | hari 5 |
| XP dari offline | 94 % | 94 % | 96 % | 96 % |
| Sesi berisi keputusan hari 4–7 | 0 % | 25 % | 25 % | 75 % |
| Sesi berisi keputusan hari 8–14 | 0 % | 10 % | 0 % | 14 % |
| Hari terakhir dengan keputusan | 3 | 12 | 4 | 12 |
| Petugas berhenti | 0 | 0 | 0 | 0 |

### 2.3 Batas tes (disetujui owner 31 Oktober 2026)

Batas ini penjaga, bukan sasaran. Gunanya supaya perubahan angka yang menggeser hari nyata pemain kasual terlihat di CI. Sasaran jangka panjang (keputusan di hari 8–30) adalah tugas tahap 1 Musim Terminal. Sejak ronde 2, `tests/tycoon-kasual.test.ts` memakai kolom ronde 2.

| Assert | Ronde 1 (tanpa saran 4) | Ronde 2 (dengan saran 4) |
|---|---|---|
| K3: Terpadu paling cepat hari 2, paling lambat hari 4 | ya | ya |
| K2: Terpadu paling cepat hari 3, paling lambat hari 5 | ya | ya |
| K3: porsi XP offline 85–98 % (berubah = aturan offline tersentuh) | ya | ya |
| K3: hari terakhir dengan keputusan ≥ | 3 | 10 |
| K3: sesi berisi keputusan hari 4–7 ≥ | 0 % | 20 % |
| K2: sesi berisi keputusan hari 4–7 ≥ | 20 % | 50 % |
| Petugas berhenti = 0 (K3, K2) | ya | ya |

## 3. Saran 4: izin level

### 3.1 Aturan

Sejak **Perluasan 3** (lantai 2 aula loket) terminal mendapat **izin** tambahan saat naik level. Izin hanya menambah **slot**; unitnya tetap dibeli seperti biasa, atau dibangun PO yang bergabung. Tidak ada proyek dan tidak ada field save baru: semuanya diturunkan dari level (XP) dan tahap perluasan.

| Izin | Level | Dengan perluasan |
|---|---|---|
| Slot jendela loket +1 | tiap level Lv 11–30, lalu tiap level genap Lv 32–140 | Perluasan tetap menambah jendela seperti sekarang (+4 di tahap 3, 4, 5) |
| Slot jalur +1 | Lv 16 dan Lv 26 | Slot tahap jalur `[5,5,5,5,6,7]` (sekarang `[5,5,5,5,7,9]`), jadi totalnya tetap 7 di Perluasan 4 dan 9 di Perluasan 5. Jalur 6 dan 8 kini bisa dibeli lebih awal |
| Petak bus | Perluasan 3: 20 → **30** | |
| Slot PO | 7 di **Lv 17** (Lv 20), 8 di **Lv 19** (Lv 25), 9 di **Lv 27** (Lv 30); sisanya sama, tetap 20 di Lv 140 | Keputusan 14 dokumen 13 tetap: slot PO tumbuh dengan level |

- Izin jendela dan jalur yang levelnya sudah lewat sebelum Perluasan 3 selesai menjadi aktif sekaligus saat Perluasan 3 diresmikan.
- **Tanpa model 3D baru.** Sejak tahap 2 adegan memang hanya menggambar 8 jendela, 5 halte/gerbang, dan 4 kelompok parkir. Slot di atasnya sudah tak terlihat sejak 0.3.0 (tahap 3–5 belum digambar). Bila nanti lantai 2 digambar (saran 8, tahap 2 ADR 004), jendela izin cocok ditaruh di sana.

### 3.2 Angka (kunci config)

| Kunci | Sekarang | Usulan |
|---|---|---|
| `EKONOMI.tycoon.izinLevel` (baru) | – | `{ tahapMinimal: 3, jendela: [11…30, 32, 34, …, 140], jalur: [16, 26] }` |
| `EKONOMI.tycoon.bangunan.jalur.slot` | `[5, 5, 5, 5, 7, 9]` | `[5, 5, 5, 5, 6, 7]` |
| `EKONOMI.tycoon.petakBus` | `[10, 10, 20, 20, 40, 60]` | `[10, 10, 20, 30, 40, 60]` |
| `EKONOMI.mitra.terminal.slot` | `…[14,6],[20,7],[25,8],[30,9],[40,10]…` | `…[14,6],[17,7],[19,8],[27,9],[40,10]…` |
| `EKONOMI.tycoon.bangunan.jendela.slot`, `EKONOMI.mitra.perluasan` | | tidak berubah |

### 3.3 Kenapa paket ini (bukti singkat)

Varian lengkap ada di catatan kerja bagian 2. Membuka slot jendela saja (+1 tiap 2 level) hanya memindahkan dinding:

- pertama ke pangkalan (petak 20 di tahap 3);
- lalu ke pasar (tidak ada PO baru di Lv 14–20);
- lalu ke peron (jalur 7 sampai Perluasan 5).

Hasilnya masih 126 menit buntu (Lv 16). Tiap bagian paket dibutuhkan: tanpa bonus jalur 81 menit, tanpa petak 30 71 menit, dengan slot PO 7/8 di Lv 16/18 49 menit. Memperlambat kurva XP untuk mempertahankan Terpadu ±13 jam ditolak, dengan dua alasan:

- bentangnya justru makin panjang (84–87 menit);
- **level dan kelas save yang sudah ada akan turun**, karena level diturunkan dari XP.

### 3.4 Perbaikan U-2: kunci histeresis baris tujuan (wajib bersama saran 4)

**Bug di dokumen 14 bagian 3.3, sudah ada di kode sekarang.**

- Tujuan berbiaya yang "sudah tampil" tetap berlaku selama kas ≥ biayanya, tanpa cadangan.
- Kuncinya `area:peron:jalur`, sama untuk Jalur 3, 4, dan 5. Akibatnya Jalur 4 dan 5 ikut lolos tanpa cadangan setelah saran Jalur 3 tampil.
- Dengan izin level, pengikut tujuan di simulasi membeli Jalur 3, 4, dan 5 berturut-turut. Pembelian terakhir Rp 800 jt menyisakan kas Rp 2,2 jt, lalu "kas menipis" memberhentikan 17 petugas, termasuk Manajer.

**Perbaikan:** kunci tujuan `area` memuat unitnya (`area:peron:jalur:5`, `area:loket:jendela:{biaya}`, `area:{area}:teknologi:{id}`, `area:{area}:rekrut:{peran}`). Tujuan `kepuasan` berupa bangunan memuat biayanya. Unit berikutnya menjadi tujuan baru yang dinilai dengan cadangan B.

**Hasil:**

- kas menipis 0 dan petugas berhenti 0 di semua run, termasuk izin level;
- kode sekarang + U-2 identik dengan tanpa U-2 di playtest-30.

### 3.5 Tampilan dan teks

| Tempat | Teks |
|---|---|
| Toast naik level (menggantikan `🏢 Terminal naik ke Lv {L}` bila ada izin) | `🏢 Terminal naik ke Lv {L}: {izin}` · `{izin}` ∈ `slot jendela loket +1`, `slot jalur +1`, digabung " & " bila dua · contoh `🏢 Terminal naik ke Lv 16: slot jendela loket +1 & slot jalur +1`. Bila level itu juga membuka slot PO, yang tampil toast slot PO |
| Toast slot PO (dokumen 14 bagian 3.7), ada jendela untuk PO baru | `🅿️ Slot PO ke-{n} terbuka! Daftarkan PO di tab PO` (tetap) |
| Toast slot PO, slot jendela penuh | `🅿️ Slot PO ke-{n} terbuka: jendela loket penuh sampai Lv {L}` bila slot jendela berikutnya datang dari izin level, `… sampai Perluasan {N}` bila dari perluasan, `🅿️ Slot PO ke-{n} terbuka: jendela loket penuh` bila tidak ada slot berikutnya. Menggantikan `… PO baru butuh jendela dari perluasan` (playtest P-4) |
| Tab PO, status PO tersedia, slot jendela penuh | `Jendela penuh · +1 di Lv {L}` · `Jendela penuh · Perluasan {N}` · `Jendela penuh` bila tidak ada slot berikutnya. Menggantikan `Slot jendela loket penuh: bangun perluasan terminal` (P-4). Paling banyak 28 karakter, jadi tidak terpotong di landscape |
| Baris tujuan tingkat 5 (`naikLevel`): izin terdekat bila lebih dekat dari perluasan berikut | `⬆️ Lv {L}: {izin} · kini Lv {K}` · contoh `⬆️ Lv 17: slot jendela loket +1 & slot PO ke-7 · kini Lv 16` (≤ 60 karakter) |
| Tab Bangun, slot penuh, izin lebih dulu dari perluasan | `Slot penuh: +1 di Lv {L}` |
| Tab Bangun, Perluasan 3 belum ada, Lv ≥ 11 | `Slot penuh: bertambah di Perluasan 3` (teks yang ada) |
| Kartu level, tab Terminal (baris baru) | `Izin berikutnya: Lv {L} {izin} · Lv {L2} {izin2}` |
| Popup offline bila naik level selama pergi | `🎫 Izin baru: jendela +{j}, jalur +{n}, slot PO ke-{p}` (yang ada saja) |

Izin yang terbuka langsung masuk baris tujuan lewat aturan yang ada: area paling lambat untuk jendela dan jalur (tingkat 3), daftarkan PO untuk slot PO (tingkat 2).

Status tab PO dan toast slot PO memakai sumber yang sama dengan tab Bangun: slot jendela berikutnya (`slotBerikut` jendela di model tab Bangun). Sejak Perluasan 3, slot jendela berikutnya hampir selalu datang dari naik level, jadi teks lama "bangun perluasan terminal" menyuruh pemain menabung untuk Perluasan 4 (Lv 20, Rp 800 jt) padahal satu level lagi sudah cukup.

### 3.6 Keadaan khusus

| Keadaan | Perilaku |
|---|---|
| Save lama | Tidak ada unit yang hilang. Slot baru ≥ slot lama di tiap level dan tahap (jalur di Perluasan 4 = 6 + izin Lv 16 = 7, sama). **Wajib:** perapian bangunan saat memuat (`bacaBangunan` di `save.ts`) memakai slot dengan level dari `perkembangan.xpTerminal`; tanpa itu jendela izin terpotong tiap kali dimuat |
| Offline | Level naik offline membuka izin seperti main aktif. Popup offline menyebutnya (data sesaat, bukan save) |
| Kecepatan 1×/2×/3× | Izin mengikuti level (XP), sama di semua kecepatan |
| Kas 0 | Izin hanya slot. Mengikuti baris tujuan tetap menyisakan cadangan (setelah U-2) |
| Penghargaan "Aula Loket Penuh" | Tetap 20 jendela disewa (`slotMaks` = nilai terakhir tabel tahap). Deskripsinya menjadi "20 jendela loket disewa PO" |

## 4. Saran 5: hadiah yang bermakna saat kas menumpuk

### 4.1 Jenis hadiah

| Jenis | Isi | Kenapa bermakna setelah Tipe B |
|---|---|---|
| `uang` (ada) | N menit laba (`hadiahMenit`) | Hanya di awal; setelah Tipe B 0,5–1,6 % kas (dengan izin level 0,7–3,7 %) |
| `armada` (baru) | XP untuk **PO berlevel terendah** (seri: penumpangnya terbanyak) sebesar `bagian` × kebutuhan level berikutnya PO itu | Satu level PO terendah = 1–5 jam main PO itu di mid–late game, jadi armada 50 % ≈ 0,5–2,6 jam. Level PO membuka Patas (3), Eksekutif (6), Sleeper (10), dan Double Decker (15), serta jurusan ke-2 (6) dan ke-3 (12): bus baru terlihat di adegan, pasar bertambah, kontrak PO naik 8 % per level. Tanpa bantuan, pemain serakah baru punya PO Lv 4–9 di jam ke-24, jadi Sleeper dan Double Decker hampir tidak pernah muncul |
| `percepat` (baru) | `proyekDetik` − 360 (6 menit main) | Proyek perluasan 24 menit adalah tunggu terpanjang di 2 jam pertama |

**Tidak dipakai:** XP terminal. Hadiahnya selalu terasa, tapi menggeser tempo terlalu banyak:

- 5 menit arus per hari terminal: Terpadu 10,9 → 9,3 jam;
- ditambah Bus Emas: 7,6 jam.

**Kosmetik** tetap di tahap 1 (blok save musim dan aset Panji), tidak dirancang di sini.

### 4.2 Hadiah per sumber

| Sumber | Sekarang | Usulan |
|---|---|---|
| Target harian (tiap hari terminal) | 2 menit laba | 2 menit laba + **armada 50 %**, dan **percepat 6 menit** bila ada proyek berjalan |
| Tantangan mingguan (tiap tantangan) | 15 menit laba | 15 menit laba + **armada 100 %** (satu level penuh) |
| Penghargaan, event | 3 / 5–30 menit laba | tidak berubah |
| Bus Emas (iklan) | 10 menit laba | 10 menit laba + **armada 25 %** |
| Klaim 2× target & penghargaan (iklan) | uang 2× | seluruh paket 2× (uang, armada, percepat) |
| **Percepat proyek** (iklan, baru) | – | tombol di kartu perluasan selama proyek berjalan: −6 menit tiap iklan, hanya bila sisa proyek > 12 menit (jadi paling banyak 2× per proyek, tanpa state baru) |
| Boost 2×, Offline 2× | uang | tidak berubah |

**Etika iklan:**

- semua jenis hadiah juga bisa didapat tanpa iklan (armada dan percepat dari target harian, armada dari tantangan);
- iklan tetap pilihan, dengan "Nanti" dan "Lewati (tanpa hadiah)";
- tidak ada kelangkaan palsu: percepat dibatasi oleh sisa proyek, bukan hitung mundur atau stok;
- papan peringkat tidak tersentuh langsung: armada tidak menambah penumpang minggu ini.

Kunci config baru di `EKONOMI.hadiah`: `armadaHarian: 0.5`, `armadaTantangan: 1`, `armadaBusEmas: 0.25`, `percepatDetik: 360`, `percepatSisaMinDetik: 720`.

### 4.3 Dampak ke tempo (pemain serakah yang mengklaim hadiah, dengan izin level)

| Hadiah yang diklaim | Tipe A | Terpadu | Buntu terpanjang |
|---|---|---|---|
| tanpa hadiah | 5,1 jam | 10,9 jam | 41 menit |
| armada harian | 5,1 | 10,7 | 49 (Lv 17) |
| armada harian + Bus Emas, sepertiga ditonton (asumsi) | 5,1 | 10,5 | 49 (Lv 17) |
| uang saja (harian + Bus Emas, sepertiga ditonton) | 5,1 | 10,6 | 49 (Lv 17) |
| armada harian + semua Bus Emas ditonton (batas atas) | 5,0 | 10,1 | 75 (Lv 28) |
| percepat 2× tiap proyek | 4,9 | 10,7 | 48 (Lv 7) |
| proyek selesai seketika: 2 iklan percepat + klaim target 2× (batas atas) | 4,7 | 10,5 | 55 (Lv 6) |

Baris terakhir diukur sesudah dibangun (QA S-1, playtest ronde 2). Dua iklan percepat (1440 → 720 dtk) ditambah klaim target harian 2× (−720 dtk) menyelesaikan proyek seketika. Ini sesuai aturan: iklan paling banyak 2× per proyek, dan percepat dari target adalah hadiah target yang ikut digandakan. **Diterima tanpa perubahan** (Sapto, 31 Oktober 2026):

- batas atasnya tetap di dalam patokan;
- butuh 3 iklan dan target harian yang sudah selesai saat proyek berjalan, sekali per hari terminal, dan hanya ada 5 proyek;
- tidak mengambil apa pun dari pemain tanpa iklan.

Bila owner ingin "paling banyak 12 menit lewat iklan" berlaku mutlak, variannya adalah klaim 2× tidak menggandakan percepat. Itu menyentuh tempo, jadi perlu APPROVE.

Armada dari tantangan mingguan (3 × 100 % per minggu, setara 6 klaim target harian) tidak disimulasikan terpisah, karena pemain serakah tidak mengenal minggu nyata. Armada menggeser tempo kira-kira sama dengan hadiah uang yang sudah ada. Pemain yang mengklaim hadiah bisa mendapat satu bentang 48–49 menit, sedikit di atas gerbang 45 (bagian 10, risiko).

### 4.4 Teks

Teks yang dibangun, termasuk ronde perbaikan teks dari playtest ronde 2 (P-1 sampai P-3) dan dua penyimpangan Raka yang diterima Sapto.

| Tempat | Teks |
|---|---|
| Kartu target harian, hadiah | `Hadiah: +{uang} · 🚌 {po} +½ level` (+ ` · 🏗️ −6 mnt` bila ada proyek) |
| Tombol 2× target (iklan) | label kecil `▶ 2× semua` bila paket berisi armada atau percepat, karena seluruh paket digandakan; angka besar tetap `+{uang × 2}`. Tombol 2× lain (penghargaan) tetap `▶ 2×` |
| Kartu tantangan, hadiah | sekali per kartu: `Hadiah tiap tantangan: +{uang} · 🚌 {po} +1 level`. Tombol Klaim tiap baris menyebut uangnya |
| Catatan kartu tantangan | `Tantangan baru tiap Senin (WIB). Laba dihitung seperti Laba/hari: kontrak PO dirata-rata. 🚌 Armada selalu untuk PO berlevel terendah.` |
| Teks penjelasan tab PO | ditambah kalimat `Hadiah armada (target, tantangan, Bus Emas) menaikkan level PO berlevel terendah.` |
| Popup Bus Emas | `Bus istimewa membawa rombongan. Tonton iklan untuk {uang} dan armada baru {po} (+¼ level).` |
| Toast setelah klaim | `🚌 Armada baru {po}: {a}% → {b}% menuju Lv {L}`. Bila armada menaikkan level PO, yang tampil teks naik level PO yang sudah ada: `⬆️ {po} naik ke Lv {L}` dengan akhiran `: kelas {…} & jurusan {…}` bila ada yang terbuka, mis. `⬆️ PO Peuyeum Kilat naik ke Lv 6: kelas Eksekutif & jurusan YOGYAKARTA` |
| Kartu perluasan saat proyek | tombol `▶ Percepat 6 menit` dengan catatan kecil `iklan · maks. 2× per proyek` |

- `{po}` = nama PO lengkap ("PO Wayang Lestari"). PO sasaran armada ditampilkan **sebelum** diklaim, supaya pemain tahu PO mana yang mendapatnya.
- **Armada ditulis dalam level**, bukan persen: 1 → `+1 level`, 0,5 → `+½ level`, 0,25 → `+¼ level`, nilai lain `+{persen}% level`. Di sebelah uang, "+50%" terbaca sebagai bonus persen sesuatu, dan tantangan di kartu yang sama memakai "+1 level". Toast tetap memakai persen (`0% → 50% menuju Lv 4`), karena itu kemajuan bilah level PO.
- **"2× semua":** dengan label "2×" saja, tombol target tampak sama dengan tombol 2× penghargaan yang memang hanya uang, sehingga pemain menimbang iklan dari uangnya saja. Padahal target harian 2× juga memberi armada satu level penuh dan percepat 12 menit. Label 73 px muat di tombol 96 px.
- **Aturan PO berlevel terendah tertulis** di catatan tantangan dan tab PO. Tanpa itu armada yang berpindah-pindah PO terasa acak (risiko di bagian 10). Seri: PO yang penumpangnya terbanyak (`poArmada`).
- **Satu kejadian, satu toast** (penyimpangan Raka 1, diterima): toast armada yang menaikkan level PO tidak ditambah toast "🚌". Yang hilang hanya sisa kemajuan setelah naik level.
- **Hadiah tantangan sekali per kartu** (penyimpangan Raka 2, diterima): muat satu baris di 360 px. Setelah satu klaim, nama PO di baris itu berganti ke PO terendah berikutnya. Menulis paket di tiap baris akan menambah 3 baris di portrait tanpa informasi baru.

## 5. Saran 6: tantangan dan target harian

### 5.1 Laba dihitung seperti pil "Laba/hari"

**Tantangan laba mingguan** dan **target harian laba** memakai kemajuan yang sama dengan pil HUD "Laba ±Rp X/hari" (dokumen 14 bagian 4.1):

- tiap tick main aktif, kemajuan bertambah (laba operasi + `kontrakPerJam`) × jam terminal;
- uang kontrak yang diterima sekaligus (daftar atau perpanjang PO) tidak lagi menambah kemajuan;
- kompensasi putus kontrak tidak lagi menguranginya; kontrak PO itu berhenti mengalir.

Target mingguan tidak berubah: laba rata-rata dengan kontrak × 180 jam terminal.

Target harian laba = laba rata-rata sehari **dengan kontrak** (tarif bawaan) × 0,5, paling sedikit `minPerMenit` × 24 × 0,5. Sekarang target itu memakai laba operasi tanpa kontrak, yang hampir selalu minus, sehingga selalu Rp 2,4 jt.

| | Sekarang | Usulan |
|---|---|---|
| Tantangan laba minggu 1 (target Rp 36 jt) | selesai di menit main ke-1–2 (8/8 run) | menit main 51–91 (hari 1–3) |
| Target harian laba | selalu Rp 2,4 jt; tercapai 9/13, 5/5, 11/17, 26/39 hari | Rp 2,4–150 jt, mengikuti laba (mis. Rp 85 jt di hari terminal ke-5 pemain 3 sesi/hari); tercapai 100 % |

### 5.2 Tantangan kepuasan: ambang dari awal minggu, dan tautan ke popup

- **Ambang** = kepuasan saat minggu dimulai, dibulatkan ke bawah ke kelipatan 5 %, dijepit 50–75 %. Contoh:
  - 28 % (game baru) → 50 %;
  - 56 % → 55 %;
  - 91 % → 75 %.
  Lamanya tetap 60 menit main. Disimpan di `TantanganAktif.ambang` (opsional; **field save baru**). Save lama tanpa field ini: ambang dihitung dari kepuasan saat dimuat, dengan aturan yang sama.
- **Kenapa:** 75 % hanya tercapai di 3/8 minggu pertama dan 0/8 minggu kedua bagi pengikut tujuan, dan pemain serakah pun turun ke 66–71 % sesudah Terpadu (permintaan tumbuh melebihi peron). Ambang "+5 poin" tercapai 2/8 di minggu kedua; ambang usulan 8/8 di minggu pertama dan 7/8 di minggu kedua. Kepuasan cenderung turun saat terminal tumbuh, jadi "jangan biarkan turun di bawah awal minggu" tetap menuntut tindakan.
- **Tautan:** di baris tantangan kepuasan, di kanan bilah, ada `kini {k}% ›`. Mengetuknya membuka popup kepuasan (`tampilkanPopupKepuasan`). Selama tantangan kepuasan aktif dan belum selesai, popup kepuasan menampilkan baris atas `🎯 Tantangan: ≥ {a}% · {x}/{m} menit main`.
- Kunci config: `tantangan.kepuasanMin` (0,75) menjadi batas atas; baru `tantangan.kepuasanAmbangMin: 0.5` dan `tantangan.kepuasanLangkah: 0.05`.

### 5.3 Teks

| Tempat | Teks |
|---|---|
| Baris tantangan kepuasan | `Jaga kepuasan ≥ {a}% selama {m} menit main` · kanan: `kini {k}% ›` |
| Catatan kartu tantangan | `Tantangan baru tiap Senin (WIB). Laba dihitung seperti Laba/hari: kontrak PO dirata-rata.` Sejak ronde perbaikan teks ditambah kalimat armada (bagian 4.4) |
| Target harian laba | tidak berubah (`Raih laba bersih {uang} hari ini`); angkanya kini tumbuh |

## 6. Dampak tempo sebelum dan sesudah

**Pemain aktif** (pemain serakah 1×, `tests/tycoon-tempo.test.ts` dan dokumen 13 bagian 14):

Patokan baru disetujui owner 31 Oktober 2026 (jawaban a, bagian 10) dan berlaku di `tests/tycoon-tempo.test.ts` sejak ronde 2. Ronde 1 tidak menggeser tempo aktif. Kolom "sesudah ronde 2" diukur ulang di kode sesudah dibangun (playtest ronde 2): Tipe A 5,08 jam, Terpadu 10,91 jam, bentang buntu 41 menit, total 222 menit, laba hari 10 / 40 Rp 197 / 663 jt, sama dengan simulasi rancangan.

| Momen | Patokan lama | Sebelum (0.3.1) | Sesudah ronde 2 | Patokan baru |
|---|---|---|---|---|
| PO kedua / Perluasan 1 dimulai / Jalur 2 | < 3 / < 45 / < 30 mnt | 0 / 3 / 27 mnt | 0 / 3 / 27 mnt | tetap |
| Jeda terlama tanpa membeli di jam pertama | ≤ 25 mnt | 24 mnt | 24 mnt | tetap |
| Lv 6 / Tipe B (Lv 10) | 15–45 / 75–130 mnt | 32 / 97 mnt | 32 / 97 mnt | tetap |
| Tipe A (Lv 20) | 5–8,5 jam | 6,3 jam | **5,08 jam** (lolos tipis) | 4,5–8,5 jam |
| Terpadu (Lv 30) | 12–17,5 jam | 13,1 jam | **10,9 jam** | 10–17,5 jam |
| Perluasan 5 selesai | < 17,5 jam | 13,6 jam | 11,4 jam | tetap |
| **Bentang buntu terpanjang sebelum Terpadu** | – | **257 mnt** | **41 mnt** | **≤ 45 mnt (patokan baru)** |
| Menit buntu sebelum Terpadu (total) | – | 536 | 222 | – |
| PO terdaftar sampai jam ke-24 | – | 7 | 10 | – |
| Laba hari 10 > 2× hari 1; hari 40 > 2× hari 10 | lulus | 139 jt / 452 jt | 197 jt / 663 jt | tetap |
| Biaya ÷ pendapatan 10–40 %; semua hari laba > 0 | lulus | 20,2 %; 0 hari rugi | 18,3 %; 0 hari rugi | tetap |
| Petugas berhenti | 0 | 0 | 0 | tetap |

Ketiga tes `tycoon-tempo.test.ts` diulang persis di atas usulan (`sim/cek-tempo.ts`): semua lulus kecuali "Terpadu 12–17,5 jam".

Level lain (usulan; dalam kurung sekarang): Lv 15 3,1 jam (3,3) · Lv 25 7,7 jam (9,5) · Lv 28 9,6 jam (11,6) · Lv 40 18,9 jam (22,6). Kepuasan median pemain serakah di 10–13,5 jam turun 79 → 66 %, karena PO yang lebih banyak menambah permintaan di atas kapasitas peron.

**Pemain kasual:** lihat tabel 2.2. Tipe B/A/Terpadu tidak bergeser (offline yang menentukan). Yang berubah adalah isi sesi: keputusan bertahan sampai hari 12, bukan hari 3–4.

**Pengikut baris tujuan** (GameState asli, playtest-30 dokumen 14, dengan U-2): kas menipis 0 dan petugas berhenti 0 di semua run (1× dan 3×, reaksi 20 dan 45 detik, sampai 180 menit; 14 hari nyata K3/K2/A60). Lv 20 di 3× pada menit nyata 128:35 (sekarang 134:39).

## 7. Antarmuka antar-area

**Gameplay (Raka):**

- **Config** (`src/config/economy.config.ts`): kunci di 3.2, 4.2, 5.2. `izinLevel.jendela` boleh dibangkitkan dengan helper kecil di file config, asalkan hasilnya array angka biasa.
- **Pure, `src/sim/bangunan.ts`:**
  - `bonusIzin(id, level, perluasan, cfg)`;
  - `slotBangunan(id, perluasan, level, cfg)`: parameter `level` **wajib**, supaya typecheck menemukan semua pemanggil;
  - `izinPadaLevel(level, perluasan, cfg)` dan `izinBerikut(level, perluasan, cfg)` untuk toast, kartu level, dan baris tujuan.
- **`src/sim/state.ts`:**
  - `slotBangunanState(state, id)`, dipakai `biayaBangunState`, `jendelaPoBaru`, dan `slotJendela`;
  - paket hadiah: `poArmada(state)`, `paketHadiah(state, sumber)` → `{ uang, armada: { po, bagian } | null, percepatDetik }`, dan `berikanPaket(state, paket, ganda)`, dipakai `klaimTarget`, `klaimTantangan`, `klaimBusEmas`, dan kiriman otomatis tantangan minggu lalu;
  - `bisaPercepatProyek(state)` dan `percepatProyek(state)`;
  - kemajuan laba tantangan dan target harian (5.1); `buatTargetHarian` memakai laba dengan kontrak;
  - ambang kepuasan di `perbaruiTantangan` dan `majukanTantangan`;
  - `LaporanOffline.naikLevel: { dari, ke } | null`, data sesaat seperti `proyek`.
- **Aksi baru** (`src/sim/aksi.ts`): `{ jenis: 'percepatProyek' }`, dikirim UI hanya setelah iklan selesai ditonton (seperti `aktifkanBoost`).
- **`src/sim/save.ts`:**
  - `bacaBangunan` merapikan slot dengan level dari `perkembangan.xpTerminal` (blok perkembangan dibaca lebih dulu);
  - `TantanganAktif.ambang` dibaca opsional (0,5–0,75; tidak sah → dihitung ulang).
- **`src/app/tujuan.ts`:** perbaikan U-2 (3.4); tingkat 5 menampilkan izin terdekat (3.5).
- **UI:**
  - `model.ts`: `slotBerikut` menjadi `{ jenis: 'perluasan', tahap } | { jenis: 'level', level }`; izin di kartu level; paket di model target dan tantangan; `ambang` dan kepuasan kini di tantangan kepuasan;
  - `menu.ts`, `notifikasi.ts`, `baris-tujuan.ts`, `popup-hadiah.ts`, `popup-kepuasan.ts`, `popup-offline.ts`, `teks.ts`.
- **Tes:**
  - `tests/tycoon-sim.ts`: slot dengan level; `jalankanKasual`; penggolongan menit buntu (`aksiBernilai`) untuk patokan baru;
  - `tycoon-tempo.test.ts` (patokan bagian 6);
  - `tycoon-kasual.test.ts` (baru);
  - `bangunan`, `state`, `save`, `tantangan`, `hadiah`, `tujuan`, `notifikasi`, dan `ui-model`.

**Platform:** `src/app/iklan.ts` (`TempatIklan` + `'percepatProyek'`) dan, bila perlu, nama penempatan di `iklan-h5.ts`. Ini dua baris. Keputusan Sapto atas CR 5: kedua file dipinjamkan ke Raka di ronde 2, Dodi tidak ikut.

**Grafis (Panji):** tidak ada.

**Save:** satu field opsional baru `tantangan.daftar[i].ambang`, skema tetap 3. Klien lama yang membaca save baru mengabaikannya, dan klien baru menghitungnya ulang. `versiMinimal` tidak perlu naik.

**Analitik:** tidak ada peristiwa atau parameter baru. `iklan_hadiah.tempat` mendapat nilai baru `percepatProyek`: tipe yang sudah ada, nilai yang bertambah. Kebijakan privasi tidak berubah.

## 8. Kriteria penerimaan

Berlaku sebagai bagian brief `docs/tasks/20261031-fondasi-saran-3-6.md` bagian 6. Ronde 1: AC-GP-01 (batas ronde 1), 05, 09, 10, 11, 12. Ronde 2: AC-GP-01 (batas ronde 2), 02, 03, 04, 06, 07, 08, 11, 12, dan AC-PLT-01. Ronde perbaikan teks: AC-GP-19 sampai 23 dan 12 (di akhir bagian ini).

**Gameplay & UI**

- **AC-GP-01:** `tests/tycoon-kasual.test.ts` dengan profil K3 dan K2 (bagian 2) lulus dengan batas yang disetujui owner (2.3), waktu jalan < 30 dtk.
- **AC-GP-02:** izin level sesuai 3.1–3.2, murni di `src/sim/bangunan.ts`, dengan tes unit:
  - slot jendela dan jalur di Lv 10/11/16/19/20/26/30/32 untuk perluasan 2, 3, 4, dan 5;
  - tidak ada izin sebelum Perluasan 3;
  - slot tidak pernah turun antar-level atau antar-tahap.
- **AC-GP-03:** save lama dengan jendela atau jalur di atas slot tahap tidak kehilangan unit saat dimuat bila levelnya cukup (tes save). Tidak ada field save baru selain `ambang`.
- **AC-GP-04:** `tests/tycoon-tempo.test.ts` lulus dengan patokan baru (bagian 6), termasuk patokan baru "bentang buntu terpanjang sebelum Terpadu ≤ 45 menit". Dokumen 13 bagian 14 diperbarui (Citra).
- **AC-GP-05:** perbaikan U-2 (3.4):
  - tes unit: setelah Jalur 3 dibeli dengan saran tampil, saran Jalur 4 dinilai dengan cadangan B;
  - `tests/tujuan-sim.test.ts` lulus tanpa diubah (kedip 0, kas menipis 0).
- **AC-GP-06:** teks izin sesuai 3.5 (≤ 60 karakter di baris tujuan): toast naik level, tingkat 5 baris tujuan, "Slot penuh: +1 di Lv L", kartu level, dan popup offline.
- **AC-GP-07:** paket hadiah sesuai 4.2:
  - `poArmada` deterministik (tes);
  - armada menaikkan XP PO yang tertulis di baris hadiah sebelum klaim;
  - klaim 2× menggandakan seluruh paket;
  - kiriman otomatis tantangan minggu lalu ikut membawa armada.
- **AC-GP-08:** percepat proyek:
  - −360 dtk per aksi, hanya bila sisa > 720 dtk (jadi paling banyak 2 per proyek);
  - tombol hanya tampil saat iklan siap dan aksi itu sah;
  - target harian yang diklaim saat proyek berjalan ikut mempercepat 360 dtk.
- **AC-GP-09:** tantangan laba dan target harian laba sesuai 5.1. Tes:
  - kontrak sekaligus tidak menambah kemajuan;
  - kemajuan per jam = laba operasi + kontrak per jam;
  - target harian laba ≥ laba rata-rata dengan kontrak × 12 jam.
- **AC-GP-10:** tantangan kepuasan:
  - ambang sesuai 5.2 (tes 28 % → 50 %, 56 % → 55 %, 91 % → 75 %, save lama tanpa `ambang`);
  - teks `kini {k}% ›` membuka popup kepuasan;
  - popup menampilkan baris tantangan selama aktif.
- **AC-GP-11:** harness tim dijalankan ulang di atas kode baru, dengan kas menipis 0 dan petugas berhenti 0:
  - `docs/design/20261029-arah-pemain-baru/sim/playtest-30.ts` (P20 dan P45, 1× dan 3×);
  - `docs/design/20261031-fondasi-saran-3-6/sim/tantangan-sim.ts` (K3, K2, A60, 14 hari).
- **AC-GP-12:** tidak ada peristiwa analitik baru; README bagian Pengelolaan terminal, Hadiah iklan berhadiah, dan Tutorial & analitik diperbarui; `npm run typecheck`, `npx vitest run`, dan `npm run build` lulus.

**Ronde perbaikan teks** (dari playtest ronde 2; teks di bagian 3.5 dan 4.4; tanpa state, aksi, field save, angka ekonomi, atau peristiwa analitik baru):

- **AC-GP-19 (P-1):** tombol 2× target berlabel "2× semua" bila paket berisi armada atau percepat; tombol 2× lain tetap "2×". Tidak meluap di 360×740 dan 900×420.
- **AC-GP-20 (P-2):** kartu target dan popup Bus Emas menulis armada dalam level ("+½ level", "+¼ level", lainnya "+{persen}% level"); tantangan tetap "+1 level"; toast armada tidak berubah.
- **AC-GP-21 (P-3):** catatan tantangan dan teks penjelasan tab PO menyebut bahwa hadiah armada selalu untuk PO berlevel terendah.
- **AC-GP-22 (P-4):** status tab PO dan toast slot PO memakai slot jendela berikutnya:
  - Lv 17, Perluasan 3, jendela 19/19, slot PO 7 → "Jendela penuh · +1 di Lv 18";
  - Lv 12, Perluasan 2 → "Jendela penuh · Perluasan 3";
  - toast "🅿️ Slot PO ke-{n} terbuka: jendela loket penuh sampai Lv {L}" / "… sampai Perluasan {N}";
  - tes unit di notifikasi/ui-model.
- **AC-GP-23 (QA S-3):** tes otomatis: aksi `percepatProyek` dan klaim 2× (target, Bus Emas, offline) dikirim hanya setelah iklan selesai dengan hadiah; batal atau gagal tidak mengirim aksi.

**Platform (dikerjakan Raka, keputusan CR 5):** AC-PLT-01: `TempatIklan` mendapat `'percepatProyek'`; iklan contoh dan H5 memakai alur yang sama dengan boost.

**Grafis:** tidak ada.

## 9. Pembagian kerja dan dokumen 13

**Dua ronde build (disetujui, brief bagian 7):**

| Ronde | Isi | Kenapa urutan ini |
|---|---|---|
| 1 | Saran 3 (tes kasual + `jalankanKasual`), saran 6 (5.1–5.3), perbaikan U-2 | Kecil dan tidak menggeser tempo. Alat ukur kasual sudah ada di CI sebelum tempo diubah, dan U-2 adalah bug yang sudah ada sekarang. Butuh APPROVE untuk field `ambang` dan perubahan target harian |
| 2 | Saran 4 (izin level), saran 5 (paket hadiah, percepat proyek), patokan tempo baru | Mengubah tempo dan hadiah iklan: satu keputusan owner, satu ronde QA tempo |

File per agen: Raka mendapat semua file di bagian 7 (gameplay), ditambah `src/app/iklan.ts` dan bila perlu `iklan-h5.ts` di ronde 2 (dipinjam dari Dodi, keputusan CR 5). Panji dan Dodi tidak ada. README dipegang Raka di kedua ronde.

**Bagian dokumen 13 yang diperbarui (Citra, 31 Oktober 2026, setelah APPROVE):**

- Bagian 2: keputusan baru (izin level, armada & percepat sebagai hadiah non-uang, laba tantangan dirata-rata, ambang kepuasan) dan catatan pada keputusan 14 (tabel slot PO).
- Bagian 4.1: tabel slot (jendela, jalur, petak + izin).
- Bagian 6.5: daftar slot PO.
- Bagian 8: progres (izin level).
- Bagian 10: target, tantangan, hadiah, iklan.
- Bagian 11: UI (kartu level, slot penuh, baris tantangan kepuasan).
- Bagian 14: tabel kalibrasi, patokan baru, patokan kasual.
- Bagian 15: langkah 8.
- README dokumen: entri 15 menjadi "Disetujui".

**Sesudah dibangun (Citra, 31 Oktober 2026):**

- Dokumen 13: penanda "ronde 1" dan "ronde 2" dihapus; bagian 8 memakai angka playtest, bukan klaim "tiap level punya sesuatu untuk dikerjakan"; bagian 10 dan 11 memuat teks ronde perbaikan; bagian 14 memakai angka kode; langkah 8 bagian 15 selesai; bagian 16 memuat temuan terbuka dari playtest.
- README dokumen: entri 15 menjadi "Dibangun".

## 10. Risiko, pertanyaan, dan keputusan

**Risiko:**

- **Konten habis lebih cepat bagi pemain aktif.** Terpadu 2,2 jam lebih cepat. Ekor panjangnya adalah tahap 1 (Musim Terminal), bukan kurva XP.
- **Keputusan mid-game kebanyakan jelas**: beli jendela, daftarkan PO, menabung untuk jalur Rp 1,5–4 M. Ini mengisi waktu dengan kemajuan yang terlihat, tapi belum memberi pilihan yang saling bersaing. Itu tugas saran 7 (sink).
- **Gerbang tipis.** Tanpa hadiah, bentang terpanjang 41 menit. Dengan hadiah yang diklaim ada satu bentang 48–49 menit (Lv 17 atau Lv 7), dan bila semua Bus Emas ditonton 75 menit (Lv 28). Patokan tes memakai pemain serakah tanpa hadiah, seperti sekarang.
- **Kepuasan akhir permainan lebih rendah** dengan PO lebih banyak (median 79 → 66 % di 10–13,5 jam). PO premium Sultan Garasi (80 %) lebih sulit dipertahankan. Ambang kepuasan tantangan menyesuaikan.
- **Armada otomatis bisa terasa acak.** Mitigasi: PO sasaran ditulis sebelum klaim, dan aturannya sederhana (level terendah). Sejak ronde perbaikan teks, aturannya juga tertulis di catatan tantangan dan tab PO (bagian 4.4). Memilih PO sendiri cocok untuk tahap 1.
- **Laju tonton iklan belum diketahui** (H5 Games Ads belum aktif): angka "sepertiga ditonton" adalah asumsi.
- **Banyak toast naik level** di Lv 11–30. Izin ditempelkan ke toast level yang sudah ada, bukan toast baru.

**Pertanyaan untuk owner** (dijawab di bawah):

1. Tempo pemain aktif menjadi lebih cepat: Tipe A 6,3 → 5,1 jam, Terpadu 13,1 → 10,9 jam. Imbalannya, tidak ada lagi 4 jam tanpa apa pun di tengah game. Pemain kasual tidak berubah. Setuju patokan baru (Tipe A 4,5–8,5 jam, Terpadu 10–17,5 jam, ditambah "tidak ada > 45 menit buntu")? Memperlambat kurva XP tidak disarankan, karena menurunkan level dan kelas save yang sudah ada.
2. Tantangan kepuasan dengan ambang dari awal minggu butuh satu field save opsional (skema tetap 3). Boleh? Bila tidak, ambang tetap 75 % dan hanya tautan ke popup yang ditambahkan, tapi tantangan itu tetap hampir mustahil setelah Terpadu.
3. Hadiah iklan non-uang: Bus Emas memberi armada PO (+25 % level), dan tombol "Percepat 6 menit" untuk proyek (paling banyak 2× per proyek). Keduanya juga didapat tanpa iklan dari target harian. Setuju?

**Keputusan owner (31 Oktober 2026, Telegram: "APPROVE semua")**

Ketiga pertanyaan dijawab "ya":

- **a. Patokan tempo aktif baru:** Tipe A 4,5–8,5 jam, Terpadu 10–17,5 jam, dan bentang buntu terpanjang sebelum Terpadu ≤ 45 menit (bagian 6). Berlaku di `tests/tycoon-tempo.test.ts` dan dokumen 13 bagian 14 sejak ronde 2. Kurva XP tidak diubah.
- **b. Field save opsional `TantanganAktif.ambang`** untuk tantangan kepuasan (bagian 5.2). Skema tetap 3, `versiMinimal` tidak naik.
- **c. Hadiah iklan non-uang:** armada PO lewat Bus Emas (+25 % level) dan klaim 2×, dan tombol "Percepat 6 menit" untuk proyek (paling banyak 2× per proyek). Keduanya juga didapat tanpa iklan (bagian 4.2).

**Keputusan Sapto atas CHANGE REQUEST (31 Oktober 2026):**

| CR | Isi | Keputusan |
|---|---|---|
| 1 | Perbaikan U-2 kunci histeresis baris tujuan (3.4) | Diterima, masuk ronde 1 (bug di kode aa21f53, tanpa efek samping) |
| 2 | Target harian laba ikut aturan saran 6 (5.1) | Diterima, ronde 1 (angka ekonomi, termasuk APPROVE owner) |
| 3 | Field save opsional `ambang` | Diteruskan ke owner sebagai pertanyaan b: disetujui |
| 4 | Patokan tempo aktif baru | Diteruskan ke owner sebagai pertanyaan a: disetujui |
| 5 | `TempatIklan` di `src/app/iklan.ts` | Diterima: file dipinjamkan ke Raka di ronde 2, Dodi tidak ikut |

Tidak masuk (brief bagian 3): memilih PO sasaran armada sendiri (tahap 1), kosmetik, dan saran 7–10.

**Sesudah dibangun: playtest ronde 2 dan QA (31 Oktober 2026)**

Laporan: `docs/design/20261031-fondasi-saran-3-6-playtest.md` dan QA gameplay `docs/reviews/20261031-fondasi-saran-3-6-gameplay-r2.md` (repo tim).

- **Tidak memblokir.** Angka di kode sama dengan rancangan: Tipe A 5,08 jam, Terpadu 10,91 jam, bentang buntu terpanjang 41 menit (Lv 7), total 222 menit; kasual K3 dan K2 dengan keputusan sampai hari 12. Kas menipis 0 dan petugas berhenti 0 di semua run. Iklan tetap pilihan, dan teks izin muat di 360 px.
- **Penyimpangan Raka ronde 2:** (1) toast armada yang menaikkan level PO memakai teks naik level PO, diterima; (2) hadiah tantangan ditulis sekali per kartu, diterima; (3) tombol 2× target hanya menyebut uang, tidak cukup jelas dan diperbaiki lewat P-1. Teksnya di bagian 4.4.
- **Ronde perbaikan teks P-1 sampai P-4** (keputusan Sapto, bagian dari loop QA fitur yang sudah di-APPROVE, tanpa angka ekonomi): "2× semua", armada dalam level, aturan PO berlevel terendah tertulis, dan status/toast jendela penuh yang menunjuk izin level (bagian 3.5, 4.4, AC-GP-19 sampai 23).
- **QA S-1** (proyek seketika lewat 2 iklan percepat + klaim target 2×): diterima tanpa tindakan (bagian 4.3).
- **Temuan untuk tugas berikutnya** (bukan keputusan; P-5 sampai P-9 dan QA S-4): dicatat di dokumen 13 bagian 16. Yang terbesar: izin jendela tiap level jarang berarti bagi pemain yang mengikuti baris tujuan, dan dataran Lv 21–27 terasa sebagai tunggu panjang.
