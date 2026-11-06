# 16 · Rancangan Bentuk Terminal: lantai 2, denah yang tidak monoton, perubahan per level

> **Status: ronde 1 dirilis di 0.4.1 (5 November 2026). Ronde 2 disetujui owner 5 November 2026 (ADR 008) dan dirilis di 0.5.0 bersama Musim Terminal (dokumen 17), 5 November 2026.** *Diselaraskan dengan dokumen 18 (Tambah Lantai, 6 November 2026):* tabel cadangan tahap 4–5 di bagian 3.1 (cadangan Antarpulau dan gedung parkir mobil); tangga A3 baru pilihan A, tiang bendera dan lampu plaza yang digeser, dan celah A1–sayap barat yang ditutup (catatan di bawah denah 3.1, dokumen 18 bagian 8.10). Ronde 1 disetujui owner 3 November 2026 (Telegram, disampaikan Sapto; pilihan owner di bagian 12, ADR 007) dan dibangun 4 November 2026 (93536c5). Ronde 1 berisi Sayap 2 Lantai (A1, A2, A3), isi lantai 2, proyek tiga fase, pengunjung lantai 2, peresmian susulan, kembang api proyek yang selesai offline, serta teks kartu dan toast. Ronde ini lulus QA gameplay dan grafis, termasuk ronde perbaikan 1 (teks toast susulan dan popup offline, playtest P-1 dan P-2). Brief `docs/tasks/20261103-bentuk-terminal.md`, dasar ADR 006 dan ADR 004. Catatan kerja, denah SVG tiap opsi, dan harness ada di `docs/design/20261103-bentuk-terminal/`, playtest di `docs/design/20261103-bentuk-terminal-playtest.md`, QA di `docs/reviews/20261103-bentuk-terminal-*.md`. Semuanya di repo tim, tidak ikut repo game.
>
> **Ronde 2, dibangun 5 November 2026 dan lulus QA grafis dengan catatan** (`docs/reviews/20261105-bentuk-terminal-ronde-2-graphics.md`, PASS WITH NOTES, 5 MINOR). fps AC-GFX-19 masih NOT ASSESSED sampai diukur Nisa di mesin sepi. Belum di-commit; dirilis bersama Musim Terminal di 0.5.0. Hasil bangun dan keputusan Sapto ada di bagian 6 ("Dibangun"), 11.4, dan 12. Disetujui owner ("APPROVE semua", terminal, 5 November 2026; ADR 008): 12 perubahan kecil per level dalam versi ronde 2, dengan gedung Lv 16 pindah dari lot K14 ke K13; lahan seberang jalan K14–K17 dicadangkan dengan konstanta `CADANGAN_SEBERANG`; perbaikan playtest P-3, P-4, P-7. Semuanya di bagian 6. Brief `docs/tasks/20261105-bentuk-terminal-ronde-2.md` (AC-GFX-08, 13–20, AC-GP-05, AC-PLT-01); rancangan, denah lahan seberang, dan harness di `docs/design/20261104-bentuk-terminal-ronde-2/` (`rancangan-ronde-2.md`, `denah-seberang.png`, `sim/`). Bila bagian 6 dan brief berbeda, brief yang berlaku.
>
> **Dibangun berbeda dari rancangan, diterima Sapto atau owner** (rinciannya di bagian yang disebut): helper peresmian susulan pindah ke `src/app/peresmian-bentuk.ts`, dan tanda lokal tahap ≥ 3 ditulis saat tayang (bagian 7, 10.1); seluruh adegan beku di balik popup offline di jalur resume (GP-1, bagian 7); papan `LANTAI 2` tidak terbaca di 412 karena tilt-shift (G-1, bagian 4.3); fase 1 dan 2 proyek sulit dibedakan di portrait (G-2, bagian 4.4); kembang api tahap 4–5 tidak terlihat di portrait (G-3, bagian 7).
>
> **Yang dibangun:** Opsi A, Perluasan 3 saja. Opsi B dan C, massa sementara tahap 4–5, dan bentuk Perluasan 4–5 tetap tercatat di sini sebagai pilihan yang tidak dipilih atau cadangan tempat, dan **tidak dikerjakan**.
>
> **Dikoreksi dari model 3D Panji.** Gambar ada di `docs/design/20261103-bentuk-terminal/gambar/`. Angka tutup di dokumen ini berasal dari sinar kamera ke mesh model, dengan titik sampel `sim/tutup.ts`, urutan layar 540 / 412 / landscape, kecuali yang ditandai kotak proyeksi. Model itu mock-up kasar (lihat "Belum diperiksa").
>
> **Keputusan berdiri:** tidak ada yang berubah. Slot denah tetap, tanpa penempatan bebas, tanpa angka ekonomi baru, save tetap skema 3. **Yang berubah adalah rencana dokumen 12 bagian 8:** letak lantai 2 dan letak Gedung Antarpulau (ADR 006 memang meminta tinjauan ulang, owner menyetujui di bagian 12). **Ronde 2 menambah satu keputusan berdiri:** lahan seberang jalan K14–K17 dijaga kosong sampai bentuk penyeberangan ke kota diputuskan (`CADANGAN_SEBERANG`, bagian 6, ADR 008).
>
> **Dibandingkan dengan kode 0.4.0 (commit 8d9520b).** Bila dokumen dan kode berbeda, kode yang benar; perbedaannya ditulis di bagian 1.2. Sesudah ronde 1, dokumen ini diselaraskan dengan kode yang dibangun (4 November 2026) di bagian 1.3, 4.3, 4.4, 4.5, 5, 6, 7, 9, 10, 11, 12 dan "Belum diperiksa". Sesudah APPROVE ronde 2 (5 November 2026), bagian 6 diganti versi ronde 2, dan bagian 4.4, 5, 9.3, 10, 12 diberi rujukannya.

| Pertanyaan brief | Bagian |
|---|---|
| 1. Lantai 2: di mana, isinya, terlihat apa, penumpang naik atau tidak, sebutan | 4 |
| 2. Unit di atas batas yang digambar | 5 |
| 3. Denah: opsi, koordinat, rekomendasi, tinjauan Gedung Antarpulau | 3 |
| 4. Perubahan kecil per level | 6 |
| 5. Pemain lama | 7 |
| 6. Bukti "denah murni visual" | 8 |
| 7. Risiko, besar pekerjaan, tes, frame rate | 11 |
| 8. Keputusan owner | 12 |

## Ringkasan

1. **Dipilih owner: Opsi A "U Plaza".** Perluasan 3 membangun **Sayap 2 Lantai** di taman barat: blok dua lantai `x −2,0…6,4, y 11,2…17,2` dan teras food court satu lantai yang menjorok melewati pagar sampai `y 19,9`. Dari atas bentuknya L. Gedung Antarpulau kelak berdiri di belakang ruang tunggu (`x 36…50,14`, sekarang hanya cadangan tempat), jadi bentuk akhirnya U yang memeluk plaza dan parkir.
2. **Lantai 2 tidak ditumpuk di atas gedung lama.** Rencana dokumen 12 (di atas sayap barat dan aula barat) menutup toko aula 100 %, kursi aula barat 83–100 %, toilet 100 %, dan musholla 33–67 % dari kamera normal. Opsi A tidak menutup benda inti sama sekali. Dari 18 benda yang diuji, satu-satunya yang kena adalah musholla & wudhu 0 / 11 / 11 % (juga 11 % di 360): 2 dari 18 titik di tepi selatan, oleh kios teras.
3. **Gedung Antarpulau tidak lagi melebar ke timur.** Bangunan di `x ≥ 51,5` 0 % masuk layar portrait 540×590 pada kamera normal, dan membuat landscape mengecil 15 % (`x` sampai 57,7) sampai 28 % (`x` sampai 75, rencana lama) bila dipaksa muat.
4. **Alur satu arah tidak bergeser.** Di Opsi A tidak ada konstanta rute bus atau penumpang yang berubah. Orang di lantai 2 memakai rute putar sendiri, terpisah dari `DuniaVisual`.
5. **Unit yang selama ini tak terlihat jadi terlihat:** jendela ke-9 sampai ke-24 dan blok kursi ke-5 sampai ke-8 di lantai 2, kios food court ke-3 dan ke-4 di teras. Pemain serakah baru melewati 24 jendela di Lv 28, pengikut tujuan di Lv 28 juga.
6. **12 perubahan kecil per level**, semuanya terukur minimal 6 px di layar HP, di ronde kedua: sesudah gedung lulus QA, dan hanya kalau beban gambar masih muat. Lv 21–27 mendapat satu perubahan tiap level. Ini tanda kemajuan, **bukan** obat kurangnya keputusan di dataran itu (S-4 dan saran 7 tetap terbuka). Ronde 2 disetujui 5 November 2026 (ADR 008) dan sedang dibangun; tabelnya kini versi ronde 2, dengan lahan seberang jalan dicadangkan (bagian 6).
7. **Pemain lama** melihat gedungnya langsung berdiri, dengan satu kali peresmian susulan. Tahap 4–5 selama bentuk akhirnya belum ada: Sayap 2 Lantai saja, proyek Perluasan 4–5 tetap di lokasi lama (pilihan owner).
8. **Denah terbukti murni visual** (bagian 8): lapisan sim tidak bisa mengimpor adegan, dan kapasitas hanya dihitung dari jumlah unit.

## 1. Masalah, tujuan, cara mengukur

### 1.1 Masalah pemain

- **Mid dan late game.** Pemain membayar Rp 250 jt untuk Perluasan 3, kartunya menjanjikan "Lantai 2", crane berdiri sehari terminal, lalu gedungnya sama persis. Hal yang sama di Perluasan 4 (Rp 800 jt) dan 5 (Rp 3 M). Naik level tidak mengubah bentuk apa pun.
- **Semua fase.** Dari kamera normal terminal adalah satu pita diagonal. Pita itu rapi, tapi tidak punya titik yang berkembang.
- **Sesi pertama** tidak boleh terganggu: tahap 0–2 tetap sama, kamera awal tetap sama.

### 1.2 Fakta yang diperiksa di kode

| Fakta | Bukti | Hasil |
|---|---|---|
| Kompleks x −25…50, y 3,4…15, ±6:1 | `tata-letak.ts:290, 306, 319, 55` | Benar: x −24,7…50,14, y 3,4…15,0 = 6,45:1 |
| Perluasan 3–5 hanya proyek dan crane | `perluasan-adegan.ts:7-8, 170-214` | Benar |
| Naik level tidak mengubah bentuk | `kelas3d.ts:143-158` | Benar untuk level. Kelas memang mengubah papan gapura, umbul-umbul (Tipe B), lampu hias (Tipe A), bintang (Terpadu) |
| Batas gambar 8 / 5 / 4 / 4 | `tata-letak.ts:434, 129-130, 256-262, 552` | Benar. Tambahan: toko 2 dari 4, toilet 1 dari 2, petak 20 dari 60, jalur 5 dari 9 (`economy.config.ts:588-596`) |
| Biaya dokumen 12 bagian 8.1 | `economy.config.ts:575-581` | Dokumen 12 usang (Rp 1 jt, Rp 500 jt, Rp 50 M). Yang berlaku Rp 250 jt, Rp 800 jt, Rp 3 M |
| Petak dokumen 12 (60 di tahap 4, 80 di tahap 5) | `economy.config.ts:588` | Dokumen 12 usang. Yang berlaku `[10, 10, 20, 30, 40, 60]` |

Sebutan "lantai 2" di empat tempat tidak sama, diselesaikan di bagian 4.5.

### 1.3 Cara mengukur

| Sasaran | Ukuran | Alat |
|---|---|---|
| Bangunan baru terlihat | ≥ 90 % masuk layar kamera normal di portrait dan landscape | `sim/proyeksi.ts` |
| Inti permainan tidak tertutup | Jendela loket, labirin, antrean, kursi blok 1–4, gerbang, pangkalan: 0 % tertutup | `sim/tutup.ts` |
| Tiap perubahan terbaca di HP | Sisi terpendek ≥ 6 px CSS di adegan 360×575 dan 667×420 | `sim/proyeksi.ts` |
| Ekonomi tidak bergeser | `tests/tycoon-tempo.test.ts` dan `tests/tycoon-kasual.test.ts` lulus tanpa diubah | Vitest |
| Frame rate | Bagian 11.4 | `?tingkat=`, throttle 4× |
| Pemain menyadari | "Apa yang berubah setelah Perluasan 3?" dijawab dengan menunjuk bangunannya | Playtest 5 orang (form sudah ada). NOT ASSESSED sampai playtest itu; playtest Citra di build hanya menilai dari screenshot (bagian 11.3) |

## 2. Sistem sekarang

**Denah** (`src/game/tata-letak.ts`, satuan petak, x ke timur, y ke selatan):

| Bagian | x | y | Tinggi |
|---|---|---|---|
| Jalan dalam | −27,9…51,2 | 3,4…5,6 | |
| Peron kedatangan | −24,7…−7,9 | 5,6…7,2 | kanopi 1,6 |
| Pangkalan | −7,15…26,4 | 5,6…10,4 | bus 0,8 |
| Sayap barat (toilet, musholla) | 6,6…11,6 | 11,2…15,0 | 1,08 |
| Aula loket | 11,6…29,14 | 11,2…15,0 | 2,95 |
| Atrium | 16,8…19,8 | 12,3…14,6 | 4,25 |
| Ruang tunggu | 29,14…50,14 | 6,3…13,0 | 2,45 |
| Plaza | 11,2…30,2 | 15,0…17,6 | |
| Parkir mobil (30 petak per baris, sampai x 45,9) | 30,8…50,14 | 13,6…17,25 | |
| Taman barat | −6,9…10,2 | 10,75…17,2 | |
| Pagar, ruko, jalan belakang | | 17,9 · 18,45…19,95 · 20,4…21,8 | |
| Lapangan timur, SPBU | 53,4…57,7 · 58,3…63,3 | 6,0…14,8 · 6,3…11,8 | |

**Kamera normal** (`src/game/kamera.ts`, `TITIK_INTI`, `TITIK_INTI_POTRET`). Elevasi 42°, FOV 26°, portrait azimut 55°, landscape 45°. Batas geser `BATAS_TARGET` x −32…56, z −3…19 (`adegan.ts:66`).

