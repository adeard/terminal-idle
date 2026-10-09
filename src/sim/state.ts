/**
 * GameState dan semua transisinya. TypeScript murni: tidak boleh import
 * three.js atau DOM, dan tidak membaca jam sendiri (waktu selalu jadi parameter).
 *
 * Semua fungsi murni: tidak memutasi state masukan, selalu mengembalikan
 * state baru (atau state yang sama persis kalau aksinya tidak berlaku).
 *
 * Ekonomi tycoon (documents/13-rancangan-tycoon.md): pemain membangun di slot
 * denah (sim/bangunan.ts), merekrut petugas bergaji (sim/petugas.ts),
 * menggandeng mitra PO, dan mengatur tarif terminal (sim/tarif.ts). Kapasitas,
 * pasar penumpang & kepuasan dihitung sim/operasi.ts; pendapatan, biaya, dan kas
 * yang tidak pernah minus di sim/keuangan.ts. Yang dikejar: laba bersih.
 */
import { EKONOMI, type KonfigEkonomi } from '../config/economy.config';
import { WAKTU } from '../config/waktu.config';
import { bangunanAwal, biayaBangun, pengembalianBongkar, type JumlahBangunan } from './bangunan';
import { benihCuacaDari } from './cuaca';
import { eventPada, jadwalUji } from './event';
import {
  isEventId,
  PENCAPAIAN_IDS,
  PO_IDS,
  TEKNOLOGI_IDS,
  type BangunanId,
  type EventId,
  type JenisTarget,
  type KelasBusId,
  type PencapaianId,
  type PetugasId,
  type PoId,
  type TarifId,
  type TeknologiId,
} from './fitur';
import { keuanganPerJam, majukanKas, type KeuanganJam, type RincianBiaya, type RincianPendapatan } from './keuangan';
import { kelasDariLevel, levelTerminalDariXp, slotPo } from './level-terminal';
import {
  biayaDaftarPo,
  hariKontrakPertama,
  jurusanDilayaniPo,
  kelasAktif,
  kelasBusDioperasikan,
  levelPoDariXp,
  majukanReputasi,
  sisaSetelahPerpanjang,
  syaratDaftarKurang,
  targetReputasi,
  tingkatPo,
  type SyaratDaftarKurang,
} from './mitra';
import { hitungOperasi, multTeknologi, retribusiDipungut, type AreaId, type HasilOperasi, type KeadaanOperasi, type KepuasanTycoon } from './operasi';
import { SYARAT_PENCAPAIAN } from './pencapaian';
import { biayaPerluasan, levelCukupPerluasan } from './perluasan';
import { berhentiKasHabis, berhentikan, bisaRekrut, hitungPetugas, rapikanPetugas, rekrut, type JumlahPetugas } from './petugas';
import { rapikanNamaTerminal } from './profil';
import { jenisTantanganMinggu, mingguWib, type JenisTantangan } from './tantangan';
import { jepitTarif, skorTarifMitra, tarifBawaan, type NilaiTarif } from './tarif';
import { keramaianTerminal, waktuTerminal, waktuTerminalState } from './waktu';

/** Id terminal pertama. Nanti kota/terminal tambahan dapat id sendiri. */
export const ID_TERMINAL_AWAL = 'tipe-c';

/** Lama satu hari terminal dalam detik main (kontrak PO dihitung dalam hari terminal). */
export const DETIK_SEHARI = 24 * WAKTU.detikPerJam;

