/**
 * Mobil yang naik-turun gedung parkir (documents/18, rancangan docs/design/20261105-tambah-lantai bagian 6.7).
 * Murni (tanpa three.js), hanya tampilan: tanpa state tersimpan, aksi, angka ekonomi, atau suara.
 *
 * Mobil muncul di pelataran SPBU (di luar bingkai kamera awal), lewat jalan samping, lajur timur ruang tunggu,
 * dan lorong parkir ke lengkung S dan ramp 1, memutar di ujung timur lorong dek, lalu turun lewat jalan yang
 * sama dan kembali ke titik muncul. Sesudah lantai 3, separuh mobil naik lagi lewat ramp 2 ke dek 3. Lajur kiri
 * (ke barat di sisi selatan, ke timur di sisi utara). Ramp hanya satu lajur, jadi ruas bersama dijaga kunci:
 * zona ramp 1 dan zona ramp 2 hanya berisi satu arah sekaligus (searah boleh beriringan), dan ruang putar ujung
 * timur dek hanya untuk satu mobil. Mobil yang kuncinya belum bebas menunggu di ujung ruasnya sendiri (lajurnya
 * sendiri), jadi tidak ada yang saling menunggu. Jumlah mobil mengikuti `kepadatan` seperti LaluLintas; ikut atau
 * berhenti hanya di titik muncul.
 */
import { AKSES_PARKIR, GEDUNG_PARKIR, tinggiRamp, titikLengkungS } from './tata-letak';

/** Ukuran mobil (sama dengan geometriMobil di mobil3d.ts) dan jarak sumbu roda untuk kemiringan di ramp. */
export const UKURAN_MOBIL = { panjang: 0.9, lebar: 0.36, sumbu: 0.58 } as const;
/** Jarak aman antarmobil searah (bemper ke bemper), sama dengan lalu lintas jalan belakang. */
export const JARAK_AMAN_PARKIR = 0.5;
/** Ambang kepadatan mobil ke-1…4 (rancangan 6.7): dini hari 1 mobil, siang 3, jam sibuk 3–4. */
export const AMBANG_MOBIL_PARKIR = [0, 0.4, 0.65, 0.85] as const;
/** Titik muncul dan hilang: pelataran SPBU, di luar bingkai kamera awal. */
export const X_MUNCUL_PARKIR = 63.5;
const Y_MASUK = 5.1;
const Y_KELUAR = 4.7;

/**
 * Kunci ruas bersama (bit): zona ramp 1 naik/turun, zona ramp 2 naik/turun, ruang putar dek 2 dan dek 3, dan dua
 * tikungan dua lajur (jalan samping ke lajur timur, lajur timur ke lorong) yang terlalu rapat untuk dua mobil berpapasan.
 */
export const KUNCI = { aNaik: 1, aTurun: 2, bNaik: 4, bTurun: 8, putar2: 16, putar3: 32, simpangSamping: 64, simpangLorong: 128 } as const;
/** Pasangan kunci yang tidak boleh dipegang dua mobil sekaligus. */
const BENTROK: readonly (readonly [number, number])[] = [
  [KUNCI.aNaik, KUNCI.aTurun],
  [KUNCI.bNaik, KUNCI.bTurun],
  [KUNCI.putar2, KUNCI.putar2],
  [KUNCI.putar3, KUNCI.putar3],
  [KUNCI.simpangSamping, KUNCI.simpangSamping],
  [KUNCI.simpangLorong, KUNCI.simpangLorong],
];

/** Satu ruas jalur: titik rapat (x, y, h) dengan panjang kumulatif, laju ingin, dan kunci yang harus dipegang selama di ruas ini. */
export interface RuasParkir {
  readonly nama: string;
  readonly x: Float64Array;
  readonly y: Float64Array;
  readonly h: Float64Array;
  readonly s: Float64Array;
  readonly panjang: number;
  readonly laju: number;
  readonly kunci: number;
}

type Titik2 = readonly [number, number];

/** Penyusun ruas: garis dan busur disampel rapat (±0,05), tinggi dari fungsi permukaan. */
class Penyusun {
  private readonly px: number[] = [];
  private readonly py: number[] = [];

  constructor(dari: Titik2) {
    this.px.push(dari[0]);
    this.py.push(dari[1]);
  }

