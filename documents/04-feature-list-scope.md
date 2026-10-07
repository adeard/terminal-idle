# 04 · Feature List & Scope

Daftar fitur per fase. Status per kode di repositori, 6 Oktober 2026.

Keterangan status:

- ✅ selesai & ada di kode;
- 🟡 selesai di kode tapi belum aktif atau belum dirilis;
- ⏳ belum dikerjakan;
- 💡 usulan, belum diputuskan.

## 1. MVP: rilis web (PWA) v0.1.x

Batasan & kriteria MVP ada di [11 · MVP Definition](11-mvp-definition.md).

### 1.1 Gameplay inti

| Fitur | Status | Catatan |
|---|---|---|
| Rantai tiga tahap (Peron → Loket → Keberangkatan), upgrade berbiaya eksponensial, milestone ×2 | ✅ | Formula identik dengan spreadsheet model (dites) |
| Bottleneck terlihat (kartu, label peta, sorotan lantai, antrean 3D) | ✅ | |
| Terminal berjalan sendiri sejak awal (tanpa tombol PROSES) | 🟡 | Di repo; dirilis bersama v0.2.0 |
| Kepala tahap & penghasilan offline (maks. 4 jam × 50%) | ✅ | |
| Popup "Selama kamu pergi…" | ✅ | |
| Kepuasan penumpang (3 komponen, bonus s.d. +25%) | ✅ | |
| Kepuasan → penumpang datang, ritme jam (malam berangsur sepi) | 🟡 | Di repo |
| Uang masuk per transaksi; HUD "Hari ini Rp X · N tiket" | 🟡 | Di repo |
| Harga tiket per jurusan & tambahan kelas (Rupiah), saran harga, penalti terlalu mahal | 🟡 | Di repo |
| Kecepatan 1× / 2× / 3× | ✅ | |

### 1.2 Pengelolaan terminal

| Fitur | Status |
|---|---|
| Fasilitas: Kios & Minimarket (sewa harian), Parkir Kendaraan, Toilet & Musholla, Parkir Bus Jurusan | ✅ |
| Jalur bus 1–5 (terminal "tumbuh" di adegan) | ✅ |
| 16 jurusan: 8 Jawa–Bali + 8 rute antarpulau dengan kapal feri | ✅ |
| 5 kelas bus (Ekonomi → Double Decker) | ✅ |
| 20 mitra PO dengan livery di adegan | ✅ |
| 6 modernisasi (2 per tahap) | ✅ |
| Naik kelas terminal (prestige) Tipe C → B → A → Terpadu ★n | ✅ |
| Nama terminal (papan gapura, foto, peringkat) | ✅ |

### 1.3 Tujuan & retensi

| Fitur | Status |
|---|---|
| Tutorial terpandu 4 langkah (tidak menghalangi, bisa dilewati) | ✅ |
| Target harian (2 jenis bergantian) | ✅ |
| Tantangan mingguan (3 dari 5 jenis, jam nyata WIB) | ✅ |
| 18 penghargaan | ✅ |
| Rekor terminal (harian & arus tertinggi) | ✅ |
| Event musiman: Mudik Lebaran, HUT RI, Nataru | ✅ |
| Papan peringkat mingguan (login Google + persetujuan) | ✅ |

### 1.4 Dunia, audio & presentasi

| Fitur | Status |
|---|---|
| Adegan 3D maket (three.js + post-processing), kualitas adaptif 5 tingkat | ✅ |
| Keramaian dekoratif: siklus bus lengkap, labirin antrean, mampir toilet/musholla/ATM, rombongan, pengantar | ✅ |
| Siang–malam, cuaca hujan berpetir, jam buka toko, kehidupan malam | ✅ |
| Klakson telolet & anak "OM TELOLET OM" | ✅ |
| Suara sintesis Web Audio + pengumuman bahasa Indonesia | ✅ |
| Foto terminal & bagikan (web) | ✅ |
| Mode sinema untuk video promosi | ✅ |
| Portrait & landscape, panel ringkas | ✅ |

