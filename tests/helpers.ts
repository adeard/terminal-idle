import { EKONOMI } from '../src/config/economy.config';
import { WAKTU } from '../src/config/waktu.config';
import type { BangunanId, PetugasId, PoId } from '../src/sim/fitur';
import { xpKumulatifTerminal } from '../src/sim/level-terminal';
import { tingkatPo, xpKumulatifPo } from '../src/sim/mitra';
import { rapikanPetugas } from '../src/sim/petugas';
import { buatPoTerdaftar, buatStateBaru, tick, type GameState } from '../src/sim/state';

export const T0 = Date.UTC(2026, 0, 1);
export const DT = 0.1;

/** Reputasi netral: faktor reputasi 1 (lihat faktorReputasi). */
export const REPUTASI_NETRAL = 50;

/**
 * Terminal baru yang berjalan untuk setup tes: PO awal bereputasi netral, ditambah
 * bangunan tertentu (tanpa biaya & slot) dan, bila diminta, petugas (urut rekrut).
 */
export function stateOtomatis(bangunan: Partial<Record<BangunanId, number>> = {}, kas: number = EKONOMI.tycoon.modalAwal, petugas: readonly PetugasId[] = []): GameState {
  const s = buatStateBaru(T0);
  const mitra = { ...s.mitra, terdaftar: s.mitra.terdaftar.map((p) => ({ ...p, reputasi: REPUTASI_NETRAL })) };
  return denganPetugas(denganBangunan({ ...s, kas, mitra }, bangunan), petugas);
}

/** Kas berlimpah untuk setup tes. */
export function kaya(state: GameState, kas = 1e15): GameState {
  return { ...state, kas };
}

/** Ganti jumlah bangunan langsung (tanpa biaya & slot); petugas yang melebihi batas barunya keluar. */
export function denganBangunan(state: GameState, b: Partial<Record<BangunanId, number>>): GameState {
  const bangunan = { ...state.terminal.bangunan, ...b };
  return { ...state, terminal: { ...state.terminal, bangunan, petugas: rapikanPetugas(state.terminal.petugas, bangunan) } };
}

/** Ganti petugas langsung (urut rekrut, dirapikan ke batas bangunan). */
export function denganPetugas(state: GameState, petugas: readonly PetugasId[]): GameState {
  return { ...state, terminal: { ...state.terminal, petugas: rapikanPetugas(petugas, state.terminal.bangunan) } };
}

/**
 * Daftarkan (atau ubah) PO langsung, tanpa syarat & biaya (setup tes): level lewat
 * XP kumulatifnya, jendela loket (bawaan: loket bawaan tingkatnya), reputasi
 * (bawaan: netral). Jendela terminal ditambah bila kurang untuk semua PO.
 */
export function denganPo(state: GameState, id: PoId, o: { readonly level?: number; readonly loket?: number; readonly reputasi?: number } = {}): GameState {
  const lama = state.mitra.terdaftar.find((p) => p.id === id);
  const dasar = lama ?? buatPoTerdaftar(id, tingkatPo(id).loketBawaan);
  const p = {
    ...dasar,
    xp: o.level !== undefined ? xpKumulatifPo(o.level) : dasar.xp,
    loket: o.loket ?? dasar.loket,
    reputasi: o.reputasi ?? (lama ? lama.reputasi : REPUTASI_NETRAL),
  };
  const terdaftar = lama ? state.mitra.terdaftar.map((x) => (x.id === id ? p : x)) : [...state.mitra.terdaftar, p];
  const disewa = terdaftar.reduce((a, x) => a + x.loket, 0);
  const s = { ...state, mitra: { ...state.mitra, terdaftar } };
  return disewa > s.terminal.bangunan.jendela ? denganBangunan(s, { jendela: disewa }) : s;
}

/** Terminal dengan sekian tahap perluasan sudah selesai dibangun (tanpa proyek berjalan). */
export function denganPerluasan(state: GameState, tahap: number): GameState {
  return { ...state, perkembangan: { ...state.perkembangan, perluasan: tahap, proyekDetik: 0 } };
}

/** Terminal pada level tertentu (XP kumulatifnya); perluasan tidak berubah. */
export function denganLevelTerminal(state: GameState, level: number): GameState {
  return { ...state, perkembangan: { ...state.perkembangan, xpTerminal: xpKumulatifTerminal(level) } };
}

/** State yang sama pada jam terminal `jam` di hari ke-`hariKe` (0 = Senin; waktu main & buku hari ini disesuaikan). */
export function padaJam(state: GameState, jam: number, hariKe = 1): GameState {
  const waktuMainDetik = (hariKe * 24 + jam - WAKTU.jamAwal) * WAKTU.detikPerJam;
  return {
    ...state,
    statistik: { ...state.statistik, waktuMainDetik },
    keuangan: { ...state.keuangan, hariIni: { ...state.keuangan.hariIni, hariKe } },
    harian: { ...state.harian, hariKe },
  };
}

/** Jalankan tick fixed timestep selama `detik`. */
export function jalankan(state: GameState, detik: number): GameState {
  let s = state;
  const n = Math.round(detik / DT);
  for (let i = 0; i < n; i++) s = tick(s, DT);
  return s;
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
