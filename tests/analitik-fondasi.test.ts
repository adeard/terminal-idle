import { describe, expect, it } from 'vitest';
import { MAKS_GALAT_PER_SESI, PencatatAnalitik, pesanGalat, ringkasanSesi, ringkasGalat, type DataAnalitik } from '../src/app/analitik';
import { terapkanAksi } from '../src/sim/aksi';
import { bangun, levelTerminal } from '../src/sim/state';
import { jalankan, kaya, stateOtomatis } from './helpers';

const penampung = (): { catat(nama: string, data?: DataAnalitik): void; semua: { nama: string; data?: DataAnalitik }[] } => {
  const semua: { nama: string; data?: DataAnalitik }[] = [];
  return { semua, catat: (nama, data) => semua.push({ nama, ...(data ? { data } : {}) }) };
};

describe('laporan error (GA4 exception)', () => {
  it('pesan satu baris + berkas:baris, paling panjang 100 karakter', () => {
    expect(ringkasGalat('TypeError: x is undefined', 'https://bustation.games/assets/terminal3d-abc.js?v=2', 120)).toBe('TypeError: x is undefined @terminal3d-abc.js:120');
    expect(ringkasGalat('baris\n  kedua')).toBe('baris kedua');
    expect(ringkasGalat('')).toBe('Error');
    const panjang = ringkasGalat('x'.repeat(300));
    expect(panjang.length).toBe(100);
    expect(panjang.endsWith('…')).toBe(true);
  });

  it('pesan dari Error, string, dan nilai lain', () => {
    expect(pesanGalat(new RangeError('terlalu besar'))).toBe('RangeError: terlalu besar');
    expect(pesanGalat('gagal')).toBe('gagal');
    expect(pesanGalat({ kode: 3 })).toBe('{"kode":3}');
  });

  it('tiap pesan sekali per sesi, paling banyak MAKS_GALAT_PER_SESI', () => {
    const t = penampung();
    const a = new PencatatAnalitik(t);
    a.catatGalat('sama');
    a.catatGalat('sama');
    expect(t.semua).toEqual([{ nama: 'exception', data: { description: 'sama', fatal: false } }]);
    for (let i = 0; i < 50; i++) a.catatGalat(`beda ${i}`);
    expect(t.semua).toHaveLength(MAKS_GALAT_PER_SESI);
  });
});

describe('ringkasan sesi', () => {
  it('menghitung penumpang, lama main, pendapatan & laba (juta), bangunan, dan keadaan terminal', () => {
    const awal = kaya(stateOtomatis({ jendela: 3 }), 1e9);
    let akhir = bangun(awal, 'jalur');
    akhir = jalankan(akhir, 60 * 24);
    const r = ringkasanSesi(awal, akhir, 4, 75.4);
    expect(r).toMatchObject({ detik: 75, detik_main: 1440, bangun: 4, kelas: 0, level_terminal: levelTerminal(akhir), jalur: 2, jurusan: 1, po: 1, petugas: 0 });
    expect(r['penumpang']).toBeGreaterThan(0);
    expect(r['pendapatan_juta']).toBeGreaterThan(0);
    expect(r['laba_juta']).toBeLessThan(r['pendapatan_juta'] as number);
    expect(r['kas_juta']).toBeCloseTo(Math.round(akhir.kas / 1e5) / 10, 9);
    expect(r['kepuasan']).toBeGreaterThanOrEqual(0);
    expect(r['kepuasan']).toBeLessThanOrEqual(100);
    // Save lain dimuat di tengah sesi: selisih tidak pernah negatif.
    const mundur = ringkasanSesi(akhir, awal, 0, 1);
    expect(mundur['penumpang']).toBe(0);
    expect(mundur['detik_main']).toBe(0);
  });

  it('pencatat menghitung bangunan sejak ringkasan terakhir', () => {
    const t = penampung();
    const a = new PencatatAnalitik(t);
    const s = kaya(stateOtomatis());
    let x = s;
    for (let i = 0; i < 3; i++) {
      const baru = terapkanAksi(x, { jenis: 'bangun', bangunan: 'kursi' });
      a.catatAksi({ jenis: 'bangun', bangunan: 'kursi' }, x, baru);
      x = baru;
    }
    a.catatRingkasanSesi(s, x, 10);
    a.catatRingkasanSesi(x, x, 10);
    const ringkas = t.semua.filter((p) => p.nama === 'ringkasan_sesi');
    expect(ringkas.map((p) => p.data?.['bangun'])).toEqual([3, 0]);
  });
});