### 1.5 Platform & layanan

| Fitur | Status |
|---|---|
| PWA (pasang ke layar utama, main offline) | ✅ |
| Pembaruan in-game ("Versi baru tersedia", versi minimal wajib) | ✅ |
| Save lokal + autosave + cadangan save korup | ✅ |
| Login Google & cloud save Firestore dengan deteksi konflik; hapus akun | ✅ |
| Analitik GA4 (corong, fitur, iklan, error, ringkasan sesi) | ✅ |
| Kebijakan privasi (ID/EN, UU PDP) | ✅ |
| Iklan berhadiah (Google H5 Games Ads): boost 2×, Bus Emas, 2× offline, klaim 2× | 🟡 Nonaktif sampai ID AdSense diisi & disetujui |

## 2. Phase 2: monetisasi & distribusi

| Fitur | Status | Catatan |
|---|---|---|
| Rilis v0.2.0 (fitur 🟡 di atas) | ⏳ | Naikkan `version`, isi `catatan` rilis, `npm run deploy:web` |
| Aktifkan AdSense + H5 Games Ads | ⏳ | Isi `ID_PENERBIT_ADSENSE`, tunggu persetujuan, aktifkan pesan persetujuan Eropa |
| Daftarkan parameter peristiwa sebagai custom dimension/metric GA4 | ⏳ | Termasuk `jurusan`, `kelas` untuk `atur_harga` |
| Rilis Android di Play Store | ⏳ | Ganti `appId` (usulan `games.bustation.app`), AAB bertanda tangan, aset listing |
| Login Google native di APK | ⏳ | Butuh plugin native (popup diblokir di WebView) |
| Iklan AdMob di APK | ⏳ | Lewat plugin native; perbarui kebijakan privasi lebih dulu |
| Foto & bagikan di APK | ⏳ | WebView Android tidak punya Web Share API |
| Portal web (CrazyGames / GameDistribution) | ⏳ | Integrasi SDK portal & iklan portal |
| Video promosi TikTok/Reels | ⏳ | Direkam dengan mode sinema |
| Anggaran performa 3D ditinjau ulang | ⏳ | Pengukuran dev terakhir ±300 draw call di tingkat 1, sedangkan target ±210 |

## 3. Phase 3: pengembangan konten (usulan)

Belum diputuskan. Disusun dari ruang yang sudah disiapkan di kode dan pola sistem yang ada.

| Usulan | Dasar | Catatan desain |
|---|---|---|
| 💡 Terminal/kota kedua | `TerminalState.id` sudah ada ("nanti kota/terminal tambahan dapat id sendiri") | Perlu keputusan: terminal paralel atau berurutan setelah Terpadu |
| 💡 Skill aktif Kepala | `KepalaState` disiapkan untuk level & cooldown tanpa mengubah bentuk save | Contoh: "jam sibuk" (kapasitas sementara), "promosi" (permintaan sementara) |
| 💡 Event musiman tambahan | Kalender event murni di `src/sim/event.ts` | Mis. Imlek, libur sekolah; perlu PO eksklusif baru |
| 💡 Harga tiket mengikuti jam (tarif jam sibuk) | Mekanik harga & ritme sudah ada | Tambah kedalaman; risiko mikro-manajemen |
| 💡 Hadiah kosmetik papan peringkat | Peringkat sekarang tanpa hadiah | Hanya kosmetik (bingkai papan nama), tidak memengaruhi ekonomi |

## 4. Di luar cakupan (non-goals)

- Mata uang premium, pembelian dalam aplikasi, atau loot box.
- Iklan paksa (interstisial/banner) dan fitur yang dikunci di balik iklan.
- Multiplayer realtime, chat, atau perdagangan antarpemain.
- Penumpang dan bus sebagai simulasi ekonomi per agen. Keramaian 3D tetap dekoratif, dan ekonomi tetap model agregat yang bisa dites.
- Rute/peta jalan antarkota yang bisa dikendarai.
