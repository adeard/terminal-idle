import { describe, expect, it } from 'vitest';
import { acakBerbenih, DuniaVisual, type BusVisual } from '../src/game/dunia-visual';
import { formatJamJadwal, JadwalKeberangkatan } from '../src/game/jadwal';
import {
  ASONGAN,
  dalamRentang,
  lamaPutaran,
  loketBuka,
  PATROLI_SATPAM,
  posisiPatroli,
  SAPU_AULA,
  SAPU_TUNGGU,
  tokoBuka,
  type Patroli,
} from '../src/game/kehidupan-malam';
import type { LajuVisual } from '../src/game/laju';
import { LuarTerminal, MOTOR_OJEK, MOTOR_OJOL } from '../src/game/luar3d';
import { rutePulangPengantar, Rombongan } from '../src/game/rombongan';
import { BLOK_KURSI, diGedung, GERBANG_KELUAR_X, GERBANG_MASUK_X, GERBANG_X, KURSI_TUNGGU, LEBAR_GERBANG_PAGAR, RUANG_TUNGGU, TALI_LABIRIN, URUTAN_LOKET, X_LOKET, Y_PAGAR } from '../src/game/tata-letak';
import { ruasBerpotongan } from './helpers';

const SEIMBANG: LajuVisual = { turun: 1.4, layanLoket: 1.4, naik: 1.4, busDatang: 0.12, muatanBus: 16, faktorKecepatanBus: 1 };

/** Titik (x, y) menembus blok kursi ruang tunggu. */
const menembusKursi = (x: number, y: number): boolean =>
  BLOK_KURSI.some((b) => x > b.x0 + 0.01 && x < b.x1 - 0.01) && KURSI_TUNGGU.some((k) => y > k.y - 0.07 && y < k.y + 0.09);

/** Ruas-ruas rute (tertutup bila `tutup`). */
function ruas(titik: readonly (readonly [number, number])[], tutup: boolean): [readonly [number, number], readonly [number, number]][] {
  const hasil: [readonly [number, number], readonly [number, number]][] = [];
  for (let i = 1; i < titik.length; i++) hasil.push([titik[i - 1]!, titik[i]!]);
  if (tutup) hasil.push([titik[titik.length - 1]!, titik[0]!]);
  return hasil;
}

describe('jam buka', () => {
  it('rentang jam boleh melewati tengah malam', () => {
    expect(dalamRentang(23, [22, 5])).toBe(true);
    expect(dalamRentang(3, [22, 5])).toBe(true);
    expect(dalamRentang(12, [22, 5])).toBe(false);
    expect(dalamRentang(12, [7, 22])).toBe(true);
    expect(dalamRentang(22, [7, 22])).toBe(false);
  });

  it('minimarket 24 jam, apotek & kios tutup malam; separuh loket tutup tengah malam', () => {
    for (let j = 0; j < 24; j += 0.5) expect(tokoBuka('minimarket', j)).toBe(true);
    expect(tokoBuka('apotek', 12)).toBe(true);
    expect(tokoBuka('apotek', 23)).toBe(false);
    expect(tokoBuka('kios', 3)).toBe(false);
    expect(loketBuka(12)).toHaveLength(X_LOKET.length);
    expect(loketBuka(1).length).toBeLessThan(X_LOKET.length);
    expect(loketBuka(1).length).toBeGreaterThan(0);
  });

  it('jendela loket yang buka sebanyak yang dipakai mitra PO, mulai dari jendela di depan kepala antrean', () => {
    for (let n = 1; n <= X_LOKET.length; n++) {
      const siang = loketBuka(12, n);
      expect(siang).toHaveLength(n);
      expect(new Set(siang)).toEqual(new Set(URUTAN_LOKET.slice(0, n)));
      expect([...siang].sort((a, b) => a - b)).toEqual(siang);
      // Malam: separuhnya (paling sedikit dua bila ada), dari jendela yang buka siang.
      const malam = loketBuka(1, n);
      expect(malam).toHaveLength(Math.min(n, Math.max(2, Math.ceil(n / 2))));
      for (const i of malam) expect(siang).toContain(i);
    }
    // Dua jendela: dua di depan kepala antrean, malam pun tetap dua.
    expect(loketBuka(12, 2)).toEqual([3, 4]);
    expect(loketBuka(1, 2)).toEqual([3, 4]);
    // Tanpa loket disewa: tetap satu jendela terdepan yang buka; lebih dari yang ada: semua.
    expect(loketBuka(12, 0)).toEqual([URUTAN_LOKET[0]]);
    expect(loketBuka(12, 99)).toHaveLength(X_LOKET.length);
    // Semua jendela: malam hari separuh jendela, yang terdekat ke kepala antrean.
    expect(loketBuka(1)).toEqual([2, 3, 4, 5]);
  });
});

