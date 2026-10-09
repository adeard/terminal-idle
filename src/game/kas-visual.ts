/**
 * Efek "+Rp" di adegan (murni, tanpa DOM & three.js): uang yang benar-benar
 * masuk menurut sim dibagikan ke transaksi yang terlihat di keramaian.
 *
 * Sim menghitung pendapatan sebagai arus (Rp per jam terminal), sedangkan
 * keramaian hanya wakil arus itu (dibatasi & dipadatkan, lihat laju.ts). Jadi
 * uang tiap sumber dikumpulkan, lalu dilepas sebagai "+Rp" pada transaksi yang
 * terlihat dari sumber yang paling dekat: bus parkir di petak (retribusi),
 * kendaraan pengantar parkir, dan penumpang selesai belanja di kios & toko
 * (sewa kios & toko). Penumpang tidak membayar terminal: di jendela loket yang
 * tampil jumlah tiket yang dibeli (dari PO), bukan uang, dan sewa jendela loket
 * (harian dari PO) tidak dimunculkan. Besar tiap "+Rp" = pendapatan per detik ÷ rata-rata transaksi
 * per detik (jadi tidak melonjak-lonjak walau transaksinya datang tak teratur),
 * ditambah sedikit koreksi dari selisih yang terkumpul. Totalnya tetap sama
 * dengan pendapatan, dan angkanya ikut membesar saat terminal berkembang.
 *
 * Angka yang tampil dibulatkan (dua angka penting) dan baru berganti bila
 * sasarannya bergeser cukup jauh, jadi "+Rp" berturut-turut sama besar: tidak
 * terlihat seperti harga yang berbeda-beda. Tiap orang di keramaian mewakili
 * beberapa penumpang sim, jadi "+Rp" di loket bukan harga satu tiket.
 */
import { WAKTU } from '../config/waktu.config';
import { keuanganSekarang, type GameState } from '../sim/state';
import type { JenisTransaksi, TransaksiVisual } from './dunia-visual';

/** Transaksi yang membawa uang ke terminal (tiket di loket dibayar ke PO, lihat atas). */
export type JenisPopUang = Exclude<JenisTransaksi, 'tiket'>;

export interface PopUang {
  readonly jenis: JenisPopUang;
  readonly x: number;
  readonly y: number;
  /** Rp. */
  readonly jumlah: number;
}

/** Pendapatan per detik main tiap sumber (sudah × boost); nol = sumbernya belum ada. */
export type LajuUang = Readonly<Record<JenisPopUang, number>>;

export const JENIS_UANG: readonly JenisPopUang[] = ['retribusi', 'parkir', 'belanja'];

/** Pendapatan per detik main tiap sumber yang terlihat, seperti yang masuk ke kas tiap tick (× boost). */
export function lajuUangState(state: GameState): LajuUang {
  const p = keuanganSekarang(state).pendapatan;
  const perDetik = (rpPerJam: number): number => rpPerJam / WAKTU.detikPerJam;
  return {
    retribusi: perDetik(p.retribusi),
    parkir: perDetik(p.parkir),
    belanja: perDetik(p.sewaKios),
  };
}

/**
 * Lompatan waktu main lebih dari ini dalam satu frame (muat save, ganti akun,
 * tab tertidur lalu mengejar) tidak dibagikan: sudah masuk laporan offline.
 */
export const LOMPATAN_MAKS_DETIK = 2;
/** "+Rp" di bawah Rp 1 ditahan dulu (tidak tampil "+Rp 0"). */
export const POP_MIN = 1;
/**
 * Rata-rata transaksi per detik dihitung dari ±sekian transaksi terakhir
 * (rata-rata bergerak), dalam rentang waktu RENTANG_RATA detik.
 */
const TRANSAKSI_RATA = 12;
const RENTANG_RATA = { min: 15, maks: 150 } as const;
/** Selisih yang terkumpul (lebih/kurang) dikoreksi dalam ±sekian transaksi. */
const TRANSAKSI_KOREKSI = 8;
/** Angka "+Rp" yang tampil baru berganti bila sasarannya bergeser lebih dari porsi ini. */
const BEDA_GANTI = 0.12;

