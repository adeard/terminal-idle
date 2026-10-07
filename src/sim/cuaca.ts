/**
 * Cuaca terminal (hujan, mendung, petir) dari waktu main aktif dan benih cuaca.
 * Tiap pekan Senin–Minggu diacak: 1–3 hari hujan, masing-masing sekali di
 * pagi, siang, atau malam. Benihnya dibuat sekali saat game baru dan ikut
 * tersimpan di save, jadi jadwal hujan berbeda di tiap game tapi tidak berubah
 * saat game dibuka ulang. Murni & deterministik; tidak memengaruhi ekonomi.
 */
import { CUACA, type KonfigCuaca, type WaktuHujan } from '../config/cuaca.config';
import { WAKTU, type KonfigWaktu } from '../config/waktu.config';
import type { GameState } from './state';

export interface Cuaca {
  /** Intensitas hujan 0–1. */
  readonly hujan: number;
  /** Tutupan awan 0–1 (mulai sebelum hujan, bertahan sebentar sesudahnya). */
  readonly mendung: number;
}

export interface Hujan {
  /** Hari ke-berapa sejak game dimulai (0 = hari pertama, Senin). */
  readonly hari: number;
  readonly waktu: WaktuHujan['nama'];
  /** Jam mutlak (sejak hari 0 pukul 00.00). */
  readonly mulai: number;
  readonly selesai: number;
  readonly deras: number;
}

const HARI_SEPEKAN = 7;

