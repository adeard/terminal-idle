import { describe, expect, it } from 'vitest';
import { acakBerbenih, DuniaVisual } from '../src/game/dunia-visual';
import type { LajuVisual } from '../src/game/laju';
import { anggotaRombongan, LAJU_KEJAR_MAKS, Rombongan } from '../src/game/rombongan';
import { diGedung, KURSI, KURSI_TUNGGU, TALI_LABIRIN } from '../src/game/tata-letak';
import { ruasBerpotongan } from './helpers';

const SEIMBANG: LajuVisual = { turun: 1.4, layanLoket: 1.4, naik: 1.4, busDatang: 0.12, muatanBus: 16, faktorKecepatanBus: 1 };

describe('rombongan (keluarga & pendamping)', () => {
  it('sebagian kecil penumpang bepergian bersama anak atau pendamping', () => {
    let rombongan = 0;
    let anak = 0;
    for (let id = 1; id <= 10000; id++) {
      const a = anggotaRombongan(id);
      if (a.length > 0) rombongan++;
      anak += a.filter((p) => p === 'anak').length;
      expect(a.length).toBeLessThanOrEqual(2);
    }
    expect(rombongan / 10000).toBeGreaterThan(0.15);
    expect(rombongan / 10000).toBeLessThan(0.25);
    expect(anak).toBeGreaterThan(0);
  });

  it('pengikut selalu dekat pemimpinnya, tidak melompat, dan tidak menembus tali labirin', () => {
    const dunia = new DuniaVisual({ acak: acakBerbenih(41) });
    const r = new Rombongan();
    const dt = 1 / 30;
    const sebelum = new Map<number, readonly [number, number]>();
    const galat: string[] = [];
    let diamati = 0;
    for (let n = 0; n < 30 * 180; n++) {
      dunia.perbarui(dt, { ...SEIMBANG, layanLoket: n < 30 * 90 ? 0.8 : 2 });
      r.perbarui(dunia.orang, dt);
      for (const f of r.pengikut) {
        // Pengantar yang sudah berpisah (melambai/pulang) dites di kehidupan.test.ts.
        if (f.bebas) continue;
        const p = dunia.orang.find((o) => o.id === f.idPemimpin);
        if (!p) {
          galat.push(`pengikut ${f.id} tanpa pemimpin`);
          continue;
        }
        diamati++;
        if (Math.hypot(f.x - p.x, f.y - p.y) > 0.5) galat.push(`pengikut ${f.id} tertinggal ${Math.hypot(f.x - p.x, f.y - p.y).toFixed(2)} (${p.fase})`);
        const lalu = sebelum.get(f.id);
        if (lalu) {
          if (Math.hypot(f.x - lalu[0], f.y - lalu[1]) > LAJU_KEJAR_MAKS * dt + 1e-9) galat.push(`pengikut ${f.id} melompat`);
          if (diGedung(f.x, f.y)) {
            for (const [x0, y0, x1, y1] of TALI_LABIRIN) if (ruasBerpotongan(lalu, [f.x, f.y], [x0, y0], [x1, y1])) galat.push(`pengikut ${f.id} menembus tali (${p.fase})`);
          }
        }
        sebelum.set(f.id, [f.x, f.y]);
      }
    }
    expect(galat.slice(0, 5)).toEqual([]);
    expect(diamati).toBeGreaterThan(10000);
  }, 30_000);

  it('rombongan duduk berdampingan di ruang tunggu; kursinya dilepas saat naik bus', () => {
    const dunia = new DuniaVisual({ acak: acakBerbenih(42) });
    const r = new Rombongan();
    const dt = 1 / 30;
    let dudukBersama = 0;
    const galat: string[] = [];
    for (let n = 0; n < 30 * 300; n++) {
      dunia.perbarui(dt, { ...SEIMBANG, naik: n < 30 * 200 ? 0.7 : 2 });
      r.perbarui(dunia.orang, dt);
      galat.push(...dunia.periksaKonsistensi());
      for (const o of dunia.orang) {
        if (o.kursiRombongan.length === 0) continue;
        const k = KURSI_TUNGGU[o.slot]!;
        const kolom = o.slot % KURSI.perBaris;
        for (const s of o.kursiRombongan) {
          const t = KURSI_TUNGGU[s]!;
          if (t.baris !== k.baris || t.blok !== k.blok || Math.abs((s % KURSI.perBaris) - kolom) > 2) galat.push(`kursi rombongan ${s} jauh dari ${o.slot}`);
        }
      }
      for (const f of r.pengikut) if (f.duduk) dudukBersama++;
    }
    expect(galat.slice(0, 5)).toEqual([]);
    expect(dudukBersama).toBeGreaterThan(1000);
  }, 30_000);
});