/** Dibulatkan ke dua angka penting (6.123 → 6.100, 21.437 → 21.000). */
export function bulatkanPop(x: number): number {
  if (!(x > 0)) return 0;
  const langkah = Math.pow(10, Math.floor(Math.log10(x)) - 1);
  return Math.round(x / langkah) * langkah;
}

interface Sumber {
  /** Uang yang masuk tapi belum tampil (bisa sedikit negatif: tampil lebih dulu, dikoreksi pop berikutnya). */
  terkumpul: number;
  /** Rata-rata bergerak transaksi per detik & bobotnya (koreksi awal rata-rata yang masih sedikit datanya). */
  frek: number;
  bobot: number;
  /** Besar "+Rp" yang sedang tampil (0 = belum ada). */
  tampil: number;
}

export class KasVisual {
  private readonly sumber = new Map<JenisPopUang, Sumber>(JENIS_UANG.map((j) => [j, { terkumpul: 0, frek: 0, bobot: 0, tampil: 0 }]));
  private detikLalu: number | null = null;

  /**
   * @param detikMain waktu main state sekarang (statistik.waktuMainDetik); uang dihitung dari selisihnya
   * @param dtKeramaian detik main keramaian sejak frame lalu (state hanya maju tiap tick 0,1 detik,
   *   keramaian tiap frame; frekuensi transaksi diukur dengan waktu keramaian)
   * @param laju pendapatan per detik main tiap sumber
   * @param transaksi transaksi yang terjadi di keramaian sejak frame lalu
   */
  perbarui(detikMain: number, dtKeramaian: number, laju: LajuUang, transaksi: readonly TransaksiVisual[]): PopUang[] {
    const dt = this.detikLalu === null ? 0 : detikMain - this.detikLalu;
    this.detikLalu = detikMain;
    const wajar = dt >= 0 && dt <= LOMPATAN_MAKS_DETIK;
    const dtK = Math.max(0, dtKeramaian);
    const pop: PopUang[] = [];
    if (!wajar) {
      for (const s of this.sumber.values()) s.terkumpul = 0;
      return pop;
    }
    for (const j of JENIS_UANG) {
      const s = this.sumber.get(j)!;
      const l = laju[j];
      if (l > 0 && dt > 0) s.terkumpul += l * dt;
      if (!(dtK > 0)) continue;
      const t = transaksi.filter((x) => x.jenis === j);
      // Rata-rata transaksi per detik: jendela ±TRANSAKSI_RATA transaksi (lebih lama untuk sumber yang jarang).
      const lama = s.bobot > 0 ? s.frek / s.bobot : 0;
      const tau = Math.min(RENTANG_RATA.maks, Math.max(RENTANG_RATA.min, lama > 0 ? TRANSAKSI_RATA / lama : RENTANG_RATA.maks));
      const a = 1 - Math.exp(-dtK / tau);
      s.frek += a * (t.length / dtK - s.frek);
      s.bobot += a * (1 - s.bobot);
      if (t.length === 0) continue;
      const frek = s.frek / s.bobot;
      const sasaran = l / frek + s.terkumpul / TRANSAKSI_KOREKSI;
      if (!(sasaran >= POP_MIN)) continue;
      // Angka bulat yang tetap sampai sasarannya bergeser jauh; selisihnya terbawa di `terkumpul`.
      if (!(s.tampil >= POP_MIN) || Math.abs(sasaran - s.tampil) > s.tampil * BEDA_GANTI) s.tampil = Math.max(POP_MIN, bulatkanPop(sasaran));
      const per = s.tampil;
      for (const x of t) pop.push({ jenis: j, x: x.x, y: x.y, jumlah: per });
      s.terkumpul -= per * t.length;
    }
    return pop;
  }

  /** Uang sumber ini yang masuk tapi belum tampil (untuk tes). */
  sisa(jenis: JenisPopUang): number {
    return this.sumber.get(jenis)!.terkumpul;
  }
}