describe('rute mondar-mandir', () => {
  const periksaGerak = (p: Patroli): void => {
    let lalu = posisiPatroli(p, 0);
    const dt = 0.05;
    for (let t = dt; t < lamaPutaran(p) * 2; t += dt) {
      const q = posisiPatroli(p, t);
      expect(Math.hypot(q.x - lalu.x, q.y - lalu.y)).toBeLessThanOrEqual(p.laju * dt + 1e-9);
      lalu = q;
    }
  };

  it('berulang mulus, tidak pernah melompat atau lebih cepat dari lajunya', () => {
    for (const p of [PATROLI_SATPAM, SAPU_AULA, SAPU_TUNGGU, ...ASONGAN]) periksaGerak(p);
    const t = 12.3;
    const a = posisiPatroli(PATROLI_SATPAM, t);
    const b = posisiPatroli(PATROLI_SATPAM, t + lamaPutaran(PATROLI_SATPAM));
    expect(b.x).toBeCloseTo(a.x, 9);
    expect(b.y).toBeCloseTo(a.y, 9);
  });

  it('petugas kebersihan tetap di dalam aula/ruang tunggu, tidak menembus tali labirin atau blok kursi', () => {
    for (const [a, b] of ruas(SAPU_AULA.titik, true)) {
      expect(diGedung(a[0], a[1])).toBe(true);
      for (const [x0, y0, x1, y1] of TALI_LABIRIN) expect(ruasBerpotongan(a, b, [x0, y0], [x1, y1])).toBe(false);
    }
    for (const [x, y] of SAPU_TUNGGU.titik) {
      expect(x > RUANG_TUNGGU.x0 && x < RUANG_TUNGGU.x1 && y > RUANG_TUNGGU.y0 && y < RUANG_TUNGGU.y1).toBe(true);
      expect(menembusKursi(x, y)).toBe(false);
    }
  });

  it('pedagang asongan di halaman dekat gerbang pagar, di luar jalur pejalan kaki gerbang', () => {
    for (const p of ASONGAN) {
      for (const [x, y] of p.titik) {
        expect(y).toBeLessThan(Y_PAGAR);
        expect(y).toBeGreaterThan(Y_PAGAR - 1.2);
        const jarakGerbang = Math.min(Math.abs(x - GERBANG_MASUK_X), Math.abs(x - GERBANG_KELUAR_X));
        expect(jarakGerbang).toBeGreaterThan(LEBAR_GERBANG_PAGAR / 2);
        expect(jarakGerbang).toBeLessThan(2.5);
      }
    }
  });
});

describe('papan jadwal keberangkatan', () => {
  const bus = (id: number, fase: BusVisual['fase'], lain: Partial<BusVisual> = {}): BusVisual =>
    ({ id, jenis: 'terminal', tujuan: id % 3, fase, halte: -1, cuci: 0, istirahat: 0, tunggu: 0, ...lain }) as BusVisual;

  it('jam format HH.MM; jadwal tetap per bus, urut jam, status mengikuti keadaan bus', () => {
    expect(formatJamJadwal(24 + 7.5)).toBe('07.30');
    expect(formatJamJadwal(23.999)).toBe('00.00');
    const j = new JadwalKeberangkatan();
    const daftar = [bus(1, 'parkir'), bus(2, 'parkir', { cuci: 1, istirahat: 0.9 }), bus(3, 'muat', { halte: 1, tunggu: 5 })];
    const awal = j.perbarui(daftar, 10);
    expect(awal.map((b) => b.busId)).toEqual([3, 2, 1]);
    expect(awal[0]).toMatchObject({ status: 'NAIK', jalur: '2' });
    expect(awal[2]).toMatchObject({ status: 'PERSIAPAN', jalur: '-' });
    // Menit dibulatkan ke kelipatan 5.
    for (const b of awal) expect(Number(b.jam.slice(3)) % 5).toBe(0);
    // Keadaan berubah: jam jadwal tetap, status berganti.
    daftar[0] = bus(1, 'keHalteBerangkat', { halte: 0 });
    daftar[2] = bus(3, 'keluar', { halte: -1 });
    const kemudian = j.perbarui(daftar, 10.1);
    expect(kemudian.find((b) => b.busId === 1)?.jam).toBe(awal.find((b) => b.busId === 1)?.jam);
    expect(kemudian.find((b) => b.busId === 1)?.status).toBe('SIAP');
    expect(kemudian.find((b) => b.busId === 3)?.status).toBe('BERANGKAT');
  });

  it('bus yang belum juga memuat lewat jam jadwalnya ditandai TERLAMBAT; bus hilang dihapus dari jadwal', () => {
    const j = new JadwalKeberangkatan();
    const b = bus(7, 'parkir', { cuci: 1, istirahat: 1 });
    j.perbarui([b], 8);
    expect(j.perbarui([b], 9)[0]?.status).toBe('TERLAMBAT');
    expect(j.perbarui([{ ...b, fase: 'muat', halte: 2 } as BusVisual], 9)[0]?.status).toBe('NAIK');
    expect(j.perbarui([], 9)).toEqual([]);
  });
});

