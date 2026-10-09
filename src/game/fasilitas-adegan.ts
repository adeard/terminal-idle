/**
 * Bangunan & petugas tycoon di adegan (murni, tanpa three.js; lihat
 * documents/13-rancangan-tycoon.md bagian 12): blok kursi ruang tunggu yang
 * terpasang, kios & toko yang beroperasi, toilet, baris mobil di parkir
 * pengunjung, pos retribusi, dan petugas yang terlihat (petugas peron per
 * halte, petugas gerbang, satpam di posnya, petugas kebersihan di rute
 * sapunya) menurut bangunan yang dibangun & petugas yang direkrut. Adegan dan
 * model keramaian hanya membaca hasilnya.
 */
import type { JumlahBangunan } from '../sim/bangunan';
import type { JumlahPetugas } from '../sim/petugas';
import { RUTE_SAPU, type JenisToko } from './kehidupan-malam';
import { BLOK_KURSI, GERBANG_X, HALTE_DATANG_X, KIOS_TUNGGU, KURSI, POS_SATPAM, TOKO_AULA } from './tata-letak';

/**
 * Urutan blok kursi dipasang (indeks BLOK_KURSI): mulai dari yang terdekat ke
 * gerbang Jalur 1, menjauh ke barat, jadi penumpang jalur pertama duduk di
 * dekat gerbangnya.
 */
export const URUTAN_BLOK_KURSI: readonly number[] = BLOK_KURSI.map((b, i) => ({ i, jarak: Math.abs((b.x0 + b.x1) / 2 - GERBANG_X[0]!) }))
  .sort((a, b) => a.jarak - b.jarak)
  .map((b) => b.i);

/** Blok kursi yang terpasang untuk sekian unit kursi (per indeks BLOK_KURSI). Unit di atas banyaknya blok di adegan (lantai 2) tidak digambar. */
export function blokKursiTerpasang(kursi: number): boolean[] {
  const n = Math.max(0, Math.floor(kursi));
  const hasil = BLOK_KURSI.map(() => false);
  for (const i of URUTAN_BLOK_KURSI.slice(0, n)) hasil[i] = true;
  return hasil;
}

/** Blok kursi (indeks BLOK_KURSI) di titik ini, −1 bila di luar blok kursi. */
export function blokKursiDi(x: number, y: number): number {
  const yAkhir = KURSI.yBaris0 + (KURSI.jumlahBaris - 1) * KURSI.jarakBaris;
  if (y < KURSI.yBaris0 - KURSI.jarakBaris / 2 || y > yAkhir + KURSI.jarakBaris / 2) return -1;
  return BLOK_KURSI.findIndex((b) => x >= b.x0 && x <= b.x1);
}

export interface FasilitasAdegan {
  /** Blok kursi ruang tunggu yang terpasang (per indeks BLOK_KURSI). */
  readonly blokKursi: readonly boolean[];
  /** Kios ruang tunggu (urut KIOS_TUNGGU) yang sudah dibangun: kios ke-0 … ke-(n−1). */
  readonly kios: number;
  /** Toko aula (urut TOKO_AULA: minimarket, apotek) yang sudah dibangun. */
  readonly toko: number;
  /** Toilet & musholla di sayap barat sudah dibangun (baru didatangi penumpang). */
  readonly toilet: boolean;
  /** Baris mobil pengunjung di parkir: 0 (belum ada lahan parkir), 1, atau 2. */
  readonly barisParkir: number;
  readonly posRetribusi: boolean;
}

/** Banyaknya baris mobil di parkir pengunjung adegan (lahan parkir ke-1 & ke-2). */
export const BARIS_PARKIR = 2;

/** Semua bangunan ada (bawaan model keramaian & tes). */
export const FASILITAS_LENGKAP: FasilitasAdegan = {
  blokKursi: BLOK_KURSI.map(() => true),
  kios: KIOS_TUNGGU.length,
  toko: TOKO_AULA.length,
  toilet: true,
  barisParkir: BARIS_PARKIR,
  posRetribusi: true,
};

export function fasilitasAdegan(b: JumlahBangunan): FasilitasAdegan {
  return {
    blokKursi: blokKursiTerpasang(b.kursi),
    kios: Math.min(KIOS_TUNGGU.length, Math.max(0, b.kios)),
    toko: Math.min(TOKO_AULA.length, Math.max(0, b.toko)),
    toilet: b.toilet > 0,
    barisParkir: Math.min(BARIS_PARKIR, Math.max(0, b.lahanParkir)),
    posRetribusi: b.posRetribusi > 0,
  };
}

/** Indeks toko aula (TOKO_AULA) untuk jenisnya: toko ke-i baru ada setelah unit toko ke-(i + 1) dibangun. */
export function indeksToko(jenis: Exclude<JenisToko, 'kios'>): number {
  return TOKO_AULA.findIndex((t) => t.nama === (jenis === 'minimarket' ? 'MINIMARKET' : 'APOTEK'));
}

/** Toko/kios jenis ini sudah dibangun (kios: paling sedikit satu kios ruang tunggu). */
export function tokoDibangun(f: Pick<FasilitasAdegan, 'kios' | 'toko'>, jenis: JenisToko): boolean {
  return jenis === 'kios' ? f.kios > 0 : f.toko > indeksToko(jenis);
}

export interface StafAdegan {
  /** Halte kedatangan (urut HALTE_DATANG_X = urut jalur) yang dijaga petugas peron: halte ke-0 … ke-(n−1). */
  readonly peron: number;
  /** Gerbang keberangkatan (urut GERBANG_X = urut jalur) yang dijaga petugas gerbang. */
  readonly gerbang: number;
  /** Pos satpam (urut POS_SATPAM) yang terisi. */
  readonly satpam: number;
  /** Rute sapu (urut RUTE_SAPU) yang dijalani petugas kebersihan. */
  readonly kebersihan: number;
}

/**
 * Petugas yang terlihat dari jumlah yang direkrut (lihat hitungPetugas):
 * petugas peron & gerbang menjaga halte & gerbang jalur ke-1, ke-2, …
 * (batasnya satu per jalur); satpam dan petugas kebersihan mengisi pos & rute
 * yang ada di adegan, sisanya bertugas di luar pandangan.
 */
export function stafAdegan(n: JumlahPetugas): StafAdegan {
  return {
    peron: Math.min(HALTE_DATANG_X.length, n.peron),
    gerbang: Math.min(GERBANG_X.length, n.gerbang),
    satpam: Math.min(POS_SATPAM.length, n.satpam),
    kebersihan: Math.min(RUTE_SAPU.length, n.kebersihan),
  };
}