  garis(x: number, y: number): this {
    const [x0, y0] = [this.px[this.px.length - 1]!, this.py[this.py.length - 1]!];
    const n = Math.max(1, Math.ceil(Math.hypot(x - x0, y - y0) / 0.05));
    for (let i = 1; i <= n; i++) {
      this.px.push(x0 + ((x - x0) * i) / n);
      this.py.push(y0 + ((y - y0) * i) / n);
    }
    return this;
  }

  /** Busur berpusat (cx, cy) berjari r dari sudut a0 ke a1 (radian di bidang denah, y ke selatan). */
  busur(cx: number, cy: number, r: number, a0: number, a1: number): this {
    const n = Math.max(2, Math.ceil((Math.abs(a1 - a0) * r) / 0.05));
    for (let i = 1; i <= n; i++) {
      const a = a0 + ((a1 - a0) * i) / n;
      this.px.push(cx + r * Math.cos(a));
      this.py.push(cy + r * Math.sin(a));
    }
    return this;
  }

  /** Titik-titik kurva (tanpa titik pertamanya). */
  kurva(titik: (u: number) => Titik2, n: number): this {
    for (let i = 1; i <= n; i++) {
      const [x, y] = titik(i / n);
      this.px.push(x);
      this.py.push(y);
    }
    return this;
  }

  get ujung(): Titik2 {
    return [this.px[this.px.length - 1]!, this.py[this.py.length - 1]!];
  }

  ruas(nama: string, laju: number, kunci: number, tinggi: (x: number, y: number) => number): RuasParkir {
    const n = this.px.length;
    const [x, y, h, s] = [new Float64Array(this.px), new Float64Array(this.py), new Float64Array(n), new Float64Array(n)];
    for (let i = 0; i < n; i++) {
      h[i] = tinggi(x[i]!, y[i]!);
      if (i > 0) s[i] = s[i - 1]! + Math.hypot(x[i]! - x[i - 1]!, y[i]! - y[i - 1]!);
    }
    return { nama, x, y, h, s, panjang: s[n - 1]!, laju, kunci };
  }
}

const P = GEDUNG_PARKIR;
/** Tinggi alas mobil: aspal akses (0,031), lorong berwarna dek (dek + 0,007), aspal ramp (+0,004). */
const H_TANAH = 0.032;
const hDek = (n: 2 | 3): number => P.hDek[n - 2]! + 0.007;
const diLajurRamp = (y: number): boolean => y > P.yDek;
const tanah = (): number => H_TANAH;
const dek = (n: 2 | 3) => (): number => hDek(n);
/** Zona ramp 1: lengkung S & kaki ramp di tanah, ramp 1 di lajur selatan, sisi barat dek 2. */
const zonaA = (x: number, y: number): number => (x >= P.x1 ? H_TANAH : diLajurRamp(y) ? tinggiRamp(1, x) + 0.005 : hDek(2));
/** Zona ramp 2: sambungan di ujung timur dek 2, ramp 2 di lajur selatan, sisi barat dek 3. */
const zonaB = (x: number, y: number): number => (diLajurRamp(y) ? tinggiRamp(2, x) + 0.005 : x < 33 ? hDek(3) : hDek(2));

/** Lajur (tengah mobil): kiri ±0,2 dari tengah lorong; zona ramp satu lajur di tengah lajur ramp. */
const L = {
  dekTimur: P.lorongDek.y0 + 0.2,
  dekBarat: P.lorongDek.y1 - 0.2,
  xBaratDek: 31.25,
  yRamp: (P.yDek + P.y1) / 2,
  lorongMasuk: AKSES_PARKIR.yLorong + 0.2,
  lorongKeluar: AKSES_PARKIR.yLorong - 0.2,
  timurMasuk: AKSES_PARKIR.xTimur + 0.2,
  timurKeluar: AKSES_PARKIR.xTimur - 0.2,
  /** Sambungan tunggal ujung timur dek ke ramp 2, dan ruang putar. */
  xSambung: 35.55,
} as const;
const yBelok = AKSES_PARKIR.yLorong - AKSES_PARKIR.jariBelok;
const xBelok = AKSES_PARKIR.xTimur - AKSES_PARKIR.jariBelok;
const halus = (u: number): number => u * u * (3 - 2 * u);
/** Lengkung S bergeser ke lajur masuk/keluar di ujung lorongnya, ke tengah lajur ramp di kakinya. */
const lengkungNaik = (u: number): Titik2 => {
  const [x, y] = titikLengkungS(u);
  return [x, y + 0.2 * (1 - halus(u))];
};
const lengkungTurun = (u: number): Titik2 => {
  const [x, y] = titikLengkungS(1 - u);
  return [x, y - 0.2 * (1 - halus(1 - u))];
};
const PI = Math.PI;
/**
 * Ruang putar ujung timur dek dikunci mulai x ini di lajur ke timur: belokan keluar ruang putar menyapu sampai
 * ±0,1 ke lajur itu. Titik tunggu turun di lorong dek ke barat cukup jauh dari mulut ruang putar (≥ 1,9) supaya
 * mobil yang keluar ruang putar selalu bisa melepas kuncinya walau ada yang menunggu zona ramp.
 */
