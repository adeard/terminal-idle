/**
 * Musim Terminal (murni; documents/17-rancangan-musim-terminal.md, ADR 009): musim 6 minggu dari
 * kalender WIB di config (tanpa server), tiga tugas harian (main, sorotan, kelola) yang berlaku 2 hari,
 * poin & Rapor Musim 30 tingkat, hadiahnya (hiasan, tiket ganti, Surat Armada), dan rapor akhir musim.
 * Angka di config/musim.config.ts. Waktu selalu parameter: tidak membaca jam sendiri.
 *
 * Alurnya: app (main.ts) membuka musim lewat bukaMusim saat tutorial selesai & Lv ≥ lvBuka;
 * perbaruiJamNyata (state.ts) memanggil perbaruiMusim (hari baru, susulan kemarin, pergantian musim);
 * tick memajukan tugas lewat majukanTugas (main aktif saja, jadi offline tidak memajukannya); aksi
 * bangun/modernisasi/daftar PO/rekrut menilai tugas kelola (nilaiTugasKelola, dari aksi.ts). Tidak ada
 * yang di sini mengubah kas. Adegan hanya membaca hiasanAktif.
 */
import { EKONOMI, type KonfigEkonomi } from '../config/economy.config';
import type { Aksi } from './aksi';
import {
  BINGKAI_EMAS,
  KELOMPOK_TUGAS,
  KOMPONEN_PERBAIKAN,
  MUSIM,
  SLOT_HIASAN,
  TEMPLAT_TUGAS,
  type HadiahTingkat,
  type KelompokTugas,
  type KomponenPerbaikan,
  type KonfigMusim,
  type SlotHiasan,
  type TemaMusimId,
  type TemplatTugas,
} from '../config/musim.config';
import { WAKTU } from '../config/waktu.config';
import { BANGUNAN_IDS, isPoId, PETUGAS_IDS, PO_IDS, TEKNOLOGI_IDS, type PetugasId, type PoId, type TarifId } from './fitur';
import { keuanganPerJam, type KeuanganJam } from './keuangan';
import { levelPoDariXp, urutanPo, xpLevelPo } from './mitra';
import { hitungOperasi, type HasilOperasi } from './operasi';
import {
  acuanHarian,
  aturTarif,
  bangun,
  beliTeknologi,
  biayaBangunState,
  bisaBeliTeknologi,
  bisaDaftarPo,
  bulatkanTarget,
  cadanganKas,
  daftarPo,
  keadaanOperasi,
  labaDenganKontrak,
  levelPo,
  levelTerminal,
  operasiState,
  pengaliEvent,
  poArmada,
  rekrutPetugas,
  ritmeDari,
  saranTarif,
  syaratTeknologi,
  type GameState,
} from './state';
import { mingguWib } from './tantangan';
import { tarifBawaan } from './tarif';
import { keramaianTerminal, waktuTerminal } from './waktu';

export type { KelompokTugas, KomponenPerbaikan, SlotHiasan, TemaMusimId, TemplatTugas } from '../config/musim.config';

// ---------------------------------------------------------------------------
// State (blok `musim` di GameState & save; dokumen 17 bagian 9.1)

export interface TugasAktif {
  /** Kunci hari WIB tugas ini dibuat untuknya ("2026-12-01"); berlaku sampai akhir hari berikutnya. */
  readonly hari: string;
  readonly templat: TemplatTugas;
  readonly target: number;
  readonly progres: number;
  /** kota: indeks jurusan; poTerendah: id PO; kepuasan: ambang (0–1); perbaikan: komponen; lainnya null. */
  readonly param: number | string | null;
  readonly selesai: boolean;
}

export interface StatistikMusim {
  readonly tugas: number;
  readonly tantangan: number;
  /** Level terminal & total penumpang saat musim ini dimulai (rapor). */
  readonly lvAwal: number;
  readonly penumpangAwal: number;
}

/** Rapor musim yang sudah ditutup, ditampilkan sekali (popup rapor). */
export interface RaporMusim {
  readonly id: string;
  readonly tingkat: number;
  readonly poin: number;
  readonly tugas: number;
  readonly tantangan: number;
  readonly lvAwal: number;
  readonly lvAkhir: number;
  /** Penumpang yang diberangkatkan selama musim (main aktif). */
  readonly penumpang: number;
  /** Id hiasan dari tingkat yang tercapai musim itu. */
  readonly hiasan: readonly string[];
}

export interface MusimState {
  /** Kunci Senin awal musim yang sedang diikuti; null = belum terbuka. */
  readonly id: string | null;
  readonly poin: number;
  /** Tugas hari ini dan susulan/sisa kemarin, paling banyak tugas.maksTerbuka. */
  readonly tugas: readonly TugasAktif[];
  /** Hari terakhir yang tugasnya dibuat (hanya maju, juga bila jam perangkat dimundurkan). */
  readonly hariTugas: string | null;
  /** Hari ganti gratis terakhir dipakai. */
  readonly gantiHari: string | null;
  readonly tiketGanti: number;
  readonly suratArmada: number;
  /** Id hiasan yang dimiliki. Lencana tidak disimpan: diturunkan dari tingkat & riwayat (lencanaMusim). */
  readonly koleksi: readonly string[];
  readonly pakai: Readonly<Record<SlotHiasan, string | null>>;
  readonly statistik: StatistikMusim;
  /** Musim yang pernah diikuti (poin > 0) dan tingkat akhirnya. */
  readonly riwayat: readonly { readonly id: string; readonly tingkat: number }[];
  /** Rapor yang belum ditampilkan. */
  readonly rapor: RaporMusim | null;
  /** Popup sambutan sudah tampil. */
  readonly sambutan: boolean;
}

export function buatMusimAwal(): MusimState {
  return {
    id: null,
    poin: 0,
    tugas: [],
    hariTugas: null,
    gantiHari: null,
    tiketGanti: 0,
    suratArmada: 0,
    koleksi: [],
    pakai: { spanduk: null, seragam: null, papan: null, bingkai: null },
    statistik: { tugas: 0, tantangan: 0, lvAwal: 0, penumpangAwal: 0 },
    riwayat: [],
    rapor: null,
    sambutan: false,
  };
}

// ---------------------------------------------------------------------------
// Kalender (bagian 3.1)

const HARI_MS = 86_400_000;
const WIB_MS = 7 * 3_600_000;

/** Kunci hari WIB ("YYYY-MM-DD") pada waktu itu. */
export function kunciHariWib(ms: number): string {
  return new Date(ms + WIB_MS).toISOString().slice(0, 10);
}

/** Hari sebelum/sesudah kunci hari (`geser` hari). */
export function geserHari(hari: string, geser: number): string {
  return new Date(Date.parse(hari) + geser * HARI_MS).toISOString().slice(0, 10);
}

export interface MusimKalender {
  /** Kunci Senin awal musim. */
  readonly id: string;
  /** 0 = Musim 1. */
  readonly ke: number;
  readonly tema: TemaMusimId;
  /** Tahun awal musim (nama berulang: "Musim Hujan 2027"). */
  readonly tahun: number;
  /** Mulai (inklusif) & selesai (eksklusif), ms epoch. */
  readonly mulaiMs: number;
  readonly selesaiMs: number;
}

