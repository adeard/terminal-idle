# 10 · API Specification

Endpoint dan kontrak komunikasi antara game (frontend) dan layanan luar. Game tidak punya server gameplay: ekonomi berjalan di klien. Layanan luar hanya untuk papan peringkat, login & cloud save, pembaruan versi, analitik, dan iklan.

## 1. Ringkasan antarmuka

| Antarmuka | Arah | Protokol | Kode |
|---|---|---|---|
| Papan peringkat `/api/peringkat` | Game ↔ Cloudflare Pages Functions + D1 | HTTPS JSON | `server/peringkat.ts`, `functions/api/peringkat/`, klien `src/platform/peringkat.ts` |
| Proksi login `/__/*` | Browser ↔ Cloudflare → Firebase Auth | HTTPS (diteruskan apa adanya) | `functions/__/[[path]].js` |
| Cloud save `saves/{uid}` | Game ↔ Firestore | Firebase SDK (Firestore Lite) | `src/platform/firebase.ts`, `firestore.rules` |
| Info versi `/versi.json` | Game ← situs | HTTPS JSON | `vite.config.ts`, `src/app/pembaruan.ts` |
| Analitik | Game → GA4 | gtag.js | `src/app/analitik.ts`, `src/platform/analitik.ts` |
| Iklan berhadiah | Game ↔ Google H5 Games Ads | Ad Placement API (`adBreak`) | `src/app/iklan-h5.ts`, `src/platform/iklan.ts` |

Base URL produksi: `https://bustation.games`.

---

## 2. Papan peringkat: `/api/peringkat`

### 2.1 Konvensi

- **Format**: `Content-Type: application/json; charset=utf-8`. Jawaban default `Cache-Control: no-store`.
- **Autentikasi** (rute bertanda 🔒): `Authorization: Bearer <Firebase ID token>`. Server memverifikasi:
  - tanda tangan RS256 dengan kunci publik Google;
  - `aud` = `bustation-a4de9`;
  - `iss` = `https://securetoken.google.com/bustation-a4de9`;
  - token belum kedaluwarsa;
  - penyedia login Google.

  Token tidak sah atau tidak ada → `401 {"galat":"token"}`.
- **Minggu**: kunci minggu = tanggal Senin WIB `YYYY-MM-DD` (mis. `2026-10-05`). Minggu dimulai Senin 00.00 WIB (UTC+7).
- **Format galat**: `{ "galat": "<kode>" }`.

| Kode | HTTP | Arti | Tindakan klien |
|---|---|---|---|
| `token` | 401 | Belum login / sesi login berakhir | Hentikan pengiriman sampai dimuat ulang; minta login lagi |
| `dilarang` | 403 | Akun ada di tabel `larangan` | Hentikan pengiriman |
| `terlalu-sering` | 429 | Kiriman < 20 dtk sejak sebelumnya; header `Retry-After` (detik) | Tunggu lalu coba lagi |
| `minggu-lain` | 409 | `minggu` bukan minggu ini menurut jam server | Tahan sampai minggu berubah; tampilkan "jam perangkat salah" |
| `nama-kosong` | 422 | Nama terminal kosong setelah dirapikan | Tahan sampai nama diubah |
| `nama-ditolak` | 422 | Nama mengandung kata terlarang | Tahan sampai nama diubah |
| `skor-tidak-wajar` | 422 | Skor naik lebih cepat dari yang mungkin | Tahan |
| `data-salah` | 400 | Bentuk body salah / bukan JSON | Tahan; sarankan perbarui game |
| `server` | 500 | Galat tak terduga (isi tidak dibocorkan) | Coba lagi dengan jeda makin panjang (30 dtk … 10 menit) |
| `jaringan` | – | Hanya di klien (fetch gagal) | Seperti `server` |

### 2.2 `GET /api/peringkat?minggu=YYYY-MM-DD`

Publik. Baris teratas papan.

