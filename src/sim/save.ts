/**
 * Serialisasi/deserialisasi GameState. TypeScript murni: tidak menyentuh
 * storage sama sekali (itu tugas platform/), hanya string ⇄ state.
 *
 * Aturan kompatibilitas:
 * - Field wajib (kas, terminal) yang hilang/salah tipe → save ditolak.
 * - Blok opsional yang HILANG diisi default (supaya fitur baru bisa menambah
 *   field tanpa naik versi). Blok yang ADA tapi salah tipe → save ditolak.
 * - Field tak dikenal diabaikan; id tak dikenal (mis. dari versi lain) dibuang.
 * - Perubahan bentuk yang tidak additive: naikkan VERSI_SKEMA dan tambah
 *   fungsi di MIGRASI.
 *
 * Versi 3 = ekonomi tycoon (documents/13-rancangan-tycoon.md). Save versi 1 & 2
 * (ekonomi idle) tidak dimigrasi: ekonominya dimulai baru, hanya profil pemain
 * (nama terminal, papan peringkat) dan benih cuaca yang dibawa (bagian 13).
 */
import { EKONOMI, type KonfigEkonomi } from '../config/economy.config';
import { slotBangunan } from './bangunan';
import {
  BANGUNAN_IDS,
  isEventId,
  isPencapaianId,
  isPetugasId,
  isPoId,
  TARIF_IDS,
  TEKNOLOGI_IDS,
  type BangunanId,
  type PencapaianId,
  type PetugasId,
  type PoId,
  type TarifId,
  type TeknologiId,
} from './fitur';
import type { RincianBiaya, RincianPendapatan } from './keuangan';
import { tingkatPo } from './mitra';
import { rapikanPetugas } from './petugas';
import { rapikanNamaTerminal } from './profil';
import {
  buatBukuHarian,
  buatKeuanganAwal,
  buatMitraAwal,
  buatRekorAwal,
  buatStateBaru,
  buatTantanganAwal,
  DETIK_SEHARI,
  ID_TERMINAL_AWAL,
  type BukuHarian,
  type EventState,
  type GameState,
  type HadiahState,
  type HarianState,
  type KeuanganState,
  type MitraState,
  type PencapaianState,
  type PerkembanganState,
  type PoTerdaftar,
  type ProfilState,
  type RekorState,
  type RiwayatPo,
  type StatistikState,
  type TantanganAktif,
  type TantanganState,
} from './state';
import { isJenisTantangan } from './tantangan';
import { jepitTarif } from './tarif';
import { waktuTerminal } from './waktu';

export const VERSI_SKEMA = 3;

/** PO terdaftar di save (kontrakHari, nilaiKontrak, kontrakKe sejak 0.3.1; save lama memakai nilai bawaan). */
export interface SimpanPo {
  readonly id: string;
  readonly xp: number;
  readonly loket: number;
  readonly reputasi: number;
  readonly kontrakDetik: number;
  readonly kontrakHari: number;
  readonly nilaiKontrak: number;
  readonly kontrakKe: number;
}

