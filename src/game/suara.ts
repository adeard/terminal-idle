/**
 * Suara terminal, bagian murni: dari isi adegan dan posisi kamera, hitung
 * seberapa keras tiap lapisan suara latar (riuh orang, mesin bus, lalu lintas,
 * semprotan cuci, jangkrik, hujan) dan bunyi sesaat (rem angin, deru bus
 * berangkat, klakson, pengumuman). Tanpa Web Audio supaya bisa dites;
 * platform/suara.ts yang membunyikannya.
 *
 * Suara terdengar seperti dari kamera: yang dekat titik pandang lebih keras,
 * yang jauh samar, dan zoom masuk membuat semuanya lebih dekat.
 */
import { petugasCuci, type BusVisual, type PeristiwaBus } from './dunia-visual';
import { TUJUAN_BUS } from './tata-letak';

export interface Pendengar {
  /** Titik tanah yang dilihat kamera (koordinat denah). */
  readonly x: number;
  readonly y: number;
  /** Jarak kamera ke titik itu (kecil = zoom masuk). */
  readonly jarak: number;
  /** Posisi kiri–kanan di layar (−1 … 1) untuk titik denah, untuk stereo. */
  readonly pan: (x: number, y: number) => number;
}

/** Kekerasan tiap lapisan suara latar, 0–1. */
export interface LapisanSuara {
  readonly riuh: number;
  readonly mesin: number;
  readonly lalin: number;
  readonly semprot: number;
  readonly jangkrik: number;
  readonly hujan: number;
}

export type JenisBunyi = 'rem' | 'deru' | 'klakson' | 'pengumuman' | 'guntur' | 'telolet';

export interface Bunyi {
  readonly jenis: JenisBunyi;
  /** Kekerasan 0–1, sudah termasuk jarak ke kamera (pengumuman lewat pengeras suara: 1). */
  readonly keras: number;
  /** Kiri–kanan −1 … 1. */
  readonly pan: number;
  /** Isi pengumuman (jenis 'pengumuman'). */
  readonly teks?: string;
  /** Klakson ditekan dua kali ("tin-tin"). */
  readonly ganda?: boolean;
  /** Klakson kendaraan kecil (lebih nyaring & pendek daripada bus). */
  readonly kecil?: boolean;
  /** Guntur: detik sampai terdengar setelah kilat (makin jauh makin lama & makin berat). */
  readonly tunda?: number;
  /** Klakson telolet: melodi ke-berapa (lihat JUMLAH_MELODI_TELOLET di telolet.ts). */
  readonly melodi?: number;
}

/** Yang membunyikan suara (platform/suara.ts); adegan hanya mengirim lapisan & bunyi tiap frame. */
export interface PenerimaSuara {
  perbarui(lapisan: LapisanSuara, bunyi: readonly Bunyi[]): void;
}

interface Titik2 {
  readonly x: number;
  readonly y: number;
  readonly aktif?: boolean;
}

export interface SumberSuara {
  /** Kelompok orang yang terlihat (penumpang, pejalan kaki, orang diam). */
  readonly orang: readonly (readonly Titik2[])[];
  readonly bus: readonly BusVisual[];
  readonly peristiwa: readonly PeristiwaBus[];
  /** Kendaraan kecil di jalan belakang (yang aktif saja yang bersuara). */
  readonly kendaraan: readonly Titik2[];
  /** Keramaian terminal 0–1 (ritme harian). */
  readonly keramaian: number;
  /** 0 = siang, 1 = malam. */
  readonly malam: number;
  /** Intensitas hujan 0–1. */
  readonly hujan: number;
  /** Kecerahan kilat petir sekarang 0–1 (guntur menyusul tiap kilat baru). */
  readonly kilat: number;
}

/** Jarak kamera acuan: pada jarak ini kekerasan = 1. */
const JARAK_ACUAN = 25;
const ZOOM = { min: 0.5, maks: 1.6 } as const;
/** Jari-jari dengar relatif jarak kamera: zoom masuk → hanya yang dekat yang terdengar. */
const RADIUS_DENGAR = 0.45;
/** Jumlah sumber (terbobot) yang membuat lapisan penuh; akar karena banyak suara acak menjumlah per akar. */
const PENUH = { riuh: 12, mesin: 4.5, lalin: 5, semprot: 2 } as const;
/** Mesin bus yang melaju lebih keras daripada yang langsam di halte. */
const MESIN_MELAJU = 1.6;
/** Jeda antarpengumuman (detik): minimum + acak. */
const JEDA_PENGUMUMAN = { min: 35, acak: 25 } as const;
/** Pengumuman umum (bukan keberangkatan) sesekali. */
const JEDA_UMUM = { min: 150, acak: 90 } as const;
const PELUANG_KLAKSON_BERANGKAT = 0.5;
const PELUANG_PENGUMUMAN_TIBA = 0.3;
/** Klakson kendaraan di jalan: rata-rata sekali per sekian detik saat jalan ramai. */
const JEDA_KLAKSON_JALAN = { min: 10, acak: 30 } as const;

