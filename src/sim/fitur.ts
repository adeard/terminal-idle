/**
 * Daftar id fitur pengelolaan terminal: modernisasi, target harian,
 * pencapaian, mitra PO, kelas bus, event, dan (tycoon) bangunan, petugas,
 * tarif. Angka tuning-nya ada di economy.config.ts.
 */

/** Modernisasi: pembelian sekali, menambah kapasitas satu area (dua per area, berurutan). */
export const TEKNOLOGI_IDS = ['rambuHalte', 'pengaturBus', 'mesinTiket', 'eTiket', 'jadwalDigital', 'gateOtomatis'] as const;
export type TeknologiId = (typeof TEKNOLOGI_IDS)[number];

/** Jenis target harian (bergantian tiap hari terminal): berangkatkan penumpang, atau raih laba bersih. */
export type JenisTarget = 'penumpang' | 'laba';

/** Pencapaian (penghargaan terminal), urut kira-kira dari yang paling awal diraih. */
export const PENCAPAIAN_IDS = [
  'petugasPertama',
  'fasilitasPertama',
  'targetPertama',
  'manajerOperasional',
  'sepekan',
  'jalurLima',
  'jurusanSemua',
  'kelasB',
  'tanpaRugi',
  'penumpang100rb',
  'antarpulau',
  'fasilitasLengkap',
  'modernLengkap',
  'kasMiliar',
  'kelasA',
  'armadaLengkap',
  'loketPenuh',
  'terpadu',
  'penumpangSejuta',
  'lintasNusantara',
] as const;
export type PencapaianId = (typeof PENCAPAIAN_IDS)[number];

/**
 * Mitra PO (perusahaan otobus, nama fiktif). PO didaftarkan ke slot terminal,
 * menyewa loket, dan membawa jurusan, kelas bus, serta bus berlivery-nya
 * sendiri (lihat sim/mitra.ts & EKONOMI.mitra). Data tiap PO di EKONOMI.mitra.po.
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
 * Kelas bus, urut dari yang paling sederhana. Tiap PO mengoperasikan kelas
 * yang terbuka seiring levelnya, dibatasi tingkat PO dan kelas terminal
 * (lihat kelasAktif di sim/mitra.ts).
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

export function isTeknologiId(nilai: unknown): nilai is TeknologiId {
  return typeof nilai === 'string' && (TEKNOLOGI_IDS as readonly string[]).includes(nilai);
}

export function isPencapaianId(nilai: unknown): nilai is PencapaianId {
  return typeof nilai === 'string' && (PENCAPAIAN_IDS as readonly string[]).includes(nilai);
}

// ---------------------------------------------------------------------------
// Bangunan, petugas, tarif (documents/13-rancangan-tycoon.md)

/**
 * Bangunan yang dibangun di slot denah: jalur = halte kedatangan + gerbang
 * keberangkatan; jendela = jendela loket yang disewa PO; kursi = blok kursi
 * ruang tunggu; kios & toko (minimarket, apotek) disewakan.
 */
export const BANGUNAN_IDS = ['jalur', 'jendela', 'kursi', 'kios', 'toko', 'toilet', 'lahanParkir', 'posRetribusi'] as const;
export type BangunanId = (typeof BANGUNAN_IDS)[number];

/** Peran petugas bergaji (menggantikan Kepala). */
export const PETUGAS_IDS = ['peron', 'gerbang', 'kebersihan', 'satpam', 'juruParkir', 'petugasToilet', 'petugasRetribusi', 'manajerOperasional', 'manajerKemitraan'] as const;
export type PetugasId = (typeof PETUGAS_IDS)[number];

/** Tarif terminal yang diatur pemain (harga tiket diatur PO sendiri). */
export const TARIF_IDS = ['layanan', 'sewaLoket', 'retribusiBus', 'parkir', 'toilet', 'sewaKios'] as const;
export type TarifId = (typeof TARIF_IDS)[number];

export function isBangunanId(nilai: unknown): nilai is BangunanId {
  return typeof nilai === 'string' && (BANGUNAN_IDS as readonly string[]).includes(nilai);
}

export function isPetugasId(nilai: unknown): nilai is PetugasId {
  return typeof nilai === 'string' && (PETUGAS_IDS as readonly string[]).includes(nilai);
}

export function isTarifId(nilai: unknown): nilai is TarifId {
  return typeof nilai === 'string' && (TARIF_IDS as readonly string[]).includes(nilai);
}
