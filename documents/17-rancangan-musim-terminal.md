# 17 · Rancangan Musim Terminal: tugas harian, Rapor Musim, hiasan terminal

> **Status: disetujui owner 5 November 2026, dibangun 5 November 2026. Gameplay lulus QA dengan catatan; grafis Musim AC-GFX-01..06 PASS menurut Panji. Belum di-commit dan belum dirilis (rilis 0.5.0).**
>
> - QA dan playtest: `docs/reviews/20261104-musim-terminal-gameplay.md` dan `-gameplay-r2.md` (PASS WITH NOTES), playtest Citra `docs/design/20261104-musim-terminal-playtest.md`. Ronde perbaikan 1 menambah AC-GP-16..22 (bagian 11).
> - **Diselaraskan dengan kode pada 5 November 2026 (fase 5).** Bagian yang berubah dan alasannya:
>   - **3.2:** aturan kepuasan, laba, dan tuas (playtest P-1, P-2, P-3, P-5, P-6, P-9).
>   - **4.2:** tema hiasan Imlek dan Mudik serta beban terukur.
>   - **5 dan 7.1:** lencana tab, urutan kartu tab Target, waktu sambutan (P-4, P-7, P-8).
>   - **7.2 dan 9.1:** penjepitan save (GP-2, GP-3).
>   - **8:** teks Surat Armada dan rapor (GP-1, P-12).
>   - **10:** antarmuka sesudah dibangun.
>   - **11:** AC-GP-16..22.
>   - **12:** daftar ronde berikutnya.
>   - Angka config, poin, tingkat, hadiah, tempo, dan field save **tidak berubah**. Bagian 13 tetap hasil simulasi rancangan; harness di atas kode asli memberi tingkat yang sama (bagian 11, AC-GP-14).
>
> Owner membalas "APPROVE semua" (terminal) untuk kelima keputusan di bagian 15 dan kedua asumsi di Ringkasan (ADR 009): **Musim 1, Musim Hujan, mulai Senin 30 November 2026**, dan Musim **terbuka di Lv 6** sesudah tutorial. Tahap 1 peta jalan ADR 004. Ronde 1 dirilis bersama ronde 2 bentuk terminal (dokumen 16 bagian 6, ADR 008). Brief `docs/tasks/20261104-musim-terminal.md`; bila dokumen ini dan brief berbeda, brief yang berlaku. Dasar: ADR 004, kajian `docs/design/20261029-arah-jangka-panjang.md` (Opsi 1), evaluasi `docs/design/20261029-evaluasi-keseruan.md`.
>
> **Asal berkas.** Ditulis sebagai draf di `docs/design/20261104-musim-terminal/` selama rilis 0.4.1 berjalan, karena tree game harus bersih sampai deploy, lalu dipindahkan ke sini apa adanya sesudah deploy 0.4.1 (5 November 2026). Harness tetap di folder itu: rujukan `sim/…` di dokumen ini berarti `docs/design/20261104-musim-terminal/sim/` (`musim-sim.ts`, `ukur-musim.mjs`). Semuanya di repo tim, tidak ikut repo game.
>
> **Selisih dengan draf saat dipindah, disengaja** (sebelum penyelarasan fase 5 di atas). Isi, angka, AC, dan antarmuka bagian 10 tidak berubah. Yang berbeda hanya kepala ini dan satu baris di bagian 9.2: dimensi GA4 `item` dan `pakai` ditambahkan ke daftar untuk owner, karena `hiasan_pakai` memang mengirim keduanya (koreksi Dodi, 5 November 2026). Tidak ada peristiwa atau parameter baru. **Catatan baca:** bagian 2 dan 15 menyebut "5 peristiwa", tetapi tabel 9.2 memuat enam. Yang berlaku enam (ADR 009, brief bagian 5).
>
> **Dibandingkan dengan kode `tycoon` 93536c5** (0.4.0 + Sayap 2 Lantai). Rilis 0.4.1 (f677391) hanya mengubah versi dan catatan rilis, jadi perbandingan ini juga berlaku untuk 0.4.1. Bila dokumen dan kode berbeda, kode yang benar. Perbedaan yang ditemukan ada di bagian 2.
>
> **Keputusan berdiri yang tidak berubah:** tanpa reset dan tanpa prestige; offline hanya dengan Manajer Operasional (8 jam, 60 %); iklan berhadiah selalu opt-in dan tidak mengunci fitur gratis; save lokal tetap utama; papan peringkat tanpa hadiah gameplay; nama terminal tidak pernah ke analitik. **Keputusan owner** ada di bagian 15. Tabel itu, pertanyaan di Ringkasan, dan daftar CHANGE REQUEST di bagian 14 dibiarkan seperti saat diajukan, sebagai catatan; semuanya sudah dijawab di atas.

## Ringkasan

1. **Masalah:** sesudah Terpadu tidak ada tujuan yang terbarui. Pemain kasual dengan Manajer sampai Terpadu di hari nyata ke-2–3, dan 94–96 % XP-nya datang dari offline. Sesi berisi keputusan di hari 8–14 tinggal 10–14 %.
2. **Musim 6 minggu**, dari kalender di config dan kunci hari WIB. Tanpa server, sama untuk semua pemain. Musim 1, **Musim Hujan**, mulai Senin 30 November 2026 (atau Senin minggu rilis).
3. **Tiga tugas harian** dari tiga kelompok: *main* (cukup bermain), *sorotan* (kota, PO, kelas bus, kios, parkir, kepuasan), dan *kelola* (satu keputusan: bangun, daftarkan PO, perbaiki satu komponen kepuasan). Tugas hanya maju saat main aktif, jadi tidak bisa diselesaikan offline. **Tugas berlaku 2 hari**: yang absen kemarin mendapat set kemarin saat kembali. Tidak ada beruntun (streak).
4. **Rapor Musim** gratis: 30 tingkat × 45 poin = 1.350. Tugas +10, tantangan mingguan yang sudah ada +40. Poin dikreditkan otomatis, tanpa tombol klaim dan tanpa iklan.
5. **Hadiah: kosmetik dan kemudahan, bukan uang.** Lencana, bingkai foto, spanduk gapura, seragam petugas, papan gapura, tiket ganti tugas, dan Surat Armada (PO pilihan +½ level). Semua hiasan adegan menambah **0 draw call**, kecuali spanduk (+2, hanya di minggu tanpa event, jadi puncak minggu event tidak naik). Kosmetik musim kembali saat temanya kembali tahun depan. Lencana adalah catatan prestasi, bukan barang.
6. **Bukti simulasi** (pengikut tujuan di GameState asli, 42 hari, 13 run): pemain harian 3 sesi atau 60 menit selesai di hari musim ke-31, pemain harian 2 × 10 menit di hari ke-35–36, pemain 4 hari seminggu sampai tingkat 26–28, pemain 3 × 10 menit seminggu sampai tingkat 19–22. Tanpa aturan "berlaku 2 hari", dua profil terakhir hanya sampai tingkat 18 dan 10. Kas menipis 0 dan petugas berhenti 0 di semua run. Tempo pemain aktif tidak berubah: Musim tidak memberi uang, XP terminal, atau percepatan proyek, dan Surat Armada pertama datang 7–10 hari sesudah Terpadu.
7. **Akhir musim:** popup **Rapor Musim** (nilai, tugas, tantangan, pertumbuhan terminal, hiasan yang didapat), lalu musim berikutnya dimulai. Hiasan dan lencana tetap dimiliki.
8. **Ronde 1 bisa dikirim tanpa server:** Raka M–L, Panji S, Dodi S. Ronde 2 (cat bus PO, umbul-umbul, melodi telolet musim, event kalender baru, `ops.json`) menunggu data GA4 musim pertama dan APPROVE sendiri.

**Pertanyaan untuk Sapto/owner** (asumsi yang dipakai bila belum dijawab):

1. Kapan 0.5.0 (rilis Musim) kira-kira keluar? Tanggal mulai Musim 1 dikunci di config. *Asumsi:* Senin 30 November 2026. Bila rilis lebih lambat, tanggalnya digeser ke Senin minggu rilis (bagian 3.1).
2. Musim terbuka di Lv 6, sekitar menit main ke-19–23. Owner ingin menit pertama tetap bersih (dokumen 14). *Asumsi:* Lv 6, bukan sejak tutorial selesai.

## 1. Masalah, untuk siapa, cara mengukur

### 1.1 Masalah pemain

"Aku sudah Terpadu, terus ngapain?" Faktanya:

| Fakta | Angka | Sumber |
|---|---|---|
| Konten bangun habis bagi pemain aktif | Terpadu 10,9 jam, Perluasan 5 selesai 11,4 jam main | dokumen 13 bagian 14 |
| Konten bangun habis bagi pemain kasual (dengan Manajer) | Terpadu hari nyata ke-2 (3 sesi) / ke-3 (2 sesi) | `tests/tycoon-kasual.test.ts` |
| XP terminal dari offline | 94 % / 96 % | idem |
| Sesi berisi keputusan hari 8–14 | 10 % / 14 % | dokumen 15 bagian 2.2 |
| Dataran Lv 21–27 | 3 keputusan dalam 3,5 jam main | dokumen 13 bagian 16 (S-4) |
| Hadiah target harian & tantangan setelah Tipe B | 0,7–3,7 % kas (uang), armada untuk PO terendah | dokumen 15 bagian 4 |

Prinsip dari kajian (ADR 004): ekor panjang harus dibangun dari tujuan yang **tidak bisa dipercepat offline**, yaitu tujuan kalender dan tujuan yang diukur dalam waktu main aktif. Dengan itu aturan offline (8 jam, 60 %) tidak perlu diubah.

### 1.2 Untuk siapa

- **Pemain lama** (sudah Terpadu): sasaran utama. Tiap sesi punya tiga hal kecil untuk dikejar, tiap minggu tantangan, tiap 6 minggu rapor dan hiasan baru.
- **Pemain kasual-offline**: tugas sengaja hanya maju saat main. Ketiga tugas maju bersamaan; dua sesi 10 menit sehari selalu cukup, satu sesi 10 menit pas-pasan untuk tugas *sorotan* (bagian 6).
- **Pemain baru**: Musim baru terbuka di Lv 6, jadi menit pertama tidak berubah. Di sesi kedua mereka sudah ikut musim.

### 1.3 Cara mengukur (GA4)

**Dengan peristiwa yang sudah ada** (bandingkan kohort 0.4.x dengan 0.5.0):

- retensi D7 dan D30 bawaan GA4;
- `ringkasan_sesi` per pemain per hari, dipilah `level_terminal ≥ 30` (Terpadu): sasaran ≥ 2 sesi per hari di hari 14–30 (sasaran kajian);
- `ringkasan_sesi.detik_main` median sesi Terpadu: tidak boleh turun (tugas jangan membuat sesi jadi "absen lalu pergi");
- `iklan_hadiah` per sesi sesudah Terpadu: tidak boleh turun (Musim tidak memakai iklan, jadi ini pemeriksa bahwa Musim tidak menggusur hadiah lain);
- `foto_terminal` dan `share`: naik (bingkai dan lencana musim).

**Dengan peristiwa baru** (butuh izin owner, bagian 9.2):

- porsi sesi sesudah Terpadu yang berisi ≥ 1 `tugas_selesai`: gerbang tahap 1 peta jalan adalah ≥ 50 % di hari 7–30;
- `tugas_selesai` dan `tugas_ganti` per templat: templat yang paling sering diganti dibuang atau diubah di musim berikutnya;
- sebaran `rapor_musim.tingkat` di akhir musim: bila median pemain yang ikut < 20, musim terlalu berat; bila > 80 % mencapai 30 sebelum minggu ke-5, terlalu ringan.

**Belum ada data pemain nyata.** Semua angka di dokumen ini hasil simulasi atau model, bukan pengukuran.

## 2. Sistem sekarang

