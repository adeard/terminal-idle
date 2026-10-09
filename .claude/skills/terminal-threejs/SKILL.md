---
name: terminal-threejs
description: "Aturan & pola three.js untuk game 'Bustation: Idle Bus' (dulu 'Terminal Bus Tycoon') di repo ini (TypeScript + Vite + three.js r186 + postprocessing, overlay DOM, Capacitor). Pakai SETIAP KALI menambah atau mengubah adegan 3D di src/game/ — bangunan, denah, bus, orang/kerumunan, papan & teks, material, siang–malam, cuaca, kamera, performa — dan saat memverifikasi tampilan lewat screenshot. Skill Phaser lain di folder ini BUKAN untuk game ini. Triggers on: three.js, 3D, adegan, mesh, material, tekstur, InstancedMesh, geometri, denah, tata letak, gedung, bus, orang, kerumunan, papan, kamera, bayangan, shader, malam, hujan, performa, draw call, screenshot."
---

# Bustation: Idle Bus — three.js

Game idle tycoon terminal bus, tampilan maket 3D. Semua penamaan & komentar dalam
bahasa Indonesia. Balas pengguna dalam bahasa Indonesia.

## 1. Lapisan & batas

| Folder | Isi | Boleh import three.js? |
| --- | --- | --- |
| `src/sim/`, `src/config/`, `src/app/` | ekonomi, state, save, jam, cuaca | **Tidak** (juga tanpa DOM, dicek `tsconfig.sim.json`) |
| `src/game/` modul murni | `tata-letak`, `dunia-visual`, `jalur`, `laju`, `langit`, `suara`, `rombongan`, `kamera`, `kehidupan-malam`, `jadwal`, `bayangan`, `label-bus`, `label-loket`, `kas-visual`, `telolet`, `perluasan-adegan`, `kembang-api`, `aset*` | **Tidak** (daftar `GAME_MURNI` di `tests/arsitektur.test.ts`) |
| `src/game/*3d.ts`, `adegan.ts`, `terminal3d.ts` | render three.js | Ya — hanya **membaca** state, tidak pernah mengirim aksi |
| `src/ui/` | overlay DOM | Tidak |

Pola wajib: **logika di modul murni + tes, 3D hanya menggambar hasilnya.** Contoh:
`kehidupan-malam.ts` (jam buka, rute patroli) → `malam3d.ts` (rolling door);
`jadwal.ts` → `papan-jadwal3d.ts`; `dunia-visual.ts` (bus & orang) →
`kendaraan3d.ts` / `orang3d.ts`. Modul murni baru: tambahkan ke `GAME_MURNI`.

Semua ini **murni tampilan**: angka ekonomi hanya dari `src/config/economy.config.ts`
lewat `src/sim/`.

## 2. Koordinat & skala

- 1 unit = 1 petak ≈ 5 m. Denah `(x, y)` → three.js `(X = x, Z = y)`, tinggi = `Y`.
- `y` besar = selatan (ke arah kamera awal). Kamera awal dari arah +x+y, elevasi 42°.
- **Semua posisi denah di `src/game/tata-letak.ts`** (jalan, lajur, halte, petak parkir,
  gedung, loket, labirin antrean, kursi, gerbang). Jangan tulis koordinat lepas di modul 3D
  kalau bisa diturunkan dari sana.
- Lapisan tinggi permukaan (hindari z-fighting): rumput 0 · lantai kompleks 0,012 ·
  taman 0,016 · aspal 0,02 · marka 0,026 · peron/ruang tunggu `TINGGI_PERON` 0,15 ·
  lantai aula `TINGGI_LANTAI_GEDUNG` 0,12. `tinggiLantai(x, y)` memberi tinggi lantai bangunan.
- Ukuran acuan: orang dewasa ±0,38 tinggi · bus 2,4 × 0,56 × 0,8 · motor ±0,34.
- Di tes geometri pakai `jejakBus`, `jarakPoligon`, `ruasBerpotongan` (`tests/helpers.ts`)
  untuk memastikan bus tidak menyenggol / orang tidak menembus tali & kursi.

## 3. Geometri statis: `Kumpulan`

