# Dokumen Desain & Teknis — Bustation: Idle Bus

Kumpulan dokumen desain dan teknis untuk **Bustation: Idle Bus** ([bustation.games](https://bustation.games)).

Dokumen 01–11 disusun dari kode di repositori ini per **6 Oktober 2026** (versi aplikasi `0.1.0`), jadi masih menggambarkan ekonomi idle. Sebagian isinya (Kepala, upgrade tahap, prestige) tidak berlaku lagi sejak tycoon 0.3.0. Dokumen 12–18 adalah rancangan sesudahnya, masing-masing dengan status rilis di tabel. Rancangan yang berlaku untuk ekonomi adalah dokumen 13.

Sumber kebenaran tetap kodenya. Angka tuning ada di `src/config/economy.config.ts` dan `src/config/waktu.config.ts`. Detail implementasi ada di `README.md` di akar repositori. Kalau dokumen dan kode berbeda, ikuti kode, lalu perbarui dokumennya.

**Versi yang live: 0.5.0** (5 November 2026), dengan dokumen 16 ronde 2 dan dokumen 17. Disetujui owner dan sedang dibangun untuk 0.6.0: dokumen 18 (6 November 2026).

## Daftar dokumen

| No | Dokumen | Isi |
|---|---|---|
| 01 | [Game Concept Document](01-game-concept-document.md) | Konsep, fantasi pemain, pilar desain, target pemain, platform, model bisnis |
| 02 | [Game Design Document](02-game-design-document.md) | Seluruh mekanik dan sistem permainan |
| 03 | [Core Gameplay Loop](03-core-gameplay-loop.md) | Aktivitas pemain dari mulai bermain → berkembang → kembali bermain |
| 04 | [Feature List & Scope](04-feature-list-scope.md) | Daftar fitur per fase: MVP, Phase 2, Phase 3 |
| 05 | [Game Economy Design](05-game-economy-design.md) | Mata uang, sumber & pengeluaran, biaya, hadiah, pacing |
| 06 | [Player Progression Design](06-player-progression-design.md) | Level, unlock, naik kelas (prestige), penghargaan, peringkat |
| 07 | [UI/UX Flow](07-ui-ux-flow.md) | Alur layar dari membuka game sampai kembali bermain |
| 08 | [Technical Design Document](08-technical-design-document.md) | Arsitektur frontend, backend, data, deployment |
| 09 | [Data Model / ERD](09-data-model-erd.md) | Struktur save, dokumen cloud, tabel database, relasinya |
| 10 | [API Specification](10-api-specification.md) | Endpoint dan kontrak komunikasi game ↔ server |
| 11 | [MVP Definition](11-mvp-definition.md) | Batasan versi pertama dan kriteria rilisnya |
| 12 | [Rancangan Ekonomi v2: Mitra PO](12-rancangan-ekonomi-po.md) | **Dirilis 0.2.0.** Loket milik PO, level PO & terminal, kontrak, reputasi, perluasan terminal, Renovasi, hasil simulasi |
| 13 | [Rancangan Tycoon](13-rancangan-tycoon.md) | **Dirilis 0.3.0** (9 Okt 2026; state, save skema 3, UI lima tab, tutorial & target memakai ekonomi tycoon, adegan 3D mengikuti bangunan & petugas), lalu **0.3.1** (penumpang tidak membayar terminal, kontrak PO dibayar di muka, slot PO terus bertambah). Dari idle ke tycoon: panel Tahap dihapus, kapasitas dari bangunan & petugas, biaya operasional & laba, pasar penumpang mutlak, Renovasi dihapus, uang realistis |
| 14 | [Rancangan Arah Pemain Baru](14-rancangan-arah-pemain-baru.md) | **Dirilis 0.4.0** (3 Nov 2026; dibangun 31 Okt 2026, aa21f53; disetujui owner 29 Okt 2026; ronde perbaikan 2 dari playtest disetujui 31 Okt 2026: syarat offline saran Manajer, cadangan B perluasan ≥ 2, pil kepuasan netral di awal, tombol "Oke" popup offline). Baris "tujuan berikutnya" di HUD dengan cadangan kas & histeresis, lencana tab Terminal & PO, notifikasi perluasan terbuka, laba rata-rata per hari di HUD, toast kepuasan turun, kamera portrait lebih dekat, gelembung tutorial yang tidak menutup aula, pesan proyek tetap berjalan saat game ditutup, peristiwa analitik `tujuan_ketuk` |
| 15 | [Rancangan Fondasi](15-rancangan-fondasi.md) | **Dirilis 0.4.0** (3 Nov 2026, `versiMinimal` 0.4.0; dibangun 31 Okt–1 Nov 2026, disetujui owner 31 Okt 2026; ronde 1 saran 3, 6, perbaikan U-2; ronde 2 saran 4, 5, patokan tempo baru; ronde perbaikan teks dari playtest: "2× semua", armada dalam level, aturan PO berlevel terendah, status & toast jendela penuh menunjuk izin level). Tahap 0 peta jalan, saran 3–6 evaluasi: tes tempo pemain kasual, izin level (slot jendela/jalur dari level, slot PO lebih rapat) yang menghapus dinding mid-game, hadiah non-uang (armada PO, percepat proyek), tantangan laba & target harian yang menghitung kontrak dirata-rata, ambang tantangan kepuasan dari awal minggu, perbaikan kunci histeresis baris tujuan |
| 16 | [Rancangan Bentuk Terminal](16-rancangan-bentuk-terminal.md) | **Ronde 1 dirilis 0.4.1** (5 Nov 2026; dibangun 4 Nov 2026; disetujui owner 3 Nov 2026; ronde perbaikan 1 dari playtest: teks toast peresmian susulan dan popup offline yang menyebut gedungnya). **Ronde 2 disetujui 5 Nov 2026 (ADR 008), dibangun 5 Nov 2026, lulus QA grafis dengan catatan (fps belum diukur), dirilis 0.5.0 (5 Nov 2026):** 12 perubahan kecil per level versi ronde 2 (gedung kota Lv 16 di lot K13), lahan seberang jalan K14–K17 dicadangkan (`CADANGAN_SEBERANG`), kembang api siang yang lebih terbaca, jaring proyek fase 2, tenda kios teras. Bentuk Perluasan 3 dan denah yang tidak monoton: Opsi A, Sayap 2 Lantai di taman barat (bentuk L, kelak U), Gedung Antarpulau di belakang ruang tunggu sebagai cadangan tempat, jendela 9–24 dan kursi 5–8 di lantai 2, peresmian susulan pemain lama, bukti denah murni visual. *Sejak 0.6.0 (dokumen 18 bagian 8.10):* tangga A3 diganti satu bentang lurus terbuka, tiang bendera dan lampu plaza digeser, celah ke sayap barat ditutup |
| 17 | [Rancangan Musim Terminal](17-rancangan-musim-terminal.md) | **Disetujui owner 5 Nov 2026 (ADR 009), dibangun 5 Nov 2026, lulus QA gameplay dengan catatan dan ronde perbaikan 1 dari playtest (AC-GP-16..22), dirilis 0.5.0 (5 Nov 2026).** Musim 1 "Musim Hujan" mulai Senin 30 Nov 2026. Tahap 1 peta jalan: musim 6 minggu dari kalender di config; 3 tugas harian (main, sorotan, kelola) yang hanya maju saat main aktif, berlaku 2 hari, tanpa beruntun; Rapor Musim 30 tingkat × 45 poin; hadiah kosmetik dan kemudahan (lencana, bingkai foto, spanduk gapura, seragam petugas, papan gapura, tiket ganti tugas, Surat Armada), tanpa uang dan tanpa iklan; terbuka di Lv 6 sesudah tutorial; blok save `musim` opsional (skema 3, `versiMinimal` 0.5.0); 6 peristiwa analitik baru; bukti simulasi 13 run × 42 hari; tema hiasan Imlek dan Mudik diputuskan di bagian 4.2 (warna papan Mudik diganti 6 Nov 2026, palet A owner, dipasang di 0.6.0) |
| 18 | [Rancangan Tambah Lantai](18-rancangan-tambah-lantai.md) | **Disetujui owner 6 Nov 2026 (ADR 010), sedang dibangun untuk 0.6.0.** Mulai Perluasan 3, tombol "Tambah lantai" per gedung untuk 4 gedung dan 5 lantai: Gedung parkir (Lv 15, Lv 38), Ruang tunggu (Lv 21), Gedung toilet/sayap barat (Lv 26, lantai 2 = selasar penghubung ke aula), Aula loket (Lv 33). Lantai = ruang baru: slot bertambah dan isinya langsung terpasang (kursi, kios, toko, toilet, lahan parkir), petugas ikut direkrut menurut aturan; tempo tidak berubah. Lantai digambar sebagai mezanin/cangkang yang tidak menutup inti permainan; isinya dilihat lewat mode lihat per lantai ("👁 Lihat"). Gedung parkir bentuk A dengan ramp lurus dan mobil bergerak lewat jalan samping ke pelataran SPBU; hanya jendela lantai baru yang menyala di malam hari. Field save `lantai` opsional (skema 3, `versiMinimal` 0.6.0 saat rilis), peristiwa `lantai_beli` dan `lantai_lihat`. Peron, pangkalan, dan lantai 3 Sayap 2 Lantai menunggu rancangan Gedung Antarpulau |

## Istilah yang sering dipakai

| Istilah | Arti |
|---|---|
| Area | Bagian rantai penumpang: **Peron** (turun bus), **Loket** (beli tiket), **Keberangkatan** (naik bus), ditambah **Pangkalan** bus. Kapasitasnya dari bangunan dan petugas (dokumen 13 bagian 4). Di dokumen 01–11 disebut "tahap" |
| Bottleneck / paling lambat | Area dengan kapasitas terkecil; menentukan arus penumpang seluruh terminal |
| Arus | Penumpang per detik (pnp/dtk) yang benar-benar melewati terminal |
| Kepala | *(idle 0.2, dihapus di 0.3.0)* Kepala tahap yang direkrut sekali bayar. Diganti **Manajer Operasional** bergaji, syarat terminal beroperasi saat game ditutup (dokumen 13 bagian 9) |
| Kelas terminal | Tipe C → B → A → Terpadu ★, naik dari level terminal (Lv 10, 20, 30). Di dokumen 01–11, "naik kelas" adalah prestige yang membangun ulang terminal dari awal; prestige (Renovasi) dihapus di 0.3.0 |
| Perluasan | Proyek pembangunan Perluasan 1–5, masing-masing sehari terminal, tetap berjalan saat game ditutup. Tiap perluasan menambah slot. "Tahap 3" = kompleks sesudah Perluasan 3 |
| Izin level | Sejak Perluasan 3, slot jendela loket dan jalur juga bertambah dari level terminal (dokumen 15) |
| Sayap barat | Bangunan satu lantai lama berisi toilet dan musholla, di barat aula; di kartu lantai disebut **"Gedung toilet"** (id `sayapBarat`). Sejak 0.6.0 bisa diberi lantai 2: selasar penghubung dari lantai 2 Sayap 2 Lantai ke aula, dengan +1 toilet (dokumen 18 bagian 7 dan 8.10) |
| Sayap 2 Lantai | Gedung Perluasan 3 di taman barat (sejak 0.4.1), dengan teras food court, berbentuk L. Lantai 2 memuat jendela loket 9–24 dan blok kursi 5–8; teras memuat kios 3–4 (dokumen 16) |
| Peresmian susulan | Toast dan kembang api sekali per perangkat bagi pemain yang sudah melewati Perluasan 3 sebelum gedungnya digambar (dokumen 16 bagian 7) |
| Lahan seberang | Lot kota K14–K17 di seberang jalan, dijaga kosong untuk pertumbuhan terminal ke kota kelak (`CADANGAN_SEBERANG`, dokumen 16 bagian 6, ADR 008) |
| Cadangan Antarpulau | Tempat Gedung Antarpulau kelak, di belakang ruang tunggu (x 36…50,14, y 13,2…18,1), tanpa benda berdiri; hanya aspal rata akses gedung parkir yang boleh lewat (`CADANGAN_ANTARPULAU`, dokumen 16 dan 18) |
| Tambah lantai | Sejak Perluasan 3: lantai tambahan untuk Gedung parkir, Ruang tunggu, Gedung toilet (sayap barat), dan Aula loket, dibeli sekali ketuk. Slot unit gedung itu bertambah dan isinya langsung terpasang; lantai tidak bisa dibongkar (dokumen 18). Beda dengan Sayap 2 Lantai, yang gedungnya sendiri |
| Gedung parkir | Gedung parkir mobil 2–3 dek di bagian barat lahan parkir, dari lantai Gedung parkir (Lv 15 dan Lv 38), dengan ramp lurus dan mobil yang naik-turun. Tiap lantai +2 lahan parkir (dokumen 18) |
| Mode lantai | Tampilan sementara satu gedung per lantai, dibuka dari tombol "👁 Lihat": lantai di atasnya disembunyikan dan isinya terlihat. Tidak disimpan, simulasi tetap berjalan (dokumen 18 bagian 6 dan 8.5) |
| Hari terminal | Satu hari jam terminal = 24 menit waktu main nyata (1 jam terminal = 60 detik) |
| Minggu WIB | Minggu nyata Senin 00.00 – Minggu 23.59 WIB, dipakai tantangan mingguan, papan peringkat, dan batas Musim Terminal |
| Event musiman | Mudik Lebaran, HUT RI, Nataru: pasar penumpang naik selama event. Bukan Musim Terminal |
| Musim Terminal | Musim 6 minggu WIB dari kalender di config, sama untuk semua pemain, tanpa server. Musim 1 "Musim Hujan" mulai 30 November 2026 (dokumen 17) |
| Tugas harian | 3 tugas per hari WIB (main, sorotan, kelola), berlaku 2 hari, hanya maju saat main aktif. Tiap tugas +10 poin Rapor |
| Rapor Musim | Jalur hadiah gratis 30 tingkat × 45 poin. Poin dari tugas harian (+10) dan tantangan mingguan (+40). Nilai akhir: Cukup, Baik, Sangat Baik, Istimewa |
| Hiasan terminal | Hadiah kosmetik Rapor: spanduk gapura, seragam petugas, papan gapura, bingkai foto. Lencana adalah catatan prestasi, bukan barang |
| Surat Armada | Hadiah Rapor di tingkat 12 dan 25: +½ level untuk PO yang dipilih pemain |
| Tuas tugas | Tombol "›" di baris tugas musim: membuka tab dan menyorot aksi yang memajukan tugas itu dan aman bagi kas. Tidak tampil bila tidak ada aksi seperti itu (dokumen 17 bagian 3.2) |
| PO | Perusahaan Otobus (mitra), semua nama fiktif |
| N menit laba | Satuan hadiah sejak 0.3.0: laba rata-rata per jam hari biasa dengan tarif bawaan, termasuk kontrak PO yang dirata-rata, paling sedikit Rp 200 rb per menit (dokumen 13 bagian 10). Di dokumen 01–11: "N menit pendapatan" |
