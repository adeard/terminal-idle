/**
 * Simulasi tycoon untuk tes tempo & kalibrasi (bukan tes): terminal
 * disederhanakan di atas modul murni tycoon (operasi, keuangan, bangunan,
 * petugas, tarif) dengan pemain "serakah" yang tiap jam terminal membeli aksi
 * yang paling cepat balik modal. PO membayar kontrak di muka saat bergabung &
 * tiap perpanjangan (pemain menerima tawaran begitu muncul, selama kepuasan
 * mitra cukup); tarif tetap bawaan. Lihat documents/13-rancangan-tycoon.md bagian 14.
 */
import { EKONOMI, type KonfigEkonomi } from '../src/config/economy.config';
import { bangunanAwal, biayaBangun, slotBangunan } from '../src/sim/bangunan';
import { BANGUNAN_IDS, PETUGAS_IDS, PO_IDS, TEKNOLOGI_IDS, type BangunanId, type PetugasId, type PoId, type TeknologiId } from '../src/sim/fitur';
import { keuanganPerJam, majukanKas } from '../src/sim/keuangan';
import { kelasDariLevel, levelTerminalDariXp, slotPo } from '../src/sim/level-terminal';
import { kelasAktif, levelPoDariXp, majukanReputasi, syaratDaftarKurang, targetReputasi, tawaranKontrak, tingkatPo } from '../src/sim/mitra';
import { hitungOperasi, type HasilOperasi, type KeadaanOperasi } from '../src/sim/operasi';
import { berhentiKasHabis, bisaRekrut, rekrut } from '../src/sim/petugas';
import { tarifBawaan, type NilaiTarif } from '../src/sim/tarif';
import { keramaianTerminal, waktuTerminal } from '../src/sim/waktu';

export interface PoSim {
  readonly id: PoId;
  xp: number;
  loket: number;
  reputasi: number;
  /** Kontrak berjalan: sisa (detik main), panjang (hari), nilai yang dibayar di muka, & kontrak ke-berapa. */
  kontrak: number;
  hari: number;
  nilai: number;
  ke: number;
}

export interface SimTycoon {
  detik: number;
  kas: number;
  bangunan: Record<BangunanId, number>;
  petugas: PetugasId[];
  tarif: NilaiTarif;
  teknologi: Record<TeknologiId, boolean>;
  po: PoSim[];
  xpTerminal: number;
  perluasan: number;
  proyekDetik: number;
  tunggakan: number;
  /** Petugas yang berhenti karena kas habis (strategi wajar: tetap nol). */
  berhenti: number;
  /** Nilai kontrak PO yang sudah diterima (Rp, kumulatif). */
  kontrakDiterima: number;
}

export type AksiSim =
  | { readonly jenis: 'jendela'; readonly po: number }
  | { readonly jenis: 'bangun'; readonly id: BangunanId }
  | { readonly jenis: 'rekrut'; readonly id: PetugasId }
  | { readonly jenis: 'teknologi'; readonly id: TeknologiId }
  | { readonly jenis: 'po'; readonly id: PoId }
  | { readonly jenis: 'perluasan' };

export interface Catatan {
  readonly detik: number;
  readonly aksi: string;
  readonly biaya: number;
}

export function buatSim(cfg: KonfigEkonomi = EKONOMI): SimTycoon {
  return {
    detik: 0,
    kas: cfg.tycoon.modalAwal,
    bangunan: { ...bangunanAwal(cfg) },
    petugas: [],
    tarif: tarifBawaan(cfg),
    teknologi: Object.fromEntries(TEKNOLOGI_IDS.map((id) => [id, false])) as Record<TeknologiId, boolean>,
    po: [poBaru('ondelOndel', 1, { ...tawaranKontrak('ondelOndel', 0, 1, 0, cfg), nilai: 0 }, cfg)],
    xpTerminal: 0,
    perluasan: 0,
    proyekDetik: 0,
    tunggakan: 0,
    berhenti: 0,
    kontrakDiterima: 0,
  };
}

const DETIK_HARI = 1440;
/** Bobot nilai jangka panjang penumpang dibanding nilai kontrak sekarang per penumpang (lihat nilaiAksi). */
const NILAI_PERTUMBUHAN = 2.5;

function poBaru(id: PoId, loket: number, t: { readonly hari: number; readonly nilai: number }, cfg: KonfigEkonomi): PoSim {
  return { id, xp: 0, loket, reputasi: tingkatPo(id, cfg).reputasiAwal, kontrak: t.hari * DETIK_HARI, hari: t.hari, nilai: t.nilai, ke: 1 };
}