| Adegan (px CSS) | Layar | Skala di aula (px per unit: x / y / tinggi) | Orang |
|---|---|---|---|
| 540×590 | Screenshot 540×960 | 11,3 / 13,6 / 10,6 | 4,0 px |
| 412×657 (412×632 dengan baris tujuan, diukur di model 3D) | Pixel 412×915 | 7,6 / 9,1 / 7,6 | 2,9 px |
| 360×575 | HP 360×800 | 6,3 / 7,5 / 6,2 | 2,4 px |
| 667×420 | Landscape 900×420 | 7,3 / 7,2 / 6,0 | 2,3 px |

**Dua akibat untuk rancangan:**

- **Benda setinggi h menutup tanah di belakangnya** searah (−0,91·h, −0,64·h) di portrait dan (−0,79·h, −0,79·h) di landscape. Kamera dari tenggara, jadi yang aman ditambah adalah bagian yang di belakangnya (barat laut) tidak ada inti permainan.
- **HP sungguhan melihat lebih banyak dari 540×590.** `JENDELA_POTRET` memakai margin px tetap, jadi di 412 dan 360 px kamera mundur (jarak 140–148, di 540×590 jarak 91). Ruang kosong terbesar ada di kiri bawah layar: sisi selatan pita.

## 3. Denah: tiga opsi

Owner memilih Opsi A (bagian 12). B dan C tetap dicatat sebagai pembanding, tidak dikerjakan.

Semua opsi menjaga alur satu arah (penumpang: plaza → aula → ruang tunggu → gerbang → bus; bus: masuk barat → halte kedatangan → pangkalan → lorong → halte keberangkatan → keluar timur). Bedanya: **di mana lantai 2 berdiri, kapan siluetnya pecah, dan apa yang harus digeser.**

| | **A · U Plaza (dipilih)** | **B · L Engsel** | **C · Tumpuk + L Timur** |
|---|---|---|---|
| Lantai 2 berdiri di | Gedung baru di taman barat | Sayap baru di engsel aula–ruang tunggu | Di atas sayap barat & aula barat (dokumen 12) |
| Siluet pecah sejak | **Perluasan 3** (L), Perluasan 4 (U) | **Perluasan 3** (L di tengah) | Perluasan 4 |
| Menjorok melewati tepi aula (y 15) | 4,9 petak | 2,0 petak | 0 sampai Perluasan 4 |
| Rasio x:y seluruh kompleks setelah P3 (sekarang 6,45:1) | 4,5:1 | 5,5:1 | 6,45:1 |
| Masuk layar kamera normal, 540 / 412 / 360 / landscape | A1 98 / 100 / 100 / 100 %; teras 92 / 100 / 100 / 100 % | 100 / 100 / 100 / 100 % | 100 / 100 / 100 / 100 % |
| Inti permainan tertutup | 0 % | 0 % | 0 % |
| Benda lain tertutup (540 / 412 / landscape) | Musholla & wudhu 0 / 11 / 11 %, juga 11 % di 360 (tepi selatan, oleh kios teras) | Aula timur 20 %: di 540 di balik kaca, di 412 di balik rangka, di landscape tertutup padat. Meja makan padat 11 / 22 / 33 % | Toko 100 %, kursi aula barat 83 / 83 / 100 %, toilet 100 %, musholla 67 / 67 / 33 %, ATM 33 / 33 / 67 % |
| Luas lantai 2 + teras | 50 + 29 = 79 petak² | 31 petak² | 39 petak² |
| Jendela yang bisa digambar | 8 + 16 = 24 | 8 + 9 = 17 | 8 + 15 = 23 |
| Kursi 5–8 / kios 3–4 | Muat / muat di teras | Muat / lantai dasar, nyaris tak terlihat | Muat / tidak muat |
| Yang digeser | Pohon, ruko, pagar di lahannya saja | Parkir mobil & motor 6,6 petak, rute dari parkir, mobil golf | Atap aula dipecah; kamera di Perluasan 4 |
| Rute bus & penumpang berubah | Tidak | Satu rute (dari parkir) | Tidak |
| Besar pekerjaan Panji | Sedang–besar | Sedang–besar | Sedang–besar, kurang terhitung (bagian 3.3) |

Denah: `denah-opsi-a-u-plaza.svg`, `denah-opsi-b-engsel.svg`, `denah-opsi-c-tumpuk.svg`. Tiap denah memuat jejak layar kamera normal portrait dan landscape, alur bus dan penumpang (dibaca dari kode), serta tabel koordinat. Denah dibuat sebelum keputusan owner: baris "massa sementara" di tabel Opsi A tidak dikerjakan, dan yang berlaku adalah dokumen ini.

### 3.1 Opsi A · U Plaza (dipilih owner)

Dari atas: blok dua lantai di barat sayap barat (A1), teras satu lantai menjorok ke selatan dan ke timur sampai plaza (A2), tangga dari plaza (A3). Sayap barat lama tetap kelihatan di sudut dalamnya.

```ts
// Opsi A. Sistem koordinat tata-letak.ts: Persegi {x0, y0, x1, y1}, tinggi dalam unit.
const H_L2 = 1.35, H_DINDING_L2 = 2.55, H_PUNCAK_L2 = 3.55;
const A1  = { x0: -2.0,  y0: 11.2, x1: 6.4,   y1: 17.2  }; // blok 2 lantai
const A2a = { x0: 6.4,   y0: 15.6, x1: 10.4,  y1: 17.2  }; // teras timur, 1 lantai
const A2b = { x0: 2.0,   y0: 17.2, x1: 10.4,  y1: 19.9  }; // teras selatan, 1 lantai, melewati pagar
const A3  = { x0: 10.45, y0: 15.7, x1: 11.55, y1: 17.46 }; // tangga & eskalator: selatan h 0,02 → utara h 1,35
```

> **Diganti 6 November 2026 (dokumen 18 bagian 8.10, rancangan Tambah Lantai 6.8; owner "APPROVE A", Telegram pesan 270):**
> - **Tangga A3 baru, pilihan A ("lurus"):** satu bentang terbuka x 11,1–13,15, y 16,75–17,45, sejajar pagar kompleks, naik ke barat (h 0,02 → 1,35, ±33°) sampai bordes x 10,4–11,1 di tepi teras. Pagar timur teras dibuka di y 16,75–17,45 (dulu 15,6–16,4). Pijakan tipis tanpa tegakan, balok sisi baja, pagar tiang tipis. Eskalator dan sisi biru (`biruPos`) hilang. Konstanta `TANGGA_A3`/`TANGGA` menggantikan `TANGGA_L2`/`tinggiTanggaL2`.
> - **Di semua tahap**, tiang bendera pindah dari (12,2, 16,8) ke (14,6, 16,6), dan lampu plaza dari (12,9, 17,2) ke (13,75, 16,45), supaya kaki tangga lapang.
> - **Celah 0,2 antara A1 (x1 6,4) dan sayap barat (x0 6,6) ditutup** dinding plester h 0–1,08 yang ikut bagian Sayap 2 Lantai. Lantai 2 sayap barat, bila dibeli, menjadi selasar penghubung dari lantai 2 A1 ke dinding barat aula. Nama kartunya "Gedung toilet".

| Bagian | Bentuk (bahan yang sudah ada di `PustakaMaterial`) |
|---|---|
| A1 podium | `batu` h 0…0,12, lantai dasar `lantaiGranit` |
| A1 lantai dasar | Kaca keliling `kacaDinding` h 0,12…1,30, tiang `panel` tiap 1,0 |
| A1 pelat lantai 2 | `batu` h 1,28…1,35, tepi `panel`. Lantai atas `lantaiGranit` |
| A1 lantai 2 | Muka timur dan barat: `kacaDinding` h 1,35 **sampai busur**, `Busur.tinggi(−2,0)` = `Busur.tinggi(6,4)` = 2,70, bukan 2,55, kalau tidak ada celah ke atap. Tiang `panel` di kedua muka ini juga sampai 2,70. Muka utara dan selatan: kaca s.d. 2,55, lalu bidang lengkung `dindingBusur('y', y, −2.0, 6.4, 2.55, busur, ±1)` sampai atap. Sisi utara dan barat: `dindingDalam` h 1,35…2,05 di balik loket, kaca di atasnya |
| A1 atap | `atapLengkung('y', 10.85, 17.55, new Busur(-2.35, 6.75, 2.55, 3.55))`, kaca `kacaAtap`, rusuk `kanopiRangka` tiap 1,0, tritisan `atapLogam`. **Sumbu lengkung tegak lurus atap aula:** dari kamera kelihatan melintang, ini yang memecah garis atap |
| A2 | Pelat `batu` h 1,25…1,35, lantai teras `paving`. Muka selatan (`y 19,9`) dan timur (`x 10,4`): `plester` h 0,12…0,30, kaca s.d. 1,25, tiang `panel` tiap 1,0. Sisi utara A2a dan barat A2b: `plester` penuh, membelakangi kamera. Pagar kaca h 1,35…1,55 di selatan, timur, dan barat A2b, dengan bukaan tangga di timur `y 15,6…16,4` |
| A3 | Dua lajur: naik `x 10,45…10,97`, turun `x 11,03…11,55`. Sisi `biruPos` supaya menonjol, anak tangga `besiGelap`. *Diganti 6 November 2026 oleh tangga A satu bentang (catatan di bawah denah 3.1, dokumen 18 bagian 8.10)* |
| **Papan `LANTAI 2` (final)** | Berdiri di atas talang timur A1, pola papan ruang tunggu (`gedung3d.ts:556-560`), menghadap timur. 4,0 × 1,1 unit. Badan `panel`: `kotak(6.75, 13.1, 6.80, 17.1, 2.62, 3.72)`. Kaki `besiGelap` di `y` 13,6 · 15,1 · 16,6, h 2,55…2,62. Tulisan `m.teks('LANTAI 2', { lebar: 512, tinggi: 140, latar: '#1d4ed8', warna: '#ffffff', ukuranHuruf: 104 })`, dipasang `persegiTegak([6.80, 17.1], [6.80, 13.1], 2.62, 3.72, uv, 0.006)`. Warna sama keluarga dengan tangga. Ukuran dan alasannya di bagian 4.3 |
| Papan detail | `FOOD COURT` di muka selatan A2b (`x 3,6…8,8`, `y 19,93`, h 0,8…1,15). Terbaca hanya saat zoom: 0,35 unit = 2–4 px pada kamera normal. Bukan tanda bangunan |

**Papan yang dibatalkan:** `LOKET · RUANG TUNGGU · FOOD COURT` di ujung selatan A1 (`x 0,2…4,2`, `y 17,24`, h 2,62…3,12). Di model 3D hanya terbaca sebagai garis gelap di bawah tritisan, dan 33 huruf tidak akan muat terbaca di lebar A1.

**Yang disembunyikan saat proyek Perluasan 3 mulai** (tidak ada yang digeser):

- Pohon `TAMAN[1]` dengan `x ≥ −2,5`. Sisa taman barat `x −6,9…−2,5` dan seluruh taman kedatangan utuh.
- Ruko dan ruas `pagarKompleks` di `x 2,0…10,4`.
- **Caranya tanpa menambah draw call:** geometrinya tetap di mesh gabungan `Kumpulan` yang sama, lalu dipotong dengan `geometry.setDrawRange`. Grup terpisah akan menambah ±15 draw call di tahap 0–2 (dua untuk pohon, ±10 untuk ruko dengan 6 warna dinding, tiga untuk pagar), yaitu di sesi pertama, tempat HP lemah paling sensitif. Urutan pengambilan `acak()` tetap, jadi pohon dan ruko lain tidak berubah bentuk. Cara yang sama bisa dipakai untuk menurunkan draw call cangkang sayap (bagian 11.4).

**Perluasan 3–5, alur, dan cadangan tempat.** Hanya baris tahap 3 yang dibangun sekarang. Baris 4 dan 5 adalah cadangan tempat untuk tugas sendiri, sesudah Musim Terminal, dengan APPROVE sendiri:

| Tahap | Muncul | Alur | Cadangan |
|---|---|---|---|
| 3 | A1, A2, A3 | Tidak berubah. Pengunjung lantai 2 rute putar sendiri (bagian 4.3) | |
| 4 (cadangan) | Gedung Antarpulau `x 36…50,14, y 13,2…18,1`, h 3,6, berdiri di atas kolom: kolongnya tetap parkir. *Sejak dokumen 18 (6 November 2026):* cadangan ini menjadi konstanta `CADANGAN_ANTARPULAU`, aspal rata akses gedung parkir boleh lewat, dan kolomnya harus menghindari lorong parkir `y 15,45…16,25` serta lengkung S ke kaki ramp gedung parkir (`x 36…38,4`, sampai `y 17,3`), tempat mobil bergerak lewat | Bus J6–J9 di cabang sendiri: lajur `x 35…51,5, y 18,2…20,3`, hadap −x (pintu bus di sisi −y saat itu, menghadap gedung), masuk dan keluar lewat jalan belakang. Jalan dalam dan bukaan median **tidak** digeser | Dek parkir bus: ruang di atas pangkalan, rencana dokumen 12 tetap (NOT ASSESSED) |
| 5 (cadangan) | Lantai 3 di A1: dinding s.d. 3,75, puncak 4,75 (lebih tinggi dari atrium 4,25). Papan `LANTAI 2` dipindah saat itu | | ~~Gedung parkir mobil `x 51…57,7, y 6…14,8`.~~ *Diganti dokumen 18 (6 November 2026):* gedung parkir mobil dibangun lebih awal sebagai lantai Gedung parkir, bentuk A, di bagian barat lahan parkir `x 30,8…35,96, y 13,6…17,25` (dek dan lajur ramp), sejak Perluasan 3 dan Lv 15. Lapangan timur `x 51…57,7` tidak lagi dicadangkan untuk parkir; jalan samping gedung parkir lewat di selatannya (`x 51,2…57,8, y 4,5…5,3`). Lounge dan jembatan ditinjau saat tahapnya: lounge di atas ruang tunggu menutup 31–44 % kursi blok 1–4 dan 40 % gerbang (kotak proyeksi `sim/tutup.ts`), jadi cocoknya di atap Antarpulau |

**Kamera:** tidak berubah. `TITIK_INTI` dan `BATAS_TARGET` tetap. A2b terpotong 8 % di sudut barat daya hanya pada 540×590.

### 3.2 Opsi B · L Engsel

Sayap dua lantai tumbuh dari sudut aula dan ruang tunggu, menjorok ke parkir. Paling menonjol di tengah layar, tapi kecil dan harus menggeser parkir.