export const PENGUMUMAN_UMUM: readonly string[] = [
  'Perhatian. Para penumpang dimohon menjaga barang bawaannya masing-masing.',
  'Perhatian. Dilarang merokok di dalam area ruang tunggu.',
  'Perhatian. Belilah tiket hanya di loket resmi. Hati-hati terhadap calo.',
];

/** "SURABAYA" → "Surabaya" (supaya dibaca sebagai kata, bukan dieja). */
const namaKota = (s: string): string => s.charAt(0) + s.slice(1).toLowerCase();

/** Nama kota tujuan ke-i (indeks TUJUAN_BUS, dibungkus). */
export const namaTujuan = (i: number): string => namaKota(TUJUAN_BUS[((i % TUJUAN_BUS.length) + TUJUAN_BUS.length) % TUJUAN_BUS.length]!);
export const asalBus = (busId: number): string => namaKota(TUJUAN_BUS[(busId * 3 + 1) % TUJUAN_BUS.length]!);

/**
 * Pengumuman keberangkatan. Halte keberangkatan ke-k = gerbang "JALUR k+1".
 * @param tujuan indeks TUJUAN_BUS jurusan bus.
 */
export function teksPanggil(tujuan: number, halte: number): string {
  return `Perhatian. Bus jurusan ${namaTujuan(tujuan)} sudah siap di jalur ${halte + 1}. Penumpang dipersilakan naik.`;
}

export function teksTiba(busId: number): string {
  return `Bus dari ${asalBus(busId)} telah tiba di peron kedatangan.`;
}

/** Faktor zoom: kamera dekat → suara lebih keras. */
export function faktorZoom(p: Pendengar): number {
  return Math.min(ZOOM.maks, Math.max(ZOOM.min, JARAK_ACUAN / Math.max(1, p.jarak)));
}

/** Bobot satu sumber di (x, y) bagi pendengar: 1 di titik pandang, mengecil menjauh. */
export function bobotDengar(p: Pendengar, x: number, y: number): number {
  const r = Math.max(2.5, RADIUS_DENGAR * p.jarak);
  const d2 = ((x - p.x) ** 2 + (y - p.y) ** 2) / (r * r);
  return 1 / (1 + d2);
}

const jepit01 = (v: number): number => Math.min(1, Math.max(0, v));

/**
 * Klakson telolet dari bus yang diketuk pemain di (x, y). Bus yang diketuk
 * selalu terlihat di layar, jadi tetap nyaring; yang dekat titik pandang paling keras.
 */
export function bunyiTelolet(p: Pendengar, x: number, y: number, melodi: number): Bunyi {
  return { jenis: 'telolet', keras: jepit01(0.6 + 0.4 * bobotDengar(p, x, y)), pan: p.pan(x, y), melodi };
}

export class PengamatSuara {
  private jedaPengumuman = 8;
  private jedaUmum: number;
  private jedaKlaksonJalan: number;
  private kilatLalu = 0;

  constructor(private readonly acak: () => number = Math.random) {
    this.jedaUmum = JEDA_UMUM.min * 0.5 + this.acak() * JEDA_UMUM.acak;
    this.jedaKlaksonJalan = JEDA_KLAKSON_JALAN.min + this.acak() * JEDA_KLAKSON_JALAN.acak;
  }

