/**
 * Kepuasan penumpang (murni; turunan dari keadaan terminal, tidak disimpan):
 * seberapa nyaman & lancar terminal untuk arus penumpangnya sekarang. Tiga
 * komponen 0–1:
 * - kelancaran: kapasitas tahap paling lambat dibanding tahap tercepat
 *   (penumpang menumpuk di depan tahap yang tertinggal jauh);
 * - fasilitas: level Kios & Toilet/Musholla dibanding besarnya arus;
 * - jalur: jalur bus dibanding jalur yang dibutuhkan arus (bus antre di jalan raya).
 * Nilainya mendatangkan lebih banyak calon penumpang (permintaanPenumpang di
 * state.ts), menaikkan semua pendapatan (pengaliKepuasan), dan menjadi syarat
 * kontrak mitra PO besar. Terminal yang dibiarkan tetap menghasilkan uang:
 * kepuasan rendah berarti bonus kecil dan terminal lebih sepi di luar jam sibuk.
 * Masukannya kapasitas, bukan arus nyata, supaya kepuasan tidak ikut naik-turun
 * dengan jam (dan tidak berputar balik lewat permintaan). Tiket yang terlalu
 * mahal mengurangi seluruh nilainya (penaltiHarga, lihat EKONOMI.harga).
 */
import { EKONOMI, type KonfigEkonomi } from '../config/economy.config';

export interface MasukanKepuasan {
  /** Kapasitas tiap tahap (pnp/dtk). */
  readonly kapasitas: readonly number[];
  /** Arus penumpang potensial (pnp/dtk). */
  readonly arus: number;
  /** Level Kios + level Toilet & Musholla. */
  readonly levelFasilitas: number;
  readonly jalur: number;
  readonly jalurMaks: number;
  /** Bagian kepuasan yang hilang karena tiket terlalu mahal (0–1); bawaan 0. */
  readonly penaltiHarga?: number;
}

export interface Kepuasan {
  /** Kepuasan keseluruhan 0–1: rata-rata berbobot komponen × (1 − penaltiHarga). */
  readonly nilai: number;
  readonly penaltiHarga: number;
  readonly kelancaran: number;
  readonly fasilitas: number;
  readonly jalur: number;
  /** Level Kios + Toilet yang dibutuhkan arus sekarang (pecahan). */
  readonly fasilitasPerlu: number;
  /** Jalur bus yang dibutuhkan arus sekarang. */
  readonly jalurPerlu: number;
}

const jepit01 = (x: number): number => Math.min(1, Math.max(0, x));

export function hitungKepuasan(m: MasukanKepuasan, cfg: KonfigEkonomi = EKONOMI): Kepuasan {
  const k = cfg.kepuasan;
  const kapMin = Math.min(...m.kapasitas);
  const kapMaks = Math.max(...m.kapasitas);
  const rasio = kapMaks > 0 ? kapMin / kapMaks : 1;
  const kelancaran = jepit01((rasio - k.rasioNol) / (k.rasioLancar - k.rasioNol));
  const arus = Math.max(0, m.arus);
  const fasilitasPerlu = k.fasilitasDasar + k.fasilitasPerLog2 * Math.log2(1 + arus);
  const fasilitas = jepit01(m.levelFasilitas / fasilitasPerlu);
  const jalurPerlu = Math.max(1, Math.min(m.jalurMaks, 1 + Math.floor(k.jalurPerLog10 * Math.log10(1 + arus))));
  const jalur = jepit01(m.jalur / jalurPerlu);
  const b = k.bobot;
  const penaltiHarga = jepit01(m.penaltiHarga ?? 0);
  const nilai = ((b.kelancaran * kelancaran + b.fasilitas * fasilitas + b.jalur * jalur) / (b.kelancaran + b.fasilitas + b.jalur)) * (1 - penaltiHarga);
  return { nilai, penaltiHarga, kelancaran, fasilitas, jalur, fasilitasPerlu, jalurPerlu };
}