```ts
// Opsi B
const B1 = { x0: 29.14, y0: 13.0, x1: 37.0, y1: 17.0 }; // 2 lantai, tinggi sama A1, atap sumbu y: Busur(28.79, 37.35, 2.55, 3.55); dinding kaca timur & barat sampai busur, 2,71
const B2 = { x0: 27.9,  y0: 15.2, x1: 29.1, y1: 16.96 }; // tangga & eskalator dari plaza
```

- **Digeser:** parkir mobil mulai `x 37,4` (petak 30 → 25 per baris), motor mulai `x 37,6`, `LORONG_PARKIR.x0` 31,2 → 37,6, `RUTE_DARI_PARKIR` menjadi `[37.2, 15.85] → [37.2, 17.35] → [19.9, 17.35]`, mobil golf `(28.9, 15.7)` pindah, semak `y 13,35` di `x < 37` dibuang.
- **Lantai 2:** 9 jendela di dinding utara (`x 29,6 + 0,8k`), 4 blok kursi berjajar (`x` mulai 29,5 · 31,35 · 33,2 · 35,05, `y 14,2…16,2`). Tidak ada tempat food court di lantai atas; kios di lantai dasar muka selatan, nyaris tak terlihat.
- **Perluasan 4:** Antarpulau `x 37…50,14, y 13,2…17,0`, menyambung lurus ke timur. **Perluasan 5:** lantai 3 di B1.
- **Tutup:** aula timur (papan jadwal, meja informasi) 20 %: di 540 di balik kaca, di 412 di balik rangka, di landscape tertutup padat, karena meja informasi berada di balik tritisan sayap. Meja makan ruang tunggu padat 11 / 22 / 33 %. Orang yang berjalan ke pintu ruang tunggu hilang sesaat di belakangnya. Loket tidak tertutup: tepi barat sayap menutup paling jauh sampai `x 25,9`, jendela terakhir berakhir di `x 25,9`, margin nol.
- **Lemah:** 17 jendela yang digambar sudah terlewati di Lv 18 (pemain serakah dan pengikut tujuan 19 jendela), sayapnya menekan parkir yang sudah dibeli pemain.

### 3.3 Opsi C · Tumpuk + L Timur

Paling dekat dengan dokumen 12 dan contoh owner yang harfiah: lantai 2 di atas gedung, Antarpulau menjorok di lapangan timur.

```ts
// Opsi C
const C1 = { x0: 6.6,  y0: 11.2, x1: 16.8, y1: 15.0 }; // lantai 2 = 1,62, puncak 3,6, atap sumbu x: Busur(10.7, 15.5, 2.82, 3.6); dinding kaca utara & selatan sampai busur, 3,13
const C2 = { x0: 15.9, y0: 12.9, x1: 16.7, y1: 14.7 }; // eskalator di dalam aula: selatan h 0,12 → utara h 1,62
const antarpulau = { x0: 51.5, y0: 6.0, x1: 57.7, y1: 17.4 }; // Perluasan 4, h 3,6
```

- **Digeser:** atap aula `x 11,25…16,8` dipecah jadi grup sendiri lalu disembunyikan (`gedungUtama` di `gedung3d.ts:147-166`), pot `(16.6, 14.65)`. Perluasan 4: pohon di `x 51,6…52,5`, lampu `(50.74, 9.6)`, `TITIK_INTI` sampai `x 57,7`, `BATAS_TARGET.x1` 56 → 60.
- **Yang ikut berubah, baru terlihat di model 3D:** sayap barat setinggi ±1,08 meninggalkan celah ke pelat 1,55, jadi dinding luarnya harus disambung (`plester` utara dan barat, kaca selatan, h 0,98…1,55). Tiang selasar `x < 16,8` mengikuti busur baru (2,94 di `y 15,32`). Kaca dinding barat aula dan rusuknya berhenti di 1,55 (`dindingBarat`, `gedung3d.ts:201-216`).
- **Lantai 2:** 12 jendela di dinding utara (`x 7,0 + 0,8k`), 3 di barat, 4 blok kursi (`x` mulai 8,0 · 9,85 · 11,7 · 13,55, `y 12,6…14,6`). Kios 3–4 tidak muat.
- **Lemah:** siluet tetap satu pita sampai Perluasan 4. Empat unit yang sudah dibeli pemain hilang dari pandangan. Bagian L-nya 0 % di layar 540×590, 60 % di 412, 74 % di 360, 55 % di landscape. Bila dipaksa muat, landscape mengecil 15 %.

### 3.4 Tinjauan ulang Gedung Antarpulau (dokumen 12 bagian 8)

Rencana lama: Antarpulau di lahan SPBU dan kampung timur (`x 53…75`), jalan dalam dan bukaan keluar median digeser ke timur.

| Masalah | Bukti |
|---|---|
| Pita makin panjang, kebalikan keinginan owner | Rasio 6,45:1 → 7,1:1 |
| Tidak terlihat pada kamera normal | 0 % di 540×590, 18 % di 412, 25 % di 360, 13 % di landscape |
| Dipaksa muat, semua mengecil | Landscape 28 % lebih kecil, batas zoom keluar portrait 146 → 251 |
| Menyentuh inti rute bus | `KELUAR`, `BUKAAN_MEDIAN`, `JALAN_DALAM`, gapura keluar, dan tesnya di `tests/tata-letak.test.ts:390-427` |

**Dipilih owner, hanya sebagai cadangan tempat (Opsi A):** berdiri di belakang ruang tunggu, di atas kolom di atas parkir mobil. Ini juga arti harfiah usulan owner, "menjorok ke belakang": 100 % di 412 dan 360, 95 % di landscape, 57 % di 540×590. Tidak ada yang dibangun di sini sekarang.

- **Parkir tetap fungsional.** Kolongnya tetap parkir, jadi logika `lahanParkir` tidak berubah. Mobil `x > 36` tertutup; 10 dari 30 petak per baris (`x 30,8…35,5`) tetap terlihat, 67–83 % darinya tidak terhalang.
- **Tutup:** meja makan ruang tunggu 78 / 89 / 78 % (model 3D, massa setinggi 2,66; bentuk akhir h 3,6 di kotak proyeksi 78–89 %). Kursi blok 1–4, gerbang, dan loket 0 %.
- **Cabang bus sendiri** menjaga jalan dalam tetap utuh. Bus besar ini tidak perlu lewat `DuniaVisual`; rinciannya tugas Perluasan 4 dan butuh APPROVE sendiri.

### 3.5 Kenapa Opsi A

1. **Di Perluasan 3, paling sedikit menutup.** Benda inti 0 %. Dari 18 benda yang diuji hanya musholla & wudhu yang kena, 0 / 11 / 11 % dan 11 % di 360: 2 dari 18 titik di tepi selatan, oleh kios teras. Tiap unit yang sudah dibeli pemain tetap kelihatan. Perluasan 4 kelak menutup sebagian parkir (bagian 3.4).
2. **Siluet pecah sekarang, bukan sesudah Musim Terminal.** Sesuai keputusan owner: sayap atau cabang, tanpa rombak total.
3. **Paling sedikit menggeser.** Tidak ada konstanta rute yang berubah, jadi tes tabrakan bus dan tes keramaian tidak tersentuh.
4. **Paling banyak tempat:** 24 jendela, 4 blok kursi, kios, dan teras yang hidup. Ada tempat lantai 3 yang melampaui atrium.
5. **U terbuka ke arah kamera.** Plaza, gapura, dan antrean tidak pernah terhalang oleh sayapnya.

**Kelemahan yang diterima:** letaknya di kiri layar, bukan di tengah, jadi perlu peresmian yang menarik mata (bagian 7). Pohon taman barat berkurang. Kartu perlu nama baru, karena lantai 2 tidak lagi di atas gedung utama.

### 3.6 Save pembanding untuk gambar dan ukuran

- **Save:** `SAVE=5,24,3,25`, `JAM=12`, `SAVE_EXTRA={"terminal":{"bangunan":{"jalur":5,"jendela":24,"kursi":8,"toko":4,"toilet":1,"kios":3,"lahanParkir":2,"posRetribusi":1}}}`. Patokan draw call bagian 11.4 memakai save ini.
- **Layar:** `W=540 H=960`, `W=412 H=915`, `W=900 H=420`, tambah `W=360 H=800` untuk uji gumpalan (bagian 7).
- **Model 3D Panji** hanya pembanding. Bila berbeda, koordinat dokumen ini yang berlaku. Detail A1 dan A2 di bagian 3.1 sudah menyerap keputusan bentuk dari model itu (dinding sampai busur, sisi plester, bukaan tangga).

## 4. Lantai 2 (uraian mengikuti Opsi A)

### 4.1 Berdiri di mana dan kenapa tidak di atas gedung

Lantai 2 ada di blok baru A1, menempel di barat sayap barat. **Bukan** di atas sayap barat dan aula barat seperti dokumen 12, dengan hasil uji sinar kamera di model 3D berikut (kamera 540 / 412 / landscape):

| Tertutup benda padat | Opsi C (dokumen 12) | Opsi A |
|---|---|---|
| Toko aula (minimarket, apotek) | 100 / 100 / 100 % | 0 % |
| Kursi aula barat | 83 / 83 / 100 % | 0 % |
| Toilet | 100 / 100 / 100 % | 0 % |
| Musholla & wudhu | 67 / 67 / 33 %, sisanya di balik rangka atau kaca | 0 / 11 / 11 %, juga 11 % di 360: 2 dari 18 titik di tepi selatan, oleh kios teras |
| ATM | 33 / 33 / 67 % | 0 % |
| Benda inti (loket, labirin, antrean, kursi blok 1–4, gerbang, pangkalan) | 0 % | 0 % |

Ruang tunggu juga tidak mungkin dipakai: pelat setinggi 2,5 di atasnya menutup 31–44 % kursi blok 1–4 dan 40 % gerbang (kotak proyeksi).

### 4.2 Isi

```ts
// Lantai 2 (h = 1,35). Urutan = unit dipasang.
// Jendela ke-9…18: dinding utara, menghadap selatan. x = 5.6 − 0.8k (k = 0…9); muka meja y 11.8, petugas y 11.5, pembeli y 11.97 (sama dengan LOKET).
// Jendela ke-19…24: dinding barat, menghadap timur. y = 12.8 + 0.8k (k = 0…5); muka meja x −1.4, petugas x −1.7, pembeli x −1.23.
// Blok kursi ke-5…8: 10 kursi × 6 baris, jarak seperti KURSI, menghadap utara. Urutan pasang: B8, B6, B7, B5.
const B5 = { x0: -0.4, x1: 1.3, yBaris0: 12.7 }, B6 = { x0: 1.6, x1: 3.3, yBaris0: 12.7 };
const B7 = { x0: -0.4, x1: 1.3, yBaris0: 15.05 }, B8 = { x0: 1.6, x1: 3.3, yBaris0: 15.05 };
// Meja food court di lantai 2 (pola MEJA_TUNGGU): (4.2,12.9) (5.5,13.7) (4.2,14.5) (5.5,15.3) (4.2,16.1) (5.5,16.8). Pintu ke teras di (6.4, 16.2).
// Teras (h = 1,35): kios ke-3 x 6.7…8.1 dan ke-4 x 8.3…9.7, y 15.7…16.4, h 1.35…1.95, muka selatan: 'NASI & SOTO', 'KOPI & ES'. Jalan dari tangga: x 9.7…10.4.
// Meja berpayung teras (payung ø 0,8, h 1,9…2,05): (3.4,18.0) (5.4,18.0) (7.4,18.0) (9.2,18.0) (4.4,19.2) (6.4,19.2) (8.4,19.2).
```

Lantai dasar A1 dan A2 adalah badan food court: terlihat lewat kaca di kedalaman ±1,8 petak dari muka timur dan selatan, cukup sebagai kesan ramai. Toilet ke-2 tidak digambar: pemain serakah dan pengikut tujuan tetap 1/2 sampai akhir simulasi.

### 4.3 Terlihat apa dari kamera, dan apakah penumpang naik

**Terlihat, dari model 3D:** yang kuat adalah kursi di balik atap kaca, payung warna-warni di teras, dan tangga biru dari plaza. Atap kaca melintang terbaca sebagai massa terang. Deret loket hanya terbaca sebagai garis meja, bukan jendela satu per satu. Di 360 dan landscape seluruh sayap terbaca sebagai gumpalan di kiri layar (bagian 7).

Ukuran kotak di layar, semuanya lolos batas 6 px. Lolos batas tidak berarti terbaca: satu jendela lantai 2 lolos ukuran, tapi di model 3D tidak terbaca sendiri.

| Benda | 540×590 | 360×575 | Landscape |
|---|---|---|---|
| Seluruh A1 | 129×122 | 76×71 | 81×73 |
| A3 tangga | 31×32 | 17×19 | 17×20 |
| Satu jendela lantai 2 | 16×17 | 9×9 | 9×10 |
| Deret 10 jendela | 61×63 | 38×37 | 46×35 |
| Satu blok kursi | 36×25 | 21×14 | 22×16 |
| Satu kios teras | 19×20 | 11×11 | 12×12 |
| Satu payung | 16×11 | 8×6 | 9×8 |
| Papan `LANTAI 2`, panjang × tebal (412: 36 × 8,1) | 53 × 11,7 | 30 × 6,6 | 29 × 6,0 |

**Papan `LANTAI 2`** dihitung dari kotak proyeksi (`sim/papan-a1.ts`), belum dilihat di model 3D:

- **Lolos batas 6 px**, tipis di landscape. Tidak ada yang menutupinya.
- **Tulisan:** huruf ±5,9×8,2 px di 540, ±4,0×5,7 di 412, terbaca. ±3,3×4,6 di 360 dan ±3,2×4,2 di landscape: terbaca sebagai pita biru, bukan tulisan. Itu cukup untuk menandai gedungnya.
- **Yang ditutupinya:** 2 dari 6 meja lantai 2 (4 dari 6 di 540). Jendela, kursi, dan kios 0 %.
- **Kata `LANTAI 2`** dipilih karena itu janji kartu dan kata owner, dan delapan huruf muat di A1. Menghadap timur, jadi di portrait hanya 35° dari arah kamera, lebih baik dari muka selatan (55°).
- **Sesudah dibangun (QA grafis, G-1):** tebal terukur 12,1 / 8,5 / 7,0 / 6,8 px di 540 / 412 / 360 / landscape, tidak tertutup. Terbaca di 540. Di 412 kabur karena tilt-shift yang sudah ada (`src/game/adegan.ts`), jadi AC-GFX-12 tidak terpenuhi di 412. Di 360 dan landscape terbaca sebagai pita biru, sesuai perkiraan. **Owner menerima apa adanya (4 November 2026):** papan tetap menandai gedungnya, dan tilt-shift tidak diubah.

