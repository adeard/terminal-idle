import Decimal from 'break_infinity.js';
import { EKONOMI } from '../src/config/economy.config';
import { WAKTU } from '../src/config/waktu.config';
import type { PoId } from '../src/sim/fitur';
import { xpKumulatifTerminal } from '../src/sim/level-terminal';
import { tingkatPo, xpKumulatifPo } from '../src/sim/mitra';
import { aturLevelLoket, buatPoTerdaftar, buatStateBaru, tick, type GameState } from '../src/sim/state';
import { TAHAP_IDS, type TahapId } from '../src/sim/tahap';

export const T0 = Date.UTC(2026, 0, 1);
export const DT = 0.1;

/** Reputasi netral: faktor reputasi 1, jadi pendapatan sama dengan rumus dasar (v1). */
export const REPUTASI_NETRAL = 50;

/**
 * State baru dengan level tertentu dan semua Kepala sudah direkrut (gratis, untuk setup test).
 * Level Loket = banyaknya loket: semuanya disewa PO awal (tetap Lv 1, reputasi netral),
 * jadi kapasitas & pendapatannya sama dengan rumus dasar satu PO.
 */
export function stateOtomatis(level: Partial<Record<TahapId, number>> = {}, uang: number = EKONOMI.uangAwal): GameState {
  const s = buatStateBaru(T0);
  const tahap = { ...s.terminal.tahap };
  for (const id of TAHAP_IDS) {
    tahap[id] = { ...tahap[id], level: level[id] ?? 1, kepala: { direkrut: true } };
  }
  const loket = level.loket ?? 1;
  const mitra = {
    ...s.mitra,
    terdaftar: s.mitra.terdaftar.map((p, i) => (i === 0 ? { ...p, loket, rekorLoket: Math.max(p.rekorLoket, loket), reputasi: REPUTASI_NETRAL } : p)),
  };
  return { ...s, uang: new Decimal(uang), mitra, terminal: aturLevelLoket({ ...s.terminal, tahap }, mitra) };
}

/** Uang berlimpah untuk setup tes. */
export function kaya(state: GameState, uang = 1e15): GameState {
  return { ...state, uang: new Decimal(uang) };
}

/**
 * Daftarkan (atau ubah) PO langsung, tanpa syarat & biaya (setup tes): level lewat
 * XP kumulatifnya, loket (bawaan: loket bawaan tingkatnya), reputasi (bawaan: netral).
 * Level Loket terminal dihitung ulang.
 */
export function denganPo(state: GameState, id: PoId, o: { readonly level?: number; readonly loket?: number; readonly reputasi?: number } = {}): GameState {
  const lama = state.mitra.terdaftar.find((p) => p.id === id);
  const dasar = lama ?? buatPoTerdaftar(id, tingkatPo(id).loketBawaan);
  const p = {
    ...dasar,
    xp: o.level !== undefined ? xpKumulatifPo(o.level) : dasar.xp,
    loket: o.loket ?? dasar.loket,
    rekorLoket: Math.max(dasar.rekorLoket, o.loket ?? dasar.loket),
    reputasi: o.reputasi ?? (lama ? lama.reputasi : REPUTASI_NETRAL),
  };
  const terdaftar = lama ? state.mitra.terdaftar.map((x) => (x.id === id ? p : x)) : [...state.mitra.terdaftar, p];
  const mitra = { ...state.mitra, terdaftar };
  return { ...state, mitra, terminal: aturLevelLoket(state.terminal, mitra) };
}

/** Terminal pada level tertentu (XP kumulatifnya); perluasan tidak berubah. */
export function denganLevelTerminal(state: GameState, level: number): GameState {
  return { ...state, perkembangan: { ...state.perkembangan, xpTerminal: xpKumulatifTerminal(level) } };
}

/** State yang sama pada jam terminal `jam` di hari ke-`hariKe` (0 = Senin; waktu main disesuaikan). */
export function padaJam(state: GameState, jam: number, hariKe = 1): GameState {
  const waktuMainDetik = (hariKe * 24 + jam - WAKTU.jamAwal) * WAKTU.detikPerJam;
  return { ...state, statistik: { ...state.statistik, waktuMainDetik } };
}