/** Musim yang berlangsung pada waktu itu; null sebelum Musim 1 dimulai (jangkar config). */
export function musimPada(ms: number, cm: KonfigMusim = MUSIM): MusimKalender | null {
  const hari = Math.floor((ms + WIB_MS) / HARI_MS);
  const jangkar = Math.round(Date.parse(cm.mulai) / HARI_MS);
  if (!(hari >= jangkar)) return null;
  const panjang = cm.mingguPerMusim * 7;
  const ke = Math.floor((hari - jangkar) / panjang);
  const awal = jangkar + ke * panjang;
  const id = new Date(awal * HARI_MS).toISOString().slice(0, 10);
  return { id, ke, tema: cm.tema[ke % cm.tema.length]!, tahun: Number(id.slice(0, 4)), mulaiMs: awal * HARI_MS - WIB_MS, selesaiMs: (awal + panjang) * HARI_MS - WIB_MS };
}

/** Musim dari kuncinya; null bila kunci itu bukan awal musim menurut config (mis. save diubah tangan). */
export function musimDariId(id: string, cm: KonfigMusim = MUSIM): MusimKalender | null {
  const ms = Date.parse(id);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(id) || !Number.isFinite(ms)) return null;
  const m = musimPada(ms - WIB_MS, cm);
  return m && m.id === id ? m : null;
}

// ---------------------------------------------------------------------------
// Poin, tingkat, hadiah (bagian 3.4, 4.1)

export function tingkatRapor(poin: number, cm: KonfigMusim = MUSIM): number {
  return Math.min(cm.poin.tingkat, Math.floor(Math.max(0, poin) / cm.poin.perTingkat + 1e-9));
}

export type NilaiRapor = 'cukup' | 'baik' | 'sangatBaik' | 'istimewa';

export function nilaiRapor(tingkat: number, cm: KonfigMusim = MUSIM): NilaiRapor {
  const [baik, sangat, istimewa] = cm.nilai;
  return tingkat >= istimewa ? 'istimewa' : tingkat >= sangat ? 'sangatBaik' : tingkat >= baik ? 'baik' : 'cukup';
}

export type JenisLencana = 'peserta' | 'lulus' | 'istimewa';

/** Hadiah satu tingkat untuk tema tertentu (id hiasan sudah jadi). */
export type HadiahMusim =
  | { readonly jenis: 'lencana'; readonly lencana: JenisLencana }
  | { readonly jenis: 'hiasan'; readonly slot: SlotHiasan; readonly item: string }
  | { readonly jenis: 'tiket'; readonly jumlah: number }
  | { readonly jenis: 'surat'; readonly jumlah: number };

/** Id hiasan bertema: `{slot}-{tema}`. */
export const idHiasan = (slot: SlotHiasan, tema: TemaMusimId): string => `${slot}-${tema}`;

function wujudkan(h: HadiahTingkat, tema: TemaMusimId): HadiahMusim {
  switch (h.jenis) {
    case 'lencana':
      return { jenis: 'lencana', lencana: h.lencana };
    case 'hiasan':
      return { jenis: 'hiasan', slot: h.slot, item: h.item ?? idHiasan(h.slot, tema) };
    case 'tiket':
    case 'surat':
      return { jenis: h.jenis, jumlah: h.jumlah };
  }
}

/** Hadiah tingkat ini untuk tema musim itu (kosong bila tingkat tanpa hadiah). */
export function hadiahTingkat(tingkat: number, tema: TemaMusimId, cm: KonfigMusim = MUSIM): HadiahMusim[] {
  return cm.hadiah.filter((h) => h.tingkat === tingkat).map((h) => wujudkan(h, tema));
}

/** Tingkat berhadiah berikutnya sesudah `tingkat` (null = tidak ada lagi). */
export function hadiahBerikut(tingkat: number, tema: TemaMusimId, cm: KonfigMusim = MUSIM): { readonly tingkat: number; readonly hadiah: HadiahMusim[] } | null {
  const t = cm.hadiah.find((h) => h.tingkat > tingkat)?.tingkat;
  return t === undefined ? null : { tingkat: t, hadiah: hadiahTingkat(t, tema, cm) };
}

/** Lencana tertinggi untuk tingkat ini (null = belum ada). */
export function lencanaMusim(tingkat: number, cm: KonfigMusim = MUSIM): JenisLencana | null {
  let hasil: JenisLencana | null = null;
  for (const h of cm.hadiah) if (h.jenis === 'lencana' && h.tingkat <= tingkat) hasil = h.lencana;
  return hasil;
}

/** Semua id hiasan yang sah (untuk menyaring save). */
export function semuaHiasan(cm: KonfigMusim = MUSIM): string[] {
  const ids = new Set<string>();
  for (const h of cm.hadiah) {
    if (h.jenis !== 'hiasan') continue;
    if (h.item) ids.add(h.item);
    else for (const t of cm.tema) ids.add(idHiasan(h.slot, t));
  }
  return [...ids];
}

/** Slot tempat hiasan ini dipakai (null = id tidak dikenal). */
export function slotHiasan(item: string, cm: KonfigMusim = MUSIM): SlotHiasan | null {
  for (const h of cm.hadiah) {
    if (h.jenis !== 'hiasan') continue;
    if (h.item === item || (!h.item && cm.tema.some((t) => idHiasan(h.slot, t) === item))) return h.slot;
  }
  return null;
}

/** Tema hiasan bertema (null untuk bingkai emas atau id tidak dikenal). */
export function temaHiasan(item: string, cm: KonfigMusim = MUSIM): TemaMusimId | null {
  if (item === BINGKAI_EMAS) return null;
  return cm.tema.find((t) => item.endsWith(`-${t}`)) ?? null;
}

function temaDari(m: MusimState, cm: KonfigMusim): TemaMusimId {
  return (m.id !== null ? musimDariId(m.id, cm)?.tema : undefined) ?? cm.tema[0]!;
}

/** Hadiah langsung diberikan: hiasan baru dimiliki & dipakai, yang sudah dimiliki jadi tiket; tiket & surat bertambah. */
function terapkanHadiah(m: MusimState, hadiah: readonly HadiahMusim[], cm: KonfigMusim): MusimState {
  let x = m;
  for (const h of hadiah) {
    switch (h.jenis) {
      case 'lencana':
        break;
      case 'hiasan':
        x = x.koleksi.includes(h.item)
          ? { ...x, tiketGanti: x.tiketGanti + cm.tiketDuplikat }
          : { ...x, koleksi: [...x.koleksi, h.item], pakai: { ...x.pakai, [h.slot]: h.item } };
        break;
      case 'tiket':
        x = { ...x, tiketGanti: x.tiketGanti + h.jumlah };
        break;
      case 'surat':
        x = { ...x, suratArmada: x.suratArmada + h.jumlah };
        break;
    }
  }
  return x;
}

/** Tambah poin musim (hanya musim terbuka), dengan hadiah tiap tingkat yang baru dilewati. */
export function tambahPoin(m: MusimState, poin: number, cm: KonfigMusim = MUSIM): MusimState {
  if (m.id === null || !(poin > 0)) return m;
  const dari = tingkatRapor(m.poin, cm);
  let x: MusimState = { ...m, poin: m.poin + poin };
  const ke = tingkatRapor(x.poin, cm);
  const tema = temaDari(m, cm);
  for (let t = dari + 1; t <= ke; t++) x = terapkanHadiah(x, hadiahTingkat(t, tema, cm), cm);
  return x;
}