**Keputusan: pengunjung tampak naik lewat tangga dan eskalator, tapi bukan penumpang `DuniaVisual`.**

Alasannya, jalan orang di `DuniaVisual` adalah 2D: tinggi dihitung dari titik `(x, y)` lewat `tinggiLantai` di `terminal3d.ts:794, 810, 865, 897` dan `pop-uang3d.ts:101`. Membawa penumpang sungguhan naik berarti menambah lantai pada `OrangVisual` dan pengikut rombongan, dan membuka ulang `dunia-visual.test.ts` (46 KB) serta aturan "hambatan palsu". Itulah yang dokumen 12 bagian 8.4 hitung "Sedang". Hasilnya bagi pemain tidak berbeda, karena orang berukuran 2–4 px.

Yang dipakai:

- **Rute putar (pengunjung lantai 2).** Modul murni baru, pola `posisiPatroli` dengan tinggi per titik: gang gerbang MASUK `(18.3, 18.6)` → plaza `(18.3, 17.5)` → `(12.8, 17.55)` → kaki tangga `(10.7, 17.5)` → naik → `(10.7, 15.8, h 1,35)` (*sejak 6 November 2026, tangga A: plaza → `(14.2, 17.4)` → naik di lajur selatan y 17,25 dari kaki x 13,15 ke bordes x 10,3 h 1,35, turun di lajur utara y 16,95; dokumen 18 bagian 8.10*) → teras atau lantai 2 → duduk 20–40 detik → kembali lewat lajur turun → gang. Jumlah `min(12, 4 + 2 × kios teras + kursi lantai 2) × keramaian`.
- **Orang statis** (pola `OrangStatis`, `terminal3d.ts:179`): petugas di jendela yang disewa dan satu pembeli, duduk di blok kursi terpasang (6 orang per blok, ikut `ambang`), duduk di meja.
- **Hujan.** Teras terbuka: pengunjung meja berpayung pergi seperti pengunjung luar (`terminal3d.ts:846-848`). Orang di A1 ditandai beratap, karena `diBawahAtap` tidak mengenal A1.

Biaya: tidak ada rute lama yang berubah, tambahan paling banyak ±80 instance di `Kerumunan3D` yang kapasitasnya 884 (`terminal3d.ts:499`).

### 4.4 Proyek Perluasan 3

`LOKASI_PROYEK[2]` (`perluasan-adegan.ts:170-180`) diganti, aturan tes tetap terpenuhi (crane, material, pekerja di dalam pagar; `tinggiLantai` null):

```ts
{ pagar: [{ x0: -2.2, y0: 11.0, x1: 6.6, y1: 17.4 }, { x0: 2.0, y0: 15.4, x1: 10.6, y1: 20.0 }],
  crane: { x: 2.2, y: 14.2, tinggi: 5.4, lengan: 4.4, arah: 0.6 },
  jendela: [],
  material: [[-1.0, 16.4], [4.6, 18.8], [8.6, 18.6]],
  pekerja: [{ dari: [-1.0, 12.4], ke: [5.0, 12.4] }, { dari: [3.0, 18.2], ke: [9.6, 18.6] }],
  pusat: [4.2, 15.6], tinggiKembangApi: 6.5 }
```

**Bangunan tumbuh selama proyek**, dari `proyekDetik` yang sudah ada: sisa > 2/3 fondasi, sisa > 1/3 rangka lantai dasar dan pelat, sisanya rangka lantai 2 tanpa kaca. Percepat lewat iklan cukup melompati fasenya. Kembang api di `pusat` saat selesai, seperti sekarang.

**Sesudah dibangun:**

- Field `perancah` dihapus dari `LokasiProyek`, karena sesudah perancah sayap barat hilang tidak ada tahap yang memakainya. Pekerja naik ke atas pelat sejak fase 1.
- **Fase 1 dan fase 2 sulit dibedakan pada kamera normal portrait** (G-2, playtest P-4): rangka lantai 2 lebih tipis dari 1 px, jadi proyek terbaca dua langkah (lahan → pelat), bukan tiga. Diterima tanpa tindakan di ronde 1. Perbaikannya (P-4) disetujui untuk ronde 2 (ADR 008): jaring pengaman kuning di keempat muka lantai 2 selama fase 2, dengan bahan kuning crane yang sudah ada, +0 draw call (bagian 6, brief ronde 2 AC-GFX-17).

### 4.5 Sebutan: yang berlaku dan yang berubah

**Berlaku:** gedungnya **Sayap 2 Lantai**. Lantai atasnya **lantai 2**. "Sayap barat" tetap nama toilet dan musholla. Sebutan pemain:

| Tempat | Sekarang | Jadi |
|---|---|---|
| `src/ui/teks.ts:114` nama | `Lantai 2 gedung utama` | `Sayap 2 lantai`, dengan spasi tak terputus (`Sayap 2 lantai`) supaya nama tidak terpotong di toast dan popup 360 px (playtest P-1) |
| `src/ui/teks.ts:114` deskripsi | `Food court & ruang tunggu: jendela +4, …` | `Loket, ruang tunggu & food court: jendela +4, petak bus +10, kursi, toko, toilet; sesudahnya naik level menambah slot jendela & jalur`. **Sejak 0.6.0** (`src/ui/teks.ts:121`) diakhiri `…, dan membuka Tambah lantai`, karena Perluasan 3 juga membuka kartu lantai di tab Bangun (dokumen 18 bagian 6, keadaan "Tersembunyi") |
| `src/ui/teks.ts:120` efek | `lantai 2, jendela +4, izin level` | **Tetap**: masih benar |
| `src/game/perluasan-adegan.ts:170` | Perancah keliling sayap barat | `LOKASI_PROYEK[2]` baru, komentar `3 · Sayap 2 Lantai` |
| `src/game/fasilitas-adegan.ts:24` komentar | `(lantai 2)` | Sebut `BLOK_KURSI_L2` |
| `src/config/rilis.config.ts` | | Catatan rilis (bagian 9.3), **saat rilis**, bukan di ronde bangun |
| `README.md` bagian adegan | | Bangunan baru |
| `documents/12` bagian 8.1–8.3 dan `12-denah-perluasan.svg` | Di atas sayap barat & aula barat; Antarpulau di timur | Catatan "diganti dokumen 16", sudah ditulis (4 November 2026). SVG tidak disunting; catatannya di bawah gambar |
| `documents/13` bagian 4.1, 12 | `unit lantai 2 belum digambar` | Sudah diperbarui (4 November 2026) |
| `documents/15` bagian 3.1 | `lantai 2 aula loket` | Catatan sejarah, tidak disunting isinya |

## 5. Unit di atas batas yang digambar

Pemain di simulasi (`sim/unit-serakah.ts`, `sim/pengikut-unit.ts`; pengikut tujuan 3×, reaksi 20 detik, sepertiga Bus Emas). Format: terpasang/slot.

| Level | Serakah: tahap · jendela · kursi · toko | Pengikut: tahap · jendela · kursi · toko |
|---|---|---|
| 10 | 2 · 8/8 · 3/4 · 2/2 | 2 · 8/8 · 3/4 · 0/2 |
| 15 | 3 · 16/17 · 7/8 · 4/4 | 3 · 15/17 · 4/8 · 0/4 |
| 20 | 3 · 21/22 · 8/8 · 4/4 | 3 · 21/22 · 5/8 · 0/4 |
| 25 | 4 · 21/31 · 8/8 · 4/4 | 4 · 21/31 · 8/8 · 0/4 |
| 28 | 4 · 27/34 · 8/8 · 4/4 | 4 · 25/34 · 8/8 · 0/4 |
| 30 | 4 · 28/36 · 8/8 · 4/4 | 4 · 25/36 · 8/8 · 0/4 |
| 40 | 5 · 29/45 · 8/8 · 4/4 | sim berhenti di Lv 31 |
| 46 | 5 · 33/48 · 8/8 · 4/4 | |

**Jendela: gambar sampai 24, lalu berhenti.**

- **Jendela 1–8** tetap di aula (`X_LOKET` tidak ditambah; lihat bagian 8.3, tiga tempat bergantung pada panjangnya). **Jendela 9–24** di lantai 2 (daftar sendiri `LOKET_L2`). Perluasan 4 kelak menambah 8 di aula kedua: 32. Sampai bentuknya dibangun, batas gambar tetap 24.
- **Keadaan tiap jendela lantai 2:**

  | Keadaan | Syarat | Tampilan |
  |---|---|---|
  | Belum dibangun | `jendela < k` | Dinding polos |
  | Dibangun, belum disewa | `jendela ≥ k`, `loketTerisi < k` | Papan `LOKET k`, rolling door turun `TUTUP` |
  | Disewa, siang | `loketTerisi ≥ k` | Papan menyala warna loket, petugas dan pembeli |
  | Disewa, malam | Separuh tutup seperti `loketBuka` (22.00–05.00) | Rolling door |

  16 rolling door **tidak boleh** memakai pola satu grup per pintu seperti `RollingDoor` (`malam3d.ts:134-142`): itu 32 draw call, lebih dari seluruh batas. Lihat bagian 11.1.

- **Kenapa di atas 24 tidak perlu.** Pemain serakah dan pengikut tujuan baru melewati 24 jendela di Lv 28 (9,6 dan 10,7 jam main). Tab Bangun tetap menulis `27/34`, dan arus penumpang tetap dari sim. Papan angka 3D ditolak: tulisannya 2 px di HP (bagian 6).
- **Arus keramaian tetap dari jendela 1–8.** Jendela lantai 2 tidak menambah antrean di labirin, jadi bottleneck tetap terbaca di tempat yang sama, dan sorotan LOKET tetap di aula.

**Blok kursi 5–8: semuanya di lantai 2**, muncul per unit lewat `bangunan.kursi` (5, 6, 7, 8). `BLOK_KURSI` dan `KURSI_TUNGGU` tidak berubah, karena penumpang `DuniaVisual` tetap memakai 4 blok lama.

**Kios ke-3 dan ke-4:** teras, tertutup rolling door sampai `bangunan.toko ≥ 3` dan `≥ 4`. Pengikut tujuan punya 0 toko sampai Lv 31, jadi bagi banyak pemain kios ini akan tutup. Teras dan mejanya tetap ramai. Kios tutup malah menjadi petunjuk ringan "ini bisa dibuka", tanpa mengubah baris tujuan.

**Sesudah dibangun, petunjuk ini belum bekerja.** Playtest P-7: kios buka dan kios tutup tampak sama pada kamera normal dan zoom 2×. Pada zoom maksimum keduanya hanya dibedakan oleh orang di depan kios buka. Perbaikannya disetujui untuk ronde 2 (ADR 008): kios teras yang sudah dibangun diberi tenda bergaris, siang dan malam, sedangkan pintu gulung tetap menandai tutup. Jadi belum dibangun, dibangun tapi tutup, dan buka bisa dibedakan (bagian 6, brief ronde 2 AC-GFX-18).

**Tetap tidak digambar sampai tahapnya:** jalur 6–9 dan petak 21–60 (Perluasan 4–5), toilet ke-2. Petak 21–30 sudah dipakai sim sejak Perluasan 3 tanpa gambar; dibiarkan, karena 20 petak yang ada sudah memenuhi layar dan menambahnya butuh rute.

## 6. Perubahan kecil per level

**Status 5 November 2026: disetujui owner ("APPROVE semua", terminal; ADR 008), dibangun, lulus QA grafis dengan catatan; fps belum diukur.** Hasilnya di "Dibangun" di akhir bagian ini. Ronde kedua dimulai sesudah Sayap 2 Lantai lulus QA, dengan syarat beban gambar masih muat (bagian 11.4); perkiraannya di bawah, di "Beban". Brief `docs/tasks/20261105-bentuk-terminal-ronde-2.md`; rancangan `docs/design/20261104-bentuk-terminal-ronde-2/rancangan-ronde-2.md`, dengan denah dan harness di folder yang sama (repo tim). **Tabel di bagian ini adalah versi ronde 2.** Ia menggantikan tabel rancangan 3 November, yang menaruh gedung Lv 16 di lot K14.

- **Ikut ronde 2** (temuan playtest ronde 1, disetujui bersama):
  - **P-3, kembang api siang lebih terbaca.** Kecerahan ikut siang dan malam (siang ×1,0, malam tetap ×3,2), palet tanpa putih, partikel lebih besar (r 0,15 → 0,26), dan letupan Perluasan 3 lebih rendah (h 6,5 → 5,0). Ini juga syarat bagi kembang api kecil per benda di bawah. Brief AC-GFX-16.
  - **P-4:** fase 2 proyek berjaring kuning (bagian 4.4). AC-GFX-17.
  - **P-7:** kios teras yang dibangun bertenda (bagian 5). AC-GFX-18.
- **Pemeriksaan lahan seberang jalan sudah dilakukan.** Pemeriksaan ini diminta karena usulan owner 3 November 2026 agar terminal kelak tumbuh melintasi jalan (rancangan ronde 2 bagian 2). Tidak ada gedung yang mengunci jembatan tahap 5 dokumen 12. Hanya gedung Lv 16 di K14 yang menempati separuh lahan terbaik untuk bangunan pendarat jembatan. Gedung itu pindah ke K13, dan lahannya dicadangkan (di bawah tabel).

Hanya dari `levelTerminal(state)`, `perkembangan.perluasan`, dan daftar PO terdaftar menurut urutan daftar (untuk baliho), tanpa field save. Semua diukur (`sim/proyeksi.ts`; untuk ronde 2 juga `docs/design/20261104-bentuk-terminal-ronde-2/sim/seberang.ts`) dan diuji tidak menutup inti permainan (`sim/tutup.ts`). Ukuran: px CSS di 360×575 / 667×420, kamera normal. Jam = jam main pemain serakah (bagian 5, ekonomi 0.4.0, tidak berubah di ronde 1).

