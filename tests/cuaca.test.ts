import { describe, expect, it } from 'vitest';
import { CUACA } from '../src/config/cuaca.config';
import { WAKTU } from '../src/config/waktu.config';
import { benihCuacaDari, cuacaTerminal, hujanPadaPekan, kilatPada } from '../src/sim/cuaca';
import { deserialisasi, serialisasi } from '../src/sim/save';
import { buatStateBaru } from '../src/sim/state';
import { T0 } from './helpers';

/** Detik main sampai jam `jam` hari ke-`hari` (hari 0 = Senin pertama). */
const detikKe = (hari: number, jam: number): number => (hari * 24 + jam - WAKTU.jamAwal) * WAKTU.detikPerJam;
const BENIH = 12345;

describe('cuaca terminal', () => {
  it('tiap pekan Senin–Minggu: 1–3 hari hujan, sekali sehari di pagi/siang/malam, reda sebelum ganti hari', () => {
    const jumlah = new Map<number, number>();
    const waktu = new Map<string, number>();
    for (let benih = 1; benih <= 60; benih++) {
      for (let pekan = 0; pekan < 12; pekan++) {
        const daftar = hujanPadaPekan(pekan, benih);
        jumlah.set(daftar.length, (jumlah.get(daftar.length) ?? 0) + 1);
        expect(daftar.length).toBeGreaterThanOrEqual(1);
        expect(daftar.length).toBeLessThanOrEqual(3);
        expect(new Set(daftar.map((h) => h.hari)).size).toBe(daftar.length);
        for (const h of daftar) {
          waktu.set(h.waktu, (waktu.get(h.waktu) ?? 0) + 1);
          expect(Math.floor(h.hari / 7)).toBe(pekan);
          expect(h.mulai).toBeGreaterThanOrEqual(h.hari * 24);
          expect(h.selesai).toBeLessThan((h.hari + 1) * 24);
          expect(h.selesai).toBeGreaterThan(h.mulai + 0.5);
          expect(h.deras).toBeGreaterThan(0);
          expect(h.deras).toBeLessThanOrEqual(1);
        }
      }
    }
    // Semua kemungkinan muncul: 1, 2, dan 3 hari hujan; pagi, siang, dan malam.
    expect([...jumlah.keys()].sort()).toEqual([1, 2, 3]);
    for (const w of ['pagi', 'siang', 'malam']) expect(waktu.get(w) ?? 0).toBeGreaterThan(50);
  });

  it('terlihat di game: tiap pekan ada 1–3 hari yang benar-benar hujan', () => {
    for (const benih of [3, 777, 424242]) {
      for (let pekan = 0; pekan < 6; pekan++) {
        let hariHujan = 0;
        for (let d = 0; d < 7; d++) {
          const hari = pekan * 7 + d;
          let maks = 0;
          for (let m = 0; m < 24 * 60; m += 5) maks = Math.max(maks, cuacaTerminal(detikKe(hari, m / 60), benih).hujan);
          if (maks > 0.05) hariHujan++;
        }
        expect(hariHujan).toBeGreaterThanOrEqual(1);
        expect(hariHujan).toBeLessThanOrEqual(3);
      }
    }
  }, 30_000);

  it('acak: game berbeda punya jadwal hujan berbeda; hari & jamnya tidak tetap', () => {
    const jadwal = (benih: number): string =>
      hujanPadaPekan(0, benih)
        .map((h) => `${h.hari}:${h.mulai.toFixed(2)}`)
        .join(',');
    const berbeda = new Set(Array.from({ length: 30 }, (_, i) => jadwal(benihCuacaDari(T0 + i * 60_000))));
    expect(berbeda.size).toBeGreaterThan(25);
    // Tiap hari dalam sepekan bisa kebagian hujan.
    const hari = new Set<number>();
    for (let benih = 1; benih <= 40; benih++) for (const h of hujanPadaPekan(2, benih)) hari.add(h.hari % 7);
    expect(hari.size).toBe(7);
  });

  it('hari pertama tidak memilih hujan yang sudah lewat sebelum game dimulai', () => {
    for (let benih = 1; benih <= 300; benih++) {
      for (const h of hujanPadaPekan(0, benih)) if (h.hari === 0) expect(h.mulai).toBeGreaterThan(WAKTU.jamAwal);
    }
  });

  it('0–1, berubah halus (termasuk lewat tengah malam & pergantian pekan); mendung dulu sebelum hujan', () => {
    let lalu = cuacaTerminal(0, BENIH);
    for (let d = 1; d <= 3 * 7 * 24 * 60; d++) {
      const c = cuacaTerminal((d * WAKTU.detikPerJam) / 60, BENIH);
      expect(c.hujan).toBeGreaterThanOrEqual(0);
      expect(c.hujan).toBeLessThanOrEqual(1);
      expect(c.mendung).toBeGreaterThanOrEqual(c.hujan);
      expect(c.mendung).toBeLessThanOrEqual(1);
      expect(Math.abs(c.hujan - lalu.hujan)).toBeLessThan(0.08);
      expect(Math.abs(c.mendung - lalu.mendung)).toBeLessThan(0.08);
      lalu = c;
    }
    for (let pekan = 0; pekan < 3; pekan++) {
      for (const h of hujanPadaPekan(pekan, BENIH)) {
        const sebelum = cuacaTerminal((h.mulai - 0.1 - WAKTU.jamAwal) * WAKTU.detikPerJam, BENIH);
        expect(sebelum.mendung).toBeGreaterThan(0.2);
      }
    }
  }, 30_000);

  it('petir hanya saat hujan deras', () => {
    let kilatKering = 0;
    let kilatDeras = 0;
    for (const benih of [5, 6, 7]) {
      for (let t = 0; t < detikKe(21, 0); t += 0.05) {
        const k = kilatPada(t, benih);
        if (k <= 0) continue;
        if (cuacaTerminal(t, benih).hujan < CUACA.ambangPetir - 0.05) kilatKering++;
        else kilatDeras++;
      }
    }
    expect(kilatKering).toBe(0);
    expect(kilatDeras).toBeGreaterThan(0);
  }, 60_000);

  it('benih cuaca dibuat saat game baru, ikut tersimpan, dan save lama diberi benih', () => {
    const s = buatStateBaru(T0);
    expect(Number.isSafeInteger(s.benihCuaca)).toBe(true);
    expect(buatStateBaru(T0 + 1).benihCuaca).not.toBe(s.benihCuaca);
    expect(deserialisasi(serialisasi(s), T0 + 5000).benihCuaca).toBe(s.benihCuaca);
    const lama = JSON.parse(serialisasi(s)) as Record<string, unknown>;
    delete lama['benihCuaca'];
    expect(Number.isSafeInteger(deserialisasi(JSON.stringify(lama), T0 + 5000).benihCuaca)).toBe(true);
  });
});
