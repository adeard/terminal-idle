# 14 · Rancangan Arah Pemain Baru: tujuan berikutnya & menit pertama

> **Status: disetujui owner 29 Oktober 2026 ("APPROVE semua" via Telegram), dalam pembangunan.** Keputusan owner a–c ada di bagian 8. Brief `docs/tasks/20261029-arah-pemain-baru.md` (repo tim). Dasar: evaluasi keseruan 0.3.1, saran 1 dan 2. Catatan kerja, bukti simulasi lengkap, dan screenshot pembanding ada di `docs/design/20261029-arah-pemain-baru.md` (repo tim, tidak ikut repo game).
>
> Tidak mengubah angka ekonomi, tempo, hadiah, atau target. Tidak mengubah save (skema 3, tanpa field baru). Tidak ada iklan baru. Satu peristiwa analitik baru, `tujuan_ketuk` (keputusan c, bagian 6), tanpa data pribadi baru; kebijakan privasi tidak berubah. Yang berubah: tampilan, teks, kamera portrait, dan peristiwa itu.
>
> **Mengubah dokumen 13 bagian 11:** HUD tidak lagi menampilkan "laba hari ini" melainkan **laba rata-rata per hari** (bagian 4.1, keputusan a). Dokumen 13 sudah diperbarui dengan rujukan ke dokumen ini.
>
> **Ronde perbaikan 2 (hasil playtest fase 4, disetujui owner 31 Oktober 2026):** saran Manajer Operasional kini juga butuh laba offline sehari ≥ 0, dan perluasan tahap ≥ 2 memakai cadangan B (bagian 3.1–3.2); teks hitung mundur proyek dan "menabung" (3.4); sasaran "kurangi petugas" (3.5); lencana Target ditahan selama tutorial (3.6); urutan dan teks toast peresmian (3.7); pil kepuasan netral di awal (4.1); tombol popup offline "Oke" (4.5). Tetap tanpa perubahan angka ekonomi, tempo, save, atau analitik. Bukti dan alasannya: `docs/design/20261029-arah-pemain-baru-playtest.md` (repo tim), temuan P-1 sampai P-11.

## 1. Masalah, tujuan, cara mengukur

**Masalah (evaluasi 0.3.1, simulasi dan playtest berskrip):**

1. Setelah tutorial tidak ada "langkah berikutnya". Baris petunjuk HUD hanya berisi saran Manajer Operasional atau "kas menipis". Perluasan 1 terbuka di Lv 3 (±menit 2–3) tanpa notifikasi atau lencana, dan kartunya ada di bagian bawah tab Terminal. Notifikasi Lv 3 malah berkata "Slot PO ke-3 terbuka! Daftarkan PO di tab PO", padahal semua PO di sana menolak karena slot jendela penuh.
2. Menit pertama terasa gagal. "Hari ini −Rp 6.197" merah di detik pertama. Kepuasan turun 44% → 28% tepat setelah langkah 2 tutorial tanpa penjelasan. Kamera portrait jauh (orang ±4 px), dan gelembung tutorial di landscape menutup aula dan loket, padahal loketlah sasaran langkah 1.
3. "Hari ini" bukan cuma merah di detik pertama. Karena uang utama terminal adalah kontrak PO yang dibayar di muka, operasi harian hampir selalu minus di hari tanpa kontrak. Simulasi: HUD merah di **43 dari 60 menit** bagi pemain yang hanya mengikuti tutorial, dan tetap merah walau kas Rp 999 jt.
4. Pemain tidak tahu bahwa proyek perluasan tetap berjalan saat game ditutup. Popup offline tanpa Manajer bahkan berkata "Terminal beroperasi 10 menit" lalu "Terminal tutup selama kamu pergi", tanpa menyebut proyeknya.

**Untuk siapa:** pemain baru di sesi pertama (0–15 menit) dan sesi kedua; baris tujuan tetap berguna sampai akhir permainan.

**Tanda berhasil:**

- GA4: median waktu `tutorial_complete` → `mulai_perluasan` (tahap 1) ≤ 4 menit main (Lv 3 tercapai ±2 menit setelah tutorial; target jedanya < 2 menit). Persentase sesi dengan `ringkasan_sesi.level_terminal` ≥ 3 yang juga punya `mulai_perluasan` tahap 1 naik dibanding 0.3.1.
- GA4 `tujuan_ketuk { jenis }` (keputusan c): persentase sesi setelah tutorial yang mengetuk baris tujuan paling sedikit sekali, dan jenis yang paling sering diketuk. Peristiwa ini dikirim paling banyak sekali per `jenis` per sesi, jadi yang terbaca adalah "berapa sesi memakai saran jenis ini", bukan berapa kali diketuk. Cara membacanya:
  - waktu ke `mulai_perluasan` turun walau ketukan jarang: baris itu bekerja sebagai bacaan, tanpa perlu diketuk;
  - jenis perluasan sering diketuk tapi `mulai_perluasan` tidak menyusul: teks atau sasaran sorotan perlu diperiksa di playtest.
- Playtest 5 pemain baru, 15 menit, think-aloud di ponsel portrait: tidak ada yang berkata "rugi" atau "kenapa sedih" di menit pertama; tiap kali bertanya "terus ngapain?", jawabannya ada di baris tujuan.

## 2. Yang berubah bagi pemain (urut waktu)

1. **Detik 0.** HUD menampilkan "Laba −Rp 1,2 jt/hari" dengan warna netral (bukan merah) selama tutorial. Setelah PO kedua bergabung angkanya menjadi "+Rp 7 jt/hari" (hijau) dan ikut berubah pada tiap keputusan (rekrut petugas, bangun, PO baru). Pil kepuasan ("🙁 28%") juga netral selama tutorial dan jam terminal pertama (ronde perbaikan 2).
2. **Tutorial.** Gelembung lebih pendek dan tidak menutup aula: di portrait ±25% lebih rendah, di landscape pindah ke kiri bawah. Kamera portrait awal lebih dekat sehingga orang dan antrean terlihat.
3. **Langkah 2 (PO bergabung).** Setelah toast "PO bergabung", muncul toast kedua: "🙁 Kepuasan turun 44% → 28%: antrean di Peron. Ketuk untuk rincian". Langkah 3 tutorial (rekrut petugas peron) adalah obatnya.
4. **Penutup tutorial** memperkenalkan baris tujuan: "Baris di bawah kas selalu menunjukkan langkah berikutnya. Ketuk untuk menuju ke sana." Baris itu disorot.
5. **Setelah tutorial.** Satu baris tujuan di bawah HUD, misalnya "🚦 Loket paling lambat: pasang mesin tiket". Mengetuknya membuka tab yang tepat dan menyorot tombolnya selama 3 detik. Baris ini tidak pernah membeli apa pun sendiri.
6. **Lv 3 (±menit 2–3).** Toast "🏗️ Perluasan 1 terbuka: slot jendela loket +2. Bangun di tab Terminal", lencana merah di tab Terminal, dan baris tujuan "🏗️ Bangun Perluasan 1: slot jendela loket +2". Kartu perluasan pindah ke urutan kedua di tab Terminal.
7. **Saat proyek dimulai.** Toast "🏗️ Perluasan 1 dimulai! Selesai dalam sehari terminal, juga saat game ditutup". Baris tujuan menjadi hitung mundur ("🏗️ Perluasan 1 jadi dalam 24 menit, walau game ditutup"), kecuali ada hal yang bisa dikerjakan.
8. **Saat kembali.** Popup offline menyebut proyeknya ("🏗️ Perluasan 1 selesai selama kamu pergi!" atau "… tetap dibangun · selesai dalam 6 menit"), dengan atau tanpa Manajer. Tombolnya "Ambil" hanya bila ada laba yang masuk, selain itu "Oke".
9. **Sepanjang permainan.** Lencana tab PO menghitung tawaran perpanjangan, PO yang bisa didaftarkan, dan jendela kosong yang belum dilihat. Baris tujuan memberi tahu saat ada uang kontrak yang bisa diambil, saat kas menipis beserta obatnya, dan saat sedang menunggu (proyek, menabung, atau naik level).

