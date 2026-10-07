/**
 * Isi label kemajuan di atas bus terminal (murni, tanpa DOM): menurunkan
 * penumpang di peron kedatangan, dicuci di petak parkir jurusan, dan memuat
 * penumpang di halte keberangkatan. label-bus3d.ts yang menggambarnya.
 */
import type { BusVisual } from './dunia-visual';
import { namaTujuan } from './suara';

export type JenisLabelBus = 'turun' | 'cuci' | 'muat';
export const JENIS_LABEL_BUS: readonly JenisLabelBus[] = ['turun', 'cuci', 'muat'];

export interface IsiLabelBus {
  readonly judul: string;
  /** Angka di sebelah judul ("7/16", "45%"). */
  readonly angka: string;
  /** Bagian bilah yang penuh (0–1). */
  readonly kemajuan: number;
  /** Bagian bilah yang samar (0–1): saat memuat, penumpang yang sudah dipanggil tapi masih berjalan. */
  readonly samar: number;
  /** Pekerjaannya tuntas (semua turun, bersih, bus penuh): label berwarna hijau. */
  readonly selesai: boolean;
}

/** Pekerjaan yang sedang dikerjakan bus ini (paling banyak satu), atau null. */
export function labelAktif(b: BusVisual): JenisLabelBus | null {
  if (b.jenis !== 'terminal') return null;
  if (b.fase === 'turunkan') return 'turun';
  if (b.fase === 'parkir' && b.cuci < 1) return 'cuci';
  if (b.fase === 'muat' && b.halte >= 0) return 'muat';
  return null;
}

const jepit01 = (v: number): number => Math.min(1, Math.max(0, v));

/**
 * @param aktif false = pekerjaan baru saja selesai dan bus sudah beranjak
 *   (label memudar sebentar dengan tanda ✓).
 */
export function isiLabelBus(b: BusVisual, jenis: JenisLabelBus, aktif: boolean): IsiLabelBus {
  switch (jenis) {
    case 'turun': {
      const awal = Math.max(1, b.muatanDatang);
      const turun = aktif ? Math.min(awal, Math.max(0, b.muatanDatang - b.muatan)) : awal;
      return { judul: aktif ? 'TURUN' : 'TURUN ✓', angka: `${turun}/${awal}`, kemajuan: turun / awal, samar: 0, selesai: turun >= awal };
    }
    case 'cuci': {
      const p = aktif ? jepit01(b.cuci) : 1;
      return { judul: p >= 1 ? 'BERSIH ✓' : 'CUCI', angka: `${Math.floor(p * 100)}%`, kemajuan: p, samar: 0, selesai: p >= 1 };
    }
    case 'muat': {
      const tujuan = b.tujuan >= 0 ? namaTujuan(b.tujuan).toUpperCase() : 'BUS';
      const kap = Math.max(1, b.kapasitas);
      return {
        judul: aktif ? tujuan : `${tujuan} ✓`,
        angka: `${b.penumpangNaik}/${b.kapasitas}`,
        kemajuan: jepit01(b.penumpangNaik / kap),
        samar: jepit01(b.muatan / kap),
        selesai: b.penumpangNaik >= b.kapasitas,
      };
    }
  }
}
