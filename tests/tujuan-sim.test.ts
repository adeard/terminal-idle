import { describe, expect, it } from 'vitest';
import { kasMenipis, daftarTujuan, pilihTujuan } from '../src/app/tujuan';
import { langkahBerikut, sasaranLangkah } from '../src/app/tutorial';
import { terapkanAksi, type Aksi } from '../src/sim/aksi';
import { buatStateBaru, levelTerminal, tick, type GameState } from '../src/sim/state';
import { T0 } from './helpers';

/**
 * Pemain "pengikut tujuan" di atas GameState asli (AC-GP-02, documents/14 bagian 7; harness
 * rancangan docs/design/20261029-arah-pemain-baru/sim/arah-pemain-baru.ts): tutorial di detik
 * nyata 20/35/50/70, lalu tiap detik nyata baris tujuan dihitung (dengan histeresis seperti
 * overlay) dan tujuan yang tampil dikerjakan bila berupa aksi yang siap, paling sering tiap
 * 20 detik nyata. Satu langkah = satu detik nyata = satu tick N detik main di kecepatan N×
 * (PengendaliGame memakai tick 0,1 dtk; ekonomi tick linear terhadap dt, dan harness tempo
 * tests/tycoon-sim.ts melangkah 10 dtk). Langkah 0,1 dtk memberi hasil yang sama persis
 * (Lv 3 di detik 72, perluasan 1 di detik 90) tapi 6–7 dtk CPU, yang membuat tes lain kelaparan.
 * Perbandingan 1 dtk vs 0,1 dtk sudah dijalankan sekali dan hasilnya identik: salinan tes ini
 * dengan langkah 0,1 dtk di luar repo lulus dengan semua `expect` yang sama (diverifikasi Nisa
 * 2026-10-30, QA ronde 1 saran S-1). Tidak diulang di suite karena biaya CPU-nya.
 */
interface HasilPengikut {
  readonly kasMenipisDetik: number;
  readonly petugasBerhenti: number;
  /** Detik nyata Lv 3 tercapai & proyek perluasan 1 dimulai (null = belum). */
  readonly lv3: number | null;
  readonly mulaiPerluasan1: number | null;
  /** Pergantian tujuan < 5 dtk setelah pergantian sebelumnya tanpa aksi pemain di antaranya. */
  readonly kedip: number;
  readonly pergantian: number;
  readonly aksi: number;
  readonly akhir: GameState;
}

/** Detik nyata per langkah (baris tujuan juga dihitung sekali per detik nyata di overlay). */
const LANGKAH_NYATA = 1;
const JADWAL_TUTORIAL = [20, 35, 50, 70];
const REAKSI_DETIK = 20;

function aksiTutorial(s: GameState): Aksi | null {
  const id = langkahBerikut(s);
  if (id === null) return null;
  const sas = sasaranLangkah(id, s);
  switch (sas.jenis) {
    case 'jendela':
      // Sama dengan tombol tab Bangun: jendela untuk PO yang paling butuh (poTujuanJendela di sim).
      return { jenis: 'bangun', bangunan: 'jendela' };
    case 'po':
      return { jenis: 'daftarPo', po: sas.po };
    case 'petugas':
      return { jenis: 'rekrut', petugas: 'peron' };
    case 'jalur':
      return { jenis: 'bangun', bangunan: 'jalur' };
  }
}

function mainkanPengikut(menitNyata: number, kecepatan: number): HasilPengikut {
  let s = buatStateBaru(T0);
  const dtTick = kecepatan * LANGKAH_NYATA;
  let langkahTutorial = 0;
  let tutorialTamat = false;
  let tampil: { kunci: string; sejakMs: number } | null = null;
  const waktuGanti: number[] = [];
  const waktuAksi: number[] = [];
  let aksiTerakhir = Number.NEGATIVE_INFINITY;
  let kasMenipisDetik = 0;
  let lv3: number | null = null;
  let mulaiPerluasan1: number | null = null;
  const jumlahLangkah = Math.round((menitNyata * 60) / LANGKAH_NYATA);
  for (let i = 0; i < jumlahLangkah; i++) {
    const t = i * LANGKAH_NYATA;
    if (!tutorialTamat && langkahTutorial < JADWAL_TUTORIAL.length && t >= JADWAL_TUTORIAL[langkahTutorial]!) {
      const a = aksiTutorial(s);
      if (a) {
        const b = terapkanAksi(s, a);
        if (b !== s) waktuAksi.push(t);
        s = b;
      }
      langkahTutorial++;
    }
    // Status tutorial tersimpan "selesai" sekali tamat (ui/tutorial.ts).
    if (!tutorialTamat && langkahBerikut(s) === null) tutorialTamat = true;
    if (kasMenipis(s)) kasMenipisDetik++;
    if (tutorialTamat) {
      const ms = t * 1000;
      const p = pilihTujuan(daftarTujuan(s, tampil?.kunci ?? null), tampil, ms);
      if (!tampil || p.kunci !== tampil.kunci) {
        if (tampil) waktuGanti.push(t);
        tampil = { kunci: p.kunci, sejakMs: ms };
      }
      if (p.aksi && p.siap && t - aksiTerakhir >= REAKSI_DETIK) {
        const b = terapkanAksi(s, p.aksi);
        if (b !== s) {
          s = b;
          waktuAksi.push(t);
          aksiTerakhir = t;
        }
      }
    }
    if (lv3 === null && levelTerminal(s) >= 3) lv3 = t;
    if (mulaiPerluasan1 === null && (s.perkembangan.proyekDetik > 0 || s.perkembangan.perluasan > 0)) mulaiPerluasan1 = t;
    s = tick(s, dtTick);
  }
  const adaAksi = (a: number, b: number): boolean => waktuAksi.some((x) => x >= a - 1e-6 && x <= b + 1e-6);
  const kedip = waktuGanti.filter((x, j) => j > 0 && x - waktuGanti[j - 1]! < 5 && !adaAksi(waktuGanti[j - 1]! - 1, x)).length;
  return { kasMenipisDetik, petugasBerhenti: s.keuangan.petugasBerhenti, lv3, mulaiPerluasan1, kedip, pergantian: waktuGanti.length, aksi: waktuAksi.length, akhir: s };
}

describe('simulasi pemain pengikut tujuan (AC-GP-02)', () => {
  it('30 menit nyata di 3×: tidak pernah kas menipis, tidak ada petugas berhenti, perluasan 1 ≤ 30 dtk setelah Lv 3, tanpa kedip', () => {
    const h = mainkanPengikut(30, 3);
    expect(h.kasMenipisDetik).toBe(0);
    expect(h.petugasBerhenti).toBe(0);
    expect(h.lv3).not.toBeNull();
    expect(h.mulaiPerluasan1).not.toBeNull();
    expect(h.mulaiPerluasan1! - h.lv3!).toBeGreaterThanOrEqual(0);
    expect(h.mulaiPerluasan1! - h.lv3!).toBeLessThanOrEqual(30);
    expect(h.kedip).toBe(0);
    // Pemain benar-benar bermain mengikuti tujuan (bukan diam).
    expect(h.aksi).toBeGreaterThan(10);
    expect(levelTerminal(h.akhir)).toBeGreaterThan(3);
  }, 240_000);
});