export const levelTerminalSim = (s: SimTycoon, cfg: KonfigEkonomi = EKONOMI): number => levelTerminalDariXp(s.xpTerminal, cfg);
export const levelPoSim = (p: PoSim, cfg: KonfigEkonomi = EKONOMI): number => levelPoDariXp(p.xp, cfg);

export function keadaan(s: SimTycoon, cfg: KonfigEkonomi = EKONOMI): KeadaanOperasi {
  return {
    bangunan: s.bangunan,
    petugas: s.petugas,
    tarif: s.tarif,
    teknologi: s.teknologi,
    po: s.po.map((p) => ({ id: p.id, level: levelPoSim(p, cfg), loket: p.loket, reputasi: p.reputasi })),
    kelasTerminal: kelasDariLevel(levelTerminalSim(s, cfg), cfg),
    perluasan: s.perluasan,
  };
}

/** Ritme permintaan (sudah dilandaikan seperti permintaan 0.2.0) pada detik main ini. */
export function ritmePada(detik: number, cfg: KonfigEkonomi = EKONOMI): number {
  const r = cfg.tycoon.pasar.ritmeMin;
  return r + (1 - r) * keramaianTerminal(waktuTerminal(detik));
}

const malamPada = (detik: number): boolean => {
  const jam = waktuTerminal(detik).jamDesimal;
  return jam < 6 || jam >= 18;
};

/** Nilai kontrak PO yang berjalan, dirata-rata per jam terminal (dibayar di muka). */
export function kontrakRata(s: SimTycoon): number {
  return s.po.reduce((a, p) => a + (p.hari > 0 ? p.nilai / p.hari : 0), 0) / 24;
}

/** Laba rata-rata per jam terminal sepanjang hari (jam sibuk 8 jam & jam sepi 16 jam), termasuk kontrak PO yang dirata-rata. */
export function labaRata(s: SimTycoon, cfg: KonfigEkonomi = EKONOMI): number {
  return labaArus(s, cfg) + kontrakRata(s);
}

/** Jam sibuk (8 jam), jam biasa (10 jam), & malam (6 jam): profil hari untuk rata-rata. */
const PROFIL: readonly (readonly [number, number, boolean])[] = [
  [1, 8, false],
  [0.6, 10, false],
  [0.45, 6, true],
];

/** Laba operasi rata-rata per jam terminal (tanpa kontrak PO). */
export function labaArus(s: SimTycoon, cfg: KonfigEkonomi = EKONOMI): number {
  const k = keadaan(s, cfg);
  let total = 0;
  for (const [ritme, jam, malam] of PROFIL) total += keuanganPerJam(k, hitungOperasi(k, { ritme, event: 1 }, cfg), malam, cfg).laba * jam;
  return total / 24;
}

/** Penumpang rata-rata per jam terminal. */
export function arusRata(s: SimTycoon, cfg: KonfigEkonomi = EKONOMI): number {
  const k = keadaan(s, cfg);
  let total = 0;
  for (const [ritme, jam] of PROFIL) total += hitungOperasi(k, { ritme, event: 1 }, cfg).arus * jam;
  return total / 24;
}

const salinSim = (s: SimTycoon): SimTycoon => ({
  ...s,
  bangunan: { ...s.bangunan },
  petugas: [...s.petugas],
  teknologi: { ...s.teknologi },
  po: s.po.map((p) => ({ ...p })),
});

/** Biaya aksi (Rp), atau null bila tidak bisa dilakukan sekarang (tanpa memeriksa kas). */
export function biayaAksi(s: SimTycoon, a: AksiSim, cfg: KonfigEkonomi = EKONOMI): number | null {
  switch (a.jenis) {
    case 'jendela':
      return biayaBangun('jendela', s.bangunan, s.perluasan, cfg);
    case 'bangun':
      return biayaBangun(a.id, s.bangunan, s.perluasan, cfg);
    case 'rekrut':
      return bisaRekrut(a.id, s.petugas, s.bangunan) ? 0 : null;
    case 'teknologi': {
      if (s.teknologi[a.id]) return null;
      const syarat = cfg.teknologi[a.id].syarat;
      return syarat && !s.teknologi[syarat] ? null : cfg.teknologi[a.id].biaya;
    }
    case 'po': {
      const level = levelTerminalSim(s, cfg);
      if (s.po.some((p) => p.id === a.id) || s.po.length >= slotPo(level, s.perluasan, cfg)) return null;
      const src = cfg.mitra.po[a.id].sumber;
      if (src === 'hadiahEvent' || src === 'awal') return null;
      const op = hitungOperasi(keadaan(s, cfg), { ritme: 1, event: 1 }, cfg);
      if (syaratDaftarKurang(a.id, { kelasTerminal: kelasDariLevel(level, cfg), kepuasan: op.kepuasan.nilai }, cfg)) return null;
      // PO butuh jendela: dibangun PO sendiri di slot kosong. Bergabung gratis: PO yang membayar kontrak.
      if (s.bangunan.jendela >= slotBangunan('jendela', s.perluasan, cfg)) return null;
      return 0;
    }
    case 'perluasan': {
      const tahap = cfg.mitra.perluasan[s.perluasan];
      if (!tahap || s.proyekDetik > 0 || levelTerminalSim(s, cfg) < tahap.level) return null;
      return tahap.biaya;
    }
  }
}

