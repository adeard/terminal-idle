/**
 * Serialisasi/deserialisasi GameState. TypeScript murni: tidak menyentuh
 * storage sama sekali (itu tugas platform/), hanya string ⇄ state.
 *
 * Aturan kompatibilitas:
 * - Field wajib (uang, terminal.tahap) yang hilang/salah tipe → save ditolak.
 * - Blok opsional yang HILANG diisi default (supaya fitur baru bisa menambah
 *   field tanpa naik versi). Blok yang ADA tapi salah tipe → save ditolak.
 * - Field tak dikenal diabaikan.
 * - Perubahan bentuk yang tidak additive: naikkan VERSI_SKEMA dan tambah
 *   fungsi di MIGRASI.
 */
import Decimal from 'break_infinity.js';
import { EKONOMI, type KonfigEkonomi } from '../config/economy.config';
import { FASILITAS_IDS, isEventId, isPencapaianId, isPoId, KELAS_BUS_IDS, TEKNOLOGI_IDS, type FasilitasId, type KelasBusId, type PencapaianId, type PoId, type TeknologiId } from './fitur';
import { buatHargaAwal, buatRekorAwal, buatStateBaru, buatTahapAwal, buatTantanganAwal, ID_TERMINAL_AWAL, rapikanHarga, rapikanTambahan, type RekorState, type TantanganAktif, type TantanganState, type ArmadaState, type EventState, type GameState, type HadiahState, type HargaState, type HarianState, type SewaKiosState, type PencapaianState, type ProfilState, type TahapState, type TransaksiState } from './state';
import { rapikanNamaTerminal } from './profil';
import { isJenisTantangan } from './tantangan';
import { TAHAP_IDS, type TahapId } from './tahap';
import { waktuTerminal } from './waktu';

export const VERSI_SKEMA = 1;

/** Bentuk JSON save versi 1. Semua Decimal disimpan sebagai string "<mantissa>e<exponent>". */
export interface SaveV1 {
  readonly schemaVersion: 1;
  readonly waktuTerakhirMs: number;
  readonly uang: string;
  readonly terminal: {
    readonly id: string;
    readonly tahap: Record<TahapId, { readonly level: number; readonly kepala: { readonly direkrut: boolean } }>;
    readonly fasilitas: Record<FasilitasId, number>;
    readonly jurusanBuka: number;
    readonly teknologi: Record<TeknologiId, boolean>;
    /** Kelas bus yang beroperasi. Save lama tanpa blok ini: ekonomi saja. */
    readonly kelasBus?: Record<KelasBusId, boolean>;
    /** Jalur bus yang beroperasi. Save lama tanpa field ini: sesuai tonggak level yang sudah dicapai. */
    readonly jalur?: number;
  };
  readonly prestige: { readonly poin: string; readonly jumlahReset: number };
  readonly statistik: {
    readonly totalPendapatanRun: string;
    readonly totalPendapatanSepanjangMasa: string;
    readonly waktuMainDetik: number;
    readonly totalPenumpang: number;
  };
  readonly harian: HarianState;
  readonly pencapaian: { readonly tercapai: readonly string[]; readonly diklaim: readonly string[] };
  /** Benih jadwal hujan. Save lama tanpa field ini diberi benih baru saat dimuat. */
  readonly benihCuaca: number;
  /** Sewa kios yang terkumpul hari ini & sewa terakhir. Save lama tanpa blok ini mulai dari 0. */
  readonly sewaKios?: { readonly terkumpul: string; readonly terakhir: string; readonly hariTerakhir: number };
  /** Boost & Bus Emas yang sedang berjalan. Save lama tanpa blok ini mulai tanpa boost. */
  readonly hadiah?: { readonly boostDetik: number; readonly busEmas: { readonly tungguDetik: number; readonly aktifDetik: number; readonly jumlah: number } };
  /** Mitra PO yang sudah bergabung. Save lama tanpa blok ini mulai tanpa PO (yang syaratnya terpenuhi bergabung di tick pertama). */
  readonly armada?: { readonly po: readonly string[] };
  /** Harga tiket (persen harga normal): harga tiap jurusan & tambahan tiap kelas bus. Save lama tanpa blok ini: semua normal. */
  readonly harga?: { readonly jurusan: readonly number[]; readonly tambahanKelas: Record<KelasBusId, number> };
  /** Sisa penumpang/bus yang belum jadi transaksi utuh. Save lama tanpa blok ini: nol. */
  readonly transaksi?: { readonly sisaPenumpang: number; readonly sisaBus: number };
  /** Rekor pribadi & hitungan hari ini. Save lama tanpa blok ini mulai dari nol. */
  readonly rekor?: RekorState;
  /** Tantangan mingguan. Save lama tanpa blok ini: tantangan dimulai saat sesi berjalan. */
  readonly tantangan?: { readonly minggu: string | null; readonly selesaiMs: number; readonly daftar: readonly TantanganAktif[]; readonly penumpang?: number };
  /** Profil pemain (nama terminal). Save lama tanpa blok ini: nama bawaan. */
  readonly profil?: { readonly namaTerminal: string; readonly ikutPeringkat?: boolean };
  /** Event musiman: edisi yang sedang/terakhir diikuti, progres & tahap yang diklaim. Save lama tanpa blok ini mulai tanpa event. */
  readonly event?: {
    readonly aktif: { readonly id: string; readonly edisi: string; readonly selesaiMs: number } | null;
    readonly edisi: string | null;
    readonly progres: number;
    readonly diklaim: number;
    readonly target: readonly number[];
  };
}