| Sistem | Yang ada (file) | Dipakai Musim |
|---|---|---|
| Target harian | per **hari terminal** (24 menit main), penumpang atau laba, paket uang + armada ½ level + percepat 6 menit (`buatTargetHarian`, `klaimTarget`, `src/sim/state.ts`) | Tetap. Tidak memberi poin musim, karena pemain aktif mendapat banyak per hari nyata |
| Tantangan mingguan | 3 dari 4 jenis, minggu Senin WIB, diundi dari kunci minggu (`mingguWib`, `jenisTantanganMinggu` di `src/sim/tantangan.ts`; target & klaim di `state.ts`) | Tetap, **+40 poin** per tantangan yang diklaim atau dikirim otomatis |
| Kunci WIB tanpa server | `mingguWib`, `tengahMalamWib` (`src/sim/event.ts`), pola undian FNV | Dipakai ulang untuk kunci hari & musim |
| Event musiman | Mudik Lebaran, HUT RI, Nataru (`src/sim/event.ts`, `EKONOMI.event`); spanduk gapura per event (`src/game/event3d.ts`, satu grup per event, hanya visibilitas ditukar) | Spanduk musim memakai tempat dan cara yang sama; event selalu menang |
| Bus Emas | iklan saja, paket uang + armada ¼ level | Tidak dipakai Musim (supaya tidak ada tugas yang menuntut iklan) |
| Paket hadiah armada | `paketHadiah`, `berikanPaket`, `poArmada` (PO berlevel terendah) | Surat Armada memakai rumus XP yang sama, tapi PO-nya dipilih pemain (playtest P-8) |
| Baris tujuan | `src/app/tujuan.ts`, tingkat 1–5; tingkat 5 (naik level) selalu ada | Tugas terbuka tampil di tingkat 5, sebelum "naik level" |
| Papan gapura | `HiasanKelas` (`src/game/kelas3d.ts`): papan per kelas, papan bernama, umbul-umbul mulai Tipe B | Warna papan musim (tekstur ditulis ulang, 0 draw call) |
| Seragam petugas | `seragam(baju, celana, topi)` per orang statis (`src/game/terminal3d.ts`), satu `InstancedMesh` untuk semua orang | Warna baju musim (warna per instans, 0 draw call) |
| Foto terminal | `src/ui/foto.ts`: bingkai gradasi + ikon + keterangan | Bingkai dan lencana musim (kanvas 2D, tanpa beban adegan) |
| Save | skema 3, blok opsional yang hilang diisi bawaan, field tak dikenal diabaikan (`src/sim/save.ts`) | Blok opsional baru `musim`, skema tetap 3 |
| Analitik | `src/app/analitik.ts`, penyaring sekali-per-sesi, `ringkasan_sesi` | 5 peristiwa + 1 parameter baru |

**Beda dengan dokumen atau brief:**

- Tantangan mingguan ada di `src/sim/tantangan.ts`, bukan `src/app/tantangan.ts` seperti di brief.
- Livery event (`mudikCeria`, `merahPutih`, `kembangApi` di `src/config/livery.config.ts`) adalah PO hadiah tahap terakhir event. Edisinya per tahun, jadi PO itu bisa didapat lagi tahun berikutnya. Musim mengikuti pola "kembali tahun depan" yang sama.
- `privasi.html` bagian 2a dan 2d masih menyebut "level tahap", "Kepala", dan "upgrade" dari ekonomi idle. Ini bukan bagian Musim, tapi Dodi bisa merapikannya bila halamannya disentuh (bagian 9.3).

## 3. Siklus musim

### 3.1 Kalender

- **Satu musim = 6 minggu WIB**, Senin 00.00 sampai Minggu 23.59. Batasnya selalu sama dengan batas minggu tantangan, jadi tantangan tidak pernah terbelah dua musim.
- **Jangkar** `musim.mulai = '2026-11-30'` di config. Musim ke-n mulai jangkar + 42n hari. Semua pemain berada di musim yang sama pada tanggal yang sama, tanpa server.
- **Tema** diambil dari daftar tahun pertama di config. Sesudah daftarnya habis, tema diulang dari awal dengan tahun baru di namanya (Musim Hujan 2027). Jadi tidak pernah ada keadaan "tidak ada musim". Rilis berikutnya bisa menambah tema baru tanpa mengubah aturan.

| Musim | Tanggal | Tema (usulan) | Event kalender di dalamnya |
|---|---|---|---|
| 1 | 30 Nov 2026 – 10 Jan 2027 | 🌧️ Musim Hujan | Nataru 20 Des – 5 Jan |
| 2 | 11 Jan – 21 Feb 2027 | 🧧 Musim Imlek | (Imlek 6 Feb; awal Ramadan) |
| 3 | 22 Feb – 4 Apr 2027 | 🕌 Musim Mudik | Mudik Lebaran 28 Feb – 17 Mar |
| 4 | 5 Apr – 16 Mei 2027 | 🌦️ Musim Pancaroba | – |
| 5 | 17 Mei – 27 Jun 2027 | ☀️ Musim Kemarau | – |
| 6 | 28 Jun – 8 Agu 2027 | 🎒 Musim Libur Sekolah | – |
| 7 | 9 Agu – 19 Sep 2027 | 🇮🇩 Musim Merdeka | HUT RI 10–20 Agu |
| 8 | 20 Sep – 31 Okt 2027 | 🪁 Musim Layang-layang | – |
| 9 | 1 Nov – 12 Des 2027 | 🌧️ Musim Hujan 2027 | – |

Ronde 1 cukup membawa data tema musim 1–3; sisanya bisa ditambah sebelum musim 4 tiba. Tanggal Imlek 2027 ditulis dari ingatan, belum diperiksa. Tanggalnya tidak dipakai kode, hanya nama tema.

**Bila rilis terlambat:** jangkar digeser ke Senin minggu rilis sebelum build. Bila tidak digeser, pemain masuk di tengah musim. Itu juga aman: tugas berlaku sejak hari musim terbuka, dan tingkat 20 tetap tercapai dalam 3 minggu oleh pemain harian (bagian 6).

### 3.2 Tugas harian

**Aturan:**

- **3 tugas per hari WIB**, satu dari tiap kelompok: *main*, *sorotan*, *kelola*. Urutan templat diundi dari kunci hari (`tugas-2026-12-01`, pola FNV yang sama dengan tantangan). Tiap pemain mengambil templat **layak** pertama tiap kelompok. Pemain dengan terminal sebanding mendapat tugas yang sama. Bila kelompok *kelola* tidak punya templat layak, diganti templat *sorotan* kedua.
- **Target dibuat saat tugas dibuat**, dari keadaan terminal saat itu (seperti tantangan):
  - *main*: laju rata-rata sehari × **8 jam terminal** (8 menit main di 1×);
  - *sorotan*: laju rata-rata sehari × 8 × **1,25** (± 10 menit main bila pemain tidak berbuat apa-apa; lebih cepat bila ada tuas yang memajukannya dan pemain memakainya, lihat "Tuas" di bawah tabel);
  - *kepuasan*: jaga kepuasan ≥ ambang selama 8 menit main. Ambang = kepuasan saat dibuat, dibulatkan ke bawah ke 5 %, dijepit 50–80 %. **Sesudah dibangun (AC-GP-16, playtest P-1):** templat ini hanya dibuat bila kepuasan sekarang ≥ `kepuasanMin` (50 %). Kemajuan dihitung bila `round(kepuasan × 100) ≥ ambang × 100`, pembulatan yang sama dengan HUD, jadi HUD 60 % memenuhi "≥ 60 %". Tanpa aturan ini, pemain di bawah 50 % mendapat tugas yang mustahil sejak lahir, dan 59,74 % (HUD 60 %) macet di 0/8 menit. Ambang yang dibulatkan ke bawah dengan selisih 2 poin (usulan P-1 c) tidak dipakai, karena mengubah aturan ambang;
  - *kelola*: satu keputusan, selesai seketika saat dilakukan.
  - Laju rata-rata = rata-rata 24 jam terminal dengan tarif bawaan, seperti `acuanHarian`. Target dibulatkan seperti `bulatkanTarget`.
- **Maju hanya saat main aktif** (tiap tick, dengan laju sesungguhnya). Offline dengan Manajer tidak memajukan tugas. Di 2× dan 3× tugas maju 2–3× lebih cepat per menit nyata, sama seperti tantangan. Batas harian (3 tugas per hari) membuat kecepatan tidak menggelembungkan poin.
- **Berlaku 2 hari.** Tugas hari D bisa dikerjakan sampai akhir hari D+1 (23.59 WIB). Pemain yang absen kemarin mendapat set kemarin saat kembali, dibuat dari keadaan terminal sekarang. Paling banyak 6 tugas terbuka. Templat set hari ini sebisa mungkin berbeda dari set kemarin yang masih terbuka, supaya tidak ada dua baris "Berangkatkan penumpang".
- **Selesai = poin langsung masuk** (+10), dengan toast. Tidak ada tombol klaim, karena tombol klaim di game ini selalu berpasangan dengan tawaran 2× lewat iklan, dan poin musim tidak pernah digandakan iklan.
- **Ganti tugas:** satu kali gratis per hari, lalu memakai tiket ganti (hadiah rapor). Pengganti diambil dari kelompok yang sama, dari undian `tugas-<hari>-ganti`, bukan templat yang sedang terbuka. Tugas yang sudah selesai tidak bisa diganti.
- **Tidak ada beruntun** dan tidak ada hukuman absen.
- **Kunci hari hanya maju.** Bila jam perangkat dimundurkan, tugas yang ada tetap, tidak dibuat ulang.

**Templat ronde 1** (12):

Kolom "Tuas" adalah versi sesudah dibangun (AC-GP-17). Tuas rancangan semula tercatat di bawah tabel.

| Id | Kelompok | Teks (contoh) | Layak bila | Tuas yang ditunjuk (ketuk "›") |
|---|---|---|---|---|
| `penumpang` | main | Berangkatkan 4.800 penumpang | selalu | tanpa tuas |
| `laba` | main | Kumpulkan laba Rp 120 jt | **laba dengan kontrak (tarif pemain) > 0** (P-9) | laporan keuangan (tab Terminal) |
| `kota` | sorotan | Antar 1.200 penumpang ke Semarang | kota sorotan minggu ini dilayani | aksi yang paling menaikkan arus ke kota itu: biasanya jalur baru selama slotnya ada, atau PO baru yang melayaninya; tanpa tuas bila tidak ada |
| `antarpulau` | sorotan | Antar 600 penumpang antarpulau | ada arus antarpulau | sama, untuk arus antarpulau |
| `kelasTinggi` | sorotan | Antar 900 penumpang Eksekutif ke atas | ada bus Eksekutif/Sleeper/Double Decker | sama, untuk arus kelas itu |
| `poTerendah` | sorotan | PO Peuyeum Kilat: antar 900 penumpang | ≥ 2 PO, PO terendah punya arus | aksi yang menaikkan arus PO itu (tanpa PO baru); tanpa tuas bila tidak ada |
| `kios` | sorotan | Kumpulkan sewa kios Rp 6 jt | ≥ 1 kios/toko | biasanya **saran tarif sewa kios** (tab Terminal); kios/toko baru bila lebih menaikkan |
| `parkir` | sorotan | Kumpulkan uang parkir Rp 4 jt | ≥ 1 lahan parkir | saran tarif parkir, juru parkir, atau lahan parkir, mana yang paling menaikkan |
| `kepuasan` | sorotan | Jaga kepuasan ≥ 65% selama 8 menit main | **kepuasan (persen HUD) ≥ 50 %** (P-1) | popup kepuasan |
| `perbaikan` | kelola | Naikkan kebersihan ke 80% (kini 62%) | komponen terlemah (kebersihan, keamanan, kenyamanan, fasilitas) < 95 % dan ada satu rekrut/bangun yang aman menaikkannya | **aksi yang dipakai untuk menghitung targetnya** (mis. petugas toilet untuk kebersihan bila toilet tanpa petugas) |
| `bangun` | kelola | Bangun 1 unit atau modernisasi | ada unit/modernisasi yang lolos cadangan B | **unit atau modernisasi termurah yang lolos cadangan B** |
| `daftarPo` | kelola | Daftarkan 1 PO baru | ada PO yang bisa didaftarkan | tombol daftar PO pertama di urutan tab PO yang bisa didaftarkan |

**Tuas (sesudah dibangun, AC-GP-17; playtest P-2, P-3, P-5, P-6):**

- **Aturan.** Tuas hanya menunjuk aksi yang, bila dikerjakan, **memajukan tugas itu** dan **lolos aturan "aman"** di bawah (saran tarif tidak mengeluarkan uang, jadi selalu aman).
  - Untuk tugas sorotan, "memajukan" berarti laju sumber tugasnya di jam sibuk naik, dan rata-rata sehari naik lebih dari `perbaikanNaikMin` (2 %). Batasnya memakai ulang key yang sudah ada; tidak ada key config baru.
  - **Bila tidak ada aksi seperti itu, tidak ada tuas.** Baris tetap menyebut kota atau PO-nya.
  - Laba dan kepuasan tetap menunjuk informasi (laporan keuangan, popup kepuasan).
- **Kenapa berubah dari rancangan.** Tuas semula membuka tab PO, Bangun kios, Petugas kebersihan, toilet, atau tombol beli pertama yang menyala. Di save pengikut tujuan asli, "Tambah jendela" PO memberi ×1,00, karena leher botol semua save itu peron. Tuas kios menunjuk slot penuh, padahal saran tarif sewa kios memberi ×3,0–6,7 gratis. Tuas perbaikan menunjuk petugas yang tidak menaikkan apa pun. Tuas bangun bisa melanggar cadangan B (`docs/design/20261104-musim-terminal-playtest.md` bagian 3.2).
- **Akibat bagi pemain Terpadu.** Sesudah jalur penuh, sebagian besar tugas arus tidak punya tuas sama sekali. Itu jujur, tapi mempertegas rasa daftar kerja (bagian 12, ronde berikutnya P-10).
- **Tampilan.** Tuas mahal dihitung (mencoba aksi), jadi peringkatnya disimpan per susunan terminal, dan aksi pertama yang aman menurut kas sekarang dinilai ulang paling cepat tiap 5 detik main (`src/ui/model.ts`).