## 3. Tujuan berikutnya

### 3.1 Aturan

Helper murni `daftarTujuan(state)` menghasilkan semua tujuan yang berlaku, urut prioritas, dan **tidak pernah kosong**: tingkat 5 selalu ada. Tidak ada field save baru. Ingatan "tujuan yang sedang tampil" hanya ada di memori sesi UI.

| Tingkat | Jenis | Berlaku bila | Gaya |
|---|---|---|---|
| **1 Mendesak** | Kas menipis | `kasMenipis` di view model (aturan sekarang tidak diubah). Obatnya dipilih berurutan: perpanjang PO yang bisa diperpanjang (sisa kontrak terpendek dulu) → sewakan jendela kosong → daftarkan PO → kurangi petugas | merah (`bahaya`) |
| 1 | Kontrak hampir habis | Sisa kontrak PO ≤ 1 hari terminal dan PO mau diperpanjang; atau PO menolak (kepuasan mitra / kepuasan penumpang kurang). Tidak berlaku bila Manajer Kemitraan bisa memperpanjangnya | merah |
| **2 Siap** | Perpanjang kontrak | Ada tawaran perpanjangan (sisa ≤ 3 hari) yang bisa diterima; tanpa Manajer Kemitraan | kuning |
| 2 | Sewakan jendela kosong | Jendela kosong > 0; tanpa Manajer Kemitraan | kuning |
| 2 | Daftarkan PO | Ada PO yang `bisaDaftarPo`; dipilih yang pertama dalam urutan tab PO | kuning |
| 2 | Bangun perluasan | Level cukup, tidak ada proyek, dan kas sesudah membayar ≥ **cadangan A** (tahap 1) atau **cadangan B** (tahap ≥ 2) (3.2) | kuning |
| **3 Perbaikan** | Area paling lambat | `bottleneckState`. Calon berurutan: rekrut petugas areanya (peron → petugas peron, keberangkatan → petugas gerbang), bangun jendela loket (bila slot ada), modernisasi area itu yang syaratnya terpenuhi, bangun jalur. Pangkalan: tidak ada calon (bertambah lewat perluasan) | kuning |
| 3 | Kepuasan | Kepuasan < 75%. Komponen dengan kekurangan berbobot terbesar (bobot × (1 − nilai)) yang punya perbaikan: kebersihan → petugas kebersihan (ada < perlu) atau petugas toilet; keamanan → satpam (ada < perlu); kenyamanan → blok kursi (ada < perlu); fasilitas → toilet, kios, lahan parkir yang belum ada | kuning |
| 3 | Manajer Operasional | Belum ada, gajinya aman, dan **laba offline sehari sesudahnya ≥ 0** | kuning |
| **4 Menunggu** | Proyek berjalan | `proyekDetik` > 0 | netral |
| 4 | Menabung untuk perluasan | Level cukup, tapi belum lolos cadangannya (A untuk tahap 1, B untuk tahap ≥ 2) | netral |
| **5 Naik level** | Perluasan berikut | Terkunci level | netral |
| 5 | Kelas berikut | Semua perluasan selesai | netral |

**Syarat aman untuk tingkat 3** (supaya mengikuti saran tidak pernah memunculkan "Kas menipis"):

- kas sesudah aksi ≥ **cadangan B** (3.2);
- aksi bergaji hanya bila laba rata-rata sehari (dengan kontrak) sesudahnya tetap ≥ 0;
- selama perluasan berikut sudah terbuka levelnya tapi belum dibangun, kas juga harus cukup untuk perluasan itu (perluasan didahulukan).

Calon tingkat 3 yang belum aman **tidak ditampilkan**: baris itu hanya berisi hal yang benar-benar bisa dikerjakan sekarang. Di tingkat yang sama, calon pertama yang siap yang dipilih.

**Manajer Operasional** masuk di tingkat 3, terakhir, dan hanya bila gajinya aman (keputusan b). Itu menggantikan saran tetap "Rekrut Manajer Operasional…" yang sekarang tampil sejak detik pertama, dan saran Manajer di penutup tutorial (4.4). Keputusan owner tentang offline (hanya dengan manajer, 8 jam, 60%) tidak berubah.

**Syarat offline untuk Manajer (ronde perbaikan 2, disetujui owner 31 Oktober 2026).** "Gaji aman" di atas memakai laba online, padahal nilai Manajer ada saat game ditutup, dan offline dihitung lain: (pendapatan + kontrak rata-rata) × 60% − biaya penuh (dokumen 13 bagian 9). Dengan dua PO, laba online +Rp 3,0 jt/hari menjadi offline ±−Rp 0,6 jt/hari terminal: −Rp 1,5 jt per jam pergi, −Rp 11,8 jt per 8 jam. Di playtest fase 4 pemain yang mengikuti saran merekrut Manajer di menit 2–4, lalu pulang ke laba minus selama 7 menit (3×) sampai 22 menit (1×) pertama, tepat saat baris tujuan berisi hitung mundur proyek dan pemain paling mungkin pergi. Karena itu Manajer Operasional hanya disarankan bila **laba offline sehari terminal sesudah merekrutnya ≥ 0**, dihitung dengan rumus offline yang sama (`hitungOffline` atas salinan state dengan Manajer, selisih 1.440 detik; murni). Di simulasi syarat ini terpenuhi tepat setelah PO ketiga bergabung; pemain menurut kini merekrut Manajer ±16–17 menit nyata lebih lambat di 3× (P20 2:30 → 18:47), dan Lv 10/15/20 tetap dalam ±1 menit. Pemain yang pergi sebelum itu tidak mendapat XP offline, tapi juga tidak rugi.

**Bila tidak ada yang bisa dikerjakan**, baris berisi status netral (tingkat 4–5): hitung mundur proyek, kekurangan kas untuk perluasan, atau level yang membuka perluasan atau kelas berikutnya. Baris tidak pernah hilang setelah tutorial, jadi tinggi HUD tidak melompat.

### 3.2 Cadangan kas

Operasi harian terminal biasanya minus. Untungnya datang dari kontrak PO yang dibayar di muka. Karena itu saran berbiaya harus menyisakan kas untuk rugi operasi sampai uang kontrak berikutnya bisa masuk.

- `rugiHarian` = max(0, −`acuanHarian(state, tarif pemain).laba` × 24): operasi tanpa kontrak, dasar yang sama dengan `kasMenipis`.
- `hariKeTawaran` = max(1, terkecil dari (sisa kontrak tiap PO − `EKONOMI.mitra.kontrak.hariTawaran`)), dalam hari terminal.
- **Cadangan A** (perluasan tahap 1) = `rugiHarian`(sesudah aksi) × `hariKeTawaran`. Sama dengan aturan pemain serakah di `tests/tycoon-sim.ts`.
- **Cadangan B** (perluasan tahap ≥ 2, bangunan, modernisasi, petugas) = `rugiHarian`(sesudah aksi) × (`hariKeTawaran` + 1). Satu hari tambahan karena "kas menipis" muncul saat kas < rugi sehari.
- "Sesudah aksi" = state setelah aksi diterapkan tanpa memeriksa kas. Kas sesudah aksi menghitung biaya yang keluar dan uang kontrak yang masuk (daftar dan perpanjang PO).