type DataMentah = Record<string, unknown>;
export type FungsiMigrasi = (data: DataMentah) => DataMentah;

/** MIGRASI[n] mengubah data mentah versi n menjadi versi n + 1. */
export const MIGRASI: Readonly<Record<number, FungsiMigrasi>> = {};

export class SaveTidakValidError extends Error {
  constructor(pesan: string) {
    super(pesan);
    this.name = 'SaveTidakValidError';
  }
}

export type HasilMuat =
  | { readonly status: 'baru'; readonly state: GameState }
  | { readonly status: 'dimuat'; readonly state: GameState }
  | { readonly status: 'korup'; readonly state: GameState; readonly error: unknown };

// ---------------------------------------------------------------------------
// Decimal ⇄ string

/**
 * `Decimal.toString()` tidak selalu round-trip persis (sudah dicek: ±1 ulp
 * di mantissa), jadi mantissa & exponent ditulis langsung.
 */
export function decimalKeString(d: Decimal): string {
  return `${d.mantissa}e${d.exponent}`;
}

const POLA_ANGKA = /^-?\d+(\.\d+)?(e[+-]?\d+)?$/i;

export function stringKeDecimal(nilai: unknown, jalur: string): Decimal {
  if (typeof nilai !== 'string' || !POLA_ANGKA.test(nilai)) {
    throw new SaveTidakValidError(`${jalur}: bukan string angka`);
  }
  const d = new Decimal(nilai);
  if (!Number.isFinite(d.mantissa) || !Number.isFinite(d.exponent) || d.lt(0)) {
    throw new SaveTidakValidError(`${jalur}: angka tidak valid (${nilai})`);
  }
  return d;
}

// ---------------------------------------------------------------------------
// Serialisasi

export function keSaveV1(state: GameState): SaveV1 {
  const tahap = {} as Record<TahapId, { level: number; kepala: { direkrut: boolean } }>;
  for (const id of TAHAP_IDS) {
    const t = state.terminal.tahap[id];
    tahap[id] = { level: t.level, kepala: { direkrut: t.kepala.direkrut } };
  }
  return {
    schemaVersion: VERSI_SKEMA,
    waktuTerakhirMs: state.waktuTerakhirMs,
    uang: decimalKeString(state.uang),
    terminal: {
      id: state.terminal.id,
      tahap,
      fasilitas: { ...state.terminal.fasilitas },
      jurusanBuka: state.terminal.jurusanBuka,
      teknologi: { ...state.terminal.teknologi },
      kelasBus: { ...state.terminal.kelasBus },
      jalur: state.terminal.jalur,
    },
    prestige: { poin: decimalKeString(state.prestige.poin), jumlahReset: state.prestige.jumlahReset },
    statistik: {
      totalPendapatanRun: decimalKeString(state.statistik.totalPendapatanRun),
      totalPendapatanSepanjangMasa: decimalKeString(state.statistik.totalPendapatanSepanjangMasa),
      waktuMainDetik: state.statistik.waktuMainDetik,
      totalPenumpang: state.statistik.totalPenumpang,
    },
    harian: { ...state.harian },
    pencapaian: { tercapai: [...state.pencapaian.tercapai], diklaim: [...state.pencapaian.diklaim] },
    benihCuaca: state.benihCuaca,
    hadiah: { boostDetik: state.hadiah.boostDetik, busEmas: { ...state.hadiah.busEmas } },
    sewaKios: { terkumpul: decimalKeString(state.sewaKios.terkumpul), terakhir: decimalKeString(state.sewaKios.terakhir), hariTerakhir: state.sewaKios.hariTerakhir },
    armada: { po: [...state.armada.po] },
    harga: { jurusan: [...state.harga.jurusan], tambahanKelas: { ...state.harga.tambahanKelas } },
    transaksi: { ...state.transaksi },
    event: { ...state.event, aktif: state.event.aktif ? { ...state.event.aktif } : null, target: [...state.event.target] },
    profil: { namaTerminal: state.profil.namaTerminal, ikutPeringkat: state.profil.ikutPeringkat },
    rekor: { ...state.rekor },
    tantangan: { ...state.tantangan, daftar: state.tantangan.daftar.map((x) => ({ ...x })) },
  };
}

