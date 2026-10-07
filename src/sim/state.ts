/**
 * GameState dan semua transisinya. TypeScript murni: tidak boleh import
 * Phaser atau DOM, dan tidak membaca jam sendiri (waktu selalu jadi parameter).
 *
 * Semua fungsi murni: tidak memutasi state masukan, selalu mengembalikan
 * state baru (atau state yang sama persis kalau aksinya tidak berlaku).
 *
 * Ekonomi v2 (documents/12-rancangan-ekonomi-po.md): loket disewa mitra PO,
 * penumpang dibagi ke segmen PO × jurusan × kelas bus (sim/segmen.ts), level
 * terminal naik dari penumpang dan menentukan kelasnya, perluasan terminal
 * permanen, dan Renovasi menggantikan prestige naik kelas.
 */
import Decimal from 'break_infinity.js';
import { EKONOMI, type KonfigEkonomi } from '../config/economy.config';
import { WAKTU } from '../config/waktu.config';
import {
  biayaKepala,
  biayaUpgrade,
  daftarBottleneck,
  detikOffline,
  kapasitas,
  multiplierPrestige,
  pendapatanOffline,
  poinPrestigeDidapat,
  throughput,
  type KapasitasPerTahap,
} from './economy';
import { benihCuacaDari } from './cuaca';
import { eventPada, jadwalUji } from './event';
import { FASILITAS_IDS, isEventId, PENCAPAIAN_IDS, PO_IDS, TEKNOLOGI_IDS, type EventId, type FasilitasId, type JenisTarget, type KelasBusId, type PencapaianId, type PoId, type TeknologiId } from './fitur';
import { hitungKepuasan, type Kepuasan } from './kepuasan';
import { kelasDariLevel, levelTerminalDariXp, pengaliLevelTerminal, slotPo } from './level-terminal';
import {
  biayaDaftarPo,
  biayaPerpanjang,
  hariKontrakPertama,
  jatahLoket,
  jurusanAktif,
  jurusanDilayaniPo,
  kelasBusDioperasikan,
  levelPoDariXp,
  majukanReputasi,
  sisaSetelahPerpanjang,
  syaratDaftarKurang,
  targetReputasi,
  tingkatPo,
  xpLoketBaru,
  type SyaratDaftarKurang,
} from './mitra';
import { biayaPerluasan, bonusJatahPerluasan, levelCukupPerluasan } from './perluasan';
import { SYARAT_PENCAPAIAN } from './pencapaian';
import { rapikanNamaTerminal } from './profil';
import { hitungSegmen, type HasilSegmen, type OpsiSegmen, type PoSegmen } from './segmen';
import { jenisTantanganMinggu, mingguWib, type JenisTantangan } from './tantangan';
import { TAHAP_IDS, type TahapId } from './tahap';
import { keramaianTerminal, waktuTerminal, waktuTerminalState } from './waktu';

/** Id terminal pertama. Nanti kota/terminal tambahan dapat id sendiri. */
export const ID_TERMINAL_AWAL = 'tipe-c';

/** Toleransi pembulatan saat menghitung penumpang/bus utuh (0,8 × 0,1 × 10 bisa jadi 0,7999…). */
const EPSILON_TRANSAKSI = 1e-9;

/** Lama satu hari terminal dalam detik main (kontrak PO dihitung dalam hari terminal). */
export const DETIK_SEHARI = 24 * WAKTU.detikPerJam;

export interface KepalaState {
  readonly direkrut: boolean;
  // Ruang untuk skill aktif Kepala (level, cooldown, dst.) tanpa ubah bentuk save.
}

export interface TahapState {
  /**
   * Mulai dari 1. Untuk Loket: banyaknya loket milik terminal (yang disewa PO +
   * yang kosong), dasar biaya loket berikutnya; kapasitasnya dari loket yang disewa.
   */
  readonly level: number;
  /** Kepala menjalankan tahapnya saat game ditutup (pendapatan offline). Kepala Loket = Kepala Kemitraan. */
  readonly kepala: KepalaState;
}

export interface TerminalState {
  readonly id: string;
  readonly tahap: Readonly<Record<TahapId, TahapState>>;
  /** Level tiap fasilitas penunjang (0 = belum dibangun). */
  readonly fasilitas: Readonly<Record<FasilitasId, number>>;
  /** Modernisasi yang sudah dipasang. */
  readonly teknologi: Readonly<Record<TeknologiId, boolean>>;
  /** Jalur bus yang beroperasi (1 … jumlahJalurMaks). Permanen: tidak ikut Renovasi. */
  readonly jalur: number;
  /** Loket milik terminal yang tidak disewa PO mana pun (PO-nya keluar): tidak melayani penumpang. */
  readonly loketKosong: number;
}

/** Target harian: berganti tiap hari terminal; hadiahnya diklaim pemain. */
export interface HarianState {
  /** Hari terminal (lihat sim/waktu.ts) target ini berlaku. */
  readonly hariKe: number;
  readonly jenis: JenisTarget;
  readonly target: number;
  readonly progres: number;
  readonly diklaim: boolean;
  /** Banyaknya target harian yang pernah selesai (sepanjang permainan). */
  readonly jumlahSelesai: number;
}

export interface PencapaianState {
  readonly tercapai: readonly PencapaianId[];
  readonly diklaim: readonly PencapaianId[];
}

/** Renovasi (pengganti prestige): poin = bonus pendapatan permanen. */
export interface RenovasiState {
  readonly poin: Decimal;
  readonly jumlah: number;
}

export interface StatistikState {
  /** Total pendapatan sejak Renovasi terakhir. Dasar hitung poin Renovasi. */
  readonly totalPendapatanRun: Decimal;
  readonly totalPendapatanSepanjangMasa: Decimal;
  /** Waktu main aktif (tidak termasuk offline). */
  readonly waktuMainDetik: number;
  /** Total penumpang yang diberangkatkan selama bermain aktif. */
  readonly totalPenumpang: number;
}

/** Sewa kios: belanja penumpang dikumpulkan sepanjang hari terminal, dibayar saat hari berganti. */
export interface SewaKiosState {
  /** Sewa yang terkumpul hari ini (belum dibayar). */
  readonly terkumpul: Decimal;
  /** Sewa terakhir yang dibayar dan untuk hari ke berapa (notifikasi); −1 = belum pernah. */
  readonly terakhir: Decimal;
  readonly hariTerakhir: number;
}

/** Harga tiket PO per jurusan (indeks EKONOMI.jurusan → persen harga normal); yang tidak ada = 100. */
export type HargaPo = Readonly<Partial<Record<number, number>>>;

/** Mitra PO yang sedang terdaftar (menempati slot). */
export interface PoTerdaftar {
  readonly id: PoId;
  /** XP kumulatif (satuan bus); level = levelPoDariXp(xp), jadi tidak pernah turun. */
  readonly xp: number;
  /** Loket yang disewa PO ini. */
  readonly loket: number;
  /** Jumlah loket tertinggi yang pernah disewa: XP loket hanya untuk loket di atas rekor ini. */
  readonly rekorLoket: number;
  /** 0–100. */
  readonly reputasi: number;
  readonly harga: HargaPo;
  /** Sisa kontrak (detik main). Hari terminal berhenti saat game ditutup, kontrak juga. */
  readonly kontrakDetik: number;
}

/** PO yang pernah terdaftar lalu keluar: daftar ulang melanjutkan dari sini. */
export interface RiwayatPo {
  readonly xp: number;
  readonly reputasi: number;
  readonly rekorLoket: number;
  readonly harga: HargaPo;
}

export interface MitraState {
  /** Urut terdaftar (PO pertama = PO awal game). */
  readonly terdaftar: readonly PoTerdaftar[];
  readonly riwayat: Readonly<Partial<Record<PoId, RiwayatPo>>>;
  /** PO yang diputus kontraknya tidak bisa didaftarkan lagi sebelum detik main ini. */
  readonly jedaSampai: Readonly<Partial<Record<PoId, number>>>;
  /** PO eksklusif hadiah event yang sudah didapat (boleh didaftarkan gratis). */
  readonly hadiahEvent: readonly PoId[];
}

/** Kemajuan permanen terminal: tidak ikut Renovasi. */
export interface PerkembanganState {
  /** XP terminal = penumpang yang diberangkatkan (offline dihitung × efisiensiOffline). */
  readonly xpTerminal: number;
  /** Tahap perluasan yang sudah selesai dibangun. */
  readonly perluasan: number;
  /** Sisa detik main proyek perluasan yang sedang dibangun (0 = tidak ada proyek). */
  readonly proyekDetik: number;
}

/**
 * Uang masuk per transaksi, bukan sebagai aliran: tiket, parkir kendaraan
 * pengantar, & belanja kios per penumpang yang membeli tiket (utuh), parkir bus
 * per bus (penumpangPerBus penumpang). Sisa yang belum utuh disimpan supaya tidak
 * ada uang yang hilang.
 */
export interface TransaksiState {
  /** Pecahan penumpang yang belum membeli tiket (0 ≤ x < 1). */
  readonly sisaPenumpang: number;
  /** Penumpang sejak bus terakhir membayar parkir (0 ≤ x < penumpangPerBus). */
  readonly sisaBus: number;
}

/**
 * Rekor pribadi: tetap walau Renovasi. Hitungan harian (hari terminal, main
 * aktif) disimpan lalu dibandingkan dengan rekor saat hari berganti.
 */
export interface RekorState {
  /** Hari terminal yang sedang dihitung (lihat sim/waktu.ts). */
  readonly hariKe: number;
  readonly penumpangHariIni: number;
  readonly pendapatanHariIni: number;
  /** Penumpang & pendapatan terbanyak dalam satu hari terminal yang sudah lewat. */
  readonly penumpangHarian: number;
  readonly pendapatanHarian: number;
  /** Arus penumpang potensial tertinggi (pnp/dtk). */
  readonly arusTertinggi: number;
}

export interface TantanganAktif {
  readonly jenis: JenisTantangan;
  readonly target: number;
  readonly progres: number;
  readonly diklaim: boolean;
}

/** Tantangan mingguan (lihat sim/tantangan.ts & perbaruiTantangan). */
export interface TantanganState {
  /** Kunci minggu (Senin WIB, "2026-09-28") tantangan yang sedang berjalan; null = belum pernah dimulai. */
  readonly minggu: string | null;
  /** Akhir minggu (ms epoch), untuk sisa waktu di UI. */
  readonly selesaiMs: number;
  readonly daftar: readonly TantanganAktif[];
  /** Penumpang yang diberangkatkan minggu ini selama main aktif (skor papan peringkat, lihat app/peringkat.ts). */
  readonly penumpang: number;
}

/** Profil pemain (lihat sim/profil.ts): tetap walau Renovasi. */
export interface ProfilState {
  /** Nama terminal pilihan pemain; kosong = nama bawaan (TERMINAL TIPE C …). */
  readonly namaTerminal: string;
  /** Pemain setuju ikut papan peringkat (nama terminal & skornya tampil publik). Hanya bisa saat login. */
  readonly ikutPeringkat: boolean;
}

/** Event musiman yang sedang berlangsung (dari jam nyata, lihat perbaruiEvent). */
export interface EventAktif {
  readonly id: EventId;
  readonly edisi: string;
  /** Selesai (ms epoch), untuk sisa waktu di UI. */
  readonly selesaiMs: number;
}