- **"Aman"** memakai aturan baris tujuan (dokumen 14 bagian 3.2): sesudah aksi, kas ≥ cadangan B, dan untuk rekrut, laba rata-rata dengan kontrak tetap > 0. Target `perbaikan` = nilai komponen sesudah aksi aman terbaik, dibulatkan ke bawah ke 5 %, jadi satu aksi cukup.
- **Kota sorotan minggu ini** diundi dari kunci minggu (`kota-<Senin>`) dari seluruh daftar jurusan. Tiap pemain memakai kota pertama di urutan itu yang ia layani. Pemain yang melayani semua jurusan darat mendapat kota yang sama, jadi kota sorotan bisa jadi bahan obrolan. Kota sorotan **tidak** menaikkan pasar di ronde 1 (itu angka ekonomi, ronde 2).
- **Ditolak:** tugas yang menuntut iklan (Bus Emas, boost); tugas yang memaksa biaya tetap (rekrut tanpa syarat, beli unit tanpa cadangan); tugas yang bisa memancing rugi (tarif ekstrem); tugas yang butuh waktu nyata panjang (1 hari terminal tanpa rugi = 24 menit main); telolet dan foto (lucu, tapi perlu aksi baru dari adegan; kandidat ronde 2).

### 3.3 Tantangan mingguan

Tidak berubah, kecuali **+40 poin musim** untuk tiap tantangan yang diklaim, atau yang dikirim otomatis saat minggu berganti. Poin masuk ke musim minggu itu: urutan di `perbaruiJamNyata` menjadi event → tantangan (kirim otomatis, kredit poin) → musim (pergantian). Karena batas musim selalu Senin, tantangan minggu terakhir masuk ke musim yang lama sebelum rapornya ditutup.

Catatan dari simulasi: pemain yang main ≤ 80 menit seminggu hampir tidak pernah menyelesaikan tantangan penumpang (120 menit main) dan laba (180 menit). Ini aturan lama (±2–3 jam main untuk ketiganya), dan tidak diubah di sini. Akibatnya bagi Rapor: 40 poin itu kebanyakan jatuh ke pemain rajin.

**Tantangan "Bangun 15 unit" (P-9) tetap praktis tidak tercapai.** Slotnya ada: sisa unit yang masih bisa dibangun di awal minggu 13–46 di semua run. Tapi pengikut tujuan hanya membangun yang disarankan, dan dalam 13 run tantangan ini selesai **sekali** (J3 baru, minggu ke-2, saat terminalnya masih tumbuh cepat). Di 4 minggu yang mengundinya, pemain harian mendapat paling banyak 2 dari 3 tantangan. Dengan Musim, ini berarti −40 poin di minggu itu. Tidak diubah di rancangan ini (aturan tantangan, perlu simulasi sendiri). Usulan untuk diputuskan sesudah GA4 `klaim_tantangan`: target bangun mengikuti sisa slot, atau jenis ini diganti bila sisa unit < 15. **Tidak dinilai.**

### 3.4 Poin dan tingkat

| Sumber | Poin | Batas |
|---|---|---|
| Tugas harian | 10 | 3 per hari WIB (+3 susulan kemarin) |
| Tantangan mingguan | 40 | 3 per minggu |
| Target harian, Bus Emas, penghargaan, event, iklan | 0 | – |

- **Tingkat = min(30, ⌊poin ÷ 45⌋).** Maksimum per minggu 21 × 10 + 3 × 40 = 330, jadi tingkat 30 paling cepat di hari ke-29.
- **Sesudah tingkat 30** poin tetap dicatat untuk rapor (nilai "Istimewa"), tanpa hadiah tambahan. Tingkat bonus tak berujung tidak dipakai, karena akan mendorong main berlebihan tanpa arti.
- **Kenapa 30 × 45** (bagian 6 dan 13): pemain harian 3 sesi selesai di hari 31, pemain harian 2 × 10 menit di hari 35–36 (sisa seminggu untuk hari libur), pemain 4 hari seminggu sampai tingkat 26–28. Skema 30 × 40 terlalu cepat (hari 28–32, dan pemain 4 hari seminggu juga selesai), 30 × 50 membuat pemain 2 sesi selesai di hari 39–40, tanpa ruang absen.

### 3.5 Rapor Musim (akhir musim)

Saat musim berganti (di sesi aktif atau saat game dibuka sesudahnya), musim lama ditutup:

1. Tugas yang terbuka ditutup. Yang selesai sudah dikreditkan; yang belum selesai hilang tanpa hukuman.
2. Rapor disimpan sekali di `musim.rapor`: musim, tingkat, poin, tugas selesai, tantangan, Lv awal → akhir, penumpang selama musim, hiasan yang didapat.
3. Musim baru dimulai dengan poin 0. Koleksi, hiasan yang dipakai, tiket, dan surat tetap.
4. Popup Rapor tampil **sekali**, sesudah popup offline bila ada, dan memuat kalimat musim baru. Jadi pemain melihat paling banyak dua popup (offline, lalu rapor), bukan tiga.

**Nilai rapor** (tanpa nada menghukum): tingkat 1–9 **Cukup**, 10–19 **Baik**, 20–29 **Sangat Baik**, 30 **Istimewa**. Musim dengan 0 poin tidak punya rapor. Pemain yang absen beberapa musim hanya melihat rapor musim terakhir yang ia ikuti.

## 4. Jalur musim dan hadiah

### 4.1 Hadiah per tingkat (Musim Hujan; susunan sama tiap musim, temanya berganti)

| Tingkat | Hadiah | Jenis | Ronde |
|---|---|---|---|
| 1 | Lencana Peserta Musim Hujan 2026 | catatan | 1 |
| 3 | Bingkai foto Musim Hujan | kosmetik UI | 1 |
| 5 | Spanduk gapura "SELAMAT DATANG · HATI-HATI JALAN LICIN" | kosmetik adegan | 1 |
| 8 | 2 tiket ganti tugas | kemudahan | 1 |
| 10 | Seragam jas hujan kuning (petugas peron & gerbang) | kosmetik adegan | 1 |
| 12 | Surat Armada: PO pilihanmu +½ level | kemudahan | 1 |
| 15 | Papan gapura biru hujan | kosmetik adegan | 1 |
| 18 | 2 tiket ganti tugas | kemudahan | 1 (ronde 2: melodi telolet musim) |
| 20 | Lencana Lulus Musim Hujan 2026 | catatan | 1 |
| 23 | 2 tiket ganti tugas | kemudahan | 1 (ronde 2: umbul-umbul musim) |
| 25 | Surat Armada: PO pilihanmu +½ level | kemudahan | 1 |
| 28 | 2 tiket ganti tugas | kemudahan | 1 (ronde 2: cat bus musim untuk 1 PO pilihan) |
| 30 | Lencana Istimewa Musim Hujan 2026 + bingkai foto emas | catatan + kosmetik UI | 1 |

- **Tingkat tanpa hadiah** menampilkan "Berikutnya: tingkat 8 · 2 tiket ganti tugas". Mengisi tiap tingkat dengan pengisi hanya membuat hadiah tidak berarti.
- **Hadiah mengikuti tingkat**, bukan tombol klaim. Hiasan yang baru didapat langsung dipakai (otomatis), dengan toast. Akibatnya, hiasan yang dikirim di build belakangan tetap diberikan ke pemain yang tingkatnya sudah cukup.
- **Hadiah inti untuk pemain jarang:** spanduk, seragam, Surat Armada, dan papan gapura ada di tingkat ≤ 15. Pemain 4 hari seminggu mencapainya (bagian 6).
- **Tidak ada uang, XP terminal, boost, atau percepat proyek.** Percepat tidak berguna sesudah Perluasan 5, dan XP terminal menggeser tempo (dokumen 15 bagian 4.1).

### 4.2 Kosmetik dan biaya gambar

| Hiasan | Cara murah | Draw call | Segitiga | Catatan |
|---|---|---|---|---|
| Spanduk gapura | Satu entri baru di `HiasanEvent` (`event3d.ts`): persegi bertekstur teks + tali, geometri sama dengan spanduk event. Tampil hanya bila tidak ada event | **+2 saat tampil**, 0 di minggu event | +50 | Puncak (minggu event) tidak naik: spanduk event dan spanduk musim tidak pernah tampil bersamaan |
| Seragam petugas | Ganti `baju` di `seragam(...)` petugas peron & gerbang. Orang adalah satu `InstancedMesh` dengan warna per instans | 0 | 0 | Di 360 px orangnya kecil; terbaca sebagai titik kuning di peron. Diuji di playtest |
| Papan gapura | Warna `latar`/`warna` papan kelas dan papan bernama diganti; tekstur ditulis ulang sekali | 0 | 0 | Gapura di depan tengah, di luar pita atas yang kabur oleh tilt-shift |
| Bingkai foto & lencana | Kanvas 2D di `src/ui/foto.ts` | 0 (bukan adegan) | 0 | |
| Ronde 2: cat bus PO pilihan | Satu sel lembar livery (`lembar-bus.ts`, kanvas 2048², `CacheSel`) dicat warna musim; nama PO tetap | 0 | 0 | Hanya biaya lukis CPU saat bus datang |
| Ronde 2: umbul-umbul musim | Ganti warna 5 bahan kain umbul (`kelas3d.ts`) | 0 | 0 | Hanya terlihat mulai Tipe B |
| Ronde 2: melodi telolet musim | Satu baris di `MELODI_TELOLET` (`src/platform/suara.ts`) | 0 | 0 | Audio sintesis, tanpa berkas |

Tabel di atas adalah perkiraan rancangan. Anggaran yang berlaku waktu itu: landscape tingkat 1 sudah 241–246 draw call (anggaran skill ±210), dan ronde 2 bentuk terminal memakai sisa ≤ 9 draw call.

**Terukur di build** (Panji, Musim AC-GFX-05; 900×420, tingkat 1, tahap 3 Lv 35, patokan tree yang sudah memuat ronde 2 bentuk terminal):

| Keadaan | Draw call | Segitiga |
|---|---|---|
| Tanpa hiasan | +0 | |
| Spanduk dipakai | **+2** (tulisan + tali) | +50, tanpa bayangan |
| Seragam, papan | +0 | +0 |
| Minggu event | 256 = 256 | |

Logika kapan hiasan tampil ada di modul murni `src/game/musim-adegan.ts`; datanya di `src/config/hiasan-musim.ts`.

**Tema hiasan adegan (keputusan Citra, 5 November 2026).** Dokumen ini semula hanya merinci Musim Hujan. Nilai Imlek dan Mudik dipilih Panji saat membangun, lalu diputuskan di sini. Aturan yang dipakai:

- **Teks spanduk ≤ 38 karakter**, tidak lebih panjang dari spanduk Hujan (38) atau spanduk event terpanjang (40). Tes `tests/hiasan-musim.test.ts` membatasi 41.
- **Papan dan spanduk satu tema harus berbeda warna**, karena di layar HP keduanya terbaca sebagai satu blok di bawah tilt-shift.
- **Papan musim tidak boleh sewarna dengan spanduk event yang jatuh di musimnya.** Spanduk event menang atas spanduk musim, tapi papan musim tetap terpasang di atasnya.
- **Warna tulisan cukup kontras: ≥ 4 : 1.** Papan dan spanduk adalah teks besar; patokan WCAG untuk teks besar 3 : 1. Papan Hujan, putih di atas biru langit, berada di 4,1 : 1.

| Id | Nilai Panji | Keputusan | Nilai yang berlaku | Alasan |
|---|---|---|---|---|
| `spanduk-hujan` | "SELAMAT DATANG · HATI-HATI JALAN LICIN", `#facc15` / `#1e293b` | **tetap** | sama | Teks dari bagian 4.1. Kuning di bawah papan biru hujan terbaca sebagai pita kuning walau kabur |
| `spanduk-imlek` | "SELAMAT TAHUN BARU IMLEK · GONG XI FA CAI" (41 karakter), `#b91c1c` / `#fde047` | **ganti** | "SELAMAT IMLEK · GONG XI FA CAI" (30 karakter), latar `#f59e0b`, tulisan `#7f1d1d` | Teks lama lebih panjang dari spanduk event mana pun. Latar merah sama persis dengan papan Imlek, jadi papan dan spanduk menyatu menjadi satu blok merah (catatan Panji). Emas tua dengan tulisan merah tua tetap palet Imlek, beda dari kuning lemon spanduk Hujan (`#facc15`), kontras 4,7 : 1 |
| `spanduk-mudik` | "MUDIK AMAN · SELAMAT SAMPAI TUJUAN" (34), `#0f766e` / `#fef3c7` | **tetap** | sama | Teks pas untuk minggu sebelum dan sesudah Lebaran (arus balik). Hijau toska beda dari spanduk event Mudik Lebaran (`#166534`), yang menang selama 28 Februari–17 Maret |
| `papan-hujan` | `#0284c7` / `#ffffff` | **tetap** | sama | Biru langit, beda dari papan Tipe B (`#1e3a8a`) dan dari spanduk event Nataru (`#1e1b4b`) yang jatuh di Musim Hujan |
| `papan-imlek` | `#b91c1c` / `#fde047` | **tetap** | sama | Merah dan emas: tanda Imlek yang paling dikenal. Spanduknya yang diganti |
| `papan-mudik` | `#166534` / `#fde68a` | **ganti** | latar `#eab308`, tulisan `#14532d` | `#166534` sama persis dengan latar spanduk event Mudik Lebaran. Selama event, papan dan spanduk di gapura menjadi satu blok hijau tua, dan di luar event hijau toska spanduk musim juga menyatu dengannya. Kuning ketupat dengan tulisan hijau tua tetap palet Lebaran, terbedakan dari kedua spanduk dan dari papan Terpadu bawaan (`#7a5410`), kontras 4,8 : 1 |
| `seragam-hujan` | baju `0xfacc15` | **tetap** | sama | Jas hujan kuning (bagian 4.1) |
| `seragam-imlek` | baju `0xdc2626` | **tetap** | sama | Beda dari baju bawaan petugas peron dan gerbang (`0x1e3a8a`) |
| `seragam-mudik` | baju `0x15803d` | **tetap** | sama | Hijau Lebaran. Mirip baju petugas toilet (`0x16a34a`), tapi petugas toilet ada di dalam gedung, bukan di peron atau gerbang |