/** Panggil `tandaiWaktu(state, sekarang)` dulu supaya timestamp offline akurat. */
export function serialisasi(state: GameState): string {
  return JSON.stringify(keSaveV1(state));
}

// ---------------------------------------------------------------------------
// Deserialisasi

/**
 * @param sekarangMs dipakai sebagai waktuTerakhirMs kalau field itu tidak ada
 *   (artinya: tidak ada penghasilan offline untuk sesi itu).
 * @throws SaveTidakValidError kalau data korup atau versinya tidak didukung.
 */
export function deserialisasi(json: string, sekarangMs: number, cfg: KonfigEkonomi = EKONOMI): GameState {
  let mentah: unknown;
  try {
    mentah = JSON.parse(json);
  } catch (e) {
    throw new SaveTidakValidError(`JSON tidak valid: ${(e as Error).message}`);
  }
  const akar = wajibObjek(mentah, 'save');
  const versi = akar['schemaVersion'];
  if (typeof versi !== 'number' || !Number.isInteger(versi) || versi < 1) {
    throw new SaveTidakValidError('schemaVersion tidak valid');
  }
  if (versi > VERSI_SKEMA) {
    throw new SaveTidakValidError(`schemaVersion ${versi} lebih baru dari yang didukung (${VERSI_SKEMA})`);
  }
  return dariSaveV1(migrasikan(akar, versi), sekarangMs, cfg);
}

/**
 * Parse string save mentah dari storage. Tidak pernah throw: save kosong →
 * game baru, save korup → game baru + error (pemanggil yang me-log).
 */
export function muatAtauBaru(
  raw: string | null | undefined,
  sekarangMs: number,
  cfg: KonfigEkonomi = EKONOMI,
): HasilMuat {
  if (raw == null || raw === '') return { status: 'baru', state: buatStateBaru(sekarangMs, cfg) };
  try {
    return { status: 'dimuat', state: deserialisasi(raw, sekarangMs, cfg) };
  } catch (error) {
    return { status: 'korup', state: buatStateBaru(sekarangMs, cfg), error };
  }
}

export function migrasikan(
  data: DataMentah,
  dariVersi: number,
  daftarMigrasi: Readonly<Record<number, FungsiMigrasi>> = MIGRASI,
  keVersi: number = VERSI_SKEMA,
): DataMentah {
  let hasil = data;
  for (let v = dariVersi; v < keVersi; v++) {
    const f = daftarMigrasi[v];
    if (!f) throw new SaveTidakValidError(`tidak ada migrasi dari versi ${v}`);
    hasil = { ...f(hasil), schemaVersion: v + 1 };
  }
  return hasil;
}

