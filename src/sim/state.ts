/**
 * GameState dan semua transisinya. TypeScript murni: tidak boleh import
 * Phaser atau DOM, dan tidak membaca jam sendiri (waktu selalu jadi parameter).
 *
 * Semua fungsi murni: tidak memutasi state masukan, selalu mengembalikan
 * state baru (atau state yang sama persis kalau aksinya tidak berlaku).
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
import { FASILITAS_IDS, isEventId, KELAS_BUS_IDS, PENCAPAIAN_IDS, PO_IDS, TEKNOLOGI_IDS, type EventId, type FasilitasId, type JenisTarget, type KelasBusId, type PencapaianId, type PoId, type TeknologiId } from './fitur';
import { hitungKepuasan, type Kepuasan } from './kepuasan';
import { SYARAT_PENCAPAIAN } from './pencapaian';
import { rapikanNamaTerminal } from './profil';
import { jenisTantanganMinggu, mingguWib, type JenisTantangan } from './tantangan';
import { TAHAP_IDS, type TahapId } from './tahap';
import { keramaianTerminal, waktuTerminal, waktuTerminalState } from './waktu';

/** Id terminal pertama. Nanti kota/terminal tambahan dapat id sendiri. */
export const ID_TERMINAL_AWAL = 'tipe-c';

/** Toleransi pembulatan saat menghitung penumpang/bus utuh (0,8 × 0,1 × 10 bisa jadi 0,7999…). */
const EPSILON_TRANSAKSI = 1e-9;

export interface KepalaState {
  readonly direkrut: boolean;
  // Ruang untuk skill aktif Kepala (level, cooldown, dst.) tanpa ubah bentuk save.
}

export interface TahapState {
  /** Mulai dari 1. */
  readonly level: number;
  /** Kepala menjalankan tahapnya saat game ditutup (pendapatan offline). */
  readonly kepala: KepalaState;
}