const X_PUTAR = 33.4;
const X_TUNGGU_TURUN = 31.9;

/** Putar balik di ujung timur lorong dek (bentuk lolipop di ruang x 34,82–35,91, y 14,65–16,3), tanpa titik pertama. */
function putarBalik(p: Penyusun): Penyusun {
  return p
    .garis(35.2, L.dekTimur)
    .busur(35.2, L.dekTimur + 0.35, 0.35, 1.5 * PI, 2 * PI)
    .garis(L.xSambung, 15.7)
    .busur(35.2, 15.7, 0.35, 0, PI)
    .garis(34.85, 15.65)
    .busur(34.45, 15.65, 0.4, 0, -0.5 * PI);
}

/**
 * Belokan sisi barat dek. Dari lajur ramp: jari-jari 0,6, karena pojok luar mobil tidak boleh menyapu pagar selatan
 * ramp (y 17,2). Ke lorong dek: 0,35 (naik) dan 0,38 (turun), pusat sedekat mungkin ke tembok barat (x 30,86) dan
 * mobil dek baris 1 dan 2 yang terdekat.
 */
const BELOK_BARAT = { rRamp: 0.6, rNaik: 0.35, rTurun: 0.38 } as const;
const xRampBarat = L.xBaratDek + BELOK_BARAT.rRamp;
const yRampBarat = L.yRamp - BELOK_BARAT.rRamp;

/** Naik dari lajur ramp ke sisi barat dek, lalu ke lorong dek ke timur (tanpa titik pertama). */
const naikKeDek = (p: Penyusun): Penyusun =>
  p
    .garis(xRampBarat, L.yRamp)
    .busur(xRampBarat, yRampBarat, BELOK_BARAT.rRamp, 0.5 * PI, PI)
    .garis(L.xBaratDek, L.dekTimur + BELOK_BARAT.rNaik)
    .busur(L.xBaratDek + BELOK_BARAT.rNaik, L.dekTimur + BELOK_BARAT.rNaik, BELOK_BARAT.rNaik, PI, 1.5 * PI)
    .garis(32.3, L.dekTimur);

/** Dari lorong dek ke barat turun ke sisi barat dek, lalu ke lajur ramp ke timur (tanpa titik pertama). */
const turunDariDek = (p: Penyusun): Penyusun =>
  p
    .garis(L.xBaratDek + BELOK_BARAT.rTurun, L.dekBarat)
    .busur(L.xBaratDek + BELOK_BARAT.rTurun, L.dekBarat + BELOK_BARAT.rTurun, BELOK_BARAT.rTurun, -0.5 * PI, -PI)
    .garis(L.xBaratDek, yRampBarat)
    .busur(xRampBarat, yRampBarat, BELOK_BARAT.rRamp, PI, 0.5 * PI);