Bukti (catatan kerja bagian 3): cadangan B untuk semua aksi menunda perluasan 1 sampai 56 menit setelah Lv 3. Tanpa cadangan untuk perluasan, "kas menipis" muncul 24–171 detik per 3 jam dan pemain berakhir lebih lambat. Kombinasi A + B tidak pernah memunculkan kas menipis.

**Perluasan tahap ≥ 2 memakai cadangan B (ronde perbaikan 2, disetujui owner 31 Oktober 2026).** "Tidak pernah kas menipis" di atas ternyata bergantung pada gaji Manajer yang direkrut lebih awal. Dengan syarat offline Manajer (3.1), uang yang tadinya untuk gaji langsung masuk ke Perluasan 2 dengan cadangan A, yang tidak punya hari penyangga: di playtest (pemain menurut, 3×) kas menipis muncul tiga kali di menit 14–16, pemain memberhentikan tiga petugas, dan kepuasan turun 56% → 38%. Dengan cadangan B untuk tahap ≥ 2: kas menipis 0 di semua run (1× dan 3×, reaksi 20 dan 45 detik, sampai 180 menit), Lv 10/15/20 pemain 3× di menit 31:34 / 76:00 / 134:39 (sebelumnya 31:59 / 76:34 / 135:29). Tahap 1 tetap cadangan A, supaya perluasan pertama tetap dimulai ≤ 30 detik setelah Lv 3. Perluasan yang belum lolos cadangannya menjadi "menabung" dengan kekurangan terhadap cadangan itu.

### 3.3 Anti-kedip

- Tujuan yang sedang tampil **dipertahankan selama masih berlaku**. Tujuan berbiaya, sekali tampil, tetap berlaku selama kas ≥ biayanya (tanpa cadangan), supaya tidak hilang-muncul saat kas turun sedikit.
- Tujuan bertingkat lebih tinggi menggantikannya hanya setelah yang sekarang tampil ≥ **8 detik nyata** (`TAHAN_TUJUAN_MS = 8000`). Tingkat 1 langsung menggantikan.
- Tujuan setingkat tidak saling menggantikan.
- Angka di dalam tujuan yang sama (hitung mundur, kekurangan kas) boleh berubah, paling sering sekali per detik. Hitung mundur memakai `formatDurasi` ("18 menit", "45 detik"), jadi praktis berubah sekali per menit.
- Tujuan yang baru saja dikerjakan pemain langsung diganti tujuan berikutnya. Itu bukan kedip.

Hasil simulasi: 0 pergantian < 5 detik tanpa aksi pemain di semua run (60 dan 180 menit, 1× dan 3×).

### 3.4 Teks (Indonesia, ≤ 60 karakter setelah diisi)

Batas diukur dengan CSS asli `.hud-petunjuk` dan font sistem (Segoe UI; Roboto di Android lebih sempit). Portrait: kotak 680 px logis, muat ±84 karakter, jadi semua teks satu baris. Landscape: kotak 352 px, ±43 karakter per baris, jadi teks ≤ 60 karakter paling banyak dua baris. `{po}` = nama PO lengkap ("PO Wayang Lestari", terpanjang 17 karakter); uang memakai `formatUang`.

| Jenis | Teks |
|---|---|
| Kas menipis + perpanjang | `⚠️ Kas menipis: perpanjang kontrak {po}` |
| Kas menipis + sewakan | `⚠️ Kas menipis: sewakan jendela loket yang kosong` |
| Kas menipis + daftar PO | `⚠️ Kas menipis: daftarkan {po} (+{nilai})` |
| Kas menipis + petugas | `⚠️ Kas menipis: kurangi petugas sampai kontrak berikutnya` |
| Kontrak hampir habis | `📄 Kontrak {po} tinggal sehari: perpanjang` |
| PO menolak (kepuasan) | `📄 {po} menolak perpanjang: butuh kepuasan {n}%` |
| PO menolak (mitra) | `📄 {po} menolak perpanjang: turunkan sewa loket` |
| Perpanjang | `📄 Perpanjang kontrak {po}: +{nilai}` |
| Sewakan jendela | `🎫 {n} jendela loket kosong: sewakan ke PO, gratis` |
| Daftarkan PO | `🚌 Daftarkan {po}: +{nilai} di muka` |
| Bangun perluasan | `🏗️ Bangun Perluasan {t}: {efek}` |
| Area: rekrut | `🚦 {Area} paling lambat: rekrut petugas {peron/gerbang}` |
| Area: jendela | `🚦 Loket paling lambat: bangun jendela loket · {biaya}` |
| Area: modernisasi | `🚦 {Area} paling lambat: pasang {nama pendek}` |
| Area: jalur | `🚦 {Area} paling lambat: bangun Jalur {n} · {biaya}` |
| Kepuasan: kebersihan | `{wajah} Kebersihan kurang: rekrut petugas kebersihan` |
| Kepuasan: toilet | `{wajah} Toilet kotor: rekrut petugas toilet` |
| Kepuasan: keamanan | `{wajah} Keamanan kurang: rekrut satpam` |
| Kepuasan: kursi | `{wajah} Kursi kurang: bangun blok kursi · {biaya}` |
| Kepuasan: fasilitas | `{wajah} Belum ada {nama}: bangun · {biaya}` |
| Manajer Operasional | `🌙 Rekrut Manajer Operasional: terminal jalan saat kamu pergi` |
| Proyek | `🏗️ Perluasan {t} jadi dalam {durasi}, walau game ditutup` |
| Menabung (kas < biaya) | `🏗️ Perluasan {t}: kumpulkan {uang} lagi` |
| Menabung (kas ≥ biaya) | `🏗️ Perluasan {t}: kumpulkan {uang} lagi untuk cadangan` |
| Naik level | `⬆️ Perluasan {t} terbuka di Lv {L} · kini Lv {K}` |
| Kelas berikut | `⭐ Naik ke {kelas} di Lv {L} · kini Lv {K}` |

- `{efek}` per tahap: 1 "slot jendela loket +2" · 2 "petak bus +10, jendela +2" · 3 "lantai 2, jendela +4" · 4 "jalur +2, petak bus +20" · 5 "jalur +2, jendela +4".
- Nama pendek modernisasi: marka & rambu, pengatur bus, mesin tiket, e-tiket, papan jadwal digital, gate e-boarding.
- `{wajah}` = `wajahKepuasan` sekarang, sama dengan pil kepuasan.
- `{nama}` fasilitas = `NAMA_BANGUNAN` huruf kecil.
- "Menabung" menampilkan **kekurangan** (biaya + cadangan − kas, dibulatkan ke atas; cadangan A untuk tahap 1, B untuk tahap ≥ 2), bukan "kas / target". Alasannya: kas dan cadangan sama-sama turun selama menunggu kontrak, sehingga kekurangannya tetap dan hanya mengecil saat uang kontrak masuk. Format "kas / target" membuat targetnya bergerak.
- **Ronde perbaikan 2 (disetujui owner 31 Oktober 2026):**
  - "Menabung" saat kas sudah ≥ biaya memakai varian "… untuk cadangan". Di playtest baris berkata "kumpulkan Rp 744 rb lagi" dengan kas Rp 84,5 jt, sementara kartu perluasan menampilkan tombol "Bangun Rp 80 jt" yang aktif; pemain mengira hitungan baris salah. Kata "cadangan" memberi alasannya. Terpanjang ±57 karakter.
  - Hitung mundur proyek menyebut bahwa menutup game aman ("walau game ditutup", 54 karakter untuk "24 menit"). Di 1× baris berisi hitung mundur ±24 menit sejak menit ke-3 sesi pertama, sedangkan toast "juga saat game ditutup" hanya tampil 3,5 detik. Tanpa Manajer, terminal yang ditutup tidak menanggung biaya, dan proyeknya tetap jalan.