/** Keadaan sesudah aksi (tanpa memeriksa kas & syarat; lihat biayaAksi). */
export function terapkanAksi(s: SimTycoon, a: AksiSim, biaya: number, cfg: KonfigEkonomi = EKONOMI): SimTycoon {
  const x = salinSim(s);
  x.kas -= biaya;
  switch (a.jenis) {
    case 'jendela':
      x.bangunan.jendela++;
      x.po[a.po]!.loket++;
      break;
    case 'bangun':
      x.bangunan[a.id]++;
      break;
    case 'rekrut':
      x.petugas = rekrut(x.petugas, a.id);
      break;
    case 'teknologi':
      x.teknologi[a.id] = true;
      break;
    case 'po': {
      const bebas = slotBangunan('jendela', x.perluasan, cfg) - x.bangunan.jendela;
      const loket = Math.max(1, Math.min(tingkatPo(a.id, cfg).loketBawaan, bebas));
      x.bangunan.jendela += loket;
      const t = tawaranKontrak(a.id, 0, 1, kelasDariLevel(levelTerminalSim(x, cfg), cfg), cfg);
      x.po.push(poBaru(a.id, loket, t, cfg));
      x.kas += t.nilai;
      x.kontrakDiterima += t.nilai;
      break;
    }
    case 'perluasan':
      x.proyekDetik = cfg.mitra.detikProyek;
      break;
  }
  return x;
}

/** Semua aksi yang mungkin dipertimbangkan (jendela hanya untuk PO yang permintaannya melebihi jendelanya). */
function calonAksi(op: HasilOperasi): AksiSim[] {
  const calon: AksiSim[] = [];
  let kurang = -1;
  let kurangMaks = 0;
  op.po.forEach((p, i) => {
    if (p.permintaanPuncak - p.kapasitasLoket > kurangMaks) {
      kurangMaks = p.permintaanPuncak - p.kapasitasLoket;
      kurang = i;
    }
  });
  if (kurang >= 0) calon.push({ jenis: 'jendela', po: kurang });
  for (const id of BANGUNAN_IDS) if (id !== 'jendela') calon.push({ jenis: 'bangun', id });
  for (const id of PETUGAS_IDS) if (id !== 'manajerKemitraan') calon.push({ jenis: 'rekrut', id });
  for (const id of TEKNOLOGI_IDS) calon.push({ jenis: 'teknologi', id });
  for (const id of PO_IDS) calon.push({ jenis: 'po', id });
  return calon;
}

const namaAksi = (a: AksiSim): string => (a.jenis === 'jendela' ? `jendela→${a.po}` : a.jenis === 'perluasan' ? 'perluasan' : `${a.jenis}:${a.id}`);

interface NilaiAksi {
  readonly a: AksiSim;
  readonly biaya: number;
  /** Jam terminal sampai biayanya kembali lewat tambahan laba. */
  readonly balik: number;
  /** Tambahan nilai per jam terminal (laba + nilai jangka panjang penumpang). */
  readonly tambah: number;
}

/** Balik modal tercepat dulu; sama cepatnya (mis. aksi gratis seperti PO baru) → tambahan nilai terbesar. */
const urutanNilai = (p: NilaiAksi, q: NilaiAksi): number => p.balik - q.balik || q.tambah - p.tambah;