/** Tantangan mingguan diklaim atau dikirim otomatis: +poin tantangan ke musim minggu itu. */
export function kreditTantangan(m: MusimState, cm: KonfigMusim = MUSIM): MusimState {
  if (m.id === null) return m;
  return tambahPoin({ ...m, statistik: { ...m.statistik, tantangan: m.statistik.tantangan + 1 } }, cm.poin.tantangan, cm);
}

/** Tandai tugas yang sudah mencapai targetnya selesai dan kreditkan poinnya. */
function selesaikanTugas(m: MusimState, cm: KonfigMusim): MusimState {
  const baru = m.tugas.filter((t) => !t.selesai && t.progres >= t.target - 1e-9).length;
  if (baru === 0) return m;
  const tugas = m.tugas.map((t) => (!t.selesai && t.progres >= t.target - 1e-9 ? { ...t, selesai: true } : t));
  return tambahPoin({ ...m, tugas, statistik: { ...m.statistik, tugas: m.statistik.tugas + baru } }, baru * cm.poin.tugas, cm);
}

// ---------------------------------------------------------------------------
// Kemajuan tugas (tick main aktif & aksi kelola)

/** Yang sudah dihitung tick untuk langkah ini (keadaan sebelum tick, seperti tick sendiri). */
export interface KemajuanTick {
  readonly dt: number;
  readonly op: HasilOperasi;
  readonly keu: KeuanganJam;
  /** Laba operasi + kontrak PO dirata-rata selama langkah ini (Rp), seperti target harian & tantangan. */
  readonly labaKemajuan: number;
}

/**
 * Majukan tugas yang terbuka dengan satu tick main aktif (laju sesungguhnya: pengali event & boost ikut),
 * lalu tandai yang selesai (+poin). Dipanggil tick saja, jadi offline tidak memajukan tugas.
 */
export function majukanTugas(m: MusimState, ctx: KemajuanTick, cfg: KonfigEkonomi = EKONOMI, cm: KonfigMusim = MUSIM): MusimState {
  if (m.id === null || !m.tugas.some((t) => !t.selesai)) return m;
  const dtJam = ctx.dt / WAKTU.detikPerJam;
  const { op, keu } = ctx;
  const arusSegmen = (pilih: (g: HasilOperasi['segmen'][number]) => boolean): number => op.segmen.reduce((a, g) => (pilih(g) ? a + g.arus : a), 0);
  let berubah = false;
  const tugas = m.tugas.map((t): TugasAktif => {
    if (t.selesai) return t;
    let progres = t.progres;
    switch (t.templat) {
      case 'penumpang':
        progres += op.arus * dtJam;
        break;
      case 'laba':
        progres = Math.max(0, progres + ctx.labaKemajuan);
        break;
      case 'kota':
        progres += arusSegmen((g) => g.jurusan === t.param) * dtJam;
        break;
      case 'antarpulau':
        progres += arusSegmen((g) => cfg.jurusan[g.jurusan]?.feri !== undefined) * dtJam;
        break;
      case 'kelasTinggi':
        progres += arusSegmen((g) => cm.kelasTinggi.includes(g.kelas)) * dtJam;
        break;
      case 'poTerendah':
        progres += (op.po.find((p) => p.id === t.param)?.arus ?? 0) * dtJam;
        break;
      case 'kios':
        progres += keu.pendapatan.sewaKios * dtJam;
        break;
      case 'parkir':
        progres += keu.pendapatan.parkir * dtJam;
        break;
      case 'kepuasan':
        // Pembulatan yang sama dengan pil HUD: "60%" di HUD selalu memenuhi ambang 60 % (P-1 playtest Citra).
        if (typeof t.param === 'number' && persenHud(op.kepuasan.nilai) >= persenHud(t.param)) progres += ctx.dt;
        break;
      case 'perbaikan':
        if (isKomponen(t.param)) progres = Math.max(progres, op.kepuasan[t.param]);
        break;
      case 'bangun':
      case 'daftarPo':
        break;
    }
    if (progres === t.progres) return t;
    berubah = true;
    return { ...t, progres };
  });
  return berubah ? selesaikanTugas({ ...m, tugas }, cm) : m;
}

/**
 * Aksi pemain yang berlaku menilai tugas kelola (bagian 3.2): bangun/modernisasi → `bangun`, daftar PO →
 * `daftarPo`, rekrut/bangun → `perbaikan` (nilai komponennya sesudah aksi). `state` = keadaan sesudah aksi.
 */
export function nilaiTugasKelola(state: GameState, jenisAksi: string, cfg: KonfigEkonomi = EKONOMI, cm: KonfigMusim = MUSIM): GameState {
  const m = state.musim;
  if (m.id === null || !m.tugas.some((t) => !t.selesai && KELOMPOK_TUGAS[t.templat] === 'kelola')) return state;
  // Lantai dihitung satu (isinya tidak dihitung terpisah; documents/18).
  const bangunan = jenisAksi === 'bangun' || jenisAksi === 'beliTeknologi' || jenisAksi === 'tambahLantai';
  let berubah = false;
  const tugas = m.tugas.map((t): TugasAktif => {
    if (t.selesai) return t;
    let progres = t.progres;
    if (t.templat === 'bangun' && bangunan) progres = 1;
    if (t.templat === 'daftarPo' && jenisAksi === 'daftarPo') progres = 1;
    if (t.templat === 'perbaikan' && (jenisAksi === 'rekrut' || jenisAksi === 'bangun') && isKomponen(t.param)) progres = Math.max(progres, operasiState(state, cfg).kepuasan[t.param]);
    if (progres === t.progres) return t;
    berubah = true;
    return { ...t, progres };
  });
  return berubah ? { ...state, musim: selesaikanTugas({ ...m, tugas }, cm) } : state;
}

const isKomponen = (v: unknown): v is KomponenPerbaikan => typeof v === 'string' && (KOMPONEN_PERBAIKAN as readonly string[]).includes(v);

/** Kepuasan dalam persen bulat, seperti pil HUD. */
const persenHud = (x: number): number => Math.round(x * 100);

// ---------------------------------------------------------------------------
// Membuat tugas (bagian 3.2)

/** Pola undian FNV yang sama dengan tantangan mingguan: urutan acak tetap dari benih, sama untuk semua pemain. */
function acak<T>(daftar: readonly T[], benih: string): T[] {
  let h = 2166136261;
  for (let i = 0; i < benih.length; i++) h = Math.imul(h ^ benih.charCodeAt(i), 16777619);
  const sisa = [...daftar];
  const hasil: T[] = [];
  while (sisa.length) {
    h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d) >>> 0;
    hasil.push(sisa.splice(h % sisa.length, 1)[0]!);
  }
  return hasil;
}

/** Laju rata-rata sehari (24 jam terminal mulai sekarang, tarif bawaan, pengali event, tanpa boost) per sumber tugas. */
interface LajuHarian {
  readonly arus: number;
  readonly kota: ReadonlyMap<number, number>;
  readonly antarpulau: number;
  readonly kelasTinggi: number;
  readonly po: ReadonlyMap<PoId, number>;
  readonly sewaKios: number;
  readonly parkir: number;
}