### 3.5 Tampilan dan ketukan

- Baris tujuan menggantikan `.hud-petunjuk` (posisi dan ukuran sama). Elemennya `button` dengan teks dan "›" di kanan. `aria-label` = teks.
- Warna: tingkat 1 merah (gaya `bahaya` yang ada), tingkat 2–3 kuning seperti petunjuk sekarang, tingkat 4–5 netral (abu, `--redup`). Pemain bisa membedakan "ada yang bisa dikerjakan" dari "sedang menunggu".
- Disembunyikan selama tutorial (aturan CSS `tutorial-aktif` yang ada) dan di mode panel ringkas (seperti sekarang). Di mode ringkas, titik merah tombol "Buka panel" menyala bila ada lencana tab (bagian 3.6).
- **Ketukan** tidak pernah menjalankan aksi. Ia membuka panel bila sedang ringkas, memilih tab, menggulir ke sasaran, dan menyorotnya 3 detik dengan kelas `sorot-tutorial` yang ada (berhenti lebih awal bila sasaran diketuk). Bila sasaran tidak ditemukan di DOM, yang disorot tab-nya.
- **Analitik** (keputusan c): ketukan mengirim `tujuan_ketuk { jenis }`, paling banyak sekali per `jenis` per sesi (ingatan di memori sesi, tidak disimpan). `jenis` adalah pengenal tetap tujuan (`TujuanDinilai.jenis`), bukan teks, nama PO, atau nilai uang. Ketukan tetap berfungsi sama walau peristiwanya tidak dikirim.

| Tujuan | Tab | Yang disorot |
|---|---|---|
| Kas menipis (perpanjang / daftar / sewakan) | PO | tombol Perpanjang PO itu / tombol daftar PO itu / tombol Sewakan |
| Kas menipis (petugas) | Petugas | tombol − petugas yang akan diberhentikan (yang terakhir direkrut), digulir sampai terlihat; cadangan: ringkasan gaji di atas daftar (ronde perbaikan 2) |
| Kontrak hampir habis, perpanjang, PO menolak | PO | kartu `.item-po[data-po]` PO itu (tombol Perpanjang bila ada) |
| Sewakan jendela | PO | tombol Sewakan |
| Daftarkan PO | PO | tombol daftar `.item-po[data-po] .tombol-beli` |
| Bangun perluasan, proyek, menabung | Terminal | kartu perluasan (`data-kartu="perluasan"`, baru) |
| Area: rekrut / kepuasan: petugas | Petugas | tombol + `.item-petugas[data-petugas]` |
| Area: jendela / jalur, kepuasan: bangunan | Bangun | `.item-bangun[data-bangunan] .tombol-beli` |
| Area: modernisasi | Bangun | baris modernisasi (`data-teknologi`, baru) |
| Manajer Operasional | Petugas | tombol + Manajer Operasional |
| Naik level, kelas berikut | Terminal | kartu level |

### 3.6 Lencana tab Terminal dan PO

Lencana memakai gaya `tab-lencana` yang ada (angka merah). Ingatan "sudah dilihat" berupa `Set` kunci di memori sesi overlay, tidak disimpan. Membuka tab menandai semua butir yang terlihat saat itu sebagai sudah dilihat.

- **Terminal**: "1" bila perluasan berikut sudah terbuka levelnya, belum dibangun, dan kuncinya belum dilihat. Kunci = `perluasan:{tahap}:{siap}` (siap = lolos cadangannya, 3.2). Akibatnya lencana bisa muncul dua kali per tahap: saat levelnya terbuka, dan sekali lagi saat kasnya cukup bila sebelumnya dilihat saat kas belum cukup. Hilang saat proyek dimulai.
- **PO**: jumlah butir yang belum dilihat:
  - tiap tawaran perpanjangan yang bisa diterima (kunci `perpanjang:{po}:{kontrakKe}`);
  - "ada PO yang bisa didaftarkan" (satu butir, kunci `daftar:{slot PO}:{slot jendela}`);
  - jendela kosong (kunci `kosong:{jumlah}`).
  Perpanjangan dan jendela kosong tidak dihitung bila ada Manajer Kemitraan (ia mengurusnya).
- Lencana Target tetap seperti sekarang.
- **Selama tutorial aktif** (sambutan dan langkah) semua lencana tab ditahan, termasuk titik merah tombol Ringkas yang berasal darinya, supaya tidak mendahului sorotan langkah tutorial. Untuk Terminal dan PO ini perbaikan QA ronde 1 (M-1); untuk Target (hadiah penghargaan "Tim Pertama" di langkah 3) ronde perbaikan 2, disetujui owner 31 Oktober 2026. Setelah tutorial selesai atau dilewati, lencana muncul seperti biasa.

### 3.7 Notifikasi

- **Antrean notifikasi**: overlay menyimpan paling banyak 3 pesan tertunda. Pesan ditampilkan bergantian, 3,5 detik masing-masing; pesan yang sama tidak masuk dua kali. Pesan tingkat bahaya (kas menipis, petugas berhenti) melompati antrean. `notifikasiPerubahan` tetap murni dan tetap satu pesan per pembaruan; antrean ada di overlay. Tanpa antrean, toast kepuasan di detik ±35 tertimpa toast "PO bergabung".
- **Perluasan terbuka**: muncul saat perluasan berikut berpindah dari terkunci level ke terbuka, sekali per tahap per sesi. Bila saat sesi dimulai perluasan sudah terbuka dan belum dibangun, toast ini muncul sekali setelah popup (offline, pembaruan) ditutup. Prioritasnya di atas "Slot PO ke-N terbuka" dan "Terminal naik ke Lv N", karena Lv 3 dan Lv 6 memicu ketiganya sekaligus. Teks: `🏗️ Perluasan {t} terbuka: {efek}. Bangun di tab Terminal`.
- **Slot PO baru tanpa jendela**: bila slot PO bertambah tapi tidak ada PO yang bisa didaftarkan karena slot jendela penuh, teksnya `🅿️ Slot PO ke-{n} terbuka: PO baru butuh jendela dari perluasan`. Teks lama ("Daftarkan PO di tab PO") hanya dipakai bila ada PO yang bisa didaftarkan.
- **Perluasan dimulai** (aksi `mulaiPerluasan` berhasil): `🏗️ Perluasan {t} dimulai! Selesai dalam sehari terminal, juga saat game ditutup`.
- **Perluasan selesai (ronde perbaikan 2, disetujui owner 31 Oktober 2026):** teks peresmian menjadi `🏗️ Perluasan {N} selesai: {nama}!` ({nama} = `NAMA_PERLUASAN`, mis. "Aula loket diperluas"), supaya nomornya sama dengan baris tujuan dan toast lain. Bila pada pembaruan yang sama perluasan selesai dan tahap berikutnya sudah terbuka levelnya (biasanya Perluasan 1 selesai di Lv ≥ 6), toast peresmian diantre **sebelum** "Perluasan {N+1} terbuka". Sebelumnya urutannya terbalik: pemain membaca "Perluasan 2 terbuka" lalu baru "Aula loket diperluas diresmikan!".

## 4. Menit pertama

### 4.1 Pil laba di HUD: laba rata-rata per hari

