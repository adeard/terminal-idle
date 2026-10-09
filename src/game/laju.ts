/**
 * Menerjemahkan state sim menjadi laju animasi keramaian (orang/detik, bus/detik).
 * Murni visual: tidak memengaruhi uang.
 *
 * Area yang paling lambat (bottleneck) berjalan pada laju dasar, area lain
 * sedikit lebih cepat (sebanding akar rasio kapasitas). Akibatnya antrean
 * orang menumpuk tepat di depan bottleneck, jadi pemain bisa "melihat" macetnya.
 * Banyaknya bus & calon penumpang yang datang mengikuti permintaan jam sibuk
 * di ekonomi (pasar per jurusan, daya tarik kepuasan, event) dibanding
 * kapasitas, lalu ritme jam (terapkanRitme). Jurusan & kelas bus yang datang
 * sebanding bagian penumpangnya (lihat sim/operasi.ts).
 */
import { EKONOMI } from '../config/economy.config';
import { WAKTU } from '../config/waktu.config';
import { KELAS_BUS_IDS, type KelasBusId, type PoId } from '../sim/fitur';
import { dayaTarikTycoon } from '../sim/operasi';
import { jurusanDilayani, loketTerisi, operasiState, pengaliEvent, type GameState } from '../sim/state';
import type { TahapId } from '../sim/tahap';
import { fasilitasAdegan, type FasilitasAdegan } from './fasilitas-adegan';
import { loketBuka } from './kehidupan-malam';
import { jendelaDipakai, kelompokParkirDibangun } from './perluasan-adegan';
import { jurusanDiMask, maskJurusan, MUATAN_BUS, X_LOKET } from './tata-letak';

/** Mitra PO di adegan: bus PO ini datang sebanding bagian penumpangnya, ke jurusannya, dengan kelas busnya. */
export interface PoVisual {
  readonly id: PoId;
  /** Bagian penumpang terminal yang naik bus PO ini (0–1). */
  readonly bagian: number;
  /** Jurusan yang dilayani PO ini (bitmask, bit i = TUJUAN_BUS[i]). */
  readonly maskJurusan: number;
  /** Kelas bus yang dioperasikan PO ini (urut KELAS_BUS_IDS). */
  readonly kelas: readonly KelasBusId[];
}

export interface LajuVisual {
  /** Orang turun dari bus di peron kedatangan. */
  readonly turun: number;
  /** Orang dilayani loket. */
  readonly layanLoket: number;
  /** Orang naik bus di peron keberangkatan. */
  readonly naik: number;
  /** Bus yang masuk terminal per detik (makin besar pasarnya dibanding kapasitas, makin banyak). Bus yang sama nanti berangkat lagi. */
  readonly busDatang: number;
  /** Penumpang per bus (bus datang membawa sebanyak ini, bus berangkat menampung sebanyak ini). */
  readonly muatanBus: number;
  /** Kursi bus untuk penumpang berangkat bila berbeda dari muatan datang (bawaan: muatanBus). */
  readonly kapasitasBus?: number;
  /** Jurusan yang dilayani mitra PO (bitmask, bit i = TUJUAN_BUS[i]); bawaan: semua. */
  readonly maskJurusan?: number;
  /** Jalur bus yang sudah dibangun (halte kedatangan & keberangkatan terdepan); bawaan: semua. */
  readonly jalur?: number;
  /** Kelompok parkir yang sudah dibangun (urut KELOMPOK_PARKIR, lihat perluasan-adegan.ts); bawaan: semua. */
  readonly kelompokParkir?: number;
  /** Jendela loket yang dipakai mitra PO di siang hari (lihat jendelaDipakai); bawaan: semua. */
  readonly jendela?: number;
  /** Mitra PO terdaftar: bus terminal yang muncul milik salah satunya; bawaan: tanpa PO (livery & jurusan bawaan). */
  readonly po?: readonly PoVisual[];
  /** Bus Emas (hadiah iklan) sedang bisa diketuk: bus berwarna emas lewat di jalan raya. */
  readonly busEmas?: boolean;
  /** Indeks jendela loket yang buka (malam hari separuh tutup); bawaan: semua. */
  readonly loketBuka?: readonly number[];
  /** Jam terminal (0–24): jam buka toko & kios dan waktu sholat untuk penumpang yang mampir; bawaan: 12. */
  readonly jam?: number;
  /**
   * Bangunan yang dipakai penumpang (blok kursi, kios & toko per unit, toilet,
   * lahan parkir; lihat fasilitas-adegan.ts); bawaan: semuanya ada.
   */
  readonly fasilitas?: FasilitasAdegan;
  /** Bagian penumpang tiap jurusan (indeks TUJUAN_BUS) & kelas bus (lihat sim/operasi.ts); bawaan: sama rata. */
  readonly bagianJurusan?: readonly number[];
  readonly bagianKelas?: Readonly<Record<KelasBusId, number>>;
  /** Pengali kecepatan & manuver bus (1 = normal). */
  readonly faktorKecepatanBus: number;
}

