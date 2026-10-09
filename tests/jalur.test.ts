import { describe, expect, it } from 'vitest';
import { peristiwaAksi } from '../src/app/analitik';
import { EKONOMI } from '../src/config/economy.config';
import { DuniaVisual } from '../src/game/dunia-visual';
import { hitungLajuVisual } from '../src/game/laju';
import { GERBANG_X, HALTE_BERANGKAT_X, HALTE_DATANG_X } from '../src/game/tata-letak';
import { terapkanAksi } from '../src/sim/aksi';
import { slotBangunan } from '../src/sim/bangunan';
import { bangun, biayaBangunState, operasiState, pengembalianBongkarState } from '../src/sim/state';
import { buatModel } from '../src/ui/model';
import { denganBangunan, denganPo, kaya, stateOtomatis } from './helpers';

const J = EKONOMI.tycoon.bangunan.jalur;

describe('jalur bus (sim)', () => {
  it('game baru: satu jalur; slot jalur sebanyak halte di adegan sampai Gedung Antarpulau', () => {
    const s = stateOtomatis();
    expect(s.terminal.bangunan.jalur).toBe(1);
    expect(slotBangunan('jalur', 0)).toBe(HALTE_DATANG_X.length);
    expect(HALTE_BERANGKAT_X.length).toBe(HALTE_DATANG_X.length);
    expect(GERBANG_X.length).toBe(HALTE_BERANGKAT_X.length);
  });

  it('dibangun berurutan: kas dipotong, Peron & Keberangkatan naik, Loket tetap; tiap jalur makin mahal', () => {
    let s = kaya(stateOtomatis());
    const op = operasiState(s);
    s = bangun(s, 'jalur');
    expect(s.terminal.bangunan.jalur).toBe(2);
    expect(s.kas).toBe(1e15 - J.biaya[0]!);
    const op2 = operasiState(s);
    expect(op2.kapasitas.peron).toBeCloseTo(2 * op.kapasitas.peron, 6);
    expect(op2.kapasitas.keberangkatan).toBeCloseTo(2 * op.kapasitas.keberangkatan, 6);
    expect(op2.kapasitas.loket).toBe(op.kapasitas.loket);
    expect(biayaBangunState(s, 'jalur')).toBe(J.biaya[1]);
    for (let i = 1; i < J.biaya.length; i++) expect(J.biaya[i]!).toBeGreaterThan(J.biaya[i - 1]!);
  });

  it('kas kurang: tidak terjadi apa-apa; jalur permanen (tidak bisa dibongkar); slot penuh sampai perluasan', () => {
    const miskin = { ...stateOtomatis(), kas: J.biaya[0]! - 1 };
    expect(bangun(miskin, 'jalur')).toBe(miskin);
    expect(pengembalianBongkarState(denganBangunan(stateOtomatis(), { jalur: 3 }), 'jalur')).toBeNull();
    const penuh = denganBangunan(kaya(stateOtomatis()), { jalur: slotBangunan('jalur', 0) });
    expect(biayaBangunState(penuh, 'jalur')).toBeNull();
  });

  it('aksi, analitik, dan model tab Bangun', () => {
    const s = kaya(stateOtomatis());
    const aksi = { jenis: 'bangun', bangunan: 'jalur' } as const;
    const b = terapkanAksi(s, aksi);
    expect(b.terminal.bangunan.jalur).toBe(2);
    expect(peristiwaAksi(aksi, s, b)).toEqual([{ nama: 'bangun', data: { bangunan: 'jalur', jumlah: 2 } }]);
    const m = buatModel(b).bangun.bangunan.jalur;
    expect(m).toMatchObject({ jumlah: 2, slot: slotBangunan('jalur', 0), biaya: J.biaya[1], bongkar: null });
  });
});

describe('jalur bus di adegan', () => {
  const acakBerbenih = (benih: number): (() => number) => {
    let x = benih >>> 0 || 1;
    return () => {
      x ^= x << 13;
      x ^= x >>> 17;
      x ^= x << 5;
      return (x >>> 0) / 4294967296;
    };
  };

  it('bus hanya memakai halte & jalur keberangkatan yang sudah dibangun; bus lain menunggu', () => {
    for (const jalur of [1, 2, 3]) {
      // Semua jurusan Jawa-Bali dilayani (empat PO di Lv 12), jadi semua kelompok parkir terbuka.
      let dasar = stateOtomatis({ jalur: 5 });
      for (const id of ['ondelOndel', 'peuyeumKilat', 'lumpiaKilat', 'bakpiaRasa'] as const) dasar = denganPo(dasar, id, { level: 12, loket: 2 });
      const s = denganBangunan(dasar, { jalur });
      const laju = hitungLajuVisual(s);
      expect(laju.jalur).toBe(jalur);
      const dunia = new DuniaVisual({ acak: acakBerbenih(7 + jalur) });
      const halteDatang = new Set<number>();
      const halteBerangkat = new Set<number>();
      let berangkat = 0;
      for (let t = 0; t < 240; t += 1 / 30) {
        dunia.perbarui(1 / 30, laju);
        for (const b of dunia.bus) {
          if (b.fase === 'turunkan') halteDatang.add(b.halte);
          if (b.fase === 'muat') halteBerangkat.add(b.halte);
          if (b.fase === 'keluar' && b.penumpangNaik > 0) berangkat++;
        }
      }
      expect(Math.max(...halteDatang)).toBeLessThan(jalur);
      expect(Math.max(...halteBerangkat)).toBeLessThan(jalur);
      expect(halteDatang.size).toBeGreaterThan(0);
      expect(halteBerangkat.size).toBeGreaterThan(0);
      expect(berangkat).toBeGreaterThan(0);
      expect(dunia.periksaKonsistensi()).toEqual([]);
    }
  }, 60_000);
});
