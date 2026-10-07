import { describe, expect, it } from 'vitest';
import { acakBerbenih, DuniaVisual, type BusVisual } from '../src/game/dunia-visual';
import type { LajuVisual } from '../src/game/laju';
import { bobotDengar, PengamatSuara, teksPanggil, type Bunyi, type Pendengar, type SumberSuara } from '../src/game/suara';
import { CUCI, PARKIR_SERONG, TUJUAN_BUS } from '../src/game/tata-letak';

const SEIMBANG: LajuVisual = { turun: 1.4, layanLoket: 1.4, naik: 1.4, busDatang: 0.12, muatanBus: 16, faktorKecepatanBus: 1 };
const pendengar = (x: number, y: number, jarak = 25): Pendengar => ({ x, y, jarak, pan: (px) => Math.max(-1, Math.min(1, (px - x) / 10)) });
const sepi: SumberSuara = { orang: [], bus: [], peristiwa: [], kendaraan: [], keramaian: 1, malam: 0, hujan: 0, kilat: 0 };

describe('suara terminal', () => {
  it('yang dekat titik pandang lebih keras; zoom masuk mempersempit jangkauan dengar', () => {
    const p = pendengar(20, 10);
    expect(bobotDengar(p, 20, 10)).toBe(1);
    expect(bobotDengar(p, 25, 10)).toBeLessThan(bobotDengar(p, 22, 10));
    expect(bobotDengar(pendengar(20, 10, 8), 26, 10)).toBeLessThan(bobotDengar(pendengar(20, 10, 40), 26, 10));
  });

  it('riuh mengikuti kerumunan di dekat kamera; jangkrik hanya di malam yang sepi', () => {
    const kerumunan = Array.from({ length: 150 }, (_, i) => ({ x: 20 + (i % 10) * 0.2, y: 12 + Math.floor(i / 10) * 0.2 }));
    const sumber = { ...sepi, orang: [kerumunan] };
    const dekat = new PengamatSuara(acakBerbenih(1)).amati(0.016, sumber, pendengar(21, 13)).lapisan;
    const jauh = new PengamatSuara(acakBerbenih(1)).amati(0.016, sumber, pendengar(-10, -10, 10)).lapisan;
    expect(dekat.riuh).toBeGreaterThan(0.5);
    expect(jauh.riuh).toBeLessThan(dekat.riuh * 0.3);
    const amati = (malam: number, keramaian: number) => new PengamatSuara(acakBerbenih(1)).amati(0.016, { ...sepi, malam, keramaian }, pendengar(0, 0)).lapisan.jangkrik;
    expect(amati(0, 0.1)).toBe(0);
    expect(amati(1, 0.1)).toBeGreaterThan(0.5);
    expect(amati(1, 0.9)).toBeLessThan(0.05);
  });

  it('bus parkir: mesin mati, semprotan terdengar saat sopir membilas', () => {
    const bus = { x: PARKIR_SERONG.pusatX[3]!, y: PARKIR_SERONG.pusatY, sudut: PARKIR_SERONG.sudut, fase: 'parkir', cuci: CUCI.mulaiSopir + CUCI.lamaPintu + 0.2, v: 0 } as unknown as BusVisual;
    const p = pendengar(bus.x, bus.y);
    const l = new PengamatSuara(acakBerbenih(2)).amati(0.016, { ...sepi, bus: [bus] }, p).lapisan;
    expect(l.mesin).toBe(0);
    expect(l.semprot).toBeGreaterThan(0.3);
    const langsam = new PengamatSuara(acakBerbenih(2)).amati(0.016, { ...sepi, bus: [{ ...bus, fase: 'muat' }] }, p).lapisan;
    expect(langsam.mesin).toBeGreaterThan(0.1);
    expect(langsam.semprot).toBe(0);
  });

  it('pengumuman menyebut kota tujuan & nomor JALUR sesuai papan gerbang', () => {
    const teks = teksPanggil(3, 1);
    expect(teks).toContain('jalur 2');
    const kota = TUJUAN_BUS[3 % TUJUAN_BUS.length]!;
    expect(teks).toContain(kota.charAt(0) + kota.slice(1).toLowerCase());
  });

  it('terminal berjalan: rem angin, deru berangkat, dan pengumuman berjarak (tidak beruntun)', () => {
    const dunia = new DuniaVisual({ acak: acakBerbenih(3) });
    const pengamat = new PengamatSuara(acakBerbenih(4));
    const p = pendengar(28, 7, 30);
    const semua: { t: number; b: Bunyi }[] = [];
    const dt = 1 / 30;
    for (let n = 0; n < 30 * 300; n++) {
      dunia.perbarui(dt, SEIMBANG);
      const { lapisan, bunyi } = pengamat.amati(dt, { ...sepi, orang: [dunia.orang], bus: dunia.bus, peristiwa: dunia.peristiwa }, p);
      for (const v of Object.values(lapisan)) expect(v).toBeGreaterThanOrEqual(0);
      for (const b of bunyi) {
        expect(b.keras).toBeGreaterThanOrEqual(0);
        expect(b.keras).toBeLessThanOrEqual(1);
        semua.push({ t: n * dt, b });
      }
    }
    const jenis = (j: Bunyi['jenis']) => semua.filter((x) => x.b.jenis === j);
    expect(jenis('rem').length).toBeGreaterThan(10);
    expect(jenis('deru').length).toBeGreaterThan(5);
    const umum = jenis('pengumuman');
    expect(umum.length).toBeGreaterThanOrEqual(3);
    expect(umum.some((x) => x.b.teks?.includes('jalur'))).toBe(true);
    for (let i = 1; i < umum.length; i++) expect(umum[i]!.t - umum[i - 1]!.t).toBeGreaterThanOrEqual(35);
  }, 20_000);
});