function lajuHarian(state: GameState, cfg: KonfigEkonomi, cm: KonfigMusim, tarif = tarifBawaan(cfg)): LajuHarian {
  const k = keadaanOperasi(state, cfg, tarif);
  const event = pengaliEvent(state, cfg);
  let arus = 0;
  let antarpulau = 0;
  let kelasTinggi = 0;
  let sewaKios = 0;
  let parkir = 0;
  const kota = new Map<number, number>();
  const po = new Map<PoId, number>();
  for (let j = 0; j < 24; j++) {
    const w = waktuTerminal(state.statistik.waktuMainDetik + j * WAKTU.detikPerJam);
    const op = hitungOperasi(k, { ritme: ritmeDari(keramaianTerminal(w), cfg), event }, cfg);
    const keu = keuanganPerJam(k, op, !w.siang, cfg);
    arus += op.arus / 24;
    sewaKios += keu.pendapatan.sewaKios / 24;
    parkir += keu.pendapatan.parkir / 24;
    for (const g of op.segmen) {
      kota.set(g.jurusan, (kota.get(g.jurusan) ?? 0) + g.arus / 24);
      if (cfg.jurusan[g.jurusan]?.feri !== undefined) antarpulau += g.arus / 24;
      if (cm.kelasTinggi.includes(g.kelas)) kelasTinggi += g.arus / 24;
    }
    for (const p of op.po) po.set(p.id, (po.get(p.id) ?? 0) + p.arus / 24);
  }
  return { arus, kota, antarpulau, kelasTinggi, po, sewaKios, parkir };
}

/** Kota sorotan dari laju yang sudah dihitung (lihat kotaSorotan). */
function kotaDari(laju: LajuHarian, hari: string, cfg: KonfigEkonomi, cm: KonfigMusim): number | null {
  const senin = mingguWib(Date.parse(hari) - WIB_MS).kunci;
  const dilayani = new Set([...laju.kota.entries()].filter(([, a]) => a > cm.tugas.arusMin).map(([j]) => j));
  if (dilayani.size === 0) return null;
  return acak(cfg.jurusan.map((_, i) => i), `kota-${senin}`).find((j) => dilayani.has(j)) ?? null;
}

/**
 * Kota sorotan minggu hari itu: urutan jurusan diundi dari kunci minggu (`kota-<Senin>`), kota pertama yang
 * dilayani terminal ini. Pemain yang melayani semua jurusan darat mendapat kota yang sama. Null = tidak ada.
 */
export function kotaSorotan(state: GameState, hari: string, cfg: KonfigEkonomi = EKONOMI, cm: KonfigMusim = MUSIM): number | null {
  return kotaDari(lajuHarian(state, cfg, cm), hari, cfg, cm);
}

/** Dibulatkan ke bawah ke kelipatan langkah (0,62 → 0,60). */
const turunKe = (x: number, langkah: number): number => Math.round(Math.floor(x / langkah + 1e-9) * langkah * 1e6) / 1e6;

/** Aksi yang menaikkan tiap komponen (urut coba). */
const AKSI_KOMPONEN: Readonly<Record<KomponenPerbaikan, readonly ({ readonly jenis: 'rekrut'; readonly petugas: PetugasId } | { readonly jenis: 'bangun'; readonly bangunan: 'kursi' | 'toilet' | 'kios' | 'toko' | 'lahanParkir' })[]>> = {
  kebersihan: [
    { jenis: 'rekrut', petugas: 'kebersihan' },
    { jenis: 'rekrut', petugas: 'petugasToilet' },
  ],
  keamanan: [{ jenis: 'rekrut', petugas: 'satpam' }],
  kenyamanan: [{ jenis: 'bangun', bangunan: 'kursi' }],
  fasilitas: [
    { jenis: 'bangun', bangunan: 'toilet' },
    { jenis: 'bangun', bangunan: 'kios' },
    { jenis: 'bangun', bangunan: 'toko' },
    { jenis: 'bangun', bangunan: 'lahanParkir' },
  ],
};

/** "Aman" menurut baris tujuan (dokumen 14 bagian 3.2): kas sesudah aksi ≥ cadangan B; rekrut: laba rata-rata dengan kontrak > 0. */
function aman(sesudah: GameState, gaji: boolean, cfg: KonfigEkonomi): boolean {
  if (sesudah.kas < cadanganKas(sesudah, cfg, 1)) return false;
  return !gaji || labaDenganKontrak(acuanHarian(sesudah, cfg, sesudah.terminal.tarif)) > 0;
}

/** Aksi yang bisa ditunjuk tuas "›" tugas musim (dikirim pemain sendiri lewat tombol di tab tujuannya). */
export type AksiTuas = Extract<Aksi, { readonly jenis: 'bangun' | 'beliTeknologi' | 'rekrut' | 'saranTarif' | 'daftarPo' }>;

/** Terapkan aksi tuas (sama dengan terapkanAksi untuk jenis ini, tanpa menilai tugas kelola). */
function terapkanTuas(state: GameState, a: AksiTuas, cfg: KonfigEkonomi): GameState {
  switch (a.jenis) {
    case 'bangun':
      return bangun(state, a.bangunan, a.po ?? null, cfg);
    case 'beliTeknologi':
      return beliTeknologi(state, a.teknologi, cfg);
    case 'rekrut':
      return rekrutPetugas(state, a.petugas);
    case 'saranTarif':
      return aturTarif(state, a.tarif, saranTersimpan(state, a.tarif, cfg), cfg);
    case 'daftarPo':
      return daftarPo(state, a.po, cfg);
  }
}

/** Aman menurut aturan baris tujuan; saran tarif tidak mengeluarkan uang, jadi selalu aman. */
const amanTuas = (sesudah: GameState, a: AksiTuas, cfg: KonfigEkonomi): boolean => a.jenis === 'saranTarif' || aman(sesudah, a.jenis === 'rekrut', cfg);

/**
 * Unit atau modernisasi termurah yang lolos cadangan B (tugas `bangun` dan tuasnya), atau null.
 * Seri: urutan tab Bangun (bangunan lalu modernisasi).
 */
export function bangunanAman(state: GameState, cfg: KonfigEkonomi = EKONOMI): Extract<AksiTuas, { readonly jenis: 'bangun' | 'beliTeknologi' }> | null {
  const calon: { readonly aksi: Extract<AksiTuas, { readonly jenis: 'bangun' | 'beliTeknologi' }>; readonly biaya: number }[] = [];
  for (const id of BANGUNAN_IDS) {
    const biaya = biayaBangunState(state, id, cfg);
    if (biaya !== null && biaya <= state.kas) calon.push({ aksi: { jenis: 'bangun', bangunan: id }, biaya });
  }
  for (const id of TEKNOLOGI_IDS) if (bisaBeliTeknologi(state, id, cfg) && syaratTeknologi(state, id, cfg)) calon.push({ aksi: { jenis: 'beliTeknologi', teknologi: id }, biaya: cfg.teknologi[id].biaya });
  for (const c of calon.sort((a, b) => a.biaya - b.biaya)) {
    const b = terapkanTuas(state, c.aksi, cfg);
    if (b !== state && aman(b, false, cfg)) return c.aksi;
  }
  return null;
}

/** Ada unit/modernisasi yang lolos cadangan B (tugas `bangun`). */
export function adaBangunAman(state: GameState, cfg: KonfigEkonomi = EKONOMI): boolean {
  return bangunanAman(state, cfg) !== null;
}