| Lv | Jam | Perubahan | Letak | Ukuran | Berubah dari rancangan 3 Nov |
|---|---|---|---|---|---|
| 5 | < 0,5 | 6 pohon peneduh tepi selatan plaza | `y 17,65`, `x` 13,6 · 15,6 · 20,6 · 23,4 · 26,4 · 29,0 | 12×14 / 12×15 | |
| 8 | 1,0 | Kanopi antar-jemput di atas mobil golf | `x 26,6…29,1, y 15,55…16,3`, h 0,9…1,1 | 18×16 / 21×16 | |
| 13 | 2,5 | Baliho PO terdaftar pertama di atap ruang tunggu, warna liveri | `x 32…36, y 13`, h 2,2…3,2 | 22×27 / 30×26 | Warna dari `LIVERY_PO`. Bila PO < 1: warna terminal `#1d4ed8` dan putih |
| 16 | 3,4 | **Gedung kota K13 meninggi 2,5 → 6,0** | `x 21,4…24,0, y −3,8…−1,5` | 30×56 / 32×55 | **Dulu K14** `x 24,8…28` 4,4 → 7,5 |
| 21 | 5,5 | Gedung kota K12 5,9 → 9,0 | `x 17…20,6, y −5,4…−1,6` | 43×45 / 44×46 | |
| 22 | 6,0 | Baliho PO kedua | `x 42,5…46,5, y 13`, h 2,2…3,2 | 24×29 / 34×29 | Bila PO < 2: warna terminal |
| 23 | 6,5 | Gedung kota K07 5,0 → 8,5 | `x −5…−1,6, y −5…−1,6` | 36×42 / 36×42 | Catatan: pita kabur portrait |
| 24 | 7,1 | 3 pohon atap di teras, bila tahap ≥ 3 | `x 10,0`, `y` 17,7 · 18,6 · 19,5, h 1,35…2,35; **dibangun h 1,35…2,68** | 10×13 / 11×12 | Dibangun lebih tinggi supaya lolos ukuran AC-GFX-13 (bagian "Dibangun") |
| 25 | 7,7 | Menara jam plaza | `x 28,6…29,3, y 16,4…17,1`, h 4,6 | 9×35 / 11×35 | |
| 26 | 8,3 | Gedung kota K09 3,7 → 7,2 | `x 2,8…5,8, y −4,4…−1,5` | 31×40 / 32×40 | Catatan: pita kabur portrait |
| 27 | 8,9 | Monumen bus di atas alas | `x 26…28,4, y 16,5…17,0`, h s.d. 1,2 | 15×21 / 19×21 | |
| 35 | 14,7 | Gedung kota K11 2,8 → 6,5 | `x 13,4…16,2, y −3,6…−1,5` | 27×40 / 29×39 | |
| | | **Cadangan lahan seberang**, tanpa hiasan | `x 24,8…39,0, y −5,0…−1,2` (K14–K17) | | **Baru** |

Lv 10, 20, 30, dan tiap bintang sudah punya tanda kelas (`kelas3d.ts`). Lv 2–4 sudah penuh tutorial dan perluasan.

**Cadangan lahan seberang (`CADANGAN_SEBERANG`, ADR 008):**

- **Lahan:** lot kota K14–K17, di seberang ruang tunggu dan gerbang. Di kode: `CADANGAN_SEBERANG = { x0: 24.8, y0: -5.0, x1: 39.0, y1: -1.2 }` di `src/game/tata-letak.ts`.
- **Aturan:** sampai bentuk penyeberangan diputuskan, lahan ini tidak diberi hiasan level, gedung kota yang dinaikkan, atau hiasan lain.
  - Satu tes menjaganya (brief ronde 2 AC-GFX-14), jadi janji ini tidak bergantung pada ingatan.
  - Gedung yang dinaikkan hanya K07, K09, K11, K12, K13. Lot K14–K17 tidak berubah.
- **Kenapa lahan ini:** jembatan ke kota hanya bisa berdiri di depan peron kedatangan (barat) atau ruang tunggu (timur), tidak di atas pangkalan, karena pangkalan termasuk inti permainan (bagian 1.3).
  - **K14+K15** (`x 24,8…31,4`): 100 % di layar dan tajam di keempat layar, 103×103 / 68×69 / 56×57 / 62×56 px (540 / 412 / 360 / landscape). Hanya ujung K15 yang menyentuh kolom tombol di 540 dan 412.
  - **K16–K17** menampung jembatan tahap 5 dokumen 12 (`x 37,8…39,2`).
- **Belum diputuskan:** bentuk penyeberangan itu sendiri. Ia masuk rancangan Perluasan 4–5. Gambar lahan, koridor, dan jejak layar: `docs/design/20261104-bentuk-terminal-ronde-2/denah-seberang.png`.

**Pita tilt-shift portrait** (tengah benda, 412 / 360; `hasil-seberang.txt` bagian 8 di folder rancangan ronde 2):

- **Tajam:** semua benda plaza, yaitu Lv 5, 8, 13, 24, 25, 27.
- **Landai 22–26 %:** Lv 22.
- **Landai sampai kabur penuh di puncaknya:** gedung kota.

Di 540 dan landscape, benda plaza ada di pita landai bawah, 18–72 %, dan baliho Lv 22 di pita kabur penuh. **Diterima owner** (ADR 008 butir 3): gedung Lv 23 dan Lv 26 tumbuh di pita kabur atas layar HP, seperti papan `LANTAI 2`. Pertambahan tingginya 21–38 px tetap terbaca sebagai siluet, dan tidak ada lot tajam lain yang masih bebas.

**Gedung kota** tumbuh sebagai tambahan lantai di atas atap lama, dengan bahan kota yang sudah ada, jadi jendela fasad bersambung. Rancangan ronde 2 mengusulkan menaruhnya di ujung mesh gabungan lingkungan dan memotongnya dengan `setDrawRange` seperti lahan Sayap, sehingga +0 draw call. Cadangannya wadah sendiri, +4. `InstancedMesh` fasad dari rancangan 3 November tidak dipakai, karena kotak satuan yang diskalakan meregangkan tekstur jendela ±1,6×. Panji yang memilih caranya. Kota mengisi hampir separuh layar portrait, jadi tumbuhnya terlihat di tempat yang selama ini tidak pernah berubah, dan ceritanya masuk akal: kota ikut tumbuh bersama terminal.

**Menarik mata.** Saat satu level naik di sesi aktif dan ada benda baru, kembang api kecil sekali di titik benda itu, tanpa suara baru dan tanpa toast baru. Ia memakai `KembangApi` yang sudah ada dengan perbaikan P-3: 3 letupan, sebaran ±1,0, pusat 1,5 di atas puncak benda, +0 draw call. Memuat save dan lompatan level offline tidak memicu kembang api: bendanya langsung ada.

**Beban** (perkiraan dari primitif sebelum dibangun; rancangan ronde 2 bagian 4; angka terukur di bagian 11.4):

- **Hiasan selain gedung kota:** satu wadah dengan satu bahan, ditambah bayangannya, jadi +2 draw call. Wadah itu dibangun saat hiasan pertama tampil (Lv 5).
- **Gedung kota, P-3, P-4, P-7, dan kembang api kecil:** +0 draw call.
- **Jumlah di tahap 3 Lv ≥ 35:** ±5,9 rb segitiga dan +2 draw call (paling banyak +6), dari sisa ronde 1 ±11,9 rb dan ≥ 19 (bagian 11.4).
- **Tahap 0–2 naik +2 draw call sejak Lv 5.** Ini pengecualian dari syarat ronde 1 (AC-GFX-10). Sapto menerimanya, karena gabungan dua ronde paling banyak +9 dari batas 25 (ADR 008).
- **Batas ukur** ada di brief ronde 2 AC-GFX-19. Bila lewat, benda dipotong dari bawah menurut urutan di rancangan ronde 2 bagian 4.3: pohon plaza Lv 5 dipotong pertama, P-3 terakhir.

**Dibangun (5 November 2026, keputusan Sapto atas laporan Panji dan QA grafis; brief ronde 2 bagian 9):**

- **Palet P-3 berlaku untuk semua kembang api peresmian,** termasuk Perluasan 1, bukan hanya Perluasan 3 dan hiasan level. Biru muda dan putih diganti `0x2563eb` dan `0xf97316`. AC-GFX-20 hanya tentang adegan statis, jadi ini bukan pelanggaran.
- **Kilatan tidak dibuat.** Kilatan adalah tambahan opsional dari rancangan ronde 2 (≤ 7 instance, 56 segitiga). Kembang api siang lolos AC-GFX-16 tanpa kilatan.
- **Pohon atap Lv 24 setinggi 1,35–2,68,** bukan 1,35–2,35, supaya sisi terpendeknya ≥ 6 px (AC-GFX-13). Margin di 360×575 tinggal 0,6 px: terkecil 6,6 px (G-2). Perubahan skala atau kamera kecil bisa membuatnya lewat batas.
- **Kembang api kecil dilewati bila naik level jatuh di frame yang lebih panjang dari ±2 detik** (`jamBersambung`, sama dengan jalur resume; G-4). Itu terjadi bila naik level jatuh pada beberapa detik pertama sesudah memuat di perangkat lambat, saat shader dikompilasi. Bendanya tetap muncul; hanya kembang apinya yang tidak.
- **Kembang api siang di 412 samar** (G-1): ada tiga letupan berwarna dan partikel 4–5,1 px, jadi AC-GFX-16 terpenuhi. Tapi di bawah tilt-shift titiknya kecil, dan pemain ponsel kecil bisa melewatkannya. Diterima; bisa dipertajam di ronde berikutnya bila owner mau (partikel lebih besar atau lebih terang di bawah 480 px).
- **Beban terukur:** bagian 11.4, "Hasil ronde 2". **Tahap 0–2 kini tepat di batas +2 draw call** (G-3). Tambahan apa pun berikutnya di tahap 0–2, termasuk hiasan Perluasan 4–5 yang tampil sebelum tahap 3, harus memotong atau menggabung mesh lebih dulu.

**Dataran Lv 21–27.** Satu benda per level, kira-kira tiap 34 menit main (serakah Lv 21 → 27 = 3,4 jam; pengikut 3,5 jam). **Jujur soal batasnya:** ini memberi tanda kemajuan, bukan keputusan. S-4 (3 keputusan dalam 3,5 jam) tetap ada; obatnya P-5 dan saran 7.

**Dibuang karena tidak lolos:**

| Kandidat | Alasan terukur |
|---|---|
| Panel surya di kanopi peron | Strip tengah 0,5 unit = 3–4 px. Selebar kanopi menutup penumpang peron (kanopi kini tembus pandang) |
| Umbul-umbul plaza | Satu kain 1–2 × 9 px |
| Pot tanaman di aula | 3–5 px |
| Papan angka jendela (`LOKET 1–28`) | Tinggi tulisan 0,3 unit = 2 px |
| Air mancur diperbesar | Selisih diameter 0,76 unit = 5 px, tak terbaca sebagai perubahan |
| Taman atap di sayap barat | Menutup musholla dan toilet di bawah atap kaca |
| Lampu sorot gedung | Hanya malam, tidak lolos pada kamera normal di siang hari |
| Gedung kota `x 39,8…43` | 0 % di 540×590, 2 % di 412, 25 % di 360 |
| Papan LED di fasad aula `x 21,5…24,5` | Menutup 50 % labirin di landscape |
| Videotron plaza `x 20…22,4` | Menutup 50 % mulut antrean di portrait |

## 7. Pemain lama

Save tidak berubah, jadi bentuk baru diturunkan penuh dari state yang sudah ada begitu versi baru jalan.

| Save saat pembaruan | Yang dilihat |
|---|---|
| Tahap 0–2 | Sama persis. Kartu Perluasan 3 memakai nama baru |
| Tahap 2, proyek Perluasan 3 berjalan | Pagar dan crane pindah ke lahan baru, fase sesuai `proyekDetik`. Pohon dan ruko di lahan sudah hilang. Selesai seperti biasa |
| Tahap 3 | A1, A2, A3 berdiri. Jendela, kursi, dan kios yang sudah dibeli langsung tampil (bagian 5). **Peresmian susulan** |
| Tahap 4 | Seperti tahap 3: Sayap 2 Lantai saja. Proyek Perluasan 4 tetap di lapangan timur. Peresmian susulan |
| Tahap 5 | Seperti tahap 3: Sayap 2 Lantai saja, tanpa lantai 3. Proyek Perluasan 5 tetap di lapangan timur. Peresmian susulan |
| Lv tinggi, sesudah ronde kedua | Semua hiasan level di bawah levelnya langsung ada, tanpa kembang api per benda |

**Peresmian susulan: dipilih owner.** Pemain ini sudah membayar dan melihat gedung yang sama; sekarang janjinya baru ditepati. Sekali saja: kembang api di `pusat` Perluasan 3 dan toast `🎉 Perluasan 3 kini punya gedung: Sayap 2 lantai!` (bagian 9.3).

- **Menarik mata memang perlu, bukan hiasan.** Di model 3D, pada 360 dan landscape sayap hanya terbaca sebagai gumpalan di kiri layar, sedangkan perhatian ada di label LOKET. Tanpa kembang api dan toast, pemain lama bisa melewatkannya.
- **Tidak butuh field save.** Tanda lokal `terminal-bus-tycoon/peresmian-bentuk` di `Penyimpanan`, pola yang sama dengan `KUNCI_PANEL` dan `KUNCI_KECEPATAN` (`main.ts:107-111`). Tidak ikut save, tidak ikut cloud, bukan data analitik.
- **Kapan tanda ditulis (seperti dibangun, diterima Sapto):**
  - Tahap < 3: saat muat pertama, supaya pemain ini kelak cukup mendapat peresmian biasa, tidak dua kali.
  - Tahap ≥ 3: **saat peresmian tayang, bukan saat muat**, supaya pemain yang menutup game selagi popup masih terbuka tetap mendapatkannya. Bila adegan gagal dimuat, peresmian dicoba lagi saat game dibuka berikutnya.
- **Kapan tayang:** begitu adegan siap dan tidak tertutup popup atau tutorial. Toast memakai `notifBahaya`, jadi melompati antrean toast. Toast ini tidak memotong toast yang sedang tampil, jadi bisa tertinggal sampai 3,5 detik dari kembang apinya; keduanya tetap tumpang tindih karena kembang api berlangsung ±5,9 detik.
- **Letak logika (diterima Sapto, brief bagian 5):** `perluPeresmianSusulan`, `AntreanPerayaan`, `TAHAP_SAYAP_2_LANTAI`, dan `JEDA_PERAYAAN_DETIK` ada di `src/app/peresmian-bentuk.ts`, bukan di `bentuk-adegan.ts`, supaya `main.ts` tidak mengimpor dari adegan. Adegan menyediakan `Terminal3D.rayakanPerluasan(tahap)`.
- Login di perangkat lain bisa menayangkannya sekali lagi. Tidak mengganggu. Sebaliknya, karena tanda per perangkat, akun lain yang login di perangkat yang sama tidak mendapatkannya lagi (QA GP-2, sesuai rancangan).