export interface TerminalState {
  readonly id: string;
  readonly tahap: Readonly<Record<TahapId, TahapState>>;
  /** Level tiap fasilitas penunjang (0 = belum dibangun). */
  readonly fasilitas: Readonly<Record<FasilitasId, number>>;
  /** Banyaknya jurusan yang sudah dibuka (urut EKONOMI.jurusan). */
  readonly jurusanBuka: number;
  /** Modernisasi yang sudah dipasang. */
  readonly teknologi: Readonly<Record<TeknologiId, boolean>>;
  /** Kelas bus yang sudah beroperasi (ekonomi selalu true). */
  readonly kelasBus: Readonly<Record<KelasBusId, boolean>>;
  /** Jalur bus yang beroperasi (1 … jumlahJalurMaks). */
  readonly jalur: number;
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

export interface PrestigeState {
  readonly poin: Decimal;
  readonly jumlahReset: number;
}

export interface StatistikState {
  /** Total pendapatan sejak prestige terakhir. Dasar hitung poin prestige. */
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

/** Armada terminal: mitra PO yang sudah bergabung (urut bergabung). Permanen, tidak direset prestige. */
export interface ArmadaState {
  readonly po: readonly PoId[];
}

/**
 * Harga tiket yang diatur pemain, disimpan dalam persen harga normal (pemain
 * melihatnya dalam Rupiah; lihat EKONOMI.harga): tiket = harga jurusan +
 * tambahan kelas bus. Tetap walau naik kelas.
 */
export interface HargaState {
  /** Harga tiap jurusan (indeks EKONOMI.jurusan, termasuk yang belum dibuka); 100 = normal. */
  readonly jurusan: readonly number[];
  /** Tambahan harga tiap kelas bus; 0 = tanpa tambahan. */
  readonly tambahanKelas: Readonly<Record<KelasBusId, number>>;
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
 * Rekor pribadi: tetap walau naik kelas. Hitungan harian (hari terminal, main
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

/** Profil pemain (lihat sim/profil.ts): tetap walau naik kelas. */
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
  readonly prestige: PrestigeState;
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
  readonly armada: ArmadaState;
  readonly harga: HargaState;
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
 * - potensial: kapasitas terminal (tahap paling lambat) dengan harga normal;
 *   dasar target & hadiah, jadi tidak bisa digelembungkan lewat harga tiket.
 * - aktif: arus nyata saat main = kapasitas × kursi terisi (penumpang yang
 *   datang menurut kepuasan, jam, & harga tiket; lihat arusHarga).
 * - offline: saat game ditutup; 0 kalau ada tahap tanpa Kepala. Ikut harga
 *   tiket, tanpa kepuasan & jam.
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
  return {
    id: ID_TERMINAL_AWAL,
    tahap: petakanTahap(() => buatTahapAwal()),
    fasilitas: petakan(FASILITAS_IDS, () => 0),
    jurusanBuka: Math.min(cfg.jurusanAwal, cfg.jurusan.length),
    teknologi: petakan(TEKNOLOGI_IDS, () => false),
    kelasBus: petakan(KELAS_BUS_IDS, (id) => id === 'ekonomi'),
    jalur: 1,
  };
}

export function buatStateBaru(sekarangMs: number, cfg: KonfigEkonomi = EKONOMI): GameState {
  return {
    uang: new Decimal(cfg.uangAwal),
    terminal: buatTerminalAwal(cfg),
    prestige: { poin: new Decimal(0), jumlahReset: 0 },
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
    armada: buatArmadaAwal(),
    harga: buatHargaAwal(cfg),
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

export function buatArmadaAwal(): ArmadaState {
  return { po: [] };
}

/** Semua harga normal: harga jurusan 100 %, tanpa tambahan kelas. */
export function buatHargaAwal(cfg: KonfigEkonomi = EKONOMI): HargaState {
  return { jurusan: cfg.jurusan.map(() => 100), tambahanKelas: petakan(KELAS_BUS_IDS, () => 0) };
}

export function buatSewaKiosAwal(): SewaKiosState {
  return { terkumpul: new Decimal(0), terakhir: new Decimal(0), hariTerakhir: -1 };
}

export function buatHadiahAwal(cfg: KonfigEkonomi = EKONOMI): HadiahState {
  return { boostDetik: 0, busEmas: { tungguDetik: cfg.hadiah.busEmasSelangDetik[0], aktifDetik: 0, jumlah: 0 }, bonusOffline: new Decimal(0) };
}

// ---------------------------------------------------------------------------
// Turunan (read-only)

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

export function kapasitasTahap(state: GameState, id: TahapId, cfg: KonfigEkonomi = EKONOMI): number {
  return kapasitas(id, state.terminal.tahap[id].level, cfg) * multTeknologi(state, id, cfg) * multJalur(state, id, cfg);
}

/** Pengali harga tiket dari jurusan yang sudah dibuka (jurusan jauh lebih mahal). */
export function multJurusan(state: GameState, cfg: KonfigEkonomi = EKONOMI): number {
  let mult = 1;
  for (let i = 0; i < Math.min(state.terminal.jurusanBuka, cfg.jurusan.length); i++) mult += cfg.jurusan[i]!.bonusTiket;
  return mult;
}

/** Efek satu fasilitas pada levelnya sekarang (nilaiPerLevel × level; artinya lihat KonfigFasilitas). */
export function nilaiFasilitas(state: GameState, id: FasilitasId, cfg: KonfigEkonomi = EKONOMI): number {
  return cfg.fasilitas[id].nilaiPerLevel * state.terminal.fasilitas[id];
}

/** Pengali harga tiket dari mitra PO yang sudah bergabung. */
export function multPo(state: GameState, cfg: KonfigEkonomi = EKONOMI): number {
  return 1 + cfg.po.bonusTiket * state.armada.po.length;
}

/** Pengali harga tiket dari kelas bus yang beroperasi (bus yang lebih mewah, tiket lebih mahal). */
export function multKelasBus(state: GameState, cfg: KonfigEkonomi = EKONOMI): number {
  let mult = 1;
  for (const id of KELAS_BUS_IDS) if (state.terminal.kelasBus[id]) mult += cfg.kelasBus[id].bonusTiket;
  return mult;
}

/** Harga tiket normal per penumpang (× bonus jurusan × bonus mitra PO × bonus kelas bus), sebelum harga yang diatur pemain. */
export function nilaiPerPenumpangState(state: GameState, cfg: KonfigEkonomi = EKONOMI): number {
  return cfg.nilaiPerPenumpang * multJurusan(state, cfg) * multPo(state, cfg) * multKelasBus(state, cfg);
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
 * Pendapatan per detik dari tiap sumber (sudah × prestige, event musiman & kepuasan, belum × boost):
 * tiket di loket, retribusi tiap bus parkir, parkir kendaraan pengantar, dan
 * belanja kios yang terkumpul lalu dibayar sebagai sewa harian. Semuanya
 * mengikuti arus penumpang (lihat ModeThroughput). Toilet & musholla tidak
 * menghasilkan uang; ia menaikkan belanja di kios.
 */
export interface RincianPendapatan {
  readonly tiket: Decimal;
  readonly retribusi: Decimal;
  readonly parkir: Decimal;
  readonly sewaKios: Decimal;
}

export function rincianPendapatan(state: GameState, mode: ModeThroughput = 'potensial', cfg: KonfigEkonomi = EKONOMI): RincianPendapatan {
  const { arus, harga } = arusDanHarga(state, mode, cfg);
  const mult = pengaliPendapatan(state, cfg);
  const per = (rpPerPenumpang: number): Decimal => mult.times(arus * rpPerPenumpang);
  return {
    tiket: per(nilaiPerPenumpangState(state, cfg) * harga),
    retribusi: per(tarifRetribusiPerBus(state, cfg) / cfg.penumpangPerBus),
    parkir: per(nilaiFasilitas(state, 'parkir', cfg)),
    sewaKios: per(belanjaKiosPerPenumpang(state, cfg)),
  };
}

/** Pengali semua pendapatan (prestige × event musiman × kepuasan), belum × boost. */
export function pengaliPendapatan(state: GameState, cfg: KonfigEkonomi = EKONOMI): Decimal {
  return multiplierPrestige(state.prestige.poin, cfg).times(pengaliEvent(state, cfg) * pengaliKepuasan(state, cfg));
}

/** Kepuasan penumpang sekarang (lihat sim/kepuasan.ts), termasuk kekecewaan karena tiket terlalu mahal. */
export function kepuasanTerminal(state: GameState, cfg: KonfigEkonomi = EKONOMI): Kepuasan {
  const kap = semuaKapasitas(state, cfg);
  return hitungKepuasan(
    {
      kapasitas: TAHAP_IDS.map((id) => kap[id]),
      arus: throughput(kap),
      levelFasilitas: state.terminal.fasilitas.kios + state.terminal.fasilitas.toilet,
      jalur: state.terminal.jalur,
      jalurMaks: jumlahJalurMaks(cfg),
      penaltiHarga: penaltiHarga(state, cfg),
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

/**
 * Calon penumpang yang datang sekarang dibanding kapasitas terminal: daya tarik
 * kepuasan × ritme jam & hari. Ritmenya dilandaikan dari keramaian di adegan
 * (ritmeMin): malam berangsur sepi tapi terminal tidak pernah berhenti.
 * Lebih dari 1 = lebih banyak dari yang bisa dilayani (antre di tahap paling lambat).
 */
export function permintaanPenumpang(state: GameState, cfg: KonfigEkonomi = EKONOMI): number {
  const p = cfg.permintaan;
  const ritme = p.ritmeMin + (1 - p.ritmeMin) * keramaianTerminal(waktuTerminalState(state));
  return dayaTarikKepuasan(kepuasanTerminal(state, cfg).nilai, cfg) * ritme;
}

/** Bagian kursi (kapasitas) yang terisi sekarang, 0–1: penumpang yang datang menurut kepuasan, jam, & harga tiket. */
export function keterisianTerminal(state: GameState, cfg: KonfigEkonomi = EKONOMI): number {
  return arusHarga(state, permintaanPenumpang(state, cfg), cfg).terisi;
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

export function throughputState(
  state: GameState,
  mode: ModeThroughput = 'potensial',
  cfg: KonfigEkonomi = EKONOMI,
): number {
  return arusDanHarga(state, mode, cfg).arus;
}

/** Arus penumpang (pnp/dtk) & harga rata-rata yang dibayar (× harga normal) menurut mode. */
function arusDanHarga(state: GameState, mode: ModeThroughput, cfg: KonfigEkonomi): { arus: number; harga: number } {
  if (mode === 'offline' && !semuaOtomatis(state)) return { arus: 0, harga: 1 };
  const kap = throughput(semuaKapasitas(state, cfg));
  if (mode === 'potensial') return { arus: kap, harga: 1 };
  // Offline: Kepala menjalankan terminal tanpa jam & kepuasan, tapi penumpang tetap memilih menurut harga.
  const a = arusHarga(state, mode === 'aktif' ? permintaanPenumpang(state, cfg) : 1, cfg);
  return { arus: kap * a.terisi, harga: a.harga };
}

/** Rata-rata pendapatan per detik dari semua sumber (belum × boost). */
export function pendapatanPerDetikState(
  state: GameState,
  mode: ModeThroughput = 'potensial',
  cfg: KonfigEkonomi = EKONOMI,
): Decimal {
  // Rata-rata semua sumber, termasuk sewa kios yang dibayar harian (dasar offline & hadiah "N menit pendapatan").
  const r = rincianPendapatan(state, mode, cfg);
  return r.tiket.add(r.retribusi).add(r.parkir).add(r.sewaKios);
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
 * Semua tahap selalu berjalan. Arusnya = penumpang yang datang (kepuasan,
 * jam, & harga tiket; lihat arusHarga), paling banyak sebesar kapasitas.
 *
 * Uang masuk per transaksi (lihat TransaksiState): tiap penumpang yang membeli
 * tiket membayar tiket & parkir kendaraan pengantarnya dan berbelanja di kios
 * (dikumpulkan jadi sewa harian); tiap bus membayar parkir bus. Totalnya sama
 * dengan arus × harga; hanya dicairkan per kejadian.
 */
export function tick(state: GameState, dtDetik: number, cfg: KonfigEkonomi = EKONOMI): GameState {
  if (!(dtDetik > 0)) return state;

  const { arus, harga } = arusDanHarga(state, 'aktif', cfg);
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
  const perPenumpang = nilaiPerPenumpangState(state, cfg) * harga + nilaiFasilitas(state, 'parkir', cfg);
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
  };
  const denganSewa = majukanSewaKios(dasar, omzetKios, waktuTerminal(state.statistik.waktuMainDetik).hariKe, waktuTerminal(waktuMainDetik).hariKe);
  return perbaruiArmada(perbaruiPencapaian(tambahPendapatan(denganSewa, pendapatan), cfg), cfg);
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

/** Lama satu hari terminal dalam detik main. */
const DETIK_SEHARI = 24 * WAKTU.detikPerJam;

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
// Mitra PO

export function poBergabung(state: GameState, id: PoId): boolean {
  return state.armada.po.includes(id);
}

/** PO yang bergabung otomatis (bukan lewat kontrak) dan syaratnya sudah terpenuhi. */
function poSiapBergabung(state: GameState, id: PoId, cfg: KonfigEkonomi): boolean {
  const s = cfg.po.syarat[id];
  if (s.jenis === 'jurusan') return state.terminal.jurusanBuka > s.ke;
  if (s.jenis === 'kelas') return kelasTerminal(state) >= s.kelas;
  return false;
}

/** Catat PO yang baru memenuhi syarat bergabung otomatis (state sama persis kalau tidak ada). */
export function perbaruiArmada(state: GameState, cfg: KonfigEkonomi = EKONOMI): GameState {
  const baru = PO_IDS.filter((id) => !poBergabung(state, id) && poSiapBergabung(state, id, cfg));
  if (baru.length === 0) return state;
  return { ...state, armada: { ...state.armada, po: [...state.armada.po, ...baru] } };
}

/** Biaya kontrak PO, atau null kalau PO itu bergabung dengan cara lain. */
export function biayaKontrakPo(id: PoId, cfg: KonfigEkonomi = EKONOMI): Decimal | null {
  const s = cfg.po.syarat[id];
  return s.jenis === 'kontrak' ? new Decimal(s.biaya) : null;
}

/** Kepuasan minimal agar PO kontrak ini mau bergabung, atau null kalau tanpa syarat. */
export function kepuasanMinPo(id: PoId, cfg: KonfigEkonomi = EKONOMI): number | null {
  const s = cfg.po.syarat[id];
  return s.jenis === 'kontrak' && s.kepuasanMin !== undefined ? s.kepuasanMin : null;
}

export function bisaKontrakPo(state: GameState, id: PoId, cfg: KonfigEkonomi = EKONOMI): boolean {
  const biaya = biayaKontrakPo(id, cfg);
  const min = kepuasanMinPo(id, cfg);
  return biaya !== null && !poBergabung(state, id) && state.uang.gte(biaya) && (min === null || kepuasanTerminal(state, cfg).nilai >= min);
}

export function kontrakPo(state: GameState, id: PoId, cfg: KonfigEkonomi = EKONOMI): GameState {
  if (!bisaKontrakPo(state, id, cfg)) return state;
  return { ...state, uang: kurangiUang(state.uang, biayaKontrakPo(id, cfg)!), armada: { ...state.armada, po: [...state.armada.po, id] } };
}

// ---------------------------------------------------------------------------
// Kelas bus

/** Kelas bus yang beroperasi, urut dari ekonomi (untuk adegan: bus yang datang memakai salah satunya). */
export function kelasBusBeroperasi(state: GameState): KelasBusId[] {
  return KELAS_BUS_IDS.filter((id) => state.terminal.kelasBus[id]);
}

/** Kelas bus berikutnya yang bisa didatangkan (berurutan), null kalau semua sudah beroperasi. */
export function kelasBusBerikutnya(state: GameState): KelasBusId | null {
  return KELAS_BUS_IDS.find((id) => !state.terminal.kelasBus[id]) ?? null;
}

/**
 * Yang masih kurang untuk mendatangkan kelas bus ini: terminal belum cukup
 * tinggi kelasnya (disebut lebih dulu: syarat jangka panjang), atau kelas bus
 * sebelumnya belum beroperasi. null = syarat terpenuhi (tinggal uangnya);
 * kelas yang sudah beroperasi juga null.
 */
export function syaratKelasBusKurang(
  state: GameState,
  id: KelasBusId,
  cfg: KonfigEkonomi = EKONOMI,
): { readonly jenis: 'sebelumnya'; readonly kelas: KelasBusId } | { readonly jenis: 'terminal'; readonly kelas: number } | null {
  if (state.terminal.kelasBus[id]) return null;
  const minimal = cfg.kelasBus[id].kelasTerminal;
  if (kelasTerminal(state) < minimal) return { jenis: 'terminal', kelas: minimal };
  const sebelumnya = KELAS_BUS_IDS[KELAS_BUS_IDS.indexOf(id) - 1];
  return sebelumnya && !state.terminal.kelasBus[sebelumnya] ? { jenis: 'sebelumnya', kelas: sebelumnya } : null;
}

export function bisaBeliKelasBus(state: GameState, id: KelasBusId, cfg: KonfigEkonomi = EKONOMI): boolean {
  return !state.terminal.kelasBus[id] && syaratKelasBusKurang(state, id, cfg) === null && state.uang.gte(cfg.kelasBus[id].biaya);
}

export function beliKelasBus(state: GameState, id: KelasBusId, cfg: KonfigEkonomi = EKONOMI): GameState {
  if (!bisaBeliKelasBus(state, id, cfg)) return state;
  return {
    ...state,
    uang: kurangiUang(state.uang, new Decimal(cfg.kelasBus[id].biaya)),
    terminal: { ...state.terminal, kelasBus: { ...state.terminal.kelasBus, [id]: true } },
  };
}

// ---------------------------------------------------------------------------
// Harga tiket per jurusan & kelas bus

/** Kursi terisi & harga rata-rata dari harga tiket per jurusan × kelas bus (lihat arusHarga). */
export interface ArusHarga {
  /** Bagian kursi (kapasitas) yang terisi, 0–1. */
  readonly terisi: number;
  /** Tiket rata-rata yang dibayar penumpang dibanding harga normal (1 = normal). */
  readonly harga: number;
  /** Calon penumpang dibanding saat semua harga normal (tanpa batas kursi). */
  readonly peminat: number;
  /**
   * Per jurusan (indeks EKONOMI.jurusan; 0 bila belum dibuka) & per kelas bus (0 bila belum
   * beroperasi): kursinya yang terisi (0–1), calon penumpang dibanding kursinya (bisa > 1 = penuh,
   * ada yang tidak terangkut), dan bagiannya dari semua penumpang (jumlahnya 1).
   */
  readonly terisiJurusan: readonly number[];
  readonly minatJurusan: readonly number[];
  readonly bagianJurusan: readonly number[];
  readonly terisiKelas: Readonly<Record<KelasBusId, number>>;
  readonly minatKelas: Readonly<Record<KelasBusId, number>>;
  readonly bagianKelas: Readonly<Record<KelasBusId, number>>;
}

/**
 * Satu segmen harga: pasangan jurusan terbuka × kelas bus beroperasi. Jatah
 * kursinya = bobotJ × bobotK (peminat, dinormalkan), `r` = tiketnya dibanding
 * harga normal (harga jurusan + tambahan kelas), `d` = calon penumpangnya
 * dibanding saat harga normal.
 */
interface SegmenHarga {
  readonly j: number;
  readonly k: KelasBusId;
  readonly bobotJ: number;
  readonly bobotK: number;
  readonly r: number;
  readonly d: number;
}

/** Harga jurusan dirapikan: kelipatan langkah di antara min & maks (persen harga normal). */
export function rapikanHarga(persen: number, cfg: KonfigEkonomi = EKONOMI): number {
  const h = cfg.harga;
  if (!Number.isFinite(persen)) return 100;
  return Math.min(h.maks, Math.max(h.min, Math.round(persen / h.langkah) * h.langkah));
}

/** Tambahan harga kelas bus dirapikan: kelipatan langkah di antara 0 & tambahanMaks (persen harga normal). */
export function rapikanTambahan(persen: number, cfg: KonfigEkonomi = EKONOMI): number {
  const h = cfg.harga;
  if (!Number.isFinite(persen)) return 0;
  return Math.min(h.tambahanMaks, Math.max(0, Math.round(persen / h.langkah) * h.langkah));
}

/**
 * Calon penumpang pada harga ini dibanding harga normal. Penumpang memilih
 * jurusan menurut harga jurusannya (hj^(−ej)), lalu kelas menurut tiketnya
 * dibanding harga jurusan itu ((tiket ÷ hj)^(−ek)).
 * @param persenJurusan harga jurusan & @param persenTambahan tambahan kelas, dalam persen harga normal
 */
export function faktorPeminat(persenJurusan: number, persenTambahan: number, elastisitasJurusan: number, elastisitasKelas: number): number {
  return Math.pow(persenJurusan / 100, -elastisitasJurusan) * Math.pow((persenJurusan + persenTambahan) / persenJurusan, -elastisitasKelas);
}

/** Segmen harga terminal sekarang; `ganti` mencoba harga lain untuk satu jurusan atau satu kelas (saran harga). */
function daftarSegmen(
  state: GameState,
  cfg: KonfigEkonomi,
  ganti: { readonly jurusan?: readonly [number, number]; readonly kelas?: readonly [KelasBusId, number] } = {},
): SegmenHarga[] {
  const nJ = Math.min(state.terminal.jurusanBuka, cfg.jurusan.length);
  const kelas = kelasBusBeroperasi(state);
  let totalJ = 0;
  for (let j = 0; j < nJ; j++) totalJ += cfg.jurusan[j]!.peminat;
  let totalK = 0;
  for (const k of kelas) totalK += cfg.kelasBus[k].peminat;
  const hasil: SegmenHarga[] = [];
  for (let j = 0; j < nJ; j++) {
    const cj = cfg.jurusan[j]!;
    const pj = ganti.jurusan?.[0] === j ? ganti.jurusan[1] : (state.harga.jurusan[j] ?? 100);
    const bobotJ = totalJ > 0 ? cj.peminat / totalJ : 1 / nJ;
    for (const k of kelas) {
      const pk = ganti.kelas?.[0] === k ? ganti.kelas[1] : state.harga.tambahanKelas[k];
      const bobotK = totalK > 0 ? cfg.kelasBus[k].peminat / totalK : 1 / kelas.length;
      hasil.push({ j, k, bobotJ, bobotK, r: (pj + pk) / 100, d: faktorPeminat(pj, pk, cj.elastisitas, cfg.kelasBus[k].elastisitas) });
    }
  }
  return hasil;
}

/**
 * Tiap pasangan jurusan terbuka × kelas bus beroperasi punya jatah kursi tetap
 * (peminat jurusan × peminat kelas, dinormalkan). Calon penumpangnya =
 * permintaan × faktor peminat harganya, paling banyak sebanyak jatahnya: kursi
 * yang kosong karena harga tidak diisi penumpang segmen lain. Semua harga
 * normal → terisi = min(1, permintaan).
 * @param permintaan calon penumpang dibanding kapasitas pada harga normal (permintaanPenumpang; 1 = tepat penuh).
 */
export function arusHarga(state: GameState, permintaan: number, cfg: KonfigEkonomi = EKONOMI): ArusHarga {
  const terisiJurusan = cfg.jurusan.map(() => 0);
  const minatJurusan = cfg.jurusan.map(() => 0);
  const bobotJurusan = cfg.jurusan.map(() => 0);
  const terisiKelas = petakan(KELAS_BUS_IDS, () => 0);
  const minatKelas = petakan(KELAS_BUS_IDS, () => 0);
  const bobotKelas = petakan(KELAS_BUS_IDS, () => 0);
  let terisi = 0;
  let bayar = 0;
  let peminat = 0;
  for (const s of daftarSegmen(state, cfg)) {
    const w = s.bobotJ * s.bobotK;
    const minat = permintaan * s.d;
    const isi = Math.min(1, minat);
    terisi += w * isi;
    bayar += w * isi * s.r;
    peminat += w * s.d;
    terisiJurusan[s.j]! += s.bobotK * isi;
    minatJurusan[s.j]! += s.bobotK * minat;
    bobotJurusan[s.j] = s.bobotJ;
    terisiKelas[s.k] += s.bobotJ * isi;
    minatKelas[s.k] += s.bobotJ * minat;
    bobotKelas[s.k] = s.bobotK;
  }
  const bagianJurusan = terisiJurusan.map((x, j) => (terisi > 0 ? (bobotJurusan[j]! * x) / terisi : 0));
  const bagianKelas = petakan(KELAS_BUS_IDS, (k) => (terisi > 0 ? (bobotKelas[k] * terisiKelas[k]) / terisi : 0));
  return { terisi, harga: terisi > 0 ? bayar / terisi : 1, peminat, terisiJurusan, minatJurusan, bagianJurusan, terisiKelas, minatKelas, bagianKelas };
}

/** Kelebihan tiket di atas ambangMahal (pecahan harga normal), rata-rata berbobot kursi: semua, per jurusan, per kelas. */
export interface KelebihanHarga {
  readonly total: number;
  readonly jurusan: readonly number[];
  readonly kelas: Readonly<Record<KelasBusId, number>>;
}

/** Seberapa jauh tiket melewati harga yang masih diterima penumpang (0 = tidak ada yang kecewa). */
export function kelebihanHarga(state: GameState, cfg: KonfigEkonomi = EKONOMI): KelebihanHarga {
  const ambang = cfg.harga.ambangMahal / 100;
  const nJ = Math.min(state.terminal.jurusanBuka, cfg.jurusan.length);
  const kelas = kelasBusBeroperasi(state);
  let totalJ = 0;
  for (let j = 0; j < nJ; j++) totalJ += cfg.jurusan[j]!.peminat;
  let totalK = 0;
  for (const k of kelas) totalK += cfg.kelasBus[k].peminat;
  const jurusan = cfg.jurusan.map(() => 0);
  const perKelas = petakan(KELAS_BUS_IDS, () => 0);
  let total = 0;
  for (let j = 0; j < nJ; j++) {
    const bobotJ = totalJ > 0 ? cfg.jurusan[j]!.peminat / totalJ : 1 / nJ;
    for (const k of kelas) {
      const lebih = Math.max(0, ((state.harga.jurusan[j] ?? 100) + state.harga.tambahanKelas[k]) / 100 - ambang);
      if (lebih <= 0) continue;
      const bobotK = totalK > 0 ? cfg.kelasBus[k].peminat / totalK : 1 / kelas.length;
      total += bobotJ * bobotK * lebih;
      jurusan[j]! += bobotK * lebih;
      perKelas[k] += bobotJ * lebih;
    }
  }
  return { total, jurusan, kelas: perKelas };
}

/** Bagian kepuasan yang hilang karena tiket terlalu mahal (0 … penaltiMaks). */
export function penaltiHarga(state: GameState, cfg: KonfigEkonomi = EKONOMI): number {
  return Math.min(cfg.harga.penaltiMaks, cfg.harga.penaltiMahal * kelebihanHarga(state, cfg).total);
}

/** Saran harga (persen harga normal): per jurusan terbuka & per kelas beroperasi; null bila belum dibuka/beroperasi. */
export interface SaranHarga {
  readonly jurusan: readonly (number | null)[];
  readonly tambahanKelas: Readonly<Record<KelasBusId, number | null>>;
}

/** Keramaian tiap jam di hari biasa (Selasa), untuk menilai harga sepanjang hari. */
const KERAMAIAN_SEHARI: readonly number[] = Array.from({ length: 24 }, (_, jam) => keramaianTerminal({ jamDesimal: jam + 0.5, indeksHari: 1 }));

/**
 * Saran harga tiap jurusan & tiap kelas: yang paling banyak mendatangkan uang
 * tiket dalam sehari biasa (kepuasan sekarang, harga lain tetap), tanpa membuat
 * tiket segmennya melewati ambangMahal (penumpang tidak kecewa).
 */
export function saranHarga(state: GameState, cfg: KonfigEkonomi = EKONOMI): SaranHarga {
  const h = cfg.harga;
  const p = cfg.permintaan;
  const tarik = dayaTarikKepuasan(kepuasanTerminal(state, cfg).nilai, cfg);
  const permintaanJam = KERAMAIAN_SEHARI.map((r) => tarik * (p.ritmeMin + (1 - p.ritmeMin) * r));
  const nilai = (segmen: readonly SegmenHarga[]): number => {
    let total = 0;
    for (const s of segmen) {
      let isi = 0;
      for (const d of permintaanJam) isi += Math.min(1, d * s.d);
      total += s.bobotJ * s.bobotK * isi * s.r;
    }
    return total;
  };
  /** Kandidat terbaik dari `mulai` sampai `batas` (inklusif); paling murah bila semuanya melewati batas. */
  const terbaik = (mulai: number, batas: number, coba: (persen: number) => number): number => {
    let pilih = mulai;
    let nilaiPilih = Number.NEGATIVE_INFINITY;
    for (let persen = mulai; persen <= batas + 1e-9; persen += h.langkah) {
      const v = coba(persen);
      if (v > nilaiPilih + 1e-12) {
        nilaiPilih = v;
        pilih = persen;
      }
    }
    return pilih;
  };
  const nJ = Math.min(state.terminal.jurusanBuka, cfg.jurusan.length);
  const kelas = kelasBusBeroperasi(state);
  const tambahanTertinggi = Math.max(0, ...kelas.map((k) => state.harga.tambahanKelas[k]));
  let hargaTertinggi = 0;
  for (let j = 0; j < nJ; j++) hargaTertinggi = Math.max(hargaTertinggi, state.harga.jurusan[j] ?? 100);
  const jurusan = cfg.jurusan.map((_, j) =>
    j < nJ ? terbaik(h.min, Math.min(h.maks, h.ambangMahal - tambahanTertinggi), (persen) => nilai(daftarSegmen(state, cfg, { jurusan: [j, persen] }).filter((s) => s.j === j))) : null,
  );
  const tambahanKelas = petakan(KELAS_BUS_IDS, (k) =>
    state.terminal.kelasBus[k] ? terbaik(0, Math.min(h.tambahanMaks, h.ambangMahal - hargaTertinggi), (persen) => nilai(daftarSegmen(state, cfg, { kelas: [k, persen] }).filter((s) => s.k === k))) : null,
  );
  return { jurusan, tambahanKelas };
}

/** Atur harga tiket jurusan ke-`indeks` yang sudah dibuka (persen harga normal, dirapikan). */
export function aturHargaJurusan(state: GameState, indeks: number, persen: number, cfg: KonfigEkonomi = EKONOMI): GameState {
  if (!Number.isInteger(indeks) || indeks < 0 || indeks >= Math.min(state.terminal.jurusanBuka, cfg.jurusan.length)) return state;
  const p = rapikanHarga(persen, cfg);
  if (state.harga.jurusan[indeks] === p) return state;
  return { ...state, harga: { ...state.harga, jurusan: state.harga.jurusan.map((x, i) => (i === indeks ? p : x)) } };
}

/** Atur tambahan harga tiket kelas bus yang beroperasi (persen harga normal, dirapikan). */
export function aturTambahanKelas(state: GameState, id: KelasBusId, persen: number, cfg: KonfigEkonomi = EKONOMI): GameState {
  if (!state.terminal.kelasBus[id]) return state;
  const p = rapikanTambahan(persen, cfg);
  if (state.harga.tambahanKelas[id] === p) return state;
  return { ...state, harga: { ...state.harga, tambahanKelas: { ...state.harga.tambahanKelas, [id]: p } } };
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
// Aksi pemain

export function bisaUpgrade(state: GameState, id: TahapId, cfg: KonfigEkonomi = EKONOMI): boolean {
  return state.uang.gte(biayaUpgradeState(state, id, cfg));
}

export function beliUpgrade(state: GameState, id: TahapId, cfg: KonfigEkonomi = EKONOMI): GameState {
  if (!bisaUpgrade(state, id, cfg)) return state;
  const t = state.terminal.tahap[id];
  return {
    ...ubahTahap(state, id, { ...t, level: t.level + 1 }),
    uang: kurangiUang(state.uang, biayaUpgradeState(state, id, cfg)),
    harian: state.harian.jenis === 'upgrade' ? tambahProgres(state.harian, 1) : state.harian,
    tantangan: tambahProgresTantangan(state.tantangan, 'upgrade', 1),
  };
}

// ---------------------------------------------------------------------------
// Fasilitas, jurusan, modernisasi

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

/** Biaya membuka jurusan berikutnya, atau null kalau semua sudah dibuka. */
export function biayaJurusanBerikutnya(state: GameState, cfg: KonfigEkonomi = EKONOMI): Decimal | null {
  const j = cfg.jurusan[state.terminal.jurusanBuka];
  return j ? new Decimal(j.biaya) : null;
}

/** Jurusan ke-i rute antarpulau (menyeberang dengan feri)? */
export function jurusanAntarpulau(i: number, cfg: KonfigEkonomi = EKONOMI): boolean {
  return cfg.jurusan[i]?.feri !== undefined;
}

/** Banyaknya jurusan Jawa–Bali (bukan antarpulau). */
export function jumlahJurusanDarat(cfg: KonfigEkonomi = EKONOMI): number {
  return cfg.jurusan.filter((j) => j.feri === undefined).length;
}

/** Kelas terminal minimal untuk membuka jurusan berikutnya bila belum tercapai, selain itu null. */
export function kelasKurangJurusan(state: GameState, cfg: KonfigEkonomi = EKONOMI): number | null {
  const minimal = cfg.jurusan[state.terminal.jurusanBuka]?.kelasTerminal ?? 0;
  return kelasTerminal(state) < minimal ? minimal : null;
}

export function bisaBukaJurusan(state: GameState, cfg: KonfigEkonomi = EKONOMI): boolean {
  const biaya = biayaJurusanBerikutnya(state, cfg);
  return biaya !== null && kelasKurangJurusan(state, cfg) === null && state.uang.gte(biaya);
}

/** Buka jurusan berikutnya; mitra PO kotanya langsung bergabung. */
export function bukaJurusan(state: GameState, cfg: KonfigEkonomi = EKONOMI): GameState {
  if (!bisaBukaJurusan(state, cfg)) return state;
  return perbaruiArmada(
    {
      ...state,
      uang: kurangiUang(state.uang, biayaJurusanBerikutnya(state, cfg)!),
      terminal: { ...state.terminal, jurusanBuka: state.terminal.jurusanBuka + 1 },
    },
    cfg,
  );
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
 * Selisih waktu negatif menghasilkan 0 (lihat `detikOffline`).
 */
export function terapkanOffline(
  state: GameState,
  sekarangMs: number,
  cfg: KonfigEkonomi = EKONOMI,
): { state: GameState; laporan: LaporanOffline } {
  const laporan = hitungOffline(state, sekarangMs, cfg);
  // Bonus 2× offline ditawarkan untuk laporan ini saja; boost berkurang selama pergi.
  const hadiah = { ...state.hadiah, boostDetik: Math.max(0, state.hadiah.boostDetik - laporan.detik), bonusOffline: laporan.pendapatan };
  const ditandai = { ...tandaiWaktu(state, sekarangMs), hadiah };
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

/** Klaim hadiah tahap event berikutnya; tahap terakhir juga membawa mitra PO eksklusif event itu. */
export function klaimEvent(state: GameState, cfg: KonfigEkonomi = EKONOMI): GameState {
  const id = idEdisiEvent(state.event.edisi);
  if (!id || !bisaKlaimEvent(state)) return state;
  const e = state.event;
  const po = cfg.event[id].po;
  const terakhir = e.diklaim === e.target.length - 1;
  const dapat = tambahPendapatan(state, hadiahTahapEvent(state, cfg));
  const armada = terakhir && !poBergabung(state, po) ? { ...state.armada, po: [...state.armada.po, po] } : state.armada;
  return { ...dapat, armada, event: { ...e, diklaim: e.diklaim + 1 } };
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
// Prestige = naik kelas terminal

/** Kelas terminal = banyaknya naik kelas: 0 = Tipe C, 1 = Tipe B, 2 = Tipe A, 3+ = Terpadu (★ bertambah). */
export function kelasTerminal(state: GameState): number {
  return state.prestige.jumlahReset;
}

/** Poin prestige minimal dari satu run untuk naik dari kelas `kelas` ke berikutnya. */
export function poinMinimalNaikKelas(kelas: number, cfg: KonfigEkonomi = EKONOMI): number {
  const d = cfg.kelas.poinMinimal;
  return kelas < d.length ? d[kelas]! : d[d.length - 1]! + cfg.kelas.tambahPoinMinimal * (kelas - d.length + 1);
}

/** Run ini sudah cukup untuk naik kelas (poin yang didapat ≥ poin minimal kelas sekarang). */
export function bisaNaikKelas(state: GameState, cfg: KonfigEkonomi = EKONOMI): boolean {
  return poinPrestigeTersedia(state, cfg).gte(poinMinimalNaikKelas(kelasTerminal(state), cfg));
}

/**
 * Naik kelas: terminal dibangun ulang dari awal (lakukanPrestige) dengan poin
 * prestige tambahan. Mitra PO hadiah kelas langsung bergabung, dan target
 * harian penumpang yang belum selesai dihitung ulang untuk terminal baru
 * (targetnya dihitung dari arus terminal lama, jadi tidak mungkin tercapai).
 */
export function naikKelas(state: GameState, cfg: KonfigEkonomi = EKONOMI): GameState {
  if (!bisaNaikKelas(state, cfg)) return state;
  const baru = lakukanPrestige(state, cfg);
  const hitungUlang = state.harian.jenis === 'penumpang' && !targetHarianSelesai(state);
  const harian = hitungUlang ? buatTargetHarian(baru, state.harian.hariKe, cfg) : baru.harian;
  return perbaruiArmada(perbaruiPencapaian({ ...baru, harian }, cfg), cfg);
}

export function poinPrestigeTersedia(state: GameState, cfg: KonfigEkonomi = EKONOMI): Decimal {
  return poinPrestigeDidapat(state.statistik.totalPendapatanRun, cfg);
}

export function bisaPrestige(state: GameState, cfg: KonfigEkonomi = EKONOMI): boolean {
  return poinPrestigeTersedia(state, cfg).gt(0);
}

/**
 * Reset terminal (level & Kepala) dan uang ke awal, tambah poin prestige.
 * Statistik sepanjang masa dan waktu main tetap.
 */
export function lakukanPrestige(state: GameState, cfg: KonfigEkonomi = EKONOMI): GameState {
  if (!bisaPrestige(state, cfg)) return state;
  return {
    ...state,
    uang: new Decimal(cfg.uangAwal),
    terminal: { ...buatTerminalAwal(cfg), id: state.terminal.id },
    prestige: {
      poin: state.prestige.poin.add(poinPrestigeTersedia(state, cfg)),
      jumlahReset: state.prestige.jumlahReset + 1,
    },
    statistik: { ...state.statistik, totalPendapatanRun: new Decimal(0) },
  };
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