| Parameter | Wajib | Keterangan |
|---|---|---|
| `minggu` | Tidak | Hanya kunci **minggu lalu** yang dihormati; nilai lain (atau kosong) = minggu ini |

**200 OK**

```json
{
  "minggu": "2026-10-05",
  "jumlah": 128,
  "daftar": [
    { "id": "0k3x9a1b2c3", "nama": "Sukamaju", "kelas": 1, "skor": 184230 },
    { "id": "1p8q7r6s5t4", "nama": "Harapan Jaya", "kelas": 0, "skor": 120004 }
  ]
}
```

| Field | Tipe | Keterangan |
|---|---|---|
| `minggu` | string | Minggu yang benar-benar dikembalikan |
| `jumlah` | int | Banyaknya terminal yang ikut minggu itu |
| `daftar[]` | array (≤ 50) | Urut skor menurun, lalu yang lebih dulu mencapai skor itu |
| `daftar[].id` | string | Id publik (hash uid) untuk menandai baris sendiri; bukan uid |
| `daftar[].nama` | string | Nama terminal |
| `daftar[].kelas` | int | 0 = Tipe C, 1 = Tipe B, 2 = Tipe A, 3+ = Terpadu ★(kelas − 2) |
| `daftar[].skor` | int | Penumpang minggu itu |

Header: `Cache-Control: public, max-age=60` (minggu ini) atau `max-age=600` (minggu lalu), `Access-Control-Allow-Origin: *`. Di-cache juga di edge Cloudflare.

### 2.3 `GET /api/peringkat/saya` 🔒

Skor & peringkat pemain yang login, minggu ini.

**200 OK**

```json
{ "minggu": "2026-10-05", "skor": 98120, "peringkat": 17, "jumlah": 128 }
```

| Field | Tipe | Keterangan |
|---|---|---|
| `skor` | int \| null | null = belum ada skor minggu ini |
| `peringkat` | int \| null | Dihitung sampai 1.000; null bila belum ada skor atau di luar 1.000 besar |
| `jumlah` | int | Peserta minggu ini |

### 2.4 `POST /api/peringkat` 🔒

Kirim skor minggu ini. Nama & kelas ikut diperbarui.

**Body**

```json
{ "minggu": "2026-10-05", "skor": 98120, "kelas": 1, "nama": "Sukamaju" }
```

| Field | Tipe | Validasi |
|---|---|---|
| `minggu` | string | Minggu ini menurut jam server; minggu lalu diterima ≤ 10 menit setelah Senin 00.00 WIB |
| `skor` | number ≥ 0 | Dibulatkan ke bawah. Tidak boleh melebihi `skor lama + 100.000 × 3 × detik sejak kiriman lama + 1.000` (bila belum ada kiriman: sejak awal minggu) |
| `kelas` | int 0 … 10.000 | |
| `nama` | string ≤ 72 karakter | Dirapikan seperti di game (maks. 18 huruf; huruf, angka, spasi, `.`, `'`, `-`; awalan "Terminal" dibuang) lalu disaring kata kasar/cabul/kebencian (termasuk ejaan angka "leet") |

Aturan tambahan:

- satu kiriman per akun tiap 20 dtk;
- akun terlarang ditolak;
- skor tersimpan = max(skor baru, skor lama), jadi skor tidak pernah turun;
- data minggu sebelum minggu lalu dibuang saat kiriman ini.

**200 OK**

```json
{ "minggu": "2026-10-05", "skor": 98120 }
```

Galat: `401 token`, `403 dilarang`, `429 terlalu-sering` (+ `Retry-After`), `409 minggu-lain`, `422 nama-kosong | nama-ditolak | skor-tidak-wajar`, `400 data-salah`, `500 server`.

**Jadwal kirim di klien** (`PengirimSkor`):

- paling sering tiap 3 menit;
- segera bila nama, kelas, atau minggu berubah;
- segera saat game dijeda;
- kiriman berjarak minimal 25 dtk.

### 2.5 `DELETE /api/peringkat` 🔒

