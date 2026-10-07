# 05 · Game Economy Design

Mata uang, sumber & pengeluaran, biaya upgrade, hadiah, dan pacing. Semua angka dari `src/config/economy.config.ts`. Nilai bertanda PLACEHOLDER di config belum berasal dari spreadsheet model dan boleh di-tuning. Formula ada di `src/sim/economy.ts` & `src/sim/state.ts`.

## 1. Mata uang

| Mata uang | Jenis | Didapat dari | Dipakai untuk | Saat naik kelas |
|---|---|---|---|---|
| **Uang (Rupiah)** | Lunak, angka besar (`break_infinity.js` Decimal) | Tiket, parkir kendaraan, parkir bus, sewa kios, hadiah | Semua pembelian | Kembali ke Rp 20 |
| **Poin prestige** | Permanen | Naik kelas: `⌊(pendapatan run ÷ Rp 100 rb)^0,5⌋` | Pengali pendapatan +10% per poin | Bertambah |

Tidak ada mata uang premium dan tidak ada pembelian dalam aplikasi.

**Satuan hadiah "N menit pendapatan"** = pendapatan per detik potensial (kapasitas penuh, harga normal, semua sumber termasuk sewa kios, sudah × prestige × event × kepuasan, belum × boost) × N × 60, minimal Rp 50. Hadiah jadi tetap sebanding dengan besarnya terminal di setiap tahap permainan.

## 2. Rumus inti

```
kapasitas(tahap, L) = (kapAwal + tambahKap × (L − 1)) × 2^(milestone ≤ L)        milestone: 25, 50, 100, 200
                      × modernisasi tahap × (1 + 0,4 × (jalur − 1))  [jalur hanya Peron & Keberangkatan]
throughput          = min(kapasitas Peron, Loket, Keberangkatan)
permintaan          = (1 + 0,6 × kepuasan) × (0,4 + 0,6 × keramaian jam)
arus nyata          = throughput × kursi terisi(permintaan, harga)                   ≤ throughput
harga normal tiket  = Rp 5 × (1 + Σ bonus jurusan) × (1 + 0,03 × jumlah PO) × (1 + Σ bonus kelas bus)
pengali pendapatan  = (1 + 0,1 × poin prestige) × pengali event × (1 + bonus kepuasan) × boost
```

## 3. Sumber uang (faucet)

| Sumber | Dibayar | Per unit (sebelum pengali) | Catatan |
|---|---|---|---|
| Tiket | Tiap penumpang yang membeli tiket | Harga jurusan + tambahan kelas (normal: harga normal tiket) | Sumber utama |
| Parkir kendaraan | Tiap penumpang | Rp 0,15 × level Parkir Kendaraan | |
| Parkir bus jurusan | Tiap bus (20 penumpang) | Rp 5 × level Parkir Bus Jurusan | = Rp 0,25/penumpang per level |
| Sewa kios | Sekali per hari terminal (00.00) | Belanja Rp 0,2 × level Kios × (1 + 0,1 × level Toilet) per penumpang | Dikumpulkan sepanjang hari |
| Penghasilan offline | Saat kembali | Pendapatan/detik × min(pergi, 4 jam) × 50% | Hanya bila ketiga tahap punya Kepala |
| Hadiah | Saat diklaim | Lihat bagian 8 | |

Contoh komposisi per penumpang (harga normal, tanpa pengali):

| Keadaan | Tiket | Parkir bus | Parkir kendaraan | Belanja kios | Total |
|---|---|---|---|---|---|
| Terminal baru | Rp 5,00 | – | – | – | Rp 5,00 |
| 4 jurusan, 2 PO, 2 kelas bus, semua fasilitas Lv 10 | Rp 7,29 (48%) | Rp 2,50 (16%) | Rp 1,50 (10%) | Rp 4,00 (26%) | Rp 15,29 |
| 8 jurusan, 7 PO, 3 kelas bus, fasilitas Lv 30 | Rp 20,06 (36%) | Rp 7,50 (13%) | Rp 4,50 (8%) | Rp 24,00 (43%) | Rp 56,06 |

