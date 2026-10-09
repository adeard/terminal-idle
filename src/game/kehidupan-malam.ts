/**
 * Kehidupan terminal menurut jam: jam buka toko & loket, satpam yang
 * berpatroli di malam hari, rute sapu petugas kebersihan (siang & malam,
 * sebanyak yang direkrut; lihat fasilitas-adegan.ts), dan pedagang asongan
 * yang mondar-mandir di gerbang. Murni (tanpa three.js):
 * posisi orang dihitung dari waktu saja, jadi deterministik dan bisa dites.
 */
import { GERBANG_KELUAR_X, GERBANG_MASUK_X, PERON, POS_SATPAM, URUTAN_LOKET, X_LOKET, Y_PAGAR, type Titik } from './tata-letak';

// ---------------------------------------------------------------------------
// Jam buka

export type JenisToko = 'minimarket' | 'apotek' | 'kios';

/** Jam buka [buka, tutup) tiap jenis toko; null = buka 24 jam. */
export const JAM_BUKA: Readonly<Record<JenisToko, readonly [number, number] | null>> = {
  minimarket: null,
  apotek: [7, 22],
  kios: [5, 22.5],
};

/** Berada di rentang jam [a, b) (rentang boleh melewati tengah malam, mis. [22, 5)). */
export function dalamRentang(jam: number, [a, b]: readonly [number, number]): boolean {
  return a <= b ? jam >= a && jam < b : jam >= a || jam < b;
}

export function tokoBuka(jenis: JenisToko, jam: number): boolean {
  const r = JAM_BUKA[jenis];
  return r === null || dalamRentang(jam, r);
}

/** Rentang jam separuh loket tutup (sepi penumpang). */
export const JAM_LOKET_MALAM: readonly [number, number] = [22, 5];
/** Di malam hari tetap buka paling sedikit sekian jendela (kalau jendelanya ada). */
const MIN_LOKET_MALAM = 2;

/** Hasil loketBuka per [malam?][banyaknya jendela dipakai], dihitung sekali (dipanggil tiap frame tanpa alokasi). */
const TABEL_LOKET: readonly (readonly (readonly number[])[])[] = [false, true].map((malam) =>
  Array.from({ length: X_LOKET.length + 1 }, (_, dipakai) => {
    // Jendela terdekat ke kepala antrean dulu (minimal satu).
    const jendela = URUTAN_LOKET.slice(0, Math.max(1, dipakai));
    const n = malam ? Math.min(jendela.length, Math.max(MIN_LOKET_MALAM, Math.ceil(jendela.length / 2))) : jendela.length;
    return jendela.slice(0, n).sort((a, b) => a - b);
  }),
);

/**
 * Indeks jendela loket yang melayani pada jam ini: jendela yang dipakai mitra PO
 * (satu per loket yang disewa, sebatas jendela yang sudah dibangun; lihat
 * jendelaDipakai di perluasan-adegan.ts), terdekat ke kepala antrean. Jendela
 * lain tutup tanpa petugas. Di malam hari separuhnya tutup.
 * @param dipakai banyaknya jendela yang dipakai di siang hari (bawaan: semua)
 */
export function loketBuka(jam: number, dipakai: number = X_LOKET.length): readonly number[] {
  const n = Math.max(0, Math.min(X_LOKET.length, Math.floor(dipakai)));
  return TABEL_LOKET[dalamRentang(jam, JAM_LOKET_MALAM) ? 1 : 0]![n]!;
}

/** Satpam luar berpatroli keliling plaza (siang berjaga di posnya). */
export const JAM_PATROLI: readonly [number, number] = [19, 5.5];
/** Pedagang asongan berjualan di gerbang. */
export const JAM_ASONGAN: readonly [number, number] = [6, 22];

// ---------------------------------------------------------------------------
// Rute mondar-mandir

export interface Patroli {
  /** Titik-titik rute tertutup (kembali ke titik pertama setelah titik terakhir). */
  readonly titik: readonly Titik[];
  /** Laju jalan (petak/detik main). */
  readonly laju: number;
  /** Lama berhenti di tiap titik (detik main), urut titik; kurang = 0. */
  readonly jeda: readonly number[];
}

export interface PosisiPatroli {
  readonly x: number;
  readonly y: number;
  /** Sedang berjalan (bukan berhenti di titik). */
  readonly bergerak: boolean;
}

/** Lama satu putaran rute (detik main). */
export function lamaPutaran(p: Patroli): number {
  let total = 0;
  for (let i = 0; i < p.titik.length; i++) {
    const a = p.titik[i]!;
    const b = p.titik[(i + 1) % p.titik.length]!;
    total += (p.jeda[i] ?? 0) + Math.hypot(b[0] - a[0], b[1] - a[1]) / p.laju;
  }
  return total;
}