function dariSaveV1(akar: DataMentah, sekarangMs: number, cfg: KonfigEkonomi): GameState {
  const awal = buatStateBaru(sekarangMs, cfg);

  const terminalMentah = wajibObjek(akar['terminal'], 'terminal');
  const tahapMentah = wajibObjek(terminalMentah['tahap'], 'terminal.tahap');
  const tahap = {} as Record<TahapId, TahapState>;
  for (const id of TAHAP_IDS) {
    // Tahap yang belum ada di save lama (mis. tahap baru di masa depan) mulai dari awal.
    tahap[id] = tahapMentah[id] === undefined ? buatTahapAwal() : bacaTahap(tahapMentah[id], `terminal.tahap.${id}`);
  }

  const prestigeMentah = opsionalObjek(akar['prestige'], 'prestige');
  const statistikMentah = opsionalObjek(akar['statistik'], 'statistik');
  // Fitur pengelolaan (fasilitas, jurusan, modernisasi, target, pencapaian): save lama tanpa blok ini mulai dari awal.
  const fasilitasMentah = opsionalObjek(terminalMentah['fasilitas'], 'terminal.fasilitas');
  const teknologiMentah = opsionalObjek(terminalMentah['teknologi'], 'terminal.teknologi');
  const kelasBusMentah = opsionalObjek(terminalMentah['kelasBus'], 'terminal.kelasBus');
  const fasilitas = { ...awal.terminal.fasilitas };
  for (const id of FASILITAS_IDS) fasilitas[id] = opsional(fasilitasMentah?.[id], 0, wajibIntegerNonNegatif, `terminal.fasilitas.${id}`);
  const teknologi = { ...awal.terminal.teknologi };
  for (const id of TEKNOLOGI_IDS) teknologi[id] = opsional(teknologiMentah?.[id], false, wajibBoolean, `terminal.teknologi.${id}`);
  const kelasBus = { ...awal.terminal.kelasBus };
  // Ekonomi selalu beroperasi.
  for (const id of KELAS_BUS_IDS) kelasBus[id] = id === 'ekonomi' || opsional(kelasBusMentah?.[id], false, wajibBoolean, `terminal.kelasBus.${id}`);
  // Save dari sebelum ada jalur: terminalnya tidak menyusut, jalur mengikuti tonggak level yang sudah dicapai.
  const jalurMaks = 1 + cfg.jalur.biaya.length;
  const jalurSimpan = terminalMentah['jalur'];
  const jalur =
    jalurSimpan === undefined
      ? Math.min(jalurMaks, 1 + cfg.milestone.filter((m) => Math.min(tahap.peron.level, tahap.keberangkatan.level) >= m).length)
      : Math.min(jalurMaks, Math.max(1, wajibIntegerNonNegatif(jalurSimpan, 'terminal.jalur')));
  const jurusanBuka = Math.min(
    cfg.jurusan.length,
    Math.max(cfg.jurusanAwal, opsional(terminalMentah['jurusanBuka'], cfg.jurusanAwal, wajibIntegerNonNegatif, 'terminal.jurusanBuka')),
  );

  return {
    uang: stringKeDecimal(akar['uang'], 'uang'),
    terminal: {
      id: opsional(terminalMentah['id'], ID_TERMINAL_AWAL, wajibString, 'terminal.id'),
      tahap,
      fasilitas,
      jurusanBuka,
      teknologi,
      kelasBus,
      jalur,
    },
    prestige: prestigeMentah
      ? {
          poin: opsional(prestigeMentah['poin'], awal.prestige.poin, stringKeDecimal, 'prestige.poin'),
          jumlahReset: opsional(prestigeMentah['jumlahReset'], 0, wajibIntegerNonNegatif, 'prestige.jumlahReset'),
        }
      : awal.prestige,
    statistik: statistikMentah
      ? {
          totalPendapatanRun: opsional(
            statistikMentah['totalPendapatanRun'],
            awal.statistik.totalPendapatanRun,
            stringKeDecimal,
            'statistik.totalPendapatanRun',
          ),
          totalPendapatanSepanjangMasa: opsional(
            statistikMentah['totalPendapatanSepanjangMasa'],
            awal.statistik.totalPendapatanSepanjangMasa,
            stringKeDecimal,
            'statistik.totalPendapatanSepanjangMasa',
          ),
          waktuMainDetik: opsional(
            statistikMentah['waktuMainDetik'],
            0,
            wajibAngkaNonNegatif,
            'statistik.waktuMainDetik',
          ),
          totalPenumpang: opsional(statistikMentah['totalPenumpang'], 0, wajibAngkaNonNegatif, 'statistik.totalPenumpang'),
        }
      : awal.statistik,
    harian: bacaHarian(akar['harian'], awal.harian),
    pencapaian: bacaPencapaian(akar['pencapaian']),
    benihCuaca: opsional(akar['benihCuaca'], awal.benihCuaca, wajibIntegerNonNegatif, 'benihCuaca'),
    hadiah: bacaHadiah(akar['hadiah'], awal.hadiah),
    sewaKios: bacaSewaKios(akar['sewaKios'], awal.sewaKios),
    armada: bacaArmada(akar['armada']),
    harga: bacaHarga(akar['harga'], cfg),
    transaksi: bacaTransaksi(akar['transaksi'], cfg),
    event: bacaEvent(akar['event'], awal.event),
    profil: bacaProfil(akar['profil']),
    rekor: bacaRekor(akar['rekor'], statistikMentah ? opsional(statistikMentah['waktuMainDetik'], 0, wajibAngkaNonNegatif, 'statistik.waktuMainDetik') : 0),
    tantangan: bacaTantangan(akar['tantangan']),
    waktuTerakhirMs: opsional(akar['waktuTerakhirMs'], sekarangMs, wajibAngkaNonNegatif, 'waktuTerakhirMs'),
  };
}