/** Event musiman: yang berlangsung sekarang dan progres & hadiah edisi terakhir yang diikuti. */
export interface EventState {
  readonly aktif: EventAktif | null;
  /** Edisi yang progresnya dicatat di bawah; tetap setelah event selesai supaya tidak diulang. */
  readonly edisi: string | null;
  /** Penumpang yang diberangkatkan selama edisi ini (main aktif). */
  readonly progres: number;
  /** Banyaknya tahap yang hadiahnya sudah diklaim. */
  readonly diklaim: number;
  /** Target penumpang tiap tahap, ditetapkan saat edisi dimulai. */
  readonly target: readonly number[];
}

/** Hadiah iklan berhadiah yang sedang berjalan (lihat bagian Hadiah di bawah). */
export interface HadiahState {
  /** Sisa boost pendapatan (detik main); > 0 = pendapatan × pengaliBoost. */
  readonly boostDetik: number;
  /** Bus Emas: hitung mundur sampai muncul, lalu lama ia bisa diketuk; `jumlah` kemunculan (mengundi jeda berikutnya). */
  readonly busEmas: { readonly tungguDetik: number; readonly aktifDetik: number; readonly jumlah: number };
  /** Bonus 2× penghasilan offline terakhir yang belum diklaim (tidak disimpan: hanya ditawarkan di popup). */
  readonly bonusOffline: Decimal;
}

export interface GameState {
  readonly uang: Decimal;
  readonly terminal: TerminalState;
  readonly mitra: MitraState;
  readonly perkembangan: PerkembanganState;
  readonly renovasi: RenovasiState;
  readonly statistik: StatistikState;
  readonly harian: HarianState;
  readonly pencapaian: PencapaianState;
  /**
   * Benih acak jadwal hujan (lihat sim/cuaca.ts). Dibuat sekali saat game baru
   * dan ikut disimpan, jadi cuaca tiap game berbeda tapi tetap sama saat dibuka ulang.
   */
  readonly benihCuaca: number;
  readonly hadiah: HadiahState;
  readonly sewaKios: SewaKiosState;
  readonly transaksi: TransaksiState;
  readonly event: EventState;
  readonly profil: ProfilState;
  readonly rekor: RekorState;
  readonly tantangan: TantanganState;
  /**
   * Timestamp (ms epoch) terakhir game dianggap aktif: diperbarui lewat
   * `tandaiWaktu` saat save/pause. Dasar perhitungan offline.
   */
  readonly waktuTerakhirMs: number;
}

/**
 * - potensial: kapasitas terminal (tahap paling lambat), semua kursi terisi,
 *   harga normal; dasar target & hadiah, jadi tidak bisa digelembungkan lewat harga tiket.
 * - aktif: arus nyata saat main = kapasitas × kursi terisi (penumpang yang
 *   datang menurut kepuasan, jam, reputasi, & harga tiket; lihat sim/segmen.ts).
 * - offline: saat game ditutup; 0 kalau ada tahap tanpa Kepala. Ikut harga
 *   tiket tanpa kepuasan & jam, dan tidak pernah melebihi hasil harga normal.
 */
export type ModeThroughput = 'potensial' | 'aktif' | 'offline';

export interface LaporanOffline {
  /** Detik yang dihitung (sudah dibatasi batasOffline; 0 kalau jam mundur). */
  readonly detik: number;
  readonly pendapatan: Decimal;
  /** True kalau waktu pergi melebihi batasOffline. */
  readonly dibatasi: boolean;
  /** Detik offline yang mendapat boost pendapatan (sudah termasuk di `pendapatan`). */
  readonly detikBoost: number;
}

// ---------------------------------------------------------------------------
// Pembuatan state

export function buatTahapAwal(): TahapState {
  return { level: 1, kepala: { direkrut: false } };
}

export function buatTerminalAwal(cfg: KonfigEkonomi = EKONOMI): TerminalState {
  void cfg;
  return {
    id: ID_TERMINAL_AWAL,
    tahap: petakanTahap(() => buatTahapAwal()),
    fasilitas: petakan(FASILITAS_IDS, () => 0),
    teknologi: petakan(TEKNOLOGI_IDS, () => false),
    jalur: 1,
    loketKosong: 0,
  };
}

/** PO baru terdaftar dengan sekian loket; riwayat (bila pernah terdaftar) dilanjutkan. */
export function buatPoTerdaftar(id: PoId, loket: number, cfg: KonfigEkonomi = EKONOMI, riwayat?: RiwayatPo): PoTerdaftar {
  return {
    id,
    xp: riwayat?.xp ?? 0,
    loket,
    rekorLoket: Math.max(loket, riwayat?.rekorLoket ?? 0),
    reputasi: riwayat?.reputasi ?? tingkatPo(id, cfg).reputasiAwal,
    harga: riwayat?.harga ?? {},
    kontrakDetik: hariKontrakPertama(id, cfg) * DETIK_SEHARI,
  };
}

/** Game baru: PO awal (EKONOMI.mitra sumber 'awal') menyewa satu loket, seperti satu-satunya loket v1. */
export function buatMitraAwal(cfg: KonfigEkonomi = EKONOMI): MitraState {
  const awal = PO_IDS.filter((id) => cfg.mitra.po[id].sumber === 'awal');
  return { terdaftar: awal.map((id) => buatPoTerdaftar(id, 1, cfg)), riwayat: {}, jedaSampai: {}, hadiahEvent: [] };
}

export function buatStateBaru(sekarangMs: number, cfg: KonfigEkonomi = EKONOMI): GameState {
  const mitra = buatMitraAwal(cfg);
  const terminal = buatTerminalAwal(cfg);
  return {
    uang: new Decimal(cfg.uangAwal),
    terminal: aturLevelLoket(terminal, mitra),
    mitra,
    perkembangan: { xpTerminal: 0, perluasan: 0, proyekDetik: 0 },
    renovasi: { poin: new Decimal(0), jumlah: 0 },
    statistik: {
      totalPendapatanRun: new Decimal(0),
      totalPendapatanSepanjangMasa: new Decimal(0),
      waktuMainDetik: 0,
      totalPenumpang: 0,
    },
    harian: { hariKe: 0, jenis: 'upgrade', target: cfg.harian.targetUpgrade, progres: 0, diklaim: false, jumlahSelesai: 0 },
    pencapaian: { tercapai: [], diklaim: [] },
    benihCuaca: benihCuacaDari(sekarangMs),
    hadiah: buatHadiahAwal(cfg),
    sewaKios: buatSewaKiosAwal(),
    transaksi: { sisaPenumpang: 0, sisaBus: 0 },
    event: buatEventAwal(),
    profil: { namaTerminal: '', ikutPeringkat: false },
    rekor: buatRekorAwal(waktuTerminal(0).hariKe),
    tantangan: buatTantanganAwal(),
    waktuTerakhirMs: sekarangMs,
  };
}

export function buatRekorAwal(hariKe: number): RekorState {
  return { hariKe, penumpangHariIni: 0, pendapatanHariIni: 0, penumpangHarian: 0, pendapatanHarian: 0, arusTertinggi: 0 };
}

export function buatTantanganAwal(): TantanganState {
  return { minggu: null, selesaiMs: 0, daftar: [], penumpang: 0 };
}

export function buatEventAwal(): EventState {
  return { aktif: null, edisi: null, progres: 0, diklaim: 0, target: [] };
}

export function buatSewaKiosAwal(): SewaKiosState {
  return { terkumpul: new Decimal(0), terakhir: new Decimal(0), hariTerakhir: -1 };
}

export function buatHadiahAwal(cfg: KonfigEkonomi = EKONOMI): HadiahState {
  return { boostDetik: 0, busEmas: { tungguDetik: cfg.hadiah.busEmasSelangDetik[0], aktifDetik: 0, jumlah: 0 }, bonusOffline: new Decimal(0) };
}

/** Level tahap Loket = loket milik terminal (disewa + kosong). Dijaga sinkron setiap kali loket berubah (juga saat save dimuat). */
export function aturLevelLoket(terminal: TerminalState, mitra: MitraState): TerminalState {
  const level = Math.max(1, mitra.terdaftar.reduce((a, p) => a + p.loket, 0) + terminal.loketKosong);
  const t = terminal.tahap.loket;
  return t.level === level ? terminal : { ...terminal, tahap: { ...terminal.tahap, loket: { ...t, level } } };
}

// ---------------------------------------------------------------------------
// Turunan: level terminal & mitra PO

/** Level terminal dari XP-nya (penumpang). */
export function levelTerminal(state: GameState, cfg: KonfigEkonomi = EKONOMI): number {
  return levelTerminalDariXp(state.perkembangan.xpTerminal, cfg);
}

/** Kelas terminal dari level: 0 = Tipe C, 1 = Tipe B, 2 = Tipe A, 3+ = Terpadu (★ bertambah). */
export function kelasTerminal(state: GameState, cfg: KonfigEkonomi = EKONOMI): number {
  return kelasDariLevel(levelTerminal(state, cfg), cfg);
}

/** Slot PO sekarang (level terminal & aula kedua dari perluasan). */
export function slotPoState(state: GameState, cfg: KonfigEkonomi = EKONOMI): number {
  return slotPo(levelTerminal(state, cfg), state.perkembangan.perluasan, cfg);
}

export function levelPo(p: PoTerdaftar, cfg: KonfigEkonomi = EKONOMI): number {
  return levelPoDariXp(p.xp, cfg);
}

/** Jatah loket PO ini sekarang (level PO + perluasan). */
export function jatahLoketPo(state: GameState, p: PoTerdaftar, cfg: KonfigEkonomi = EKONOMI): number {
  return jatahLoket(levelPo(p, cfg), bonusJatahPerluasan(state.perkembangan.perluasan, cfg), cfg);
}

export function cariPo(state: GameState, id: PoId): PoTerdaftar | undefined {
  return state.mitra.terdaftar.find((p) => p.id === id);
}

/** Loket yang disewa semua PO (yang melayani penumpang). */
export function loketTerisi(state: GameState): number {
  return state.mitra.terdaftar.reduce((a, p) => a + p.loket, 0);
}

function poSegmen(state: GameState, cfg: KonfigEkonomi): PoSegmen[] {
  return state.mitra.terdaftar.map((p) => ({ id: p.id, level: levelPo(p, cfg), loket: p.loket, reputasi: p.reputasi, harga: p.harga }));
}

/** Penumpang & tiket per segmen pada permintaan tertentu (lihat sim/segmen.ts). */
export function segmenState(state: GameState, permintaan: number, cfg: KonfigEkonomi = EKONOMI, opsi: OpsiSegmen = {}): HasilSegmen {
  return hitungSegmen(poSegmen(state, cfg), permintaan, kelasTerminal(state, cfg), cfg, opsi);
}

/** Semua kursi penuh, harga normal: dasar hadiah, target, dan biaya perpanjang kontrak. */
function segmenPotensial(state: GameState, cfg: KonfigEkonomi): HasilSegmen {
  return segmenState(state, Number.POSITIVE_INFINITY, cfg, { hargaNormal: true });
}

/** Jurusan (indeks EKONOMI.jurusan) yang sedang dilayani PO terdaftar yang punya loket. */
export function jurusanDilayani(state: GameState, cfg: KonfigEkonomi = EKONOMI): boolean[] {
  return jurusanDilayaniPo(state.mitra.terdaftar, kelasTerminal(state, cfg), cfg);
}

/** Kelas bus yang dioperasikan PO mana pun yang punya loket (urut KELAS_BUS_IDS). */
export function kelasBusBeroperasi(state: GameState, cfg: KonfigEkonomi = EKONOMI): KelasBusId[] {
  return kelasBusDioperasikan(state.mitra.terdaftar, kelasTerminal(state, cfg), cfg);
}