**Selesai saat offline.** Di muat dingin kembang api sekarang tidak pernah tampil, karena `perluasanLalu` dibaca dari state yang sudah maju (`terminal3d.ts:459, 752-754`). Padahal pemain kasual dengan Manajer mendapat 94 % XP dari offline. **Ikut dibangun (AC-GP-03):** menutup popup offline yang memuat `proyek.selesai` memicu kembang api tahap itu. Data sesaat, tanpa field baru. Popupnya kini menyebut gedungnya (bagian 9.3).

- **Bila jatuh di muat yang sama dengan peresmian susulan:**
  - proyek tahap 3: satu kembang api saja, dengan toast susulan;
  - proyek tahap lain: kembang api proyek dulu, susulan menyusul sesudah jeda 6 detik (`JEDA_PERAYAAN_DETIK`).
- **Jalur resume** (game kembali dari latar belakang dan adegannya sudah ada; diterima Sapto):
  - Kembang apinya berasal dari deteksi naik tahap di adegan sendiri (`perbaruiProyek`), bukan dari `rayakanPerluasan`, supaya tidak dobel.
  - Selama popup offline terbuka, **seluruh adegan beku**: orang, bus, dan langit, bukan hanya kembang api (QA GP-1, MINOR, diterima apa adanya). Simulasi tetap berjalan. Adegan baru bergerak lagi sesudah "Oke".

**Tahap 4–5 selama bentuk akhirnya belum ada: kosong (pilihan owner).** Tahap 4–5 hanya menampilkan Sayap 2 Lantai. Proyek Perluasan 4–5 tetap di lokasi lama, lapangan timur: `LOKASI_PROYEK[3]` dan `[4]` tidak berubah. Pemain yang membayar Rp 800 jt dan Rp 3 M belum mendapat bangunannya sampai bentuk akhirnya dibangun sesudah Musim Terminal. Kekurangan itu diterima.

**Sesudah dibangun** (diterima tanpa tindakan di ronde 1):

- **Tidak terlihat di layar normal:** proyek, crane, dan kembang api Perluasan 4–5 di lapangan timur tidak terlihat di 540, 412, maupun landscape (G-3, playtest P-5).
- **Jeda kosong pada jalan pertama:** bila proyek tahap 4–5 selesai offline, ada ±6 detik tanpa perayaan yang terlihat sebelum peresmian susulan.
- **Nama gedung yang belum ada:** toast selesai dan popup offline tahap 4–5 menyebut nama kartunya, "Gedung parkir bus" dan "Terminal Terpadu", padahal gedungnya belum ada. Di popup offline 360 px, nama itu bisa terpecah ke dua baris (QA N-2).
- **Tindak lanjut:** P-5 menjadi tugas berikutnya, dan pilihannya keputusan owner.

**Pilihan yang tidak dipilih: massa sementara.** Tertutup, tanpa isi, `x 36…50,14, y 13,2…17,6`, kolong h 0…0,9, badan h 0,9…2,6 (`plester`, atap `atapKota`). Di `opsi-a-tahap4-siluet.png` massa ini menjadi benda padat terbesar di adegan, plester polos dan atap abu-abu, dan terlihat murah. Aturan risiko bagian 11.3 berkata "bila jelek, pilih kosong". Fasad dari bahan yang ada belum dicoba, jadi ini penilaian atas massa polos, bukan atas gagasannya.

**Tidak dikerjakan karena pilihan itu:**

- Massa Antarpulau dan lantai 3 di A1.
- `LOKASI_PROYEK[3]` pindah ke parkir dan `LOKASI_PROYEK[4]` pindah ke A1.
- `LORONG_PARKIR.x1` 49,2 → 39,6 (tetap 49,2).
- AC-GFX-11 dan baris massa di bagian 11.1.

**Rollback.** Tidak ada risiko baru: save tidak berubah, `versiMinimal` tidak naik. Tanda lokal diabaikan versi lama.

## 8. Bukti "denah murni visual"

**Hasil: posisi denah tidak memengaruhi simulasi, antrean ekonomi, throughput, tempo, atau save.** Arah datanya satu: sim → adegan.

### 8.1 Pagar arsitektur

| Bukti | Isi |
|---|---|
| `tests/arsitektur.test.ts:8, 12, 24-28` | Semua file `src/sim`, `src/config`, `src/app` gagal tes bila mengimpor `../game`, `../ui`, `../platform` |
| `tests/arsitektur.test.ts:36-40` | Semua file `src/game` gagal tes bila memanggil `.kirim(`, `terapkanAksi`, `tick(` |
| Pencarian seluruh `src/` di luar `src/game/` | Hanya dua impor dari adegan, keduanya **tipe**: `src/main.ts:18`, `src/platform/suara.ts:14`. Sisanya `import()` dinamis `src/main.ts:306` |
| `src/app/pengendali.ts:11-12`, `src/main.ts:307` | Adegan menerima `PembacaState`, hanya `readonly state` |

### 8.2 Jalan keluar dari adegan

| Jalan | Isi | Menyentuh ekonomi? |
|---|---|---|
| `terminal3d.ts:364, 714`, `main.ts:333` | `saatTelolet` → `analitik.catat('telolet')` | Tidak |
| `terminal3d.ts:366, 700`, `main.ts:334` | `saatKetukArea` → membuka tab Bangun | Tidak |
| `main.ts:318` | `ambilFoto` | Tidak |
| `kas-visual.ts:1-20, 43-51` | "+Rp" membaca `keuanganSekarang(state)` lalu membagikannya ke transaksi yang terlihat. Uang masuk kas lewat `tick`, bukan lewat pop ini | Tidak |
| `laju.ts:1-3, 119-164` | `hitungLajuVisual` membaca `operasiState`, hasilnya hanya animasi | Tidak |
| `ui/hadiah.ts:53`, `main.ts:214`, `state.ts:1561` | Bus Emas: penanda DOM mengirim `klaimBusEmas`, syaratnya dari state, bukan dari posisi bus | Tidak |

**Rumus kapasitas** (`src/sim/operasi.ts:119-126`): hanya jumlah unit (`bangunan.jalur`, `loket` per PO, `petakBus(perluasan)`), tanpa koordinat. **Tes tempo** (`tests/tycoon-sim.ts:9-18`): hanya mengimpor `src/config` dan `src/sim`, jadi tidak bisa terpengaruh denah. **Pemain serakah 0.4.0 di run bukti ini:** Lv 10 1,62 jam, Lv 20 5,08 jam, Lv 30 10,91 jam, sama dengan dokumen 15.

### 8.3 Yang memang saling terikat

Bukan pengaruh ke ekonomi, tapi harus dijaga waktu membangun:

| Ikatan | Akibat |
|---|---|
| `tests/jalur.test.ts:19`: `slotBangunan('jalur', 0, 1) === HALTE_DATANG_X.length` | Jangan tambah halte ke daftar ini. J6–J9 kelak daftar sendiri |
| `laju.ts:105-106`, `kehidupan-malam.ts:38-39`, `tests/perluasan-adegan.test.ts:53` memakai `X_LOKET.length` | Menambah `X_LOKET` mengubah laju keramaian dan tabel buka. Karena itu lantai 2 memakai `LOKET_L2` |
| `tata-letak.ts:33, 212`: adegan membaca `EKONOMI.jurusan` | Hanya nama kota. Arah sim → adegan |
| `economy.config.ts:572-573`: `slotTanpaAulaKedua`, `tahapAulaKedua` | Aturan ekonomi yang **namanya** menyebut aula kedua, tidak membaca denah. Letak gedung bebas |
| Jumlah "+Rp" yang muncul | Bila kelak rute berubah panjang, frekuensi transaksi visual berubah; totalnya tetap sama pendapatan (`kas-visual.ts:14-15`). Opsi A tidak mengubah rute |

**Angka ekonomi baru: tidak ada.** Semua angka di dokumen ini koordinat dan tinggi visual.

## 9. Keadaan, edge case, dan teks

### 9.1 Keadaan Sayap 2 Lantai

| Keadaan | Syarat | Tampilan |
|---|---|---|
| Lahan | `perluasan < 2`, atau `perluasan = 2` tanpa proyek | Pohon, ruko, pagar seperti sekarang |
| Proyek | `perluasan = 2`, `proyekDetik > 0` | Pagar, crane, fase bangunan |
| Berdiri | `perluasan ≥ 3`, termasuk tahap 4–5 | A1, A2, A3. Bentuk Perluasan 4–5 tidak dibangun sekarang |

### 9.2 Edge case

| Kasus | Perilaku |
|---|---|
| Offline | Level dan proyek maju seperti biasa, bangunan mengikuti saat dimuat, kembang api lewat popup offline. Di jalur resume adegan beku di balik popup sampai "Oke" (GP-1, diterima; bagian 7) |
| Kecepatan 1× / 2× / 3× | Rute putar memakai `detikPatroli`, fase memakai `proyekDetik`. Kembang api memakai `dtNyata` seperti sekarang |
| Kas nol, petugas berhenti | Tidak menyentuh bangunan. Petugas loket lantai 2 mengikuti `loketTerisi` |
| Unit dibongkar | Blok kursi, kios, dan jendela lantai 2 kembali ke keadaan belum dibangun |
| Event musiman, tantangan | Tidak berubah. `HiasanEvent` tetap di gapura |
| Tutorial | Tidak berubah: tahap 0, kamera sama. Pohon Lv 5 muncul sesudahnya |
| Malam | Bahan lama ikut `aturMalam`. Tanpa bahan baru, jadi tidak ada kompilasi ulang shader |
| Hujan | `ATAP_DAFTAR` di `hujan3d.ts:38` ditambah satu, kotaknya nol sebelum tahap 3 |
| Foto, mode sinema | Tidak berubah |
| Label zona | Tetap. Label LOKET di aula |

### 9.3 Teks

| Tempat | Teks |
|---|---|
| Kartu Perluasan 3 | `Sayap 2 lantai` · deskripsi di bagian 4.5 |
| Toast selesai (pola lama) | `🏗️ Perluasan 3 selesai: Sayap 2 lantai!` |
| Toast peresmian susulan | `🎉 Perluasan 3 kini punya gedung: Sayap 2 lantai!` |
| Popup offline, proyek selesai | `🏗️ Perluasan ${tahap} selesai selama kamu pergi: ${nama}!`, nama dari `NAMA_PERLUASAN`. Tahap 3: `🏗️ Perluasan 3 selesai selama kamu pergi: Sayap 2 lantai!` |
| Papan 3D | `LANTAI 2`, `FOOD COURT`, `NASI & SOTO`, `KOPI & ES` |
| Catatan rilis 0.4.1 (dirilis 5 Nov 2026, `src/config/rilis.config.ts`) | `Perluasan 3 kini membangun gedung sungguhan: Sayap 2 lantai di sisi barat terminal.` · `Jendela loket, kursi, dan kios tambahan yang kamu bangun muncul di dalamnya.` · `Yang sudah melewati Perluasan 3 mendapat peresmian susulan, sekali saja.` |
| Catatan rilis ronde 2 (0.5.0, brief ronde 2 AC-PLT-01) | `Terminal dan kota di seberangnya kini berubah sedikit demi sedikit saat naik level.` |

**Diperbarui sesudah playtest (P-1, P-2; ronde perbaikan 1, tanpa APPROVE karena hanya teks):**

- **Nama tanpa terpotong.** Di kode, "Sayap 2 lantai" memakai spasi tak terputus (`Sayap 2 lantai`) di `NAMA_PERLUASAN`, jadi kartu, toast selesai, toast susulan, dan popup offline tidak pernah memotong nama di 360 px.
- **Toast susulan diganti.** Teks rancangan awal `🎉 Sayap 2 lantai sudah berdiri: loket, kursi, dan food court kini terlihat` diganti, karena:
  - tidak menyebut Perluasan 3, yang dulu dibayar pemain;
  - menjanjikan kursi dan food court yang belum tentu ada di save pemain;
  - terlalu panjang untuk 3,5 detik. Teks baru ±48 karakter dan benar untuk semua save.
- **Popup offline kini menyebut gedungnya.** Sesudah "Oke", kembang api meledak di atas gedung itu (bagian 7). Tahap di luar `NAMA_PERLUASAN` ditulis tanpa nama.
- **Catatan rilis.** Rancangan awal hanya punya satu butir untuk ronde 1: `Perluasan 3 kini punya gedung sungguhan: Sayap 2 lantai dengan loket, ruang tunggu, dan food court.` Yang dirilis di 0.4.1 adalah tiga butir di tabel di atas.

Toast naik level tidak berubah. Sudah padat di Lv 11–30 (dokumen 15 bagian 10), jadi benda baru tidak diberi toast sendiri.

## 10. Antarmuka dan kriteria penerimaan (untuk brief bangun)

### 10.1 Antarmuka

**Konstanta baru di `src/game/tata-letak.ts`** (konstanta lama tidak berubah): `SAYAP_DUA` (persegi A1, A2a, A2b, A3), `H_LANTAI_2`, `H_DINDING_L2`, `H_PUNCAK_L2`, `LOKET_L2`, `BLOK_KURSI_L2`, `KIOS_TERAS`, `MEJA_L2`, `MEJA_TERAS`, `PAPAN_L2`.

**Modul murni baru `src/game/bentuk-adegan.ts`** (masuk `GAME_MURNI`):

```ts
export function keadaanSayap(perluasan: number, proyekDetik: number): 'lahan' | 'proyek' | 'berdiri';
export function faseProyekSayap(proyekDetik: number, detikProyek: number): 0 | 1 | 2;
export function isiLantai2(b: JumlahBangunan, loketTerisi: number, jam: number): { jendela: number; disewa: number; buka: readonly number[]; blokKursi: readonly boolean[]; kios: number };
export function hiasanLevel(level: number, perluasan: number): HiasanLevel; // ronde kedua: pohon, kanopi, baliho, gedungKota, pohonAtap, menara, monumen
export function posisiPengunjung(i: number, t: number): { x: number; y: number; h: number; duduk: boolean };
export function perluPeresmianSusulan(perluasan: number, sudah: boolean): boolean; // dibangun di src/app/peresmian-bentuk.ts, bukan di sini
```

**Seperti dibangun (4 November 2026):**