/** Aksi aman yang paling menaikkan komponen ini (lebih dari perbaikanNaikMin) dan nilainya sesudah aksi itu. */
function aksiKomponen(state: GameState, c: KomponenPerbaikan, cfg: KonfigEkonomi, cm: KonfigMusim): { readonly aksi: AksiTuas; readonly nilai: number } | null {
  const v = operasiState(state, cfg).kepuasan[c];
  let terbaik: { readonly aksi: AksiTuas; readonly nilai: number } | null = null;
  for (const a of AKSI_KOMPONEN[c]) {
    const b = terapkanTuas(state, a, cfg);
    if (b === state || !amanTuas(b, a, cfg)) continue;
    const nilai = operasiState(b, cfg).kepuasan[c];
    if (nilai > v + cm.tugas.perbaikanNaikMin && (!terbaik || nilai > terbaik.nilai)) terbaik = { aksi: a, nilai };
  }
  return terbaik;
}

/**
 * Komponen terlemah (< perbaikanMaks) yang naik dengan satu aksi aman; target = nilainya sesudah aksi terbaik,
 * dibulatkan ke bawah; `aksi` = aksi terbaik itu (yang ditunjuk tuas, mis. petugas toilet untuk kebersihan).
 */
export function perbaikanTerlemah(
  state: GameState,
  cfg: KonfigEkonomi = EKONOMI,
  cm: KonfigMusim = MUSIM,
): { readonly komponen: KomponenPerbaikan; readonly target: number; readonly aksi: AksiTuas } | null {
  const k = operasiState(state, cfg).kepuasan;
  const urut = [...KOMPONEN_PERBAIKAN].sort((a, b) => k[a] - k[b]);
  for (const c of urut) {
    const v = k[c];
    if (v >= cm.tugas.perbaikanMaks) continue;
    const a = aksiKomponen(state, c, cfg, cm);
    if (!a) continue;
    const target = turunKe(a.nilai, cm.tugas.kepuasanLangkah);
    if (target > v + 1e-9) return { komponen: c, target, aksi: a.aksi };
  }
  return null;
}

/** Target & param satu templat untuk terminal ini sekarang, atau null bila tidak layak. */
function buatSatu(state: GameState, templat: TemplatTugas, hari: string, laju: () => LajuHarian, cfg: KonfigEkonomi, cm: KonfigMusim): { readonly target: number; readonly param: TugasAktif['param'] } | null {
  const t = cm.tugas;
  const sorotan = t.durasiJam * t.naikSorotan;
  switch (templat) {
    case 'penumpang':
      return { target: bulatkanTarget(Math.max(10, laju().arus) * t.durasiJam), param: null };
    case 'laba':
      // Hanya bila terminal berlaba dengan tarif pemain (P-9): saat rugi kemajuannya terkunci di Rp 0.
      if (!(labaDenganKontrak(acuanHarian(state, cfg, state.terminal.tarif)) > 0)) return null;
      return { target: bulatkanTarget(Math.max(labaDenganKontrak(acuanHarian(state, cfg)), cfg.hadiah.minPerMenit) * t.durasiJam), param: null };
    case 'kota': {
      const j = kotaDari(laju(), hari, cfg, cm);
      return j === null ? null : { target: bulatkanTarget(Math.max(10, laju().kota.get(j) ?? 0) * sorotan), param: j };
    }
    case 'antarpulau':
      return laju().antarpulau > t.arusMin ? { target: bulatkanTarget(laju().antarpulau * sorotan), param: null } : null;
    case 'kelasTinggi':
      return laju().kelasTinggi > t.arusMin ? { target: bulatkanTarget(laju().kelasTinggi * sorotan), param: null } : null;
    case 'poTerendah': {
      if (state.mitra.terdaftar.length < 2) return null;
      const po = poArmada(state, cfg);
      const a = po ? (laju().po.get(po) ?? 0) : 0;
      return po && a > t.arusMin ? { target: bulatkanTarget(a * sorotan), param: po } : null;
    }
    case 'kios': {
      const b = state.terminal.bangunan;
      return b.kios + b.toko > 0 && laju().sewaKios > 0 ? { target: bulatkanTarget(laju().sewaKios * sorotan), param: null } : null;
    }
    case 'parkir':
      return state.terminal.bangunan.lahanParkir > 0 && laju().parkir > 0 ? { target: bulatkanTarget(laju().parkir * sorotan), param: null } : null;
    case 'kepuasan': {
      // Di bawah kepuasanMin ambang dijepit ke atas kepuasan sekarang: tugas itu mustahil sejak lahir (P-1).
      const k = operasiState(state, cfg).kepuasan.nilai;
      if (persenHud(k) < persenHud(t.kepuasanMin)) return null;
      const ambang = Math.min(t.kepuasanMaks, Math.max(t.kepuasanMin, turunKe(k, t.kepuasanLangkah)));
      return { target: t.durasiJam * WAKTU.detikPerJam, param: ambang };
    }
    case 'perbaikan': {
      const p = perbaikanTerlemah(state, cfg, cm);
      return p ? { target: p.target, param: p.komponen } : null;
    }
    case 'bangun':
      return adaBangunAman(state, cfg) ? { target: 1, param: null } : null;
    case 'daftarPo':
      return poBisaDaftar(state, cfg) !== null ? { target: 1, param: null } : null;
  }
}

/** Laju dihitung sekali, hanya bila ada templat yang membutuhkannya. */
function lajuMalas(state: GameState, cfg: KonfigEkonomi, cm: KonfigMusim): () => LajuHarian {
  let laju: LajuHarian | null = null;
  return () => (laju ??= lajuHarian(state, cfg, cm));
}

/**
 * Tugas satu hari WIB: satu templat layak pertama dari tiap kelompok (main, sorotan, kelola) menurut urutan
 * undian `tugas-<hari>`; kelompok kelola tanpa templat layak diganti sorotan kedua. Target dari keadaan
 * terminal sekarang. `kecuali` (templat kemarin yang masih terbuka) dihindari bila masih cukup templat.
 */
export function buatTugasHari(state: GameState, hari: string, kecuali: ReadonlySet<TemplatTugas>, cfg: KonfigEkonomi = EKONOMI, cm: KonfigMusim = MUSIM): TugasAktif[] {
  const laju = lajuMalas(state, cfg, cm);
  const urut = acak(TEMPLAT_TUGAS, `tugas-${hari}`);
  const pilih: TugasAktif[] = [];
  const kelompok = new Set<KelompokTugas>();
  const isi = (boleh: (t: TemplatTugas) => boolean, hindari: ReadonlySet<TemplatTugas>): void => {
    for (const t of urut) {
      if (pilih.length >= cm.tugas.perHari) return;
      if (hindari.has(t) || pilih.some((x) => x.templat === t) || !boleh(t)) continue;
      const b = buatSatu(state, t, hari, laju, cfg, cm);
      if (!b) continue;
      kelompok.add(KELOMPOK_TUGAS[t]);
      pilih.push({ hari, templat: t, target: b.target, progres: 0, param: b.param, selesai: false });
    }
  };
  for (const hindari of [kecuali, new Set<TemplatTugas>()]) {
    isi((t) => !kelompok.has(KELOMPOK_TUGAS[t]), hindari);
    isi((t) => KELOMPOK_TUGAS[t] === 'sorotan', hindari);
    isi(() => true, hindari);
  }
  return pilih;
}