**Keputusan a (owner, 29 Oktober 2026): ganti "Hari ini ±Rp X · N pnp" dengan "Laba ±Rp X/hari"**, yaitu angka "Rata-rata sehari dengan tarif sekarang" yang sudah ada di laporan keuangan tab Terminal (`acuanHarian` + kontrak PO dirata-rata, × 24).

- Alasan: "Hari ini" merah di 34 dari 60 detik pertama dan di **43 dari 60 menit** (pemain tutorial saja), 17/60 menit (pemain yang mengikuti tujuan), dan 86/180 menit. "Netral sampai jam pertama lewat" hanya memperbaiki 34 detik itu. Laba rata-rata negatif hanya 35 detik pertama (sebelum PO kedua bergabung) di semua run yang sehat, dan langsung bereaksi pada tiap keputusan: −Rp 1,2 jt → +Rp 7,0 jt (PO) → +Rp 6,5 jt (petugas peron) → +Rp 5,3 jt (Jalur 2) → +Rp 3,8 jt (Manajer Operasional).
- Teks: `Laba {±uang}/hari`, di mode ringkas sama. "· N pnp" dihapus dari pil supaya muat satu baris di bilah landscape (216 px; "Hari ini … · 107 pnp" sekarang sudah terbungkus dua baris) dan supaya tidak terbaca "N pnp per hari". Penumpang hari ini tetap ada di tab Target.
- Warna: hijau ≥ 0, merah < 0, **netral** selama tutorial aktif atau di jam terminal pertama (`statistik.waktuMainDetik` < 60).
- Boost iklan aktif: pendapatan operasi dikali `EKONOMI.hadiah.pengaliBoost` (kontrak tidak), dan penanda "⚡2×" tetap ada. Angkanya jujur: naiknya sebesar pendapatan operasi saja.
- Ketuk: membuka tab Terminal dan menyorot kartu laporan keuangan (`data-kartu="keuangan"`, baru). `title`: "Laba rata-rata sehari dengan tarif sekarang, termasuk kontrak PO yang dirata-rata. Ketuk untuk laporan keuangan."
- Laporan "Hari ini · Kemarin" di tab Terminal tidak berubah.

**Pil kepuasan (ronde perbaikan 2, disetujui owner 31 Oktober 2026).** Pil kepuasan memakai aturan netral yang **sama dengan pil laba**: selama tutorial aktif atau di jam terminal pertama (`awal`) ia tidak memakai warna `kurang` (merah) maupun `baik` (hijau), melainkan gaya dasar abu-abu yang juga dipakai tingkat `sedang`. Angka dan wajah tidak berubah ("🙁 28%" tetap 28%). Toast kepuasan turun di langkah 2 dan denyut pil tetap.

- Alasan: terminal baru mulai tanpa petugas kebersihan, satpam, dan fasilitas, jadi kepuasan mulai 28%. Di playtest pil merah 60 dari 60 detik menit pertama, dengan urutan 28% → 44% → 28% → 31% → 44% yang semuanya merah, padahal tutorial tidak pernah meminta pemain memperbaiki ketiga komponen itu. Merah yang belum bisa ditindaklanjuti itu yang terasa "gagal".
- Setelah tutorial dan jam pertama warnanya normal. Pemain yang mengikuti baris tujuan hanya melihat merah beberapa detik (kepuasan naik di atas 45% setelah aksi pertama sesudah tutorial). Pemain yang diam tetap melihat merah 44%, dan itu sah karena saat itu sudah ada yang bisa dikerjakan.
- Kepuasan awal yang rendah itu sendiri adalah angka keadaan awal ekonomi dan tidak diubah di sini.

### 4.2 Toast kepuasan turun

- **Kapan**: kepuasan turun **≥ 10 poin** dibanding nilai tertingginya dalam **5 menit nyata** terakhir (sampel sekali per detik di memori sesi). Jeda antar-toast kepuasan **120 detik nyata**. Setelah toast, acuan direset ke nilai sekarang. Tidak muncul sebelum pemain menutup sambutan tutorial (8 detik pertama).
- **Sebab**: komponen dengan penurunan berbobot terbesar, bobot × (nilai acuan − nilai sekarang). Kalimatnya:
  - kelancaran → "antrean di {Area}", dengan area paling lambat jam sibuk (tanpa area: "antrean panjang");
  - kenyamanan → "kursi kurang";
  - kebersihan → "petugas kebersihan kurang";
  - keamanan → "satpam kurang";
  - fasilitas → "fasilitas kurang";
  - harga → "tarif parkir terlalu mahal".
- **Teks**: `{wajah} Kepuasan turun {a}% → {b}%: {sebab}. Ketuk untuk rincian`. Masuk antrean notifikasi (3.7). Toast ini satu-satunya yang bisa diketuk (`pointer-events` aktif hanya untuk pesan ini) dan membuka popup kepuasan. Selama toast tampil, pil kepuasan berdenyut (tanpa animasi bila `prefers-reduced-motion`).
- **Frekuensi** (simulasi, aturan N 10 / jendela 5 menit / jeda 120 dtk): pemain tutorial saja 1 per jam (1×) atau 2 per jam (3×); pemain yang mengikuti tujuan 2 per jam (1×) atau 3 per jam (3×), dan 4 dalam 3 jam; pemain serakah 0. Penurunan yang memicu toast berada di 10–16 poin dan selalu karena kelancaran, tepat setelah PO baru bergabung. Itu keadaan yang memang perlu dijelaskan. N = 15 hanya menangkap kejadian pertama (44 → 28); N = 5 menambah penurunan kecil (77 → 72) yang tidak perlu ditoast.
- Kepuasan dihitung dari jam sibuk tanpa pengali event, jadi awal event musiman tidak memicu toast.

### 4.3 Kamera portrait awal (maksud, bukan angka)

Panji menyetel `TITIK_INTI_POTRET` (`src/game/tata-letak.ts`) dan batas zoom di `bingkai()` (`src/game/adegan.ts`) sampai syarat ini terpenuhi pada screenshot 540×960, save Lv 3 (`SAVE=2,4,0,3`, jam 10):

1. Orang dewasa di aula tampak **±1,5× lebih tinggi** dari sekarang (sekarang ±4 px). Acuannya kira-kira tingkat zoom di `uji-06-potret-zoom-a.png`.
2. Label **PERON, LOKET, dan KEBERANGKATAN** terlihat utuh di dalam adegan, tidak terpotong tepi dan tidak tertutup kolom tombol kanan.
3. Aula dan loket (sasaran langkah 1 tutorial) berada di tengah horizontal; pusat aula di 35–50% tinggi adegan dari atas.
4. **22% bawah adegan** tidak berisi aula, loket, atau antrean loket. Ruang itu untuk gelembung tutorial (4.4).
5. **Zoom keluar** tetap bisa memuat seluruh terminal seperti tampilan bawaan sekarang. Saat ini `maxDistance` = jarak bingkai × 1,25, jadi batasnya harus dipisahkan dari jarak bawaan baru.
6. **Landscape tidak berubah** (`TITIK_INTI` sama). Memutar layar portrait ↔ landscape dan tombol kompas "kembali ke arah awal" memakai bingkai baru tanpa kedip.

Bila 1 dan 2 tidak bisa dipenuhi bersamaan karena terminal berupa pita diagonal, Panji boleh menguji sudut azimut awal portrait yang sedikit berbeda (tanpa mengubah landscape). Arah bayangan, papan, dan gapura harus tetap terbaca. Bila tetap tidak bisa, syarat 2 diutamakan, lalu ±1,3×.