Hapus semua skor pemain ini di semua minggu (keluar papan / hapus akun). Hitungan `peserta` dikurangi.

**204 No Content**, tanpa body. Galat: `401 token`, `500 server`.

---

## 3. Proksi login: `/__/*`

`https://bustation.games/__/*` diteruskan apa adanya ke `https://bustation-a4de9.firebaseapp.com/__/*`. Dengan `authDomain = bustation.games`, popup login Google berada di domain yang sama dengan game, sehingga tetap jalan di browser yang memblokir cookie pihak ketiga (Safari, PWA iPhone). Hanya rute `/__/*` yang memanggil Function ini.

---

## 4. Cloud save: Firestore `saves/{uid}`

Diakses lewat Firebase SDK (Firestore Lite), bukan REST manual.

| Operasi | Kontrak |
|---|---|
| Baca | `getDoc(saves/{uid})` → `{ isi, revisi }` atau tidak ada. Klien menyerah setelah 6 dtk saat memulai game |
| Tulis | `setDoc(saves/{uid}, { isi, revisi: revisiDasar + 1, schemaVersion, diperbarui: serverTimestamp() })`. Rules menolak bila `revisi` ≠ revisi tersimpan + 1 (dokumen baru: 1); klien membaca penolakan sebagai **konflik** lalu menanyakan pemain bila perlu. Batas tunggu 12 dtk |
| Hapus | `deleteDoc(saves/{uid})` (hapus akun) |

Aturan akses (`firestore.rules`):

- hanya `request.auth.uid == uid`;
- field hanya `isi`, `revisi`, `schemaVersion`, `diperbarui`;
- `isi` string 1–100.000 karakter;
- `schemaVersion` int ≥ 1;
- `diperbarui == request.time`.