Perubahan nilainya dikerjakan Panji di `src/config/hiasan-musim.ts` sebelum commit. Tes Hujan tidak berubah. Kombinasi per musim yang dihasilkan:

- **Hujan:** papan biru langit + spanduk kuning.
- **Imlek:** papan merah + spanduk emas tua.
- **Mudik:** papan kuning + spanduk hijau toska; selama event, spanduk hijau tua.

Ketiganya terbedakan dari warna saja, tanpa membaca tulisan, sesuai keputusan owner soal tilt-shift. Imlek dan Mudik pertama kali tampil 11 Januari dan 22 Februari 2027, jadi masih bisa diubah sebelum itu tanpa memengaruhi save (hiasan disimpan sebagai id, bukan warna). **Belum dilihat di build** dengan nilai baru: Panji mengambil screenshot gapura Imlek dan Mudik (siang, malam, minggu event Mudik Lebaran) sesudah mengganti nilai.

### 4.3 Tanpa kelangkaan palsu

- **Kosmetik musim kembali** saat temanya kembali (Musim Hujan 2027 membawa spanduk, seragam, dan papan yang sama, ditambah yang baru). Pemain yang sudah memilikinya mendapat tiket ganti sebagai gantinya.
- **Lencana** ("Peserta/Lulus/Istimewa Musim Hujan 2026") adalah catatan prestasi bertanggal, seperti piala. Bukan barang, tidak bisa dibeli, tidak memberi keunggulan.
- **Tidak ada hitung mundur yang menekan**: sisa hari musim tampil kecil di kartu; tidak ada notifikasi "tinggal 2 hari!".
- **Iklan tidak pernah memberi poin, tingkat, atau hiasan.**

## 5. Hubungan dengan sistem yang ada

| Sistem | Hubungan |
|---|---|
| Target harian | Tidak berubah, tidak memberi poin. Ia per hari terminal: pemain 60 menit sehari mendapat 2,5 per hari nyata, pemain 10 menit 0,4. Memberi poin akan menghadiahi lama main, bukan kehadiran |
| Tantangan mingguan | +40 poin per tantangan. Aturan dan hadiahnya tetap |
| Bus Emas, boost, klaim 2× | Tidak tersentuh. Tidak ada tugas yang menuntut iklan |
| Paket hadiah armada | Tetap ke PO terendah. Surat Armada adalah jalan kedua: pemain memilih PO-nya (P-8) |
| Baris tujuan | Jenis baru `tugas` di tingkat 5, sebelum `naikLevel`. Status tanpa aksi, jadi pengikut tujuan tidak berubah perilaku. Tampil hanya bila musim terbuka dan ada tugas belum selesai |
| Event | Spanduk event menang atas spanduk musim. Target tugas memakai laju yang sudah termasuk pengali event |
| Papan peringkat | Tidak tersentuh. Poin musim tidak dikirim ke server (keputusan "tanpa hadiah gameplay" tetap) |
| Penghargaan | Tidak berubah |
| Foto terminal | Bingkai dan lencana musim yang dipakai ikut di foto |
| Offline & popup offline | Tugas tidak maju offline. Popup offline tidak berubah; popup rapor tampil sesudahnya bila musim berganti |
| Lencana tab | **Sesudah dibangun:** tab Target mendapat titik hanya untuk Surat Armada yang belum dipakai, karena hanya itu hadiah rapor yang menunggu keputusan pemain. Hiasan langsung dipakai dan tiket langsung bertambah, masing-masing dengan toast. Titik tidak pernah menghitung tugas tersisa, supaya tidak menagih. Diterima di playtest (tafsiran Raka a), dengan baris Surat Armada di atas kartu (bagian 7.1) |

## 6. Pemain baru, lama, dan kasual-offline

Dari harness (pengikut tujuan, GameState asli, offline asli di antara sesi, 1×, tugas berlaku 2 hari). Kolom terakhir = hari musim tingkat 30 tercapai; dalam kurung tingkat akhir bila tidak tercapai.

"Baru" = game baru di hari pertama musim. "Lama" = 14 hari nyata main dengan pola yang sama sebelum musim (semua profil sudah Terpadu atau, J3, baru saja). Tugas yang ditawarkan termasuk set susulan kemarin.

| Profil | Pola | Musim terbuka | Tugas selesai / ditawarkan | Tantangan (dari 18) | Tingkat di akhir minggu 1…6 | Hari tingkat 30 |
|---|---|---|---|---|---|---|
| K3 baru | 3 sesi/hari (15+10+20 mnt) | hari 1 sesi 2 (22 mnt main) | 126/126 | 13 | 7 / 13 / 20 / 26 / 30 / 30 | 31 |
| K3 lama | sama | – | 126/126 | 13 | 7 / 13 / 20 / 26 / 30 / 30 | 31 |
| K2 baru | 2 × 10 mnt/hari | hari 1 sesi 2 (19 mnt) | 126/126 | 10 | 7 / 13 / 18 / 24 / 30 / 30 | 35 |
| K2 lama | sama | – | 126/126 | 9 | 6 / 12 / 17 / 23 / 29 / 30 | 36 |
| K2 lama, 3× | sama, kecepatan 3× | – | 126/126 | 14 | 7 / 13 / 20 / 26 / 30 / 30 | 31 |
| A60 baru | 1 × 60 mnt/hari | hari 1 sesi 1 (23 mnt) | 126/126 | 14 | 7 / 13 / 20 / 26 / 30 / 30 | 31 |
| A60 lama | sama | – | 126/126 | 14 | 7 / 13 / 20 / 26 / 30 / 30 | 31 |
| J4 baru | 2 × 10 mnt, Sen/Rab/Sab/Min | hari 1 sesi 2 | 106/108 | 6 | 6 / 10 / 15 / 19 / 24 / 28 | – (28) |
| J4 lama | sama | – | 108/108 | 3 | 4 / 8 / 12 / 16 / 21 / 26 | – (26) |
| J3 baru | 1 × 10 mnt, Sel/Jum/Min | hari 2 sesi 1 | 94/105 | 2 | 3 / 8 / 12 / 15 / 18 / 22 | – (22) |
| J3 lama | sama | – | 89/105 | 0 | 2 / 6 / 10 / 13 / 16 / 19 | – (19) |
| *Pembanding tanpa "berlaku 2 hari":* J4 lama | | | 72/72 | 3 | 2 / 5 / 8 / 11 / 15 / 18 | – (18) |
| *idem* J3 lama | | | 47/54 | 0 | 1 / 3 / 5 / 7 / 8 / 10 | – (10) |

Kas menipis 0 detik dan petugas berhenti 0 di semua run.

**Yang dibaca dari tabel:**

- **Kasual-offline tetap bisa ikut penuh.** Tiga tugas maju bersamaan, masing-masing ±8–10 menit main, jadi sesi 10 menit hampir cukup dan dua sesi pasti cukup. Musim tidak menuntut lebih banyak main dari yang sudah mereka lakukan.
- **Offline tidak menyelesaikan tugas.** Pemain yang hanya membuka game untuk popup offline lalu pergi tidak mendapat poin. Itu disengaja: Rapor menghadiahi kehadiran dan keputusan, bukan Manajer.
- **Pemain baru** ikut sejak sesi kedua. Di Tipe C hampir semua templat layak (kecuali antarpulau dan kelas tinggi); tugas *kelola* di awal hampir selalu "Bangun 1 unit", yang memang langkah berikutnya mereka.
- **Pemain lama** mendapat hasil yang sama dengan pemain baru: tugas diukur dari laju terminal masing-masing.
- **Pemain telat** (masuk di minggu ke-4): tiga minggu sisa memberi tingkat 18–20 bagi pemain harian dan 15 bagi pemain 4 hari seminggu, jadi hadiah inti (≤ 15) tetap terkejar.
- **Pemain jarang** adalah alasan aturan "berlaku 2 hari": pemain 3 hari seminggu naik dari tingkat 10 ke 19–22, pemain 4 hari seminggu dari 18 ke 26–28. Pemain harian tidak berubah, karena set kemarinnya sudah selesai. Batasnya tetap 3 tugas per hari kalender, jadi absen tidak pernah lebih menguntungkan dari hadir.
- **Sesi tunggal 10 menit di 1×** pas-pasan untuk tugas *sorotan* (±10 menit): J3 menyelesaikan "Antar penumpang ke kota sorotan" hanya 2–4 dari 6–7. Tugasnya tetap berlaku sampai besok, dan ada ganti gratis. Bila GA4 menunjukkan banyak tugas sorotan yang kedaluwarsa, pengali 1,25 diturunkan (angka config).
- **Tantangan mingguan** hampir hanya diselesaikan pemain ≥ 140 menit seminggu (bagian 3.3). Pemain jarang mengumpulkan poinnya hampir seluruhnya dari tugas.

## 7. Keadaan dan edge case

### 7.1 Keadaan kartu Musim

| Keadaan | Yang tampil |
|---|---|
| Belum terbuka (Lv < 6 atau tutorial belum selesai) | Kartu tidak ada. Tab Target seperti sekarang |
| Terbuka, tugas berjalan | Kepala kartu, bilah poin, hadiah berikutnya, 3 baris tugas (+ kemarin), tombol ganti |
| Semua tugas hari ini selesai | Baris tercentang, "Tugas baru besok 00.00 WIB" |
| Tingkat 30 | "Rapor Musim Hujan: Istimewa! Tugas tetap menambah nilai rapor." |
| Tugas tidak bisa dikerjakan (mis. kas turun sesudah tugas bangun dibuat) | Baris tetap; tombol ganti gratis tersedia. Tidak ada jalan buntu. Tuasnya hilang bila aksinya tidak lagi aman (bagian 3.2) |
| Musim berganti saat aktif | Toast "Musim Hujan selesai", popup rapor, kartu beralih ke musim baru. Tugas musim lama yang masih terbuka (juga set hari Minggu) ditutup pada Senin 00.00 (bagian 3.5) |
| Musim berganti saat game tertutup | Hanya popup rapor, sesudah popup offline, tanpa toast. Popup rapor sudah memuat "{musim baru} dimulai hari ini" (tafsiran Raka b) |

**Sesudah dibangun (ronde perbaikan 1):**

- **Urutan kartu tab Target (AC-GP-18, playtest P-4).** Kartu event, target harian, dan tantangan yang **sedang bisa diklaim** tampil di atas kartu Musim. Sisanya di bawah kartu Musim, urut seperti biasa (`urutanKartuTarget` di `src/ui/model.ts`). Alasannya: kartu Musim (214–280 px) mengisi seluruh panel tab yang terlihat di keempat ukuran, sehingga tombol Klaim terdorong ke luar layar. Hasilnya: tombol Klaim pertama terlihat tanpa menggulir di 360×740, 412×915, 540×960, dan 900×420.
- **Surat Armada (AC-GP-20, P-8).** Bila ada surat, baris `Surat Armada (n) · Pakai` tampil tepat di bawah "Berikutnya: …", jadi terlihat tanpa menggulir saat tab dibuka, karena itulah sebab titik tab Target.
- **Popup sambutan (AC-GP-19, P-7).** Musim tetap **terbuka di Lv 6** (ADR 009). Popupnya menunggu sampai antrean toast kosong dan ≥ 90 detik main sejak naik level terakhir di sesi ini (`DETIK_TENANG_SAMBUTAN` di `src/main.ts`, konstanta tampilan). Naik level di sesi lalu tidak dihitung, jadi popup paling lambat tampil di awal sesi berikutnya. Alasannya: Lv 6 juga membuka Perluasan 2 dan slot PO ke-4, dan di build popup sempat muncul di detik yang sama dengan toast keduanya.

### 7.2 Edge case