function bacaHarian(nilai: unknown, bawaan: HarianState): HarianState {
  const o = opsionalObjek(nilai, 'harian');
  if (!o) return bawaan;
  const jenis = o['jenis'];
  if (jenis !== 'upgrade' && jenis !== 'penumpang') throw new SaveTidakValidError('harian.jenis tidak dikenal');
  return {
    hariKe: wajibIntegerNonNegatif(o['hariKe'], 'harian.hariKe'),
    jenis,
    target: wajibAngkaNonNegatif(o['target'], 'harian.target'),
    progres: wajibAngkaNonNegatif(o['progres'], 'harian.progres'),
    diklaim: wajibBoolean(o['diklaim'], 'harian.diklaim'),
    jumlahSelesai: opsional(o['jumlahSelesai'], 0, wajibIntegerNonNegatif, 'harian.jumlahSelesai'),
  };
}

function bacaSewaKios(nilai: unknown, bawaan: SewaKiosState): SewaKiosState {
  const o = opsionalObjek(nilai, 'sewaKios');
  if (!o) return bawaan;
  return {
    terkumpul: opsional(o['terkumpul'], bawaan.terkumpul, stringKeDecimal, 'sewaKios.terkumpul'),
    terakhir: opsional(o['terakhir'], bawaan.terakhir, stringKeDecimal, 'sewaKios.terakhir'),
    hariTerakhir: typeof o['hariTerakhir'] === 'number' && Number.isSafeInteger(o['hariTerakhir']) ? o['hariTerakhir'] : bawaan.hariTerakhir,
  };
}

function bacaHadiah(nilai: unknown, bawaan: HadiahState): HadiahState {
  const o = opsionalObjek(nilai, 'hadiah');
  if (!o) return bawaan;
  const b = opsionalObjek(o['busEmas'], 'hadiah.busEmas');
  return {
    boostDetik: opsional(o['boostDetik'], 0, wajibAngkaNonNegatif, 'hadiah.boostDetik'),
    busEmas: b
      ? {
          tungguDetik: opsional(b['tungguDetik'], bawaan.busEmas.tungguDetik, wajibAngkaNonNegatif, 'hadiah.busEmas.tungguDetik'),
          aktifDetik: opsional(b['aktifDetik'], 0, wajibAngkaNonNegatif, 'hadiah.busEmas.aktifDetik'),
          jumlah: opsional(b['jumlah'], 0, wajibIntegerNonNegatif, 'hadiah.busEmas.jumlah'),
        }
      : bawaan.busEmas,
    bonusOffline: bawaan.bonusOffline,
  };
}

/** Mitra PO; id yang tidak dikenal (mis. dari versi lain) diabaikan, urutan bergabung dipertahankan. */
function bacaArmada(nilai: unknown): ArmadaState {
  const o = opsionalObjek(nilai, 'armada');
  const po = o?.['po'];
  if (po === undefined) return { po: [] };
  if (!Array.isArray(po)) throw new SaveTidakValidError('armada.po: harus array');
  return { po: [...new Set(po.filter(isPoId))] as PoId[] };
}

/**
 * Harga tiket; yang tidak ada (save lama, jurusan baru di config) = normal. Nilai di luar
 * batas atau bukan kelipatan langkah (config berubah) dirapikan, bukan ditolak.
 */
