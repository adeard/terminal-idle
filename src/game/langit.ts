/**
 * Suasana langit sepanjang hari dari jam terminal: arah, warna & kekuatan
 * cahaya utama (matahari siang, bulan malam), cahaya langit, warna latar &
 * kabut, dan tingkat malam (menyalakan lampu jalan, jendela, lampu bus).
 * Murni tanpa three.js supaya bisa dites; adegan.ts yang menerapkannya.
 *
 * Arah dalam koordinat three.js: X = timur (+x denah), Y = atas, Z = +y denah
 * (selatan, ke arah kamera). Matahari terbit di timur, terbenam di barat,
 * sedikit condong ke utara supaya bayangan jatuh ke arah kamera seperti semula.
 */

export type Vektor3 = readonly [number, number, number];

export interface Suasana {
  /** Arah ke sumber cahaya utama, ternormalisasi. */
  readonly arahCahaya: Vektor3;
  readonly intensitasCahaya: number;
  readonly warnaCahaya: number;
  /** Cahaya langit (hemisphere): warna atas & bawah. */
  readonly intensitasLangit: number;
  readonly warnaLangit: number;
  readonly warnaTanah: number;
  /** Warna latar & kabut (= warna langit di cakrawala). */
  readonly warnaLatar: number;
  /** Warna langit di puncak (zenit); gradasinya ke warnaLatar dipantulkan kaca & bodi bus. */
  readonly warnaZenit: number;
  /** Sumber cahaya utama saat ini: piringan matahari atau bulan di kubah langit. */
  readonly bendaLangit: 'matahari' | 'bulan';
  /** Tutupan awan 0–1 dan kilat petir 0–1 (dari terapkanCuaca; 0 bila cerah). */
  readonly mendung: number;
  readonly kilat: number;
  /** Kekuatan pantulan environment map (kaca, bodi bus). */
  readonly intensitasLingkungan: number;
  /** 0 = siang penuh, 1 = malam penuh. */
  readonly malam: number;
}

interface Kunci {
  readonly jam: number;
  readonly latar: number;
  readonly zenit: number;
  readonly langit: number;
  readonly tanah: number;
  readonly iLangit: number;
  readonly iLingkungan: number;
  readonly cahaya: number;
  readonly iCahaya: number;
}

const MALAM: Omit<Kunci, 'jam'> = { latar: 0x0c1628, zenit: 0x08101f, langit: 0x2b3f6a, tanah: 0x0e1219, iLangit: 0.62, iLingkungan: 0.09, cahaya: 0xa9bcff, iCahaya: 0.6 };
const SIANG: Omit<Kunci, 'jam'> = { latar: 0xcfdde6, zenit: 0x4f8fd6, langit: 0xdcecff, tanah: 0x7b8a5c, iLangit: 1.35, iLingkungan: 0.35, cahaya: 0xfff1dc, iCahaya: 3.1 };

/**
 * Titik kunci sepanjang hari (diinterpolasi halus). Cahaya utama padam sebentar
 * di fajar & senja: di situ arahnya berpindah antara bulan dan matahari tanpa
 * lompatan bayangan.
 */
const KUNCI: readonly Kunci[] = [
  { jam: 0, ...MALAM },
  { jam: 4.5, ...MALAM },
  { jam: 5.25, latar: 0x1f2748, zenit: 0x0b1030, langit: 0x4a5584, tanah: 0x1c1d24, iLangit: 0.7, iLingkungan: 0.1, cahaya: 0xa9bcff, iCahaya: 0 },
  { jam: 5.75, latar: 0x6e6c8e, zenit: 0x2a3668, langit: 0x9c98c0, tanah: 0x3a3634, iLangit: 0.85, iLingkungan: 0.14, cahaya: 0xffa860, iCahaya: 0 },
  { jam: 6.5, latar: 0xf0bf92, zenit: 0x6d9ad0, langit: 0xffd6ad, tanah: 0x6e6a56, iLangit: 1.05, iLingkungan: 0.22, cahaya: 0xffb87a, iCahaya: 1.7 },
  { jam: 8.5, ...SIANG },
  { jam: 15.5, ...SIANG },
  { jam: 17.25, latar: 0xeec79c, zenit: 0x5f8fcc, langit: 0xffe2bc, tanah: 0x7a7058, iLangit: 1.15, iLingkungan: 0.28, cahaya: 0xffc27a, iCahaya: 2.3 },
  { jam: 18.2, latar: 0xc98272, zenit: 0x3d4f86, langit: 0xdc9180, tanah: 0x4a3c3a, iLangit: 0.85, iLingkungan: 0.17, cahaya: 0xff8a50, iCahaya: 0.55 },
  { jam: 18.6, latar: 0x4a3a5c, zenit: 0x1c2250, langit: 0x6a5a86, tanah: 0x241e26, iLangit: 0.72, iLingkungan: 0.11, cahaya: 0xff8a50, iCahaya: 0 },
  { jam: 19.0, latar: 0x1a2240, zenit: 0x0a1030, langit: 0x34466f, tanah: 0x12141b, iLangit: 0.64, iLingkungan: 0.08, cahaya: 0xa9bcff, iCahaya: 0 },
  { jam: 19.75, ...MALAM },
  { jam: 24, ...MALAM },
];

