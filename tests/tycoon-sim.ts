/**
 * Simulasi tycoon untuk tes tempo & kalibrasi (bukan tes): terminal
 * disederhanakan di atas modul murni tycoon (operasi, keuangan, bangunan,
 * petugas, tarif) dengan pemain "serakah" yang tiap jam terminal membeli aksi
 * yang paling cepat balik modal. Kontrak PO dianggap selalu diperpanjang dan
 * tarif tetap bawaan. Lihat documents/13-rancangan-tycoon.md bagian 14.
 */
import { EKONOMI, type KonfigEkonomi } from '../src/config/economy.config';
import { bangunanAwal, biayaBangun, slotBangunan } from '../src/sim/bangunan';
import { BANGUNAN_IDS, PETUGAS_IDS, PO_IDS, TEKNOLOGI_IDS, type BangunanId, type PetugasId, type PoId, type TeknologiId } from '../src/sim/fitur';
import { keuanganPerJam, majukanKas } from '../src/sim/keuangan';
import { kelasDariLevel, slotPo } from '../src/sim/level-terminal';
import { kelasAktif, majukanReputasi, syaratDaftarKurang, targetReputasi, tingkatPo } from '../src/sim/mitra';
import { hitungOperasi, type HasilOperasi, type KeadaanOperasi } from '../src/sim/operasi';
import { berhentiKasHabis, bisaRekrut, rekrut } from '../src/sim/petugas';
import { tarifBawaan, type NilaiTarif } from '../src/sim/tarif';
import { keramaianTerminal, waktuTerminal } from '../src/sim/waktu';

export interface PoSim {
  readonly id: PoId;
  xp: number;
  loket: number;
  reputasi: number;
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

/** Level dari XP kumulatif xpA × (L − 1)^xpK. */
export function levelDariXp(xp: number, k: { readonly xpA: number; readonly xpK: number }): number {
  if (!(xp > 0)) return 1;
  let level = 1 + Math.floor(Math.pow(xp / k.xpA, 1 / k.xpK));
  while (level > 1 && k.xpA * Math.pow(level - 1, k.xpK) > xp) level--;
  while (k.xpA * Math.pow(level, k.xpK) <= xp) level++;
  return level;
}

export function buatSim(cfg: KonfigEkonomi = EKONOMI): SimTycoon {
  return {
    detik: 0,
    kas: cfg.tycoon.modalAwal,
    bangunan: { ...bangunanAwal(cfg) },
    petugas: [],
    tarif: tarifBawaan(cfg),
    teknologi: Object.fromEntries(TEKNOLOGI_IDS.map((id) => [id, false])) as Record<TeknologiId, boolean>,
    po: [{ id: 'ondelOndel', xp: 0, loket: 1, reputasi: tingkatPo('ondelOndel', cfg).reputasiAwal }],
    xpTerminal: 0,
    perluasan: 0,
    proyekDetik: 0,
    tunggakan: 0,
    berhenti: 0,
  };
}

export const levelTerminalSim = (s: SimTycoon, cfg: KonfigEkonomi = EKONOMI): number => levelDariXp(s.xpTerminal, cfg.tycoon.xpTerminal);
export const levelPoSim = (p: PoSim, cfg: KonfigEkonomi = EKONOMI): number => levelDariXp(p.xp, cfg.tycoon.xpPo);

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
  const p = cfg.permintaan;
  return p.ritmeMin + (1 - p.ritmeMin) * keramaianTerminal(waktuTerminal(detik));
}

const malamPada = (detik: number): boolean => {
  const jam = waktuTerminal(detik).jamDesimal;
  return jam < 6 || jam >= 18;
};

