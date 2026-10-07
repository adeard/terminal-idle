import { describe, expect, it } from 'vitest';
import type { BusVisual } from '../src/game/dunia-visual';
import { bunyiTelolet, type Pendengar } from '../src/game/suara';
import {
  ANAK_TELOLET,
  AnakTelolet,
  anakTeloletHadir,
  busDiKetuk,
  JARAK_DENGAR_TELOLET,
  JUMLAH_MELODI_TELOLET,
  LAMA_GIRANG,
  melodiTelolet,
  TOLERANSI_KETUK_PX,
  type ProyeksiLayar,
} from '../src/game/telolet';
import { BUS } from '../src/game/tata-letak';

/** Kamera tegak lurus dari atas: 20 px per unit, semua terlihat. */
const ATAS: ProyeksiLayar = { proyeksi: (x, y) => ({ x: x * 20, y: y * 20, terlihat: true }) };
const bus = (id: number, x: number, y: number, sudut = 0): BusVisual => ({ id, x, y, sudut, selesai: false }) as unknown as BusVisual;

describe('klakson telolet: bus yang diketuk', () => {
  it('ketukan di badan bus (sepanjang bus, selebar bus + toleransi) mengenai bus itu', () => {
    const b = bus(1, 10, 5);
    expect(busDiKetuk([b], ATAS, 200, 100)).toBe(b);
    // Ujung depan & belakang bus.
    expect(busDiKetuk([b], ATAS, (10 + BUS.panjang / 2) * 20 - 2, 100)).toBe(b);
    expect(busDiKetuk([b], ATAS, (10 - BUS.panjang / 2) * 20 + 2, 100)).toBe(b);
    // Di samping bus: masih kena dalam setengah lebar + toleransi, lewat dari itu tidak.
    const tepi = (BUS.lebar / 2) * 20 + TOLERANSI_KETUK_PX;
    expect(busDiKetuk([b], ATAS, 200, 100 + tepi - 1)).toBe(b);
    expect(busDiKetuk([b], ATAS, 200, 100 + tepi + 2)).toBeNull();
  });

  it('bus serong dan bus yang berdekatan: yang terdekat ke titik ketuk', () => {
    const miring = bus(2, 10, 5, Math.PI / 2);
    expect(busDiKetuk([miring], ATAS, 200, (5 + BUS.panjang / 2) * 20 - 3)).toBe(miring);
    expect(busDiKetuk([miring], ATAS, (10 + BUS.panjang / 2) * 20, 100)).toBeNull();
    const a = bus(3, 10, 5);
    const b = bus(4, 10, 5.9);
    expect(busDiKetuk([a, b], ATAS, 200, 5.8 * 20)).toBe(b);
    expect(busDiKetuk([a, b], ATAS, 200, 5.1 * 20)).toBe(a);
  });

  it('bus yang sudah hilang atau di luar layar tidak bisa diketuk', () => {
    const hilang = { ...bus(5, 10, 5), selesai: true } as BusVisual;
    expect(busDiKetuk([hilang], ATAS, 200, 100)).toBeNull();
    const tersembunyi: ProyeksiLayar = { proyeksi: (x, y) => ({ x: x * 20, y: y * 20, terlihat: false }) };
    expect(busDiKetuk([bus(6, 10, 5)], tersembunyi, 200, 100)).toBeNull();
  });

  it('tiap bus selalu memainkan melodi yang sama; bunyinya nyaring karena bus yang diketuk terlihat', () => {
    for (let id = 0; id < 20; id++) {
      expect(melodiTelolet(id)).toBe(melodiTelolet(id + JUMLAH_MELODI_TELOLET));
      expect(melodiTelolet(id)).toBeGreaterThanOrEqual(0);
      expect(melodiTelolet(id)).toBeLessThan(JUMLAH_MELODI_TELOLET);
    }
    const p: Pendengar = { x: 0, y: 0, jarak: 30, pan: () => 0.3 };
    const dekat = bunyiTelolet(p, 0, 0, 2);
    const jauh = bunyiTelolet(p, 60, 0, 2);
    expect(dekat).toMatchObject({ jenis: 'telolet', melodi: 2, pan: 0.3 });
    expect(dekat.keras).toBeLessThanOrEqual(1);
    expect(jauh.keras).toBeGreaterThanOrEqual(0.6);
    expect(jauh.keras).toBeLessThan(dekat.keras);
  });
});

describe('anak-anak "Om Telolet Om"', () => {
  it('ada di pinggir jalan siang hari, pulang saat malam atau hujan', () => {
    expect(anakTeloletHadir(10, 0)).toBe(true);
    expect(anakTeloletHadir(21, 0)).toBe(false);
    expect(anakTeloletHadir(5, 0)).toBe(false);
    expect(anakTeloletHadir(10, 0.5)).toBe(false);
  });

  it('melambai ke bus yang lewat di depannya, diam bila jalan sepi', () => {
    const anak = new AnakTelolet();
    anak.perbarui(0.5);
    const a = ANAK_TELOLET[0]!;
    expect(anak.gerak(0, []).lambai).toBeNull();
    expect(anak.gerak(0, [bus(1, a.x + 30, 0.7)]).lambai).toBeNull();
    expect(anak.gerak(0, [bus(1, a.x + 1, 0.7)]).lambai).not.toBeNull();
    // Bus di dalam terminal (bukan di jalan raya) tidak disapa.
    expect(anak.gerak(0, [bus(1, a.x + 1, 7.2)]).lambai).toBeNull();
    expect(anak.gerak(0, [bus(1, a.x + 1, 0.7)]).loncat).toBe(0);
  });

  it('melompat kegirangan sebentar setelah telolet terdengar di dekatnya, tidak bila jauh', () => {
    const anak = new AnakTelolet();
    const a = ANAK_TELOLET[1]!;
    anak.dengar(a.x + JARAK_DENGAR_TELOLET + 20, 5);
    expect(anak.sedangGirang).toBe(false);
    anak.dengar(a.x + 5, 1.9);
    expect(anak.sedangGirang).toBe(true);
    let naik = 0;
    for (let t = 0; t < 1; t += 0.05) {
      anak.perbarui(0.05);
      naik = Math.max(naik, anak.gerak(1, []).loncat);
      expect(anak.gerak(1, []).lambai).not.toBeNull();
    }
    expect(naik).toBeGreaterThan(0.02);
    anak.perbarui(LAMA_GIRANG);
    expect(anak.sedangGirang).toBe(false);
    expect(anak.gerak(1, []).loncat).toBe(0);
  });
});