- **Helper peresmian:** `perluPeresmianSusulan` ada di `src/app/peresmian-bentuk.ts`, milik gameplay, bersama `AntreanPerayaan`, `TAHAP_SAYAP_2_LANTAI`, dan `JEDA_PERAYAAN_DETIK` (bagian 7). Ini keputusan brief bagian 5, supaya `main.ts` tidak mengimpor dari adegan.
- **Belum ada di ronde 1:** `hiasanLevel`, karena milik ronde 2. Antarmuka ronde 2 yang berlaku ada di brief `docs/tasks/20261105-bentuk-terminal-ronde-2.md` bagian 5 dan menggantikan tanda tangan di atas:
  - modul murni baru di `GAME_MURNI` (Panji memilih nama, usul `src/game/hiasan-level.ts`): `HIASAN_LEVEL`, `hiasanLevel(level, perluasan)`, `hiasanBaru(levelLalu, levelSekarang, perluasan)` yang kosong saat muat dan saat lompatan offline, dan `poBaliho(daftar)`;
  - `tata-letak.ts` hanya menambah `GEDUNG_KOTA_NAIK` dan `CADANGAN_SEBERANG = { x0: 24.8, y0: -5.0, x1: 39.0, y1: -1.2 }`;
  - tanpa state, aksi, save, atau analitik baru.
- **`bentuk-adegan.ts` menambah, tanpa mengubah arti:**
  - `isiLantai2` juga mengembalikan `kiosBuka`;
  - `posisiPengunjung` juga mengembalikan `hadap` dan bisa memakai ulang objek hasil;
  - ekspor baru: `TAHAP_SAYAP`, `keadaanJendelaL2`, `jumlahPengunjung`, `MAKS_PENGUNJUNG`, `pengunjungDiTeras`.
- **`tata-letak.ts` menambah:** `ATAP_SAYAP2`, `TANGGA_L2`, `tinggiTanggaL2`, `diSayapDua`, `MEJA_DASAR`.
- **Sambungan adegan:** `Terminal3D.rayakanPerluasan(tahap)` publik, dipanggil dari `main.ts` untuk kembang api popup offline dan peresmian susulan.

**Dibaca dari state** (tidak ada field baru): `perkembangan.perluasan`, `perkembangan.proyekDetik`, `terminal.bangunan`, `levelTerminal(state)`, `loketTerisi(state)`. **Aksi baru:** tidak ada. **Save:** tetap skema 3, `versiMinimal` tidak naik. **Analitik:** tidak ada peristiwa baru. **Kebijakan privasi:** tidak berubah. **Bahan baru:** tidak ada.

**File per area:**

| Agent | File |
|---|---|
| Panji | `src/game/`: `tata-letak.ts`, `bentuk-adegan.ts` (baru), `sayap3d.ts` tetap untuk sayap barat, `sayap2-3d.ts` (baru), `geometri.ts` (`Kumpulan`), `perluasan-adegan.ts`, `proyek3d.ts`, `terminal3d.ts`, `lingkungan3d.ts`, `sekitar3d.ts`, `hujan3d.ts`; `tests/arsitektur.test.ts`. Ronde kedua: `hiasan-level3d.ts` (baru) |
| Raka | `src/ui/teks.ts`, toast peresmian di `src/ui/notifikasi.ts`, sambungan popup offline |
| Dodi | Tidak ada di ronde bangun. `src/config/rilis.config.ts` dan AC-PLT-01 dikerjakan saat rilis |
| Satu agen, dipilih brief | `src/main.ts` (tanda lokal, `t.rayakanPerluasan`), `README.md` |
| Citra | Dokumen 12, 13, 16 sesudah dibangun |

### 10.2 Kriteria penerimaan

**Yang dipakai QA adalah versi brief** (`docs/tasks/20261103-bentuk-terminal.md` bagian 6, repo tim). Di sana AC-GFX-10 dibagi (gedung ≤ 16 draw call, hiasan ≤ 9), AC-GFX-11 dibatalkan, dan AC-PLT-02 masuk AC-GP-02.

**Hasil ronde 1** (`docs/reviews/20261103-bentuk-terminal-*.md`):

- **Lulus:** AC-GP-01 sampai 04, dan semua AC-GFX kecuali yang di bawah.
- **AC-GFX-12** tidak terpenuhi di 412 (G-1). Owner menerimanya (bagian 4.3).
- **AC-GFX-10:** hasil di bagian 11.4.
- **AC-PLT-01** selesai saat rilis 0.4.1 (catatan rilis di bagian 9.3; `versiMinimal` tetap 0.4.0).
- **AC-GFX-08 (ronde 2)** sedang dibangun. Teks yang dipakai QA adalah versi brief `docs/tasks/20261105-bentuk-terminal-ronde-2.md` bagian 6: AC-GFX-08 dengan tabel ronde 2 (Lv 16 di K13), ditambah AC-GFX-13 sampai 20 (ukuran dan tutup, lahan seberang, baliho, P-3, P-4, P-7, beban, keadaan), AC-GP-05, dan AC-PLT-01 ronde 2.

**Gameplay & UI**

- **AC-GP-01:** nama dan deskripsi kartu sesuai 4.5, tidak melebihi tinggi kartu di 540×960 dan 900×420.
- **AC-GP-02:** peresmian susulan sekali per perangkat: tahap ≥ 3 menayangkan, tahap < 3 tidak, jalan kedua tidak (tes `perluPeresmianSusulan`).
- **AC-GP-03:** menutup popup offline yang memuat `proyek.selesai` memicu kembang api tahap itu; popup tanpa itu tidak.
- **AC-GP-04:** `tests/tycoon-tempo.test.ts`, `tests/tycoon-kasual.test.ts`, `tests/save.test.ts` lulus tanpa perubahan.

**Grafis & audio**

- **AC-GFX-01:** A1, A2, A3 sesuai koordinat 3.1, tampil hanya bila `keadaanSayap = 'berdiri'`.
- **AC-GFX-02:** semua konstanta denah lama tidak berubah (diff `tata-letak.ts` hanya menambah). `tests/tata-letak.test.ts`, `tests/jalur.test.ts`, `tests/dunia-visual.test.ts`, `tests/singgah.test.ts` lulus tanpa diubah.
- **AC-GFX-03:** tes baru: A1, A2, A3 tidak beririsan dengan `X_JALUR_KAKI ± 0,34`, `PANGKALAN`, `SAYAP_BARAT`, tiang bendera, slot luapan terakhir.
- **AC-GFX-04:** jendela 9–24, blok kursi 5–8, kios 3–4 mengikuti tabel keadaan bagian 5, siang dan malam.
- **AC-GFX-05:** kamera normal: A1 ≥ 95 % di layar 540×590 dan 100 % di 412, 360, landscape. `tests/kamera.test.ts` lulus tanpa diubah.
- **AC-GFX-06:** semua benda inti bagian 1.3: 0 % tertutup pada kamera normal, diperiksa dari screenshot dan sinar kamera ke mesh dengan koordinat akhir. Musholla & wudhu ≤ 11 %.
- **AC-GFX-07:** proyek sesuai 4.4, tiga fase. Hanya `LOKASI_PROYEK[2]` yang berubah; `[3]` dan `[4]` tetap. `tests/perluasan-adegan.test.ts` lulus.
- **AC-GFX-08 (ronde kedua, bila beban muat):** 12 hiasan level muncul tepat di levelnya, benar saat dimuat di level tinggi, dengan kembang api hanya saat naik satu level di sesi aktif.
- **AC-GFX-09:** pengunjung terlihat naik dan turun di A3, tinggi halus, tidak menembus pelat, tidak terhitung di `DuniaVisual`.
- **AC-GFX-10:** frame rate bagian 11.4. Draw call tahap 0–2 sama dengan sebelum perubahan, tahap 3 naik ≤ 25 di landscape tingkat 1 terhadap patokan pada save yang sama. Dilaporkan beserta derau.
- **AC-GFX-11: tidak dikerjakan.** Massa sementara tidak dipilih (bagian 7). `LORONG_PARKIR.x1` tetap 49,2.
- **AC-GFX-12:** papan `LANTAI 2` sesuai 3.1, tidak tertutup, tebal ≥ 6 px di 360 dan landscape, terbaca di 540 dan 412 (dilihat dari screenshot). Papan di ujung selatan A1 tidak dibangun.

**Platform**

- **AC-PLT-01 (saat rilis, bukan di ronde bangun):** catatan rilis sesuai 9.3, muat di popup 0.4.0 pada 900×420. `versiMinimal` tetap 0.4.0.
- **AC-PLT-02:** tanda lokal tidak ikut save dan cloud save (tes save dan akun lulus tanpa diubah). Ingatkan `npm run cap:sync` sebelum APK berikutnya.

## 11. Risiko, besar pekerjaan, tes, frame rate

### 11.1 Besar pekerjaan

Perkiraan dokumen 12 bagian 8.4 ("Sedang–besar" untuk tahap 3) mengandaikan orang naik sungguhan dan atap aula diganti. Keduanya tidak ada di Opsi A.

| Area | A | B | C |
|---|---|---|---|
| **Panji** | **Sedang–besar** | Sedang–besar | Sedang–besar, kurang terhitung: sambungan sayap barat, tiang selasar, kaca dinding barat aula (bagian 3.3) |
| **Raka** | **Kecil**: teks, toast, popup offline | Kecil | Kecil, tanpa ganti nama kartu |
| **Dodi** | **Kecil**, saat rilis: catatan rilis | Kecil | Kecil |
| **Nisa** | **Sedang**: tahap 3 dan 4–5 × dua layar × siang/malam/hujan, frame rate, soak saat rilis | Sedang + rute parkir | Sedang + cek benda tertutup |

**Rincian Panji, Opsi A:**

| Pekerjaan | Besar | Ronde |
|---|---|---|
| Konstanta, `bentuk-adegan.ts`, tes denah | Kecil | 1 |
| Model A1, A2, A3, papan `LANTAI 2` | Sedang | 1 |
| Rentang geometri lahan di `Kumpulan` (`setDrawRange`) untuk pohon, ruko, pagar. Menyentuh semua yang lewat mesh gabungan utama | Kecil–sedang | 1 |
| **Penurunan draw call ke ≤ 25** (mock-up tanpa optimasi +41–44). Termasuk 16 rolling door yang tidak bisa satu grup per pintu, dan kursi, loket, kios dengan keadaan. Cara yang disarankan di bagian 11.4 | Sedang | 1 |
| Proyek: `LOKASI_PROYEK[2]` dan tiga fase | Kecil | 1 |
| Loket, kursi, kios lantai 2 dengan keadaan | Kecil–sedang | 1 |
| Orang statis dan rute putar tiga dimensi | Kecil–sedang | 1 |
| Hujan: `ATAP_DAFTAR` | Kecil | 1 |
| 12 hiasan level dan kembang api kecil, bila beban muat | Sedang | 2 |
| Massa sementara tahap 4–5 | Tidak dikerjakan (bagian 7) | |

Ronde 1 sudah menepati janji kartu Perluasan 3 dan memecah siluet.

### 11.2 Tes yang kena

| Tes | A | B | C |
|---|---|---|---|
| `tests/tata-letak.test.ts` | Tidak berubah, ditambah blok baru | `LORONG_PARKIR`, rute: dicek ulang | Tidak berubah |
| `tests/jalur.test.ts` | Tidak berubah | Tidak berubah | Tidak berubah sampai J6 |
| `tests/perluasan-adegan.test.ts` | `LOKASI_PROYEK` baru, aturan lama tetap | Sama | Sama |
| `tests/dunia-visual.test.ts` | Tidak berubah | Baris 208 (`LORONG_PARKIR`) dijalankan ulang | Tidak berubah |
| `tests/kamera.test.ts` | Tidak berubah | Tidak berubah | Berubah di Perluasan 4 |
| `tests/arsitektur.test.ts` | Tambah `bentuk-adegan.ts` ke `GAME_MURNI` | Sama | Sama |
| Baru | `tests/bentuk-adegan.test.ts` | Sama | Sama |

### 11.3 Risiko

| Risiko | Mitigasi |
|---|---|
| Bangunan di kiri layar tidak disadari. Model 3D: di 360 dan landscape terbaca sebagai gumpalan | Kembang api, toast, papan, tangga berwarna; diuji di playtest. **Playtest Citra di build:** di 540 dan landscape gedungnya jelas baru; di 412 dan 360 kecil dan kabur oleh tilt-shift (P-8). Kembang api kuat di malam hari, lemah di siang hari (P-3, perbaikannya disetujui untuk ronde 2, bagian 6), jadi maknanya dibawa toast dan munculnya gedung. Tetap NOT ASSESSED sampai playtest 5 orang |
| Massa sementara terlihat murah | Sudah terjadi di `opsi-a-tahap4-siluet.png`, jadi dipilih "kosong" (bagian 7). Fasad dari bahan yang ada belum dicoba |
| Tahap 4–5 tetap tanpa bangunan sampai sesudah Musim Terminal | Diterima owner. Kartu Perluasan 4–5 tidak diubah; janjinya ditepati saat bentuknya dibangun |
| Draw call melampaui batas (mock-up +41–44, batas 25) | Bagian 11.4. Bila tidak tercapai, kurangi isi dan lapor; ronde kedua tidak dimulai. **Tidak terjadi:** ronde 1 menambah +3 draw call (bagian 11.4) |
| Gedung kota tidak disadari | NOT ASSESSED. Paling murah untuk dihapus sesudah playtest |
| "Sayap barat" dan "Sayap 2 lantai" tertukar | Pemain hanya melihat yang kedua. Dokumen memakai kedua nama dengan tegas |
| Kaca berlapis menambah beban GPU | Bagian 11.4; atap A1 dan A2 pakai bahan lama |
| Halte J6–J9 dan dek parkir bus (Perluasan 4) | Hanya tempatnya yang dipastikan. Rutenya butuh rancangan sendiri |

### 11.4 Frame rate

**Patokan diukur di 0.4.0** (dev server, tahap 3, Lv 15, 5 jalur, 16 jendela; satu run, CPU diperlambat 4×, mesin ini; hanya pembanding, bukan HP):

| Layar | Tingkat | Draw call | Segitiga | fps |
|---|---|---|---|---|
| 900×420 | 1 | 227 | 290 rb | 6 |
| 900×420 | 3 | 214 | 287 rb | 23 |
| 540×960 | 3 | 134 | 153 rb | 46 |

Anggaran skill (±210 draw call, ±450 rb segitiga, tingkat 1) sudah terlewati di landscape. **Jadi tambahannya harus kecil.**