/** Bentuk JSON save versi 3. Uang dalam Rupiah (number). */
export interface SaveV3 {
  readonly schemaVersion: 3;
  readonly waktuTerakhirMs: number;
  readonly kas: number;
  readonly terminal: {
    readonly id: string;
    readonly bangunan: Readonly<Record<BangunanId, number>>;
    /** Urut rekrut. */
    readonly petugas: readonly PetugasId[];
    readonly tarif: Readonly<Record<TarifId, number>>;
    readonly teknologi: Readonly<Record<TeknologiId, boolean>>;
  };
  readonly mitra: {
    readonly terdaftar: readonly SimpanPo[];
    readonly riwayat: Readonly<Record<string, RiwayatPo>>;
    readonly jedaSampai: Readonly<Record<string, number>>;
    readonly hadiahEvent: readonly string[];
  };
  readonly perkembangan: PerkembanganState;
  readonly keuangan: KeuanganState;
  readonly statistik: StatistikState;
  readonly harian: HarianState;
  readonly pencapaian: { readonly tercapai: readonly string[]; readonly diklaim: readonly string[] };
  /** Benih jadwal hujan. */
  readonly benihCuaca: number;
  /** Boost & Bus Emas yang sedang berjalan. */
  readonly hadiah?: { readonly boostDetik: number; readonly busEmas: { readonly tungguDetik: number; readonly aktifDetik: number; readonly jumlah: number } };
  /** Rekor pribadi. */
  readonly rekor?: RekorState;
  /** Tantangan mingguan. Tanpa blok ini: tantangan dimulai saat sesi berjalan. */
  readonly tantangan?: { readonly minggu: string | null; readonly selesaiMs: number; readonly daftar: readonly TantanganAktif[]; readonly penumpang?: number };
  /** Profil pemain (nama terminal). Tanpa blok ini: nama bawaan. */
  readonly profil?: { readonly namaTerminal: string; readonly ikutPeringkat?: boolean };
  /** Event musiman: edisi yang sedang/terakhir diikuti, progres & tahap yang diklaim. */
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
  // Versi 1 & 2 sama-sama ekonomi idle: keduanya dimulai baru di migrasi ke versi 3.
  1: (d) => d,
  2: (d) => migrasiKeV3(d),
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
// Serialisasi

export function keSaveV3(state: GameState): SaveV3 {
  const riwayat: Record<string, RiwayatPo> = {};
  for (const [id, r] of Object.entries(state.mitra.riwayat)) if (r) riwayat[id] = { xp: r.xp, reputasi: r.reputasi, kontrakKe: r.kontrakKe };
  const jedaSampai: Record<string, number> = {};
  for (const [id, detik] of Object.entries(state.mitra.jedaSampai)) if (detik !== undefined) jedaSampai[id] = detik;
  const k = state.keuangan;
  const buku = (b: BukuHarian): BukuHarian => ({ hariKe: b.hariKe, pendapatan: { ...b.pendapatan }, biaya: { ...b.biaya }, penumpang: b.penumpang });
  return {
    schemaVersion: VERSI_SKEMA,
    waktuTerakhirMs: state.waktuTerakhirMs,
    kas: state.kas,
    terminal: {
      id: state.terminal.id,
      bangunan: { ...state.terminal.bangunan },
      petugas: [...state.terminal.petugas],
      tarif: { ...state.terminal.tarif },
      teknologi: { ...state.terminal.teknologi },
    },
    mitra: {
      terdaftar: state.mitra.terdaftar.map((p) => ({
        id: p.id,
        xp: p.xp,
        loket: p.loket,
        reputasi: p.reputasi,
        kontrakDetik: p.kontrakDetik,
        kontrakHari: p.kontrakHari,
        nilaiKontrak: p.nilaiKontrak,
        kontrakKe: p.kontrakKe,
      })),
      riwayat,
      jedaSampai,
      hadiahEvent: [...state.mitra.hadiahEvent],
    },
    perkembangan: { ...state.perkembangan },
    keuangan: { hariIni: buku(k.hariIni), kemarin: k.kemarin ? buku(k.kemarin) : null, tunggakanJam: k.tunggakanJam, hariTanpaRugi: k.hariTanpaRugi, petugasBerhenti: k.petugasBerhenti },
    statistik: { ...state.statistik },
    harian: { ...state.harian },
    pencapaian: { tercapai: [...state.pencapaian.tercapai], diklaim: [...state.pencapaian.diklaim] },
    benihCuaca: state.benihCuaca,
    hadiah: { boostDetik: state.hadiah.boostDetik, busEmas: { ...state.hadiah.busEmas } },
    rekor: { ...state.rekor },
    tantangan: { ...state.tantangan, daftar: state.tantangan.daftar.map((x) => ({ ...x })) },
    profil: { namaTerminal: state.profil.namaTerminal, ikutPeringkat: state.profil.ikutPeringkat },
    event: { ...state.event, aktif: state.event.aktif ? { ...state.event.aktif } : null, target: [...state.event.target] },
  };
}

/** Panggil `tandaiWaktu(state, sekarang)` dulu supaya timestamp offline akurat. */
export function serialisasi(state: GameState): string {
  return JSON.stringify(keSaveV3(state));
}

// ---------------------------------------------------------------------------
// Deserialisasi

/**
 * @param sekarangMs dipakai sebagai waktuTerakhirMs kalau field itu tidak ada
 *   (artinya: tidak ada laba offline untuk sesi itu).
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
  return dariSaveV3(migrasikan(akar, versi), sekarangMs, cfg);
}

/**
 * Parse string save mentah dari storage. Tidak pernah throw: save kosong →
 * game baru, save korup → game baru + error (pemanggil yang me-log).
 */
export function muatAtauBaru(raw: string | null | undefined, sekarangMs: number, cfg: KonfigEkonomi = EKONOMI): HasilMuat {
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
// Migrasi ke v3 (ekonomi tycoon)

const objekAtauNull = (v: unknown): DataMentah | null => (typeof v === 'object' && v !== null && !Array.isArray(v) ? (v as DataMentah) : null);

/**
 * Save ekonomi idle (versi 1 & 2) → game tycoon baru. Belum ada pemain saat
 * peralihan, jadi ekonominya tidak dikonversi; yang dibawa hanya profil
 * pemain (nama terminal, persetujuan papan peringkat) dan benih cuaca. Nilai
 * yang tidak sah diganti bawaan game baru.
 */
export function migrasiKeV3(d: DataMentah, cfg: KonfigEkonomi = EKONOMI): DataMentah {
  const terakhir = d['waktuTerakhirMs'];
  const sekarang = typeof terakhir === 'number' && Number.isFinite(terakhir) && terakhir >= 0 ? terakhir : 0;
  const baru = keSaveV3(buatStateBaru(sekarang, cfg));
  const benih = d['benihCuaca'];
  const profil = objekAtauNull(d['profil']);
  const nama = profil?.['namaTerminal'];
  const ikut = profil?.['ikutPeringkat'];
  return {
    ...baru,
    benihCuaca: typeof benih === 'number' && Number.isSafeInteger(benih) && benih >= 0 ? benih : baru.benihCuaca,
    profil: { namaTerminal: typeof nama === 'string' ? nama : '', ikutPeringkat: ikut === true },
  };
}

// ---------------------------------------------------------------------------
// Baca save v3

function dariSaveV3(akar: DataMentah, sekarangMs: number, cfg: KonfigEkonomi): GameState {
  const awal = buatStateBaru(sekarangMs, cfg);
  const perkembangan = bacaPerkembangan(akar['perkembangan'], cfg);
  const terminalMentah = wajibObjek(akar['terminal'], 'terminal');
  const mitra = bacaMitra(akar['mitra'], cfg);
  const bangunan = bacaBangunan(terminalMentah['bangunan'], perkembangan.perluasan, mitra, cfg);
  const statistik = bacaStatistik(akar['statistik'], awal.statistik);
  const hariKe = waktuTerminal(statistik.waktuMainDetik).hariKe;
  return {
    kas: wajibAngkaNonNegatif(akar['kas'], 'kas'),
    terminal: {
      id: opsional(terminalMentah['id'], ID_TERMINAL_AWAL, wajibString, 'terminal.id'),
      bangunan,
      petugas: rapikanPetugas(bacaPetugas(terminalMentah['petugas']), bangunan),
      tarif: bacaTarif(terminalMentah['tarif'], awal.terminal.tarif, cfg),
      teknologi: bacaTeknologi(terminalMentah['teknologi'], awal.terminal.teknologi),
    },
    mitra,
    perkembangan,
    keuangan: bacaKeuangan(akar['keuangan'], hariKe),
    statistik,
    harian: bacaHarian(akar['harian'], awal.harian),
    pencapaian: bacaPencapaian(akar['pencapaian']),
    benihCuaca: opsional(akar['benihCuaca'], awal.benihCuaca, wajibIntegerNonNegatif, 'benihCuaca'),
    hadiah: bacaHadiah(akar['hadiah'], awal.hadiah),
    event: bacaEvent(akar['event'], awal.event),
    profil: bacaProfil(akar['profil']),
    rekor: bacaRekor(akar['rekor']),
    tantangan: bacaTantangan(akar['tantangan']),
    waktuTerakhirMs: opsional(akar['waktuTerakhirMs'], sekarangMs, wajibAngkaNonNegatif, 'waktuTerakhirMs'),
  };
}

/**
 * Bangunan: tiap jenis bilangan bulat dalam slot tahap perluasan sekarang (save
 * dari versi lain / diubah tangan). Jalur permanen (paling sedikit unit
 * awalnya), jendela loket paling sedikit satu dan sebanyak yang disewa PO.
 */
function bacaBangunan(nilai: unknown, perluasan: number, mitra: MitraState, cfg: KonfigEkonomi): Record<BangunanId, number> {
  const o = opsionalObjek(nilai, 'terminal.bangunan');
  const hasil = {} as Record<BangunanId, number>;
  for (const id of BANGUNAN_IDS) {
    const b = cfg.tycoon.bangunan[id];
    const n = opsional(o?.[id], b.awal, wajibIntegerNonNegatif, `terminal.bangunan.${id}`);
    const min = id === 'jalur' ? b.awal : id === 'jendela' ? 1 : 0;
    hasil[id] = Math.max(min, Math.min(slotBangunan(id, perluasan, cfg), n));
  }
  hasil.jendela = Math.max(hasil.jendela, mitra.terdaftar.reduce((a, p) => a + p.loket, 0));
  return hasil;
}

/** Urutan rekrut; peran yang tidak dikenal dibuang (batas tiap peran dirapikan pemanggil). */
function bacaPetugas(nilai: unknown): PetugasId[] {
  if (nilai === undefined) return [];
  if (!Array.isArray(nilai)) throw new SaveTidakValidError('terminal.petugas: harus array');
  return nilai.filter(isPetugasId);
}

/** Tarif dirapikan lagi ke rentang & langkahnya (config bisa berubah). */
function bacaTarif(nilai: unknown, bawaan: Readonly<Record<TarifId, number>>, cfg: KonfigEkonomi): Record<TarifId, number> {
  const o = opsionalObjek(nilai, 'terminal.tarif');
  const hasil = {} as Record<TarifId, number>;
  for (const id of TARIF_IDS) hasil[id] = jepitTarif(id, opsional(o?.[id], bawaan[id], wajibAngkaNonNegatif, `terminal.tarif.${id}`), cfg);
  return hasil;
}

function bacaTeknologi(nilai: unknown, bawaan: Readonly<Record<TeknologiId, boolean>>): Record<TeknologiId, boolean> {
  const o = opsionalObjek(nilai, 'terminal.teknologi');
  const hasil = { ...bawaan };
  for (const id of TEKNOLOGI_IDS) hasil[id] = opsional(o?.[id], false, wajibBoolean, `terminal.teknologi.${id}`);
  return hasil;
}

const reputasiAman = (v: number): number => Math.min(100, Math.max(0, v));

function bacaPoTerdaftar(nilai: unknown, jalur: string, cfg: KonfigEkonomi): PoTerdaftar | null {
  const o = wajibObjek(nilai, jalur);
  const id = o['id'];
  // PO yang tidak dikenal (mis. dari versi lain) diabaikan.
  if (!isPoId(id)) return null;
  // Kontrak: save 0.3.0 belum menyimpan panjang & nilainya (kontrak lama dianggap 7 hari, sudah dibayar penuh).
  const k = cfg.mitra.kontrak;
  const hariMaks = k.pilihanHari[k.pilihanHari.length - 1]!;
  const kontrakHari = Math.min(hariMaks, Math.max(1, opsional(o['kontrakHari'], 7, wajibAngkaNonNegatif, `${jalur}.kontrakHari`)));
  return {
    id,
    xp: wajibAngkaNonNegatif(o['xp'], `${jalur}.xp`),
    // PO selalu menyewa minimal satu jendela.
    loket: Math.max(1, wajibIntegerNonNegatif(o['loket'], `${jalur}.loket`)),
    reputasi: reputasiAman(opsional(o['reputasi'], tingkatPo(id, cfg).reputasiAwal, wajibAngkaNonNegatif, `${jalur}.reputasi`)),
    // Sisa kontrak tidak lebih dari kontrak terpanjang ditambah sisa sebelum perpanjangan.
    kontrakDetik: Math.min((hariMaks + k.hariTawaran) * DETIK_SEHARI, opsional(o['kontrakDetik'], kontrakHari * DETIK_SEHARI, wajibAngkaNonNegatif, `${jalur}.kontrakDetik`)),
    kontrakHari,
    nilaiKontrak: opsional(o['nilaiKontrak'], 0, wajibAngkaNonNegatif, `${jalur}.nilaiKontrak`),
    kontrakKe: Math.max(1, opsional(o['kontrakKe'], 1, wajibIntegerNonNegatif, `${jalur}.kontrakKe`)),
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
      kontrakKe: opsional(r['kontrakKe'], 1, wajibIntegerNonNegatif, `mitra.riwayat.${id}.kontrakKe`),
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

function bacaStatistik(nilai: unknown, bawaan: StatistikState): StatistikState {
  const o = opsionalObjek(nilai, 'statistik');
  if (!o) return bawaan;
  const angka = (k: keyof StatistikState): number => opsional(o[k], bawaan[k], wajibAngkaNonNegatif, `statistik.${k}`);
  return { totalPendapatan: angka('totalPendapatan'), totalBiaya: angka('totalBiaya'), waktuMainDetik: angka('waktuMainDetik'), totalPenumpang: angka('totalPenumpang') };
}

function bacaBuku(nilai: unknown, jalur: string, hariKe: number): BukuHarian {
  const o = wajibObjek(nilai, jalur);
  const awal = buatBukuHarian(hariKe);
  const p = opsionalObjek(o['pendapatan'], `${jalur}.pendapatan`);
  const b = opsionalObjek(o['biaya'], `${jalur}.biaya`);
  const pendapatan = {} as Record<keyof RincianPendapatan, number>;
  for (const k of Object.keys(awal.pendapatan) as (keyof RincianPendapatan)[]) pendapatan[k] = opsional(p?.[k], 0, wajibAngkaNonNegatif, `${jalur}.pendapatan.${k}`);
  const biaya = {} as Record<keyof RincianBiaya, number>;
  for (const k of Object.keys(awal.biaya) as (keyof RincianBiaya)[]) biaya[k] = opsional(b?.[k], 0, wajibAngkaNonNegatif, `${jalur}.biaya.${k}`);
  return {
    hariKe: opsional(o['hariKe'], hariKe, wajibIntegerNonNegatif, `${jalur}.hariKe`),
    pendapatan,
    biaya,
    penumpang: opsional(o['penumpang'], 0, wajibAngkaNonNegatif, `${jalur}.penumpang`),
  };
}

/** Buku keuangan; tanpa blok ini mulai dari nol di hari terminal sekarang. */
function bacaKeuangan(nilai: unknown, hariKe: number): KeuanganState {
  const o = opsionalObjek(nilai, 'keuangan');
  if (!o) return buatKeuanganAwal(hariKe);
  return {
    hariIni: o['hariIni'] === undefined ? buatBukuHarian(hariKe) : bacaBuku(o['hariIni'], 'keuangan.hariIni', hariKe),
    kemarin: o['kemarin'] === undefined || o['kemarin'] === null ? null : bacaBuku(o['kemarin'], 'keuangan.kemarin', Math.max(0, hariKe - 1)),
    tunggakanJam: Math.min(0.999999, opsional(o['tunggakanJam'], 0, wajibAngkaNonNegatif, 'keuangan.tunggakanJam')),
    hariTanpaRugi: opsional(o['hariTanpaRugi'], 0, wajibIntegerNonNegatif, 'keuangan.hariTanpaRugi'),
    petugasBerhenti: opsional(o['petugasBerhenti'], 0, wajibIntegerNonNegatif, 'keuangan.petugasBerhenti'),
  };
}

function bacaHarian(nilai: unknown, bawaan: HarianState): HarianState {
  const o = opsionalObjek(nilai, 'harian');
  if (!o) return bawaan;
  const jenis = o['jenis'];
  if (jenis !== 'penumpang' && jenis !== 'laba') throw new SaveTidakValidError('harian.jenis tidak dikenal');
  return {
    hariKe: wajibIntegerNonNegatif(o['hariKe'], 'harian.hariKe'),
    jenis,
    target: wajibAngkaNonNegatif(o['target'], 'harian.target'),
    progres: wajibAngkaNonNegatif(o['progres'], 'harian.progres'),
    diklaim: wajibBoolean(o['diklaim'], 'harian.diklaim'),
    jumlahSelesai: opsional(o['jumlahSelesai'], 0, wajibIntegerNonNegatif, 'harian.jumlahSelesai'),
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

/** Rekor; tanpa blok ini mulai dari nol. */
function bacaRekor(nilai: unknown): RekorState {
  const o = opsionalObjek(nilai, 'rekor');
  const awal = buatRekorAwal();
  if (!o) return awal;
  const angka = (k: keyof RekorState): number => opsional(o[k], awal[k], wajibAngkaNonNegatif, `rekor.${k}`);
  return { penumpangHarian: angka('penumpangHarian'), labaHarian: angka('labaHarian'), arusTertinggi: angka('arusTertinggi') };
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

/** Profil: nama terminal dirapikan lagi (save dari versi lain / diubah tangan). Tanpa blok ini: belum ikut papan peringkat. */
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