describe('pengantar', () => {
  it('rute pulang dari tiap gerbang tidak menembus blok kursi atau tali labirin, dan berakhir di trotoar luar pagar', () => {
    for (const g of GERBANG_X) {
      const rute = rutePulangPengantar(g, 1);
      for (const [a, b] of ruas(rute, false)) {
        for (let u = 0.02; u < 1; u += 0.04) expect(menembusKursi(a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u)).toBe(false);
        for (const [x0, y0, x1, y1] of TALI_LABIRIN) expect(ruasBerpotongan(a, b, [x0, y0], [x1, y1])).toBe(false);
      }
      expect(rute[rute.length - 1]![1]).toBeGreaterThan(Y_PAGAR);
    }
  });

  it('berhenti di dalam ruang tunggu di samping gerbang, melambai, lalu pulang dan hilang', () => {
    const dunia = new DuniaVisual({ acak: acakBerbenih(111) });
    const r = new Rombongan();
    const dt = 1 / 30;
    const galat: string[] = [];
    const pernahMelambai = new Set<number>();
    const pulang = new Set<number>();
    const terlihat = new Set<number>();
    for (let t = 0; t < 360; t += dt) {
      dunia.perbarui(dt, { ...SEIMBANG, naik: 1.2 });
      r.perbarui(dunia.orang, dt, dunia.bus);
      const ada = new Set<number>();
      for (const f of r.pengikut) {
        if (f.peran !== 'pengantar') continue;
        ada.add(f.id);
        terlihat.add(f.id);
        // Tidak pernah keluar gerbang ke peron keberangkatan.
        if (f.x > RUANG_TUNGGU.x0 && f.x < RUANG_TUNGGU.x1 && f.y < RUANG_TUNGGU.y0) galat.push(`pengantar ${f.id} masuk peron`);
        if (f.lambai) {
          pernahMelambai.add(f.id);
          if (f.y < RUANG_TUNGGU.y0 || f.y > RUANG_TUNGGU.y0 + 0.8) galat.push(`pengantar ${f.id} melambai jauh dari gerbang`);
        }
      }
      for (const id of pernahMelambai) if (!ada.has(id)) pulang.add(id);
    }
    expect(galat.slice(0, 5)).toEqual([]);
    expect(terlihat.size).toBeGreaterThan(3);
    expect(pernahMelambai.size).toBeGreaterThan(0);
    // Sebagian sudah selesai pulang (hilang) dalam 6 menit.
    expect(pulang.size).toBeGreaterThan(0);
  }, 60_000);
});

describe('loket malam', () => {
  it('pembeli hanya dilayani di jendela loket yang buka', () => {
    const dunia = new DuniaVisual({ acak: acakBerbenih(121) });
    const buka = loketBuka(1);
    const dipakai = new Set<number>();
    for (let t = 0; t < 150; t += 1 / 30) {
      dunia.perbarui(1 / 30, { ...SEIMBANG, loketBuka: buka });
      for (const o of dunia.orang) if (o.fase === 'beliTiket') dipakai.add(o.loket);
    }
    expect(dipakai.size).toBeGreaterThan(0);
    for (const i of dipakai) expect(buka).toContain(i);
  }, 30_000);
});

describe('pangkalan ojek & ojol', () => {
  it('ojek menunggu sepanjang hari (satu berjaga di malam hari); ojol mengikuti keramaian', () => {
    expect(LuarTerminal.jumlah(12, 1)).toEqual({ ojek: MOTOR_OJEK.length, ojol: MOTOR_OJOL.length });
    expect(LuarTerminal.jumlah(2, 0.1).ojek).toBe(1);
    expect(LuarTerminal.jumlah(2, 0.1).ojol).toBeLessThan(MOTOR_OJOL.length);
    // Motor menunggu di luar pagar, di sisi gang (bukan di jalan paving gang).
    for (const [x, y] of [...MOTOR_OJEK, ...MOTOR_OJOL]) {
      expect(y).toBeGreaterThan(Y_PAGAR + 0.2);
      const jarakGerbang = Math.min(Math.abs(x - GERBANG_MASUK_X), Math.abs(x - GERBANG_KELUAR_X));
      expect(jarakGerbang).toBeGreaterThan(LEBAR_GERBANG_PAGAR / 2 + 0.1);
      expect(jarakGerbang).toBeLessThan(1.05);
    }
  });
});