**Patokan di model 3D Panji** (landscape tingkat 1, save bagian 3.6, jam 12). Hanya pembanding dari mock-up tanpa optimasi, tanpa orang, rolling door, fase proyek, dan hiasan level. Derau antar-pengukuran ±9, jadi selisih kecil tidak bermakna:

| Keadaan | Draw call | Selisih |
|---|---|---|
| Sekarang | 244–247 | |
| Opsi A | 288–291 | +41–44 |
| Opsi B | 274–278 | |
| Opsi C | 271–274 | |
| Opsi A tahap 4, dengan massa (tidak dipilih) | 290–293 | |

Segitiga Opsi A naik ±11–16 rb (341–342 rb → 352–358 rb), jadi yang menekan adalah draw call, bukan segitiga. Patokan ini lebih tinggi dari tabel di atas karena savenya lebih banyak unit.

**Batas untuk Opsi A:**

- Tahap 0–2: draw call tidak naik (lahan memakai `setDrawRange`). Bangunan baru dibangun saat pertama dibutuhkan, seperti `ProyekPerluasan` (`proyek3d.ts:108-130`).
- Tahap 3+, gedung dan semua hiasan level: naik ≤ 25 draw call, ≤ 25 rb segitiga di landscape tingkat 1, terhadap patokan "sekarang" pada save yang sama.
- fps tingkat 3, throttle 4×: tidak turun lebih dari 10 % (landscape ≥ 21, portrait ≥ 41).
- `Terminal3D` tidak boleh mengalokasi per frame; `InstancedMesh` untuk orang dan gedung kota.
- **Syarat ronde kedua:** gedung sudah lulus QA dan sisa batas cukup untuk hiasan. Pembagian yang disarankan, belum diukur: gedung ≤ 16, hiasan ≤ 9. Bila tidak muat, yang pertama dikurangi adalah meja teras dan ruang lantai dasar, lalu hiasan yang paling mahal per draw call, dan Sapto melapor ke owner.

**Cara menurunkan yang disarankan, belum dicoba** (Panji yang memutuskan caranya, batasnya tetap):

- **Cangkang statis masuk mesh gabungan utama.** Hampir semua bahan A1–A3 sudah ada di `Kumpulan` utama, jadi cangkangnya bisa menambah 0 draw call. Susun tiap mesh per bahan `[lahan][dasar][sayap]`, lalu `setDrawRange`: awal lahan sampai akhir dasar sebelum proyek, dasar saja selama proyek, awal dasar sampai akhir sayap sesudah berdiri. Satu rentang bersambung cukup untuk ketiga keadaan. Bangunan fase proyek boleh grup sementara.
- **Bayangan dimatikan untuk isi.** Tiap mesh yang melempar bayangan terhitung dua kali. Kursi, meja, panel loket, dan rangka lantai 2 cukup `bayangan: false`.
- **Rolling door:** satu `InstancedMesh` untuk pintu dan satu untuk tulisan `TUTUP`, ≤ 2 draw call untuk 16 pintu dan 2 kios. Pola `RollingDoor` sekarang berarti 32 draw call.
- **Kursi dan meja loket:** satu mesh per bahan dengan urutan pasang, dipotong `setDrawRange` atau `count`.
- **Warna payung:** satu `InstancedMesh` dengan `instanceColor`, bukan 6 bahan.

**Hasil ronde 1** (QA grafis `docs/reviews/20261103-bentuk-terminal-graphics.md` dan `-r2.md`, repo tim; landscape 900×420, jam 12, dibandingkan dengan patokan `8d9520b` yang diukur ulang pada sesi yang sama):

| Ukuran | Batas (brief) | Hasil | Putusan |
|---|---|---|---|
| Draw call tahap 0–2, tingkat 1 | Tidak naik | Selisih −4 … +1, dalam derau | PASS |
| Draw call tahap 3, tingkat 1, `SAVE=5,16,3,25` | ≤ +16 (gedung) | Median 238 → 241 dan 236 → 242, **+3 … +6** (dua putaran). Cek ulang sesudah perbaikan G-4: 241–242 | PASS |
| Tahap 3 penuh (24 jendela disewa, 8 kursi, 4 toko), tingkat 1 | ≤ +16 draw call, ≤ +25 rb segitiga | 243 → 246, **+3**; 307,1 rb → 320,2 rb, **+13,1 rb** | PASS |
| Tahap 4–5, tingkat 1 | | +3 … +9 (+9 hanya di satu median berisik). Sayapnya sama | |
| fps tahap 3, tingkat 3, throttle 4×, `SAVE=5,24,3,25`, 5 putaran bergantian | Turun ≤ 10 % | Patokan median 15,35 fps (10,44–18,71), tree 18,77 fps (16,67–21,70). **Tidak turun** | PASS |
| fps portrait 540×960 tahap 3 dan landscape tahap 0 | | Derau jauh di atas 10 % | NOT ASSESSED; AC hanya menyebut landscape |

Pengukuran Panji sendiri: +2 draw call, +9–11 rb segitiga, dalam derau yang sama.

**Yang perlu diingat untuk ronde 2:**

- **Angka mutlak fps di atas (≥ 21 landscape, ≥ 41 portrait) tidak dipakai.** fps mesin ini bergeser antar-sesi: patokan yang diukur ulang 15,35 fps, bukan 23. Perbandingan hanya sah dalam satu sesi, bergantian dengan patokan, dan tiap jalan diverifikasi dengan screenshot serta log draw call.
- **Anggaran skill tetap terlewati.** Landscape tingkat 1 kini 241–246 draw call, terhadap ±210. Ini sudah terlewati sejak 0.4.0.
- **Sisa batas gabungan** (25 draw call dan 25 rb segitiga): ronde 1 memakai +3 … +6 draw call dan +13,1 rb segitiga. Sisanya paling sedikit 19 draw call, tapi hanya 11,9 rb segitiga. Bagian hiasan dari brief tetap ≤ 9 draw call. Untuk ronde 2, segitiga kini batas yang lebih sempit.

**Hasil ronde 2.** Sumber: QA grafis `docs/reviews/20261105-bentuk-terminal-ronde-2-graphics.md` pada salinan tree 10.28. Patokan 0.4.1 (f677391) diukur bergantian dengan tree. Landscape 900×420, tingkat 1, jam 12, median per sampel 90 frame.

| Kasus | Batas (brief AC-GFX-19) | Patokan → tree | Putusan |
|---|---|---|---|
| Tahap 2 Lv 13, draw call | ≤ +2 | 248 → 250, **+2**, tepat di batas | PASS, tanpa ruang sisa |
| Tahap 2 Lv 13, segitiga | ≤ +3,5 rb | 309,9 rb → 312,1 rb, +2,2 rb (hitung pasti Panji +2,54 rb) | PASS |
| Tahap 3 Lv 35, draw call | ≤ +6 | 246 → 249, +3 (Panji: 246 → 248, +2) | PASS |
| Tahap 3 Lv 35, segitiga | ≤ +8 rb | 347,7 rb → 349,3 rb, +1,6 rb (hitung pasti Panji +4,87 rb) | PASS |
| Lv 4 tahap 1, 900×420 dan 540×960 | tidak berubah | 248 = 248, 243 = 243 | PASS |
| fps tingkat 3, throttle 4× | turun ≤ 10 % | tidak diukur | **NOT ASSESSED**; diukur Nisa di mesin sepi sesudah integrasi |

- **Selisih segitiga dua metode.** Hitungan dari kait WebGL hanya menghitung yang tergambar per frame. Hitungan pasti Panji menghitung semua mesh. Keduanya di bawah batas.
- **Sesudah Musim Terminal.** Spanduk musim menambah +2 draw call saat dipakai di tahap 3 Lv 35. Seragam dan papan +0. Di minggu event, draw call sama dengan tanpa hiasan musim (dokumen 17 bagian 4.2).
- **Sisa untuk tugas berikutnya:**
  - **Tahap 0–2: tidak ada.** Tambahan harus memotong atau menggabung mesh dulu.
  - **Tahap 3+:** dari batas gabungan 25 draw call, ronde 1 memakai +3…+6 dan ronde 2 +2…+3, lalu spanduk musim +2 saat dipakai. Segitiga ronde 2 +1,6…4,9 rb dari sisa ±11,9 rb.
  - Anggaran skill (±210) tetap terlewati di landscape tingkat 1.

**Tetap NOT ASSESSED:** HP Android sungguhan, yaitu tingkat grafis yang dipilih otomatis, apakah tilt-shift aktif di sana, dan fps. Belum ada AVD, dan belum ada uji HP di 0.4.0.

## 12. Keputusan owner

**APPROVE owner, Telegram, 2026-11-03 (disampaikan Sapto): kelima saran.**

| # | Keputusan | Pilihan owner | Akibat untuk pembangunan |
|---|---|---|---|
| 1 | Opsi denah | **Opsi A · U Plaza** | Dibangun: A1, A2, A3 di Perluasan 3. Opsi B dan C tidak dikerjakan |
| 2 | Letak Gedung Antarpulau | **Di belakang ruang tunggu**, bukan melebar ke timur, **hanya cadangan tempat** | Tidak ada bangunan. Rencana dokumen 12 bagian 8 diganti dokumen ini |
| 3 | Tahap 4–5 selama bentuk akhir belum ada | **Kosong:** Sayap 2 Lantai saja, proyek Perluasan 4–5 tetap di lokasi lama | Massa sementara tidak dipilih dan tidak dikerjakan (bagian 7) |
| 4 | Peresmian susulan untuk pemain lama | **Ya**, sekali per perangkat, memakai tanda lokal | AC-GP-02, AC-PLT-02 |
| 5 | Perubahan kecil per level | **12 benda di ronde kedua**, sesudah gedung lulus QA, **hanya kalau beban gambar masih muat** | AC-GFX-08, syarat di bagian 11.4. Gedung kota paling mudah dicabut bila tidak disadari di playtest |

**Keputusan sesudahnya:**

| Tanggal | Keputusan | Oleh |
|---|---|---|
| 3 Nov 2026 | Kembang api untuk proyek yang selesai offline, sesudah popup offline ditutup (AC-GP-03). Bukan bagian dari lima saran, jadi ditanyakan terpisah ("offline ya") | Owner, Telegram |
| 4 Nov 2026 | Papan `LANTAI 2` yang tidak terbaca di 412 karena tilt-shift diterima apa adanya. Tilt-shift tidak diubah (G-1) | Owner, terminal |
| 4 Nov 2026 | Teks toast susulan dan popup offline diganti (P-1, P-2). Owner cukup diberi tahu, karena hanya teks | Sapto |
| 4 Nov 2026 | Adegan beku di balik popup offline di jalur resume diterima apa adanya (GP-1) | Sapto |
| 4 Nov 2026 | Diterima tanpa tindakan: fase 1 dan 2 proyek sulit dibedakan di portrait (G-2); kembang api tahap 4–5 tidak terlihat di portrait (G-3) | Dicatat di brief bagian 9 bersama keputusan G-1 |
| 3–4 Nov 2026 | Helper peresmian pindah ke `src/app/peresmian-bentuk.ts`; tanda tahap ≥ 3 ditulis saat tayang; jalur resume memakai perayaan adegan sendiri | Sapto |
| 5 Nov 2026 | Ronde 1 dirilis sebagai 0.4.1 | Owner (deploy) |
| 5 Nov 2026 | Ronde 2 disetujui: 12 hiasan versi ronde 2 ditambah P-3, P-4, P-7; lahan seberang K14–K17 dicadangkan (`CADANGAN_SEBERANG`) dan gedung Lv 16 pindah ke K13; gedung Lv 23 dan Lv 26 di pita kabur diterima (bagian 6, ADR 008) | Owner, terminal ("APPROVE semua") |
| 5 Nov 2026 | Tahap 0–2 boleh naik +2 draw call sejak Lv 5, karena gabungan dua ronde paling banyak +9 dari batas 25 (ADR 008) | Sapto |
| 5 Nov 2026 | Ronde 2 dibangun. Diterima: palet P-3 untuk semua kembang api peresmian; tahap 0–2 tepat di batas +2, jadi tambahan berikutnya harus memotong atau menggabung mesh; kembang api kecil dilewati pada frame > ±2 dtk; pohon atap Lv 24 1,35–2,68; kilatan tidak dibuat (bagian 6, "Dibangun") | Sapto |
| 5 Nov 2026 | QA grafis ronde 2: G-1 (kembang api siang samar di 412) diterima; G-2, G-3, G-4 catatan; G-5 alat uji | Sapto |

## Belum diperiksa

Diperbarui sesudah ronde 1 (4 November 2026). **Sudah diperiksa di build:**

- **Gambar:** gedung, orang, fase proyek, dan rolling door dilihat di build (QA grafis, playtest Citra). Gambar mock-up di bagian 3 tetap pembanding dari sebelum keputusan.
- **Papan `LANTAI 2`:** dilihat. Terbaca di 540, kabur di 412 (G-1, diterima), pita biru di 360 dan landscape (bagian 4.3).
- **Malam dan hujan:** dilihat, tanpa masalah.
- **Tes:** integrasi Sapto: typecheck 0, Vitest 64 berkas 913/913, build 0. Tes tempo, kasual, dan save lulus tanpa diubah (AC-GP-04).

**Masih belum diperiksa:**

- **fps:** hanya landscape tahap 3 yang diukur (bagian 11.4). Portrait, tahap 0, dan HP sungguhan belum.
- **Ronde 2 (5 November 2026):**
  - fps tingkat 3 dengan throttle 4× (AC-GFX-19) belum diukur.
  - Tutorial baru dan kecepatan 2× belum dimainkan; QA memakai 1× dan 3×.
  - Baliho PO ke-2 hanya dilihat lewat screenshot.
  - Semuanya dibawa ke QA grafis tree gabungan.
- Musholla 11 % dan benda tutup lainnya diukur dengan titik sampel `sim/tutup.ts`, bukan seluruh benda.
- **Apakah pemain menyadari tiap perubahan:** butuh playtest 5 orang.
- **Kecepatan dan kamera:** 2× dan 3×, satu proyek penuh 24 menit di 1×, dan kamera yang diputar bebas belum dimainkan (playtest Citra, NOT ASSESSED).
- Rute bus J6–J9 dan dek parkir bus (Perluasan 4–5): hanya tempatnya.
- Semua yang termasuk ronde 2 (bagian 6): sedang dibangun, diperiksa QA ronde 2. Angka beban di bagian 6 masih perkiraan sampai Panji mengukurnya (AC-GFX-19).