// ---------------------------------------------------------------------------
// Turunan: kapasitas & pendapatan (read-only)

/** Pengali kapasitas tahap dari modernisasi yang sudah dipasang. */
export function multTeknologi(state: GameState, id: TahapId, cfg: KonfigEkonomi = EKONOMI): number {
  let mult = 1;
  for (const t of TEKNOLOGI_IDS) if (state.terminal.teknologi[t] && cfg.teknologi[t].tahap === id) mult *= cfg.teknologi[t].multKapasitas;
  return mult;
}

/** Banyaknya jalur bus paling banyak (jalur awal + yang bisa dibangun). */
export function jumlahJalurMaks(cfg: KonfigEkonomi = EKONOMI): number {
  return 1 + cfg.jalur.biaya.length;
}

/** Pengali kapasitas tahap dari jalur bus: Peron & Keberangkatan naik tiap jalur tambahan, Loket tidak. */
export function multJalur(state: GameState, id: TahapId, cfg: KonfigEkonomi = EKONOMI): number {
  return id === 'loket' ? 1 : 1 + cfg.jalur.bonusKapasitas * (state.terminal.jalur - 1);
}

/** Kapasitas tahap. Loket: dari loket yang disewa PO (loket kosong tidak melayani). */
export function kapasitasTahap(state: GameState, id: TahapId, cfg: KonfigEkonomi = EKONOMI): number {
  if (id === 'loket') {
    const n = loketTerisi(state);
    return n > 0 ? kapasitas('loket', n, cfg) * multTeknologi(state, id, cfg) : 0;
  }
  return kapasitas(id, state.terminal.tahap[id].level, cfg) * multTeknologi(state, id, cfg) * multJalur(state, id, cfg);
}

/** Efek satu fasilitas pada levelnya sekarang (nilaiPerLevel × level; artinya lihat KonfigFasilitas). */
export function nilaiFasilitas(state: GameState, id: FasilitasId, cfg: KonfigEkonomi = EKONOMI): number {
  return cfg.fasilitas[id].nilaiPerLevel * state.terminal.fasilitas[id];
}

/** Harga tiket normal rata-rata per penumpang (semua kursi penuh, harga normal), sebelum harga yang diatur pemain. */
export function nilaiPerPenumpangState(state: GameState, cfg: KonfigEkonomi = EKONOMI): number {
  const s = segmenPotensial(state, cfg);
  return s.terisi > 0 ? s.tiket / s.terisi : 0;
}

/** Belanja per penumpang di kios (jadi sewa harian): level kios × (1 + bonus toilet & musholla). */
export function belanjaKiosPerPenumpang(state: GameState, cfg: KonfigEkonomi = EKONOMI): number {
  return nilaiFasilitas(state, 'kios', cfg) * (1 + nilaiFasilitas(state, 'toilet', cfg));
}

/** Retribusi per bus yang parkir (Rp). */
export function tarifRetribusiPerBus(state: GameState, cfg: KonfigEkonomi = EKONOMI): number {
  return nilaiFasilitas(state, 'retribusi', cfg);
}

/**
 * Pendapatan per detik dari tiap sumber (sudah × Renovasi, level terminal, event
 * musiman & kepuasan, belum × boost): tiket di loket PO, retribusi tiap bus
 * parkir, parkir kendaraan pengantar, dan belanja kios yang terkumpul lalu
 * dibayar sebagai sewa harian. Toilet & musholla tidak menghasilkan uang; ia
 * menaikkan belanja di kios.
 */
export interface RincianPendapatan {
  readonly tiket: Decimal;
  readonly retribusi: Decimal;
  readonly parkir: Decimal;
  readonly sewaKios: Decimal;
}

/** Uang lain per penumpang selain tiket (parkir bus dibagi rata ke penumpangnya, parkir kendaraan, belanja kios). */
function lainPerPenumpang(state: GameState, cfg: KonfigEkonomi): number {
  return tarifRetribusiPerBus(state, cfg) / cfg.penumpangPerBus + nilaiFasilitas(state, 'parkir', cfg) + belanjaKiosPerPenumpang(state, cfg);
}

export function rincianPendapatan(state: GameState, mode: ModeThroughput = 'potensial', cfg: KonfigEkonomi = EKONOMI): RincianPendapatan {
  const { arus, tiketPerPenumpang } = arusDanTiket(state, mode, cfg);
  const mult = pengaliPendapatan(state, cfg);
  const per = (rpPerPenumpang: number): Decimal => mult.times(arus * rpPerPenumpang);
  return {
    tiket: per(tiketPerPenumpang),
    retribusi: per(tarifRetribusiPerBus(state, cfg) / cfg.penumpangPerBus),
    parkir: per(nilaiFasilitas(state, 'parkir', cfg)),
    sewaKios: per(belanjaKiosPerPenumpang(state, cfg)),
  };
}

/** Pengali bonus Renovasi (+bonusPrestige per poin). */
export function multRenovasi(state: GameState, cfg: KonfigEkonomi = EKONOMI): Decimal {
  return multiplierPrestige(state.renovasi.poin, cfg);
}

/** Pengali semua pendapatan (Renovasi × level terminal × event musiman × kepuasan), belum × boost. */
export function pengaliPendapatan(state: GameState, cfg: KonfigEkonomi = EKONOMI): Decimal {
  return multRenovasi(state, cfg).times(pengaliLevelTerminal(levelTerminal(state, cfg), cfg) * pengaliEvent(state, cfg) * pengaliKepuasan(state, cfg));
}

/**
 * Kepuasan penumpang sekarang (lihat sim/kepuasan.ts). Tiket yang terlalu mahal
 * tidak lagi menurunkan kepuasan terminal: di v2 ia menurunkan reputasi PO-nya.
 */
export function kepuasanTerminal(state: GameState, cfg: KonfigEkonomi = EKONOMI): Kepuasan {
  const kap = semuaKapasitas(state, cfg);
  return hitungKepuasan(
    {
      kapasitas: TAHAP_IDS.map((id) => kap[id]),
      arus: throughput(kap),
      levelFasilitas: state.terminal.fasilitas.kios + state.terminal.fasilitas.toilet,
      jalur: state.terminal.jalur,
      jalurMaks: jumlahJalurMaks(cfg),
    },
    cfg,
  );
}

/** Bonus pendapatan dari kepuasan (0 di bawah bonusMulai, bonusPendapatan di 100 %). */
export function bonusKepuasan(nilai: number, cfg: KonfigEkonomi = EKONOMI): number {
  const k = cfg.kepuasan;
  return k.bonusPendapatan * Math.max(0, (nilai - k.bonusMulai) / (1 - k.bonusMulai));
}

/** Pengali semua pendapatan dari kepuasan penumpang (1 … 1 + bonusPendapatan). */
export function pengaliKepuasan(state: GameState, cfg: KonfigEkonomi = EKONOMI): number {
  return 1 + bonusKepuasan(kepuasanTerminal(state, cfg).nilai, cfg);
}

/** Daya tarik terminal dari kepuasan (dasar … dasar + perKepuasan): calon penumpang di jam tersibuk ÷ kapasitas. */
export function dayaTarikKepuasan(nilai: number, cfg: KonfigEkonomi = EKONOMI): number {
  return cfg.permintaan.dasar + cfg.permintaan.perKepuasan * nilai;
}

/** Permintaan dari kepuasan yang sudah dihitung (tick memakainya supaya kepuasan tidak dihitung dua kali). */
function permintaanDari(state: GameState, kepuasan: number, cfg: KonfigEkonomi): number {
  const p = cfg.permintaan;
  const ritme = p.ritmeMin + (1 - p.ritmeMin) * keramaianTerminal(waktuTerminalState(state));
  return dayaTarikKepuasan(kepuasan, cfg) * ritme;
}

/**
 * Calon penumpang yang datang sekarang dibanding kapasitas terminal: daya tarik
 * kepuasan × ritme jam & hari. Ritmenya dilandaikan dari keramaian di adegan
 * (ritmeMin): malam berangsur sepi tapi terminal tidak pernah berhenti.
 * Lebih dari 1 = lebih banyak dari yang bisa dilayani (antre di tahap paling lambat).
 */
export function permintaanPenumpang(state: GameState, cfg: KonfigEkonomi = EKONOMI): number {
  return permintaanDari(state, kepuasanTerminal(state, cfg).nilai, cfg);
}

/** Bagian kursi (kapasitas) yang terisi sekarang, 0–1: penumpang yang datang menurut kepuasan, jam, reputasi, & harga tiket. */
export function keterisianTerminal(state: GameState, cfg: KonfigEkonomi = EKONOMI): number {
  return segmenState(state, permintaanPenumpang(state, cfg), cfg).terisi;
}

/** Uang yang langsung masuk per detik (tiket + retribusi + parkir), belum × boost. */
export function pendapatanLangsungPerDetik(state: GameState, mode: ModeThroughput = 'potensial', cfg: KonfigEkonomi = EKONOMI): Decimal {
  const r = rincianPendapatan(state, mode, cfg);
  return r.tiket.add(r.retribusi).add(r.parkir);
}

export function semuaKapasitas(state: GameState, cfg: KonfigEkonomi = EKONOMI): KapasitasPerTahap {
  return petakanTahap((id) => kapasitasTahap(state, id, cfg));
}

/** Ketiga tahap punya Kepala: terminal tetap berjalan saat game ditutup. */
export function semuaOtomatis(state: GameState): boolean {
  return TAHAP_IDS.every((id) => state.terminal.tahap[id].kepala.direkrut);
}

export function throughputState(state: GameState, mode: ModeThroughput = 'potensial', cfg: KonfigEkonomi = EKONOMI): number {
  return arusDanTiket(state, mode, cfg).arus;
}

/** Arus penumpang (pnp/dtk) & tiket rata-rata yang dibayar per penumpang (Rp) menurut mode. */
function arusDanTiket(state: GameState, mode: ModeThroughput, cfg: KonfigEkonomi): { arus: number; tiketPerPenumpang: number } {
  if (mode === 'offline' && !semuaOtomatis(state)) return { arus: 0, tiketPerPenumpang: 0 };
  const kap = throughput(semuaKapasitas(state, cfg));
  const dari = (s: HasilSegmen): { arus: number; tiketPerPenumpang: number } => ({ arus: kap * s.terisi, tiketPerPenumpang: s.terisi > 0 ? s.tiket / s.terisi : 0 });
  if (mode === 'potensial') return dari(segmenPotensial(state, cfg));
  if (mode === 'aktif') return dari(segmenState(state, permintaanPenumpang(state, cfg), cfg));
  // Offline: Kepala menjalankan terminal tanpa jam & kepuasan; penumpang tetap memilih menurut harga, tapi
  // hasilnya tidak pernah melebihi harga normal (harga tinggi tidak bisa dipakai untuk menimbun uang saat pergi).
  const pemain = segmenState(state, 1, cfg);
  const normal = segmenState(state, 1, cfg, { hargaNormal: true });
  const lain = lainPerPenumpang(state, cfg);
  const nilai = (s: HasilSegmen): number => s.tiket + s.terisi * lain;
  return dari(nilai(pemain) <= nilai(normal) ? pemain : normal);
}

/** Rata-rata pendapatan per detik dari semua sumber (belum × boost). */
export function pendapatanPerDetikState(state: GameState, mode: ModeThroughput = 'potensial', cfg: KonfigEkonomi = EKONOMI): Decimal {
  // Rata-rata semua sumber, termasuk sewa kios yang dibayar harian (dasar offline & hadiah "N menit pendapatan").
  const r = rincianPendapatan(state, mode, cfg);
  return r.tiket.add(r.retribusi).add(r.parkir).add(r.sewaKios);
}

