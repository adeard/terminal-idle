# Dokumen Desain & Teknis — Bustation: Idle Bus

Kumpulan dokumen desain dan teknis untuk **Bustation: Idle Bus** ([bustation.games](https://bustation.games)).

Semua dokumen disusun dari kode di repositori ini per **6 Oktober 2026** (versi aplikasi `0.1.0`). Sumber kebenaran tetap kodenya. Angka tuning ada di `src/config/economy.config.ts` dan `src/config/waktu.config.ts`. Detail implementasi ada di `README.md` di akar repositori. Kalau dokumen dan kode berbeda, ikuti kode, lalu perbarui dokumennya.

Beberapa fitur terbaru di repo mungkin belum dirilis ke situs:

- tanpa tombol PROSES;
- kepuasan → permintaan penumpang;
- harga tiket per jurusan & kelas bus;
- uang masuk per transaksi.

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
| 14 | [Rancangan Arah Pemain Baru](14-rancangan-arah-pemain-baru.md) | **Dibangun** (31 Okt 2026, aa21f53, belum dirilis; disetujui owner 29 Okt 2026; ronde perbaikan 2 dari playtest disetujui 31 Okt 2026: syarat offline saran Manajer, cadangan B perluasan ≥ 2, pil kepuasan netral di awal, tombol "Oke" popup offline). Baris "tujuan berikutnya" di HUD dengan cadangan kas & histeresis, lencana tab Terminal & PO, notifikasi perluasan terbuka, laba rata-rata per hari di HUD, toast kepuasan turun, kamera portrait lebih dekat, gelembung tutorial yang tidak menutup aula, pesan proyek tetap berjalan saat game ditutup, peristiwa analitik `tujuan_ketuk` |
| 15 | [Rancangan Fondasi](15-rancangan-fondasi.md) | **Dibangun** (31 Okt 2026, disetujui owner hari yang sama, belum dirilis; ronde 1 saran 3, 6, perbaikan U-2; ronde 2 saran 4, 5, patokan tempo baru; ronde perbaikan teks dari playtest: "2× semua", armada dalam level, aturan PO berlevel terendah, status & toast jendela penuh menunjuk izin level). Tahap 0 peta jalan, saran 3–6 evaluasi: tes tempo pemain kasual, izin level (slot jendela/jalur dari level, slot PO lebih rapat) yang menghapus dinding mid-game, hadiah non-uang (armada PO, percepat proyek), tantangan laba & target harian yang menghitung kontrak dirata-rata, ambang tantangan kepuasan dari awal minggu, perbaikan kunci histeresis baris tujuan |
| 16 | [Rancangan Bentuk Terminal](16-rancangan-bentuk-terminal.md) | **Dibangun ronde 1** (4 Nov 2026, belum dirilis; disetujui owner 3 Nov 2026; ronde perbaikan 1 dari playtest: teks toast peresmian susulan dan popup offline yang menyebut gedungnya). Ronde 2, yaitu 12 perubahan kecil per level, belum dibangun. Bentuk Perluasan 3 dan denah yang tidak monoton: Opsi A, Sayap 2 Lantai di taman barat (bentuk L, kelak U), Gedung Antarpulau di belakang ruang tunggu sebagai cadangan tempat, jendela 9–24 dan kursi 5–8 di lantai 2, 12 perubahan kecil per level di ronde kedua, peresmian susulan pemain lama, bukti denah murni visual |

## Istilah yang sering dipakai

| Istilah | Arti |
|---|---|
| Tahap | Tiga bagian rantai penumpang: **Peron** (turun bus), **Loket** (beli tiket), **Keberangkatan** (naik bus) |
| Bottleneck / paling lambat | Tahap dengan kapasitas terkecil; menentukan arus penumpang seluruh terminal |
| Arus | Penumpang per detik (pnp/dtk) yang benar-benar melewati terminal |
| Kepala | Kepala tahap yang direkrut sekali bayar; ketiganya membuat terminal tetap menghasilkan uang saat game ditutup |
| Naik kelas | Prestige: terminal dibangun ulang dari awal dengan bonus pendapatan permanen (Tipe C → B → A → Terpadu ★) |
| Hari terminal | Satu hari jam terminal = 24 menit waktu main nyata (1 jam terminal = 60 detik) |
| Minggu WIB | Minggu nyata Senin 00.00 – Minggu 23.59 WIB, dipakai tantangan mingguan & papan peringkat |
| PO | Perusahaan Otobus (mitra), semua nama fiktif |
| N menit pendapatan | Satuan hadiah: pendapatan per detik saat itu (harga normal) × N × 60 |