/** Semua ruas jalur mobil parkir (dibuat sekali). */
export const RUAS_PARKIR = (() => {
  const { aNaik, aTurun, bNaik, bTurun, putar2, putar3, simpangSamping, simpangLorong } = KUNCI;
  // Tikungan berkunci mulai dan berakhir cukup jauh supaya mobil yang menunggu di luar sapuan mobil yang berbelok.
  const asalSamping = new Penyusun([X_MUNCUL_PARKIR, Y_MASUK]).garis(52.2, Y_MASUK).ruas('asal-samping', 2.0, 0, tanah);
  const asalBelokSamping = new Penyusun([52.2, Y_MASUK])
    .garis(51.45, Y_MASUK)
    .busur(51.45, Y_MASUK + 0.4, 0.4, -0.5 * PI, -PI)
    .garis(L.timurMasuk, 6.0)
    .ruas('asal-belok-samping', 1.4, simpangSamping, tanah);
  const asalLajur = new Penyusun([L.timurMasuk, 6.0]).garis(L.timurMasuk, yBelok - 0.5).ruas('asal-lajur', 1.4, 0, tanah);
  const asalBelokLorong = new Penyusun([L.timurMasuk, yBelok - 0.5])
    .garis(L.timurMasuk, yBelok)
    .busur(xBelok, yBelok, AKSES_PARKIR.jariBelok + 0.2, 0, 0.5 * PI)
    .garis(xBelok - 0.7, L.lorongMasuk)
    .ruas('asal-belok-lorong', 1.4, simpangLorong, tanah);
  const asalLorong = new Penyusun([xBelok - 0.7, L.lorongMasuk]).garis(AKSES_PARKIR.xLorongBarat, L.lorongMasuk).ruas('asal-lorong', 1.4, 0, tanah);
  const aNaikRuas = naikKeDek(new Penyusun([AKSES_PARKIR.xLorongBarat, L.lorongMasuk]).kurva(lengkungNaik, 40)).ruas('ramp1-naik', 1.0, aNaik, zonaA);
  const dek2Timur = new Penyusun([32.3, L.dekTimur]).garis(X_PUTAR, L.dekTimur).ruas('dek2-timur', 1.0, 0, dek(2));
  const putarDek2 = putarBalik(new Penyusun([X_PUTAR, L.dekTimur])).ruas('dek2-putar', 1.0, putar2, dek(2));
  const keRamp2 = new Penyusun([X_PUTAR, L.dekTimur])
    .garis(35.2, L.dekTimur)
    .busur(35.2, L.dekTimur + 0.35, 0.35, 1.5 * PI, 2 * PI)
    .garis(L.xSambung, L.yRamp - 0.45)
    .busur(35.1, L.yRamp - 0.45, 0.45, 0, 0.5 * PI)
    .garis(34.6, L.yRamp)
    .ruas('ramp2-sambung-naik', 1.0, putar2 | bNaik, zonaB);
  const bNaikRuas = naikKeDek(new Penyusun([34.6, L.yRamp])).ruas('ramp2-naik', 1.0, bNaik, zonaB);
  const dek3Timur = new Penyusun([32.3, L.dekTimur]).garis(X_PUTAR, L.dekTimur).ruas('dek3-timur', 1.0, 0, dek(3));
  const putarDek3 = putarBalik(new Penyusun([X_PUTAR, L.dekTimur])).ruas('dek3-putar', 1.0, putar3, dek(3));
  const dek3Barat = new Penyusun([34.45, L.dekBarat]).garis(X_TUNGGU_TURUN, L.dekBarat).ruas('dek3-barat', 1.0, 0, dek(3));
  const bTurunRuas = turunDariDek(new Penyusun([X_TUNGGU_TURUN, L.dekBarat]))
    .garis(34.6, L.yRamp)
    .ruas('ramp2-turun', 1.0, bTurun, zonaB);
  const dariRamp2 = new Penyusun([34.6, L.yRamp])
    .garis(35.1, L.yRamp)
    .busur(35.1, L.yRamp - 0.45, 0.45, 0.5 * PI, 0)
    .garis(L.xSambung, 15.6)
    .busur(35.2, 15.6, 0.35, 0, -0.5 * PI)
    .garis(34.45, L.dekBarat)
    .ruas('ramp2-sambung-turun', 1.0, putar2 | bTurun, zonaB);
  const dek2Barat = new Penyusun([34.45, L.dekBarat]).garis(X_TUNGGU_TURUN, L.dekBarat).ruas('dek2-barat', 1.0, 0, dek(2));
  const aTurunRuas = turunDariDek(new Penyusun([X_TUNGGU_TURUN, L.dekBarat]))
    .garis(35.8, L.yRamp)
    .kurva(lengkungTurun, 40)
    .garis(38.9, L.lorongKeluar)
    .ruas('ramp1-turun', 1.0, aTurun, zonaA);
  const pulangLorong = new Penyusun([38.9, L.lorongKeluar]).garis(xBelok - 0.5, L.lorongKeluar).ruas('pulang-lorong', 1.4, 0, tanah);
  const pulangBelokLorong = new Penyusun([xBelok - 0.5, L.lorongKeluar])
    .garis(xBelok, L.lorongKeluar)
    .busur(xBelok, yBelok, AKSES_PARKIR.jariBelok - 0.2, 0.5 * PI, 0)
    .garis(L.timurKeluar, yBelok - 0.5)
    .ruas('pulang-belok-lorong', 1.4, simpangLorong, tanah);
  const pulangLajur = new Penyusun([L.timurKeluar, yBelok - 0.5]).garis(L.timurKeluar, 6.3).ruas('pulang-lajur', 1.4, 0, tanah);
  const pulangBelokSamping = new Penyusun([L.timurKeluar, 6.3])
    .garis(L.timurKeluar, Y_KELUAR + 0.5)
    .busur(L.timurKeluar + 0.5, Y_KELUAR + 0.5, 0.5, PI, 1.5 * PI)
    .garis(52.2, Y_KELUAR)
    .ruas('pulang-belok-samping', 1.4, simpangSamping, tanah);
  const pulangSamping = new Penyusun([52.2, Y_KELUAR]).garis(X_MUNCUL_PARKIR, Y_KELUAR).ruas('pulang-samping', 2.0, 0, tanah);
  const awal = [asalSamping, asalBelokSamping, asalLajur, asalBelokLorong, asalLorong, aNaikRuas, dek2Timur];
  const akhir = [dek2Barat, aTurunRuas, pulangLorong, pulangBelokLorong, pulangLajur, pulangBelokSamping, pulangSamping];
  return {
    /** Jalur mobil bertujuan dek 2 dan dek 3, dari titik muncul kembali ke titik muncul. */
    dek2: [...awal, putarDek2, ...akhir] as readonly RuasParkir[],
    dek3: [...awal, keRamp2, bNaikRuas, dek3Timur, putarDek3, dek3Barat, bTurunRuas, dariRamp2, ...akhir] as readonly RuasParkir[],
  };
})();