/** Pendapatan tiket potensial PO ini per detik (harga normal, sudah × pengali): dasar biaya perpanjang kontrak. */
export function pendapatanPoPerDetik(state: GameState, id: PoId, cfg: KonfigEkonomi = EKONOMI): Decimal {
  const s = segmenPotensial(state, cfg);
  const po = s.po.find((p) => p.id === id);
  if (!po) return new Decimal(0);
  return pengaliPendapatan(state, cfg).times(throughput(semuaKapasitas(state, cfg)) * po.tiket);
}

/** Semua tahap yang sedang jadi bottleneck (berdasarkan kapasitas), urut rantai. */
export function daftarBottleneckState(state: GameState, cfg: KonfigEkonomi = EKONOMI): TahapId[] {
  return daftarBottleneck(semuaKapasitas(state, cfg));
}

export function tahapBottleneck(state: GameState, cfg: KonfigEkonomi = EKONOMI): TahapId {
  // daftarBottleneck tidak pernah kosong: minimum selalu ada di dalam daftar.
  return daftarBottleneckState(state, cfg)[0]!;
}

export function biayaUpgradeState(state: GameState, id: TahapId, cfg: KonfigEkonomi = EKONOMI): Decimal {
  return biayaUpgrade(id, state.terminal.tahap[id].level, cfg);
}

// ---------------------------------------------------------------------------
// Simulasi

/**
 * Majukan simulasi sebanyak `dtDetik`. Dipanggil dengan fixed timestep
 * (lihat `majukanWaktu` di loop.ts), tapi tetap benar untuk dt berapa pun.
 *
 * Semua tahap selalu berjalan. Arusnya = penumpang yang datang (kepuasan, jam,
 * reputasi & harga tiket per PO; lihat sim/segmen.ts), paling banyak sebesar
 * kapasitas.
 *
 * Uang masuk per transaksi (lihat TransaksiState): tiap penumpang yang membeli
 * tiket membayar tiket & parkir kendaraan pengantarnya dan berbelanja di kios
 * (dikumpulkan jadi sewa harian); tiap bus membayar parkir bus. Totalnya sama
 * dengan arus × harga; hanya dicairkan per kejadian.
 *
 * Ekonomi v2 juga dimajukan di sini: XP PO dari bus yang datang, XP terminal
 * dari penumpang, reputasi PO, sisa kontrak, proyek perluasan, dan Kepala
 * Kemitraan (isi loket kosong & perpanjang kontrak).
 */
export function tick(state: GameState, dtDetik: number, cfg: KonfigEkonomi = EKONOMI): GameState {
  if (!(dtDetik > 0)) return state;

  const kap = semuaKapasitas(state, cfg);
  const thr = throughput(kap);
  const kepuasan = kepuasanTerminal(state, cfg);
  const seg = segmenState(state, permintaanDari(state, kepuasan.nilai, cfg), cfg);
  const arus = thr * seg.terisi;
  const tiketPerPenumpang = seg.terisi > 0 ? seg.tiket / seg.terisi : 0;

  const penumpang = arus * dtDetik;
  const sisaPenumpang = state.transaksi.sisaPenumpang + penumpang;
  const tiket = Math.floor(sisaPenumpang + EPSILON_TRANSAKSI);
  const sisaBus = state.transaksi.sisaBus + penumpang;
  const bus = Math.floor(sisaBus / cfg.penumpangPerBus + EPSILON_TRANSAKSI);
  const transaksi: TransaksiState = {
    sisaPenumpang: Math.max(0, sisaPenumpang - tiket),
    sisaBus: Math.max(0, sisaBus - bus * cfg.penumpangPerBus),
  };
  const mult = tiket > 0 || bus > 0 ? pengaliPendapatan(state, cfg).times(pengaliBoost(state, cfg)) : null;
  const perPenumpang = tiketPerPenumpang + nilaiFasilitas(state, 'parkir', cfg);
  const pendapatan = mult ? mult.times(perPenumpang * tiket + tarifRetribusiPerBus(state, cfg) * bus) : new Decimal(0);
  const omzetKios = mult ? mult.times(belanjaKiosPerPenumpang(state, cfg) * tiket) : new Decimal(0);

  const waktuMainDetik = state.statistik.waktuMainDetik + dtDetik;
  // Pendapatan operasi tick ini (sewa kios dihitung saat belanjanya, bukan saat dibayar).
  const dapat = pendapatan.add(omzetKios).toNumber();
  const dasar: GameState = {
    ...state,
    transaksi,
    statistik: { ...state.statistik, waktuMainDetik, totalPenumpang: state.statistik.totalPenumpang + penumpang },
    harian: majukanHarian(state, waktuMainDetik, penumpang, cfg),
    hadiah: majukanHadiah(state, dtDetik, cfg),
    event: state.event.aktif && penumpang > 0 ? { ...state.event, progres: state.event.progres + penumpang } : state.event,
    rekor: majukanRekor(state.rekor, waktuTerminal(waktuMainDetik).hariKe, penumpang, dapat, throughputState(state, 'potensial', cfg)),
    tantangan: majukanTantangan(state, penumpang, dapat, dtDetik, cfg),
    mitra: majukanMitra(state.mitra, seg, thr, kepuasan.nilai, dtDetik, 1, cfg),
    perkembangan: majukanPerkembangan(state.perkembangan, penumpang, dtDetik),
  };
  const denganSewa = majukanSewaKios(dasar, omzetKios, waktuTerminal(state.statistik.waktuMainDetik).hariKe, waktuTerminal(waktuMainDetik).hariKe);
  return perbaruiPencapaian(urusKontrak(kepalaKemitraan(tambahPendapatan(denganSewa, pendapatan), cfg), cfg), cfg);
}

/**
 * XP PO dari bus yang datang (1 XP per penumpangPerBus penumpangnya) dan
 * reputasi PO menuju targetnya. `efisiensi` < 1 untuk penghasilan offline.
 */
function majukanMitra(m: MitraState, seg: HasilSegmen, thr: number, kepuasan: number, dt: number, efisiensi: number, cfg: KonfigEkonomi): MitraState {
  if (m.terdaftar.length === 0) return m;
  const terdaftar = m.terdaftar.map((p, i) => {
    const h = seg.po[i];
    if (!h) return p;
    const bus = (thr * h.terisi * dt * efisiensi) / cfg.penumpangPerBus;
    const reputasi = majukanReputasi(p.reputasi, targetReputasi(kepuasan, h.hargaRataPersen, h.kelas.length, cfg), dt, cfg);
    return { ...p, xp: p.xp + bus, reputasi, kontrakDetik: efisiensi < 1 ? p.kontrakDetik : p.kontrakDetik - dt };
  });
  return { ...m, terdaftar };
}

/** XP terminal dari penumpang; proyek perluasan selesai setelah waktunya habis. */
function majukanPerkembangan(p: PerkembanganState, penumpang: number, dt: number): PerkembanganState {
  let x = p;
  if (penumpang > 0) x = { ...x, xpTerminal: x.xpTerminal + penumpang };
  if (x.proyekDetik > 0) {
    const sisa = x.proyekDetik - dt;
    x = sisa > 1e-9 ? { ...x, proyekDetik: sisa } : { ...x, proyekDetik: 0, perluasan: x.perluasan + 1 };
  }
  return x;
}

/** Hitungan harian & rekor: saat hari terminal berganti, hari yang lewat dibandingkan dengan rekornya. */
function majukanRekor(r: RekorState, hariKe: number, penumpang: number, pendapatan: number, arus: number): RekorState {
  let x = r;
  if (hariKe !== r.hariKe) {
    x = {
      ...r,
      hariKe,
      penumpangHariIni: 0,
      pendapatanHariIni: 0,
      penumpangHarian: Math.max(r.penumpangHarian, r.penumpangHariIni),
      pendapatanHarian: Math.max(r.pendapatanHarian, r.pendapatanHariIni),
    };
  }
  if (penumpang > 0 || pendapatan > 0) x = { ...x, penumpangHariIni: x.penumpangHariIni + penumpang, pendapatanHariIni: x.pendapatanHariIni + pendapatan };
  return arus > x.arusTertinggi ? { ...x, arusTertinggi: arus } : x;
}

/** Kemajuan tantangan mingguan dari satu tick main aktif. */
function majukanTantangan(state: GameState, penumpang: number, pendapatan: number, dt: number, cfg: KonfigEkonomi): TantanganState {
  let t = state.tantangan;
  if (t.minggu === null) return t;
  if (penumpang > 0) t = { ...t, penumpang: t.penumpang + penumpang };
  t = tambahProgresTantangan(t, 'penumpang', penumpang);
  t = tambahProgresTantangan(t, 'pendapatan', pendapatan);
  if (t.daftar.some((x) => x.jenis === 'kepuasan' && x.progres < x.target) && kepuasanTerminal(state, cfg).nilai >= cfg.tantangan.kepuasanMin) {
    t = tambahProgresTantangan(t, 'kepuasan', dt);
  }
  return t;
}

/** Tambah kemajuan tantangan jenis ini (yang belum tercapai); state sama persis kalau tidak ada. */
export function tambahProgresTantangan(t: TantanganState, jenis: JenisTantangan, jumlah: number): TantanganState {
  if (!(jumlah > 0)) return t;
  const i = t.daftar.findIndex((x) => x.jenis === jenis && x.progres < x.target);
  if (i < 0) return t;
  return { ...t, daftar: t.daftar.map((x, j) => (j === i ? { ...x, progres: Math.min(x.target, x.progres + jumlah) } : x)) };
}

/** Kumpulkan belanja kios; saat hari berganti, sewa hari yang lewat dibayar ke terminal. */
function majukanSewaKios(state: GameState, omzet: Decimal, hariLama: number, hariBaru: number): GameState {
  const k = state.sewaKios;
  const terkumpul = omzet.gt(0) ? k.terkumpul.add(omzet) : k.terkumpul;
  if (hariBaru === hariLama) return terkumpul === k.terkumpul ? state : { ...state, sewaKios: { ...k, terkumpul } };
  const dibayar = { ...state, sewaKios: { terkumpul: new Decimal(0), terakhir: terkumpul, hariTerakhir: hariLama } };
  return terkumpul.gt(0) ? tambahPendapatan(dibayar, terkumpul) : dibayar;
}

// ---------------------------------------------------------------------------
// Target harian

/** Bulatkan ke 2 angka penting (target yang enak dibaca: 31.000, bukan 31.680). */
function bulatkanTarget(n: number): number {
  if (n < 100) return Math.max(10, Math.round(n / 10) * 10);
  const skala = Math.pow(10, Math.floor(Math.log10(n)) - 1);
  return Math.round(n / skala) * skala;
}

/** Target baru untuk hari ke-`hariKe`: upgrade (hari genap) atau penumpang (hari ganjil). */
export function buatTargetHarian(state: GameState, hariKe: number, cfg: KonfigEkonomi = EKONOMI): HarianState {
  const jenis: JenisTarget = hariKe % 2 === 0 ? 'upgrade' : 'penumpang';
  const target = jenis === 'upgrade' ? cfg.harian.targetUpgrade : bulatkanTarget(throughputState(state, 'potensial', cfg) * DETIK_SEHARI * cfg.harian.fraksiPenumpang);
  return { hariKe, jenis, target, progres: 0, diklaim: false, jumlahSelesai: state.harian.jumlahSelesai };
}

