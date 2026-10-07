import { describe, expect, it } from 'vitest';
import { acakBerbenih, DuniaVisual } from '../src/game/dunia-visual';
import type { LajuVisual } from '../src/game/laju';
import { kemajuanLoket } from '../src/game/label-loket';
import { X_LOKET } from '../src/game/tata-letak';

const SEIMBANG: LajuVisual = { turun: 1.4, layanLoket: 1.4, naik: 1.4, busDatang: 0.12, muatanBus: 16, faktorKecepatanBus: 1 };

describe('loader transaksi tiket di loket', () => {
  it('tiap jendela: kemajuan naik dari 0 sampai hampir penuh selama pembeli membeli tiket, kosong bila tidak ada pembeli', () => {
    const dunia = new DuniaVisual({ acak: acakBerbenih(21) });
    const galat: string[] = [];
    /** Pembeli di tiap jendela pada frame lalu & kemajuannya. */
    const lalu: ({ id: number; p: number } | null)[] = X_LOKET.map(() => null);
    const jendelaTerpakai = new Set<number>();
    let transaksiTuntas = 0;
    const dt = 1 / 30;
    for (let t = 0; t < 150; t += dt) {
      dunia.perbarui(dt, SEIMBANG);
      const kemajuan = kemajuanLoket(dunia.orang, X_LOKET.length);
      if (kemajuan.length !== X_LOKET.length) galat.push(`panjang ${kemajuan.length}`);
      kemajuan.forEach((p, i) => {
        const pembeli = dunia.orang.filter((o) => o.fase === 'beliTiket' && o.loket === i);
        if (pembeli.length > 1) galat.push(`jendela ${i}: ${pembeli.length} orang membeli tiket bersamaan`);
        const o = pembeli[0];
        if (!o) {
          if (p !== null) galat.push(`jendela ${i}: kemajuan ${p} tanpa pembeli`);
          if (lalu[i] && lalu[i]!.p > 0.5) transaksiTuntas++;
          lalu[i] = null;
          return;
        }
        if (p === null) {
          galat.push(`jendela ${i}: pembeli ${o.id} tanpa kemajuan`);
          return;
        }
        jendelaTerpakai.add(i);
        const sebelumnya = lalu[i];
        if (sebelumnya && sebelumnya.id === o.id) {
          if (p < sebelumnya.p) galat.push(`jendela ${i}: kemajuan pembeli ${o.id} mundur`);
        } else if (p > dt / o.lamaTimer + 1e-9) {
          galat.push(`jendela ${i}: pembeli ${o.id} mulai dari ${p.toFixed(3)}`);
        }
        lalu[i] = { id: o.id, p };
      });
    }
    expect(galat.slice(0, 5)).toEqual([]);
    expect(jendelaTerpakai.size).toBeGreaterThan(3);
    expect(transaksiTuntas).toBeGreaterThan(20);
  }, 30_000);
});
