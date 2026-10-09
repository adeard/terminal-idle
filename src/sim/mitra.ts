/**
 * Aturan mitra PO (murni): level & XP, jurusan & kelas bus yang aktif, nilai
 * tiket, reputasi, syarat daftar, dan tawaran kontrak (dibayar PO di muka). Rancangan:
 * documents/12-rancangan-ekonomi-po.md, disesuaikan tycoon (dokumen 13: harga
 * tiket di tangan PO, kepuasan mitra di sim/operasi.ts). Angka di EKONOMI.mitra.
 */
import { EKONOMI, type KonfigEkonomi, type KonfigMitraPo, type KonfigTingkatPo } from '../config/economy.config';
import { KELAS_BUS_IDS, PO_IDS, type KelasBusId, type PoId } from './fitur';

const jepit = (x: number, min: number, maks: number): number => Math.min(maks, Math.max(min, x));

export function dataPo(id: PoId, cfg: KonfigEkonomi = EKONOMI): KonfigMitraPo {
  return cfg.mitra.po[id];
}

export function tingkatPo(id: PoId, cfg: KonfigEkonomi = EKONOMI): KonfigTingkatPo {
  return cfg.mitra.tingkat[cfg.mitra.po[id].tingkat];
}

/** Indeks jurusan (EKONOMI.jurusan) dari namanya; −1 bila tidak ada. */
export function indeksJurusan(nama: string, cfg: KonfigEkonomi = EKONOMI): number {
  return cfg.jurusan.findIndex((j) => j.nama === nama);
}

/** Nilai tiket jurusan ke-j (pengali harga dasar); jurusan tanpa nilai dianggap 1. */
export function nilaiJurusan(j: number, cfg: KonfigEkonomi = EKONOMI): number {
  const nama = cfg.jurusan[j]?.nama;
  return (nama !== undefined ? cfg.mitra.nilaiJurusan[nama] : undefined) ?? 1;
}

// ---------------------------------------------------------------------------
// Level & XP (satuan XP = bus yang berangkat)

/** XP kumulatif untuk mencapai level L (level 1 = 0 XP). */
export function xpKumulatifPo(level: number, cfg: KonfigEkonomi = EKONOMI): number {
  return cfg.mitra.xpA * Math.pow(Math.max(0, level - 1), cfg.mitra.xpK);
}

/** Level PO dari XP kumulatifnya (tanpa batas atas). Level disimpan sebagai XP saja, jadi tidak pernah turun. */
export function levelPoDariXp(xp: number, cfg: KonfigEkonomi = EKONOMI): number {
  if (!(xp > 0)) return 1;
  let level = 1 + Math.floor(Math.pow(xp / cfg.mitra.xpA, 1 / cfg.mitra.xpK));
  // Pembulatan floating point: pastikan xpKumulatif(level) ≤ xp < xpKumulatif(level + 1).
  while (level > 1 && xpKumulatifPo(level, cfg) > xp) level--;
  while (xpKumulatifPo(level + 1, cfg) <= xp) level++;
  return level;
}

/** XP yang dibutuhkan dari level L ke L + 1. */
export function xpLevelPo(level: number, cfg: KonfigEkonomi = EKONOMI): number {
  return xpKumulatifPo(level + 1, cfg) - xpKumulatifPo(level, cfg);
}

/** Pengali harga tiket dari level PO. */
export function nilaiTiketPo(level: number, cfg: KonfigEkonomi = EKONOMI): number {
  return Math.pow(cfg.mitra.rNilaiPerLevel, Math.max(1, level) - 1);
}

// ---------------------------------------------------------------------------
// Jurusan & kelas bus yang dioperasikan

/**
 * Jurusan (indeks EKONOMI.jurusan) yang dilayani PO di level & kelas terminal
 * ini, urut daftar PO: jurusan ke-n terbuka di levelJurusan[n] dan, untuk rute
 * antarpulau, setelah terminal mencapai kelasnya.
 */
export function jurusanAktif(id: PoId, level: number, kelasTerminal: number, cfg: KonfigEkonomi = EKONOMI): number[] {
  const hasil: number[] = [];
  cfg.mitra.po[id].jurusan.forEach((nama, i) => {
    const j = indeksJurusan(nama, cfg);
    const levelMin = cfg.mitra.levelJurusan[i] ?? Number.POSITIVE_INFINITY;
    if (j >= 0 && level >= levelMin && (cfg.jurusan[j]!.kelasTerminal ?? 0) <= kelasTerminal) hasil.push(j);
  });
  return hasil;
}