function tambahProgres(h: HarianState, jumlah: number): HarianState {
  if (h.progres >= h.target || !(jumlah > 0)) return h;
  const progres = Math.min(h.target, h.progres + jumlah);
  return { ...h, progres, jumlahSelesai: h.jumlahSelesai + (progres >= h.target ? 1 : 0) };
}

/** Ganti target saat hari terminal berganti; tambah progres target penumpang. */
function majukanHarian(state: GameState, waktuMainDetik: number, penumpang: number, cfg: KonfigEkonomi): HarianState {
  const hariKe = waktuTerminal(waktuMainDetik).hariKe;
  if (hariKe !== state.harian.hariKe) return buatTargetHarian(state, hariKe, cfg);
  return state.harian.jenis === 'penumpang' ? tambahProgres(state.harian, penumpang) : state.harian;
}

export function targetHarianSelesai(state: GameState): boolean {
  return state.harian.progres >= state.harian.target;
}

/** Hadiah = sekian menit pendapatan potensial saat ini (minimal Rp 50). */
export function hadiahMenit(state: GameState, menit: number, cfg: KonfigEkonomi = EKONOMI): Decimal {
  return pendapatanPerDetikState(state, 'potensial', cfg).times(menit * 60).max(50).floor();
}

export function bisaKlaimTarget(state: GameState): boolean {
  return targetHarianSelesai(state) && !state.harian.diklaim;
}

/** @param ganda hadiah 2× (setelah menonton iklan berhadiah). */
export function klaimTarget(state: GameState, cfg: KonfigEkonomi = EKONOMI, ganda = false): GameState {
  if (!bisaKlaimTarget(state)) return state;
  const hadiah = hadiahMenit(state, cfg.harian.hadiahMenit, cfg).times(ganda ? 2 : 1);
  return { ...tambahPendapatan(state, hadiah), harian: { ...state.harian, diklaim: true } };
}

/** Upgrade (tahap atau loket) menambah progres target harian "upgrade" & tantangan mingguan "upgrade". */
function catatUpgrade(state: GameState): GameState {
  return {
    ...state,
    harian: state.harian.jenis === 'upgrade' ? tambahProgres(state.harian, 1) : state.harian,
    tantangan: tambahProgresTantangan(state.tantangan, 'upgrade', 1),
  };
}

// ---------------------------------------------------------------------------
// Pencapaian

/** Catat pencapaian yang syaratnya baru terpenuhi (state sama persis kalau tidak ada). */
export function perbaruiPencapaian(state: GameState, cfg: KonfigEkonomi = EKONOMI): GameState {
  const baru = PENCAPAIAN_IDS.filter((id) => !state.pencapaian.tercapai.includes(id) && SYARAT_PENCAPAIAN[id](state, cfg));
  if (baru.length === 0) return state;
  return { ...state, pencapaian: { ...state.pencapaian, tercapai: [...state.pencapaian.tercapai, ...baru] } };
}

export function bisaKlaimPencapaian(state: GameState, id: PencapaianId): boolean {
  return state.pencapaian.tercapai.includes(id) && !state.pencapaian.diklaim.includes(id);
}

/** @param ganda hadiah 2× (setelah menonton iklan berhadiah). */
export function klaimPencapaian(state: GameState, id: PencapaianId, cfg: KonfigEkonomi = EKONOMI, ganda = false): GameState {
  if (!bisaKlaimPencapaian(state, id)) return state;
  return {
    ...tambahPendapatan(state, hadiahMenit(state, cfg.hadiahMenitPencapaian, cfg).times(ganda ? 2 : 1)),
    pencapaian: { ...state.pencapaian, diklaim: [...state.pencapaian.diklaim, id] },
  };
}

// ---------------------------------------------------------------------------
// Mitra PO: daftar, putus, perpanjang, loket, harga

/** Ganti daftar PO & loket kosong sekaligus, menjaga level tahap Loket tetap sinkron. */
function denganMitra(state: GameState, mitra: MitraState, loketKosong: number = state.terminal.loketKosong, loketBaruDibangun = 0): GameState {
  const terminal = { ...state.terminal, loketKosong: Math.max(0, loketKosong) };
  const level = state.terminal.tahap.loket.level + loketBaruDibangun;
  const denganLevel = { ...terminal, tahap: { ...terminal.tahap, loket: { ...terminal.tahap.loket, level } } };
  return { ...state, mitra, terminal: aturLevelLoket(denganLevel, mitra) };
}

function gantiPo(state: GameState, id: PoId, ubah: (p: PoTerdaftar) => PoTerdaftar): MitraState {
  return { ...state.mitra, terdaftar: state.mitra.terdaftar.map((p) => (p.id === id ? ubah(p) : p)) };
}

/** Syarat yang masih kurang untuk mendaftarkan PO ini (null = boleh, tinggal uangnya). */
export type KurangDaftarPo = SyaratDaftarKurang | { readonly jenis: 'terdaftar' } | { readonly jenis: 'slot' } | { readonly jenis: 'jeda'; readonly sampaiDetik: number };

export function syaratDaftarPoKurang(state: GameState, id: PoId, cfg: KonfigEkonomi = EKONOMI): KurangDaftarPo | null {
  if (cariPo(state, id)) return { jenis: 'terdaftar' };
  const syarat = syaratDaftarKurang(id, { kelasTerminal: kelasTerminal(state, cfg), kepuasan: kepuasanTerminal(state, cfg).nilai, hadiahEvent: state.mitra.hadiahEvent.includes(id) }, cfg);
  if (syarat) return syarat;
  const jeda = state.mitra.jedaSampai[id];
  if (jeda !== undefined && jeda > state.statistik.waktuMainDetik) return { jenis: 'jeda', sampaiDetik: jeda };
  if (state.mitra.terdaftar.length >= slotPoState(state, cfg)) return { jenis: 'slot' };
  return null;
}

export function bisaDaftarPo(state: GameState, id: PoId, cfg: KonfigEkonomi = EKONOMI): boolean {
  return syaratDaftarPoKurang(state, id, cfg) === null && state.uang.gte(biayaDaftarPo(id, cfg));
}

/**
 * Daftarkan PO: menempati slot dan langsung menyewa loket bawaannya. Loket
 * kosong dipakai lebih dulu; kekurangannya dibangun PO sendiri (pemain tidak
 * membayar, tapi loket milik terminal bertambah). Riwayat dilanjutkan.
 */
export function daftarPo(state: GameState, id: PoId, cfg: KonfigEkonomi = EKONOMI): GameState {
  if (!bisaDaftarPo(state, id, cfg)) return state;
  const bawaan = tingkatPo(id, cfg).loketBawaan;
  const dariKosong = Math.min(state.terminal.loketKosong, bawaan);
  const riwayat = { ...state.mitra.riwayat };
  const lama = riwayat[id];
  delete riwayat[id];
  const mitra: MitraState = { ...state.mitra, riwayat, terdaftar: [...state.mitra.terdaftar, buatPoTerdaftar(id, bawaan, cfg, lama)] };
  const s = denganMitra({ ...state, uang: kurangiUang(state.uang, biayaDaftarPo(id, cfg)) }, mitra, state.terminal.loketKosong - dariKosong, bawaan - dariKosong);
  return isiLoketKosong(s, null, cfg);
}

/** PO keluar (putus atau kontrak habis): loketnya jadi kosong, data PO disimpan di riwayat. */
function keluarkanPo(state: GameState, id: PoId, putus: boolean, cfg: KonfigEkonomi): GameState {
  const p = cariPo(state, id);
  if (!p) return state;
  const k = cfg.mitra.kontrak;
  const riwayat = { ...state.mitra.riwayat, [id]: { xp: p.xp, reputasi: Math.max(0, p.reputasi - (putus ? k.penaltiReputasiPutus : 0)), rekorLoket: p.rekorLoket, harga: p.harga } };
  const jedaSampai = putus ? { ...state.mitra.jedaSampai, [id]: state.statistik.waktuMainDetik + k.jedaPutusHari * DETIK_SEHARI } : state.mitra.jedaSampai;
  const mitra: MitraState = { ...state.mitra, riwayat, jedaSampai, terdaftar: state.mitra.terdaftar.filter((x) => x.id !== id) };
  return denganMitra(state, mitra, state.terminal.loketKosong + p.loket);
}

/** PO terakhir tidak bisa diputus: terminal selalu punya minimal satu PO. */
export function bisaPutusPo(state: GameState, id: PoId): boolean {
  return cariPo(state, id) !== undefined && state.mitra.terdaftar.length > 1;
}

/** Putus kontrak: gratis, PO langsung keluar, reputasinya turun, dan tidak bisa didaftarkan lagi selama masa jeda. */
export function putusPo(state: GameState, id: PoId, cfg: KonfigEkonomi = EKONOMI): GameState {
  if (!bisaPutusPo(state, id)) return state;
  return keluarkanPo(state, id, true, cfg);
}

export function biayaPerpanjangPo(state: GameState, id: PoId, cfg: KonfigEkonomi = EKONOMI): Decimal {
  return biayaPerpanjang(pendapatanPoPerDetik(state, id, cfg), cfg);
}

/** Sisa kontrak sudah maksimal, atau PO premium menolak karena kepuasan kurang. */
export function bisaPerpanjangPo(state: GameState, id: PoId, cfg: KonfigEkonomi = EKONOMI): boolean {
  const p = cariPo(state, id);
  if (!p) return false;
  const k = cfg.mitra.kontrak;
  if (p.kontrakDetik >= k.hariMaks * DETIK_SEHARI - 1e-6) return false;
  const min = cfg.mitra.po[id].kepuasanMin;
  if (min !== undefined && kepuasanTerminal(state, cfg).nilai < min) return false;
  return state.uang.gte(biayaPerpanjangPo(state, id, cfg));
}

export function perpanjangPo(state: GameState, id: PoId, cfg: KonfigEkonomi = EKONOMI): GameState {
  if (!bisaPerpanjangPo(state, id, cfg)) return state;
  const biaya = biayaPerpanjangPo(state, id, cfg);
  const mitra = gantiPo(state, id, (p) => ({ ...p, kontrakDetik: sisaSetelahPerpanjang(p.kontrakDetik / DETIK_SEHARI, cfg) * DETIK_SEHARI }));
  return { ...state, uang: kurangiUang(state.uang, biaya), mitra };
}

/**
 * Kontrak yang habis: PO keluar, kecuali PO terakhir (diperpanjang gratis supaya
 * terminal tidak pernah tanpa PO).
 */
function urusKontrak(state: GameState, cfg: KonfigEkonomi): GameState {
  if (!state.mitra.terdaftar.some((p) => p.kontrakDetik <= 0)) return state;
  let s = state;
  for (const p of state.mitra.terdaftar) {
    if (p.kontrakDetik > 0) continue;
    if (s.mitra.terdaftar.length > 1) s = keluarkanPo(s, p.id, false, cfg);
    else s = { ...s, mitra: gantiPo(s, p.id, (x) => ({ ...x, kontrakDetik: x.kontrakDetik + cfg.mitra.kontrak.hari * DETIK_SEHARI })) };
  }
  return s;
}

