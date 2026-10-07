/**
 * Daftar fitur pengelolaan terminal di luar tiga tahap: fasilitas pendapatan
 * sampingan, modernisasi (teknologi), target harian, dan pencapaian.
 * Angka tuning-nya ada di economy.config.ts.
 */

/** Fasilitas penunjang: tiap level menambah pendapatan per penumpang yang berangkat. */
export const FASILITAS_IDS = ['kios', 'parkir', 'toilet', 'retribusi'] as const;
export type FasilitasId = (typeof FASILITAS_IDS)[number];

/** Modernisasi: pembelian sekali, menambah kapasitas satu tahap (dua per tahap, berurutan). */
export const TEKNOLOGI_IDS = ['rambuHalte', 'pengaturBus', 'mesinTiket', 'eTiket', 'jadwalDigital', 'gateOtomatis'] as const;
export type TeknologiId = (typeof TEKNOLOGI_IDS)[number];

/** Jenis target harian (bergantian tiap hari terminal). */
export type JenisTarget = 'upgrade' | 'penumpang';

/** Pencapaian (penghargaan terminal), urut kira-kira dari yang paling awal diraih. */
export const PENCAPAIAN_IDS = [
  'kepalaPertama',
  'fasilitasPertama',
  'semuaOtomatis',
  'targetPertama',
  'level25',
  'penumpang100rb',
  'sepekan',
  'fasilitasLengkap',
  'jalurLengkap',
  'jurusanSemua',
  'antarpulau',
  'kelasB',
  'modernLengkap',
  'level100',
  'kelasA',
  'armadaLengkap',
  'penumpang10jt',
  'lintasNusantara',
] as const;
export type PencapaianId = (typeof PENCAPAIAN_IDS)[number];

/**
 * Mitra PO (perusahaan otobus, nama fiktif) yang beroperasi di terminal. Tiap
 * PO yang bergabung menaikkan harga tiket dan menambah bus berlivery-nya ke
 * armada di adegan. Permanen: tidak ikut direset saat naik kelas terminal.
 */
export const PO_IDS = [
  'lumpiaKilat',
  'bakpiaRasa',
  'wayangLestari',
  'arekEkspres',
  'apelBatu',
  'kecakLaju',
  'sigerSakti',
  'rinjaniIndah',
  'rumahGadang',
  'danauToba',
  'kopiGayo',
  'ondelOndel',
  'peuyeumKilat',
  'teloletJaya',
  'sultanGarasi',
  'juaraKelas',
  'juaraUmum',
  'mudikCeria',
  'merahPutih',
  'kembangApi',
] as const;
export type PoId = (typeof PO_IDS)[number];

/**
 * Kelas bus armada terminal, urut dari yang paling sederhana. Ekonomi sudah ada
 * sejak awal; kelas lain didatangkan berurutan (dibeli) dan menaikkan harga
 * tiket. Diulang dari awal saat naik kelas terminal, seperti jurusan.
 */
export const KELAS_BUS_IDS = ['ekonomi', 'patas', 'eksekutif', 'sleeper', 'tingkat'] as const;
export type KelasBusId = (typeof KELAS_BUS_IDS)[number];

export function isKelasBusId(nilai: unknown): nilai is KelasBusId {
  return typeof nilai === 'string' && (KELAS_BUS_IDS as readonly string[]).includes(nilai);
}

/** Event musiman (lihat sim/event.ts untuk kalendernya). */
export const EVENT_IDS = ['mudikLebaran', 'hutRi', 'nataru'] as const;
export type EventId = (typeof EVENT_IDS)[number];

export function isEventId(nilai: unknown): nilai is EventId {
  return typeof nilai === 'string' && (EVENT_IDS as readonly string[]).includes(nilai);
}

export function isPoId(nilai: unknown): nilai is PoId {
  return typeof nilai === 'string' && (PO_IDS as readonly string[]).includes(nilai);
}

export function isFasilitasId(nilai: unknown): nilai is FasilitasId {
  return typeof nilai === 'string' && (FASILITAS_IDS as readonly string[]).includes(nilai);
}

export function isTeknologiId(nilai: unknown): nilai is TeknologiId {
  return typeof nilai === 'string' && (TEKNOLOGI_IDS as readonly string[]).includes(nilai);
}

export function isPencapaianId(nilai: unknown): nilai is PencapaianId {
  return typeof nilai === 'string' && (PENCAPAIAN_IDS as readonly string[]).includes(nilai);
}