/** Kelas bus yang dioperasikan PO (urut KELAS_BUS_IDS): dibatasi tingkat PO, level PO, dan kelas terminal. */
export function kelasAktif(id: PoId, level: number, kelasTerminal: number, cfg: KonfigEkonomi = EKONOMI): KelasBusId[] {
  const maks = tingkatPo(id, cfg).kelasMaks;
  return KELAS_BUS_IDS.filter((k, i) => i < maks && level >= cfg.mitra.kelas[k].levelPo && cfg.kelasBus[k].kelasTerminal <= kelasTerminal);
}

/** PO terdaftar sebagaimana dibutuhkan untuk menghitung jurusan & kelas bus terminal. */
export interface PoAktif {
  readonly id: PoId;
  /** XP kumulatif (level = levelPoDariXp). */
  readonly xp: number;
  readonly loket: number;
}

/** Jurusan (indeks EKONOMI.jurusan) yang dilayani PO terdaftar yang punya loket. */
export function jurusanDilayaniPo(daftar: readonly PoAktif[], kelasTerminal: number, cfg: KonfigEkonomi = EKONOMI): boolean[] {
  const hasil = cfg.jurusan.map(() => false);
  for (const p of daftar) {
    if (p.loket <= 0) continue;
    for (const j of jurusanAktif(p.id, levelPoDariXp(p.xp, cfg), kelasTerminal, cfg)) hasil[j] = true;
  }
  return hasil;
}

/** Kelas bus yang dioperasikan PO terdaftar mana pun yang punya loket (urut KELAS_BUS_IDS). */
export function kelasBusDioperasikan(daftar: readonly PoAktif[], kelasTerminal: number, cfg: KonfigEkonomi = EKONOMI): KelasBusId[] {
  const ada = new Set<KelasBusId>();
  for (const p of daftar) if (p.loket > 0) for (const k of kelasAktif(p.id, levelPoDariXp(p.xp, cfg), kelasTerminal, cfg)) ada.add(k);
  return KELAS_BUS_IDS.filter((k) => ada.has(k));
}

// ---------------------------------------------------------------------------
// Reputasi (0–100)

/** Pengali pasar PO dari reputasi. */
export function faktorReputasi(reputasi: number, cfg: KonfigEkonomi = EKONOMI): number {
  const r = cfg.mitra.reputasi;
  return r.faktorDasar + r.faktorPerPoin * jepit(reputasi, 0, 100);
}

/**
 * Reputasi yang dituju PO: penumpang menilai kenyamanan terminal (kepuasan
 * 0–1) dan ragam armada PO itu. Harga tiketnya selalu normal (ditetapkan PO),
 * jadi sumbangannya tetap (`dasar`).
 */
export function targetReputasi(kepuasan: number, jumlahKelas: number, cfg: KonfigEkonomi = EKONOMI): number {
  const r = cfg.mitra.reputasi;
  return r.dasar + r.bobot.kepuasan * jepit(kepuasan, 0, 1) + r.bobot.armada * jepit(jumlahKelas / KELAS_BUS_IDS.length, 0, 1);
}

/**
 * Reputasi setelah `dtDetik` detik main: mendekati target secara eksponensial
 * dengan konstanta waktu dari config, jadi hasilnya sama berapa pun ukuran
 * langkahnya (tick 0,1 detik maupun offline berjam-jam).
 */
export function majukanReputasi(reputasi: number, target: number, dtDetik: number, cfg: KonfigEkonomi = EKONOMI): number {
  if (!(dtDetik > 0)) return reputasi;
  const t = 1 - Math.exp(-dtDetik / cfg.mitra.reputasi.konstantaWaktuDetik);
  return reputasi + (target - reputasi) * t;
}

// ---------------------------------------------------------------------------
// Pendaftaran & kontrak

export interface KeadaanDaftar {
  readonly kelasTerminal: number;
  /** Kepuasan penumpang sekarang (0–1). */
  readonly kepuasan: number;
  /** Hadiah event untuk PO ini sudah didapat (hanya untuk PO bersumber hadiahEvent). */
  readonly hadiahEvent?: boolean;
}

export type SyaratDaftarKurang =
  | { readonly jenis: 'kelas'; readonly kelas: number }
  | { readonly jenis: 'kepuasan'; readonly min: number }
  | { readonly jenis: 'event' };