## 4. Pengeluaran (sink)

### 4.1 Upgrade tahap

`biaya(L → L+1) = biayaAwal × r^(L − 1)`

| Level | Peron (Rp 15, r 1,08) | Loket (Rp 22, r 1,085) | Keberangkatan (Rp 30, r 1,09) |
|---|---|---|---|
| 1 | Rp 15 · 1,0 pnp/dtk | Rp 22 · 0,8 | Rp 30 · 0,9 |
| 10 | Rp 30 · 5,5 | Rp 45,8 · 4,8 | Rp 65,2 · 5,4 |
| 25 | Rp 95 · 26,0 | Rp 156 · 23,2 | Rp 237 · 25,8 |
| 50 | Rp 651 · 102,0 | Rp 1,2 rb · 91,4 | Rp 2,0 rb · 101,6 |
| 100 | Rp 30,6 rb · 404,0 | Rp 70,8 rb · 362,8 | Rp 152,2 rb · 403,2 |
| 200 | Rp 67,2 jt · 1.608 | Rp 247,1 jt · 1.445,6 | Rp 841,4 jt · 1.606,4 |

(Format: biaya ke level berikutnya · kapasitas di level itu, tanpa modernisasi & jalur.)

### 4.2 Pembelian lain

| Pembelian | Biaya | Efek |
|---|---|---|
| Kepala Peron / Loket / Keberangkatan | Rp 50 / 150 / 400 (sekali) | Offline bila ketiganya ada |
| Fasilitas Lv 0→1 | Kios 80 · Parkir 200 · Toilet 50 · Parkir Bus 500 | Pertumbuhan ×1,11 (Parkir Bus ×1,12) per level |
| Fasilitas Lv 9→10 | Kios 205 · Parkir 512 · Toilet 128 · Parkir Bus 1,4 rb | |
| Fasilitas Lv 39→40 | Kios 4,7 rb · Parkir 11,7 rb · Toilet 2,9 rb · Parkir Bus 41,5 rb | |
| Jalur 2 / 3 / 4 / 5 | Rp 300 / 25 rb / 1,5 jt / 60 jt | Peron & Keberangkatan +40% per jalur |
| Jurusan 3–8 (Jawa–Bali) | Rp 2 rb → 15 jt | Tiket +10% s.d. +50% |
| Jurusan 9–16 (antarpulau) | Rp 60 jt → 1 T | Tiket +50% s.d. +100%; butuh kelas terminal |
| Kelas bus Patas / Eksekutif / Sleeper / Double Decker | Rp 25 rb / 750 rb / 6 jt / 50 jt | Tiket +10/20/30/40% |
| Modernisasi | Rp 1,5 rb – 400 rb | Kapasitas tahap ×1,15 – ×1,30 |
| Kontrak PO | Rp 5 rb / 150 rb / 3 jt / 80 jt | Tiket +3% per PO (permanen) |

## 5. Pengali pendapatan

| Pengali | Besar | Sifat |
|---|---|---|
| Prestige | +10% per poin | Permanen |
| Mitra PO | +3% harga tiket per PO (20 PO = +60%) | Permanen |
| Jurusan | Bonus tiket dijumlahkan (8 Jawa–Bali = +155%; 16 jurusan = +725%) | Per run |
| Kelas bus | Bonus dijumlahkan (5 kelas = +100%) | Per run |
| Kepuasan | 0% di bawah 70%, naik linear sampai +25% di 100% | Turunan keadaan terminal |
| Event musiman | Mudik ×1,5 · Nataru ×1,3 · HUT RI ×1,17 | Selama event (termasuk offline & hadiah) |
| Boost iklan | ×2 | +30 menit main per iklan, maks. 4 jam |
| Harga tiket | 50–200% harga jurusan + tambahan kelas 0–100% | Diatur pemain; lihat bagian 7 |