/** Satu mobil parkir yang bergerak. Posisi & arah (keluaran) ditulis ulang tiap langkah tanpa alokasi. */
export interface MobilParkir {
  readonly id: number;
  /** Indeks warna badan (WARNA_MOBIL). */
  readonly warna: number;
  readonly ambang: number;
  /** Melaju (terlihat); nonaktif = menunggu di titik muncul. */
  aktif: boolean;
  /** Dek tujuan putaran ini (dipilih di titik muncul). */
  tujuan: 2 | 3;
  ruas: number;
  s: number;
  v: number;
  /** Kunci ruas bersama yang sedang dipegang (bit KUNCI). */
  kunci: number;
  /** Putaran yang sudah selesai (untuk tes). */
  putaran: number;
  x: number;
  y: number;
  /** Tinggi alas mobil (rata-rata kedua sumbu roda). */
  h: number;
  /** Arah hadap di denah (radian, 0 = +x, π/2 = +y) dan kemiringan hidung ke atas (radian). */
  hadap: number;
  angguk: number;
}

/**
 * Kapasitas instans LaluLintas3D (mesh tiap jenis & kolong): semua kendaraan jalan belakang ditambah semua mobil
 * gedung parkir, karena pada kepadatan 1 semuanya aktif sekaligus (50 + 4 = 54).
 */
export function kapasitasLaluLintas3D(jalan: { readonly kendaraan: readonly unknown[] }, parkir: { readonly mobil: readonly unknown[] }): number {
  return jalan.kendaraan.length + parkir.mobil.length;
}

const jalurMobil = (m: MobilParkir): readonly RuasParkir[] => (m.tujuan === 3 ? RUAS_PARKIR.dek3 : RUAS_PARKIR.dek2);
const KUNCI_LEPAS_SESUDAH = UKURAN_MOBIL.panjang / 2 + 0.05;