```ts
const k = new Kumpulan();
k.tambah(m.panel, kotak(x0, y0, x1, y1, h0, h1));            // balok sejajar sumbu
k.tambah(m.aspal, uvDunia(bidang(x0, y0, x1, y1, 0.02), SKALA_UV.aspal), { bayangan: false });
k.tambah(papan.material, persegiTegak([xa, y], [xb, y], h0, h1, papan.uv, 0.004), { bayangan: false });
k.bangun(induk);                                             // satu Mesh per material
```

- `Kumpulan` menggabungkan semua geometri **per material** menjadi satu mesh. Opsi mesh
  (`bayangan`, `terimaBayangan`, `urutan`) diambil dari `tambah()` **pertama** untuk material itu.
- Helper di `geometri.ts`: `kotak`, `bidang`, `bidangPutar` (persegi diputar di tanah),
  `silinder`, `pita` (jalur berkelok), `persegiTegak` (bidang tegak), `uvDunia`,
  `bayanganKontak` (bayangan lembut yang dipanggang), `atapLengkung`/`Busur`/`rusukBusur`.
- `persegiTegak(a, b, …)`: normal menghadap kanan arah a→b dilihat dari atas.
  a→b ke +x ⇒ menghadap +y (selatan/kamera); a→b ke −y ⇒ menghadap +x (timur).
- Objek yang **muncul/hilang** (papan jurusan, modernisasi, rolling door): bangun
  `Kumpulan` terpisah ke `THREE.Group`, lalu ubah `group.visible`. Jangan membangun
  geometri ulang tiap frame.

## 4. Objek dinamis: `InstancedMesh`

Orang, bus, kendaraan kecil, motor ojek, busa cuci, genangan, cahaya malam — semua
`InstancedMesh`. Pola: `frustumCulled = false`, isi `setMatrixAt`/`setColorAt`, set
`count`, lalu `instanceMatrix.needsUpdate = true` (dan `instanceColor`). Pakai ulang
objek `Matrix4`/`Vector3`/`Quaternion` milik kelas — **jangan alokasi per frame**.

**Orang** (`orang3d.ts`, `Kerumunan3D`): `k.mulai()` → `k.tambah(DataOrang, dt)` per
orang → `k.selesai()`. `DataOrang`: `id` unik & stabil, `x, y, h`, `penampilan`, opsional
`pose: 'duduk'`, `hadap`, `payung`, `lambai`, `sapu`, `baki`. Arah hadap & ayunan langkah
dihitung dari perpindahan posisi, jadi cukup gerakkan x/y. Rentang id:
`ID_TROTOAR` 1 jt, `ID_STATIS` 2 jt (+200 kebersihan, +210 asongan),
`ID_PETUGAS_CUCI` 3 jt, `ID_PENGIKUT` 4 jt, `ID_PEKERJA_PROYEK` 5 jt.

## 5. Material, siang–malam, cuaca

- Semua material dari `buatMaterial()` (`material3d.ts`, `PustakaMaterial`). Pakai ulang;
  jangan buat material baru per objek.
- **Jangan memicu kompilasi ulang shader saat berjalan** (ganti ada/tidaknya `map`,
  `transparent`, `defines`, dsb.). Malam = `aturMalam()` hanya mengubah
  `emissiveIntensity` (daftarkan material lewat `daftar(...)`); basah = `aturBasah()`
  mengalikan `color`. Mengganti objek tekstur pada `map` yang sudah ada boleh.
- Teks papan: `m.teks(isi, opsi)` → atlas bersama (di-cache per isi + opsi, halaman atlas
  bertambah otomatis). Jaga ukuran kanvas wajar (≤ 1024 × 256).
- Tekstur yang berubah (papan jadwal): gambar ulang kanvas **hanya saat isinya berubah**
  lalu `texture.needsUpdate = true` (pola `PapanJadwal`).
- Suasana: `langit.ts` (`suasanaLangit(jam)`, `terapkanCuaca`) → `adegan.aturSuasana()` → cahaya, kabut,
  bloom, dan langit prosedural `langit3d.ts` (cube map → `scene.environment`, dibuat ulang hanya bila
  langit berubah, ke tekstur yang sama). Kekuatan pantulan = `intensitasLingkungan` ÷ kecerahan langit.
- **Material transparan + `DoubleSide` wajib `forceSinglePass: true`**. Tanpa itu three.js menggambar dua
  kali dan mengubah `side` + `needsUpdate` tiap frame, sehingga program shader dievaluasi ulang tiap frame
  (salah satu beban CPU terbesar sebelum diperbaiki).