## 6. Penghasilan offline

- Syarat: ketiga tahap punya Kepala.
- Rumus: pendapatan/detik saat keluar × min(waktu pergi, 4 jam) × 50%.
  - Pendapatan/detik dihitung dari kapasitas (tanpa ritme jam, karena jam terminal berhenti saat game ditutup) dan ikut harga tiket, tanpa bisa melebihi harga normal.
  - Belanja kios ikut dihitung.
- Boost yang tersisa ikut berjalan dan habis selama pergi; detik ter-boost ×2.
- Jam perangkat dimundurkan → 0. Popup hanya muncul bila pergi ≥ 30 detik; penghasilannya tetap diberikan walau popup tidak muncul.
- Ambil 2× lewat iklan: laporan itu diberikan sekali lagi.

## 7. Harga tiket

- Tiket = harga jurusan (50–200% harga normal) + tambahan kelas (0–100% harga normal), diatur per 10% harga normal dalam Rupiah.
- Tiap pasangan jurusan × kelas punya jatah kursi tetap (bobot peminat). Calon penumpang segmen = permintaan × hj^(−ej) × (tiket ÷ hj)^(−ek). Kursi kosong tidak diisi segmen lain.
- **Harga terbaik** per segmen dalam sehari (dari simulasi):

| Elastisitas | Contoh segmen | Kepuasan 40% | Kepuasan 67% | Kepuasan 90% |
|---|---|---|---|---|
| 2,0 | Bus ekonomi | 100% (+0%) | 110% (+0,5%) | 110% (+3%) |
| 1,8 | Jakarta, Bandung | 100% (+0%) | 110% (+2%) | 110% (+4%) |
| 1,4 | Surabaya, Malang | 110% (+0,5%) | 120% (+4,5%) | 120% (+9%) |
| 1,2 | Mataram–Padang, Sleeper | 110% (+2%) | 120% (+7,5%) | 130% (+13%) |
| 1,15 | Bima–Banda Aceh, Double Decker | 110% (+2,5%) | 130% (+9%) | 140% (+15%) |

  Persen dalam kurung = tambahan uang tiket segmen itu dibanding harga normal (simulasi sehari, tanpa penalti terlalu mahal).
  - Harga 50% selalu memotong pendapatan segmen ±45%.
  - Harga 200% memotong pendapatan segmen peka harga hingga ±45%. Segmen paling tidak peka bisa sedikit untung di kepuasan tinggi, tapi di atas 125% penalti kepuasan berlaku untuk seluruh terminal.
  - Karena itu saran harga dibatasi di bawah 125%.
- **Penalti terlalu mahal**: tiket di atas 125% harga normal → kepuasan × (1 − 0,6 × kelebihan rata-rata berbobot kursi), maks. −60%. Akibatnya penumpang di semua jurusan berkurang dan bonus kepuasan hilang. Saran harga selalu di bawah batas ini.
- **Anti-curang**: target, hadiah "N menit pendapatan", dan rekor arus memakai harga normal. Offline tidak bisa melebihi harga normal.

## 8. Hadiah

| Hadiah | Besar | Opsi 2× (iklan) |
|---|---|---|
| Target harian | 2 menit pendapatan | Ya |
| Penghargaan (18) | 3 menit pendapatan masing-masing | Ya |
| Tantangan mingguan (3 per minggu) | 15 menit pendapatan masing-masing | Tidak |
| Event musiman (3 tahap) | 5 / 15 / 30 menit pendapatan + PO eksklusif di tahap terakhir | Tidak |
| Bus Emas (tiap 5–10 menit main, 60 detik) | 10 menit pendapatan (lewat iklan) | – |
| Boost 2× | Semua pendapatan ×2, +30 menit per iklan, maks. 4 jam | – |
| Penghasilan offline | Lihat bagian 6 | Ya ("Ambil 2×") |
| Naik kelas | Poin prestige; PO Juara Kelas (Tipe B) & Juara Umum (Tipe A) | Tidak |