| Kasus | Aturan |
|---|---|
| Kas Rp 0 | Tidak ada tugas yang butuh uang selain *kelola*, dan templat *kelola* hanya dibuat bila aksinya aman (cadangan B). Bila kas turun sesudahnya: ganti gratis. Tugas *main*, *sorotan* tetap jalan |
| Slot penuh / tidak ada PO tersisa | `bangun`/`daftarPo` tidak layak; kelompok *kelola* jatuh ke `perbaikan`, lalu *sorotan* kedua |
| Pemain absen 1 hari | Set kemarin dibuat saat kembali (berlaku sampai 24.00 hari ini) |
| Pemain absen ≥ 2 hari | Hanya hari ini + kemarin. Tidak ada tumpukan tak terbatas |
| Musim berganti saat offline | Saat dibuka: offline dihitung dulu, lalu event → tantangan (poin minggu lalu ke musim lama) → musim (rapor, musim baru). Popup offline, lalu popup rapor |
| Pemain absen melewati beberapa musim | Rapor hanya untuk musim terakhir yang ia ikuti (poin > 0). Musim yang terlewat tidak menghasilkan rapor kosong |
| Ganti perangkat / cloud save | Blok `musim` ikut save dan cloud save. Konflik tetap ditanya (aturan akun tidak berubah). Tugas hari yang sama dibuat dari undian yang sama, jadi tidak ada keuntungan dari berpindah perangkat |
| Klien lama (0.4.x) membuka save baru | Blok `musim` diabaikan dan **hilang** saat klien lama menyimpan. Karena itu `versiMinimal` naik ke 0.5.0 (keputusan 1) |
| Save lama tanpa blok `musim` | Nilai bawaan: belum terbuka. Bila Lv ≥ 6 dan tutorial selesai, musim terbuka saat dimuat, dengan popup sambutan sekali |
| Jam perangkat dimundurkan | Kunci hari dan musim hanya maju. Tidak ada tugas atau musim yang dibuat ulang. **Sesudah dibangun (AC-GP-22, GP-3):** saat save dimuat dengan jam mundur, poin yang sah tidak dipotong. Hari musim untuk penjepit poin = yang lebih akhir antara jam sekarang dan hari tugas tersimpan, paling banyak 42 |
| Jam dimajukan (curang) | Mendapat tugas hari depan lebih awal. Sama dengan tantangan sekarang; tidak ada server atau papan yang dirugikan |
| Save diubah tangan | Poin dijepit 0–(hari musim × 60 + 7 × 40 × minggu); koleksi dan hiasan yang dipakai disaring dengan daftar di config; tugas dengan templat atau target tidak sah dibuang. **Sesudah dibangun (AC-GP-22, GP-2):** tiket ganti dan Surat Armada juga dijepit saat muat, paling banyak sebanyak yang bisa diberikan tabel hadiah dari Musim 1 sampai musim ini. Tiket = tiket hadiah + tiket pengganti hiasan yang sudah dimiliki = 13 per musim; surat = 2 per musim. Contoh: 1e9 → 13 / 2 di Musim 1 |
| Kecepatan 1× / 2× / 3× | Tugas dihitung dalam waktu main, batas harian membuat poin sama |
| Event berlangsung | Spanduk event menang. Target tugas ikut pasar event (laju lebih tinggi, jadi target lebih tinggi; menitnya tetap ±8–10) |
| Tutorial | Tidak ada langkah baru. Musim baru terbuka setelah tutorial selesai dan Lv 6 |
| Proyek perluasan berjalan | Tidak berpengaruh |
| `?event=` uji | Berlaku seperti event biasa |

## 8. Teks dalam game

Semua ≤ 40 karakter per baris di kartu (360 px), ≤ 60 karakter di baris tujuan. `{…}` diisi saat tampil.

| Tempat | Teks |
|---|---|
| Kepala kartu | `{ikon} {Musim Hujan} · tingkat {7} · sisa {23} hari` |
| Bilah | `{315}/{360} poin` |
| Hadiah berikutnya | `Berikutnya: tingkat {8} · {Seragam jas hujan}` |
| Judul tugas | `Tugas hari ini {2}/3` · `Tugas kemarin · berakhir 24.00` |
| Baris tugas | teks templat (bagian 3.2), angka `{210}/{400}`, `›` bila ada tuas |
| Tugas selesai | `✓` + teks, redup |
| Semua selesai | `Tugas baru besok 00.00 WIB` |
| Tombol ganti | `Ganti` (gratis hari ini) · `Ganti · 1 tiket` · tidak tampil bila tidak ada |
| Catatan kartu | `Tugas berlaku 2 hari. Tugas +10 poin, tantangan mingguan +40. Tugas hanya maju saat kamu bermain.` |
| Hiasan (bagian bawah kartu) | `Hiasan terminal` · baris `Spanduk gapura: Musim Hujan [Pakai/Lepas]` |
| Surat Armada | `Surat Armada (1)` · `PO pilihanmu mendapat armada baru (+½ level)` · tombol `Pakai` · popup `Pilih PO yang mendapat armada baru (+½ level)` · baris PO, satu baris di 360, 540, dan 900×420 untuk level dua digit (AC-GP-21, GP-1): `{Wayang Lestari} · Lv {19} → {79}% ke Lv {20}`, atau `{Ondel-Ondel} · Lv {12} → Lv {13}` bila naik level. Nama PO tanpa awalan "PO". Tombol batal `Nanti`. Toast sesudahnya: `✉️ Surat Armada dipakai: armada baru untuk {PO}` |
| Toast tugas | `📋 Tugas selesai · +10 poin Rapor` |
| Toast naik tingkat | `🎓 Rapor naik ke tingkat {8}: {Seragam jas hujan} terpasang` · tanpa hadiah: `🎓 Rapor naik ke tingkat {9}` |
| Baris tujuan | `📋 Tugas: {Antar penumpang ke Semarang} · {210}/{400}` |
| Popup sambutan, judul | `🌧️ Musim Terminal dimulai!` |
| Popup sambutan, isi | `Tiap hari ada 3 tugas singkat. Selesaikan untuk menaikkan Rapor Musim Hujan dan membuka hiasan terminal. Gratis, tanpa iklan. Tugas berlaku 2 hari.` |
| Popup sambutan, tombol | `Lihat tugas` · `Nanti`. Tampil pada saat tenang (bagian 7.1) |
| Popup rapor, judul | `🎓 Rapor Musim Hujan 2026` |
| Popup rapor, isi | **Sesudah dibangun (AC-GP-21, P-12),** tiap butir satu baris: nilai besar `{Sangat Baik}` · kecil di bawahnya `tingkat {24} dari 30` · `Tugas selesai {96} · tantangan {9}` · `Terminal: Lv {8} → Lv {25}` · `Penumpang saat kamu bermain: {2,3 jt}` (tidak tampil bila 0) · `Hiasan baru: {spanduk, seragam, papan gapura}` · `{🧧 Musim Imlek} dimulai hari ini.` Rancangan semula, `Nilai: … (tingkat … dari 30)` dan `Terminal: Lv … → Lv … · … penumpang`, terbungkus dua baris. Angka penumpangnya juga terbaca sebagai seluruh penumpang terminal, padahal hanya yang saat main aktif (di playtest "Lv 6 → Lv 77 · 236 rb penumpang", sedangkan XP-nya ±7,6 jt) |
| Popup rapor, tombol | `Oke` |
| Bingkai foto | baris kecil `{MUSIM HUJAN 2026} · {Lencana Lulus}` di bawah keterangan |

**Nama kota** di teks tugas memakai huruf judul ("Semarang"), bukan kapital seperti papan bus, supaya baris tidak terlalu panjang.

**Bahasa Inggris:** game belum punya teks Inggris (selain `privasi.html`), jadi tidak disediakan.

## 9. Save dan analitik

### 9.1 Save (butuh izin owner, keputusan 1)

Blok opsional baru `musim` di `GameState` dan `SaveV3`. **Skema tetap 3**: blok opsional yang hilang diisi bawaan, sesuai aturan `save.ts` (seperti `TantanganAktif.ambang` di dokumen 15).

```ts
type TemplatTugas = 'penumpang' | 'laba' | 'kota' | 'antarpulau' | 'kelasTinggi' | 'poTerendah' | 'kios' | 'parkir' | 'kepuasan' | 'perbaikan' | 'bangun' | 'daftarPo';
type SlotHiasan = 'spanduk' | 'seragam' | 'papan' | 'bingkai';   // ronde 2: 'umbul', 'telolet', 'cat'
interface TugasAktif {
  hari: string;               // kunci hari WIB "2026-12-01"
  templat: TemplatTugas;
  target: number;
  progres: number;
  param: number | string | null; // indeks jurusan, id PO, ambang kepuasan, atau komponen kepuasan
  selesai: boolean;
}
interface MusimState {
  id: string | null;          // tanggal Senin awal musim; null = belum terbuka
  poin: number;
  tugas: TugasAktif[];        // maks. 6 (hari ini + kemarin)
  hariTugas: string | null;   // hari terakhir yang tugasnya dibuat (hanya maju)
  gantiHari: string | null;   // hari ganti gratis terakhir dipakai
  tiketGanti: number;
  suratArmada: number;
  koleksi: string[];          // id hiasan & lencana
  pakai: Record<SlotHiasan, string | null>;
  statistik: { tugas: number; tantangan: number; lvAwal: number; penumpangAwal: number };
  riwayat: { id: string; tingkat: number }[];
  rapor: RaporMusim | null;   // rapor yang belum ditampilkan
  sambutan: boolean;          // popup sambutan sudah tampil
}
```

- **Ukuran** (`sim/ukur-musim.mjs`): musim pertama ±1.200 karakter, setahun (9 riwayat, 14 koleksi) ±1.900, lima tahun ±4.400. Save akhir permainan sekarang ±4.700 karakter; batas dokumen cloud 100.000. Tidak perlu dibatasi, tapi `riwayat` cukup `{id, tingkat}`.
- **Klien lama** mengabaikan blok ini dan menghapusnya saat menyimpan. Pemain dengan dua perangkat, satu masih 0.4.x, bisa kehilangan progres musim lewat cloud save. **Saran: `versiMinimal` 0.5.0.** PWA web cukup dimuat ulang, jadi biayanya kecil.
- **Rollback** ke 0.4.x: blok `musim` hilang pada simpan berikutnya. Progres ekonomi aman (skema 3 tidak berubah). Catat di rencana rollback rilis.
- Tidak ada `localStorage` terpisah: hiasan dan lencana ikut cloud save, karena itu progres.
- **Sesudah dibangun.** `bacaMusim` (`src/sim/save.ts`) menyaring blok ini dan **tidak pernah menolak save**, supaya progres ekonomi tidak hilang karena data musim. Yang dilakukannya:
  - Blok yang bukan objek menjadi bawaan.
  - Id musim harus awal musim menurut config.
  - Poin dijepit ke yang mungkin di hari musim itu; jam mundur tidak memotongnya (bagian 7.2).
  - Tiket dan Surat Armada dijepit ke jumlah hadiah sejak Musim 1.
  - Tugas dengan templat, target, atau param tidak sah dibuang.
  - Koleksi dan `pakai` hanya memuat id dari config, dan hiasan yang dipakai harus dimiliki.

  Field save tidak bertambah dari daftar di atas.

### 9.2 Analitik (butuh izin owner, keputusan 2)

| Peristiwa | Data | Kapan | Volume per pemain |
|---|---|---|---|
| `musim_buka` | `musim` (id) | musim terbuka pertama kali bagi pemain itu | 1 |
| `tugas_selesai` | `templat`, `musim`, `kelas` (kelas terminal 0–3+) | tugas selesai | ≤ 6/hari |
| `tugas_ganti` | `templat`, `cara` (`gratis`/`tiket`) | ganti tugas | ≤ beberapa/hari |
| `rapor_naik` | `musim`, `tingkat` | naik tingkat | ≤ 30/musim |
| `rapor_musim` | `musim`, `tingkat`, `tugas`, `tantangan` | popup rapor tampil | 1/musim |
| `hiasan_pakai` | `slot`, `item`, `pakai` (boolean) | pakai/lepas manual (bukan otomatis) | jarang |
| Parameter baru `ringkasan_sesi.musim_tingkat` | angka 0–30 (−1 = belum terbuka) | tiap ringkasan sesi | – |

- Tanpa data pribadi, tanpa teks bebas, tanpa nama terminal atau nama PO pilihan pemain.
- Lewat `PencatatAnalitik` (`src/app/analitik.ts`). `hiasan_pakai` masuk `SEKALI_PER_SESI` per data.
- **Untuk owner di konsol GA4:** daftarkan dimensi khusus `templat`, `musim`, `tingkat`, `cara`, `slot`, `item`, `pakai`, dan metrik `musim_tingkat`, supaya muncul di laporan. Ini pekerjaan konsol, bukan kode.
- **Batas:** tanpa peristiwa "tugas dibuat", persen selesai per templat hanya bisa diperkirakan dari undian hari yang deterministik. Cukup untuk membuang templat yang paling sering diganti.
- **Tidak ada data uji dari mesin ini ke properti GA4 asli.**

### 9.3 Privasi