  /** Lapisan suara latar sekarang dan bunyi sesaat yang terjadi sejak frame lalu. */
  amati(dt: number, s: SumberSuara, p: Pendengar): { readonly lapisan: LapisanSuara; readonly bunyi: Bunyi[] } {
    const z = faktorZoom(p);
    const bobot = (x: number, y: number): number => bobotDengar(p, x, y);

    let orang = 0;
    for (const kelompok of s.orang) for (const o of kelompok) if (o.aktif !== false) orang += bobot(o.x, o.y);
    let mesin = 0;
    let semprot = 0;
    for (const b of s.bus) {
      const w = bobot(b.x, b.y);
      if (b.fase === 'parkir') {
        // Mesin dimatikan selama dicuci; sopir menyemprot air.
        if (petugasCuci(b.cuci).some((q) => q.peran === 'sopir' && q.bekerja)) semprot += w;
      } else {
        mesin += w * (b.v > 0.05 ? MESIN_MELAJU : 1);
      }
    }
    let lalin = 0;
    for (const k of s.kendaraan) if (k.aktif !== false) lalin += bobot(k.x, k.y);

    const lapisan: LapisanSuara = {
      riuh: z * jepit01(Math.sqrt(orang) / PENUH.riuh),
      mesin: z * jepit01(Math.sqrt(mesin) / PENUH.mesin),
      lalin: z * jepit01(Math.sqrt(lalin) / PENUH.lalin),
      semprot: z * jepit01(semprot / PENUH.semprot),
      jangkrik: jepit01(s.malam) * (1 - jepit01(s.keramaian)) ** 1.5,
      hujan: jepit01(s.hujan),
    };
    return { lapisan, bunyi: this.bunyiSesaat(dt, s, p, z) };
  }

  private bunyiSesaat(dt: number, s: SumberSuara, p: Pendengar, z: number): Bunyi[] {
    const bunyi: Bunyi[] = [];
    const di = (x: number, y: number, keras = 1): Pick<Bunyi, 'keras' | 'pan'> => ({ keras: Math.min(1, z * keras * bobotDengar(p, x, y)), pan: p.pan(x, y) });
    this.jedaPengumuman -= dt;
    this.jedaUmum -= dt;
    this.jedaKlaksonJalan -= dt;
    const umumkan = (teks: string): void => {
      bunyi.push({ jenis: 'pengumuman', keras: 1, pan: 0, teks });
      this.jedaPengumuman = JEDA_PENGUMUMAN.min + this.acak() * JEDA_PENGUMUMAN.acak;
      this.jedaUmum = Math.max(this.jedaUmum, JEDA_UMUM.min * 0.5);
    };

    for (const e of s.peristiwa) {
      switch (e.jenis) {
        case 'berhenti':
          bunyi.push({ jenis: 'rem', ...di(e.x, e.y) });
          break;
        case 'berangkat':
          bunyi.push({ jenis: 'deru', ...di(e.x, e.y) });
          if (this.acak() < PELUANG_KLAKSON_BERANGKAT) bunyi.push({ jenis: 'klakson', ...di(e.x, e.y), ganda: this.acak() < 0.5 });
          break;
        case 'panggil':
          if (this.jedaPengumuman <= 0) umumkan(teksPanggil(e.tujuan >= 0 ? e.tujuan : e.busId, e.halte));
          break;
        case 'tiba':
          if (this.jedaPengumuman <= 0 && this.acak() < PELUANG_PENGUMUMAN_TIBA) umumkan(teksTiba(e.busId));
          break;
      }
    }
    if (this.jedaUmum <= 0 && this.jedaPengumuman <= 0) {
      umumkan(PENGUMUMAN_UMUM[Math.floor(this.acak() * PENGUMUMAN_UMUM.length)]!);
      this.jedaUmum = JEDA_UMUM.min + this.acak() * JEDA_UMUM.acak;
    }

    // Kilat baru menyambar: guntur menyusul beberapa detik kemudian.
    if (s.kilat > 0 && this.kilatLalu <= 0) {
      const tunda = 0.6 + this.acak() * 3.4;
      bunyi.push({ jenis: 'guntur', keras: Math.min(1, 0.45 + s.hujan * 0.4 + (4 - tunda) * 0.06), pan: (this.acak() - 0.5) * 1.2, tunda });
    }
    this.kilatLalu = s.kilat;

    if (this.jedaKlaksonJalan <= 0) {
      const aktif = s.kendaraan.filter((k) => k.aktif !== false);
      // Jalan sepi: klakson makin jarang.
      this.jedaKlaksonJalan = (JEDA_KLAKSON_JALAN.min + this.acak() * JEDA_KLAKSON_JALAN.acak) / Math.max(0.25, s.kendaraan.length ? aktif.length / s.kendaraan.length : 0);
      const k = aktif[Math.floor(this.acak() * aktif.length)];
      if (k) bunyi.push({ jenis: 'klakson', ...di(k.x, k.y, 0.7), ganda: this.acak() < 0.3, kecil: true });
    }
    return bunyi;
  }
}