- Cahaya/lampu yang harus berpendar: nilai warna/emisif di atas 1 (HDR). Bloom memakai ambang ±1,3 di siang
  hari dan ±0,8 di malam hari.

## 6. Loop adegan (`terminal3d.ts`)

- `perbarui(dtNyata, kecepatan)`: `dt = dtNyata × kecepatan` (1×/2×/3×) untuk simulasi,
  bus, orang, patroli, cuaca; **`dtNyata`** untuk efek yang janggal bila dipercepat (tetes
  hujan, kedip lampu, bendera, label, suara).
- Simulasi keramaian dijalankan dalam langkah ≤ 0,05 detik main.
- Jam terminal: `waktuTerminalState(state)`; ritme keramaian `keramaianTerminal`;
  cuaca `cuacaTerminalState`.

## 7. Performa (target HP Android)

- Anggaran kasar: ±210 draw call, ±450 rb segitiga di tingkat kualitas 1 (terukur Sep 2026). Acuan fps
  headless 900×420, CPU diperlambat 4×: tingkat 0 ≈ 17, tingkat 1 ≈ 16, tingkat 2 ≈ 33, tingkat 3 ≈ 40.
- Bayangan: peta bayangan mengikuti pandangan (`bayangan.ts` + `perbaruiBayangan` di `adegan.ts`),
  `shadow.autoUpdate = false`. Tingkat HP menggambar ulang tiap `selangBayangan` frame. Setelah mengubah
  posisi cahaya atau kamera bayangan, set `bayanganBerubah = true`.
  `adegan.ts` menurunkan kualitas otomatis bila frame lambat; `?tingkat=0..4` di URL (dev)
  mengunci tingkat, dan jumlah draw call dicatat ke console.
- Gabungkan geometri statis (`Kumpulan`), instancing untuk yang banyak, low-poly.
- Post-processing: setelah `composer.removeAllPasses()` saat depth texture pernah dipakai,
  **dispose `inputBuffer` & `outputBuffer`** (kalau tidak: `GL_INVALID_OPERATION
  glBlitFramebuffer` dan layar membeku). Lihat `susunPass()` di `adegan.ts`.

## 8. Verifikasi

1. `npm run typecheck`
2. `npx vitest run` — jalankan dari **`D:\html\terminal`** (huruf drive besar). Dari `d:` kecil
   Vitest bisa gagal menemukan/menjalankan semua berkas tes.
3. `npm run build`
4. Screenshot: jalankan `npx vite --port 5199 --strictPort` di latar, lalu
   `node --experimental-websocket .claude/skills/terminal-threejs/shot.mjs <out.png> [tunggu] [aksi]`
   (petunjuk variabel & aksi di kepala `shot.mjs`). Contoh landscape malam dengan save tycoon
   5 jalur, 16 jendela loket, perluasan tahap 4, Terminal Lv 25 (`SAVE=jalur,jendela,perluasan,level`):
   `W=900 H=420 SAVE=5,16,4,25 JAM=23.5 HARI=1 node --experimental-websocket .claude/skills/terminal-threejs/shot.mjs out/malam.png 12000`
   Port lain (mis. 5199 sedang dipakai): jalankan vite di port itu dan beri `URL=http://localhost:<port>/?tingkat=1`.
   Simpan hasil di folder sementara (scratchpad), bukan di repo. Hentikan server dev setelah selesai.
5. Untuk mengarahkan kamera ke titik tertentu (aksi `kamera`), pasang **sementara** di
   `src/main.ts` setelah `t.pasangSuara(suara);`:
   `if (import.meta.env.DEV) Object.assign(window, { __terminalDebug: t }); // SEMENTARA`
   dan **hapus lagi** setelah verifikasi (cek `grep SEMENTARA src/main.ts` = 0).
6. Setelah mengubah fitur, perbarui `README.md` dan ingatkan `npm run cap:sync` sebelum
   build APK.

## 9. Gaya kode

- Nama & komentar bahasa Indonesia; komentar menjelaskan *mengapa*, bukan *apa*.
- Ikuti pola sekitar: konstanta bernama di atas modul, doc comment singkat pada ekspor.
- Perubahan denah → tambah/ubah tes di `tests/tata-letak.test.ts`; perilaku keramaian →
  `tests/dunia-visual.test.ts`; logika murni baru → berkas tes sendiri.