Isi `isi` = JSON `SaveV1` (lihat [09 · Data Model](09-data-model-erd.md#2-model-save-game-savev1)).

---

## 5. Google Analytics 4 (keluar)

gtag.js ke `G-L03D1C21GC`, web saja, tanpa sinyal Google & personalisasi iklan. Nama terminal, email, dan uid tidak pernah dikirim.

| Peristiwa | Parameter | Kapan |
|---|---|---|
| `mulai_game` | `save` (baru/dimuat/korup), `akun` (tamu/login) | Game dimuat |
| `tutorial_begin` / `tutorial_complete` | – | Tutorial dimulai / selesai |
| `tutorial_langkah` | `langkah`, `nomor` | Tiap langkah terpenuhi |
| `tutorial_lewati` | `langkah` | Tutorial dilewati |
| `upgrade_tahap` | `tahap`, `level` | Level 2, 5, 10, 25, 50, 100, 150, 200, 300, 400, 500 |
| `rekrut_kepala` | `tahap`, `jumlah_kepala` | |
| `bangun_fasilitas` | `fasilitas`, `level` | Level 1 & level tonggak |
| `buka_jalur` | `jalur` | |
| `buka_jurusan` | `jurusan`, `jumlah` | |
| `beli_teknologi` | `teknologi` | |
| `beli_kelas_bus` | `kelas` | |
| `atur_harga` | `jurusan` atau `kelas` | Sekali per sesi tiap jurusan/kelas |
| `kontrak_po` | `po` | |
| `po_bergabung` | `po`, `cara` (jurusan/kontrak/kelas/event) | |
| `naik_kelas` | `kelas`, `poin` | |
| `klaim_event` | `edisi`, `tahap` | |
| `klaim_target` | `ganda` | |
| `klaim_penghargaan` | `penghargaan`, `ganda` | |
| `klaim_tantangan` | `jenis`, `minggu` | |
| `iklan_hadiah` | `tempat`, `hasil` | Tiap permintaan iklan |
| `hadiah_boost` / `hadiah_bus_emas` / `hadiah_offline_2x` | – | Hadiah iklan diberikan |
| `nama_terminal` | `ada` (true/false) | Nama diubah |
| `peringkat_buka` | `akun`, `ikut` | Popup papan dibuka |
| `peringkat_ikut` / `peringkat_keluar` | – | |
| `login` | `method: Google` | |
| `telolet` | – | Sekali per sesi |
| `foto_terminal` | – | |
| `share` | `method` (web_share/unduh), `content_type` | |
| `mode_sinema` | `waktu`, `cuaca` | |
| `adegan_siap` / `adegan_gagal` | `detik` | Adegan 3D dimuat / gagal |
| `exception` | `description` (≤ 100 karakter + `@berkas:baris`), `fatal` | Error JS/promise; tiap pesan sekali, maks. 10 per sesi |
| `ringkasan_sesi` | `detik`, `detik_main`, `penumpang`, `pendapatan_log10`, `upgrade`, `kelas`, `jalur`, `jurusan`, `level_rata`, `kepuasan` | Saat game ke latar |

Parameter perlu didaftarkan sebagai custom dimension/metric di GA4 agar tampil di laporan.

---

## 6. Info versi: `GET /versi.json`

Dibuat saat build. Tidak di-precache service worker dan tidak boleh di-cache lama oleh CDN.

```json
{ "versi": "0.2.0", "versiMinimal": "0.1.0", "catatan": ["Atur harga tiket per jurusan & kelas bus"], "dibuat": "2026-10-06T08:00:00.000Z" }
```

| Field | Keterangan |
|---|---|
| `versi` | `version` di `package.json` |
| `versiMinimal` | Versi di bawah ini mendapat popup pembaruan wajib |
| `catatan` | ±4 butir "Yang baru" untuk popup |
| `dibuat` | Waktu build (ISO) |

---

## 7. Iklan berhadiah: Google H5 Games Ads

Klien memanggil `adBreak` dengan `type: 'reward'`:

| Callback | Perilaku game |
|---|---|
| `beforeAd` / `afterAd` | Bisukan / pulihkan suara |
| `beforeReward(showAdFn)` | Iklan siap → tombol hadiah boleh tampil; `showAdFn` dipanggil saat pemain mengetuk |
| `adViewed` | Beri hadiah |
| `adDismissed` | Tanpa hadiah |
| `adBreakDone(info)` | Bila tidak ada iklan: siaga dicoba lagi dengan jeda 15 dtk → 5 menit |

Tempat hadiah (`tempat` di analitik): `boost`, `busEmas`, `offline2x`, `target2x`, `penghargaan2x`. Nonaktif selama `ID_PENERBIT_ADSENSE` kosong. `?iklan=uji` memakai iklan uji Google; `?iklan=contoh` memakai iklan contoh lokal.

---

## 8. Kontrak internal: aksi pemain

UI tidak mengubah state langsung. UI mengirim **aksi** (`src/sim/aksi.ts`) ke `PengendaliGame`, yang menerapkannya lewat `terapkanAksi`. Aksi yang tidak berlaku mengembalikan state yang sama.

| Aksi | Data |
|---|---|
| `upgrade`, `rekrutKepala` | `tahap` |
| `bangunFasilitas` | `fasilitas` |
| `bukaJurusan`, `bukaJalur`, `naikKelas`, `klaimEvent` | – |
| `beliTeknologi` | `teknologi` |
| `beliKelasBus` | `kelas` |
| `aturHargaJurusan` | `indeks`, `persen` (harga normal; dirapikan 50–200, kelipatan 10) |
| `aturTambahanKelas` | `kelas`, `persen` (dirapikan 0–100, kelipatan 10) |
| `kontrakPo` | `po` |
| `klaimTantangan` | `indeks` |
| `klaimTarget` | `ganda?` |
| `klaimPencapaian` | `pencapaian`, `ganda?` |
| `aktifkanBoost`, `tahanBusEmas`, `lepasBusEmas`, `klaimBusEmas`, `klaimBonusOffline` | – (hadiah iklan; dikirim UI setelah iklan selesai) |
| `aturNamaTerminal` | `nama` |
| `aturIkutPeringkat` | `ikut` |