/**
 * Arus dasar paling tinggi (orang/detik). Orang berjalan dengan laju alami
 * (KECEPATAN_JALAN), jadi arus dibatasi di bawah daya tampung jalan kaki:
 * calon penumpang datang ±1,3 × arus dasar, sedangkan antrean dua baris di
 * labirin hanya bisa maju ±2,8 orang/detik. Lebih tinggi dari ini, antrean
 * akan menumpuk di tahap yang bukan bottleneck (hambatan palsu).
 */
export const LAJU_MAKS = 1.8;
const RASIO_MAKS = 2;
/**
 * Calon penumpang di jam tersibuk dibanding kemampuan terminal = permintaan jam
 * sibuk ÷ kapasitas area paling lambat, dijepit di rentang ini: di atas batas
 * atas antrean di adegan menumpuk tanpa henti, di bawah batas bawah terminal
 * tampak kosong. Terminal yang dibangun melebihi pasarnya tampak lengang.
 */
const TARIK = { min: 0.3, maks: 1.6 } as const;
const PERMINTAAN = 0.93;

/**
 * Arus dasar paling tinggi per jendela loket yang buka di siang hari (orang/detik).
 * Dengan transaksi natural (±2,5 detik + melangkah maju) satu jendela sanggup
 * ±0,24 orang/detik, jadi terminal dengan sedikit loket tampak lebih sepi dan
 * makin ramai tiap loket baru disewa PO (sampai semua jendela yang sudah
 * dibangun terpakai). Semua tahap ikut diskalakan, jadi bottleneck tetap
 * terlihat di tempatnya.
 */
export const ARUS_PER_JENDELA = 0.24;

/** Batas arus dasar (orang/detik) dari jendela loket yang dipakai di siang hari. */
export function batasArusLoket(jendela: number = X_LOKET.length): number {
  return ARUS_PER_JENDELA * loketBuka(12, jendela).length;
}

/** Jurusan yang dilayani mitra PO terdaftar sebagai bitmask (lihat tata-letak.ts MASK_SEMUA_JURUSAN). */
export function maskJurusanState(state: GameState): number {
  return maskJurusan(jurusanDilayani(state));
}

/** Orang/detik dasar dari arus (pnp per detik main), naik logaritmik lalu dibatasi. */
export function lajuDasar(pnpPerDetik: number): number {
  return Math.min(LAJU_MAKS, 0.45 + 0.3 * Math.log2(1 + Math.max(0, pnpPerDetik)));
}