**Hasil pembangunan (30 Oktober 2026):** syarat 1 dan 3 tidak bisa dipenuhi bersamaan dengan syarat 2 (pencarian azimut 44–72°), jadi jalur cadangan dipakai: azimut awal portrait 55°, orang ±1,3×, label utuh, 22% bawah bebas, pusat aula ±0,55–0,59 tinggi adegan. AC-GFX-01 dinilai terhadap jalur cadangan ini (brief bagian 9).

### 4.4 Gelembung tutorial

- **Portrait**:
  - tetap di bawah adegan, di atas tombol Ringkas;
  - tinggi paling banyak **20% tinggi adegan** (sekarang ±26% di langkah 1);
  - nomor dan judul satu baris ("LANGKAH 1/4 · Bangun jendela loket");
  - "Lewati" menjadi tautan kecil di kanan baris judul (bukan baris sendiri);
  - isi paling banyak 2 baris; baris kemajuan tetap.
- **Landscape**: pindah ke **kiri bawah** adegan dengan lebar ≤ 46% lebar adegan (minimal 300 px logis). Aula, label LOKET, dan label KEBERANGKATAN tidak tertutup (sekarang tertutup, `sekarang-04-lanskap-langkah1.png`).
- **Teks baru** (lebih pendek, `teks.ts`):
  - Sambutan: "Penumpang turun di Peron, beli tiket di Loket, lalu naik bus di Keberangkatan. Kembangkan terminalmu supaya laba terus tumbuh."
  - 1: "Penumpang menumpuk di Loket (lantainya berkedip merah). Bangun jendela loket baru untuk {po}."
  - 2: "PO membawa jurusan & busnya sendiri, dan membayar kontraknya di muka. Daftarkan {po} di tab PO."
  - 3: "Penumpang PO baru menumpuk di Peron. Rekrut petugas peron di tab Petugas: halte melayani 25% lebih banyak."
  - 4: "Bus mengantre di jalan raya karena baru ada satu jalur. Bangun Jalur 2 di tab Bangun."
  - Penutup: "Baris di bawah kas selalu menunjukkan langkah berikutnya. Ketuk untuk menuju ke sana. Tips: ketuk bus untuk klakson telolet!" Selama penutup tampil, baris tujuan disorot. Penutup tidak lagi menyarankan toilet, kios, dan Manajer Operasional sekaligus; baris tujuan menyarankannya saat aman (keputusan b).
  - Judul langkah dan baris kemajuan tidak berubah.

### 4.5 Proyek tetap berjalan saat game ditutup

**Dicek di kode:** `terapkanOffline` (`src/sim/state.ts`) memajukan `perkembangan` dengan `majukanPerkembangan(…, detik)` **di luar** cabang Manajer Operasional. Proyek perluasan berjalan selama game ditutup (paling lama 8 jam offline, jauh di atas 24 menit proyek), dengan atau tanpa Manajer. Ini sesuai dokumen 13 bagian 9. Yang butuh Manajer hanya operasi terminal (pendapatan, biaya, XP).

Di web, saat pemain keluar tidak bisa diandalkan untuk menampilkan pesan. Karena itu pesannya di tiga tempat:

1. **Saat proyek dimulai**: toast perluasan dimulai (3.7).
2. **Selama proyek**: baris tujuan hitung mundur, dan kartu perluasan (teks lama "tetap berjalan saat game ditutup" tetap ada).
3. **Popup offline**, bila proyek berjalan saat pemain pergi:
   - `🏗️ Perluasan {t} selesai selama kamu pergi!` atau `🏗️ Perluasan {t} tetap dibangun · selesai dalam {durasi}`;
   - tampil dengan dan tanpa Manajer;
   - sekaligus memperbaiki teks yang bertentangan: tanpa Manajer, baris durasi menjadi `Kamu pergi {durasi}` (bukan "Terminal beroperasi {durasi}"), diikuti teks "Terminal tutup…" yang ada.

Butuh data sesaat (bukan save) di `LaporanOffline`: `proyek: { tahap, selesai, sisaDetik } | null`. Ini perlu karena saat game dibuka ulang, overlay dipasang setelah offline diterapkan, sehingga notifikasi "diresmikan" tidak pernah muncul.

**Tombol dan catatan popup offline (ronde perbaikan 2, disetujui owner 31 Oktober 2026).** "Ambil" menjanjikan hadiah; mengetuknya untuk "mengambil" kerugian, atau saat tidak ada apa pun, terasa seperti dihukum.

| Laporan | Angka besar | Tombol utama | Tombol iklan "Ambil 2×" |
|---|---|---|---|
| Laba > 0 (dengan Manajer) | `+Rp X` | **Ambil** | tampil bila iklan siap (tidak berubah) |
| Laba ≤ 0 (dengan Manajer) | `−Rp X` merah | **Oke** | tidak tampil (tidak berubah) |
| Terminal tutup (tanpa Manajer) | tidak ada | **Oke** | tidak tampil |

- Teks baru `TEKS.offlineOke` = "Oke", sama dengan tombol penutup tutorial. Esc dan ketukan di luar kotak tetap menutup popup.
- Tidak ada baris penjelasan baru untuk laba minus: rincian "Pendapatan … · biaya …" dan catatan "pendapatan 60%, biaya penuh" sudah menjelaskannya. Akar masalahnya ditangani syarat offline Manajer (3.1).
- Catatan tanpa Manajer memakai syarat yang sama dengan baris tujuan: bila Manajer akan untung offline, teks lama tetap ("Terminal tutup selama kamu pergi. Rekrut Manajer Operasional di tab Petugas supaya terminal tetap berjalan."); bila belum, teksnya `Terminal tutup selama kamu pergi: tanpa pendapatan, tanpa biaya.`, supaya popup tidak mendorong pemain ke laba offline minus.

### 4.6 Label TURUN bertumpuk di atas PERON (malam, landscape)

**Tidak masuk scope ini; dicatat sebagai temuan terpisah untuk Panji.**

- Penumpukan terjadi di Lv 26 dengan 7 jalur (label "TURUN n/m" per halte menumpuk di atas label PERON), bukan di sesi pertama.
- Penyebabnya tata letak label di `src/game` dengan tesnya sendiri.
- Malam hanya membuatnya lebih mencolok.

Yang masuk scope: kamera portrait baru tidak boleh membuat label bertumpuk di keadaan Lv 3 (AC-GFX-01).

## 5. Keadaan khusus

| Keadaan | Perilaku |
|---|---|
| Save lama, tutorial "selesai" | Baris tujuan langsung tampil dari state. Tidak ada migrasi |
| Tutorial dilewati | Baris tujuan tampil sejak awal; biasanya "🚌 Daftarkan PO Peuyeum Kilat: +Rp 39,4 jt di muka" lalu saran berikutnya |
| Offline / kembali dari latar | Tujuan dihitung ulang. Toast perluasan terbuka muncul sekali setelah popup ditutup |
| Kecepatan 1×/2×/3× | Tahan 8 dtk, jeda toast 120 dtk, dan jendela 5 menit memakai waktu nyata. Hitung mundur proyek memakai detik main seperti kartu perluasan (di 3× berjalan 3× lebih cepat) |
| Kas nol | Tingkat 1 kas menipis dengan obat; tidak pernah buntu karena tawaran kontrak dan PO terakhir selalu diperpanjang (aturan game) |
| Manajer Kemitraan | Perpanjangan dan jendela kosong tidak disarankan dan tidak dihitung di lencana |
| Semua perluasan selesai | Tingkat 5 "⭐ Naik ke Terpadu ★N di Lv L · kini Lv K" (selalu ada) |
| Event musiman, tantangan mingguan | Tidak berubah. Notifikasi event tetap; antrean mencegah saling timpa |
| Mode sinema, foto, popup terbuka | Toast antre sampai popup tertutup; di mode sinema UI tersembunyi seperti sekarang |