/**
 * Syarat daftar yang belum terpenuhi (yang paling jangka panjang lebih dulu),
 * null bila PO boleh didaftarkan. Belum terdaftar, slot kosong, jeda putus,
 * jendela loket, kepuasan mitra, dan kas dicek pemanggil.
 */
export function syaratDaftarKurang(id: PoId, k: KeadaanDaftar, cfg: KonfigEkonomi = EKONOMI): SyaratDaftarKurang | null {
  const po = cfg.mitra.po[id];
  if (po.sumber === 'hadiahEvent' && !k.hadiahEvent) return { jenis: 'event' };
  if (k.kelasTerminal < po.kelasTerminal) return { jenis: 'kelas', kelas: po.kelasTerminal };
  if (po.kepuasanMin !== undefined && k.kepuasan < po.kepuasanMin) return { jenis: 'kepuasan', min: po.kepuasanMin };
  return null;
}

/**
 * Urutan katalog PO = urutan EKONOMI.mitra.po (PO kecil & kelas terminal rendah
 * lebih dulu), untuk daftar PO tersedia & saran tutorial. Bukan urutan PO_IDS.
 */
export function urutanPo(id: PoId, cfg: KonfigEkonomi = EKONOMI): number {
  return Object.keys(cfg.mitra.po).indexOf(id);
}

/** Kontrak yang ditawarkan PO: panjangnya (hari terminal) & nilai yang dibayar PO di muka (Rp). */
export interface TawaranKontrak {
  readonly hari: number;
  readonly nilai: number;
}

/** Nilai kontrak sehari PO ini pada level PO & kelas terminal ini (Rp): armada PO & terminal yang besar, kontraknya mahal. */
export function nilaiKontrakHarian(id: PoId, level: number, kelasTerminal: number, cfg: KonfigEkonomi = EKONOMI): number {
  const k = cfg.mitra.kontrak;
  const kelas = k.pengaliKelas[Math.min(k.pengaliKelas.length - 1, Math.max(0, Math.floor(kelasTerminal)))] ?? 1;
  return k.nilaiDasar * k.pengaliTingkat[cfg.mitra.po[id].tingkat] * Math.pow(k.nilaiLevel, Math.max(1, level) - 1) * kelas;
}

/** Dibulatkan ke tiga angka penting (Rp 21.432.000 → Rp 21.400.000). */
function bulatkanNilai(x: number): number {
  if (!(x > 0)) return 0;
  const langkah = Math.pow(10, Math.floor(Math.log10(x)) - 2);
  return Math.round(x / langkah) * langkah;
}

/** Undian tetap 0–1 per PO & kontrak ke-berapa: tawaran tidak berubah saat game dimuat ulang. */
function undianKontrak(id: PoId, ke: number): number {
  const i = PO_IDS.indexOf(id) + 1;
  return (((i * 0.6180339887 + ke * 0.7548776662 + 0.137) % 1) + 1) % 1;
}

/**
 * Tawaran kontrak ke-`ke` (0 = kontrak pertama) PO ini. Panjangnya diundi dari
 * pilihanHari menurut bobot tingkat PO (kontrak pertama PO hadiah: hariHadiah),
 * berbeda tiap PO & tiap perpanjangan; nilainya mengikuti armada PO (tingkat &
 * level) dan kelas terminal, lebih murah per hari untuk kontrak panjang.
 */
export function tawaranKontrak(id: PoId, ke: number, level: number, kelasTerminal: number, cfg: KonfigEkonomi = EKONOMI): TawaranKontrak {
  const k = cfg.mitra.kontrak;
  const po = cfg.mitra.po[id];
  let i = -1;
  if (ke === 0 && (po.sumber === 'hadiahKelas' || po.sumber === 'hadiahEvent')) i = k.pilihanHari.indexOf(k.hariHadiah);
  if (i < 0) {
    const bobot = k.bobotHari[po.tingkat];
    const total = bobot.reduce((a, b) => a + b, 0);
    let u = undianKontrak(id, ke) * total;
    i = bobot.findIndex((b) => {
      if (u < b) return true;
      u -= b;
      return false;
    });
    if (i < 0) i = bobot.reduce((terakhir, b, j) => (b > 0 ? j : terakhir), 0);
  }
  const hari = k.pilihanHari[i]!;
  return { hari, nilai: bulatkanNilai(nilaiKontrakHarian(id, level, kelasTerminal, cfg) * hari * (k.pengaliPanjang[i] ?? 1)) };
}