/** Kepala Kemitraan (Kepala Loket): isi loket kosong, dan perpanjang kontrak yang tinggal ≤ 1 hari bila uang cukup. */
function kepalaKemitraan(state: GameState, cfg: KonfigEkonomi): GameState {
  if (!state.terminal.tahap.loket.kepala.direkrut) return state;
  let s = state.terminal.loketKosong > 0 ? isiLoketKosong(state, null, cfg) : state;
  for (const p of s.mitra.terdaftar) if (p.kontrakDetik <= DETIK_SEHARI && bisaPerpanjangPo(s, p.id, cfg)) s = perpanjangPo(s, p.id, cfg);
  return s;
}

/** Nilai tiket per kursi tiap PO (semua kursi penuh, harga normal): PO mana yang paling menguntungkan diberi loket. */
function nilaiKursiPo(state: GameState, cfg: KonfigEkonomi): Map<PoId, number> {
  const s = segmenPotensial(state, cfg);
  const hasil = new Map<PoId, number>();
  for (const p of s.po) hasil.set(p.id, p.kursi > 0 ? p.tiket / p.kursi : 0);
  return hasil;
}

/** PO yang jatahnya masih ada, urut paling menguntungkan per kursi. */
function poBerjatah(state: GameState, cfg: KonfigEkonomi): PoTerdaftar[] {
  const nilai = nilaiKursiPo(state, cfg);
  return state.mitra.terdaftar.filter((p) => p.loket < jatahLoketPo(state, p, cfg)).sort((a, b) => (nilai.get(b.id) ?? 0) - (nilai.get(a.id) ?? 0));
}

/** PO yang akan menerima loket baru bila tidak dipilih: yang jatahnya masih ada dan paling menguntungkan. */
export function poTujuanLoket(state: GameState, cfg: KonfigEkonomi = EKONOMI): PoId | null {
  return poBerjatah(state, cfg)[0]?.id ?? null;
}

/** Biaya loket berikutnya (dari banyaknya loket milik terminal). */
export function biayaLoketBaru(state: GameState, cfg: KonfigEkonomi = EKONOMI): Decimal {
  return biayaUpgradeState(state, 'loket', cfg);
}

export function bisaBangunLoket(state: GameState, po: PoId | null = null, cfg: KonfigEkonomi = EKONOMI): boolean {
  const tujuan = po ?? poTujuanLoket(state, cfg);
  const p = tujuan ? cariPo(state, tujuan) : undefined;
  return p !== undefined && p.loket < jatahLoketPo(state, p, cfg) && state.uang.gte(biayaLoketBaru(state, cfg));
}

/**
 * Bangun satu loket untuk PO (bawaan: yang paling menguntungkan). Loket yang
 * melampaui rekor PO itu memberi XP (lihat xpLoketBaru).
 */
export function bangunLoket(state: GameState, po: PoId | null = null, cfg: KonfigEkonomi = EKONOMI): GameState {
  if (!bisaBangunLoket(state, po, cfg)) return state;
  const tujuan = (po ?? poTujuanLoket(state, cfg))!;
  const biaya = biayaLoketBaru(state, cfg);
  const mitra = gantiPo(state, tujuan, (p) => {
    const loket = p.loket + 1;
    const xp = loket > p.rekorLoket ? xpLoketBaru(levelPo(p, cfg), cfg) : 0;
    return { ...p, loket, rekorLoket: Math.max(p.rekorLoket, loket), xp: p.xp + xp };
  });
  return catatUpgrade(denganMitra({ ...state, uang: kurangiUang(state.uang, biaya) }, mitra, state.terminal.loketKosong, 1));
}

/** Isi loket kosong (gratis, tanpa XP) ke PO tertentu atau ke PO yang paling menguntungkan sampai jatahnya penuh. */
export function isiLoketKosong(state: GameState, po: PoId | null = null, cfg: KonfigEkonomi = EKONOMI): GameState {
  let kosong = state.terminal.loketKosong;
  if (kosong <= 0) return state;
  const urutan = po ? state.mitra.terdaftar.filter((p) => p.id === po) : poBerjatah(state, cfg);
  const tambah = new Map<PoId, number>();
  for (const p of urutan) {
    const n = Math.min(kosong, Math.max(0, jatahLoketPo(state, p, cfg) - p.loket));
    if (n > 0) tambah.set(p.id, n);
    kosong -= n;
    if (kosong <= 0) break;
  }
  if (tambah.size === 0) return state;
  const mitra: MitraState = {
    ...state.mitra,
    terdaftar: state.mitra.terdaftar.map((p) => {
      const n = tambah.get(p.id) ?? 0;
      return n > 0 ? { ...p, loket: p.loket + n, rekorLoket: Math.max(p.rekorLoket, p.loket + n) } : p;
    }),
  };
  return denganMitra(state, mitra, kosong);
}

/** Harga tiket dirapikan: kelipatan langkah di antara min & maks (persen harga normal). */
export function rapikanHarga(persen: number, cfg: KonfigEkonomi = EKONOMI): number {
  const h = cfg.harga;
  if (!Number.isFinite(persen)) return 100;
  return Math.min(h.maks, Math.max(h.min, Math.round(persen / h.langkah) * h.langkah));
}

/** Atur harga tiket PO untuk salah satu jurusannya (persen harga normal, dirapikan). */
export function aturHargaPo(state: GameState, id: PoId, jurusan: number, persen: number, cfg: KonfigEkonomi = EKONOMI): GameState {
  const p = cariPo(state, id);
  const nama = cfg.jurusan[jurusan]?.nama;
  if (!p || nama === undefined || !cfg.mitra.po[id].jurusan.includes(nama)) return state;
  const h = rapikanHarga(persen, cfg);
  if ((p.harga[jurusan] ?? 100) === h) return state;
  const harga: Partial<Record<number, number>> = { ...p.harga };
  if (h === 100) delete harga[jurusan];
  else harga[jurusan] = h;
  return { ...state, mitra: gantiPo(state, id, (x) => ({ ...x, harga })) };
}

/** Keramaian tiap jam di hari biasa (Selasa), untuk menilai harga sepanjang hari. */
const KERAMAIAN_SEHARI: readonly number[] = Array.from({ length: 24 }, (_, jam) => keramaianTerminal({ jamDesimal: jam + 0.5, indeksHari: 1 }));

/**
 * Saran harga tiap jurusan PO: yang paling banyak mendatangkan uang tiket PO
 * itu dalam sehari biasa (kepuasan sekarang, harga PO lain tetap), paling
 * tinggi `hargaSaranMaks` supaya reputasinya tidak jatuh. null = jurusan belum dilayani.
 */
export function saranHargaPo(state: GameState, id: PoId, cfg: KonfigEkonomi = EKONOMI): Readonly<Record<number, number>> {
  const p = cariPo(state, id);
  if (!p) return {};
  const h = cfg.harga;
  const tarik = dayaTarikKepuasan(kepuasanTerminal(state, cfg).nilai, cfg);
  const permintaanJam = KERAMAIAN_SEHARI.map((r) => tarik * (cfg.permintaan.ritmeMin + (1 - cfg.permintaan.ritmeMin) * r));
  const indeks = state.mitra.terdaftar.indexOf(p);
  const nilai = (harga: HargaPo): number => {
    const s = { ...state, mitra: gantiPo(state, id, (x) => ({ ...x, harga })) };
    let total = 0;
    for (const d of permintaanJam) total += segmenState(s, d, cfg).po[indeks]!.tiket;
    return total;
  };
  const hasil: Record<number, number> = {};
  for (const j of jurusanAktif(id, levelPo(p, cfg), kelasTerminal(state, cfg), cfg)) {
    let pilih = 100;
    let nilaiPilih = Number.NEGATIVE_INFINITY;
    for (let persen = h.min; persen <= Math.min(h.maks, HARGA_SARAN_MAKS) + 1e-9; persen += h.langkah) {
      const v = nilai({ ...p.harga, [j]: persen });
      if (v > nilaiPilih + 1e-12) {
        nilaiPilih = v;
        pilih = persen;
      }
    }
    hasil[j] = pilih;
  }
  return hasil;
}

/** Saran harga paling tinggi (persen): di atas ini skor harga reputasi turun di bawah separuh. */
const HARGA_SARAN_MAKS = 120;

// ---------------------------------------------------------------------------
// Perluasan terminal

export function bisaMulaiPerluasan(state: GameState, cfg: KonfigEkonomi = EKONOMI): boolean {
  const p = state.perkembangan;
  const biaya = biayaPerluasan(p.perluasan, cfg);
  return p.proyekDetik <= 0 && biaya !== null && levelCukupPerluasan(p.perluasan, levelTerminal(state, cfg), cfg) && state.uang.gte(biaya);
}

/** Bayar & mulai proyek tahap perluasan berikutnya; efeknya aktif setelah proyek selesai (lihat majukanPerkembangan). */
export function mulaiPerluasan(state: GameState, cfg: KonfigEkonomi = EKONOMI): GameState {
  if (!bisaMulaiPerluasan(state, cfg)) return state;
  return {
    ...state,
    uang: kurangiUang(state.uang, biayaPerluasan(state.perkembangan.perluasan, cfg)!),
    perkembangan: { ...state.perkembangan, proyekDetik: cfg.mitra.detikProyek },
  };
}

// ---------------------------------------------------------------------------
// Aksi pemain: tahap, fasilitas, jalur, modernisasi, Kepala

export function bisaUpgrade(state: GameState, id: TahapId, cfg: KonfigEkonomi = EKONOMI): boolean {
  if (id === 'loket') return bisaBangunLoket(state, null, cfg);
  return state.uang.gte(biayaUpgradeState(state, id, cfg));
}

/** Upgrade tahap. Loket: bangun satu loket untuk PO yang paling menguntungkan (lihat bangunLoket). */
export function beliUpgrade(state: GameState, id: TahapId, cfg: KonfigEkonomi = EKONOMI): GameState {
  if (id === 'loket') return bangunLoket(state, null, cfg);
  if (!bisaUpgrade(state, id, cfg)) return state;
  const t = state.terminal.tahap[id];
  return catatUpgrade({ ...ubahTahap(state, id, { ...t, level: t.level + 1 }), uang: kurangiUang(state.uang, biayaUpgradeState(state, id, cfg)) });
}

/** Biaya menaikkan fasilitas dari levelnya sekarang (level 0 = membangun). */
export function biayaFasilitas(state: GameState, id: FasilitasId, cfg: KonfigEkonomi = EKONOMI): Decimal {
  const f = cfg.fasilitas[id];
  return Decimal.pow(f.r, state.terminal.fasilitas[id]).times(f.biayaAwal);
}

export function bisaBangunFasilitas(state: GameState, id: FasilitasId, cfg: KonfigEkonomi = EKONOMI): boolean {
  return state.uang.gte(biayaFasilitas(state, id, cfg));
}

export function bangunFasilitas(state: GameState, id: FasilitasId, cfg: KonfigEkonomi = EKONOMI): GameState {
  if (!bisaBangunFasilitas(state, id, cfg)) return state;
  return {
    ...state,
    uang: kurangiUang(state.uang, biayaFasilitas(state, id, cfg)),
    terminal: { ...state.terminal, fasilitas: { ...state.terminal.fasilitas, [id]: state.terminal.fasilitas[id] + 1 } },
    tantangan: tambahProgresTantangan(state.tantangan, 'fasilitas', 1),
  };
}

/** Biaya membangun jalur bus berikutnya, atau null kalau semua jalur sudah beroperasi. */
export function biayaJalurBerikutnya(state: GameState, cfg: KonfigEkonomi = EKONOMI): Decimal | null {
  const biaya = cfg.jalur.biaya[state.terminal.jalur - 1];
  return biaya === undefined ? null : new Decimal(biaya);
}