## 6. Antarmuka antar-area (sesuai brief)

**Gameplay (Raka):**

- `src/app/tujuan.ts` (baru, murni):
  - `daftarTujuan(state, kunciTampil, cfg?)` → `TujuanDinilai[]`: urut prioritas, tidak pernah kosong;
  - `pilihTujuan(daftar, tampil: { kunci, sejakMs } | null, sekarangMs)` → `TujuanDinilai`;
  - `cadanganKas(state, cfg?, tambahHari)`;
  - `TAHAN_TUJUAN_MS = 8000`.
  `TujuanDinilai` = union bertanda `jenis` (bagian 3.1) dengan `tingkat`, `kunci`, `siap`, dan data untuk teks (PO, nilai, biaya, area, komponen, tahap, level, sisa detik, kekurangan). Pemetaan tujuan → tab dan selector ada di UI, seperti `elemenSasaran` di `ui/tutorial.ts`.
  Ronde perbaikan 2: syarat offline Manajer memakai `hitungOffline` (`src/sim/state.ts`, sudah murni) atas salinan state; tidak ada state, aksi, atau field save baru.
- `src/app/kepuasan-turun.ts` (baru, murni):
  - `KEPUASAN_TURUN = { poin: 10, jendelaMs: 300_000, jedaMs: 120_000 }`;
  - `periksaKepuasanTurun(riwayat, sekarang, toastTerakhirMs)` → `{ dari, ke, sebab } | null`.
- `src/sim/state.ts`: `LaporanOffline.proyek` (data sesaat, tidak disimpan), diisi `terapkanOffline`.
- `src/ui/model.ts`: `ModelHud.labaHarian` (rata-rata dengan kontrak, termasuk boost) dan `ModelHud.awal` (jam terminal pertama).
- `src/app/analitik.ts` (murni, dites): peristiwa `tujuan_ketuk` dengan satu parameter `jenis` (`TujuanDinilai.jenis`), dikirim saat baris tujuan diketuk, paling banyak sekali per `jenis` per sesi. Tidak membawa teks, nama PO, atau nilai uang. Dikirim lewat jalur yang sama dengan peristiwa lain. Masuk daftar peristiwa README bagian Tutorial & analitik.
- UI:
  - `overlay.ts`: baris tujuan, lencana, antrean notifikasi, toast kepuasan, pil laba;
  - `notifikasi.ts`: perluasan terbuka, varian slot PO;
  - `teks.ts`: semua teks;
  - `tutorial.ts` dan `gaya.css`: gelembung;
  - `menu.ts`: `data-kartu="perluasan"` dan `"keuangan"`, `data-teknologi`, dan kartu perluasan di urutan kedua tab Terminal;
  - `popup-offline.ts`.
- Tes: `tests/tujuan.test.ts`, `tests/kepuasan-turun.test.ts`, tes notifikasi, model, offline, dan analitik, ditambah simulasi pemain pengikut tujuan di atas `GameState` (30 menit nyata di 3×).
- README bagian UI dan bagian Tutorial & analitik.

**Grafis (Panji):** `TITIK_INTI_POTRET` di `src/game/tata-letak.ts`, dan pemisahan batas zoom keluar di `bingkai()` (`src/game/adegan.ts`). Adegan tidak membaca state baru.

**Platform (Dodi):** tidak ada. Ingatkan `npm run cap:sync` sebelum APK berikutnya.

## 7. Kriteria penerimaan

Berlaku sebagai bagian brief `docs/tasks/20261029-arah-pemain-baru.md` (bagian 6 brief).

**Gameplay & UI**

- AC-GP-01: `daftarTujuan`/`pilihTujuan` murni di `src/app` (lolos `tsconfig.sim.json` dan tes arsitektur). Tes unit:
  - tiap jenis tujuan dan urutan prioritas;
  - tingkat 1 langsung menggantikan;
  - tingkat lebih tinggi menunggu 8 dtk;
  - setingkat tidak menggantikan;
  - daftar tidak pernah kosong;
  - Manajer Kemitraan menyembunyikan perpanjangan dan jendela kosong;
  - aksi bergaji tidak disarankan bila laba rata-rata sesudahnya < 0.
- AC-GP-02: tes simulasi pemain yang tiap 20 dtk mengerjakan tujuan yang tampil, 30 menit nyata di 3× di atas `GameState` asli:
  - `kasMenipis` tidak pernah true;
  - tidak ada petugas berhenti karena kas habis;
  - `mulaiPerluasan` tahap 1 ≤ 30 dtk nyata setelah Lv 3;
  - 0 pergantian tujuan < 5 dtk tanpa aksi.
- AC-GP-03: baris tujuan:
  - menggantikan petunjuk; tampil setelah tutorial; tersembunyi selama tutorial dan mode ringkas;
  - teks sesuai tabel 3.4 dan ≤ 60 karakter untuk PO bernama terpanjang;
  - warna per tingkat;
  - ketukan membuka panel, tab, dan sorotan 3 dtk tanpa menjalankan aksi.
- AC-GP-04: lencana Terminal dan PO sesuai 3.6. Hilang setelah tab dibuka, muncul lagi untuk kunci baru, tidak disimpan (memuat ulang halaman = lencana dihitung ulang). Titik merah tombol Buka panel menyala bila ada lencana.
- AC-GP-05: toast perluasan terbuka sekali per tahap per sesi, termasuk saat sesi dimulai setelah popup ditutup. Di Lv 3 muncul sebelum toast slot PO dan level (antrean). Toast perluasan dimulai. Teks slot PO tanpa jendela.
- AC-GP-06: pil "Laba ±Rp X/hari" sama dengan angka rata-rata di laporan keuangan (tanpa boost). Netral selama tutorial dan jam pertama, lalu hijau/merah. Boost aktif menaikkan pendapatan operasi saja. Ketuk membuka laporan keuangan.
- AC-GP-07: toast kepuasan sesuai 4.2 (tes unit helper untuk N, jendela, jeda, sebab). Muncul di langkah 2 tutorial setelah toast PO. Ketuk membuka popup kepuasan; pil berdenyut.
- AC-GP-08: popup offline menyebut proyek (selesai / sisa) dengan dan tanpa Manajer. Baris durasi tanpa Manajer berbunyi "Kamu pergi …". Tes `terapkanOffline` untuk `proyek`.
- AC-GP-09: gelembung tutorial portrait ≤ 20% tinggi adegan di 540×960. Landscape di kiri bawah tidak menutup aula, LOKET, dan KEBERANGKATAN di 900×420. Teks baru. Penutup menyorot baris tujuan.
- AC-GP-10: tidak ada field save baru (kunci hasil `serialisasi` sama dengan 0.3.1), tidak ada nama peristiwa analitik baru selain `tujuan_ketuk`, angka `economy.config.ts` tidak berubah, `tests/tycoon-tempo.test.ts` lulus tanpa diubah.
- AC-GP-11: `npm run typecheck`, `npx vitest run`, `npm run build` lulus. README bagian UI diperbarui.
- AC-GP-12: `tujuan_ketuk { jenis }` dikirim saat baris tujuan diketuk, paling banyak sekali per `jenis` per sesi, tanpa teks, nama, atau nilai uang (bagian 3.5 dan 6). Dites di tes analitik; tercantum di README bagian Tutorial & analitik.
- AC-GP-13 (diperluas di ronde perbaikan 2): penutup tutorial tidak lagi menyarankan Manajer Operasional (teks 4.4). Manajer hanya disarankan bila laba rata-rata sesudahnya ≥ 0 **dan** laba offline sehari terminal sesudahnya ≥ 0 (rumus `jalankanOffline`/`hitungOffline` atas salinan state dengan Manajer, selisih 1.440 detik; murni). Tes unit: state dua PO (offline minus, tidak disarankan) dan tiga PO (offline plus, disarankan). Catatan popup offline tanpa Manajer memakai syarat yang sama (4.5). Aturan offline sendiri tidak berubah.