/** Satu tugas templat ini untuk hari itu dari keadaan terminal sekarang, atau null bila tidak layak (tes & alat). */
export function buatTugas(state: GameState, templat: TemplatTugas, hari: string, cfg: KonfigEkonomi = EKONOMI, cm: KonfigMusim = MUSIM): TugasAktif | null {
  const b = buatSatu(state, templat, hari, lajuMalas(state, cfg, cm), cfg, cm);
  return b ? { hari, templat, target: b.target, progres: 0, param: b.param, selesai: false } : null;
}

// ---------------------------------------------------------------------------
// Tuas "›" tugas (playtest Citra P-2, P-3, P-5, P-6)

/**
 * Tuas satu tugas: aksi yang, bila dikerjakan pemain, memajukan tugas itu (dan lolos aturan aman baris tujuan),
 * atau penunjuk informasi yang sudah ada di rancangan: laporan keuangan (laba) dan popup kepuasan. Null = tanpa tuas
 * (tugas penumpang, tugas selesai, atau tidak ada aksi yang membantu, mis. jalur sudah penuh).
 */
export type TuasTugas = { readonly jenis: 'aksi'; readonly aksi: AksiTuas } | { readonly jenis: 'keuangan' } | { readonly jenis: 'kepuasan' };

/**
 * Laju sumber tugas di jam paling ramai (tarif pemain, pengali event): penumpang per jam terminal untuk tugas arus,
 * Rp per jam untuk kios & parkir. Jam sibuk karena di sanalah kapasitas membatasi; aksi yang tidak menaikkannya di
 * jam sibuk tidak menaikkannya sepanjang hari.
 */
function lajuPuncak(state: GameState, t: TugasAktif, cfg: KonfigEkonomi, cm: KonfigMusim): number {
  const k = keadaanOperasi(state, cfg);
  const op = hitungOperasi(k, { ritme: ritmeDari(1, cfg), event: pengaliEvent(state, cfg) }, cfg);
  const arus = (pilih: (g: HasilOperasi['segmen'][number]) => boolean): number => op.segmen.reduce((a, g) => (pilih(g) ? a + g.arus : a), 0);
  switch (t.templat) {
    case 'kota':
      return arus((g) => g.jurusan === t.param);
    case 'antarpulau':
      return arus((g) => cfg.jurusan[g.jurusan]?.feri !== undefined);
    case 'kelasTinggi':
      return arus((g) => cm.kelasTinggi.includes(g.kelas));
    case 'poTerendah':
      return op.po.find((p) => p.id === t.param)?.arus ?? 0;
    case 'kios':
      return keuanganPerJam(k, op, false, cfg).pendapatan.sewaKios;
    case 'parkir':
      return keuanganPerJam(k, op, false, cfg).pendapatan.parkir;
    default:
      return 0;
  }
}

/** Calon aksi tugas sorotan: semua bangunan, modernisasi, rekrut; saran tarif tugas kios/parkir; PO baru untuk tugas arus jurusan. */
function calonPercepat(state: GameState, t: TugasAktif, cfg: KonfigEkonomi): AksiTuas[] {
  const calon: AksiTuas[] = [
    ...BANGUNAN_IDS.map((bangunan): AksiTuas => ({ jenis: 'bangun', bangunan })),
    ...TEKNOLOGI_IDS.map((teknologi): AksiTuas => ({ jenis: 'beliTeknologi', teknologi })),
    ...PETUGAS_IDS.map((petugas): AksiTuas => ({ jenis: 'rekrut', petugas })),
  ];
  if (t.templat === 'kios') calon.push({ jenis: 'saranTarif', tarif: 'sewaKios' });
  if (t.templat === 'parkir') calon.push({ jenis: 'saranTarif', tarif: 'parkir' });
  if (t.templat === 'kota' || t.templat === 'antarpulau' || t.templat === 'kelasTinggi') for (const po of PO_IDS) if (bisaDaftarPo(state, po, cfg)) calon.push({ jenis: 'daftarPo', po });
  return calon;
}

/** Laju sumber tugas sorotan rata-rata sehari (24 jam terminal, tarif pemain): yang benar-benar memajukan tugas. */
function lajuSehari(state: GameState, t: TugasAktif, cfg: KonfigEkonomi, cm: KonfigMusim): number {
  const l = lajuHarian(state, cfg, cm, state.terminal.tarif);
  switch (t.templat) {
    case 'kota':
      return typeof t.param === 'number' ? (l.kota.get(t.param) ?? 0) : 0;
    case 'antarpulau':
      return l.antarpulau;
    case 'kelasTinggi':
      return l.kelasTinggi;
    case 'poTerendah':
      return isPoId(t.param) ? (l.po.get(t.param) ?? 0) : 0;
    case 'kios':
      return l.sewaKios;
    case 'parkir':
      return l.parkir;
    default:
      return 0;
  }
}

/** Kas khayalan untuk mencoba aksi tanpa memeriksa kas (urutan tuas tidak bergantung pada kas; "aman" dinilai sesudahnya). */
const KAS_KAYA = 1e15;

/**
 * Aksi yang menaikkan laju sumber tugas sorotan ini, terbaik dulu. Disaring dua tahap: naik di jam sibuk (murah),
 * lalu naik rata-rata sehari lebih dari perbaikanNaikMin (bagian), supaya tuas tidak menunjuk aksi yang hampir tidak
 * terasa (mis. modernisasi ×1,006) atau yang di jam lain malah menurunkannya. Seri: urutan calon.
 */
function urutPercepat(state: GameState, t: TugasAktif, cfg: KonfigEkonomi, cm: KonfigMusim): AksiTuas[] {
  const kaya: GameState = { ...state, kas: KAS_KAYA };
  const puncak = lajuPuncak(kaya, t, cfg, cm);
  const calon: { readonly aksi: AksiTuas; readonly sesudah: GameState }[] = [];
  for (const a of calonPercepat(kaya, t, cfg)) {
    const b = terapkanTuas(kaya, a, cfg);
    if (b !== kaya && lajuPuncak(b, t, cfg, cm) > puncak * (1 + 1e-9) + 1e-9) calon.push({ aksi: a, sesudah: b });
  }
  if (calon.length === 0) return [];
  const dasar = lajuSehari(kaya, t, cfg, cm);
  return calon
    .map((c) => ({ aksi: c.aksi, laju: lajuSehari(c.sesudah, t, cfg, cm) }))
    .filter((c) => c.laju > dasar * (1 + cm.tugas.perbaikanNaikMin) + 1e-9)
    .sort((x, y) => y.laju - x.laju)
    .map((c) => c.aksi);
}

/**
 * Saran tarif mahal dihitung (semua langkah tarif × rata-rata sehari), jadi nilainya disimpan per susunan terminal
 * (objek `terminal` berganti saat membangun, merekrut, atau mengubah tarif) dan PO. Hanya untuk menilai tuas;
 * tombol saran di tab Terminal menghitungnya sendiri saat diketuk.
 */
const simpananSaran = new WeakMap<object, Map<string, number>>();

function saranTersimpan(state: GameState, tarif: TarifId, cfg: KonfigEkonomi): number {
  if (cfg !== EKONOMI) return saranTarif(state, tarif, cfg);
  let peta = simpananSaran.get(state.terminal);
  if (!peta) {
    peta = new Map();
    simpananSaran.set(state.terminal, peta);
  }
  const kunci = `${tarif}|${levelTerminal(state, cfg)}|${state.perkembangan.perluasan}|${state.mitra.terdaftar.map((p) => `${p.id}:${levelPo(p, cfg)}:${p.loket}`).join(',')}`;
  let nilai = peta.get(kunci);
  if (nilai === undefined) {
    if (peta.size >= 8) peta.clear();
    nilai = saranTarif(state, tarif, cfg);
    peta.set(kunci, nilai);
  }
  return nilai;
}