export interface TerminalState {
  readonly id: string;
  /** Unit tiap jenis bangunan. Jendela = semua jendela loket, yang disewa PO maupun yang kosong. */
  readonly bangunan: JumlahBangunan;
  /** Petugas urut rekrut: yang terakhir direkrut berhenti lebih dulu (lihat sim/petugas.ts). */
  readonly petugas: readonly PetugasId[];
  readonly tarif: NilaiTarif;
  /** Modernisasi yang sudah dipasang. */
  readonly teknologi: Readonly<Record<TeknologiId, boolean>>;
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

export interface StatistikState {
  /** Pendapatan & biaya operasi sepanjang permainan (Rp, termasuk saat offline; hadiah tidak ikut). */
  readonly totalPendapatan: number;
  readonly totalBiaya: number;
  /** Waktu main aktif (tidak termasuk offline): jam & hari terminal mengikutinya. */
  readonly waktuMainDetik: number;
  /** Total penumpang yang diberangkatkan selama bermain aktif. */
  readonly totalPenumpang: number;
}

/** Buku keuangan satu hari terminal (Rp; pendapatan sudah termasuk boost iklan). */
export interface BukuHarian {
  readonly hariKe: number;
  readonly pendapatan: RincianPendapatan;
  readonly biaya: RincianBiaya;
  readonly penumpang: number;
}

/** Buku harian (laporan keuangan hari ini & kemarin) dan gaji yang tertunggak saat kas habis. */
export interface KeuanganState {
  readonly hariIni: BukuHarian;
  /** Hari terminal sebelumnya (null = belum ada). */
  readonly kemarin: BukuHarian | null;
  /** Jam terminal gaji tertunggak (lihat majukanKas di sim/keuangan.ts). */
  readonly tunggakanJam: number;
  /** Hari terminal berturut-turut (yang sudah lewat) tanpa rugi. */
  readonly hariTanpaRugi: number;
  /** Petugas yang pernah berhenti karena gajinya tak terbayar (notifikasi). */
  readonly petugasBerhenti: number;
}

/** Mitra PO yang sedang terdaftar (menempati slot). */
export interface PoTerdaftar {
  readonly id: PoId;
  /** XP kumulatif (satuan bus); level = levelPoDariXp(xp), jadi tidak pernah turun. */
  readonly xp: number;
  /** Jendela loket yang disewa PO ini. */
  readonly loket: number;
  /** 0–100. */
  readonly reputasi: number;
  /** Sisa kontrak (detik main). Hari terminal berhenti saat game ditutup, kontrak juga. */
  readonly kontrakDetik: number;
}

/** PO yang pernah terdaftar lalu keluar: daftar ulang melanjutkan dari sini. */
export interface RiwayatPo {
  readonly xp: number;
  readonly reputasi: number;
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

/** Kemajuan permanen terminal. */
export interface PerkembanganState {
  /** XP terminal = penumpang yang diberangkatkan (offline dihitung × efisiensi offline). */
  readonly xpTerminal: number;
  /** Tahap perluasan yang sudah selesai dibangun. */
  readonly perluasan: number;
  /** Sisa detik main proyek perluasan yang sedang dibangun (0 = tidak ada proyek). */
  readonly proyekDetik: number;
}

/** Rekor pribadi: hari terminal terbaik yang sudah lewat & arus tertinggi. */
export interface RekorState {
  readonly penumpangHarian: number;
  readonly labaHarian: number;
  /** Arus penumpang tertinggi (pnp per jam terminal). */
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

/** Profil pemain (lihat sim/profil.ts). */
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
  /** Bonus 2× laba offline terakhir yang belum diklaim (Rp; tidak disimpan: hanya ditawarkan di popup). */
  readonly bonusOffline: number;
}

export interface GameState {
  /** Kas terminal (Rp, tidak pernah minus). */
  readonly kas: number;
  readonly terminal: TerminalState;
  readonly mitra: MitraState;
  readonly perkembangan: PerkembanganState;
  readonly keuangan: KeuanganState;
  readonly statistik: StatistikState;
  readonly harian: HarianState;
  readonly pencapaian: PencapaianState;
  /**
   * Benih acak jadwal hujan (lihat sim/cuaca.ts). Dibuat sekali saat game baru
   * dan ikut disimpan, jadi cuaca tiap game berbeda tapi tetap sama saat dibuka ulang.
   */
  readonly benihCuaca: number;
  readonly hadiah: HadiahState;
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

export interface LaporanOffline {
  /** Detik yang dihitung (sudah dibatasi batas offline; 0 kalau jam mundur). */
  readonly detik: number;
  /** True kalau waktu pergi melebihi batas offline. */
  readonly dibatasi: boolean;
  /** Terminal tutup karena belum ada Manajer Operasional: tanpa pendapatan & biaya. */
  readonly tutup: boolean;
  /** Pendapatan (sudah × efisiensi offline & boost), biaya, dan laba selama pergi (Rp; laba bisa negatif). */
  readonly pendapatan: number;
  readonly biaya: number;
  readonly laba: number;
  /** Detik offline yang mendapat boost pendapatan (sudah termasuk di `pendapatan`). */
  readonly detikBoost: number;
  /** Petugas yang berhenti karena kas habis selama pergi. */
  readonly berhenti: number;
}

// ---------------------------------------------------------------------------
// Pembuatan state

export function buatTerminalAwal(cfg: KonfigEkonomi = EKONOMI): TerminalState {
  return {
    id: ID_TERMINAL_AWAL,
    bangunan: bangunanAwal(cfg),
    petugas: [],
    tarif: tarifBawaan(cfg),
    teknologi: petakan(TEKNOLOGI_IDS, () => false),
  };
}

/** PO baru terdaftar dengan sekian jendela loket; riwayat (bila pernah terdaftar) dilanjutkan. */
export function buatPoTerdaftar(id: PoId, loket: number, cfg: KonfigEkonomi = EKONOMI, riwayat?: RiwayatPo): PoTerdaftar {
  return {
    id,
    xp: riwayat?.xp ?? 0,
    loket,
    reputasi: riwayat?.reputasi ?? tingkatPo(id, cfg).reputasiAwal,
    kontrakDetik: hariKontrakPertama(id, cfg) * DETIK_SEHARI,
  };
}

/** Game baru: PO awal (EKONOMI.mitra sumber 'awal') menyewa satu-satunya jendela loket. */
export function buatMitraAwal(cfg: KonfigEkonomi = EKONOMI): MitraState {
  const awal = PO_IDS.filter((id) => cfg.mitra.po[id].sumber === 'awal');
  return { terdaftar: awal.map((id) => buatPoTerdaftar(id, 1, cfg)), riwayat: {}, jedaSampai: {}, hadiahEvent: [] };
}

export function buatBukuHarian(hariKe: number): BukuHarian {
  return {
    hariKe,
    pendapatan: { layanan: 0, sewaLoket: 0, retribusi: 0, parkir: 0, toilet: 0, sewaKios: 0 },
    biaya: { gaji: 0, perawatan: 0, listrik: 0, gedung: 0 },
    penumpang: 0,
  };
}

export function buatKeuanganAwal(hariKe: number): KeuanganState {
  return { hariIni: buatBukuHarian(hariKe), kemarin: null, tunggakanJam: 0, hariTanpaRugi: 0, petugasBerhenti: 0 };
}

export function buatStateBaru(sekarangMs: number, cfg: KonfigEkonomi = EKONOMI): GameState {
  const hariKe = waktuTerminal(0).hariKe;
  const s: GameState = {
    kas: cfg.tycoon.modalAwal,
    terminal: buatTerminalAwal(cfg),
    mitra: buatMitraAwal(cfg),
    perkembangan: { xpTerminal: 0, perluasan: 0, proyekDetik: 0 },
    keuangan: buatKeuanganAwal(hariKe),
    statistik: { totalPendapatan: 0, totalBiaya: 0, waktuMainDetik: 0, totalPenumpang: 0 },
    harian: { hariKe, jenis: 'penumpang', target: 0, progres: 0, diklaim: false, jumlahSelesai: 0 },
    pencapaian: { tercapai: [], diklaim: [] },
    benihCuaca: benihCuacaDari(sekarangMs),
    hadiah: buatHadiahAwal(cfg),
    event: buatEventAwal(),
    profil: { namaTerminal: '', ikutPeringkat: false },
    rekor: buatRekorAwal(),
    tantangan: buatTantanganAwal(),
    waktuTerakhirMs: sekarangMs,
  };
  return { ...s, harian: buatTargetHarian(s, hariKe, cfg) };
}

export function buatRekorAwal(): RekorState {
  return { penumpangHarian: 0, labaHarian: 0, arusTertinggi: 0 };
}

export function buatTantanganAwal(): TantanganState {
  return { minggu: null, selesaiMs: 0, daftar: [], penumpang: 0 };
}

export function buatEventAwal(): EventState {
  return { aktif: null, edisi: null, progres: 0, diklaim: 0, target: [] };
}

export function buatHadiahAwal(cfg: KonfigEkonomi = EKONOMI): HadiahState {
  return { boostDetik: 0, busEmas: { tungguDetik: cfg.hadiah.busEmasSelangDetik[0], aktifDetik: 0, jumlah: 0 }, bonusOffline: 0 };
}

// ---------------------------------------------------------------------------
// Turunan: level terminal, mitra PO, petugas

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

export function cariPo(state: GameState, id: PoId): PoTerdaftar | undefined {
  return state.mitra.terdaftar.find((p) => p.id === id);
}

/** Jendela loket yang disewa PO (yang melayani penumpang). */
export function loketTerisi(state: GameState): number {
  return state.mitra.terdaftar.reduce((a, p) => a + p.loket, 0);
}

/** Jendela loket milik terminal yang tidak disewa PO mana pun (PO-nya keluar): tidak melayani, tetap dirawat. */
export function jendelaKosong(state: GameState): number {
  return Math.max(0, state.terminal.bangunan.jendela - loketTerisi(state));
}

/** Jurusan (indeks EKONOMI.jurusan) yang sedang dilayani PO terdaftar yang punya jendela loket. */
export function jurusanDilayani(state: GameState, cfg: KonfigEkonomi = EKONOMI): boolean[] {
  return jurusanDilayaniPo(state.mitra.terdaftar, kelasTerminal(state, cfg), cfg);
}

/** Kelas bus yang dioperasikan PO mana pun yang punya jendela loket (urut KELAS_BUS_IDS). */
export function kelasBusBeroperasi(state: GameState, cfg: KonfigEkonomi = EKONOMI): KelasBusId[] {
  return kelasBusDioperasikan(state.mitra.terdaftar, kelasTerminal(state, cfg), cfg);
}

/** Jumlah petugas tiap peran. */
export function jumlahPetugas(state: GameState): JumlahPetugas {
  return hitungPetugas(state.terminal.petugas);
}

export function adaPetugas(state: GameState, id: PetugasId): boolean {
  return state.terminal.petugas.includes(id);
}

/** Ada Manajer Operasional: terminal tetap beroperasi saat game ditutup. */
export function adaManajerOperasional(state: GameState): boolean {
  return adaPetugas(state, 'manajerOperasional');
}

// ---------------------------------------------------------------------------
// Turunan: operasi & keuangan (read-only)

/** Keadaan terminal untuk sim/operasi.ts (urut PO = urut state.mitra.terdaftar). */
export function keadaanOperasi(state: GameState, cfg: KonfigEkonomi = EKONOMI, tarif: NilaiTarif = state.terminal.tarif): KeadaanOperasi {
  const t = state.terminal;
  return {
    bangunan: t.bangunan,
    petugas: t.petugas,
    tarif,
    teknologi: t.teknologi,
    po: state.mitra.terdaftar.map((p) => ({ id: p.id, level: levelPo(p, cfg), loket: p.loket, reputasi: p.reputasi })),
    kelasTerminal: kelasTerminal(state, cfg),
    perluasan: state.perkembangan.perluasan,
  };
}

/** Ritme permintaan pada keramaian jam & hari ini, dilandaikan: malam berangsur sepi tapi tidak pernah berhenti. */
export function ritmeDari(keramaian: number, cfg: KonfigEkonomi = EKONOMI): number {
  const r = cfg.tycoon.pasar.ritmeMin;
  return r + (1 - r) * Math.min(1, Math.max(0, keramaian));
}

/** Lampu terminal menyala (malam): listrik × pengaliMalam. */
export function lampuMenyala(state: GameState): boolean {
  return !waktuTerminalState(state).siang;
}

/** Hasil operasi tiap state disimpan (hanya untuk konfigurasi bawaan): tick & tampilan membaca state yang sama. */
const cacheOperasi = new WeakMap<GameState, { readonly keadaan: KeadaanOperasi; readonly op: HasilOperasi }>();

function operasiDanKeadaan(state: GameState, cfg: KonfigEkonomi): { readonly keadaan: KeadaanOperasi; readonly op: HasilOperasi } {
  const tersimpan = cfg === EKONOMI ? cacheOperasi.get(state) : undefined;
  if (tersimpan) return tersimpan;
  const keadaan = keadaanOperasi(state, cfg);
  const hasil = { keadaan, op: hitungOperasi(keadaan, { ritme: ritmeDari(keramaianTerminal(waktuTerminalState(state)), cfg), event: pengaliEvent(state, cfg) }, cfg) };
  if (cfg === EKONOMI) cacheOperasi.set(state, hasil);
  return hasil;
}

/** Operasi terminal sekarang: kapasitas tiap area, pasar & arus penumpang, kepuasan, kepuasan mitra PO (lihat sim/operasi.ts). */
export function operasiState(state: GameState, cfg: KonfigEkonomi = EKONOMI): HasilOperasi {
  return operasiDanKeadaan(state, cfg).op;
}

/** Kepuasan penumpang (dari keadaan jam sibuk, lihat sim/operasi.ts). */
export function kepuasanTerminal(state: GameState, cfg: KonfigEkonomi = EKONOMI): KepuasanTycoon {
  return operasiState(state, cfg).kepuasan;
}

/** Area yang membatasi arus jam sibuk, atau null bila permintaan (pasar) yang membatasi. */
export function bottleneckState(state: GameState, cfg: KonfigEkonomi = EKONOMI): AreaId | null {
  return operasiState(state, cfg).bottleneck;
}

/** Kepuasan mitra PO ini sekarang (0–1), null bila tidak terdaftar. */
export function kepuasanMitraPo(state: GameState, id: PoId, cfg: KonfigEkonomi = EKONOMI): number | null {
  return operasiState(state, cfg).po.find((p) => p.id === id)?.kepuasanMitra ?? null;
}

/** Keuangan dengan pendapatan dikali `f` (boost iklan, efisiensi offline). */
function kaliPendapatan(keu: KeuanganJam, f: number): KeuanganJam {
  if (f === 1) return keu;
  const p = keu.pendapatan;
  const pendapatan: RincianPendapatan = {
    layanan: p.layanan * f,
    sewaLoket: p.sewaLoket * f,
    retribusi: p.retribusi * f,
    parkir: p.parkir * f,
    toilet: p.toilet * f,
    sewaKios: p.sewaKios * f,
  };
  const totalPendapatan = keu.totalPendapatan * f;
  return { ...keu, pendapatan, totalPendapatan, laba: totalPendapatan - keu.totalBiaya };
}

/** Pendapatan & biaya per jam terminal sekarang (pendapatan sudah × boost iklan). */
export function keuanganSekarang(state: GameState, cfg: KonfigEkonomi = EKONOMI): KeuanganJam {
  const { keadaan, op } = operasiDanKeadaan(state, cfg);
  return kaliPendapatan(keuanganPerJam(keadaan, op, lampuMenyala(state), cfg), pengaliBoost(state, cfg));
}

// ---------------------------------------------------------------------------
// Acuan sehari: rata-rata hari biasa, dasar hadiah, target, saran tarif, & offline

/**
 * Jam-jam hari biasa (Selasa): keramaian & lampu, dikelompokkan supaya rata-rata
 * sehari cukup dihitung dari beberapa titik (berbobot jumlah jamnya).
 */
const PROFIL_HARI: readonly { readonly keramaian: number; readonly malam: boolean; readonly jam: number }[] = (() => {
  const kelompok = new Map<string, { keramaian: number; malam: boolean; jam: number }>();
  for (let jam = 0; jam < 24; jam++) {
    const tengah = jam + 0.5;
    const keramaian = Math.round(keramaianTerminal({ jamDesimal: tengah, indeksHari: 1 }) * 20) / 20;
    const malam = tengah < WAKTU.jamTerbit || tengah >= WAKTU.jamTerbenam;
    const kunci = `${keramaian}|${malam}`;
    const k = kelompok.get(kunci) ?? { keramaian, malam, jam: 0 };
    k.jam++;
    kelompok.set(kunci, k);
  }
  return [...kelompok.values()];
})();

/** Rata-rata per jam terminal sepanjang hari biasa (tanpa event & boost). */
export interface AcuanHarian {
  /** Penumpang per jam, keseluruhan & tiap PO (urut state.mitra.terdaftar). */
  readonly arus: number;
  readonly arusPo: readonly number[];
  /** Rp per jam. */
  readonly pendapatan: number;
  readonly biaya: number;
  readonly laba: number;
  /** Kepuasan penumpang & kepuasan mitra PO terendah (1 bila tanpa PO). */
  readonly kepuasan: number;
  readonly kepuasanMitraMin: number;
}

/** Acuan terakhir yang dihitung (beberapa keadaan sekaligus: tarif bawaan, tarif pemain, saran). */
const cacheAcuan = new Map<string, AcuanHarian>();
const MAKS_CACHE_ACUAN = 16;

function kunciAcuan(k: KeadaanOperasi): string {
  const b = Object.values(k.bangunan).join(',');
  const p = hitungPetugas(k.petugas);
  const po = k.po.map((x) => `${x.id}:${x.level}:${x.loket}:${Math.round(x.reputasi)}`).join(',');
  const tek = TEKNOLOGI_IDS.map((id) => (k.teknologi[id] ? 1 : 0)).join('');
  return `${b}|${Object.values(p).join(',')}|${Object.values(k.tarif).join(',')}|${tek}|${po}|${k.kelasTerminal}|${k.perluasan}`;
}

/**
 * Rata-rata per jam terminal sepanjang hari biasa dengan tarif tertentu (bawaan:
 * tarif bawaan, supaya hadiah & target tidak bisa digelembungkan lewat tarif
 * ekstrem sesaat). Reputasi dibulatkan, jadi hasilnya disimpan & dipakai ulang.
 */
export function acuanHarian(state: GameState, cfg: KonfigEkonomi = EKONOMI, tarif: NilaiTarif = tarifBawaan(cfg)): AcuanHarian {
  const k = keadaanOperasi(state, cfg, tarif);
  const kunci = cfg === EKONOMI ? kunciAcuan(k) : null;
  const tersimpan = kunci !== null ? cacheAcuan.get(kunci) : undefined;
  if (tersimpan) return tersimpan;
  let arus = 0;
  let pendapatan = 0;
  let biaya = 0;
  let kepuasan = 0;
  let kepuasanMitraMin = 1;
  const arusPo = k.po.map(() => 0);
  for (const j of PROFIL_HARI) {
    const op = hitungOperasi(k, { ritme: ritmeDari(j.keramaian, cfg), event: 1 }, cfg);
    const keu = keuanganPerJam(k, op, j.malam, cfg);
    arus += op.arus * j.jam;
    pendapatan += keu.totalPendapatan * j.jam;
    biaya += keu.totalBiaya * j.jam;
    op.po.forEach((p, i) => (arusPo[i]! += p.arus * j.jam));
    kepuasan = op.kepuasan.nilai;
    for (const p of op.po) kepuasanMitraMin = Math.min(kepuasanMitraMin, p.kepuasanMitra);
  }
  const hasil: AcuanHarian = {
    arus: arus / 24,
    arusPo: arusPo.map((x) => x / 24),
    pendapatan: pendapatan / 24,
    biaya: biaya / 24,
    laba: (pendapatan - biaya) / 24,
    kepuasan,
    kepuasanMitraMin,
  };
  if (kunci !== null) {
    if (cacheAcuan.size >= MAKS_CACHE_ACUAN) cacheAcuan.delete(cacheAcuan.keys().next().value!);
    cacheAcuan.set(kunci, hasil);
  }
  return hasil;
}

/** Hadiah "N menit laba" = N jam terminal laba rata-rata (tarif bawaan), paling sedikit N × hadiah.minPerMenit. */
export function hadiahMenit(state: GameState, menit: number, cfg: KonfigEkonomi = EKONOMI): number {
  return Math.floor(Math.max(acuanHarian(state, cfg).laba, cfg.hadiah.minPerMenit) * menit);
}

// ---------------------------------------------------------------------------
// Simulasi

/**
 * Majukan simulasi sebanyak `dtDetik`. Dipanggil dengan fixed timestep
 * (lihat `majukanWaktu` di loop.ts), tapi tetap benar untuk dt berapa pun.
 *
 * Arus penumpang & uang mengalir terus menurut operasi sekarang: laba (pendapatan
 * × boost − biaya) masuk ke kas yang tidak pernah minus; bila kas habis, gaji
 * tertunggak dan petugas berhenti satu per satu. Dicatat di buku harian. Juga
 * dimajukan: XP terminal & PO, reputasi, kontrak (Manajer Kemitraan
 * memperpanjang & mengisi jendela kosong), proyek perluasan, target, tantangan,
 * event, hadiah, dan pencapaian.
 */
export function tick(state: GameState, dtDetik: number, cfg: KonfigEkonomi = EKONOMI): GameState {
  if (!(dtDetik > 0)) return state;
  const op = operasiState(state, cfg);
  const keu = keuanganSekarang(state, cfg);
  const dtJam = dtDetik / WAKTU.detikPerJam;
  const kas = majukanKas(state.kas, keu.laba, dtJam, state.keuangan.tunggakanJam);
  let petugas = state.terminal.petugas;
  for (let i = 0; i < kas.berhenti; i++) petugas = berhentiKasHabis(petugas);
  const penumpang = op.arus * dtJam;
  const laba = keu.laba * dtJam;

  const waktuMainDetik = state.statistik.waktuMainDetik + dtDetik;
  const hariKe = waktuTerminal(waktuMainDetik).hariKe;
  const hariSelesai = hariKe !== state.keuangan.hariIni.hariKe ? state.keuangan.hariIni : null;
  const s = state.statistik;
  const dasar: GameState = {
    ...state,
    kas: kas.kas,
    terminal: petugas === state.terminal.petugas ? state.terminal : { ...state.terminal, petugas },
    keuangan: majukanKeuangan(
      { ...state.keuangan, tunggakanJam: kas.tunggakanJam, petugasBerhenti: state.keuangan.petugasBerhenti + kas.berhenti },
      hariKe,
      keu,
      dtJam,
      penumpang,
    ),
    statistik: {
      waktuMainDetik,
      totalPenumpang: s.totalPenumpang + penumpang,
      totalPendapatan: s.totalPendapatan + keu.totalPendapatan * dtJam,
      totalBiaya: s.totalBiaya + keu.totalBiaya * dtJam,
    },
    rekor: majukanRekor(state.rekor, hariSelesai, op.arus),
    hadiah: majukanHadiah(state, dtDetik, cfg),
    event: state.event.aktif && penumpang > 0 ? { ...state.event, progres: state.event.progres + penumpang } : state.event,
    tantangan: majukanTantangan(state.tantangan, op.kepuasan.nilai, penumpang, laba, dtDetik, cfg),
    mitra: majukanMitra(state.mitra, op, kelasTerminal(state, cfg), dtDetik, 1, true, cfg),
    perkembangan: majukanPerkembangan(state.perkembangan, penumpang, dtDetik),
  };
  const harian = hariSelesai ? buatTargetHarian(dasar, hariKe, cfg) : tambahProgres(state.harian, state.harian.jenis === 'penumpang' ? penumpang : laba);
  return perbaruiPencapaian(urusKontrak(manajerKemitraan({ ...dasar, harian }, op, cfg), cfg), cfg);
}

/**
 * XP PO dari bus yang berangkat (1 XP per penumpangPerBus penumpangnya),
 * reputasi menuju targetnya, dan sisa kontrak. `efisiensi` < 1 untuk offline.
 */
function majukanMitra(m: MitraState, op: HasilOperasi, kelasTerminal: number, dt: number, efisiensi: number, kontrakBerjalan: boolean, cfg: KonfigEkonomi, arusPo?: readonly number[]): MitraState {
  if (m.terdaftar.length === 0) return m;
  const dtJam = dt / WAKTU.detikPerJam;
  const terdaftar = m.terdaftar.map((p, i) => {
    const arus = arusPo?.[i] ?? op.po[i]?.arus ?? 0;
    const bus = (arus * dtJam * efisiensi) / cfg.tycoon.kapasitas.penumpangPerBus;
    const kelas = kelasAktif(p.id, levelPoDariXp(p.xp, cfg), kelasTerminal, cfg).length;
    const reputasi = majukanReputasi(p.reputasi, targetReputasi(op.kepuasan.nilai, kelas, cfg), dt, cfg);
    return { ...p, xp: p.xp + bus, reputasi, kontrakDetik: kontrakBerjalan ? p.kontrakDetik - dt : p.kontrakDetik };
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

/** Laba bersih satu buku harian (Rp). */
export function labaBuku(b: BukuHarian): number {
  return jumlahRincian(b.pendapatan) - jumlahRincian(b.biaya);
}

export function jumlahRincian(r: RincianPendapatan | RincianBiaya): number {
  return Object.values(r).reduce((a: number, b: number) => a + b, 0);
}

function tambahRincian<T extends RincianPendapatan | RincianBiaya>(a: T, b: T, f: number): T {
  const hasil = { ...a } as Record<string, number>;
  for (const [k, v] of Object.entries(b)) hasil[k] = (hasil[k] ?? 0) + (v as number) * f;
  return hasil as unknown as T;
}

/** Catat pendapatan, biaya & penumpang ke buku hari ini; saat hari berganti, buku hari ini jadi buku kemarin. */
function majukanKeuangan(k: KeuanganState, hariKe: number, keu: KeuanganJam, dtJam: number, penumpang: number): KeuanganState {
  let x = k;
  if (hariKe !== k.hariIni.hariKe) {
    x = { ...k, kemarin: k.hariIni, hariIni: buatBukuHarian(hariKe), hariTanpaRugi: labaBuku(k.hariIni) >= 0 ? k.hariTanpaRugi + 1 : 0 };
  }
  const h = x.hariIni;
  return {
    ...x,
    hariIni: { hariKe: h.hariKe, pendapatan: tambahRincian(h.pendapatan, keu.pendapatan, dtJam), biaya: tambahRincian(h.biaya, keu.biaya, dtJam), penumpang: h.penumpang + penumpang },
  };
}

/** Rekor: hari terminal yang baru selesai dibandingkan dengan rekornya; arus tertinggi tiap tick. */
function majukanRekor(r: RekorState, hariSelesai: BukuHarian | null, arus: number): RekorState {
  let x = r;
  if (hariSelesai) {
    const laba = labaBuku(hariSelesai);
    if (hariSelesai.penumpang > x.penumpangHarian || laba > x.labaHarian) {
      x = { ...x, penumpangHarian: Math.max(x.penumpangHarian, hariSelesai.penumpang), labaHarian: Math.max(x.labaHarian, laba) };
    }
  }
  return arus > x.arusTertinggi ? { ...x, arusTertinggi: arus } : x;
}

/** Kemajuan tantangan mingguan dari satu tick main aktif. */
function majukanTantangan(t0: TantanganState, kepuasan: number, penumpang: number, laba: number, dt: number, cfg: KonfigEkonomi): TantanganState {
  let t = t0;
  if (t.minggu === null) return t;
  if (penumpang > 0) t = { ...t, penumpang: t.penumpang + penumpang };
  t = tambahProgresTantangan(t, 'penumpang', penumpang);
  t = tambahProgresTantangan(t, 'laba', laba);
  if (kepuasan >= cfg.tantangan.kepuasanMin) t = tambahProgresTantangan(t, 'kepuasan', dt);
  return t;
}

/**
 * Tambah kemajuan tantangan jenis ini yang belum tercapai (boleh negatif, untuk
 * laba yang turun saat rugi; tidak di bawah nol). State sama persis kalau tidak berubah.
 */
export function tambahProgresTantangan(t: TantanganState, jenis: JenisTantangan, jumlah: number): TantanganState {
  if (!jumlah || !Number.isFinite(jumlah)) return t;
  const i = t.daftar.findIndex((x) => x.jenis === jenis && x.progres < x.target);
  if (i < 0) return t;
  const x = t.daftar[i]!;
  const progres = Math.min(x.target, Math.max(0, x.progres + jumlah));
  if (progres === x.progres) return t;
  return { ...t, daftar: t.daftar.map((y, j) => (j === i ? { ...y, progres } : y)) };
}

// ---------------------------------------------------------------------------
// Target harian

/** Bulatkan ke 2 angka penting (target yang enak dibaca: 31.000, bukan 31.680). */
function bulatkanTarget(n: number): number {
  if (n < 100) return Math.max(10, Math.round(n / 10) * 10);
  const skala = Math.pow(10, Math.floor(Math.log10(n)) - 1);
  return Math.round(n / skala) * skala;
}

/** Target baru untuk hari ke-`hariKe`: penumpang (hari genap) atau laba bersih (hari ganjil), dari rata-rata sehari dengan tarif bawaan. */
export function buatTargetHarian(state: GameState, hariKe: number, cfg: KonfigEkonomi = EKONOMI): HarianState {
  const jenis: JenisTarget = hariKe % 2 === 0 ? 'penumpang' : 'laba';
  const a = acuanHarian(state, cfg);
  const target =
    jenis === 'penumpang'
      ? bulatkanTarget(Math.max(10, a.arus) * 24 * cfg.harian.fraksiPenumpang)
      : bulatkanTarget(Math.max(a.laba, cfg.hadiah.minPerMenit) * 24 * cfg.harian.fraksiLaba);
  return { hariKe, jenis, target, progres: 0, diklaim: false, jumlahSelesai: state.harian.jumlahSelesai };
}

/** Kemajuan target harian (laba bisa turun saat rugi, tidak di bawah nol); yang sudah tercapai tetap tercapai. */
function tambahProgres(h: HarianState, jumlah: number): HarianState {
  if (h.progres >= h.target || !jumlah || !Number.isFinite(jumlah)) return h;
  const progres = Math.min(h.target, Math.max(0, h.progres + jumlah));
  if (progres === h.progres) return h;
  return { ...h, progres, jumlahSelesai: h.jumlahSelesai + (progres >= h.target ? 1 : 0) };
}

export function targetHarianSelesai(state: GameState): boolean {
  return state.harian.progres >= state.harian.target;
}

export function bisaKlaimTarget(state: GameState): boolean {
  return targetHarianSelesai(state) && !state.harian.diklaim;
}

/** @param ganda hadiah 2× (setelah menonton iklan berhadiah). */
export function klaimTarget(state: GameState, cfg: KonfigEkonomi = EKONOMI, ganda = false): GameState {
  if (!bisaKlaimTarget(state)) return state;
  const hadiah = hadiahMenit(state, cfg.harian.hadiahMenit, cfg) * (ganda ? 2 : 1);
  return { ...tambahKas(state, hadiah), harian: { ...state.harian, diklaim: true } };
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
    ...tambahKas(state, hadiahMenit(state, cfg.hadiahMenitPencapaian, cfg) * (ganda ? 2 : 1)),
    pencapaian: { ...state.pencapaian, diklaim: [...state.pencapaian.diklaim, id] },
  };
}

// ---------------------------------------------------------------------------
// Bangun & bongkar

/** Biaya membangun satu unit lagi (Rp), atau null bila slotnya penuh (tunggu perluasan). */
export function biayaBangunState(state: GameState, id: BangunanId, cfg: KonfigEkonomi = EKONOMI): number | null {
  return biayaBangun(id, state.terminal.bangunan, state.perkembangan.perluasan, cfg);
}

/** @param po jendela loket untuk PO ini (hanya jendela; PO harus terdaftar). */
export function bisaBangun(state: GameState, id: BangunanId, po: PoId | null = null, cfg: KonfigEkonomi = EKONOMI): boolean {
  const biaya = biayaBangunState(state, id, cfg);
  if (biaya === null || state.kas < biaya) return false;
  return po === null || (id === 'jendela' && cariPo(state, po) !== undefined);
}

/** Kapasitas satu jendela loket sekarang (pnp per jam, dengan modernisasi Loket). */
function kapasitasPerJendela(state: GameState, cfg: KonfigEkonomi): number {
  return cfg.tycoon.kapasitas.jendela * multTeknologi(state.terminal.teknologi, 'loket', cfg);
}

/**
 * PO yang menerima jendela loket baru bila tidak dipilih: yang antrean jam
 * sibuknya paling panjang (permintaan − kapasitas jendelanya). Null = tanpa PO.
 */
export function poTujuanJendela(state: GameState, cfg: KonfigEkonomi = EKONOMI): PoId | null {
  let pilih: PoId | null = null;
  let kurang = Number.NEGATIVE_INFINITY;
  for (const p of operasiState(state, cfg).po) {
    const k = p.permintaanPuncak - p.kapasitasLoket;
    if (k > kurang + 1e-9) {
      kurang = k;
      pilih = p.id;
    }
  }
  return pilih;
}

/**
 * Bangun satu unit di slot berikutnya. Jendela loket langsung disewa PO
 * (bawaan: yang antreannya paling panjang).
 */
export function bangun(state: GameState, id: BangunanId, po: PoId | null = null, cfg: KonfigEkonomi = EKONOMI): GameState {
  if (!bisaBangun(state, id, po, cfg)) return state;
  const biaya = biayaBangunState(state, id, cfg)!;
  const b = state.terminal.bangunan;
  const tujuan = id === 'jendela' ? (po ?? poTujuanJendela(state, cfg)) : null;
  const mitra = tujuan ? gantiPo(state, tujuan, (p) => ({ ...p, loket: p.loket + 1 })) : state.mitra;
  return catatBangun({ ...state, kas: kurangiKas(state.kas, biaya), terminal: { ...state.terminal, bangunan: { ...b, [id]: b[id] + 1 } }, mitra });
}

/** Uang yang kembali bila satu unit dibongkar, atau null bila tidak bisa (jalur permanen; hanya jendela kosong yang bisa dibongkar). */
export function pengembalianBongkarState(state: GameState, id: BangunanId, cfg: KonfigEkonomi = EKONOMI): number | null {
  if (id === 'jendela' && jendelaKosong(state) <= 0) return null;
  return pengembalianBongkar(id, state.terminal.bangunan, cfg);
}

/** Bongkar satu unit (sebagian biayanya kembali); petugas yang melebihi batas barunya keluar, mulai dari yang terbaru. */
export function bongkar(state: GameState, id: BangunanId, cfg: KonfigEkonomi = EKONOMI): GameState {
  const kembali = pengembalianBongkarState(state, id, cfg);
  if (kembali === null) return state;
  const b = state.terminal.bangunan;
  const bangunan = { ...b, [id]: b[id] - 1 };
  return { ...state, kas: state.kas + kembali, terminal: { ...state.terminal, bangunan, petugas: rapikanPetugas(state.terminal.petugas, bangunan) } };
}

/** Membangun (unit atau modernisasi) menambah progres tantangan mingguan "bangun". */
function catatBangun(state: GameState): GameState {
  return { ...state, tantangan: tambahProgresTantangan(state.tantangan, 'bangun', 1) };
}

// ---------------------------------------------------------------------------
// Petugas

export function bisaRekrutPetugas(state: GameState, id: PetugasId): boolean {
  return bisaRekrut(id, state.terminal.petugas, state.terminal.bangunan);
}

/** Rekrut satu petugas: tanpa biaya sekali bayar, gajinya dibayar terus dari kas. */
export function rekrutPetugas(state: GameState, id: PetugasId): GameState {
  if (!bisaRekrutPetugas(state, id)) return state;
  return { ...state, terminal: { ...state.terminal, petugas: rekrut(state.terminal.petugas, id) } };
}

export function bisaBerhentikanPetugas(state: GameState, id: PetugasId): boolean {
  return adaPetugas(state, id);
}

/** Berhentikan satu petugas peran ini (yang paling akhir direkrut). */
export function berhentikanPetugas(state: GameState, id: PetugasId): GameState {
  if (!bisaBerhentikanPetugas(state, id)) return state;
  return { ...state, terminal: { ...state.terminal, petugas: berhentikan(state.terminal.petugas, id) } };
}

// ---------------------------------------------------------------------------
// Tarif terminal

/** Atur satu tarif (dirapikan ke rentang & langkahnya). */
export function aturTarif(state: GameState, id: TarifId, nilai: number, cfg: KonfigEkonomi = EKONOMI): GameState {
  const v = jepitTarif(id, nilai, cfg);
  if (v === state.terminal.tarif[id]) return state;
  return { ...state, terminal: { ...state.terminal, tarif: { ...state.terminal.tarif, [id]: v } } };
}

/**
 * Saran tarif: yang paling banyak mendatangkan laba dalam sehari biasa (tarif
 * lain tetap), selama kepuasan mitra semua PO tetap cukup untuk memperpanjang
 * kontrak. Bila tidak ada yang cukup: yang paling memuaskan mitra.
 */
export function saranTarif(state: GameState, id: TarifId, cfg: KonfigEkonomi = EKONOMI): number {
  const t = cfg.tycoon.tarif[id];
  const sekarang = state.terminal.tarif[id];
  const min = cfg.tycoon.mitra.minimal;
  let pilih = sekarang;
  let labaPilih = Number.NEGATIVE_INFINITY;
  let mitraPilih = Number.NEGATIVE_INFINITY;
  let labaSekarang: number | null = null;
  for (let i = 0; t.min + i * t.langkah <= t.maks + 1e-9; i++) {
    const v = jepitTarif(id, t.min + i * t.langkah, cfg);
    const a = acuanHarian(state, cfg, { ...state.terminal.tarif, [id]: v });
    const aman = a.kepuasanMitraMin >= min;
    if (v === sekarang && aman) labaSekarang = a.laba;
    const lebihBaik = aman ? mitraPilih < min || a.laba > labaPilih + 1e-6 : mitraPilih < min && a.kepuasanMitraMin > mitraPilih + 1e-9;
    if (lebihBaik) {
      pilih = v;
      labaPilih = a.laba;
      mitraPilih = a.kepuasanMitraMin;
    }
  }
  // Seri (mis. toilet belum dibangun): tarif sekarang tidak perlu diubah.
  return labaSekarang !== null && labaSekarang >= labaPilih - 1 ? sekarang : pilih;
}

/** Pakai saran untuk satu tarif. */
export function pakaiSaranTarif(state: GameState, id: TarifId, cfg: KonfigEkonomi = EKONOMI): GameState {
  return aturTarif(state, id, saranTarif(state, id, cfg), cfg);
}

// ---------------------------------------------------------------------------
// Modernisasi

/** Syarat modernisasi terpenuhi (teknologi pendahulunya sudah dipasang). */
export function syaratTeknologi(state: GameState, id: TeknologiId, cfg: KonfigEkonomi = EKONOMI): boolean {
  const syarat = cfg.teknologi[id].syarat;
  return syarat === null || state.terminal.teknologi[syarat];
}

export function bisaBeliTeknologi(state: GameState, id: TeknologiId, cfg: KonfigEkonomi = EKONOMI): boolean {
  return !state.terminal.teknologi[id] && syaratTeknologi(state, id, cfg) && state.kas >= cfg.teknologi[id].biaya;
}

export function beliTeknologi(state: GameState, id: TeknologiId, cfg: KonfigEkonomi = EKONOMI): GameState {
  if (!bisaBeliTeknologi(state, id, cfg)) return state;
  return catatBangun({
    ...state,
    kas: kurangiKas(state.kas, cfg.teknologi[id].biaya),
    terminal: { ...state.terminal, teknologi: { ...state.terminal.teknologi, [id]: true } },
  });
}

// ---------------------------------------------------------------------------
// Mitra PO: daftar, putus, perpanjang, jendela kosong

function gantiPo(state: GameState, id: PoId, ubah: (p: PoTerdaftar) => PoTerdaftar): MitraState {
  return { ...state.mitra, terdaftar: state.mitra.terdaftar.map((p) => (p.id === id ? ubah(p) : p)) };
}

/** Jendela loket untuk PO baru: jendela kosong dulu, sisanya dibangun PO sendiri di slot kosong (gratis bagi terminal). */
function jendelaPoBaru(state: GameState, id: PoId, cfg: KonfigEkonomi): { readonly dariKosong: number; readonly dibangun: number } {
  const bawaan = tingkatPo(id, cfg).loketBawaan;
  const dariKosong = Math.min(jendelaKosong(state), bawaan);
  const slot = biayaBangunState(state, 'jendela', cfg) === null ? 0 : Math.max(0, slotJendela(state, cfg) - state.terminal.bangunan.jendela);
  return { dariKosong, dibangun: Math.min(bawaan - dariKosong, slot) };
}

function slotJendela(state: GameState, cfg: KonfigEkonomi): number {
  const s = cfg.tycoon.bangunan.jendela.slot;
  return s[Math.min(s.length - 1, Math.max(0, state.perkembangan.perluasan))] ?? 0;
}

/**
 * Perkiraan kepuasan mitra PO yang baru bergabung: busnya penuh, antrean di
 * jendelanya sedang, dengan tarif sewa loket & retribusi dan kepuasan penumpang sekarang.
 */
export function perkiraanKepuasanMitraBaru(state: GameState, cfg: KonfigEkonomi = EKONOMI): number {
  const b = cfg.tycoon.mitra.bobot;
  const skor = skorTarifMitra(state.terminal.tarif, retribusiDipungut(state.terminal), cfg);
  return (b.tarif * skor + b.penuh + b.jendela * 0.5 + b.kepuasan * kepuasanTerminal(state, cfg).nilai) / (b.tarif + b.penuh + b.jendela + b.kepuasan);
}

/** Syarat yang masih kurang untuk mendaftarkan PO ini (null = boleh, tinggal kasnya). */
export type KurangDaftarPo =
  | SyaratDaftarKurang
  | { readonly jenis: 'terdaftar' }
  | { readonly jenis: 'slot' }
  | { readonly jenis: 'jeda'; readonly sampaiDetik: number }
  /** Tidak ada jendela kosong maupun slot jendela untuk PO ini. */
  | { readonly jenis: 'jendela' }
  /** PO menolak bergabung: perkiraan kepuasan mitranya di bawah batas (tarif sewa loket & retribusi terlalu tinggi). */
  | { readonly jenis: 'mitra'; readonly perkiraan: number };

export function syaratDaftarPoKurang(state: GameState, id: PoId, cfg: KonfigEkonomi = EKONOMI): KurangDaftarPo | null {
  if (cariPo(state, id)) return { jenis: 'terdaftar' };
  const syarat = syaratDaftarKurang(id, { kelasTerminal: kelasTerminal(state, cfg), kepuasan: kepuasanTerminal(state, cfg).nilai, hadiahEvent: state.mitra.hadiahEvent.includes(id) }, cfg);
  if (syarat) return syarat;
  const jeda = state.mitra.jedaSampai[id];
  if (jeda !== undefined && jeda > state.statistik.waktuMainDetik) return { jenis: 'jeda', sampaiDetik: jeda };
  if (state.mitra.terdaftar.length >= slotPoState(state, cfg)) return { jenis: 'slot' };
  const j = jendelaPoBaru(state, id, cfg);
  if (j.dariKosong + j.dibangun < 1) return { jenis: 'jendela' };
  const perkiraan = perkiraanKepuasanMitraBaru(state, cfg);
  if (perkiraan < cfg.tycoon.mitra.minimal) return { jenis: 'mitra', perkiraan };
  return null;
}

export function bisaDaftarPo(state: GameState, id: PoId, cfg: KonfigEkonomi = EKONOMI): boolean {
  return syaratDaftarPoKurang(state, id, cfg) === null && state.kas >= biayaDaftarPo(id, cfg);
}

/**
 * Daftarkan PO: menempati slot dan langsung menyewa jendela loket bawaannya.
 * Jendela kosong dipakai lebih dulu; kekurangannya dibangun PO sendiri di slot
 * kosong (pemain tidak membayar, tapi tetap merawatnya). Riwayat dilanjutkan.
 */
export function daftarPo(state: GameState, id: PoId, cfg: KonfigEkonomi = EKONOMI): GameState {
  if (!bisaDaftarPo(state, id, cfg)) return state;
  const j = jendelaPoBaru(state, id, cfg);
  const riwayat = { ...state.mitra.riwayat };
  const lama = riwayat[id];
  delete riwayat[id];
  const mitra: MitraState = { ...state.mitra, riwayat, terdaftar: [...state.mitra.terdaftar, buatPoTerdaftar(id, j.dariKosong + j.dibangun, cfg, lama)] };
  const b = state.terminal.bangunan;
  return {
    ...state,
    kas: kurangiKas(state.kas, biayaDaftarPo(id, cfg)),
    mitra,
    terminal: j.dibangun > 0 ? { ...state.terminal, bangunan: { ...b, jendela: b.jendela + j.dibangun } } : state.terminal,
  };
}

/** PO keluar (putus atau kontrak habis): jendelanya jadi kosong, data PO disimpan di riwayat. */
function keluarkanPo(state: GameState, id: PoId, putus: boolean, cfg: KonfigEkonomi): GameState {
  const p = cariPo(state, id);
  if (!p) return state;
  const k = cfg.mitra.kontrak;
  const riwayat = { ...state.mitra.riwayat, [id]: { xp: p.xp, reputasi: Math.max(0, p.reputasi - (putus ? k.penaltiReputasiPutus : 0)) } };
  const jedaSampai = putus ? { ...state.mitra.jedaSampai, [id]: state.statistik.waktuMainDetik + k.jedaPutusHari * DETIK_SEHARI } : state.mitra.jedaSampai;
  return { ...state, mitra: { ...state.mitra, riwayat, jedaSampai, terdaftar: state.mitra.terdaftar.filter((x) => x.id !== id) } };
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

/**
 * Kenapa kontrak PO ini tidak bisa diperpanjang sekarang (null = bisa):
 * sisanya sudah paling panjang, kepuasan mitranya di bawah batas, atau (PO
 * premium) kepuasan penumpang di bawah syaratnya. Perpanjangan gratis.
 */
export type KurangPerpanjang = 'penuh' | 'mitra' | 'kepuasan';

function kurangPerpanjang(state: GameState, p: PoTerdaftar, kepuasanMitra: number, cfg: KonfigEkonomi): KurangPerpanjang | null {
  if (p.kontrakDetik >= cfg.mitra.kontrak.hariMaks * DETIK_SEHARI - 1e-6) return 'penuh';
  if (kepuasanMitra < cfg.tycoon.mitra.minimal) return 'mitra';
  const min = cfg.mitra.po[p.id].kepuasanMin;
  if (min !== undefined && kepuasanTerminal(state, cfg).nilai < min) return 'kepuasan';
  return null;
}

export function kurangPerpanjangPo(state: GameState, id: PoId, cfg: KonfigEkonomi = EKONOMI): KurangPerpanjang | null {
  const p = cariPo(state, id);
  if (!p) return 'penuh';
  return kurangPerpanjang(state, p, kepuasanMitraPo(state, id, cfg) ?? 0, cfg);
}

export function bisaPerpanjangPo(state: GameState, id: PoId, cfg: KonfigEkonomi = EKONOMI): boolean {
  return cariPo(state, id) !== undefined && kurangPerpanjangPo(state, id, cfg) === null;
}

function perpanjang(state: GameState, id: PoId, cfg: KonfigEkonomi): GameState {
  return { ...state, mitra: gantiPo(state, id, (p) => ({ ...p, kontrakDetik: sisaSetelahPerpanjang(p.kontrakDetik / DETIK_SEHARI, cfg) * DETIK_SEHARI })) };
}

export function perpanjangPo(state: GameState, id: PoId, cfg: KonfigEkonomi = EKONOMI): GameState {
  return bisaPerpanjangPo(state, id, cfg) ? perpanjang(state, id, cfg) : state;
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

/**
 * Manajer Kemitraan: mengisi jendela kosong, dan memperpanjang kontrak yang
 * tinggal ≤ 1 hari bila PO-nya mau. Kepuasan mitra dari operasi tick ini.
 */
function manajerKemitraan(state: GameState, op: HasilOperasi, cfg: KonfigEkonomi): GameState {
  if (!adaPetugas(state, 'manajerKemitraan')) return state;
  let s = jendelaKosong(state) > 0 ? isiJendelaKosong(state, null, cfg) : state;
  for (const p of s.mitra.terdaftar) {
    if (p.kontrakDetik > DETIK_SEHARI) continue;
    const mitra = op.po.find((x) => x.id === p.id)?.kepuasanMitra ?? 0;
    if (kurangPerpanjang(s, p, mitra, cfg) === null) s = perpanjang(s, p.id, cfg);
  }
  return s;
}

/**
 * Sewakan jendela kosong (gratis). Dengan `po`: satu jendela untuk PO itu.
 * Tanpa `po`: semua jendela kosong, satu per satu ke PO yang antrean jam
 * sibuknya paling panjang.
 */
export function isiJendelaKosong(state: GameState, po: PoId | null = null, cfg: KonfigEkonomi = EKONOMI): GameState {
  const kosong = jendelaKosong(state);
  if (kosong <= 0) return state;
  if (po !== null) return cariPo(state, po) ? { ...state, mitra: gantiPo(state, po, (p) => ({ ...p, loket: p.loket + 1 })) } : state;
  const per = kapasitasPerJendela(state, cfg);
  const kurang = new Map(operasiState(state, cfg).po.map((p) => [p.id, p.permintaanPuncak - p.kapasitasLoket]));
  const tambah = new Map<PoId, number>();
  for (let i = 0; i < kosong; i++) {
    let pilih: PoId | null = null;
    for (const [id, k] of kurang) if (pilih === null || k > kurang.get(pilih)! + 1e-9) pilih = id;
    if (pilih === null) break;
    tambah.set(pilih, (tambah.get(pilih) ?? 0) + 1);
    kurang.set(pilih, kurang.get(pilih)! - per);
  }
  if (tambah.size === 0) return state;
  return { ...state, mitra: { ...state.mitra, terdaftar: state.mitra.terdaftar.map((p) => (tambah.has(p.id) ? { ...p, loket: p.loket + tambah.get(p.id)! } : p)) } };
}

// ---------------------------------------------------------------------------
// Perluasan terminal

export function bisaMulaiPerluasan(state: GameState, cfg: KonfigEkonomi = EKONOMI): boolean {
  const p = state.perkembangan;
  const biaya = biayaPerluasan(p.perluasan, cfg);
  return p.proyekDetik <= 0 && biaya !== null && levelCukupPerluasan(p.perluasan, levelTerminal(state, cfg), cfg) && state.kas >= biaya;
}

/** Bayar & mulai proyek tahap perluasan berikutnya; slot barunya terbuka setelah proyek selesai (lihat majukanPerkembangan). */
export function mulaiPerluasan(state: GameState, cfg: KonfigEkonomi = EKONOMI): GameState {
  if (!bisaMulaiPerluasan(state, cfg)) return state;
  return {
    ...state,
    kas: kurangiKas(state.kas, biayaPerluasan(state.perkembangan.perluasan, cfg)!),
    perkembangan: { ...state.perkembangan, proyekDetik: cfg.mitra.detikProyek },
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

/** Detik offline yang dihitung: selisih jam dinding, paling lama batas offline; 0 bila jam mundur atau tidak valid. */
export function detikOffline(sekarangMs: number, terakhirMs: number, cfg: KonfigEkonomi = EKONOMI): number {
  const selisih = (sekarangMs - terakhirMs) / 1000;
  if (!Number.isFinite(selisih) || selisih <= 0) return 0;
  return Math.min(selisih, cfg.tycoon.offline.batasDetik);
}

interface HasilOffline {
  readonly state: GameState;
  readonly laporan: LaporanOffline;
}

/**
 * Terminal berjalan selama game ditutup, bila ada Manajer Operasional. Jam
 * terminal berhenti, jadi dihitung dari rata-rata hari biasa: pendapatan ×
 * efisiensi (tidak pernah melebihi hasil tarif bawaan, supaya tarif ekstrem
 * tidak bisa dipakai menimbun uang saat pergi; boost yang tersisa ikut berjalan)
 * dikurangi biaya penuh. Kas tetap tidak minus: bila habis, petugas berhenti
 * satu per satu dan biayanya ikut turun.
 */
function jalankanOffline(state: GameState, detik: number, cfg: KonfigEkonomi): HasilOffline {
  const efisiensi = cfg.tycoon.offline.efisiensi;
  const totalJam = detik / WAKTU.detikPerJam;
  const jamBoost = Math.min(detik, state.hadiah.boostDetik) / WAKTU.detikPerJam;
  let s = state;
  let kas = state.kas;
  let tunggakan = state.keuangan.tunggakanJam;
  let jalan = 0;
  let pendapatan = 0;
  let biaya = 0;
  let berhenti = 0;
  const penumpangPo = state.mitra.terdaftar.map(() => 0);
  const catat = (a: AcuanHarian, pendapatanJam: number, jam: number): void => {
    pendapatan += pendapatanJam * jam;
    biaya += a.biaya * jam;
    a.arusPo.forEach((x, i) => (penumpangPo[i]! += x * jam * efisiensi));
    jalan += jam;
  };
  // Tiap putaran: sampai boost habis, sampai seorang petugas berhenti, atau sampai selesai.
  while (jalan < totalJam - 1e-9 && adaManajerOperasional(s)) {
    const a = acuanHarian(s, cfg, s.terminal.tarif);
    const boost = jalan < jamBoost - 1e-9;
    const pendapatanJam = Math.min(a.pendapatan, acuanHarian(s, cfg).pendapatan) * efisiensi * (boost ? cfg.hadiah.pengaliBoost : 1);
    const durasi = (boost ? Math.min(totalJam, jamBoost) : totalJam) - jalan;
    const labaJam = pendapatanJam - a.biaya;
    const k = majukanKas(kas, labaJam, durasi, tunggakan);
    if (k.berhenti === 0 || s.terminal.petugas.length === 0) {
      catat(a, pendapatanJam, durasi);
      kas = k.kas;
      tunggakan = s.terminal.petugas.length === 0 ? 0 : k.tunggakanJam;
      continue;
    }
    // Kas habis, lalu setelah satu jam terminal gaji tertunggak seorang petugas berhenti: biayanya ikut turun.
    catat(a, pendapatanJam, Math.min(durasi, Math.max(0, kas) / -labaJam + (1 - tunggakan)));
    kas = 0;
    tunggakan = 0;
    berhenti++;
    s = { ...s, terminal: { ...s.terminal, petugas: berhentiKasHabis(s.terminal.petugas) } };
  }
  const { op } = operasiDanKeadaan(s, cfg);
  const st = s.statistik;
  const arusPo = penumpangPo.map((x) => x / efisiensi / totalJam);
  const hasil: GameState = {
    ...s,
    kas,
    keuangan: { ...s.keuangan, tunggakanJam: tunggakan, petugasBerhenti: s.keuangan.petugasBerhenti + berhenti },
    statistik: { ...st, totalPendapatan: st.totalPendapatan + pendapatan, totalBiaya: st.totalBiaya + biaya },
    mitra: majukanMitra(s.mitra, op, kelasTerminal(s, cfg), detik, efisiensi, false, cfg, arusPo),
    perkembangan: { ...s.perkembangan, xpTerminal: s.perkembangan.xpTerminal + penumpangPo.reduce((x, y) => x + y, 0) },
  };
  return {
    state: hasil,
    laporan: { detik, dibatasi: false, tutup: false, pendapatan, biaya, laba: pendapatan - biaya, detikBoost: jamBoost * WAKTU.detikPerJam, berhenti },
  };
}

/** Laporan offline tanpa menerapkannya (pratinjau; lihat terapkanOffline). */
export function hitungOffline(state: GameState, sekarangMs: number, cfg: KonfigEkonomi = EKONOMI): LaporanOffline {
  return terapkanOffline(state, sekarangMs, cfg).laporan;
}

/**
 * Terapkan hasil selama app tertutup/pause lalu set `waktuTerakhirMs` ke
 * sekarang. Tanpa Manajer Operasional terminal tutup (tanpa pendapatan &
 * biaya). Proyek perluasan dikerjakan kontraktor: selalu berjalan. XP PO &
 * terminal bertambah dengan efisiensi offline; kontrak tidak berkurang karena
 * hari terminal berhenti. Selisih waktu negatif menghasilkan 0.
 */
export function terapkanOffline(state: GameState, sekarangMs: number, cfg: KonfigEkonomi = EKONOMI): { state: GameState; laporan: LaporanOffline } {
  const detik = detikOffline(sekarangMs, state.waktuTerakhirMs, cfg);
  const dibatasi = (sekarangMs - state.waktuTerakhirMs) / 1000 > cfg.tycoon.offline.batasDetik;
  const tutup = !adaManajerOperasional(state);
  let s = state;
  let laporan: LaporanOffline = { detik, dibatasi, tutup, pendapatan: 0, biaya: 0, laba: 0, detikBoost: 0, berhenti: 0 };
  if (detik > 0 && !tutup) {
    const h = jalankanOffline(state, detik, cfg);
    s = h.state;
    laporan = { ...h.laporan, dibatasi };
  }
  if (detik > 0) s = { ...s, perkembangan: majukanPerkembangan(s.perkembangan, 0, detik) };
  // Bonus 2× hanya untuk laba offline laporan ini; boost berkurang selama pergi.
  const hadiah = { ...s.hadiah, boostDetik: Math.max(0, s.hadiah.boostDetik - detik), bonusOffline: Math.max(0, Math.floor(laporan.laba)) };
  return { state: perbaruiPencapaian({ ...tandaiWaktu(s, sekarangMs), hadiah }, cfg), laporan };
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

/** Hadiah Bus Emas = sekian menit laba. */
export function hadiahBusEmas(state: GameState, cfg: KonfigEkonomi = EKONOMI): number {
  return hadiahMenit(state, cfg.hadiah.busEmasMenit, cfg);
}

export function klaimBusEmas(state: GameState, cfg: KonfigEkonomi = EKONOMI): GameState {
  if (!busEmasAktif(state)) return state;
  const b = state.hadiah.busEmas;
  const busEmas = { tungguDetik: selangBusEmas(state, b.jumlah + 1, cfg), aktifDetik: 0, jumlah: b.jumlah + 1 };
  return { ...tambahKas(state, hadiahBusEmas(state, cfg)), hadiah: { ...state.hadiah, busEmas } };
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
  return state.hadiah.bonusOffline > 0;
}

/** Klaim laba offline sekali lagi (jadi 2×), setelah iklan. */
export function klaimBonusOffline(state: GameState): GameState {
  if (!bisaKlaimBonusOffline(state)) return state;
  return { ...tambahKas(state, state.hadiah.bonusOffline), hadiah: { ...state.hadiah, bonusOffline: 0 } };
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

/** Pengali pasar penumpang dari event yang sedang berlangsung (1 = tidak ada event). */
export function pengaliEvent(state: GameState, cfg: KonfigEkonomi = EKONOMI): number {
  const a = state.event.aktif;
  return a ? cfg.event[a.id].pengaliPasar : 1;
}

/** Target tiap tahap event: arus rata-rata sekarang × detik main tiap tahap (dibulatkan). */
function targetEvent(state: GameState, id: EventId, cfg: KonfigEkonomi): number[] {
  const arus = Math.max(10, acuanHarian(state, cfg).arus);
  return cfg.event[id].targetDetik.map((d) => bulatkanTarget((arus * d) / WAKTU.detikPerJam));
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

/** Hadiah uang tahap event berikutnya (sekian menit laba). */
export function hadiahTahapEvent(state: GameState, cfg: KonfigEkonomi = EKONOMI): number {
  const id = idEdisiEvent(state.event.edisi);
  return id ? hadiahMenit(state, cfg.event[id].hadiahMenit[state.event.diklaim] ?? 0, cfg) : 0;
}

/** Klaim hadiah tahap event berikutnya; tahap terakhir juga membuka PO eksklusif event itu (boleh didaftarkan gratis). */
export function klaimEvent(state: GameState, cfg: KonfigEkonomi = EKONOMI): GameState {
  const id = idEdisiEvent(state.event.edisi);
  if (!id || !bisaKlaimEvent(state)) return state;
  const e = state.event;
  const po = cfg.event[id].po;
  const terakhir = e.diklaim === e.target.length - 1;
  const dapat = tambahKas(state, hadiahTahapEvent(state, cfg));
  const mitra = terakhir && !state.mitra.hadiahEvent.includes(po) ? { ...state.mitra, hadiahEvent: [...state.mitra.hadiahEvent, po] } : state.mitra;
  return { ...dapat, mitra, event: { ...e, diklaim: e.diklaim + 1 } };
}

// ---------------------------------------------------------------------------
// Tantangan mingguan & jam nyata

/** Target tantangan untuk terminal sekarang (dibulatkan supaya enak dibaca). */
function targetTantangan(state: GameState, jenis: JenisTantangan, cfg: KonfigEkonomi): number {
  const t = cfg.tantangan;
  const a = acuanHarian(state, cfg);
  switch (jenis) {
    case 'penumpang':
      return bulatkanTarget((Math.max(10, a.arus) * t.penumpangDetik) / WAKTU.detikPerJam);
    case 'laba':
      return bulatkanTarget((Math.max(a.laba, cfg.hadiah.minPerMenit) * t.labaDetik) / WAKTU.detikPerJam);
    case 'bangun':
      return t.bangun;
    case 'kepuasan':
      return t.kepuasanDetik;
  }
}

/** Hadiah uang satu tantangan (sekian menit laba). */
export function hadiahTantangan(state: GameState, cfg: KonfigEkonomi = EKONOMI): number {
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
  for (const x of state.tantangan.daftar) if (!x.diklaim && x.progres >= x.target) s = tambahKas(s, hadiahTantangan(s, cfg));
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
  return { ...tambahKas(state, hadiahTantangan(state, cfg)), tantangan: { ...state.tantangan, daftar } };
}

/** Semua yang mengikuti jam nyata: event musiman & tantangan mingguan (dipanggil sesi). */
export function perbaruiJamNyata(state: GameState, sekarangMs: number, cfg: KonfigEkonomi = EKONOMI, eventUji: EventId | null = null): GameState {
  return perbaruiTantangan(perbaruiEvent(state, sekarangMs, cfg, eventUji), sekarangMs, cfg);
}

// ---------------------------------------------------------------------------
// Helper internal

function petakan<K extends string, T>(ids: readonly K[], f: (id: K) => T): Record<K, T> {
  const hasil = {} as Record<K, T>;
  for (const id of ids) hasil[id] = f(id);
  return hasil;
}

/** Dijaga ≥ 0 supaya noise pembulatan tidak pernah menghasilkan kas negatif. */
function kurangiKas(kas: number, biaya: number): number {
  return Math.max(0, kas - biaya);
}

/** Uang di luar operasi (hadiah, bonus) langsung masuk kas; tidak dicatat di buku harian. */
function tambahKas(state: GameState, jumlah: number): GameState {
  return jumlah > 0 ? { ...state, kas: state.kas + jumlah } : state;
}