`privasi.html` bagian 2d sudah menyebut "kejadian di dalam game, misalnya …" dan "ringkasan tiap sesi". Peristiwa musim termasuk jenis itu, jadi **pemrosesan data tidak berubah**. Saran: Dodi memeriksa, dan bila halamannya disentuh, mengganti contoh lama ("upgrade di level tertentu, merekrut Kepala") dengan contoh tycoon dan tugas musim, lalu memperbarui tanggal berlaku (bahasa Indonesia dan Inggris). Owner memutuskan apakah itu ikut rilis Musim.

## 10. Antarmuka antar-area

**Gameplay (Raka):**

- **Config baru `src/config/musim.config.ts`:** `MUSIM = { mulai: '2026-11-30', mingguPerMusim: 6, tema: [...], lvBuka: 6, tugas: { perHari: 3, berlakuHari: 2, maksTerbuka: 6, durasiJam: 8, naikSorotan: 1.25, kepuasanMin: 0.5, kepuasanMaks: 0.8, gantiGratisPerHari: 1 }, poin: { tugas: 10, tantangan: 40, perTingkat: 45, tingkat: 30 }, hadiah: [{ tingkat, jenis, id, jumlah? }], nilai: [10, 20, 30] }`. Kunci templat dan kelompok di sini juga.
- **Modul murni baru `src/sim/musim.ts`** (lapisan sim, tanpa DOM/three.js):

```ts
export function kunciHariWib(ms: number): string;
export function musimPada(ms: number, cfg?): { id: string; ke: number; tema: IdTema; mulaiMs: number; selesaiMs: number };
export function buatTugasHari(state: GameState, hari: string, kecuali: ReadonlySet<TemplatTugas>, cfg?): TugasAktif[];
export function kotaSorotan(state: GameState, hari: string, cfg?): number | null;
export function majukanTugas(m: MusimState, ctx: KemajuanTick): MusimState;   // dipanggil tick, main aktif saja
export function tingkatRapor(poin: number, cfg?): number;
export function hadiahTingkat(tingkat: number, musim: string, cfg?): HadiahMusim | null;
export function perbaruiMusim(state: GameState, ms: number, cfg?): GameState; // buka, hari baru, susulan, pergantian musim, rapor
export function hiasanAktif(state: GameState): Record<SlotHiasan, string | null>; // dibaca adegan
export function teksTugas / tuasTugas …                                          // untuk UI (boleh di src/ui)
```

- **`src/sim/state.ts`:** `GameState.musim`; `buatStateBaru` mengisi bawaan; `tick` memanggil `majukanTugas` dengan konteks yang sudah dihitung tick (penumpang, labaKemajuan, segmen, kepuasan, pendapatan kios/parkir); `perbaruiJamNyata` menjadi event → tantangan → musim; `klaimTantangan` dan kiriman otomatis menambah poin musim; aksi bangun/beliTeknologi/daftarPo/rekrut menilai tugas *kelola*.
- **Aksi baru `src/sim/aksi.ts`:** `{ jenis: 'gantiTugas', indeks, cara: 'gratis' | 'tiket' }`, `{ jenis: 'pakaiHiasan', slot, item: string | null }`, `{ jenis: 'pakaiSuratArmada', po }`, `{ jenis: 'tutupRapor' }`, `{ jenis: 'tutupSambutanMusim' }`.
- **`src/sim/save.ts`:** `bacaMusim` (opsional, disaring); `keSaveV3` menulis blok.
- **`src/app/tujuan.ts`:** jenis `tugas` di tingkat 5 sebelum `naikLevel` (status, `aksi: null`).
- **`src/app/analitik.ts`:** peristiwa bagian 9.2.
- **UI:** `model.ts` (`ModelMusim`), `menu.ts` (kartu musim di atas tab Target, hiasan, Surat Armada), popup baru `popup-musim.ts` (sambutan, rapor, pilih PO surat), `notifikasi.ts` (toast), `baris-tujuan.ts`, `foto.ts` (bingkai, lencana), `teks.ts`, `gaya.css`.

**Grafis (Panji):**

- **Config baru `src/config/hiasan-musim.ts`:** per id hiasan: teks & warna spanduk, warna baju seragam (dan untuk peran mana), warna papan gapura. Ronde 2: palet umbul, melodi, cat bus.
- `event3d.ts`: `HiasanEvent.perbarui(event, spandukMusim)`: event menang; spanduk musim satu grup per id yang sudah dipakai, dibangun saat pertama dibutuhkan.
- `kelas3d.ts`: `HiasanKelas.perbarui(kelas, nama, papanMusim)`.
- `terminal3d.ts`: penampilan petugas peron & gerbang membaca seragam musim; ganti warna instans saat berubah.
- **Membaca saja** `hiasanAktif(state)`. Tidak ada aksi dari adegan.

**Platform (Dodi):** pemeriksaan `privasi.html`; daftar dimensi GA4 untuk owner; `versiMinimal` dan catatan rilis saat rilis. Tidak ada server, tidak ada `ops.json` di ronde 1, tidak ada tempat iklan baru (kecuali owner memilih alternatif keputusan 4, lalu `TempatIklan` + `'gantiTugas'` lewat `hadiahSetelahIklan`).

**File bersama:** `src/main.ts` (sambungan popup musim sesudah popup offline, `hiasanAktif` ke adegan) dan `README.md` dipegang satu agen, dipilih brief (saran: Raka).

### 10.1 Antarmuka sesudah dibangun (5 November 2026)

Penyimpangan dari daftar di atas diterima Sapto karena hanya internal (brief bagian 9). Bila daftar di atas dan kode berbeda, kode yang benar.

**`src/sim/musim.ts`, ekspor yang dipakai area lain:**

```ts
// Kalender
kunciHariWib(ms): string; geserHari(hari, geser): string;
musimPada(ms, cm?): MusimKalender | null;  // null sebelum Musim 1 (30 Nov 2026); MusimKalender memuat { id, ke, tema, tahun, mulaiMs, selesaiMs }
musimDariId(id, cm?): MusimKalender | null;
// Poin, tingkat, hadiah
tingkatRapor(poin, cm?): number; nilaiRapor(tingkat, cm?): NilaiRapor; lencanaMusim(tingkat, cm?): JenisLencana | null;
hadiahTingkat(tingkat, tema, cm?): HadiahMusim[];  // daftar: tingkat 30 memberi lencana + bingkai emas
hadiahBerikut(tingkat, tema, cm?): { tingkat; hadiah: HadiahMusim[] } | null;
tambahPoin(m, poin, cm?); kreditTantangan(m, cm?);
// Tugas
buatTugasHari(state, hari, kecuali, cfg?, cm?): TugasAktif[]; buatTugas(state, templat, hari, cfg?, cm?): TugasAktif | null;
kotaSorotan(state, hari, cfg?, cm?): number | null;
majukanTugas(m, ctx: KemajuanTick, cfg?, cm?): MusimState;  // dari tick saja
nilaiTugasKelola(state, jenisAksi, cfg?, cm?): GameState;   // dari terapkanAksi
// Tuas (bagian 3.2, AC-GP-17)
type AksiTuas = Aksi bangun | beliTeknologi | rekrut | saranTarif | daftarPo;
type TuasTugas = { jenis: 'aksi'; aksi: AksiTuas } | { jenis: 'keuangan' } | { jenis: 'kepuasan' };
bangunanAman(state, cfg?): aksi bangun/beliTeknologi termurah yang lolos cadangan B | null; adaBangunAman(state, cfg?): boolean;
perbaikanTerlemah(state, cfg?, cm?): { komponen; target; aksi: AksiTuas } | null;
peringkatTuas(state, tugas, cfg?, cm?): readonly AksiTuas[];  // mahal; tanpa menilai kas
tuasTugas(state, tugas, cfg?, cm?, peringkat?): TuasTugas | null;  // aksi pertama yang berlaku dan aman sekarang
// Buka, hari baru, pergantian
bisaBukaMusim(state, ms, cfg?, cm?): boolean; bukaMusim(state, ms, cfg?, cm?): GameState;  // dipanggil main.ts: syarat tutorial per perangkat
perbaruiMusim(state, ms, cfg?, cm?): GameState;  // dari perbaruiJamNyata, sesudah event dan tantangan
// Aksi
caraGanti(m, indeks, cm?); gantiTugas(...); pakaiHiasan(...); xpSuratArmada(xp, cfg?, cm?); pakaiSuratArmada(...); tutupRapor(state); tutupSambutanMusim(state);
// Adegan
hiasanAktif(state): Record<SlotHiasan, string | null>;
```

- **`cadanganKas`** pindah dari `src/app/tujuan.ts` ke `src/sim/state.ts`, dan diekspor ulang dari `tujuan.ts`. Alasannya: baris tujuan dan tugas kelola memakai aturan yang sama.
- **UI:**
  - `src/ui/model.ts`: `ModelMusim`, `ModelTugas` dengan `tuas: TuasTugas | null`, `ModelSuratPo`. `urutanKartuTarget(m): KartuTarget[]` mengatur kartu yang bisa diklaim di atas kartu Musim. Tuas disimpan per susunan terminal, dan dinilai ulang paling cepat tiap 5 detik main.
  - `src/ui/baris-tujuan.ts`: `sasaranTugas(ModelTugas)` menerjemahkan tuas menjadi tab dan tombol yang disorot. Tidak pernah menjalankan aksi.
  - `src/ui/popup-musim.ts`: `tampilkanPopupSambutanMusim`, `tampilkanPopupRapor` dengan `isiRapor` (murni), `tampilkanPopupSuratArmada` dengan `teksSuratPo`.
  - `src/ui/overlay.ts`: `notifSepi()` (antrean toast kosong).
  - `src/main.ts`: `DETIK_TENANG_SAMBUTAN` = 90.
  - `src/ui/foto.ts`: `bingkaiFoto(state)`.
  - Teks di `src/ui/teks.ts`.
- **Grafis:**
  - `src/config/hiasan-musim.ts` (`SPANDUK_MUSIM`, `SERAGAM_MUSIM`, `PAPAN_MUSIM`; nilai bagian 4.2).
  - Modul murni `src/game/musim-adegan.ts` (`spandukMusim(pakai, event)`, `papanMusim`, `seragamMusim`, `bajuMusim(peran, seragam)`), di `GAME_MURNI`.
  - `HiasanEvent.perbarui(event, spandukMusim)` dan `HiasanKelas.perbarui(kelas, nama, papanMusim)`.
  - `terminal3d.ts` membaca `hiasanAktif(state)` langsung tiap frame, bukan lewat main.ts.
- **Tes dan fixture:** `tests/musim.test.ts`, `tests/hiasan-musim.test.ts`, `tests/fixtures/musim/*.json` (6 save pengikut tujuan dari playtest, nama terminal kosong).
- **Saklar dev:** `?tanggal=YYYY-MM-DD[THH:MM]` (WIB, hanya `import.meta.env.DEV`) menggeser jam dinding untuk mencoba Musim sebelum 30 November 2026. Tidak ada di build produksi.

## 11. Kriteria penerimaan (usulan)

**Gameplay & UI**

- **AC-GP-01 Kalender:** `musimPada` benar di batas Senin 00.00 WIB (detik sebelum dan sesudah), musim ke-0..12, tema berulang sesudah daftar habis. `kunciHariWib` benar di 23.59/00.00 WIB.
- **AC-GP-02 Undian:** state dan kunci hari yang sama → tugas yang sama (tes deterministik). Tiga tugas dari tiga kelompok bila layak; tidak pernah templat yang tidak layak; target sesuai 3.2.
- **AC-GP-03 Hanya main aktif:** `terapkanOffline` tidak mengubah `musim.tugas` (tes). Hasil sama di 1× dan 3× per detik main.
- **AC-GP-04 Berlaku 2 hari:** absen kemarin → set kemarin dibuat saat kembali; absen ≥ 2 hari → hanya kemarin + hari ini; maks. 6; kunci hari hanya maju (tes jam mundur).
- **AC-GP-05 Poin & tingkat:** +10 per tugas, +40 per tantangan (klaim dan kiriman otomatis), masuk musim minggu itu; tingkat = min(30, ⌊poin/45⌋). Tidak ada aksi musim yang mengubah `kas`.
- **AC-GP-06 Hadiah:** hadiah per tingkat sesuai 4.1, otomatis, hiasan langsung dipakai; tiket dan surat bertambah; Surat Armada memberi XP ½ × kebutuhan level berikutnya PO yang dipilih (rumus `berikanPaket`), hanya ke PO terdaftar.
- **AC-GP-07 Ganti:** 1 gratis per hari, lalu tiket; pengganti dari kelompok yang sama dan bukan templat yang terbuka; tugas selesai tidak bisa diganti.
- **AC-GP-08 Pergantian musim:** di sesi aktif dan saat dibuka sesudah offline: rapor tersimpan sekali, tampil sesudah popup offline, poin 0, koleksi/pakai/tiket/surat tetap, riwayat bertambah; musim terlewat tanpa poin tidak membuat rapor.
- **AC-GP-09 Buka:** tutorial selesai dan Lv ≥ 6; save lama dengan Lv ≥ 6 terbuka saat dimuat; popup sambutan sekali.
- **AC-GP-10 Save:** blok opsional, skema 3; save 0.4.x dimuat tanpa galat; nilai tidak sah disaring (tes); ukuran blok ≤ 2.500 karakter pada save setahun.
- **AC-GP-11 UI:** kartu musim, hiasan, popup sambutan, rapor, dan Surat Armada terbaca tanpa meluap di 360×740, 540×960, dan 900×420; tiap baris tugas satu baris teks + bilah; target ketuk ≥ 44 px; `›` membuka tab/popup yang benar.
- **AC-GP-12 Baris tujuan:** jenis `tugas` hanya di tingkat 5, ≤ 60 karakter; `tests/tujuan-sim.test.ts` lulus tanpa diubah (kedip 0, kas menipis 0); `docs/design/20261029-arah-pemain-baru/sim/playtest-30.ts` (P20/P45, 1×/3×) dijalankan ulang: kas menipis 0, petugas berhenti 0.
- **AC-GP-13 Tempo:** `tests/tycoon-tempo.test.ts` dan `tests/tycoon-kasual.test.ts` lulus tanpa diubah.
- **AC-GP-14 Harness musim:** `sim/musim-sim.ts` dijalankan ulang di atas kode yang dibangun (memakai fungsi asli, bukan tiruan): K3, K2, J4 baru dan lama, hasil dalam ±1 tingkat dari bagian 6, kas menipis 0, petugas berhenti 0.
- **AC-GP-15 Teks** sesuai bagian 8. README bagian Target & tantangan, Save, dan Analitik diperbarui.

