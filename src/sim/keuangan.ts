/**
 * Keuangan terminal (murni): pendapatan per sumber & biaya per pos per
 * jam terminal dari hasil operasi, dan kas yang tidak pernah minus (bila kas
 * habis, gaji tak terbayar dan petugas berhenti satu per satu). Rancangan:
 * bagian 6 documents/13-rancangan-tycoon.md.
 */
import { EKONOMI, type KonfigEkonomi } from '../config/economy.config';
import { operasionalGedung, pengaliBiayaKelas, perawatanHarian } from './bangunan';
import { retribusiDipungut, type HasilOperasi, type KeadaanOperasi } from './operasi';
import { gajiHarian, hitungPetugas } from './petugas';
import { bagianPemakai, okupansiKios } from './tarif';

/** Rupiah per jam terminal. */
export interface RincianPendapatan {
  readonly layanan: number;
  readonly sewaLoket: number;
  readonly retribusi: number;
  readonly parkir: number;
  readonly toilet: number;
  readonly sewaKios: number;
}

/** Rupiah per jam terminal. */
export interface RincianBiaya {
  readonly gaji: number;
  readonly perawatan: number;
  readonly listrik: number;
  readonly gedung: number;
}

export interface KeuanganJam {
  readonly pendapatan: RincianPendapatan;
  readonly biaya: RincianBiaya;
  readonly totalPendapatan: number;
  readonly totalBiaya: number;
  /** Pendapatan − biaya (Rp per jam terminal; bisa negatif). */
  readonly laba: number;
}

const JAM_PER_HARI = 24;

const jumlah = (r: object): number => Object.values(r).reduce((a: number, b) => a + (b as number), 0);

/**
 * Pendapatan & biaya per jam terminal pada keadaan & hasil operasi ini.
 * @param malam lampu menyala (listrik × pengaliMalam)
 */
export function keuanganPerJam(k: KeadaanOperasi, op: HasilOperasi, malam: boolean, cfg: KonfigEkonomi = EKONOMI): KeuanganJam {
  const t = cfg.tycoon;
  const b = k.bangunan;
  const n = hitungPetugas(k.petugas);
  const tarif = k.tarif;
  const arus = Math.max(0, op.arus);

  const layanan = op.segmen.reduce((a, s) => a + s.arus * s.harga, 0) * (tarif.layanan / 100);
  const sewaLoket = (k.po.reduce((a, p) => a + Math.max(0, p.loket), 0) * tarif.sewaLoket) / JAM_PER_HARI;
  // Tanpa petugasnya, separuh bus lolos dari retribusi dan separuh pengantar tidak membayar parkir.
  const terjaga = (unit: number, petugas: number): number => (unit > 0 ? 0.5 + 0.5 * Math.min(1, petugas / unit) : 0);
  const retribusi = retribusiDipungut(k) ? (arus / t.kapasitas.penumpangPerBus) * tarif.retribusiBus * terjaga(b.posRetribusi, n.petugasRetribusi) : 0;
  const parkir =
    b.lahanParkir > 0
      ? Math.min(arus * bagianPemakai(tarif.parkir, t.tarif.parkir.bawaan, t.pengantar.bagian, t.pengantar.kepekaan), b.lahanParkir * t.pengantar.perUnit) * tarif.parkir * terjaga(b.lahanParkir, n.juruParkir)
      : 0;
  const toilet =
    b.toilet > 0 ? Math.min(arus * bagianPemakai(tarif.toilet, t.tarif.toilet.bawaan, t.pemakaiToilet.bagian, t.pemakaiToilet.kepekaan), b.toilet * t.pemakaiToilet.perUnit) * tarif.toilet : 0;
  const sewaKios = ((b.kios + b.toko) * okupansiKios(tarif.sewaKios, op.arusPuncak, cfg) * tarif.sewaKios) / JAM_PER_HARI;

  const pengali = pengaliBiayaKelas(k.kelasTerminal, cfg);
  const biaya: RincianBiaya = {
    gaji: (gajiHarian(k.petugas, cfg) * pengali) / JAM_PER_HARI,
    perawatan: (perawatanHarian(b, k.teknologi, cfg) * pengali) / JAM_PER_HARI,
    listrik: (b.jalur * t.listrik.perJalur * (malam ? t.listrik.pengaliMalam : 1) * pengali) / JAM_PER_HARI,
    gedung: operasionalGedung(k.perluasan, cfg) / JAM_PER_HARI,
  };
  const pendapatan: RincianPendapatan = { layanan, sewaLoket, retribusi, parkir, toilet, sewaKios };
  const totalPendapatan = jumlah(pendapatan);
  const totalBiaya = jumlah(biaya);
  return { pendapatan, biaya, totalPendapatan, totalBiaya, laba: totalPendapatan - totalBiaya };
}

export interface HasilKas {
  /** Kas baru (≥ 0). */
  readonly kas: number;
  /** Jam terminal gaji tertunggak yang belum berbuah petugas berhenti. */
  readonly tunggakanJam: number;
  /** Petugas yang berhenti pada langkah ini (lihat berhentiKasHabis). */
  readonly berhenti: number;
}

/**
 * Kas setelah `dtJam` jam terminal dengan laba per jam ini. Kas tidak pernah
 * minus: bila habis sementara laba masih negatif, gaji tertunggak, dan tiap satu
 * jam terminal tunggakan satu petugas berhenti. Begitu kas kembali bertambah,
 * tunggakan dihapus.
 */
export function majukanKas(kas: number, labaPerJam: number, dtJam: number, tunggakanJam: number): HasilKas {
  if (!(dtJam > 0)) return { kas, tunggakanJam, berhenti: 0 };
  const akhir = kas + labaPerJam * dtJam;
  if (akhir >= 0) return { kas: akhir, tunggakanJam: labaPerJam >= 0 ? 0 : tunggakanJam, berhenti: 0 };
  // Bagian langkah sesudah kas menyentuh nol.
  const jamHabis = labaPerJam < 0 ? dtJam - Math.max(0, kas) / -labaPerJam : 0;
  const tunggakan = tunggakanJam + Math.max(0, jamHabis);
  const berhenti = Math.floor(tunggakan);
  return { kas: 0, tunggakanJam: tunggakan - berhenti, berhenti };
}
