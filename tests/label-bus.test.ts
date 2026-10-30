import { describe, expect, it } from 'vitest';
import { acakBerbenih, DuniaVisual, type BusVisual } from '../src/game/dunia-visual';
import type { LajuVisual } from '../src/game/laju';
import { isiLabelBus, jepitLabel, labelAktif, type JenisLabelBus } from '../src/game/label-bus';

const SEIMBANG: LajuVisual = { turun: 1.4, layanLoket: 1.4, naik: 1.4, busDatang: 0.12, muatanBus: 16, faktorKecepatanBus: 1 };

/** Jalankan dunia dan panggil `cek` untuk tiap bus tiap frame. */
function amati(detik: number, cek: (b: BusVisual) => void): void {
  const dunia = new DuniaVisual({ acak: acakBerbenih(8) });
  for (let t = 0; t < detik; t += 1 / 30) {
    dunia.perbarui(1 / 30, SEIMBANG);
    for (const b of dunia.bus) cek(b);
  }
}

describe('label kemajuan bus', () => {
  it('tiap pekerjaan bus punya labelnya sendiri; bus yang sedang berjalan atau lewat tidak berlabel', () => {
    const galat: string[] = [];
    const terlihat = new Set<JenisLabelBus>();
    const harapan: Partial<Record<BusVisual['fase'], JenisLabelBus>> = { turunkan: 'turun', muat: 'muat' };
    amati(200, (b) => {
      const j = labelAktif(b);
      if (j) terlihat.add(j);
      const mestinya = b.jenis !== 'terminal' ? null : b.fase === 'parkir' ? (b.cuci < 1 ? 'cuci' : null) : (harapan[b.fase] ?? null);
      if (j !== mestinya) galat.push(`bus ${b.id} (${b.jenis}, ${b.fase}) berlabel ${j}, mestinya ${mestinya}`);
    });
    expect(galat.slice(0, 5)).toEqual([]);
    expect([...terlihat].sort()).toEqual(['cuci', 'muat', 'turun']);
  }, 20_000);

  it('peron kedatangan: TURUN bertambah dari 0 sampai semua penumpang yang dibawa turun', () => {
    const galat: string[] = [];
    const lalu = new Map<number, number>();
    let tuntas = 0;
    amati(200, (b) => {
      if (labelAktif(b) !== 'turun') return;
      const isi = isiLabelBus(b, 'turun', true);
      const turun = b.muatanDatang - b.muatan;
      if (isi.angka !== `${turun}/${b.muatanDatang}`) galat.push(`bus ${b.id}: angka ${isi.angka}`);
      // Mulai dari 0 (paling banyak satu penumpang sudah turun di frame bus berhenti).
      if (!lalu.has(b.id) && isi.kemajuan > 1 / b.muatanDatang + 1e-9) galat.push(`bus ${b.id}: mulai dari ${isi.kemajuan}`);
      if (isi.kemajuan < (lalu.get(b.id) ?? 0)) galat.push(`bus ${b.id}: kemajuan turun`);
      lalu.set(b.id, isi.kemajuan);
      if (isi.selesai) {
        tuntas++;
        if (b.muatan !== 0) galat.push(`bus ${b.id}: selesai padahal masih ${b.muatan} penumpang`);
      }
    });
    expect(galat.slice(0, 5)).toEqual([]);
    expect(lalu.size).toBeGreaterThan(5);
    expect(tuntas).toBeGreaterThan(0);
  }, 20_000);

  it('pangkalan: loader cuci naik 0 → 100 % selama bus dicuci, lalu BERSIH ✓', () => {
    const galat: string[] = [];
    const lalu = new Map<number, number>();
    amati(200, (b) => {
      if (labelAktif(b) !== 'cuci') return;
      const isi = isiLabelBus(b, 'cuci', true);
      if (isi.kemajuan < (lalu.get(b.id) ?? 0)) galat.push(`bus ${b.id}: kemajuan cuci turun`);
      if (isi.angka !== `${Math.floor(b.cuci * 100)}%`) galat.push(`bus ${b.id}: angka ${isi.angka}`);
      lalu.set(b.id, isi.kemajuan);
    });
    expect(galat.slice(0, 5)).toEqual([]);
    expect(lalu.size).toBeGreaterThan(3);
    expect([...lalu.values()].some((p) => p > 0.9)).toBe(true);
  }, 20_000);

  it('setelah selesai (bus beranjak) label memudar dengan tanda ✓ dan bilah penuh', () => {
    let diperiksa = 0;
    amati(120, (b) => {
      if (b.jenis !== 'terminal' || b.muatanDatang <= 0) return;
      diperiksa++;
      const turun = isiLabelBus(b, 'turun', false);
      expect(turun.judul).toBe('TURUN ✓');
      expect(turun.kemajuan).toBe(1);
      expect(turun.selesai).toBe(true);
      const cuci = isiLabelBus(b, 'cuci', false);
      expect(cuci.judul).toBe('BERSIH ✓');
      expect(cuci.angka).toBe('100%');
      expect(isiLabelBus(b, 'muat', false).judul.endsWith('✓')).toBe(true);
    });
    expect(diperiksa).toBeGreaterThan(0);
  }, 20_000);
});

describe('jepit label bus ke layar (AC-GFX-04)', () => {
  // Layar portrait 540 lebar; label "JAKARTA 0/14" ±62 × 24 px.
  const L = 540;
  const T = 590;
  const titik = { x: 0, y: 0 };

  it('label di tengah layar tidak bergeser', () => {
    expect(jepitLabel(300, 400, 62, 24, L, T, titik)).toBe(true);
    expect(titik).toEqual({ x: 300, y: 400 });
  });

  it('bus di tepi kanan (jangkar di dalam layar): label digeser masuk, utuh dengan tepi 4 px', () => {
    expect(jepitLabel(534, 500, 62, 24, L, T, titik)).toBe(true);
    expect(titik.x + 62 / 2).toBe(L - 4);
    expect(titik.y).toBe(500);
  });

  it('tepi kiri dan atas juga dijepit (label tergantung di atas jangkar)', () => {
    expect(jepitLabel(5, 10, 62, 24, L, T, titik)).toBe(true);
    expect(titik.x - 62 / 2).toBe(4);
    expect(titik.y - 24).toBe(4);
  });

  it('jangkar di luar layar: label disembunyikan, tidak dijepit jauh dari busnya', () => {
    for (const [x, y] of [
      [-1, 300],
      [L + 1, 300],
      [300, -1],
      [300, T + 1],
    ] as const) {
      expect(jepitLabel(x, y, 62, 24, L, T, titik), `${x},${y}`).toBe(false);
    }
  });
});