/** PO pertama (urutan tab PO) yang bisa didaftarkan, atau null. */
function poBisaDaftar(state: GameState, cfg: KonfigEkonomi): PoId | null {
  return [...PO_IDS].sort((a, b) => urutanPo(a, cfg) - urutanPo(b, cfg)).find((id) => bisaDaftarPo(state, id, cfg)) ?? null;
}

/**
 * Aksi yang memajukan tugas ini, terbaik dulu, TANPA menilai kas (lihat tuasTugas): sorotan = yang paling menaikkan
 * lajunya; perbaikan = yang paling menaikkan komponennya melewati kemajuan sekarang; bangun = unit/modernisasi
 * termurah dulu; daftarPo = PO urutan tab PO. Kosong untuk tugas tanpa aksi (penumpang, laba, kepuasan).
 * Mahal (mencoba aksi), tapi hanya bergantung pada susunan terminal, jadi tampilan menyimpannya per susunan.
 */
export function peringkatTuas(state: GameState, t: TugasAktif, cfg: KonfigEkonomi = EKONOMI, cm: KonfigMusim = MUSIM): readonly AksiTuas[] {
  if (t.selesai) return [];
  switch (t.templat) {
    case 'penumpang':
    case 'laba':
    case 'kepuasan':
      return [];
    case 'kota':
    case 'antarpulau':
    case 'kelasTinggi':
    case 'poTerendah':
    case 'kios':
    case 'parkir':
      return urutPercepat(state, t, cfg, cm);
    case 'perbaikan': {
      const c = t.param;
      if (!isKomponen(c)) return [];
      const kaya: GameState = { ...state, kas: KAS_KAYA };
      const batas = Math.max(t.progres, operasiState(state, cfg).kepuasan[c] + cm.tugas.perbaikanNaikMin);
      return AKSI_KOMPONEN[c]
        .map((a) => ({ aksi: a, sesudah: terapkanTuas(kaya, a, cfg) }))
        .filter((x) => x.sesudah !== kaya)
        .map((x) => ({ aksi: x.aksi, nilai: operasiState(x.sesudah, cfg).kepuasan[c] }))
        .filter((x) => x.nilai > batas + 1e-9)
        .sort((x, y) => y.nilai - x.nilai)
        .map((x): AksiTuas => x.aksi);
    }
    case 'bangun': {
      const calon: { readonly aksi: AksiTuas; readonly biaya: number }[] = [];
      for (const id of BANGUNAN_IDS) {
        const biaya = biayaBangunState(state, id, cfg);
        if (biaya !== null) calon.push({ aksi: { jenis: 'bangun', bangunan: id }, biaya });
      }
      for (const id of TEKNOLOGI_IDS) if (syaratTeknologi(state, id, cfg)) calon.push({ aksi: { jenis: 'beliTeknologi', teknologi: id }, biaya: cfg.teknologi[id].biaya });
      return calon.sort((a, b) => a.biaya - b.biaya).map((c) => c.aksi);
    }
    case 'daftarPo':
      return [...PO_IDS].sort((a, b) => urutanPo(a, cfg) - urutanPo(b, cfg)).map((po): AksiTuas => ({ jenis: 'daftarPo', po }));
  }
}

/**
 * Tuas tugas ini sekarang (lihat TuasTugas): penunjuk informasi untuk laba & kepuasan, atau aksi pertama dari
 * `peringkat` yang berlaku sekarang dan lolos aturan aman baris tujuan (kas sesudahnya ≥ cadangan B; rekrut: laba
 * rata-rata tetap > 0; saran tarif selalu aman). `peringkat` bisa diberikan dari simpanan tampilan.
 */
export function tuasTugas(
  state: GameState,
  t: TugasAktif,
  cfg: KonfigEkonomi = EKONOMI,
  cm: KonfigMusim = MUSIM,
  peringkat: readonly AksiTuas[] = peringkatTuas(state, t, cfg, cm),
): TuasTugas | null {
  if (t.selesai) return null;
  if (t.templat === 'laba') return { jenis: 'keuangan' };
  if (t.templat === 'kepuasan') return { jenis: 'kepuasan' };
  for (const a of peringkat) {
    const b = terapkanTuas(state, a, cfg);
    if (b !== state && amanTuas(b, a, cfg)) return { jenis: 'aksi', aksi: a };
  }
  return null;
}

// ---------------------------------------------------------------------------
// Buka, hari baru, pergantian musim (bagian 3.2, 3.5, 7.2)

/** Musim bisa dibuka sekarang (belum terbuka, Lv cukup, dan Musim 1 sudah dimulai). Syarat tutorial dinilai app. */
export function bisaBukaMusim(state: GameState, ms: number, cfg: KonfigEkonomi = EKONOMI, cm: KonfigMusim = MUSIM): boolean {
  return state.musim.id === null && levelTerminal(state, cfg) >= cm.lvBuka && musimPada(ms, cm) !== null;
}

/** Buka musim yang sedang berlangsung untuk pemain ini, lalu buat tugas hari ini. State sama persis bila belum bisa. */
export function bukaMusim(state: GameState, ms: number, cfg: KonfigEkonomi = EKONOMI, cm: KonfigMusim = MUSIM): GameState {
  if (!bisaBukaMusim(state, ms, cfg, cm)) return state;
  const mu = musimPada(ms, cm)!;
  const m = state.musim;
  const musim: MusimState = {
    ...m,
    id: mu.id,
    poin: 0,
    tugas: [],
    statistik: { tugas: 0, tantangan: 0, lvAwal: levelTerminal(state, cfg), penumpangAwal: state.statistik.totalPenumpang },
  };
  return perbaruiMusim({ ...state, musim }, ms, cfg, cm);
}

/** Id hiasan dari tingkat 1 … `tingkat` musim bertema itu (rapor). */
function hiasanSampai(tingkat: number, tema: TemaMusimId, cm: KonfigMusim): string[] {
  const hasil: string[] = [];
  for (let t = 1; t <= tingkat; t++) for (const h of hadiahTingkat(t, tema, cm)) if (h.jenis === 'hiasan') hasil.push(h.item);
  return hasil;
}

/** Tutup musim lama (rapor sekali bila poin > 0, riwayat) dan mulai musim `id` dengan poin 0; koleksi, pakai, tiket, surat tetap. */
function gantiMusim(state: GameState, id: string, cfg: KonfigEkonomi, cm: KonfigMusim): GameState {
  const m = state.musim;
  const lv = levelTerminal(state, cfg);
  const st = state.statistik;
  let rapor = m.rapor;
  let riwayat = m.riwayat;
  if (m.id !== null && m.poin > 0) {
    const tingkat = tingkatRapor(m.poin, cm);
    rapor = {
      id: m.id,
      tingkat,
      poin: m.poin,
      tugas: m.statistik.tugas,
      tantangan: m.statistik.tantangan,
      lvAwal: m.statistik.lvAwal,
      lvAkhir: lv,
      penumpang: Math.max(0, Math.round(st.totalPenumpang - m.statistik.penumpangAwal)),
      hiasan: hiasanSampai(tingkat, temaDari(m, cm), cm),
    };
    riwayat = [...riwayat, { id: m.id, tingkat }];
  }
  return { ...state, musim: { ...m, id, poin: 0, tugas: [], rapor, riwayat, statistik: { tugas: 0, tantangan: 0, lvAwal: lv, penumpangAwal: st.totalPenumpang } } };
}