/** Aksi yang menambah laba rata-rata, urut balik modal tercepat. */
function nilaiAksi(x: SimTycoon, cfg: KonfigEkonomi): NilaiAksi[] {
  const op = hitungOperasi(keadaan(x, cfg), { ritme: 1, event: 1 }, cfg);
  const sekarang = labaRata(x, cfg);
  const arus = arusRata(x, cfg);
  // Nilai jangka panjang tiap penumpang: penumpang menaikkan level PO & terminal, jadi kontrak
  // berikutnya lebih mahal. Didekati dengan nilai kontrak sekarang per penumpang.
  const nilaiPenumpang = (NILAI_PERTUMBUHAN * kontrakRata(x)) / Math.max(1, arus);
  const nilai: NilaiAksi[] = [];
  for (const a of calonAksi(op)) {
    const biaya = biayaAksi(x, a, cfg);
    if (biaya === null) continue;
    const sesudah = terapkanAksi(x, a, biaya, cfg);
    const tambah = labaRata(sesudah, cfg) - sekarang + nilaiPenumpang * (arusRata(sesudah, cfg) - arus);
    // Rekrut gratis tapi bergaji: hanya bila menambah laba.
    if (!(tambah > 1)) continue;
    nilai.push({ a, biaya, balik: biaya / tambah, tambah });
  }
  return nilai.sort(urutanNilai);
}

/**
 * Perluasan tidak menambah laba langsung; nilainya dari aksi terbaik yang dibuka
 * slot barunya, dihitung seolah proyeknya sudah selesai, ditambah lama proyeknya.
 */
function nilaiPerluasan(x: SimTycoon, cfg: KonfigEkonomi): NilaiAksi | null {
  const a: AksiSim = { jenis: 'perluasan' };
  const biaya = biayaAksi(x, a, cfg);
  if (biaya === null) return null;
  const sesudah = { ...salinSim(x), perluasan: x.perluasan + 1, kas: Number.POSITIVE_INFINITY };
  const lanjut = nilaiAksi(sesudah, cfg)[0];
  if (!lanjut) return null;
  // Aksi gratis (mis. PO baru) balik modalnya 0: pakai tambahan nilainya langsung.
  const tambah = lanjut.tambah;
  return { a, biaya, balik: (biaya + lanjut.biaya) / tambah + cfg.mitra.detikProyek / 60, tambah };
}

/**
 * Pemain serakah: beli aksi dengan balik modal tercepat (biaya ÷ tambahan laba
 * rata-rata per jam) bila kasnya cukup. Bila yang terbaik belum terjangkau,
 * hanya beli aksi lain yang balik modalnya paling lama 2× yang terbaik (selain
 * itu menabung). Perluasan ikut bersaing lewat nilaiPerluasan. Bila operasi
 * merugi (kontrak PO yang menutupnya dibayar sekaligus), ia menyisakan kas
 * untuk kerugian sampai tawaran perpanjangan kontrak berikutnya (paling
 * sedikit sehari: ambang peringatan kas menipis di game).
 */
export function putuskan(s: SimTycoon, catatan: Catatan[], cfg: KonfigEkonomi = EKONOMI): SimTycoon {
  let x = s;
  for (let ulang = 0; ulang < 30; ulang++) {
    const nilai = nilaiAksi(x, cfg);
    const perluasan = nilaiPerluasan(x, cfg);
    if (perluasan) nilai.push(perluasan);
    nilai.sort(urutanNilai);
    const terbaik = nilai[0];
    const hariKeTawaran = Math.max(1, Math.min(...x.po.map((p) => p.kontrak / DETIK_HARI - cfg.mitra.kontrak.hariTawaran)));
    const bebas = x.kas - Math.max(0, -labaArus(x, cfg)) * 24 * hariKeTawaran;
    const pilih = terbaik && terbaik.biaya <= bebas ? terbaik : nilai.find((v) => v.biaya <= bebas && v.balik <= 2 * (terbaik?.balik ?? 0));
    if (!pilih) break;
    x = terapkanAksi(x, pilih.a, pilih.biaya, cfg);
    catatan.push({ detik: x.detik, aksi: namaAksi(pilih.a), biaya: pilih.biaya });
  }
  return x;
}