/** Lalu lintas gedung parkir: paling banyak 3 mobil dengan lantai 2, 4 dengan lantai 3. */
export class LaluLintasParkir {
  readonly mobil: MobilParkir[] = AMBANG_MOBIL_PARKIR.map((ambang, id) => ({
    id,
    warna: (id * 3 + 1) % 8,
    ambang,
    aktif: false,
    tujuan: 2,
    ruas: 0,
    s: 0,
    v: 0,
    kunci: 0,
    putaran: 0,
    x: X_MUNCUL_PARKIR,
    y: Y_MASUK,
    h: H_TANAH,
    hadap: PI,
    angguk: 0,
  }));
  /** Porsi mobil yang ikut (0–1), mengikuti jam seperti LaluLintas.kepadatan. */
  kepadatan = 1;
  /** Lantai tambahan gedung parkir yang digambar (0 = tanpa gedung) dan lahan parkir yang dibangun (total). */
  private lantai = 0;
  private baris = 0;
  private readonly titik = { x: 0, y: 0, h: 0, hadap: 0 };

  /** Mobil paling banyak menurut lantai (0 tanpa gedung parkir atau tanpa lahan parkir). */
  get maks(): number {
    return this.lantai < 1 || this.baris < 1 ? 0 : this.lantai >= 2 ? 4 : 3;
  }

  /** Dek tujuan mobil ini bila berangkat sekarang: lantai 3 = separuh ke dek 3, mulai mobil ambang 0. */
  private tujuanUntuk(m: MobilParkir): 2 | 3 {
    return this.lantai >= 2 && m.id % 2 === 0 ? 3 : 2;
  }

  private ikut(m: MobilParkir): boolean {
    return m.id < this.maks && m.ambang < this.kepadatan;
  }

  /**
   * Lantai parkir dan lahan parkir (total, tanah & dek) dari state. Gedung baru berdiri (dibeli atau dimuat): mobil langsung tersebar
   * di jalur. Lantai 3 dibeli: hanya mobil yang baru boleh ikut yang langsung ditempatkan; tujuan mobil lain
   * berganti di titik muncul berikutnya.
   */
  atur(lantai: number, lahanParkir: number): void {
    if (lantai === this.lantai && lahanParkir === this.baris) return;
    const dari = this.lantai;
    this.lantai = lantai;
    this.baris = lahanParkir;
    if (dari < 1 && lantai >= 1) this.sebarSegera();
    else if (lantai > dari) this.sebarSegera(this.mobil.filter((m) => !m.aktif && this.ikut(m)));
  }

  /** Terapkan kepadatan sekarang juga (saat adegan dibuat): mobil yang ikut langsung tersebar di jalur. */
  aturKepadatanSegera(kepadatan: number): void {
    this.kepadatan = kepadatan;
    this.sebarSegera();
  }

  /**
   * Tempatkan mobil yang ikut merata di jalurnya, hanya di ruas tanpa kunci (bukan zona ramp atau ruang putar) dan
   * berjarak dari mobil lain; `hanya` = mobil yang ditempatkan (bawaan semua mobil).
   */
  private sebarSegera(hanya?: readonly MobilParkir[]): void {
    const daftar = hanya ?? this.mobil;
    for (const m of daftar) {
      m.aktif = false;
      m.kunci = 0;
    }
    const ikut = daftar.filter((m) => this.ikut(m));
    ikut.forEach((m, i) => {
      m.tujuan = this.tujuanUntuk(m);
      const jalur = jalurMobil(m);
      const total = jalur.reduce((a, r) => a + r.panjang, 0);
      const mulai = (i + 0.3 + (hanya ? 0.5 : 0)) / ikut.length;
      // Calon tempat maju 1 % jalur tiap kali dari pecahan mobil ini sampai ada yang lolos.
      for (let c = 0; c < 100; c++) {
        let sisa = (((mulai + c / 100) % 1) * total) % total;
        let k = 0;
        while (sisa > jalur[k]!.panjang) sisa -= jalur[k++]!.panjang;
        const r = jalur[k]!;
        if (r.kunci !== 0 || sisa < 0.6 || sisa > r.panjang - 0.6) continue;
        m.ruas = k;
        m.s = sisa;
        this.tulisPosisi(m);
        if (this.mobil.some((o) => o !== m && o.aktif && Math.hypot(o.x - m.x, o.y - m.y) < UKURAN_MOBIL.panjang + JARAK_AMAN_PARKIR + 0.3)) continue;
        m.v = r.laju;
        m.aktif = true;
        break;
      }
    });
  }