**Tambahan ronde perbaikan 1** (brief bagian 9, dari playtest Citra dan QA gameplay; tanpa angka config, field save, atau peristiwa baru):

- **AC-GP-16 (P-1):** templat kepuasan hanya dibuat bila kepuasan ≥ `kepuasanMin`. Kemajuan bila `round(kepuasan × 100) ≥ ambang × 100`. Harness musim J3 baru `TANGGAP_KEP=0`: kepuasan selesai.
- **AC-GP-17 (P-2, P-3, P-5, P-6):**
  - Aksi yang disorot tuas, bila diterapkan, menaikkan kemajuan tugasnya (tes murni pada state setara save Lv 15, 19, 30, 43, 77).
  - Tanpa aksi seperti itu, tanpa tuas.
  - Tuas bangun hanya menunjuk aksi yang lolos cadangan B.
  - Kelas tinggi dan antarpulau menyorot PO yang punya arus itu.
- **AC-GP-18 (P-4):** dengan target harian atau tantangan yang bisa diklaim, tombol Klaim pertama terlihat tanpa menggulir saat tab Target dibuka, di 360×740, 412×915, 540×960, dan 900×420.
- **AC-GP-19 (P-7):** popup sambutan tidak tampil dalam 90 detik main sesudah naik level atau saat ada toast di antrean. Ia tampil paling lambat di awal sesi berikutnya. Musim tetap terbuka di Lv 6.
- **AC-GP-20 (P-8, P-9):** baris Surat Armada terlihat tanpa menggulir saat tab Target dibuka (bila tidak ada klaim lain). Templat laba tidak dibuat bila laba dengan kontrak ≤ 0.
- **AC-GP-21 (GP-1, P-12):**
  - Pilihan Surat Armada satu baris di 360, 540, dan 900×420 untuk level dua digit.
  - Rapor: nilai dan tingkat dipisah. "Terminal: Lv a → Lv b" dan "Penumpang saat kamu bermain: n" dua baris; baris penumpang disembunyikan bila 0.
- **AC-GP-22 (GP-2, GP-3):** `tiketGanti` dan `suratArmada` dijepit saat muat ke batas yang mungkin menurut tabel hadiah. Jam perangkat mundur tidak memotong poin yang sah.

**Hasil (5 November 2026):** QA gameplay PASS WITH NOTES. AC-GP-01..15 PASS, AC-GP-17..22 PASS. AC-GP-16 diterima Sapto dengan 8/9 pada J3 baru: satu tugas dibuat 36 detik sebelum sesi berakhir, lalu kedaluwarsa karena J3 baru main lagi hari Jumat. Penyebabnya masa berlaku dan jadwal, bukan aturan kepuasan; J3 lama 10/10. Harness musim di atas kode asli sama dengan bagian 6 (selisih 0). playtest-30 kas menipis 0 dan petugas berhenti 0. Musim AC-GFX-01..06 PASS menurut Panji (beban di bagian 4.2).

**Grafis & audio**

- **AC-GFX-01:** spanduk musim tampil di gapura bila dipakai dan tidak ada event; event selalu menang; posisi dan ukuran sama dengan spanduk event.
- **AC-GFX-02:** seragam musim mengganti warna baju petugas peron dan gerbang saja; satpam, loket, dan pekerja proyek tidak berubah; berlaku siang, malam, dan hujan.
- **AC-GFX-03:** papan gapura musim berlaku untuk papan bawaan dan papan bernama, teks tidak berubah, bintang Terpadu tetap.
- **AC-GFX-04:** melepas hiasan mengembalikan tampilan bawaan persis (screenshot sebelum/sesudah).
- **AC-GFX-05:** landscape 900×420 tingkat 1, tahap 3, save yang sama: spanduk dipakai +≤ 2 draw call; seragam dan papan +0 draw call dan +0 segitiga, dalam derau ±9. Minggu event: draw call sama dengan tanpa hiasan musim.
- **AC-GFX-06:** screenshot 540×960, 412 dan 900×420, siang dan malam, dengan dan tanpa hiasan: spanduk dan papan terbaca sebagai warna dan bentuk (teks tidak wajib terbaca di 412, karena tilt-shift).

**Platform**

- **AC-PLT-01:** peristiwa dan parameter bagian 9.2, tanpa data pribadi, hanya lewat `PencatatAnalitik`; tidak ada peristiwa uji dari mesin ini ke GA4 asli.
- **AC-PLT-02:** `privasi.html` diperiksa (bagian 9.3); bila diubah, ID dan EN, tanggal berlaku baru.
- **AC-PLT-03:** fitur musim berjalan penuh tanpa jaringan; tidak ada permintaan jaringan baru.
- **AC-PLT-04:** cloud save membawa blok `musim` utuh (tes akun: unggah lalu unduh).
- **AC-PLT-05 (saat rilis):** `versiMinimal` 0.5.0 bila disetujui; catatan rilis ≤ 3 butir pendek yang muat di popup 0.4.x pada 900×420. Ingatkan `npm run cap:sync` sebelum APK berikutnya.

## 12. Ronde dan besar pekerjaan

| Ronde | Isi | Kenapa begini |
|---|---|---|
| **1** (0.5.0) | Kalender, 12 templat tugas, poin, 30 tingkat, rapor, popup sambutan & rapor, kartu di tab Target, baris tujuan, analitik; hadiah: lencana, bingkai foto, spanduk, seragam, papan gapura, tiket ganti, Surat Armada; tema musim 1–3 | Tanpa server, tanpa model 3D baru. Semua hiasan adegan memakai benda yang sudah ada |
| **2** (sesudah ±3 minggu data GA4 musim 1, APPROVE sendiri) | Cat bus musim untuk PO pilihan, umbul-umbul musim, melodi telolet musim, layar Koleksi (memakai hiasan musim lalu), 3–5 event kalender baru (Imlek, ngabuburit, libur sekolah), kota sorotan dengan pasar +, `ops.json` untuk pengumuman, gambar rapor untuk dibagikan, ringkasan save konflik menyebut tingkat rapor | Menunggu data: templat mana yang diganti, apakah tingkat 30 terlalu mudah, apakah hiasan dipakai. Event baru dan pasar kota sorotan adalah angka ekonomi dan beban adegan |

**Ronde berikutnya: dari playtest dan QA ronde 1** (`docs/design/20261104-musim-terminal-playtest.md`). Tidak masuk 0.5.0; tiap butir tugas sendiri.

| # | Isi | Pemilik | APPROVE owner |
|---|---|---|---|
| P-10 | **Dari daftar kerja ke pilihan.** Di build, dua dari tiga tugas selesai hanya dengan bermain, dan tugas kelola muncul di 43–58 % hari, hampir selalu sama dengan saran baris tujuan. Arah yang diusulkan: pilih 1 dari 2 untuk slot sorotan; kota sorotan dengan pasar +25 % (baris ronde 2 di atas); sorotan dengan imbal balik (mis. pendapatan parkir naik tanpa kepuasan turun di bawah X); templat kepuasan diganti peristiwa (hari hujan, jam sibuk). Dirancang dan disimulasikan sesudah data `tugas_ganti` dan menit selesai per templat | Citra | **Ya** |
| P-11 | Tugas kemarin, yang lebih dulu hangus, tampil di bawah tugas hari ini dan berada di luar layar portrait. Usul: di atas bila ada yang terbuka, atau "+2 tugas kemarin ↓" di subjudul | Raka | Tidak |
| P-13 | Teks kecil kartu: "Berikutnya: tingkat 5 (225 poin) · …" supaya tidak terbaca sebagai target bilah; hapus "(kini …)" dari tugas perbaikan (masih tampil di build); "Ganti gratis lagi besok" saat tombol Ganti hilang | Raka | Tidak |
| P-14 | Toast tugas menyebut tugasnya ("📋 Selesai: {teks pendek} · +10"); naik tingkat yang terjadi saat game dimuat (mis. kiriman otomatis tantangan Senin) juga diberi toast | Raka | Tidak |
| P-15 | Hari pertama musim berakhir di "Tingkat 0 · 30/45 poin"; hadiah pertama baru datang di hari kedua. Diukur dulu dengan `rapor_naik` tingkat 1 per hari sejak `musim_buka`. Bila banyak yang tidak kembali, Lencana Peserta diberikan saat musim terbuka | Citra | **Ya bila diubah** (tabel hadiah) |
| – | **Kartu Musim ringkas:** kepala, bilah, "3 tugas · 1 selesai", ketuk untuk membuka. Kartu penuh mengisi seluruh panel tab Target di HP, dan urutan kartu (bagian 7.1) hanya menolong saat ada klaim | Raka (rancangan Citra) | Tidak, bila tata letaknya tetap dalam dokumen ini |
| – | **Aturan "hari musim dibuka":** tugas yang dibuat menjelang akhir sesi bisa kedaluwarsa sebelum pemain jarang kembali (AC-GP-16 J3 baru 8/9). Pilihannya: hari pembukaan memberi set yang berlaku sampai akhir hari berikutnya dihitung dari sesi kedua, atau set pertama dibuat sesudah sesi berikutnya dimulai. Perlu simulasi J3 dan J4 | Citra | Tidak bila tetap dalam aturan masa berlaku; ya bila mengubah angka |
| – | **Hari terakhir musim:** tugas Minggu yang setengah jalan hilang pada Senin 00.00, padahal kartu menjanjikan "berlaku 2 hari". Usul teks: subjudul "Tugas hari ini · berakhir 24.00 (musim selesai)" di hari terakhir | Raka | Tidak |
| G-1 | Kembang api peresmian di siang hari samar di 412 karena tilt-shift (dokumen 16 bagian 6). Ikut di sini karena perayaan naik tingkat atau rapor bisa memakainya kelak | Panji | Ya bila tampilannya diubah |

**Besar pekerjaan ronde 1** (S = 1–2 hari kerja satu agen, M = 3–5, L = > 1 minggu):

| Agen | Pekerjaan | Besar |
|---|---|---|
| Raka | `musim.config.ts`, `src/sim/musim.ts` + tes, hook di `state.ts`/`aksi.ts`/`save.ts`, tujuan, analitik, kartu & popup & toast, Surat Armada, bingkai foto, README | **M–L** |
| Panji | `hiasan-musim.ts`, spanduk musim di `HiasanEvent`, warna papan di `HiasanKelas`, warna seragam di `terminal3d.ts`, ukur draw call, screenshot | **S** |
| Dodi | Periksa privasi, daftar dimensi GA4, catatan rilis & `versiMinimal` saat rilis | **S** |
| Nisa | Gameplay (kalender, pergantian offline, cloud, 360/900), grafis (hiasan, draw call), platform (analitik, offline) | **M** |
| Citra | Playtest build (tugas terasa sebagai keputusan atau daftar kerja?), dokumen 13 bagian 2, 10, 11, 13; pindahkan draf ini ke `documents/17` | S |

Panji bisa mulai bersamaan dengan Raka: adegan membaca `hiasanAktif(state)`, dan save uji bisa menyuntikkan blok `musim` dengan `pakai` terisi.

## 13. Bukti simulasi

**Harness** `sim/musim-sim.ts`: pengikut tujuan (tutorial, lalu baris tujuan dokumen 14, reaksi 20 dtk), klaim target/tantangan/penghargaan begitu bisa, `terapkanOffline` asli di antara sesi, `perbaruiJamNyata` asli (tantangan mingguan sungguhan). Tugas, poin, dan tingkat dirancang **di harness** (kodenya belum ada). Perilaku sadar tugas yang sederhana: tugas *kelola* dikerjakan bila aksinya aman; tugas lain pasif. Musim mulai Senin 30 November 2026, 42 hari.