/** Bilangan acak 0–1 dari tiga bilangan bulat (hash integer). */
function acakDari(a: number, b: number, c = 0): number {
  let h = Math.imul(a ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul(b + 0x632be5ab, 0xc2b2ae35) ^ Math.imul(c + 0x27d4eb2f, 0x165667b1);
  h ^= h >>> 15;
  h = Math.imul(h, 0x2c1b3c6d);
  h ^= h >>> 12;
  h = Math.imul(h, 0x297a2d39);
  h ^= h >>> 15;
  return (h >>> 0) / 4294967296;
}

/** Benih cuaca untuk game baru, diturunkan dari waktu pembuatannya (ms). */
export function benihCuacaDari(sekarangMs: number): number {
  const ms = Math.max(0, Math.floor(sekarangMs));
  return Math.floor(acakDari(ms % 2147483647, Math.floor(ms / 2147483647), 7) * 2147483647);
}

const langkahHalus = (a: number, b: number, x: number): number => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/** Pilih satu dari beberapa [nilai, bobot] dengan bilangan acak r ∈ [0, 1). */
function pilihBerbobot<T>(pilihan: readonly (readonly [T, number])[], r: number): T {
  const total = pilihan.reduce((s, [, b]) => s + b, 0);
  let sisa = r * total;
  for (const [nilai, bobot] of pilihan) {
    if (sisa < bobot) return nilai;
    sisa -= bobot;
  }
  return pilihan[pilihan.length - 1]![0];
}

/** Rencana hujan pekan ke-`pekan` (0 = Senin–Minggu pertama), urut hari. */
export function hujanPadaPekan(pekan: number, benih: number, cfg: KonfigCuaca = CUACA, w: KonfigWaktu = WAKTU): Hujan[] {
  if (pekan < 0) return [];
  const r = (k: number): number => acakDari(benih, pekan, k);
  const jumlah = pilihBerbobot(cfg.hariHujanPerPekan, r(0));
  // Kocok hari Senin–Minggu, ambil sebanyak jumlah hari hujan.
  const hari = Array.from({ length: HARI_SEPEKAN }, (_, i) => i);
  for (let i = HARI_SEPEKAN - 1; i > 0; i--) {
    const j = Math.floor(r(1 + i) * (i + 1));
    [hari[i], hari[j]] = [hari[j]!, hari[i]!];
  }
  return hari
    .slice(0, jumlah)
    .sort((a, b) => a - b)
    .map((d, k) => {
      const hariKe = pekan * HARI_SEPEKAN + d;
      // Hari pertama game dimulai pukul jamAwal: hujan yang sudah lewat tidak dipilih.
      const waktuMungkin = cfg.waktu.filter((x) => hariKe > 0 || x.mulai[0] >= w.jamAwal);
      const waktu = pilihBerbobot((waktuMungkin.length > 0 ? waktuMungkin : cfg.waktu).map((x) => [x, x.bobot] as const), r(20 + k * 4));
      const mulai = waktu.mulai[0] + r(21 + k * 4) * (waktu.mulai[1] - waktu.mulai[0]);
      const lama = waktu.lama[0] + r(22 + k * 4) * (waktu.lama[1] - waktu.lama[0]);
      return {
        hari: hariKe,
        waktu: waktu.nama,
        mulai: hariKe * 24 + mulai,
        selesai: hariKe * 24 + Math.min(mulai + lama, cfg.redaSebelumJam),
        deras: waktu.deras[0] + r(23 + k * 4) * (waktu.deras[1] - waktu.deras[0]),
      };
    });
}

/** Jam mutlak sejak hari 0 pukul 00.00. */
const jamMutlak = (detikMain: number, w: KonfigWaktu): number => w.jamAwal + Math.max(0, detikMain) / w.detikPerJam;

export function cuacaTerminal(detikMain: number, benih: number, cfg: KonfigCuaca = CUACA, w: KonfigWaktu = WAKTU): Cuaca {
  const jam = jamMutlak(detikMain, w);
  const pekan = Math.floor(jam / 24 / HARI_SEPEKAN);
  let hujan = 0;
  let mendung = 0;
  // Mendung sesudah hujan Minggu malam bisa berlanjut ke Senin dini hari.
  for (const p of [pekan - 1, pekan]) {
    for (const h of hujanPadaPekan(p, benih, cfg, w)) {
      if (jam < h.mulai - cfg.mendungSebelum || jam > h.selesai + cfg.mendungSesudah) continue;
      const naik = langkahHalus(h.mulai, h.mulai + cfg.landai, jam);
      const turun = 1 - langkahHalus(h.selesai - cfg.landai, h.selesai, jam);
      hujan = Math.max(hujan, h.deras * naik * turun);
      const awan = langkahHalus(h.mulai - cfg.mendungSebelum, h.mulai, jam) * (1 - langkahHalus(h.selesai, h.selesai + cfg.mendungSesudah, jam));
      mendung = Math.max(mendung, awan * Math.min(1, 0.55 + h.deras * 0.5));
    }
  }
  return { hujan, mendung: Math.max(mendung, hujan) };
}

export function cuacaTerminalState(state: GameState, cfg: KonfigCuaca = CUACA, w: KonfigWaktu = WAKTU): Cuaca {
  return cuacaTerminal(state.statistik.waktuMainDetik, state.benihCuaca, cfg, w);
}

/** Lama kilat (detik). */
const LAMA_KILAT = 0.55;

/**
 * Kecerahan kilat petir (0–1) pada detik main ini: saat hujan deras, tiap slot
 * beberapa detik punya peluang satu sambaran (dua kilatan beruntun).
 */
export function kilatPada(detikMain: number, benih: number, cfg: KonfigCuaca = CUACA, w: KonfigWaktu = WAKTU): number {
  const n = Math.floor(detikMain / cfg.slotPetirDetik);
  let terang = 0;
  for (const s of [n - 1, n]) {
    const t0 = saatPetir(s, benih, cfg, w);
    if (t0 === null) continue;
    const u = detikMain - t0;
    if (u < 0 || u > LAMA_KILAT) continue;
    // Dua kilatan: terang, redup sebentar, terang lagi, lalu padam.
    const k = u < 0.07 ? 1 : u < 0.14 ? 0.25 : u < 0.22 ? 0.85 : 0.85 * (1 - (u - 0.22) / (LAMA_KILAT - 0.22));
    terang = Math.max(terang, k);
  }
  return terang;
}

/** Detik main sambaran petir di slot ke-n, atau null kalau tidak ada. */
export function saatPetir(n: number, benih: number, cfg: KonfigCuaca = CUACA, w: KonfigWaktu = WAKTU): number | null {
  if (n < 0) return null;
  const t0 = (n + 0.1 + acakDari(benih, n, 991) * 0.8) * cfg.slotPetirDetik;
  const { hujan } = cuacaTerminal(t0, benih, cfg, w);
  if (hujan < cfg.ambangPetir) return null;
  const peluang = (cfg.peluangPetir * (hujan - cfg.ambangPetir)) / (1 - cfg.ambangPetir);
  return acakDari(benih, n, 997) < peluang ? t0 : null;
}