  /** Satu langkah simulasi (detik main; panggil dengan langkah kecil, ≤ 0,05). */
  perbarui(dt: number): void {
    for (const m of this.mobil) {
      if (!m.aktif) {
        if (this.ikut(m) && this.titikMunculBebas()) this.berangkat(m);
        continue;
      }
      const jalur = jalurMobil(m);
      const r = jalur[m.ruas]!;
      let target = r.laju;
      // Mobil depan searah di jalur yang sama: melambat mulus, tidak pernah lebih dekat dari jarak aman.
      const depan = this.jarakDepan(m) - UKURAN_MOBIL.panjang - JARAK_AMAN_PARKIR;
      target = Math.min(target, Math.max(0, depan * 1.6));
      let batas = depan;
      // Ruas berikutnya berkunci: pegang kuncinya, atau berhenti di titik tunggu (moncong tepat sebelum ruas itu).
      const berikut = jalur[m.ruas + 1];
      const perlu = berikut ? berikut.kunci & ~m.kunci : 0;
      const keTunggu = r.panjang - UKURAN_MOBIL.panjang / 2 - 0.05 - m.s;
      if (perlu !== 0 && keTunggu < 1.2) {
        if (this.bisaKunci(m, perlu)) m.kunci |= perlu;
        else {
          target = Math.min(target, Math.max(0, keTunggu * 1.6));
          batas = Math.min(batas, keTunggu);
        }
      }
      m.v += (target - m.v) * Math.min(1, dt * 3);
      if (m.v < 0.02 && target < 0.02) m.v = 0;
      const maju = Math.min(m.v * dt, Math.max(0, batas));
      if (maju < m.v * dt) m.v = maju / dt;
      m.s += maju;
      if (m.s >= r.panjang) {
        m.s -= r.panjang;
        m.ruas++;
        if (m.ruas >= jalur.length) {
          // Kembali ke titik muncul: ikut lagi bila tempatnya bebas, atau berhenti (menunggu tak terlihat).
          m.putaran++;
          m.kunci = 0;
          m.aktif = false;
          if (this.ikut(m) && this.titikMunculBebas()) this.berangkat(m, m.v);
          continue;
        }
      }
      // Kunci dilepas sesudah buntut mobil keluar dari ruas yang membutuhkannya.
      const kini = jalur[m.ruas]!;
      const sebelum = m.ruas > 0 && m.s < KUNCI_LEPAS_SESUDAH ? jalur[m.ruas - 1]!.kunci : 0;
      const akanDatang = perluMenunggu(jalur, m) ? jalur[m.ruas + 1]!.kunci : 0;
      m.kunci &= kini.kunci | sebelum | akanDatang;
      this.tulisPosisi(m);
    }
  }

  /** Mobil mulai putaran di titik muncul. */
  private berangkat(m: MobilParkir, v = 0): void {
    m.tujuan = this.tujuanUntuk(m);
    m.ruas = 0;
    m.s = 0;
    m.v = v;
    m.kunci = 0;
    m.aktif = true;
    this.tulisPosisi(m);
  }

  /** Titik muncul bebas: tidak ada mobil aktif di awal ruas pertama dalam jarak satu mobil + jarak aman. */
  private titikMunculBebas(): boolean {
    const r0 = RUAS_PARKIR.dek2[0]!;
    for (const o of this.mobil) if (o.aktif && jalurMobil(o)[o.ruas] === r0 && o.s < UKURAN_MOBIL.panjang + JARAK_AMAN_PARKIR + 0.2) return false;
    return true;
  }

  /** Bisa memegang kunci ini: tidak ada mobil lain yang memegang kunci yang bentrok. */
  private bisaKunci(m: MobilParkir, kunci: number): boolean {
    for (const o of this.mobil) {
      if (o === m || !o.aktif || o.kunci === 0) continue;
      for (const [a, b] of BENTROK) if ((kunci & a && o.kunci & b) || (kunci & b && o.kunci & a)) return false;
    }
    return true;
  }