/** Cahaya utama = matahari selama jam ini (di luarnya bulan); di kedua batas intensitasnya 0. */
export const RENTANG_MATAHARI: readonly [number, number] = [5.5, 18.8];
/** Batas elevasi arah matahari (radian dari cakrawala) supaya bayangan tidak kepanjangan. */
const ELEVASI_MIN = 0.35;
const CONDONG_UTARA = -0.42;
const ARAH_BULAN: Vektor3 = normal([-0.35, 0.85, -0.4]);

function normal(v: Vektor3): Vektor3 {
  const d = Math.hypot(v[0], v[1], v[2]);
  return [v[0] / d, v[1] / d, v[2] / d];
}

export function langkahHalus(a: number, b: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

/** Campur dua warna 0xRRGGBB per kanal. */
export function campurWarna(a: number, b: number, t: number): number {
  const k = (w: number, geser: number): number => (w >> geser) & 0xff;
  const c = (geser: number): number => Math.round(k(a, geser) + (k(b, geser) - k(a, geser)) * t);
  return (c(16) << 16) | (c(8) << 8) | c(0);
}

/** Tingkat malam: 1 sepanjang malam, turun di fajar, naik lagi di senja. */
export function tingkatMalam(jam: number): number {
  return jam < 12 ? 1 - langkahHalus(5.2, 6.4, jam) : langkahHalus(17.8, 18.9, jam);
}

/** Arah matahari: terbit di timur (+X) pukul 06.00, tertinggi tengah hari, terbenam di barat pukul 18.00. */
export function arahMatahari(jam: number): Vektor3 {
  const sudut = Math.min(Math.PI - ELEVASI_MIN, Math.max(ELEVASI_MIN, ((jam - 6) / 12) * Math.PI));
  return normal([Math.cos(sudut), Math.sin(sudut), CONDONG_UTARA]);
}

export function suasanaLangit(jamMasukan: number): Suasana {
  const jam = ((jamMasukan % 24) + 24) % 24;
  let i = 0;
  while (i < KUNCI.length - 2 && KUNCI[i + 1]!.jam <= jam) i++;
  const a = KUNCI[i]!;
  const b = KUNCI[i + 1]!;
  const t = langkahHalus(a.jam, b.jam, jam);
  const lerp = (x: number, y: number): number => x + (y - x) * t;
  const siang = jam >= RENTANG_MATAHARI[0] && jam < RENTANG_MATAHARI[1];
  return {
    arahCahaya: siang ? arahMatahari(jam) : ARAH_BULAN,
    intensitasCahaya: lerp(a.iCahaya, b.iCahaya),
    warnaCahaya: campurWarna(a.cahaya, b.cahaya, t),
    intensitasLangit: lerp(a.iLangit, b.iLangit),
    warnaLangit: campurWarna(a.langit, b.langit, t),
    warnaTanah: campurWarna(a.tanah, b.tanah, t),
    warnaLatar: campurWarna(a.latar, b.latar, t),
    warnaZenit: campurWarna(a.zenit, b.zenit, t),
    bendaLangit: siang ? 'matahari' : 'bulan',
    mendung: 0,
    kilat: 0,
    intensitasLingkungan: lerp(a.iLingkungan, b.iLingkungan),
    malam: tingkatMalam(jam),
  };
}

const jepit01 = (v: number): number => Math.min(1, Math.max(0, v));

/**
 * Mendung & kilat petir di atas suasana jam itu: cahaya matahari/bulan meredup
 * (bayangan melunak), langit & kabut memucat ke abu-abu, dan lampu ikut
 * menyala sebagian saat awan tebal. Kilat sesaat menerangi seluruh langit.
 */
export function terapkanCuaca(s: Suasana, mendung: number, kilat = 0): Suasana {
  const m = jepit01(mendung);
  const k = jepit01(kilat);
  const latarAbu = campurWarna(0x8e99a4, 0x141a22, s.malam);
  const langitAbu = campurWarna(0xaeb8c2, 0x2a323e, s.malam);
  const tanahAbu = campurWarna(0x5d6558, 0x0e1116, s.malam);
  const zenitAbu = campurWarna(0x7d8894, 0x0c1118, s.malam);
  return {
    arahCahaya: s.arahCahaya,
    intensitasCahaya: s.intensitasCahaya * (1 - 0.88 * m),
    warnaCahaya: campurWarna(s.warnaCahaya, 0xdfe6ee, 0.5 * m),
    intensitasLangit: s.intensitasLangit * (1 - 0.1 * m) + 2.2 * k,
    warnaLangit: campurWarna(campurWarna(s.warnaLangit, langitAbu, 0.6 * m), 0xe4ecff, 0.7 * k),
    warnaTanah: campurWarna(s.warnaTanah, tanahAbu, 0.5 * m),
    warnaLatar: campurWarna(campurWarna(s.warnaLatar, latarAbu, 0.75 * m), 0xd8e2ff, 0.6 * k),
    warnaZenit: campurWarna(campurWarna(s.warnaZenit, zenitAbu, 0.85 * m), 0xc8d4ff, 0.6 * k),
    bendaLangit: s.bendaLangit,
    mendung: m,
    kilat: k,
    intensitasLingkungan: s.intensitasLingkungan * (1 - 0.3 * m) + 0.3 * k,
    malam: Math.max(s.malam, 0.4 * m),
  };
}