/** Jalankan tick fixed timestep selama `detik`. */
export function jalankan(state: GameState, detik: number): GameState {
  let s = state;
  const n = Math.round(detik / DT);
  for (let i = 0; i < n; i++) s = tick(s, DT);
  return s;
}

export function levelSemua(state: GameState): Record<TahapId, number> {
  return {
    peron: state.terminal.tahap.peron.level,
    loket: state.terminal.tahap.loket.level,
    keberangkatan: state.terminal.tahap.keberangkatan.level,
  };
}

type Titik2 = readonly [number, number];

/** Ruas a–b dan c–d berpotongan atau bersentuhan (dengan toleransi `eps`). */
export function ruasBerpotongan(a: Titik2, b: Titik2, c: Titik2, d: Titik2, eps = 1e-9): boolean {
  const orientasi = (p: Titik2, q: Titik2, r: Titik2): number => (q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]);
  const diRuas = (p: Titik2, q: Titik2, r: Titik2): boolean =>
    Math.min(p[0], q[0]) - eps <= r[0] && r[0] <= Math.max(p[0], q[0]) + eps && Math.min(p[1], q[1]) - eps <= r[1] && r[1] <= Math.max(p[1], q[1]) + eps;
  const o1 = orientasi(a, b, c);
  const o2 = orientasi(a, b, d);
  const o3 = orientasi(c, d, a);
  const o4 = orientasi(c, d, b);
  if (((o1 > eps && o2 < -eps) || (o1 < -eps && o2 > eps)) && ((o3 > eps && o4 < -eps) || (o3 < -eps && o4 > eps))) return true;
  return (Math.abs(o1) <= eps && diRuas(a, b, c)) || (Math.abs(o2) <= eps && diRuas(a, b, d)) || (Math.abs(o3) <= eps && diRuas(c, d, a)) || (Math.abs(o4) <= eps && diRuas(c, d, b));
}

/** Jejak (4 sudut) bus berpusat (x, y) menghadap `sudut`, dengan panjang & lebar penuh. */
export function jejakBus(x: number, y: number, sudut: number, panjang: number, lebar: number): Titik2[] {
  const c = Math.cos(sudut);
  const s = Math.sin(sudut);
  const pl = panjang / 2;
  const pw = lebar / 2;
  return [
    [x + c * pl - s * pw, y + s * pl + c * pw],
    [x + c * pl + s * pw, y + s * pl - c * pw],
    [x - c * pl + s * pw, y - s * pl - c * pw],
    [x - c * pl - s * pw, y - s * pl + c * pw],
  ];
}

function jarakTitikRuas(p: Titik2, a: Titik2, b: Titik2): number {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy);
}

export function diDalamPoligon(p: Titik2, poli: readonly Titik2[]): boolean {
  let dalam = false;
  for (let i = 0, j = poli.length - 1; i < poli.length; j = i++) {
    const [xi, yi] = poli[i]!;
    const [xj, yj] = poli[j]!;
    if (yi > p[1] !== yj > p[1] && p[0] < ((xj - xi) * (p[1] - yi)) / (yj - yi) + xi) dalam = !dalam;
  }
  return dalam;
}

/** Jarak terdekat dua poligon cembung (0 kalau bertumpuk). */
export function jarakPoligon(a: readonly Titik2[], b: readonly Titik2[]): number {
  if (a.some((p) => diDalamPoligon(p, b)) || b.some((p) => diDalamPoligon(p, a))) return 0;
  let m = Number.POSITIVE_INFINITY;
  for (const p of a) for (let i = 0; i < b.length; i++) m = Math.min(m, jarakTitikRuas(p, b[i]!, b[(i + 1) % b.length]!));
  for (const p of b) for (let i = 0; i < a.length; i++) m = Math.min(m, jarakTitikRuas(p, a[i]!, a[(i + 1) % a.length]!));
  return m;
}

/** Jarak titik ke poligon (0 kalau di dalam). */
export function jarakTitikPoligon(p: Titik2, poli: readonly Titik2[]): number {
  if (diDalamPoligon(p, poli)) return 0;
  let m = Number.POSITIVE_INFINITY;
  for (let i = 0; i < poli.length; i++) m = Math.min(m, jarakTitikRuas(p, poli[i]!, poli[(i + 1) % poli.length]!));
  return m;
}