  /** Jarak tengah ke tengah ke mobil aktif terdekat di depan pada jalur mobil ini (ruas yang sama dipakai bersama), sampai 4 satuan. */
  private jarakDepan(m: MobilParkir): number {
    const jalur = jalurMobil(m);
    let terdekat = Number.POSITIVE_INFINITY;
    for (const o of this.mobil) {
      if (o === m || !o.aktif) continue;
      const ruasO = jalurMobil(o)[o.ruas];
      let jarak = -m.s;
      for (let k = m.ruas; k < jalur.length && jarak < 4; k++) {
        const r = jalur[k]!;
        if (r === ruasO && (k > m.ruas || o.s > m.s)) {
          terdekat = Math.min(terdekat, jarak + o.s);
          break;
        }
        jarak += r.panjang;
      }
    }
    return terdekat;
  }

  /** Posisi, hadap, dan kemiringan dari kedua sumbu roda (mobil di ramp miring mengikuti permukaannya). */
  private tulisPosisi(m: MobilParkir): void {
    poseJalur(jalurMobil(m), m.ruas, m.s, this.titik, m);
  }
}

/** Pose mobil di jarak s dari awal ruas ke-k: tengah di jalur, tinggi & kemiringan dari kedua sumbu roda, hadap dari sumbu ke sumbu. */
export function poseJalur(
  jalur: readonly RuasParkir[],
  k: number,
  s: number,
  bantu: { x: number; y: number; h: number; hadap: number },
  keluar: { x: number; y: number; h: number; hadap: number; angguk: number },
): void {
  const setengah = UKURAN_MOBIL.sumbu / 2;
  titikJalur(jalur, k, s + setengah, bantu);
  const xd = bantu.x;
  const yd = bantu.y;
  const hd = bantu.h;
  titikJalur(jalur, k, s - setengah, bantu);
  const xb = bantu.x;
  const yb = bantu.y;
  const hb = bantu.h;
  titikJalur(jalur, k, s, bantu);
  keluar.x = bantu.x;
  keluar.y = bantu.y;
  keluar.h = (hd + hb) / 2;
  keluar.hadap = Math.atan2(yd - yb, xd - xb);
  keluar.angguk = Math.atan2(hd - hb, Math.hypot(xd - xb, yd - yb));
}

/** Mobil sedang mendekati ruas berkunci yang sudah dipegangnya (jangan dilepas sebelum masuk). */
function perluMenunggu(jalur: readonly RuasParkir[], m: MobilParkir): boolean {
  const berikut = jalur[m.ruas + 1];
  return berikut !== undefined && (berikut.kunci & m.kunci) !== 0 && m.s > jalur[m.ruas]!.panjang - UKURAN_MOBIL.panjang / 2 - 1.3;
}

/** Titik pada jarak s dari awal ruas ke-k jalur (boleh melewati ujung ruas; dijepit di ujung jalur). */
export function titikJalur(jalur: readonly RuasParkir[], k: number, s: number, keluar: { x: number; y: number; h: number; hadap: number }): void {
  let i = k;
  let d = s;
  while (d < 0 && i > 0) d += jalur[--i]!.panjang;
  while (d > jalur[i]!.panjang && i < jalur.length - 1) d -= jalur[i++]!.panjang;
  const r = jalur[i]!;
  const n = r.s.length;
  d = Math.min(Math.max(d, 0), r.panjang);
  // Cari bagi dua: titik j dengan s[j] ≤ d < s[j + 1].
  let a = 0;
  let b = n - 1;
  while (b - a > 1) {
    const c = (a + b) >> 1;
    if (r.s[c]! <= d) a = c;
    else b = c;
  }
  const u = r.s[b]! > r.s[a]! ? (d - r.s[a]!) / (r.s[b]! - r.s[a]!) : 0;
  keluar.x = r.x[a]! + (r.x[b]! - r.x[a]!) * u;
  keluar.y = r.y[a]! + (r.y[b]! - r.y[a]!) * u;
  keluar.h = r.h[a]! + (r.h[b]! - r.h[a]!) * u;
  keluar.hadap = Math.atan2(r.y[b]! - r.y[a]!, r.x[b]! - r.x[a]!);
}

/** Mobil ini digambar: mode lantai Gedung parkir Lantai 1 tanpa mobil bergerak, Lantai 2 hanya yang bertujuan dek 2. */
export function mobilParkirTerlihat(m: MobilParkir, lihat: { readonly gedung: string; readonly lantai: number } | null): boolean {
  if (!m.aktif) return false;
  if (!lihat || lihat.gedung !== 'parkir') return true;
  return lihat.lantai >= 3 || (lihat.lantai === 2 && m.tujuan === 2);
}