/** Posisi pada detik ke-t (berulang tiap putaran). */
export function posisiPatroli(p: Patroli, t: number): PosisiPatroli {
  const putaran = lamaPutaran(p);
  let sisa = ((t % putaran) + putaran) % putaran;
  for (let i = 0; i < p.titik.length; i++) {
    const a = p.titik[i]!;
    const b = p.titik[(i + 1) % p.titik.length]!;
    const jeda = p.jeda[i] ?? 0;
    if (sisa < jeda) return { x: a[0], y: a[1], bergerak: false };
    sisa -= jeda;
    const lama = Math.hypot(b[0] - a[0], b[1] - a[1]) / p.laju;
    if (sisa < lama) {
      const u = lama > 0 ? sisa / lama : 1;
      return { x: a[0] + (b[0] - a[0]) * u, y: a[1] + (b[1] - a[1]) * u, bergerak: true };
    }
    sisa -= lama;
  }
  const a = p.titik[0]!;
  return { x: a[0], y: a[1], bergerak: false };
}

/**
 * Satpam luar: dari posnya di samping bordes, menyusuri pagar kompleks ke
 * ujung timur plaza lalu ke ujung barat, dan kembali ke pos. Di luar jalur
 * lampu, bangku, air mancur, dan tiang selasar.
 */
export const PATROLI_SATPAM: Patroli = {
  titik: [
    POS_SATPAM[0]!,
    [19.3, 16.0],
    [19.3, 17.55],
    [29.5, 17.55],
    [19.3, 17.55],
    [12.8, 17.55],
    [19.3, 17.55],
    [19.3, 16.0],
  ],
  laju: 0.36,
  jeda: [25, 0, 0, 5, 0, 5, 0, 0],
};

/** Petugas kebersihan aula: menyapu bolak-balik lantai di depan toko (barat labirin). */
export const SAPU_AULA: Patroli = {
  titik: [
    [12.45, 12.5],
    [18.2, 12.5],
    [18.2, 12.8],
    [12.45, 12.8],
  ],
  laju: 0.16,
  jeda: [2, 2, 2, 2],
};

/** Petugas kebersihan ruang tunggu: menyapu lantai di antara kursi dan meja makan. */
export const SAPU_TUNGGU: Patroli = {
  titik: [
    [36.0, 10.45],
    [47.3, 10.45],
    [47.3, 10.75],
    [36.0, 10.75],
  ],
  laju: 0.16,
  jeda: [2, 2, 2, 2],
};

/**
 * Petugas kebersihan peron kedatangan: menyapu bolak-balik di tengah peron,
 * di antara dua deret tiang kanopi (penumpang turun menyeberanginya).
 */
export const SAPU_PERON: Patroli = {
  titik: [
    [PERON.x0 + 2.0, 6.42],
    [PERON.x1 - 2.3, 6.42],
    [PERON.x1 - 2.3, 6.68],
    [PERON.x0 + 2.0, 6.68],
  ],
  laju: 0.16,
  jeda: [2, 2, 2, 2],
};

/** Petugas kebersihan plaza: menyapu di depan fasad timur pintu masuk, di luar bangku, air mancur, & jalur calon penumpang. */
export const SAPU_PLAZA: Patroli = {
  titik: [
    [19.7, 15.42],
    [23.2, 15.42],
    [23.2, 15.68],
    [19.7, 15.68],
  ],
  laju: 0.16,
  jeda: [2, 2, 2, 2],
};

/** Rute sapu urut petugas kebersihan yang direkrut (ke-1 di aula, ke-2 di ruang tunggu, …). */
export const RUTE_SAPU: readonly Patroli[] = [SAPU_AULA, SAPU_TUNGGU, SAPU_PERON, SAPU_PLAZA];

/** Pedagang asongan: mondar-mandir pelan di halaman, tepat di dalam gerbang pagar. */
export const ASONGAN: readonly Patroli[] = [
  {
    titik: [
      // Di barat jalan masuk, jauh dari rute patroli satpam (y 17,55) & rute calon penumpang.
      [GERBANG_MASUK_X - 0.9, Y_PAGAR - 0.95],
      [GERBANG_MASUK_X - 1.9, Y_PAGAR - 0.95],
    ],
    laju: 0.14,
    jeda: [6, 6],
  },
  {
    titik: [
      [GERBANG_KELUAR_X + 0.7, Y_PAGAR - 0.45],
      [GERBANG_KELUAR_X + 1.6, Y_PAGAR - 0.45],
    ],
    laju: 0.14,
    jeda: [8, 5],
  },
];