export function hitungLajuVisual(state: GameState): LajuVisual {
  const op = operasiState(state);
  const kap = op.kapasitas;
  // Kapasitas rantai penumpang yang terlihat (pnp per jam terminal); pangkalan tidak punya zona sendiri.
  const potensial = Math.max(1e-6, Math.min(kap.peron, kap.loket, kap.keberangkatan));
  const mask = maskJurusanState(state);
  const perluasan = state.perkembangan.perluasan;
  const jendela = jendelaDipakai(perluasan, loketTerisi(state));
  const dasar = Math.min(lajuDasar(potensial / WAKTU.detikPerJam), batasArusLoket(jendela));
  const laju = (id: TahapId): number => dasar * Math.min(RASIO_MAKS, Math.sqrt(kap[id] / potensial));
  const permintaan = op.permintaanPuncak * dayaTarikTycoon(op.kepuasan.nilai) * pengaliEvent(state);
  const tarik = Math.min(TARIK.maks, Math.max(TARIK.min, permintaan / potensial));
  // Bagian penumpang tiap PO, jurusan, & kelas bus dari arus segmen sekarang.
  const totalArus = op.arus;
  const bagianJurusan = new Array<number>(EKONOMI.jurusan.length).fill(0);
  const bagianKelas = Object.fromEntries(KELAS_BUS_IDS.map((k) => [k, 0])) as Record<KelasBusId, number>;
  for (const s of op.segmen) {
    if (!(totalArus > 0)) break;
    bagianJurusan[s.jurusan]! += s.arus / totalArus;
    bagianKelas[s.kelas] += s.arus / totalArus;
  }
  const po = state.mitra.terdaftar.map((p, i): PoVisual => {
    const segmen = op.segmen.filter((s) => s.po === p.id);
    let maskPo = 0;
    for (const j of new Set(segmen.map((s) => s.jurusan))) if (!jurusanDiMask(maskPo, j)) maskPo += 2 ** j;
    const kelas = KELAS_BUS_IDS.filter((k) => segmen.some((s) => s.kelas === k));
    return { id: p.id, bagian: totalArus > 0 ? (op.po[i]?.arus ?? 0) / totalArus : 0, maskJurusan: maskPo, kelas };
  });

  const muatanBus = Math.round(Math.min(MUATAN_BUS.maks, Math.max(MUATAN_BUS.min, 8 + dasar * 6)));
  return {
    turun: laju('peron'),
    layanLoket: laju('loket'),
    naik: laju('keberangkatan'),
    busDatang: (dasar * PERMINTAAN * tarik) / muatanBus,
    muatanBus,
    faktorKecepatanBus: 1 + Math.min(0.8, Math.max(0, dasar - 1.4) / 7),
    maskJurusan: mask,
    jalur: state.terminal.bangunan.jalur,
    kelompokParkir: kelompokParkirDibangun(perluasan),
    jendela,
    po,
    fasilitas: fasilitasAdegan(state.terminal.bangunan),
    ...(totalArus > 0 ? { bagianJurusan, bagianKelas } : {}),
  };
}

/** Muatan bus paling sedikit saat terminal sepi (dini hari). */
const MUATAN_SEPI = 6;

/**
 * Ritme harian (lihat sim/waktu.ts keramaianTerminal): sepi di dini hari,
 * padat di jam sibuk. Hanya permintaan yang ikut ritme: bus datang lebih
 * jarang dan lebih kosong, jadi calon penumpang juga lebih sedikit. Kapasitas
 * tiap tahap tetap, sehingga antrean menumpuk di bottleneck saat jam sibuk
 * (permintaan > kapasitas) lalu surut kembali saat sepi.
 */
export function terapkanRitme(laju: LajuVisual, keramaian: number): LajuVisual {
  const f = Math.min(1, Math.max(0, keramaian));
  const muatanBus = Math.max(MUATAN_SEPI, Math.round(laju.muatanBus * (0.45 + 0.55 * f)));
  // Orang/detik yang dibawa bus = busDatang × muatan, ikut turun sebanding keramaian.
  // Kursinya tetap: bus yang datang kosong tetap bisa berangkat penuh, jadi penumpang
  // sisa jam sibuk di ruang tunggu tetap terangkut walau bus jarang.
  return {
    ...laju,
    muatanBus,
    kapasitasBus: laju.kapasitasBus ?? laju.muatanBus,
    busDatang: (laju.busDatang * laju.muatanBus * f) / muatanBus,
  };
}