/** Laba rata-rata per jam terminal sepanjang hari: jam sibuk (8 jam) & jam sepi (16 jam). */
export function labaRata(s: SimTycoon, cfg: KonfigEkonomi = EKONOMI): number {
  const k = keadaan(s, cfg);
  let total = 0;
  for (const [ritme, jam, malam] of [
    [1, 8, false],
    [0.6, 10, false],
    [0.45, 6, true],
  ] as const) {
    const op = hitungOperasi(k, { ritme, event: 1 }, cfg);
    total += keuanganPerJam(k, op, malam, cfg).laba * jam;
  }
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
  const t = cfg.tycoon;
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
      return syarat && !s.teknologi[syarat] ? null : t.teknologi[a.id].biaya;
    }
    case 'po': {
      const level = levelTerminalSim(s, cfg);
      if (s.po.some((p) => p.id === a.id) || s.po.length >= slotPo(level, s.perluasan, cfg)) return null;
      const src = cfg.mitra.po[a.id].sumber;
      if (src === 'hadiahEvent' || src === 'awal') return null;
      const op = hitungOperasi(keadaan(s, cfg), { ritme: 1, event: 1 }, cfg);
      if (syaratDaftarKurang(a.id, { kelasTerminal: kelasDariLevel(level, cfg), kepuasan: op.kepuasan.nilai }, cfg)) return null;
      // PO butuh jendela: dibangun PO sendiri di slot kosong.
      if (s.bangunan.jendela >= slotBangunan('jendela', s.perluasan, cfg)) return null;
      return t.biayaDaftarPo[a.id];
    }
    case 'perluasan': {
      const tahap = cfg.mitra.perluasan[s.perluasan];
      if (!tahap || s.proyekDetik > 0 || levelTerminalSim(s, cfg) < tahap.level) return null;
      return t.perluasan[s.perluasan]!.biaya;
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
      x.po.push({ id: a.id, xp: 0, loket, reputasi: tingkatPo(a.id, cfg).reputasiAwal });
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
}

/** Aksi yang menambah laba rata-rata, urut balik modal tercepat. */
function nilaiAksi(x: SimTycoon, cfg: KonfigEkonomi): NilaiAksi[] {
  const op = hitungOperasi(keadaan(x, cfg), { ritme: 1, event: 1 }, cfg);
  const sekarang = labaRata(x, cfg);
  const nilai: NilaiAksi[] = [];
  for (const a of calonAksi(op)) {
    const biaya = biayaAksi(x, a, cfg);
    if (biaya === null) continue;
    const tambah = labaRata(terapkanAksi(x, a, biaya, cfg), cfg) - sekarang;
    // Rekrut gratis tapi bergaji: hanya bila menambah laba.
    if (!(tambah > 1)) continue;
    nilai.push({ a, biaya, balik: biaya / tambah });
  }
  return nilai.sort((p, q) => p.balik - q.balik);
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
  const tambah = lanjut.biaya / lanjut.balik;
  return { a, biaya, balik: (biaya + lanjut.biaya) / tambah + cfg.mitra.detikProyek / 60 };
}

/**
 * Pemain serakah: beli aksi dengan balik modal tercepat (biaya ÷ tambahan laba
 * rata-rata per jam) bila kasnya cukup. Bila yang terbaik belum terjangkau,
 * hanya beli aksi lain yang balik modalnya paling lama 2× yang terbaik (selain
 * itu menabung). Perluasan ikut bersaing lewat nilaiPerluasan.
 */
export function putuskan(s: SimTycoon, catatan: Catatan[], cfg: KonfigEkonomi = EKONOMI): SimTycoon {
  let x = s;
  for (let ulang = 0; ulang < 30; ulang++) {
    const nilai = nilaiAksi(x, cfg);
    const perluasan = nilaiPerluasan(x, cfg);
    if (perluasan) nilai.push(perluasan);
    nilai.sort((p, q) => p.balik - q.balik);
    const terbaik = nilai[0];
    const pilih = terbaik && terbaik.biaya <= x.kas ? terbaik : nilai.find((v) => v.biaya <= x.kas && v.balik <= 2 * (terbaik?.balik ?? 0));
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
    p.reputasi = majukanReputasi(p.reputasi, targetReputasi(op.kepuasan.nilai, 100, kelas, cfg), dt, cfg);
  });
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
  /** Laba per hari terminal di akhir tiap hari. */
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
    hariIni.laba += (keu.laba * DT) / 60;
    hariIni.pendapatan += (keu.totalPendapatan * DT) / 60;
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