function bacaHarga(nilai: unknown, cfg: KonfigEkonomi): HargaState {
  const o = opsionalObjek(nilai, 'harga');
  const awal = buatHargaAwal(cfg);
  if (!o) return awal;
  const jurusan = o['jurusan'] === undefined ? [] : o['jurusan'];
  if (!Array.isArray(jurusan)) throw new SaveTidakValidError('harga.jurusan: harus array');
  const tambahanMentah = opsionalObjek(o['tambahanKelas'], 'harga.tambahanKelas');
  const tambahanKelas = { ...awal.tambahanKelas };
  for (const id of KELAS_BUS_IDS) tambahanKelas[id] = rapikanTambahan(opsional(tambahanMentah?.[id], 0, wajibAngkaNonNegatif, `harga.tambahanKelas.${id}`), cfg);
  return {
    jurusan: awal.jurusan.map((bawaan, i) => (jurusan[i] === undefined ? bawaan : rapikanHarga(wajibAngkaNonNegatif(jurusan[i], `harga.jurusan.${i}`), cfg))),
    tambahanKelas,
  };
}

/** Sisa transaksi yang belum utuh (lihat TransaksiState); save lama mulai dari nol. */
function bacaTransaksi(nilai: unknown, cfg: KonfigEkonomi): TransaksiState {
  const o = opsionalObjek(nilai, 'transaksi');
  return {
    sisaPenumpang: Math.min(0.999999, opsional(o?.['sisaPenumpang'], 0, wajibAngkaNonNegatif, 'transaksi.sisaPenumpang')),
    sisaBus: Math.min(cfg.penumpangPerBus - 1e-6, opsional(o?.['sisaBus'], 0, wajibAngkaNonNegatif, 'transaksi.sisaBus')),
  };
}

/** Rekor; save lama mulai dari nol di hari terminal sekarang. */
function bacaRekor(nilai: unknown, waktuMainDetik: number): RekorState {
  const o = opsionalObjek(nilai, 'rekor');
  const awal = buatRekorAwal(waktuTerminal(waktuMainDetik).hariKe);
  if (!o) return awal;
  const angka = (k: keyof RekorState): number => opsional(o[k], awal[k], wajibAngkaNonNegatif, `rekor.${k}`);
  return {
    hariKe: opsional(o['hariKe'], awal.hariKe, wajibIntegerNonNegatif, 'rekor.hariKe'),
    penumpangHariIni: angka('penumpangHariIni'),
    pendapatanHariIni: angka('pendapatanHariIni'),
    penumpangHarian: angka('penumpangHarian'),
    pendapatanHarian: angka('pendapatanHarian'),
    arusTertinggi: angka('arusTertinggi'),
  };
}

/** Tantangan mingguan; jenis yang tidak dikenal (mis. dari versi lain) dibuang. */
function bacaTantangan(nilai: unknown): TantanganState {
  const o = opsionalObjek(nilai, 'tantangan');
  if (!o) return buatTantanganAwal();
  const minggu = o['minggu'];
  const daftar = o['daftar'] === undefined ? [] : o['daftar'];
  if (!Array.isArray(daftar)) throw new SaveTidakValidError('tantangan.daftar: harus array');
  return {
    minggu: minggu === null || minggu === undefined ? null : wajibString(minggu, 'tantangan.minggu'),
    selesaiMs: opsional(o['selesaiMs'], 0, wajibAngkaNonNegatif, 'tantangan.selesaiMs'),
    daftar: daftar
      .map((x, i) => wajibObjek(x, `tantangan.daftar.${i}`))
      .filter((x) => isJenisTantangan(x['jenis']))
      .map((x, i): TantanganAktif => ({
        jenis: x['jenis'] as TantanganAktif['jenis'],
        target: wajibAngkaNonNegatif(x['target'], `tantangan.daftar.${i}.target`),
        progres: wajibAngkaNonNegatif(x['progres'], `tantangan.daftar.${i}.progres`),
        diklaim: wajibBoolean(x['diklaim'], `tantangan.daftar.${i}.diklaim`),
      })),
    penumpang: opsional(o['penumpang'], 0, wajibAngkaNonNegatif, 'tantangan.penumpang'),
  };
}

/** Profil: nama terminal dirapikan lagi (save dari versi lain / diubah tangan). Save lama: belum ikut papan peringkat. */
function bacaProfil(nilai: unknown): ProfilState {
  const o = opsionalObjek(nilai, 'profil');
  const nama = o?.['namaTerminal'];
  if (nama !== undefined && typeof nama !== 'string') throw new SaveTidakValidError('profil.namaTerminal: harus string');
  return {
    namaTerminal: nama === undefined ? '' : rapikanNamaTerminal(nama),
    ikutPeringkat: opsional(o?.['ikutPeringkat'], false, wajibBoolean, 'profil.ikutPeringkat'),
  };
}