**Ronde perbaikan 2** (playtest fase 4, disetujui owner 31 Oktober 2026; rincian dan bunyi lengkapnya di brief bagian 6):

- AC-GP-14: perluasan tahap ≥ 2 siap bila kas − biaya ≥ cadangan B sesudahnya, bila tidak "menabung" terhadap cadangan B; tahap 1 tetap cadangan A (3.2). `tests/tujuan-sim.test.ts` tetap lulus; harness playtest dijalankan ulang di atas kode baru: kas menipis 0, Lv 10/15/20 dalam ±2 menit dari baris "W" laporan playtest.
- AC-GP-15: tombol popup offline "Ambil" hanya bila laba > 0, selain itu "Oke"; tombol "Ambil 2×" tidak berubah (4.5).
- AC-GP-16: pil kepuasan netral selama tutorial aktif dan jam terminal pertama, sama dengan pil laba; angka, wajah, toast langkah 2, dan denyut tetap (4.1).
- AC-GP-17: teks hitung mundur proyek dan "menabung … untuk cadangan" sesuai tabel 3.4, ≤ 60 karakter.
- AC-GP-18: toast peresmian sebelum "Perluasan N terbuka" dan teks `🏗️ Perluasan {N} selesai: {nama}!` (3.7); lencana Target ditahan selama tutorial (3.6); tujuan "kurangi petugas" menyorot tombol − petugas yang dimaksud (3.5).
- AC-GFX-04: label papan gerbang ("JAKARTA n/m") di portrait tidak terpotong tepi layar; landscape tidak berubah, draw call tidak naik.

**Grafis**

- AC-GFX-01: syarat 1–4 bagian 4.3 terpenuhi pada screenshot portrait 540×960 Lv 3 siang, dan tidak ada label yang bertumpuk.
- AC-GFX-02: landscape 900×420 dengan save yang sama sama dengan sebelum perubahan (`sekarang-07-lanskap-lv3.png`).
- AC-GFX-03: zoom keluar maksimal portrait memuat seluruh terminal seperti `sekarang-05-potret-kamera-bawaan.png`. Rotasi layar dan tombol kompas kembali ke bingkai baru. Draw call tidak naik.

**Screenshot untuk QA** (portrait 540×960 dan landscape 900×420):

1. sambutan;
2. langkah 1;
3. kepuasan turun di langkah 2;
4. penutup dengan baris tujuan tersorot;
5. Lv 3 dengan toast perluasan dan lencana Terminal;
6. tab Terminal setelah mengetuk baris tujuan;
7. popup offline tanpa Manajer dengan proyek (`SAVE=2,4,0,3`, `SAVE_EXTRA` dengan `perkembangan.proyekDetik`, `OFFLINE_MS=600000`).

**Playtest:** 5 pemain baru, 15 menit, portrait di ponsel, think-aloud. Catat:

- ucapan "rugi" atau "kenapa sedih";
- tiap "terus ngapain?";
- waktu Lv 3 → mulai perluasan 1;
- apakah baris tujuan diketuk.

## 8. Risiko dan keputusan

**Risiko**

- Baris tujuan bisa terasa menggurui. Mitigasi: status netral saat menunggu, histeresis, tidak pernah membeli sendiri, tersembunyi di mode ringkas.
- Saran tidak optimal. Pemain yang mengikutinya sama cepat dengan pemain serakah sampai Lv 10 (menit 91 vs 97 di 1×) dan tidak pernah kas menipis. Tapi karena membeli perbaikan kepuasan dan menyisakan cadangan, ia memulai perluasan 3 ±100 menit main lebih lambat. Itu harga dari saran yang aman; tempo resmi tidak berubah.
- Laba rata-rata per hari menyembunyikan lonjakan kontrak sebagai angka harian. Momen "wow" kontrak tetap terlihat lewat lonjakan kas dan toast "PO bergabung & membayar kontraknya". Efek boost iklan di pil kecil karena hanya pendapatan operasi yang 2× (jujur, tapi bisa membuat boost terasa lemah).
- Kamera lebih dekat menambah kepadatan label di layar. Dicek lewat AC-GFX-01.
- `tujuan_ketuk` hanya mengukur apakah suatu jenis saran dipakai dalam satu sesi, bukan seberapa sering. Itu sengaja, supaya volume peristiwa kecil dan tidak ada data tentang isi saran.
- (Ronde perbaikan 2) Saran Manajer datang lebih lambat (setelah PO ketiga). Pemain yang pergi sebelum itu tidak mendapat XP offline, tapi juga tidak pulang ke laba minus. Validasi: berapa pemain memberhentikan Manajer dalam satu jam setelah merekrutnya, dan kas saat kembali di sesi kedua.
- (Ronde perbaikan 2) Sekitar 80% dari 30 menit pertama baris berisi status menunggu (proyek atau menabung). Itu tempo resmi, bukan cacat baris; teks hitung mundur kini memberi tahu bahwa pemain boleh menutup game.

**Keputusan owner (29 Oktober 2026, Telegram: "APPROVE semua")**

Ketiga pertanyaan rancangan ini dijawab "ya":

- **a. HUD "Laba ±Rp X/hari" (rata-rata)** menggantikan "Hari ini ±Rp X · N pnp"; penumpang hari ini cukup di tab Target (bagian 4.1). Cadangan yang tidak dipilih: "Hari ini" tetap dengan warna netral di jam pertama, yang hanya memperbaiki 34 detik dari ±43 menit merah. Dokumen 13 bagian 11 diperbarui.
- **b. Penutup tutorial tidak lagi menyarankan Manajer Operasional.** Saran itu pindah ke baris tujuan saat gajinya aman (bagian 3.1 dan 4.4). Aturan offline (manajer, 8 jam, 60%) tidak berubah.
- **c. Peristiwa GA4 `tujuan_ketuk` dengan parameter `jenis`.** Ditetapkan Sapto: dikirim saat baris tujuan diketuk, paling banyak sekali per `jenis` per sesi, tanpa teks, nama, atau nilai uang (bagian 3.5 dan 6). Tidak ada data pribadi baru; kebijakan privasi (`public/privasi.html` menyebut "kejadian di dalam game" secara umum) tidak berubah.

**Keputusan owner (31 Oktober 2026, Telegram: "APPROVE" atas hasil playtest fase 4)**

- Syarat offline untuk saran Manajer Operasional dan cadangan B untuk perluasan tahap ≥ 2 (3.1–3.2).
- Tombol popup offline "Oke" bila tidak ada laba yang masuk, dan catatan tanpa Manajer bersyarat (4.5).
- Pil kepuasan netral selama tutorial dan jam pertama (4.1).
- Teks hitung mundur proyek dan "menabung … untuk cadangan" (3.4).
- Perbaikan kecil: urutan dan teks toast peresmian (3.7), lencana Target ditahan selama tutorial (3.6), sasaran "kurangi petugas" (3.5), label papan gerbang portrait tidak terpotong (grafis).
- Tidak masuk: kamera portrait digeser turun setelah tutorial dan jam mulai 06.00 yang remang (playtest P-12) menjadi tugas terpisah.