## 9. Prestige (naik kelas)

| Naik ke | Poin minimal dari run ini | Pendapatan run minimal |
|---|---|---|
| Tipe B | 3 | Rp 900 rb |
| Tipe A | 8 | Rp 6,4 jt |
| Terpadu ★1 | 15 | Rp 22,5 jt |
| Terpadu ★2 | 25 | Rp 62,5 jt |
| Terpadu ★3 | 35 | Rp 122,5 jt |
| berikutnya | +10 poin per kelas | `Rp 100 rb × poin²` |

Poin selalu dihitung dari pendapatan run berjalan (eksponen 0,5). Run yang lebih panjang memberi lebih banyak poin, tapi dengan hasil yang makin berkurang.

## 10. Pacing & patokan

| Patokan | Nilai |
|---|---|
| Uang awal | Rp 20 (cukup untuk upgrade Peron pertama, Rp 15) |
| Pendapatan awal | ±0,8 penumpang/detik × Rp 5 = ±Rp 4/detik (1 tiket tiap ±1,25 detik) |
| Kepala pertama (Rp 50) | ±10 detik tanpa membeli apa pun |
| Greedy spreadsheet | 134 pembelian bottleneck → Peron 43 / Loket 49 / Keberangkatan 44 dalam 270–330 detik (dites) |
| Satu hari terminal | 24 menit main (target harian, sewa kios, rekor) |
| Sepekan terminal | ±2,8 jam main |
| Kapasitas terisi rata-rata sehari | ±84% (kepuasan 30%) · ±91% (67%) · ±94% (90%) |
| Offline maksimum | 4 jam × 50% |

## 11. Perlindungan ekonomi

| Celah | Penanganan |
|---|---|
| Menggelembungkan hadiah lewat harga tiket | Hadiah, target, rekor arus memakai harga normal |
| Offline dengan harga mahal | Offline ikut peminat harga; tidak pernah melebihi harga normal |
| Memundurkan/memajukan jam perangkat | Selisih negatif → 0; offline dibatasi 4 jam; tantangan & peringkat memakai jam server untuk validasi |
| Mode sinema mempercepat ekonomi | Hanya tampilan yang dipercepat; ekonomi tetap kecepatan game |
| Memaksa event (`?event=…`) | Diabaikan di build produksi |
| Skor peringkat palsu | Validasi server (skor tidak turun, batas kenaikan 100.000 pnp/dtk × 3×, rate limit 20 detik, daftar larangan); peringkat tanpa hadiah gameplay |
| Kehilangan pecahan transaksi | Sisa penumpang/bus disimpan di save |

## 12. Kenop tuning

| Grup | Kunci di `EKONOMI` |
|---|---|
| Tahap | `tahap.<id>.biayaAwal, r, kapAwal, tambahKap, biayaKepala`, `multMilestone`, `milestone` |
| Pendapatan dasar | `nilaiPerPenumpang`, `uangAwal`, `penumpangPerBus`, `fasilitas.*` |
| Permintaan | `permintaan.dasar, perKepuasan, ritmeMin` |
| Harga | `harga.min, maks, langkah, tambahanMaks, ambangMahal, penaltiMahal, penaltiMaks`, `jurusan[i].peminat/elastisitas`, `kelasBus.<id>.peminat/elastisitas` |
| Kepuasan | `kepuasan.bobot, bonusPendapatan, bonusMulai, rasioLancar, rasioNol, fasilitasDasar, fasilitasPerLog2, jalurPerLog10` |
| Progres | `jalur`, `jurusan`, `kelasBus`, `teknologi`, `po`, `kelas`, `ambangPrestige`, `bonusPrestige`, `eksponenPrestige` |
| Hadiah | `harian`, `hadiahMenitPencapaian`, `tantangan`, `event`, `hadiah` |
| Offline | `batasOfflineDetik`, `efisiensiOffline` |
