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
 *
 * Versi 2 = ekonomi mitra PO (documents/12-rancangan-ekonomi-po.md, bagian 13
 * untuk migrasi dari versi 1).
 */
import Decimal from 'break_infinity.js';
import { EKONOMI, type KonfigEkonomi } from '../config/economy.config';
import { FASILITAS_IDS, isEventId, isPencapaianId, isPoId, KELAS_BUS_IDS, PO_IDS, TEKNOLOGI_IDS, type FasilitasId, type PencapaianId, type PoId, type TeknologiId } from './fitur';
import { kelasDariLevel, levelMinimalKelas, levelTerminalDariXp, slotPo, xpKumulatifTerminal } from './level-terminal';
import { tingkatPo, xpKumulatifPo } from './mitra';
import { bonusJatahPerluasan } from './perluasan';
import {
  aturLevelLoket,
  buatMitraAwal,
  buatRekorAwal,
  buatStateBaru,
  buatTahapAwal,
  buatTantanganAwal,
  DETIK_SEHARI,
  ID_TERMINAL_AWAL,
  rapikanHarga,
  type EventState,
  type GameState,
  type HadiahState,
  type HargaPo,
  type HarianState,
  type MitraState,
  type PencapaianState,
  type PerkembanganState,
  type PoTerdaftar,
  type ProfilState,
  type RekorState,
  type RenovasiState,
  type RiwayatPo,
  type SewaKiosState,
  type TahapState,
  type TantanganAktif,
  type TantanganState,
  type TransaksiState,
} from './state';
import { rapikanNamaTerminal } from './profil';
import { isJenisTantangan } from './tantangan';
import { TAHAP_IDS, type TahapId } from './tahap';
import { waktuTerminal } from './waktu';

export const VERSI_SKEMA = 2;

/** PO terdaftar di save. */
export interface SimpanPo {
  readonly id: string;
  readonly xp: number;
  readonly loket: number;
  readonly rekorLoket: number;
  readonly reputasi: number;
  /** Indeks jurusan → persen harga normal. */
  readonly harga: Readonly<Record<string, number>>;
  readonly kontrakDetik: number;
}

