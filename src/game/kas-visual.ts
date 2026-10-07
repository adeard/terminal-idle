/**
 * Efek "+Rp" di adegan (murni, tanpa DOM & three.js): uang yang benar-benar
 * masuk menurut sim dibagikan ke transaksi yang terlihat di keramaian.
 *
 * Sim menghitung pendapatan sebagai arus (Rp/detik), sedangkan keramaian hanya
 * wakil arus itu (dibatasi & dipadatkan, lihat laju.ts). Jadi uang tiap sumber
 * dikumpulkan, lalu dilepas sebagai "+Rp" pada transaksi yang terlihat dari
 * sumber yang sama: tiket terjual di jendela loket, bus parkir di petak
 * (retribusi), kendaraan pengantar parkir, dan penumpang selesai belanja di
 * kios & toko. Besar tiap "+Rp" = pendapatan per detik ÷ rata-rata transaksi
 * per detik (jadi tidak melonjak-lonjak walau transaksinya datang tak teratur),
 * ditambah sedikit koreksi dari selisih yang terkumpul. Totalnya tetap sama
 * dengan uang yang masuk, dan angkanya ikut membesar saat terminal berkembang.
 * Sewa kios yang dibayar saat hari berganti tampil sebagai satu "+Rp" besar di
 * deretan kios.
 */
import Decimal from 'break_infinity.js';
import { pengaliBoost, rincianPendapatan, type GameState } from '../sim/state';
import type { JenisTransaksi, TransaksiVisual } from './dunia-visual';

export type JenisPopUang = JenisTransaksi | 'sewa';

export interface PopUang {
  readonly jenis: JenisPopUang;
  readonly x: number;
  readonly y: number;
  readonly jumlah: Decimal;
}

/** Pendapatan per detik main tiap sumber (sudah × boost); nol = sumbernya belum ada. */
export type LajuUang = Readonly<Record<JenisTransaksi, Decimal>>;

export const JENIS_TRANSAKSI: readonly JenisTransaksi[] = ['tiket', 'retribusi', 'parkir', 'belanja'];

/** Pendapatan per detik tiap sumber seperti yang dijumlahkan tick (arus nyata × boost). */
export function lajuUangState(state: GameState): LajuUang {
  const r = rincianPendapatan(state, 'aktif');
  const boost = pengaliBoost(state);
  return { tiket: r.tiket.times(boost), retribusi: r.retribusi.times(boost), parkir: r.parkir.times(boost), belanja: r.sewaKios.times(boost) };
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

const NOL = new Decimal(0);

interface Sumber {
  /** Uang yang masuk tapi belum tampil (bisa sedikit negatif: tampil lebih dulu, dikoreksi pop berikutnya). */
  terkumpul: Decimal;
  /** Rata-rata bergerak transaksi per detik & bobotnya (koreksi awal rata-rata yang masih sedikit datanya). */
  frek: number;
  bobot: number;
}

export class KasVisual {
  private readonly sumber = new Map<JenisTransaksi, Sumber>(JENIS_TRANSAKSI.map((j) => [j, { terkumpul: NOL, frek: 0, bobot: 0 }]));
  private detikLalu: number | null = null;
  private hariSewa: number | null = null;

  /**
   * @param detikMain waktu main state sekarang (statistik.waktuMainDetik); uang dihitung dari selisihnya
   * @param dtKeramaian detik main keramaian sejak frame lalu (state hanya maju tiap tick 0,1 detik,
   *   keramaian tiap frame; frekuensi transaksi diukur dengan waktu keramaian)
   * @param laju pendapatan per detik main tiap sumber
   * @param transaksi transaksi yang terjadi di keramaian sejak frame lalu
   * @param sewa sewa kios terakhir yang dibayar (state.sewaKios)
   * @param tempatSewa posisi "+Rp" sewa kios
   */
  perbarui(
    detikMain: number,
    dtKeramaian: number,
    laju: LajuUang,
    transaksi: readonly TransaksiVisual[],
    sewa: { readonly hariTerakhir: number; readonly terakhir: Decimal },
    tempatSewa: readonly [number, number],
  ): PopUang[] {
    const dt = this.detikLalu === null ? 0 : detikMain - this.detikLalu;
    this.detikLalu = detikMain;
    const wajar = dt >= 0 && dt <= LOMPATAN_MAKS_DETIK;
    const dtK = Math.max(0, dtKeramaian);
    const pop: PopUang[] = [];

    const hariBaru = this.hariSewa !== null && sewa.hariTerakhir !== this.hariSewa;
    this.hariSewa = sewa.hariTerakhir;
    if (hariBaru) {
      // Belanja hari kemarin sudah dibayar sebagai sewa; mulai kumpulkan dari nol lagi.
      this.sumber.get('belanja')!.terkumpul = NOL;
      if (wajar && sewa.terakhir.gte(POP_MIN)) pop.push({ jenis: 'sewa', x: tempatSewa[0], y: tempatSewa[1], jumlah: sewa.terakhir });
    }
    if (!wajar) {
      for (const s of this.sumber.values()) s.terkumpul = NOL;
      return pop;
    }
    for (const j of JENIS_TRANSAKSI) {
      const s = this.sumber.get(j)!;
      const l = laju[j];
      if (l.gt(0) && dt > 0) s.terkumpul = s.terkumpul.add(l.times(dt));
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
      const per = l.div(frek).add(s.terkumpul.div(TRANSAKSI_KOREKSI));
      if (per.lt(POP_MIN)) continue;
      for (const x of t) pop.push({ jenis: j, x: x.x, y: x.y, jumlah: per });
      s.terkumpul = s.terkumpul.sub(per.times(t.length));
    }
    return pop;
  }

  /** Uang sumber ini yang masuk tapi belum tampil (untuk tes). */
  sisa(jenis: JenisTransaksi): Decimal {
    return this.sumber.get(jenis)!.terkumpul;
  }
}
