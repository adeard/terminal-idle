/**
 * Klakson telolet (murni, tanpa three.js): memilih bus yang diketuk pemain di
 * layar, dan tingkah anak-anak "Om Telolet Om" di trotoar seberang jalan raya.
 * Siang hari (tidak hujan) mereka membentangkan spanduk kardus, melambai ke
 * tiap bus yang lewat di depannya, lalu melompat kegirangan sambil melambai
 * saat klakson telolet terdengar.
 */
import type { BusVisual } from './dunia-visual';
import { dalamRentang } from './kehidupan-malam';
import { BUS, JALAN } from './tata-letak';

/** Cukup Proyektor (lihat zona3d.ts) tanpa bergantung pada three.js. */
export interface ProyeksiLayar {
  proyeksi(x: number, y: number, h: number): { x: number; y: number; terlihat: boolean };
}

/** Ketukan sejauh ini (px CSS) di luar badan bus masih dianggap mengenai bus. */
export const TOLERANSI_KETUK_PX = 14;
/** Ketinggian tengah badan bus (unit) untuk proyeksi ke layar. */
const H_TENGAH_BUS = 0.35;
/** Banyaknya melodi telolet (bus yang sama selalu memakai melodi yang sama). */
export const JUMLAH_MELODI_TELOLET = 4;
/** Bus yang sama baru bisa berbunyi lagi setelah sekian detik (supaya tidak berisik diketuk beruntun). */
export const JEDA_TELOLET_BUS = 1.6;

export const melodiTelolet = (busId: number): number => ((busId % JUMLAH_MELODI_TELOLET) + JUMLAH_MELODI_TELOLET) % JUMLAH_MELODI_TELOLET;

function jarakKeRuas(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
  const vx = bx - ax;
  const vy = by - ay;
  const panjang2 = vx * vx + vy * vy;
  const t = panjang2 > 0 ? Math.min(1, Math.max(0, ((px - ax) * vx + (py - ay) * vy) / panjang2)) : 0;
  return Math.hypot(px - (ax + t * vx), py - (ay + t * vy));
}

/**
 * Bus yang diketuk di titik layar (x, y): badan bus diproyeksikan sebagai ruas
 * depan–belakang selebar bus (+ toleransi); bila beberapa kena, yang terdekat.
 */
export function busDiKetuk(bus: readonly BusVisual[], kamera: ProyeksiLayar, x: number, y: number): BusVisual | null {
  let terbaik: BusVisual | null = null;
  let jarakTerbaik = Number.POSITIVE_INFINITY;
  for (const b of bus) {
    if (b.selesai) continue;
    const c = Math.cos(b.sudut);
    const s = Math.sin(b.sudut);
    const depan = kamera.proyeksi(b.x + (c * BUS.panjang) / 2, b.y + (s * BUS.panjang) / 2, H_TENGAH_BUS);
    const belakang = kamera.proyeksi(b.x - (c * BUS.panjang) / 2, b.y - (s * BUS.panjang) / 2, H_TENGAH_BUS);
    if (!depan.terlihat && !belakang.terlihat) continue;
    const tengah = kamera.proyeksi(b.x, b.y, H_TENGAH_BUS);
    const sisi = kamera.proyeksi(b.x - (s * BUS.lebar) / 2, b.y + (c * BUS.lebar) / 2, H_TENGAH_BUS);
    const radius = Math.hypot(sisi.x - tengah.x, sisi.y - tengah.y) + TOLERANSI_KETUK_PX;
    const d = jarakKeRuas(x, y, belakang.x, belakang.y, depan.x, depan.y);
    if (d <= radius && d < jarakTerbaik) {
      jarakTerbaik = d;
      terbaik = b;
    }
  }
  return terbaik;
}

// ---------------------------------------------------------------------------
// Anak-anak "Om Telolet Om"

/**
 * Tiga anak di trotoar seberang jalan raya, di antara menara masjid dan
 * deretan toko, menghadap jalan. Dua yang pertama membentangkan spanduk.
 */
export const ANAK_TELOLET: readonly { readonly x: number; readonly y: number }[] = [
  { x: 12.25, y: -0.97 },
  { x: 12.8, y: -0.97 },
  { x: 13.38, y: -0.92 },
];
/** Spanduk kardus "OM TELOLET OM" diangkat kedua anak pertama di atas kepala (menghadap jalan, +y). */
export const SPANDUK_TELOLET = { x0: 12.1, x1: 12.95, y: -0.93, h0: 0.28, h1: 0.4 } as const;
/** Jam anak-anak menunggu bus di pinggir jalan (pulang saat hujan). */
export const JAM_ANAK_TELOLET: readonly [number, number] = [7, 17.5];
/** Mulai sekian deras, anak-anak pulang (sama dengan ambang payung). */
export const HUJAN_ANAK_PULANG = 0.12;
/** Bus di jalan raya sedekat ini (x) dari seorang anak: disapa dengan lambaian. */
export const JARAK_SAPA = 4;
/** Klakson telolet sedekat ini dari anak-anak membuat mereka kegirangan. */
export const JARAK_DENGAR_TELOLET = 26;
/** Lama kegirangan setelah mendengar telolet (detik). */
export const LAMA_GIRANG = 3.2;
/** Tinggi lompatan kegirangan (unit). */
const TINGGI_LONCAT = 0.045;

export function anakTeloletHadir(jam: number, hujan: number): boolean {
  return dalamRentang(jam, JAM_ANAK_TELOLET) && hujan < HUJAN_ANAK_PULANG;
}

export interface GerakAnak {
  /** Ayunan lambaian (−1…1), null = diam. */
  readonly lambai: number | null;
  /** Ketinggian lompatan di atas trotoar. */
  readonly loncat: number;
}

const PUSAT_ANAK = {
  x: ANAK_TELOLET.reduce((a, p) => a + p.x, 0) / ANAK_TELOLET.length,
  y: ANAK_TELOLET.reduce((a, p) => a + p.y, 0) / ANAK_TELOLET.length,
};

export class AnakTelolet {
  private waktu = 0;
  private girang = 0;

  /** Klakson telolet berbunyi di (x, y). */
  dengar(x: number, y: number): void {
    if (Math.hypot(x - PUSAT_ANAK.x, y - PUSAT_ANAK.y) <= JARAK_DENGAR_TELOLET) this.girang = LAMA_GIRANG;
  }

  perbarui(dt: number): void {
    this.waktu += Math.max(0, dt);
    this.girang = Math.max(0, this.girang - Math.max(0, dt));
  }

  get sedangGirang(): boolean {
    return this.girang > 0;
  }

  /** Gerak anak ke-i sekarang: melambai ke bus yang lewat di depannya, melompat saat kegirangan. */
  gerak(i: number, bus: readonly BusVisual[]): GerakAnak {
    const a = ANAK_TELOLET[i]!;
    if (this.girang > 0) {
      return { lambai: Math.sin(this.waktu * 11 + i * 1.7), loncat: TINGGI_LONCAT * Math.abs(Math.sin(this.waktu * 8 + i * 1.3)) };
    }
    const ada = bus.some((b) => !b.selesai && b.y < JALAN.y1 + 0.2 && Math.abs(b.x - a.x) < JARAK_SAPA);
    return { lambai: ada ? Math.sin(this.waktu * 7 + i * 1.7) : null, loncat: 0 };
  }
}