/** Bentuk JSON save versi 2. Semua Decimal disimpan sebagai string "<mantissa>e<exponent>". */
export interface SaveV2 {
  readonly schemaVersion: 2;
  readonly waktuTerakhirMs: number;
  readonly uang: string;
  readonly terminal: {
    readonly id: string;
    /** Level Loket dihitung ulang dari loket PO + loket kosong saat dimuat. */
    readonly tahap: Record<TahapId, { readonly level: number; readonly kepala: { readonly direkrut: boolean } }>;
    readonly fasilitas: Record<FasilitasId, number>;
    readonly teknologi: Record<TeknologiId, boolean>;
    readonly jalur: number;
    readonly loketKosong: number;
  };
  readonly mitra: {
    readonly terdaftar: readonly SimpanPo[];
    readonly riwayat: Readonly<Record<string, Omit<SimpanPo, 'id' | 'loket' | 'kontrakDetik'>>>;
    readonly jedaSampai: Readonly<Record<string, number>>;
    readonly hadiahEvent: readonly string[];
  };
  readonly perkembangan: PerkembanganState;
  readonly renovasi: { readonly poin: string; readonly jumlah: number };
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
export const MIGRASI: Readonly<Record<number, FungsiMigrasi>> = {
  1: (d) => migrasiV1keV2(d),
};

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

const simpanHarga = (h: HargaPo): Record<string, number> => {
  const hasil: Record<string, number> = {};
  for (const [j, persen] of Object.entries(h)) if (persen !== undefined) hasil[j] = persen;
  return hasil;
};

export function keSaveV2(state: GameState): SaveV2 {
  const tahap = {} as Record<TahapId, { level: number; kepala: { direkrut: boolean } }>;
  for (const id of TAHAP_IDS) {
    const t = state.terminal.tahap[id];
    tahap[id] = { level: t.level, kepala: { direkrut: t.kepala.direkrut } };
  }
  const riwayat: Record<string, Omit<SimpanPo, 'id' | 'loket' | 'kontrakDetik'>> = {};
  for (const [id, r] of Object.entries(state.mitra.riwayat)) {
    if (r) riwayat[id] = { xp: r.xp, reputasi: r.reputasi, rekorLoket: r.rekorLoket, harga: simpanHarga(r.harga) };
  }
  const jedaSampai: Record<string, number> = {};
  for (const [id, detik] of Object.entries(state.mitra.jedaSampai)) if (detik !== undefined) jedaSampai[id] = detik;
  return {
    schemaVersion: VERSI_SKEMA,
    waktuTerakhirMs: state.waktuTerakhirMs,
    uang: decimalKeString(state.uang),
    terminal: {
      id: state.terminal.id,
      tahap,
      fasilitas: { ...state.terminal.fasilitas },
      teknologi: { ...state.terminal.teknologi },
      jalur: state.terminal.jalur,
      loketKosong: state.terminal.loketKosong,
    },
    mitra: {
      terdaftar: state.mitra.terdaftar.map((p) => ({ id: p.id, xp: p.xp, loket: p.loket, rekorLoket: p.rekorLoket, reputasi: p.reputasi, harga: simpanHarga(p.harga), kontrakDetik: p.kontrakDetik })),
      riwayat,
      jedaSampai,
      hadiahEvent: [...state.mitra.hadiahEvent],
    },
    perkembangan: { ...state.perkembangan },
    renovasi: { poin: decimalKeString(state.renovasi.poin), jumlah: state.renovasi.jumlah },
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
    transaksi: { ...state.transaksi },
    event: { ...state.event, aktif: state.event.aktif ? { ...state.event.aktif } : null, target: [...state.event.target] },
    profil: { namaTerminal: state.profil.namaTerminal, ikutPeringkat: state.profil.ikutPeringkat },
    rekor: { ...state.rekor },
    tantangan: { ...state.tantangan, daftar: state.tantangan.daftar.map((x) => ({ ...x })) },
  };
}

/** Panggil `tandaiWaktu(state, sekarang)` dulu supaya timestamp offline akurat. */
export function serialisasi(state: GameState): string {
  return JSON.stringify(keSaveV2(state));
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
  return dariSaveV2(migrasikan(akar, versi), sekarangMs, cfg);
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

// ---------------------------------------------------------------------------
// Migrasi v1 → v2 (ekonomi mitra PO)

const objekAtauNull = (v: unknown): DataMentah | null => (typeof v === 'object' && v !== null && !Array.isArray(v) ? (v as DataMentah) : null);
const angkaAtau = (v: unknown, bawaan: number): number => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : bawaan);

/**
 * Save v1 (prestige naik kelas, jurusan & kelas bus dibeli, harga per jurusan)
 * → v2. Pemain lama tidak boleh dirugikan:
 * - level terminal = dari total penumpang, tapi minimal setara kelasnya (Tipe B → 10, …);
 *   tahap perluasan sampai level itu langsung jadi;
 * - mitra PO yang sudah bergabung: yang nilainya tertinggi menempati slot, sisanya riwayat;
 *   level awal PO cukup untuk kelas bus yang sudah dibeli DAN untuk menampung loket lama,
 *   jadi kapasitas Loket tidak turun;
 * - poin & jumlah prestige → poin & jumlah Renovasi (bonusnya sama);
 * - harga tiket kembali normal; kontrak baru 14 hari terminal.
 * Data mentah yang aneh dibiarkan; dariSaveV2 yang memvalidasi hasilnya.
 */
export function migrasiV1keV2(d: DataMentah, cfg: KonfigEkonomi = EKONOMI): DataMentah {
  const terminal = objekAtauNull(d['terminal']) ?? {};
  const tahap = objekAtauNull(terminal['tahap']) ?? {};
  const levelLoketV1 = Math.max(1, Math.floor(angkaAtau(objekAtauNull(tahap['loket'])?.['level'], 1)));
  const prestige = objekAtauNull(d['prestige']);
  const kelasV1 = Math.floor(angkaAtau(prestige?.['jumlahReset'], 0));
  const totalPenumpang = angkaAtau(objekAtauNull(d['statistik'])?.['totalPenumpang'], 0);

  const xpTerminal = Math.max(totalPenumpang, xpKumulatifTerminal(levelMinimalKelas(kelasV1, cfg), cfg));
  const level = levelTerminalDariXp(xpTerminal, cfg);
  const perluasan = cfg.mitra.perluasan.filter((t) => t.level <= level).length;
  const kelasTerminal = kelasDariLevel(level, cfg);

  const armada = objekAtauNull(d['armada']);
  const poV1 = Array.isArray(armada?.['po']) ? [...new Set((armada['po'] as unknown[]).filter(isPoId))] : [];
  const hadiahEvent = poV1.filter((id) => cfg.mitra.po[id].sumber === 'hadiahEvent');
  const calon: PoId[] = poV1.length > 0 ? poV1 : PO_IDS.filter((id) => cfg.mitra.po[id].sumber === 'awal');
  // PO bernilai tertinggi (biaya daftar sebagai patokan tingkatnya) menempati slot lebih dulu.
  const urut = [...calon].sort((a, b) => cfg.mitra.po[b].biayaDaftar - cfg.mitra.po[a].biayaDaftar);
  const slot = Math.max(1, slotPo(level, perluasan, cfg));
  const terdaftarId = urut.slice(0, slot);

  const kelasBusV1 = objekAtauNull(terminal['kelasBus']);
  const levelKelasBus = (id: PoId): number => {
    let lv = 1;
    KELAS_BUS_IDS.forEach((k, i) => {
      if (i < tingkatPo(id, cfg).kelasMaks && kelasBusV1?.[k] === true && cfg.kelasBus[k].kelasTerminal <= kelasTerminal) lv = Math.max(lv, cfg.mitra.kelas[k].levelPo);
    });
    return lv;
  };
  const bonus = bonusJatahPerluasan(perluasan, cfg);
  const m = cfg.mitra;
  const levelUntukJatah = (n: number): number => (n <= m.jatahAwal + bonus ? 1 : 1 + Math.ceil((n - m.jatahAwal - bonus) / m.jatahPerLevel));
  const totalLoket = Math.max(levelLoketV1, terdaftarId.length);
  const terdaftar: SimpanPo[] = terdaftarId.map((id, i) => {
    const loket = Math.floor(totalLoket / terdaftarId.length) + (i < totalLoket % terdaftarId.length ? 1 : 0);
    const lv = Math.max(levelKelasBus(id), levelUntukJatah(loket));
    return { id, xp: xpKumulatifPo(lv, cfg), loket, rekorLoket: loket, reputasi: tingkatPo(id, cfg).reputasiAwal, harga: {}, kontrakDetik: m.kontrak.hariHadiah * DETIK_SEHARI };
  });
  const riwayat: Record<string, Omit<SimpanPo, 'id' | 'loket' | 'kontrakDetik'>> = {};
  for (const id of urut.slice(slot)) riwayat[id] = { xp: xpKumulatifPo(levelKelasBus(id), cfg), reputasi: tingkatPo(id, cfg).reputasiAwal, rekorLoket: 0, harga: {} };

  const { jurusanBuka: _jurusan, kelasBus: _kelasBus, ...terminalBaru } = terminal;
  const { armada: _armada, harga: _harga, prestige: _prestige, ...sisa } = d;
  return {
    ...sisa,
    terminal: { ...terminalBaru, loketKosong: 0 },
    mitra: { terdaftar, riwayat, jedaSampai: {}, hadiahEvent },
    perkembangan: { xpTerminal, perluasan, proyekDetik: 0 },
    renovasi: { poin: typeof prestige?.['poin'] === 'string' ? prestige['poin'] : '0e0', jumlah: kelasV1 },
  };
}

// ---------------------------------------------------------------------------
// Baca save v2

function dariSaveV2(akar: DataMentah, sekarangMs: number, cfg: KonfigEkonomi): GameState {
  const awal = buatStateBaru(sekarangMs, cfg);

  const terminalMentah = wajibObjek(akar['terminal'], 'terminal');
  const tahapMentah = wajibObjek(terminalMentah['tahap'], 'terminal.tahap');
  const tahap = {} as Record<TahapId, TahapState>;
  for (const id of TAHAP_IDS) {
    // Tahap yang belum ada di save lama (mis. tahap baru di masa depan) mulai dari awal.
    tahap[id] = tahapMentah[id] === undefined ? buatTahapAwal() : bacaTahap(tahapMentah[id], `terminal.tahap.${id}`);
  }

  const statistikMentah = opsionalObjek(akar['statistik'], 'statistik');
  const fasilitasMentah = opsionalObjek(terminalMentah['fasilitas'], 'terminal.fasilitas');
  const teknologiMentah = opsionalObjek(terminalMentah['teknologi'], 'terminal.teknologi');
  const fasilitas = { ...awal.terminal.fasilitas };
  for (const id of FASILITAS_IDS) fasilitas[id] = opsional(fasilitasMentah?.[id], 0, wajibIntegerNonNegatif, `terminal.fasilitas.${id}`);
  const teknologi = { ...awal.terminal.teknologi };
  for (const id of TEKNOLOGI_IDS) teknologi[id] = opsional(teknologiMentah?.[id], false, wajibBoolean, `terminal.teknologi.${id}`);
  // Save dari sebelum ada jalur: terminalnya tidak menyusut, jalur mengikuti tonggak level yang sudah dicapai.
  const jalurMaks = 1 + cfg.jalur.biaya.length;
  const jalurSimpan = terminalMentah['jalur'];
  const jalur =
    jalurSimpan === undefined
      ? Math.min(jalurMaks, 1 + cfg.milestone.filter((m) => Math.min(tahap.peron.level, tahap.keberangkatan.level) >= m).length)
      : Math.min(jalurMaks, Math.max(1, wajibIntegerNonNegatif(jalurSimpan, 'terminal.jalur')));
  const mitra = bacaMitra(akar['mitra'], cfg);
  const perkembangan = bacaPerkembangan(akar['perkembangan'], cfg);

  const waktuMainDetik = statistikMentah ? opsional(statistikMentah['waktuMainDetik'], 0, wajibAngkaNonNegatif, 'statistik.waktuMainDetik') : 0;
  return {
    uang: stringKeDecimal(akar['uang'], 'uang'),
    terminal: aturLevelLoket(
      {
        id: opsional(terminalMentah['id'], ID_TERMINAL_AWAL, wajibString, 'terminal.id'),
        tahap,
        fasilitas,
        teknologi,
        jalur,
        loketKosong: opsional(terminalMentah['loketKosong'], 0, wajibIntegerNonNegatif, 'terminal.loketKosong'),
      },
      mitra,
    ),
    mitra,
    perkembangan,
    renovasi: bacaRenovasi(akar['renovasi'], awal.renovasi),
    statistik: statistikMentah
      ? {
          totalPendapatanRun: opsional(statistikMentah['totalPendapatanRun'], awal.statistik.totalPendapatanRun, stringKeDecimal, 'statistik.totalPendapatanRun'),
          totalPendapatanSepanjangMasa: opsional(statistikMentah['totalPendapatanSepanjangMasa'], awal.statistik.totalPendapatanSepanjangMasa, stringKeDecimal, 'statistik.totalPendapatanSepanjangMasa'),
          waktuMainDetik,
          totalPenumpang: opsional(statistikMentah['totalPenumpang'], 0, wajibAngkaNonNegatif, 'statistik.totalPenumpang'),
        }
      : awal.statistik,
    harian: bacaHarian(akar['harian'], awal.harian),
    pencapaian: bacaPencapaian(akar['pencapaian']),
    benihCuaca: opsional(akar['benihCuaca'], awal.benihCuaca, wajibIntegerNonNegatif, 'benihCuaca'),
    hadiah: bacaHadiah(akar['hadiah'], awal.hadiah),
    sewaKios: bacaSewaKios(akar['sewaKios'], awal.sewaKios),
    transaksi: bacaTransaksi(akar['transaksi'], cfg),
    event: bacaEvent(akar['event'], awal.event),
    profil: bacaProfil(akar['profil']),
    rekor: bacaRekor(akar['rekor'], waktuMainDetik),
    tantangan: bacaTantangan(akar['tantangan']),
    waktuTerakhirMs: opsional(akar['waktuTerakhirMs'], sekarangMs, wajibAngkaNonNegatif, 'waktuTerakhirMs'),
  };
}

/** Harga PO: kunci = indeks jurusan; di luar daftar jurusan dibuang, nilainya dirapikan (config bisa berubah), 100 tidak disimpan. */
function bacaHargaPo(nilai: unknown, jalur: string, cfg: KonfigEkonomi): HargaPo {
  const o = opsionalObjek(nilai, jalur);
  if (!o) return {};
  const hasil: Record<number, number> = {};
  for (const [kunci, v] of Object.entries(o)) {
    const j = Number(kunci);
    if (!Number.isInteger(j) || j < 0 || j >= cfg.jurusan.length) continue;
    const h = rapikanHarga(wajibAngkaNonNegatif(v, `${jalur}.${kunci}`), cfg);
    if (h !== 100) hasil[j] = h;
  }
  return hasil;
}

const reputasiAman = (v: number): number => Math.min(100, Math.max(0, v));

function bacaPoTerdaftar(nilai: unknown, jalur: string, cfg: KonfigEkonomi): PoTerdaftar | null {
  const o = wajibObjek(nilai, jalur);
  const id = o['id'];
  // PO yang tidak dikenal (mis. dari versi lain) diabaikan.
  if (!isPoId(id)) return null;
  const loket = wajibIntegerNonNegatif(o['loket'], `${jalur}.loket`);
  return {
    id,
    xp: wajibAngkaNonNegatif(o['xp'], `${jalur}.xp`),
    loket,
    rekorLoket: Math.max(loket, opsional(o['rekorLoket'], loket, wajibIntegerNonNegatif, `${jalur}.rekorLoket`)),
    reputasi: reputasiAman(opsional(o['reputasi'], tingkatPo(id, cfg).reputasiAwal, wajibAngkaNonNegatif, `${jalur}.reputasi`)),
    harga: bacaHargaPo(o['harga'], `${jalur}.harga`, cfg),
    kontrakDetik: opsional(o['kontrakDetik'], cfg.mitra.kontrak.hari * DETIK_SEHARI, wajibAngkaNonNegatif, `${jalur}.kontrakDetik`),
  };
}

/** Mitra PO. Tanpa satu pun PO terdaftar (blok hilang/semua id tak dikenal) → PO awal, supaya terminal tidak pernah tanpa PO. */
function bacaMitra(nilai: unknown, cfg: KonfigEkonomi): MitraState {
  const o = opsionalObjek(nilai, 'mitra');
  if (!o) return buatMitraAwal(cfg);
  const daftar = o['terdaftar'] === undefined ? [] : o['terdaftar'];
  if (!Array.isArray(daftar)) throw new SaveTidakValidError('mitra.terdaftar: harus array');
  const terdaftar: PoTerdaftar[] = [];
  daftar.forEach((x, i) => {
    const p = bacaPoTerdaftar(x, `mitra.terdaftar.${i}`, cfg);
    if (p && !terdaftar.some((q) => q.id === p.id)) terdaftar.push(p);
  });

  const riwayatMentah = opsionalObjek(o['riwayat'], 'mitra.riwayat');
  const riwayat: Partial<Record<PoId, RiwayatPo>> = {};
  for (const [id, v] of Object.entries(riwayatMentah ?? {})) {
    if (!isPoId(id) || terdaftar.some((p) => p.id === id)) continue;
    const r = wajibObjek(v, `mitra.riwayat.${id}`);
    riwayat[id] = {
      xp: wajibAngkaNonNegatif(r['xp'], `mitra.riwayat.${id}.xp`),
      reputasi: reputasiAman(opsional(r['reputasi'], tingkatPo(id, cfg).reputasiAwal, wajibAngkaNonNegatif, `mitra.riwayat.${id}.reputasi`)),
      rekorLoket: opsional(r['rekorLoket'], 0, wajibIntegerNonNegatif, `mitra.riwayat.${id}.rekorLoket`),
      harga: bacaHargaPo(r['harga'], `mitra.riwayat.${id}.harga`, cfg),
    };
  }
  const jedaMentah = opsionalObjek(o['jedaSampai'], 'mitra.jedaSampai');
  const jedaSampai: Partial<Record<PoId, number>> = {};
  for (const [id, v] of Object.entries(jedaMentah ?? {})) if (isPoId(id)) jedaSampai[id] = wajibAngkaNonNegatif(v, `mitra.jedaSampai.${id}`);
  const hadiahMentah = o['hadiahEvent'] === undefined ? [] : o['hadiahEvent'];
  if (!Array.isArray(hadiahMentah)) throw new SaveTidakValidError('mitra.hadiahEvent: harus array');
  const hadiahEvent = [...new Set(hadiahMentah.filter(isPoId))];

  const awal = terdaftar.length > 0 ? terdaftar : buatMitraAwal(cfg).terdaftar.filter((p) => !(p.id in riwayat));
  return { terdaftar: awal.length > 0 ? awal : buatMitraAwal(cfg).terdaftar, riwayat, jedaSampai, hadiahEvent };
}

function bacaPerkembangan(nilai: unknown, cfg: KonfigEkonomi): PerkembanganState {
  const o = opsionalObjek(nilai, 'perkembangan');
  if (!o) return { xpTerminal: 0, perluasan: 0, proyekDetik: 0 };
  return {
    xpTerminal: opsional(o['xpTerminal'], 0, wajibAngkaNonNegatif, 'perkembangan.xpTerminal'),
    perluasan: Math.min(cfg.mitra.perluasan.length, opsional(o['perluasan'], 0, wajibIntegerNonNegatif, 'perkembangan.perluasan')),
    proyekDetik: Math.min(cfg.mitra.detikProyek, opsional(o['proyekDetik'], 0, wajibAngkaNonNegatif, 'perkembangan.proyekDetik')),
  };
}

function bacaRenovasi(nilai: unknown, bawaan: RenovasiState): RenovasiState {
  const o = opsionalObjek(nilai, 'renovasi');
  if (!o) return bawaan;
  return {
    poin: opsional(o['poin'], bawaan.poin, stringKeDecimal, 'renovasi.poin'),
    jumlah: opsional(o['jumlah'], 0, wajibIntegerNonNegatif, 'renovasi.jumlah'),
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
  const direkrut = kepalaMentah ? opsional(kepalaMentah['direkrut'], false, wajibBoolean, `${jalur}.kepala.direkrut`) : false;
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