export function bisaBukaJalur(state: GameState, cfg: KonfigEkonomi = EKONOMI): boolean {
  const biaya = biayaJalurBerikutnya(state, cfg);
  return biaya !== null && state.uang.gte(biaya);
}

export function bukaJalur(state: GameState, cfg: KonfigEkonomi = EKONOMI): GameState {
  if (!bisaBukaJalur(state, cfg)) return state;
  return {
    ...state,
    uang: kurangiUang(state.uang, biayaJalurBerikutnya(state, cfg)!),
    terminal: { ...state.terminal, jalur: state.terminal.jalur + 1 },
  };
}

/** Jurusan ke-i rute antarpulau (menyeberang dengan feri)? */
export function jurusanAntarpulau(i: number, cfg: KonfigEkonomi = EKONOMI): boolean {
  return cfg.jurusan[i]?.feri !== undefined;
}

/** Banyaknya jurusan Jawa–Bali (bukan antarpulau). */
export function jumlahJurusanDarat(cfg: KonfigEkonomi = EKONOMI): number {
  return cfg.jurusan.filter((j) => j.feri === undefined).length;
}

/** Syarat modernisasi terpenuhi (teknologi pendahulunya sudah dipasang). */
export function syaratTeknologi(state: GameState, id: TeknologiId, cfg: KonfigEkonomi = EKONOMI): boolean {
  const syarat = cfg.teknologi[id].syarat;
  return syarat === null || state.terminal.teknologi[syarat];
}

export function bisaBeliTeknologi(state: GameState, id: TeknologiId, cfg: KonfigEkonomi = EKONOMI): boolean {
  return !state.terminal.teknologi[id] && syaratTeknologi(state, id, cfg) && state.uang.gte(cfg.teknologi[id].biaya);
}

export function beliTeknologi(state: GameState, id: TeknologiId, cfg: KonfigEkonomi = EKONOMI): GameState {
  if (!bisaBeliTeknologi(state, id, cfg)) return state;
  return {
    ...state,
    uang: kurangiUang(state.uang, new Decimal(cfg.teknologi[id].biaya)),
    terminal: { ...state.terminal, teknologi: { ...state.terminal.teknologi, [id]: true } },
  };
}

export function bisaRekrutKepala(state: GameState, id: TahapId, cfg: KonfigEkonomi = EKONOMI): boolean {
  return !state.terminal.tahap[id].kepala.direkrut && state.uang.gte(biayaKepala(id, cfg));
}

export function rekrutKepala(state: GameState, id: TahapId, cfg: KonfigEkonomi = EKONOMI): GameState {
  if (!bisaRekrutKepala(state, id, cfg)) return state;
  const t = state.terminal.tahap[id];
  return {
    ...ubahTahap(state, id, { ...t, kepala: { ...t.kepala, direkrut: true } }),
    uang: kurangiUang(state.uang, biayaKepala(id, cfg)),
  };
}

// ---------------------------------------------------------------------------
// Profil

/** Ganti nama terminal (dirapikan; kosong = nama bawaan). */
export function aturNamaTerminal(state: GameState, nama: string): GameState {
  const namaTerminal = rapikanNamaTerminal(nama);
  return namaTerminal === state.profil.namaTerminal ? state : { ...state, profil: { ...state.profil, namaTerminal } };
}

/** Ikut/keluar papan peringkat (UI baru mengirimnya setelah pemain login & menyetujui, atau setelah server menghapus skornya). */
export function aturIkutPeringkat(state: GameState, ikut: boolean): GameState {
  return ikut === state.profil.ikutPeringkat ? state : { ...state, profil: { ...state.profil, ikutPeringkat: ikut } };
}

// ---------------------------------------------------------------------------
// Waktu nyata & offline

/** Catat timestamp "terakhir aktif". Panggil sebelum save dan saat pause. */
export function tandaiWaktu(state: GameState, sekarangMs: number): GameState {
  return { ...state, waktuTerakhirMs: sekarangMs };
}

/**
 * Penghasilan selama app tertutup/pause: hanya kalau ketiga tahap punya Kepala
 * (kalau tidak, throughput offline = 0). Jam terminal berhenti selama itu, jadi
 * dihitung dari kapasitas × efisiensiOffline, tanpa ritme jam.
 */
export function hitungOffline(state: GameState, sekarangMs: number, cfg: KonfigEkonomi = EKONOMI): LaporanOffline {
  const detik = detikOffline(sekarangMs, state.waktuTerakhirMs, cfg);
  const laju = pendapatanPerDetikState(state, 'offline', cfg);
  // Boost yang tersisa ikut berjalan (dan habis) selama pemain pergi.
  const detikBoost = Math.min(detik, state.hadiah.boostDetik);
  const pendapatan = pendapatanOffline(laju, detik, cfg).add(pendapatanOffline(laju, detikBoost, cfg).times(cfg.hadiah.pengaliBoost - 1));
  const dibatasi = (sekarangMs - state.waktuTerakhirMs) / 1000 > cfg.batasOfflineDetik;
  return { detik, pendapatan, dibatasi, detikBoost };
}

/**
 * Terapkan penghasilan offline lalu set `waktuTerakhirMs` ke sekarang.
 * Selisih waktu negatif menghasilkan 0 (lihat `detikOffline`). XP PO & XP
 * terminal ikut bertambah dengan efisiensi offline, dan proyek perluasan tetap
 * berjalan; kontrak tidak berkurang karena hari terminal berhenti.
 */
export function terapkanOffline(
  state: GameState,
  sekarangMs: number,
  cfg: KonfigEkonomi = EKONOMI,
): { state: GameState; laporan: LaporanOffline } {
  const laporan = hitungOffline(state, sekarangMs, cfg);
  // Bonus 2× offline ditawarkan untuk laporan ini saja; boost berkurang selama pergi.
  const hadiah = { ...state.hadiah, boostDetik: Math.max(0, state.hadiah.boostDetik - laporan.detik), bonusOffline: laporan.pendapatan };
  let ditandai: GameState = { ...tandaiWaktu(state, sekarangMs), hadiah };
  // Proyek perluasan dikerjakan kontraktor: tetap berjalan walau belum semua tahap punya Kepala.
  if (laporan.detik > 0) ditandai = { ...ditandai, perkembangan: majukanPerkembangan(ditandai.perkembangan, 0, laporan.detik) };
  if (laporan.detik > 0 && semuaOtomatis(state)) {
    const kap = throughput(semuaKapasitas(state, cfg));
    const seg = segmenState(state, 1, cfg);
    const e = cfg.efisiensiOffline;
    ditandai = {
      ...ditandai,
      mitra: majukanMitra(ditandai.mitra, seg, kap, kepuasanTerminal(state, cfg).nilai, laporan.detik, e, cfg),
      perkembangan: { ...ditandai.perkembangan, xpTerminal: ditandai.perkembangan.xpTerminal + kap * seg.terisi * laporan.detik * e },
    };
  }
  return {
    state: laporan.pendapatan.gt(0) ? tambahPendapatan(ditandai, laporan.pendapatan) : ditandai,
    laporan,
  };
}

// ---------------------------------------------------------------------------
// Hadiah iklan berhadiah: boost pendapatan, Bus Emas, bonus 2× offline

/** Lama Bus Emas menunggu setelah diketuk (detik main): cukup untuk satu iklan walau dipercepat 3×. */
const DETIK_TAHAN_BUS_EMAS = 600;

/** Pengali pendapatan saat ini (boost aktif = cfg.hadiah.pengaliBoost). */
export function pengaliBoost(state: GameState, cfg: KonfigEkonomi = EKONOMI): number {
  return state.hadiah.boostDetik > 0 ? cfg.hadiah.pengaliBoost : 1;
}

/** Boost masih bisa ditambah (belum mentok batas tumpukan). */
export function bisaAktifkanBoost(state: GameState, cfg: KonfigEkonomi = EKONOMI): boolean {
  return state.hadiah.boostDetik < cfg.hadiah.boostMaksDetik - 1;
}

/** Tambah boost pendapatan (setelah iklan), ditumpuk sampai batas. */
export function aktifkanBoost(state: GameState, cfg: KonfigEkonomi = EKONOMI): GameState {
  if (!bisaAktifkanBoost(state, cfg)) return state;
  const boostDetik = Math.min(cfg.hadiah.boostMaksDetik, state.hadiah.boostDetik + cfg.hadiah.boostPerIklanDetik);
  return { ...state, hadiah: { ...state.hadiah, boostDetik } };
}

export function busEmasAktif(state: GameState): boolean {
  return state.hadiah.busEmas.aktifDetik > 0;
}

/** Hadiah Bus Emas = sekian menit pendapatan saat ini (tanpa boost). */
export function hadiahBusEmas(state: GameState, cfg: KonfigEkonomi = EKONOMI): Decimal {
  return hadiahMenit(state, cfg.hadiah.busEmasMenit, cfg);
}

export function klaimBusEmas(state: GameState, cfg: KonfigEkonomi = EKONOMI): GameState {
  if (!busEmasAktif(state)) return state;
  const b = state.hadiah.busEmas;
  const busEmas = { tungguDetik: selangBusEmas(state, b.jumlah + 1, cfg), aktifDetik: 0, jumlah: b.jumlah + 1 };
  return { ...tambahPendapatan(state, hadiahBusEmas(state, cfg)), hadiah: { ...state.hadiah, busEmas } };
}

/**
 * Pemain mengetuk Bus Emas: bus menunggu selama pemain memutuskan & menonton
 * iklan (hitung mundurnya tidak boleh habis di tengah iklan, apalagi saat 3×).
 */
export function tahanBusEmas(state: GameState): GameState {
  const b = state.hadiah.busEmas;
  if (b.aktifDetik <= 0 || b.aktifDetik >= DETIK_TAHAN_BUS_EMAS) return state;
  return { ...state, hadiah: { ...state.hadiah, busEmas: { ...b, aktifDetik: DETIK_TAHAN_BUS_EMAS } } };
}

/** Pemain menolak Bus Emas ("Nanti"): bus langsung pergi dan dijadwalkan lagi. */
export function lepasBusEmas(state: GameState, cfg: KonfigEkonomi = EKONOMI): GameState {
  const b = state.hadiah.busEmas;
  if (b.aktifDetik <= 0) return state;
  return { ...state, hadiah: { ...state.hadiah, busEmas: { tungguDetik: selangBusEmas(state, b.jumlah + 1, cfg), aktifDetik: 0, jumlah: b.jumlah + 1 } } };
}

export function bisaKlaimBonusOffline(state: GameState): boolean {
  return state.hadiah.bonusOffline.gt(0);
}

/** Klaim penghasilan offline sekali lagi (jadi 2×), setelah iklan. */
export function klaimBonusOffline(state: GameState): GameState {
  if (!bisaKlaimBonusOffline(state)) return state;
  return { ...tambahPendapatan(state, state.hadiah.bonusOffline), hadiah: { ...state.hadiah, bonusOffline: new Decimal(0) } };
}

/** Jeda sampai Bus Emas ke-n muncul: diundi dari benih game (deterministik, beda tiap game). */
function selangBusEmas(state: GameState, n: number, cfg: KonfigEkonomi): number {
  const [a, b] = cfg.hadiah.busEmasSelangDetik;
  const u = (((n + 1) * 0.6180339887 + state.benihCuaca * 1e-4) % 1 + 1) % 1;
  return a + (b - a) * u;
}

