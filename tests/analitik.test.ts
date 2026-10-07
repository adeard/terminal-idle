import Decimal from 'break_infinity.js';
import { describe, expect, it } from 'vitest';
import { PencatatAnalitik, peristiwaAksi, type Analitik, type DataAnalitik } from '../src/app/analitik';
import { PengendaliGame } from '../src/app/pengendali';
import { terapkanAksi, type Aksi } from '../src/sim/aksi';
import { buatStateBaru, type GameState } from '../src/sim/state';
import { T0 } from './helpers';

const kaya = (): GameState => ({ ...buatStateBaru(T0), uang: new Decimal(1e12) });

function rekam(): { analitik: Analitik; catatan: { nama: string; data?: DataAnalitik }[] } {
  const catatan: { nama: string; data?: DataAnalitik }[] = [];
  return { analitik: { catat: (nama, data) => catatan.push(data ? { nama, data } : { nama }) }, catatan };
}

const terapkan = (s: GameState, aksi: Aksi): { lama: GameState; baru: GameState } => ({ lama: s, baru: terapkanAksi(s, aksi) });

describe('analitik: aksi pemain → peristiwa', () => {
  it('aksi yang tidak berlaku (uang kurang) tidak menghasilkan peristiwa', () => {
    const s = { ...buatStateBaru(T0), uang: new Decimal(0) };
    const { lama, baru } = terapkan(s, { jenis: 'upgrade', tahap: 'loket' });
    expect(baru).toBe(lama);
    expect(peristiwaAksi({ jenis: 'upgrade', tahap: 'loket' }, lama, baru)).toEqual([]);
  });

  it('upgrade hanya dicatat di level tonggak (2, 5, 10, …), bukan tiap upgrade', () => {
    let s = kaya();
    const tercatat: number[] = [];
    for (let i = 0; i < 12; i++) {
      const { lama, baru } = terapkan(s, { jenis: 'upgrade', tahap: 'peron' });
      for (const p of peristiwaAksi({ jenis: 'upgrade', tahap: 'peron' }, lama, baru)) tercatat.push(p.data!['level'] as number);
      s = baru;
    }
    expect(tercatat).toEqual([2, 5, 10]);
  });

  it('Kepala, fasilitas pertama, dan mitra PO tercatat dengan datanya', () => {
    let s = kaya();
    const k = terapkan(s, { jenis: 'rekrutKepala', tahap: 'loket' });
    expect(peristiwaAksi({ jenis: 'rekrutKepala', tahap: 'loket' }, k.lama, k.baru)).toEqual([{ nama: 'rekrut_kepala', data: { tahap: 'loket', jumlah_kepala: 1 } }]);
    s = k.baru;
    const f = terapkan(s, { jenis: 'bangunFasilitas', fasilitas: 'kios' });
    expect(peristiwaAksi({ jenis: 'bangunFasilitas', fasilitas: 'kios' }, f.lama, f.baru)).toEqual([{ nama: 'bangun_fasilitas', data: { fasilitas: 'kios', level: 1 } }]);
    const f2 = terapkan(f.baru, { jenis: 'bangunFasilitas', fasilitas: 'kios' });
    expect(peristiwaAksi({ jenis: 'bangunFasilitas', fasilitas: 'kios' }, f2.lama, f2.baru)).toEqual([{ nama: 'bangun_fasilitas', data: { fasilitas: 'kios', level: 2 } }]);
    const f3 = terapkan(f2.baru, { jenis: 'bangunFasilitas', fasilitas: 'kios' });
    expect(peristiwaAksi({ jenis: 'bangunFasilitas', fasilitas: 'kios' }, f3.lama, f3.baru)).toEqual([]);
    const j = terapkan(s, { jenis: 'daftarPo', po: 'peuyeumKilat' });
    expect(peristiwaAksi({ jenis: 'daftarPo', po: 'peuyeumKilat' }, j.lama, j.baru)).toEqual([{ nama: 'daftar_po', data: { po: 'peuyeumKilat', jumlah: 2 } }]);
  });

  it('pencatat: telolet sekali per sesi, peristiwa lain tidak disaring', () => {
    const { analitik, catatan } = rekam();
    const p = new PencatatAnalitik(analitik);
    for (let i = 0; i < 5; i++) {
      p.catat('telolet');
      p.catat('rekrut_kepala', { tahap: 'peron', jumlah_kepala: 1 });
    }
    expect(catatan.filter((c) => c.nama === 'telolet')).toHaveLength(1);
    expect(catatan.filter((c) => c.nama === 'rekrut_kepala')).toHaveLength(5);
  });

  it('pengendali memberi tahu pemantau hanya untuk aksi yang berlaku', () => {
    const pengendali = new PengendaliGame({ ...buatStateBaru(T0), uang: new Decimal(0) });
    const aksi: string[] = [];
    pengendali.pantauAksi((a, lama, baru) => {
      expect(baru).not.toBe(lama);
      aksi.push(a.jenis);
    });
    pengendali.kirim({ jenis: 'upgrade', tahap: 'loket' }); // uang kurang: tidak berlaku
    pengendali.kirim({ jenis: 'aturNamaTerminal', nama: 'Sukamaju' });
    expect(aksi).toEqual(['aturNamaTerminal']);
  });
});