```
cd D:\projects\game_dev\projects\bustation
npx rolldown D:/projects/game_dev/docs/design/20261104-musim-terminal/sim/musim-sim.ts --platform node --format esm --file <scratch>/musim.mjs
JADWAL=K3|K2|A60|J4|J3 PRA=0|14 KECEPATAN=1|3 [SUSUL=0] node <scratch>/musim.mjs
node D:/projects/game_dev/docs/design/20261104-musim-terminal/sim/ukur-musim.mjs
```

### 13.1 Riwayat rancangan (kenapa aturannya begini)

| Versi | Perubahan | Hasil yang mendorong perubahan |
|---|---|---|
| v1 | 3 tugas dari 4 kelompok, target = laju × 8 jam, tanpa susulan | Semua templat selesai 100 % dalam ±8 menit oleh pemain pasif: tugas menjadi "main 8 menit", bukan keputusan |
| v2 | Tugas kepuasan dengan ambang +5 poin, pemain menanggapi dengan rekrut/bangun | Selesai hanya 2/7 (29 %) di K2 dua minggu, meski 5 aksi kepuasan diambil: sesudah Terpadu kepuasan dibatasi slot kursi, toilet, kios. Ditolak |
| v3 (dipakai) | Tiga kelompok main / sorotan (× 1,25) / kelola (satu keputusan aman), kepuasan tanpa +5, berlaku 2 hari | Bagian 6 dan 13.2 |

### 13.2 Hasil v3

Per profil: tabel bagian 6. Per templat (13 run; "menit" = menit main dari dibuat sampai selesai, median / p90):

| Templat | Ditawarkan per run (6 minggu) | Selesai, pemain harian | Selesai, J3 (1 × 10 mnt) | Menit |
|---|---|---|---|---|
| `penumpang` | 15–23 | 100 % | 94–100 % | 8,0 / 8,1 |
| `laba` | 16–22 | 100 % | 100 % | 8,0 / 8,2 |
| `kota` | 6–11 | 100 % (J4 89–100 %) | 33–57 % | 9,7–10,7 / 10,4–12,6 |
| `antarpulau`, `kelasTinggi`, `poTerendah` | 7–13 masing-masing | 100 % | 75–100 % | ±10 / ±11 |
| `kios`, `parkir` | 5–10 | 100 % | 100 % | ±10 / ±10 |
| `kepuasan` (ambang tanpa +5) | 3–10 | 100 % | 90–100 % | 8,0 / 8,0–9,7 |
| `perbaikan` | 0–5 | 100 % | 75–100 % | 0–2,4 / 0,3–8,7 |
| `bangun` | 11–19 | 100 % | 92–100 % | 0 / 0,3–2 |
| `daftarPo` | 0–5 | 100 % | – | 0 / 0,3 |

- **Kelompok *kelola* hampir selalu "Bangun 1 unit"** (11–19 dari ±21 per run). Sesudah Terpadu masih ada 13–46 unit yang bisa dibangun di awal tiap minggu (izin jendela tiap 2 level, jalur, kios, modernisasi), jadi tugas ini tidak pernah habis selama musim. `perbaikan` jarang layak sesudah Terpadu: komponen kepuasan pengikut tujuan sudah ≥ 95 % atau tidak bisa dinaikkan satu aksi aman.
- **Tugas *sorotan* ±10 menit**, tugas *main* ±8 menit, berjalan bersamaan. Dua sesi 10 menit selalu cukup untuk tiga tugas.
- **v1 (pembanding):** target tanpa pengali dan empat kelompok: semua templat 100 % dalam 8,0–8,3 menit, K3 1.800 poin, K2 1.620–1.690, J4 840–900, J3 540–550 (tanpa susulan). Poinnya hampir sama dengan v3 bagi pemain harian; v3 menambah tuas dan keputusan, bukan kesulitan.
- **v2 (ditolak):** kepuasan +5 dengan pemain yang menanggapi: 2/7 selesai di K2 dua minggu, walau 5 rekrut/bangun diambil.

### 13.3 Dampak ke tempo

Musim tidak memberi uang, XP terminal, boost, atau percepat proyek. Satu-satunya hadiah yang menyentuh ekonomi adalah Surat Armada (+½ level PO pilihan, tingkat 12 dan 25). Tingkat 12 butuh 540 poin; dengan batas 30 poin tugas per hari dan 120 poin tantangan per minggu, **paling cepat hari musim ke-10**. Di run, tingkat 12 selalu tercapai **sesudah** Terpadu:

| Profil (baru) | Terpadu (Lv 30) | Tingkat 12 | Tingkat 25 |
|---|---|---|---|
| K2 | hari 4 | hari 13 | hari 30 |
| J4 | hari 7 | hari 17 | hari 38 |
| J3 | hari 14 | hari 21 | – |

Pemain serakah di patokan tempo mencapai Terpadu dalam 10,9 jam main. Ia baru bisa menerima Surat sebelum Terpadu bila main ≤ ±1 jam sehari tanpa Manajer. Bahkan saat itu, satu Surat (½ level satu PO) sama dengan satu klaim target harian, yang datang tiap 24 menit main, jadi pergeserannya di bawah resolusi patokan. Patokan tempo (pemain serakah tanpa hadiah) dan patokan kasual tidak memakai Musim, jadi `tests/tycoon-tempo.test.ts` dan `tests/tycoon-kasual.test.ts` tidak terpengaruh. Sebagai pembanding besarnya: armada harian (½ level tiap 24 menit main) menggeser Terpadu 10,9 → 10,7 jam (dokumen 15 bagian 4.3); dua Surat per musim adalah sepersekian kecil dari itu.

**Tidak dinilai (NOT ASSESSED):** rasa bosan terhadap tugas, apakah pemain membaca tuas "›", apakah hiasan terlihat di HP, laju nyata pemain jarang, dan pengaruh ke retensi. Yang menguji: playtest build (Citra), playtest 5 pemain selama seminggu dengan buku harian singkat ("kenapa aku membuka game hari ini?"), lalu GA4 bagian 1.3.

## 14. Risiko, pertanyaan terbuka, yang diuji

| Risiko | Mitigasi | Cara menguji |
|---|---|---|
| **Kelelahan daftar kerja.** Di simulasi, tugas main dan sorotan selesai hampir 100 % hanya dengan bermain. **Dikonfirmasi di playtest build** (5 November 2026): tugas kelola hanya muncul di 43–58 % hari, dan tuas hanya mempercepat bila ada aksi yang membantu (bagian 3.2) | Satu tugas *kelola* bila layak; tuas "›" hanya bila memajukan tugas; tanpa beruntun; berlaku 2 hari; templat yang sering diganti dibuang; arah ronde berikutnya P-10 (bagian 12) | `tugas_ganti` per templat; playtest |
| Tugas terlalu mudah bagi pemain harian (tingkat 30 di hari 31–35) | Disengaja: sisa seminggu untuk absen. Sesudah tingkat 30, tidak ada dorongan main berlebih | `rapor_musim.tingkat`; geser `perTingkat` di musim berikutnya tanpa rilis kode bila perlu (angka di config) |
| Tantangan mingguan hampir mustahil bagi pemain ≤ 80 menit/minggu | Poin musim terutama dari tugas; hadiah inti di tingkat ≤ 15 | `klaim_tantangan` per sesi menurut lama main |
| Hiasan tidak terlihat di HP (orang kecil, tilt-shift) | Toast saat dipasang; foto memuat bingkai & lencana | Playtest di 360/412; `hiasan_pakai` |
| Klien lama menghapus blok `musim` | `versiMinimal` 0.5.0 | Tes save klien lama (seperti 2026-11-03) |
| Produksi tema tiap 6 minggu | Tema = data (teks, warna); daftar setahun di config; tema berulang bila habis | Checklist tema per musim |
| Pemain merasa ketinggalan musim | Kosmetik kembali tahun depan; lencana hanya catatan | Ulasan/umpan balik |
| Surat Armada terasa seperti hadiah ekonomi | Hanya ½ level, sesudah Terpadu di semua run, PO dipilih sendiri | Harness bagian 13.3 |
| H5 Games Ads belum aktif | Musim tidak memakai iklan, jadi tidak tergantung | – |

**Pertanyaan terbuka (bukan untuk ronde 1):** kota sorotan dengan pasar +25 % (angka ekonomi); event kalender baru; apakah poin event (tahap event) ikut Rapor; apakah rapor bisa dibagikan sebagai gambar.

**CHANGE REQUEST untuk brief bangun:**

1. Modul dan config baru: `src/sim/musim.ts`, `src/config/musim.config.ts` (Raka), `src/config/hiasan-musim.ts` (Panji).
2. Blok `GameState.musim` dan blok save `musim` (keputusan 1).
3. Jenis tujuan baru `tugas` di `src/app/tujuan.ts` (logika tujuan berubah; harness tujuan dijalankan ulang, AC-GP-12).
4. Peristiwa analitik dan parameter `ringkasan_sesi` baru (keputusan 2); dimensi GA4 didaftarkan owner.
5. `versiMinimal` 0.5.0 saat rilis (keputusan 1).

## 15. Keputusan owner

Lima keputusan, masing-masing dengan saran Citra.

| # | Keputusan | Pilihan | Saran | Alasan |
|---|---|---|---|---|
| 1 | **Blok save `musim`** | (a) blok opsional, skema tetap 3, `versiMinimal` naik ke 0.5.0; (b) sama, `versiMinimal` tetap 0.4.0 | **(a)** | Skema 3 cukup (blok opsional, seperti `ambang`). Tanpa kenaikan `versiMinimal`, klien 0.4.x di perangkat kedua menghapus progres musim lewat cloud save. PWA cukup dimuat ulang |
| 2 | **Peristiwa analitik baru** | 5 peristiwa + parameter `ringkasan_sesi.musim_tingkat` (bagian 9.2), tanpa data pribadi; `privasi.html` tidak wajib berubah | **Ya** | Tanpa `tugas_selesai`/`tugas_ganti` tidak ada cara membuang templat yang membosankan, dan gerbang tahap 1 ("≥ 50 % sesi hari 7–30 berisi tugas") tidak bisa diukur. Owner mendaftarkan dimensi di konsol GA4 |
| 3 | **Isi hadiah** | (a) kosmetik + tiket ganti + Surat Armada (PO pilihan +½ level, tingkat 12 & 25); (b) kosmetik + tiket saja | **(a)** | Surat Armada adalah satu-satunya kemudahan yang tetap berguna sesudah Terpadu (20 PO, level sampai Double Decker) dan menjawab P-8 (memilih PO). Di simulasi ia selalu datang sesudah Terpadu, jadi tempo tidak bergeser |
| 4 | **Iklan di Musim** | (a) tanpa iklan sama sekali di ronde 1; (b) "ganti tugas kedua" lewat iklan opt-in, tanpa poin | **(a)** | Ganti gratis 1/hari + tiket sudah cukup: di simulasi tidak ada templat yang macet bagi pemain harian (hanya "kota sorotan" pas-pasan di sesi tunggal 10 menit). Aturan ganti sendiri belum disimulasikan (NOT ASSESSED; harness punya `GANTI=1`). Musim yang benar-benar bebas iklan lebih mudah dipercaya, dan H5 Ads belum aktif. Dinilai ulang dari `tugas_ganti` |
| 5 | **Kalender dan angka** | Musim 6 minggu mulai Senin 30 Nov 2026 (atau Senin rilis), Musim Hujan; 3 tugas/hari berlaku 2 hari; tugas +10, tantangan +40; 30 tingkat × 45 poin; terbuka di Lv 6 | **Ya** | Bukti di bagian 6 dan 13: pemain harian selesai di hari 31–35, pemain 4 hari/minggu mendapat semua hiasan inti, kas menipis 0 |

**Ringkasan untuk owner (Telegram):**

> Rancangan Musim Terminal siap (Citra).
> 1. Tiap 6 minggu satu musim (mulai Musim Hujan, Senin 30 Nov). Tiap hari 3 tugas singkat, ±10 menit main, berlaku 2 hari, tanpa streak.
> 2. Tugas hanya maju saat main, jadi tidak selesai sendiri lewat offline.
> 3. Rapor 30 tingkat, gratis, tanpa iklan. Hadiah: spanduk gapura, seragam petugas, papan gapura, bingkai foto, lencana, tiket ganti tugas, Surat Armada (PO pilihan +½ level). Tidak ada uang.
> 4. Simulasi: pemain harian selesai di hari 31–35 dari 42; pemain 4 hari seminggu dapat semua hiasan inti.
> 5. Hiasan hampir tanpa beban gambar (0 draw call; spanduk +2 hanya di luar minggu event).
> Butuh keputusanmu: blok save + versiMinimal 0.5.0, 5 peristiwa analitik baru, Surat Armada, Musim tanpa iklan, kalender & angka.
</content>
</invoke>