/** Majukan simulasi `dt` detik main: kas, XP terminal & PO, reputasi, proyek perluasan. */
export function majukan(s: SimTycoon, dt: number, cfg: KonfigEkonomi = EKONOMI): SimTycoon {
  const x = salinSim(s);
  const k = keadaan(x, cfg);
  const op = hitungOperasi(k, { ritme: ritmePada(x.detik, cfg), event: 1 }, cfg);
  const keu = keuanganPerJam(k, op, malamPada(x.detik), cfg);
  const dtJam = dt / 60;
  const kas = majukanKas(x.kas, keu.laba, dtJam, x.tunggakan);
  x.kas = kas.kas;
  x.tunggakan = kas.tunggakanJam;
  for (let i = 0; i < kas.berhenti; i++) x.petugas = berhentiKasHabis(x.petugas);
  x.berhenti += kas.berhenti;
  x.xpTerminal += op.arus * dtJam;
  x.po.forEach((p, i) => {
    p.xp += (op.po[i]!.arus / cfg.tycoon.kapasitas.penumpangPerBus) * dtJam;
    const level = levelPoSim(p, cfg);
    const kelas = kelasAktif(p.id, level, k.kelasTerminal, cfg).length;
    p.reputasi = majukanReputasi(p.reputasi, targetReputasi(op.kepuasan.nilai, kelas, cfg), dt, cfg);
    // Kontrak: tawaran perpanjangan diterima begitu muncul (bila kepuasan mitra cukup; PO terakhir selalu).
    p.kontrak -= dt;
    const mau = (op.po[i]?.kepuasanMitra ?? 0) >= cfg.tycoon.mitra.minimal || x.po.length === 1;
    if (mau && p.kontrak <= cfg.mitra.kontrak.hariTawaran * DETIK_HARI) {
      const t = tawaranKontrak(p.id, p.ke, level, k.kelasTerminal, cfg);
      p.kontrak = Math.max(0, p.kontrak) + t.hari * DETIK_HARI;
      p.hari = t.hari;
      p.nilai = t.nilai;
      p.ke++;
      x.kas += t.nilai;
      x.kontrakDiterima += t.nilai;
    }
  });
  // Kontrak habis tanpa diperpanjang: PO keluar (jendelanya kosong).
  x.po = x.po.filter((p) => p.kontrak > 0 || x.po.length === 1);
  if (x.proyekDetik > 0) {
    x.proyekDetik -= dt;
    if (x.proyekDetik <= 1e-9) {
      x.proyekDetik = 0;
      x.perluasan++;
    }
  }
  x.detik += dt;
  return x;
}

export interface HasilSimulasi {
  readonly akhir: SimTycoon;
  readonly catatan: readonly Catatan[];
  /** Detik main saat level terminal pertama kali mencapai L. */
  readonly level: ReadonlyMap<number, number>;
  /** Detik main saat tahap perluasan ke-i selesai. */
  readonly perluasan: readonly number[];
  /**
   * Laba per hari terminal di akhir tiap hari. Kontrak PO dibayar di muka, jadi di
   * sini nilainya dirata-rata sepanjang kontrak (seperti rata-rata laporan & hadiah
   * di game) supaya hari tanpa perpanjangan tidak tampak merugi.
   */
  readonly labaHarian: readonly { readonly hari: number; readonly laba: number; readonly pendapatan: number; readonly biaya: number }[];
}

/** Jalankan pemain serakah selama `detik` detik main (keputusan tiap jam terminal, langkah 10 detik). */
export function jalankanSerakah(detik: number, cfg: KonfigEkonomi = EKONOMI): HasilSimulasi {
  const DT = 10;
  let s = buatSim(cfg);
  const catatan: Catatan[] = [];
  const level = new Map<number, number>();
  const perluasan: number[] = [];
  const labaHarian: { hari: number; laba: number; pendapatan: number; biaya: number }[] = [];
  let hariIni = { laba: 0, pendapatan: 0, biaya: 0 };
  for (let i = 0; s.detik < detik; i++) {
    if (i % 6 === 0) s = putuskan(s, catatan, cfg);
    const sebelum = s.perluasan;
    const k = keadaan(s, cfg);
    const keu = keuanganPerJam(k, hitungOperasi(k, { ritme: ritmePada(s.detik, cfg), event: 1 }, cfg), malamPada(s.detik), cfg);
    const kontrak = kontrakRata(s);
    hariIni.laba += ((keu.laba + kontrak) * DT) / 60;
    hariIni.pendapatan += ((keu.totalPendapatan + kontrak) * DT) / 60;
    hariIni.biaya += (keu.totalBiaya * DT) / 60;
    s = majukan(s, DT, cfg);
    if (s.perluasan > sebelum) perluasan.push(s.detik);
    const lv = levelTerminalSim(s, cfg);
    for (let l = 2; l <= lv; l++) if (!level.has(l)) level.set(l, s.detik);
    if (Math.floor(s.detik / 1440) > Math.floor((s.detik - DT) / 1440)) {
      labaHarian.push({ hari: labaHarian.length + 1, ...hariIni });
      hariIni = { laba: 0, pendapatan: 0, biaya: 0 };
    }
  }
  return { akhir: s, catatan, level, perluasan, labaHarian };
}