/**
 * Sesuaikan musim yang sudah terbuka dengan jam nyata (dipanggil perbaruiJamNyata, sesudah tantangan):
 * musim berganti (rapor), lalu hari baru: tugas kemarin yang belum selesai tetap sampai akhir hari ini,
 * set kemarin dibuat bila pemain absen kemarin (dalam musim yang sama), lalu set hari ini. Kunci hari &
 * musim hanya maju. State sama persis bila tidak ada yang berubah.
 */
export function perbaruiMusim(state: GameState, ms: number, cfg: KonfigEkonomi = EKONOMI, cm: KonfigMusim = MUSIM): GameState {
  const m0 = state.musim;
  if (m0.id === null) return state;
  const mu = musimPada(ms, cm);
  if (!mu || mu.id < m0.id) return state;
  let s = mu.id > m0.id ? gantiMusim(state, mu.id, cfg, cm) : state;
  const m = s.musim;
  const hari = kunciHariWib(ms);
  if (m.hariTugas !== null && hari <= m.hariTugas) return s;
  const berlaku = Math.max(1, cm.tugas.berlakuHari);
  const awalBerlaku = geserHari(hari, -(berlaku - 1));
  const awalMusim = kunciHariWib(mu.mulaiMs);
  let tugas = m.tugas.filter((t) => t.hari >= awalBerlaku && t.hari < hari && !t.selesai);
  // Susulan: hari dalam masa berlaku yang dilewati pemain (sesudah hari tugas terakhir, dalam musim ini).
  if (m.hariTugas !== null) {
    for (let i = berlaku - 1; i >= 1; i--) {
      const h = geserHari(hari, -i);
      if (h > m.hariTugas && h >= awalMusim) tugas = [...tugas, ...buatTugasHari(s, h, new Set(), cfg, cm)];
    }
  }
  const kecuali = new Set(tugas.map((t) => t.templat));
  tugas = [...tugas, ...buatTugasHari(s, hari, kecuali, cfg, cm)].slice(-cm.tugas.maksTerbuka);
  s = { ...s, musim: { ...m, tugas, hariTugas: hari } };
  return s;
}

// ---------------------------------------------------------------------------
// Aksi musim (aksi.ts). Tidak satu pun mengubah kas.

/** Cara ganti yang bisa dipakai untuk tugas ke-`indeks` sekarang (gratis lebih dulu), null = tidak bisa. */
export function caraGanti(m: MusimState, indeks: number, cm: KonfigMusim = MUSIM): 'gratis' | 'tiket' | null {
  const t = m.tugas[indeks];
  if (m.id === null || !t || t.selesai) return null;
  if (cm.tugas.gantiGratisPerHari > 0 && m.gantiHari !== m.hariTugas) return 'gratis';
  return m.tiketGanti > 0 ? 'tiket' : null;
}

/**
 * Ganti tugas yang belum selesai: gratis sekali per hari, lalu dengan tiket. Pengganti dari undian
 * `tugas-<hari>-ganti`, kelompok yang sama lebih dulu (lalu sorotan, main, kelola supaya tidak ada jalan
 * buntu), bukan templat yang sudah ada di daftar. Tetap berlaku sampai hari tugas lamanya berakhir.
 */
export function gantiTugas(state: GameState, indeks: number, cara: 'gratis' | 'tiket', cfg: KonfigEkonomi = EKONOMI, cm: KonfigMusim = MUSIM): GameState {
  const m = state.musim;
  const lama = m.tugas[indeks];
  if (!lama || lama.selesai || m.id === null) return state;
  if (cara === 'gratis' ? !(cm.tugas.gantiGratisPerHari > 0 && m.gantiHari !== m.hariTugas) : m.tiketGanti < 1) return state;
  const ada = new Set(m.tugas.map((t) => t.templat));
  const laju = lajuMalas(state, cfg, cm);
  const urut = acak(TEMPLAT_TUGAS, `tugas-${lama.hari}-ganti`);
  const kelompok = [...new Set<KelompokTugas>([KELOMPOK_TUGAS[lama.templat], 'sorotan', 'main', 'kelola'])];
  for (const k of kelompok) {
    for (const t of urut) {
      if (KELOMPOK_TUGAS[t] !== k || ada.has(t)) continue;
      const b = buatSatu(state, t, lama.hari, laju, cfg, cm);
      if (!b) continue;
      const tugas = m.tugas.map((x, i) => (i === indeks ? { hari: lama.hari, templat: t, target: b.target, progres: 0, param: b.param, selesai: false } : x));
      const pakaiTiket = cara === 'tiket';
      return { ...state, musim: { ...m, tugas, gantiHari: pakaiTiket ? m.gantiHari : m.hariTugas, tiketGanti: m.tiketGanti - (pakaiTiket ? 1 : 0) } };
    }
  }
  return state;
}

/** Pakai hiasan yang dimiliki di slotnya, atau lepas (null). */
export function pakaiHiasan(state: GameState, slot: SlotHiasan, item: string | null, cm: KonfigMusim = MUSIM): GameState {
  const m = state.musim;
  if (!(SLOT_HIASAN as readonly string[]).includes(slot)) return state;
  if (item !== null && (!m.koleksi.includes(item) || slotHiasan(item, cm) !== slot)) return state;
  if (m.pakai[slot] === item) return state;
  return { ...state, musim: { ...m, pakai: { ...m.pakai, [slot]: item } } };
}

/** XP Surat Armada untuk PO ini sekarang: suratBagian × kebutuhan level berikutnya (rumus armada berikanPaket). */
export function xpSuratArmada(xp: number, cfg: KonfigEkonomi = EKONOMI, cm: KonfigMusim = MUSIM): number {
  return cm.suratBagian * xpLevelPo(levelPoDariXp(xp, cfg), cfg);
}

/** Surat Armada: PO terdaftar pilihan pemain mendapat armada +suratBagian level. */
export function pakaiSuratArmada(state: GameState, po: PoId, cfg: KonfigEkonomi = EKONOMI, cm: KonfigMusim = MUSIM): GameState {
  const m = state.musim;
  if (m.suratArmada < 1 || !state.mitra.terdaftar.some((p) => p.id === po)) return state;
  const terdaftar = state.mitra.terdaftar.map((p) => (p.id === po ? { ...p, xp: p.xp + xpSuratArmada(p.xp, cfg, cm) } : p));
  return { ...state, mitra: { ...state.mitra, terdaftar }, musim: { ...m, suratArmada: m.suratArmada - 1 } };
}

export function tutupRapor(state: GameState): GameState {
  return state.musim.rapor === null ? state : { ...state, musim: { ...state.musim, rapor: null } };
}

export function tutupSambutanMusim(state: GameState): GameState {
  return state.musim.sambutan ? state : { ...state, musim: { ...state.musim, sambutan: true } };
}

// ---------------------------------------------------------------------------
// Dibaca adegan

/** Hiasan yang dipakai tiap slot (null = tampilan bawaan). Dibaca adegan; tidak pernah mengirim aksi. */
export function hiasanAktif(state: GameState): Record<SlotHiasan, string | null> {
  return state.musim.pakai;
}