/** Boost berkurang; Bus Emas muncul setelah hitung mundur, lalu pergi kalau tidak diketuk. */
function majukanHadiah(state: GameState, dt: number, cfg: KonfigEkonomi): HadiahState {
  const h = state.hadiah;
  const boostDetik = h.boostDetik > 0 ? Math.max(0, h.boostDetik - dt) : 0;
  const b = h.busEmas;
  let busEmas = b;
  if (b.aktifDetik > 0) {
    const aktifDetik = b.aktifDetik - dt;
    busEmas = aktifDetik > 0 ? { ...b, aktifDetik } : { tungguDetik: selangBusEmas(state, b.jumlah + 1, cfg), aktifDetik: 0, jumlah: b.jumlah + 1 };
  } else {
    const tungguDetik = b.tungguDetik - dt;
    busEmas = tungguDetik > 0 ? { ...b, tungguDetik } : { ...b, tungguDetik: 0, aktifDetik: cfg.hadiah.busEmasAktifDetik };
  }
  return boostDetik === h.boostDetik && busEmas === b ? h : { ...h, boostDetik, busEmas };
}

// ---------------------------------------------------------------------------
// Event musiman

/** Pengali semua pendapatan dari event yang sedang berlangsung (1 = tidak ada event). */
export function pengaliEvent(state: GameState, cfg: KonfigEkonomi = EKONOMI): number {
  const a = state.event.aktif;
  return a ? cfg.event[a.id].pengaliPendapatan : 1;
}

/** Target tiap tahap event: arus potensial sekarang × detik main tiap tahap (dibulatkan). */
function targetEvent(state: GameState, id: EventId, cfg: KonfigEkonomi): number[] {
  const arus = Math.max(0.5, throughputState(state, 'potensial', cfg));
  return cfg.event[id].targetDetik.map((d) => bulatkanTarget(arus * d));
}

/**
 * Sesuaikan event dengan jam nyata: mulai (edisi baru: progres dari nol,
 * target ditetapkan dari arus sekarang), lanjut (edisi yang sama setelah
 * dibuka ulang), atau selesai. `uji` = paksa event (server dev, ?event=…).
 */
export function perbaruiEvent(state: GameState, sekarangMs: number, cfg: KonfigEkonomi = EKONOMI, uji: EventId | null = null): GameState {
  const j = uji ? jadwalUji(uji, sekarangMs) : eventPada(sekarangMs);
  const e = state.event;
  if (!j) return e.aktif === null ? state : { ...state, event: { ...e, aktif: null } };
  if (e.aktif?.edisi === j.edisi) return state;
  const aktif: EventAktif = { id: j.id, edisi: j.edisi, selesaiMs: j.selesaiMs };
  if (e.edisi === j.edisi) return { ...state, event: { ...e, aktif } };
  return { ...state, event: { aktif, edisi: j.edisi, progres: 0, diklaim: 0, target: targetEvent(state, j.id, cfg) } };
}

/** Event dari kunci edisi ("mudikLebaran-2027" → mudikLebaran). */
export function idEdisiEvent(edisi: string | null): EventId | null {
  const id = edisi?.split('-')[0];
  return isEventId(id) ? id : null;
}

/** Tahap event berikutnya sudah tercapai & belum diklaim (boleh setelah event selesai). */
export function bisaKlaimEvent(state: GameState): boolean {
  const e = state.event;
  const target = e.target[e.diklaim];
  return e.edisi !== null && target !== undefined && e.progres >= target;
}

/** Hadiah uang tahap event berikutnya (sekian menit pendapatan sekarang). */
export function hadiahTahapEvent(state: GameState, cfg: KonfigEkonomi = EKONOMI): Decimal {
  const id = idEdisiEvent(state.event.edisi);
  return id ? hadiahMenit(state, cfg.event[id].hadiahMenit[state.event.diklaim] ?? 0, cfg) : new Decimal(0);
}

/** Klaim hadiah tahap event berikutnya; tahap terakhir juga membuka PO eksklusif event itu (boleh didaftarkan gratis). */
export function klaimEvent(state: GameState, cfg: KonfigEkonomi = EKONOMI): GameState {
  const id = idEdisiEvent(state.event.edisi);
  if (!id || !bisaKlaimEvent(state)) return state;
  const e = state.event;
  const po = cfg.event[id].po;
  const terakhir = e.diklaim === e.target.length - 1;
  const dapat = tambahPendapatan(state, hadiahTahapEvent(state, cfg));
  const mitra = terakhir && !state.mitra.hadiahEvent.includes(po) ? { ...state.mitra, hadiahEvent: [...state.mitra.hadiahEvent, po] } : state.mitra;
  return { ...dapat, mitra, event: { ...e, diklaim: e.diklaim + 1 } };
}

// ---------------------------------------------------------------------------
// Tantangan mingguan & jam nyata

/** Target tantangan untuk terminal sekarang (dibulatkan supaya enak dibaca). */
function targetTantangan(state: GameState, jenis: JenisTantangan, cfg: KonfigEkonomi): number {
  const t = cfg.tantangan;
  switch (jenis) {
    case 'penumpang':
      return bulatkanTarget(Math.max(0.5, throughputState(state, 'potensial', cfg)) * t.penumpangDetik);
    case 'pendapatan':
      return bulatkanTarget(Math.max(1, pendapatanPerDetikState(state, 'potensial', cfg).toNumber()) * t.pendapatanDetik);
    case 'upgrade':
      return t.upgrade;
    case 'fasilitas':
      return t.fasilitas;
    case 'kepuasan':
      return t.kepuasanDetik;
  }
}

/** Hadiah uang satu tantangan (sekian menit pendapatan sekarang). */
export function hadiahTantangan(state: GameState, cfg: KonfigEkonomi = EKONOMI): Decimal {
  return hadiahMenit(state, cfg.tantangan.hadiahMenit, cfg);
}

/**
 * Sesuaikan tantangan dengan jam nyata: di minggu baru, hadiah tantangan
 * minggu lalu yang sudah tercapai tapi belum diklaim langsung dikirim, lalu
 * tiga tantangan baru dengan target dari keadaan terminal sekarang.
 */
export function perbaruiTantangan(state: GameState, sekarangMs: number, cfg: KonfigEkonomi = EKONOMI): GameState {
  const m = mingguWib(sekarangMs);
  if (state.tantangan.minggu === m.kunci) return state;
  let s = state;
  for (const x of state.tantangan.daftar) if (!x.diklaim && x.progres >= x.target) s = tambahPendapatan(s, hadiahTantangan(s, cfg));
  const daftar = jenisTantanganMinggu(m.kunci).map((jenis): TantanganAktif => ({ jenis, target: targetTantangan(s, jenis, cfg), progres: 0, diklaim: false }));
  return { ...s, tantangan: { minggu: m.kunci, selesaiMs: m.selesaiMs, daftar, penumpang: 0 } };
}

export function bisaKlaimTantangan(state: GameState, indeks: number): boolean {
  const x = state.tantangan.daftar[indeks];
  return x !== undefined && !x.diklaim && x.progres >= x.target;
}

export function klaimTantangan(state: GameState, indeks: number, cfg: KonfigEkonomi = EKONOMI): GameState {
  if (!bisaKlaimTantangan(state, indeks)) return state;
  const daftar = state.tantangan.daftar.map((x, i) => (i === indeks ? { ...x, diklaim: true } : x));
  return { ...tambahPendapatan(state, hadiahTantangan(state, cfg)), tantangan: { ...state.tantangan, daftar } };
}

/** Semua yang mengikuti jam nyata: event musiman & tantangan mingguan (dipanggil sesi). */
export function perbaruiJamNyata(state: GameState, sekarangMs: number, cfg: KonfigEkonomi = EKONOMI, eventUji: EventId | null = null): GameState {
  return perbaruiTantangan(perbaruiEvent(state, sekarangMs, cfg, eventUji), sekarangMs, cfg);
}

// ---------------------------------------------------------------------------
// Renovasi (pengganti prestige naik kelas)

/** Poin Renovasi yang didapat bila Renovasi sekarang (rumus prestige v1 dari pendapatan sejak Renovasi terakhir). */
export function poinRenovasiTersedia(state: GameState, cfg: KonfigEkonomi = EKONOMI): Decimal {
  return poinPrestigeDidapat(state.statistik.totalPendapatanRun, cfg);
}

export function bisaRenovasi(state: GameState, cfg: KonfigEkonomi = EKONOMI): boolean {
  return poinRenovasiTersedia(state, cfg).gte(cfg.mitra.poinMinRenovasi);
}

/**
 * Renovasi: kapasitas dibangun ulang dari awal dengan bonus pendapatan
 * permanen. Direset: uang, level Peron & Keberangkatan, semua Kepala, loket
 * (tiap PO kembali ke loket bawaannya), fasilitas, modernisasi. Tetap: level &
 * kelas terminal, perluasan, jalur, PO terdaftar beserta level/reputasi/harga/
 * kontraknya, riwayat, statistik sepanjang masa, dan semua yang di luar terminal.
 * Target harian penumpang yang belum selesai dihitung ulang untuk kapasitas
 * baru (targetnya dari arus terminal lama, jadi tidak mungkin tercapai).
 */
export function renovasi(state: GameState, cfg: KonfigEkonomi = EKONOMI): GameState {
  if (!bisaRenovasi(state, cfg)) return state;
  const awal = buatTerminalAwal(cfg);
  const mitra: MitraState = { ...state.mitra, terdaftar: state.mitra.terdaftar.map((p) => ({ ...p, loket: Math.max(1, tingkatPo(p.id, cfg).loketBawaan) })) };
  const terminal = aturLevelLoket({ ...awal, id: state.terminal.id, jalur: state.terminal.jalur }, mitra);
  const baru: GameState = {
    ...state,
    uang: new Decimal(cfg.uangAwal),
    terminal,
    mitra,
    renovasi: { poin: state.renovasi.poin.add(poinRenovasiTersedia(state, cfg)), jumlah: state.renovasi.jumlah + 1 },
    statistik: { ...state.statistik, totalPendapatanRun: new Decimal(0) },
  };
  const hitungUlang = state.harian.jenis === 'penumpang' && !targetHarianSelesai(state);
  return perbaruiPencapaian(hitungUlang ? { ...baru, harian: buatTargetHarian(baru, state.harian.hariKe, cfg) } : baru, cfg);
}

// ---------------------------------------------------------------------------
// Helper internal

function petakanTahap<T>(f: (id: TahapId) => T): Record<TahapId, T> {
  return petakan(TAHAP_IDS, f);
}

function petakan<K extends string, T>(ids: readonly K[], f: (id: K) => T): Record<K, T> {
  const hasil = {} as Record<K, T>;
  for (const id of ids) hasil[id] = f(id);
  return hasil;
}

function ubahTahap(state: GameState, id: TahapId, tahapBaru: TahapState): GameState {
  return {
    ...state,
    terminal: { ...state.terminal, tahap: { ...state.terminal.tahap, [id]: tahapBaru } },
  };
}

/** Dijaga ≥ 0 supaya noise pembulatan tidak pernah menghasilkan save dengan uang negatif. */
function kurangiUang(uang: Decimal, biaya: Decimal): Decimal {
  return uang.sub(biaya).max(0);
}

function tambahPendapatan(state: GameState, jumlah: Decimal): GameState {
  return {
    ...state,
    uang: state.uang.add(jumlah),
    statistik: {
      ...state.statistik,
      totalPendapatanRun: state.statistik.totalPendapatanRun.add(jumlah),
      totalPendapatanSepanjangMasa: state.statistik.totalPendapatanSepanjangMasa.add(jumlah),
    },
  };
}