/** Event musiman; event yang tidak dikenal (mis. dari versi lain) dianggap tidak berlangsung. */
function bacaEvent(nilai: unknown, bawaan: EventState): EventState {
  const o = opsionalObjek(nilai, 'event');
  if (!o) return bawaan;
  const a = o['aktif'] === null || o['aktif'] === undefined ? null : wajibObjek(o['aktif'], 'event.aktif');
  const id = a?.['id'];
  const target = o['target'] === undefined ? [] : o['target'];
  if (!Array.isArray(target)) throw new SaveTidakValidError('event.target: harus array');
  const edisi = o['edisi'];
  return {
    aktif: a && isEventId(id) ? { id, edisi: wajibString(a['edisi'], 'event.aktif.edisi'), selesaiMs: wajibAngkaNonNegatif(a['selesaiMs'], 'event.aktif.selesaiMs') } : null,
    edisi: edisi === null || edisi === undefined ? null : wajibString(edisi, 'event.edisi'),
    progres: opsional(o['progres'], 0, wajibAngkaNonNegatif, 'event.progres'),
    diklaim: opsional(o['diklaim'], 0, wajibIntegerNonNegatif, 'event.diklaim'),
    target: target.map((t, i) => wajibAngkaNonNegatif(t, `event.target.${i}`)),
  };
}

/** Daftar id pencapaian; id yang tidak dikenal (mis. dari versi lain) diabaikan. */
function bacaPencapaian(nilai: unknown): PencapaianState {
  const o = opsionalObjek(nilai, 'pencapaian');
  const daftar = (v: unknown, jalur: string): PencapaianId[] => {
    if (v === undefined) return [];
    if (!Array.isArray(v)) throw new SaveTidakValidError(`${jalur}: harus array`);
    return [...new Set(v.filter(isPencapaianId))];
  };
  return { tercapai: daftar(o?.['tercapai'], 'pencapaian.tercapai'), diklaim: daftar(o?.['diklaim'], 'pencapaian.diklaim') };
}

function bacaTahap(nilai: unknown, jalur: string): TahapState {
  const o = wajibObjek(nilai, jalur);
  const level = wajibIntegerNonNegatif(o['level'], `${jalur}.level`);
  if (level < 1) throw new SaveTidakValidError(`${jalur}.level harus ≥ 1`);
  const kepalaMentah = opsionalObjek(o['kepala'], `${jalur}.kepala`);
  const direkrut = kepalaMentah
    ? opsional(kepalaMentah['direkrut'], false, wajibBoolean, `${jalur}.kepala.direkrut`)
    : false;
  return { level, kepala: { direkrut } };
}

// ---------------------------------------------------------------------------
// Validator kecil

function wajibObjek(nilai: unknown, jalur: string): DataMentah {
  if (typeof nilai !== 'object' || nilai === null || Array.isArray(nilai)) {
    throw new SaveTidakValidError(`${jalur}: harus objek`);
  }
  return nilai as DataMentah;
}

function opsionalObjek(nilai: unknown, jalur: string): DataMentah | null {
  return nilai === undefined ? null : wajibObjek(nilai, jalur);
}

function opsional<T>(nilai: unknown, bawaan: T, baca: (v: unknown, jalur: string) => T, jalur: string): T {
  return nilai === undefined ? bawaan : baca(nilai, jalur);
}

function wajibString(nilai: unknown, jalur: string): string {
  if (typeof nilai !== 'string' || nilai === '') throw new SaveTidakValidError(`${jalur}: harus string`);
  return nilai;
}

function wajibBoolean(nilai: unknown, jalur: string): boolean {
  if (typeof nilai !== 'boolean') throw new SaveTidakValidError(`${jalur}: harus boolean`);
  return nilai;
}

function wajibAngkaNonNegatif(nilai: unknown, jalur: string): number {
  if (typeof nilai !== 'number' || !Number.isFinite(nilai) || nilai < 0) {
    throw new SaveTidakValidError(`${jalur}: harus angka ≥ 0`);
  }
  return nilai;
}

function wajibIntegerNonNegatif(nilai: unknown, jalur: string): number {
  const n = wajibAngkaNonNegatif(nilai, jalur);
  if (!Number.isSafeInteger(n)) throw new SaveTidakValidError(`${jalur}: harus bilangan bulat`);
  return n;
}
