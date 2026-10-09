import { describe, expect, it } from 'vitest';
import { PencatatAnalitik, peristiwaAksi, type Analitik, type DataAnalitik } from '../src/app/analitik';
import { PengendaliGame } from '../src/app/pengendali';
import { terapkanAksi, type Aksi } from '../src/sim/aksi';
import { buatStateBaru, type GameState } from '../src/sim/state';
import { stateOtomatis, T0 } from './helpers';

const kaya = (): GameState => ({ ...buatStateBaru(T0), kas: 1e12 });

function rekam(): { analitik: Analitik; catatan: { nama: string; data?: DataAnalitik }[] } {
  const catatan: { nama: string; data?: DataAnalitik }[] = [];
  return { analitik: { catat: (nama, data) => catatan.push(data ? { nama, data } : { nama }) }, catatan };
}

const terapkan = (s: GameState, aksi: Aksi): { lama: GameState; baru: GameState } => ({ lama: s, baru: terapkanAksi(s, aksi) });

describe('analitik: aksi pemain → peristiwa', () => {
  it('aksi yang tidak berlaku (kas kurang) tidak menghasilkan peristiwa', () => {
    const s = { ...buatStateBaru(T0), kas: 0 };
    const { lama, baru } = terapkan(s, { jenis: 'bangun', bangunan: 'jendela' });
    expect(baru).toBe(lama);
    expect(peristiwaAksi({ jenis: 'bangun', bangunan: 'jendela' }, lama, baru)).toEqual([]);
  });

  it('bangun, bongkar, rekrut, berhentikan, modernisasi, dan mitra PO tercatat dengan datanya', () => {
    let s = kaya();
    const b = terapkan(s, { jenis: 'bangun', bangunan: 'kios' });
    expect(peristiwaAksi({ jenis: 'bangun', bangunan: 'kios' }, b.lama, b.baru)).toEqual([{ nama: 'bangun', data: { bangunan: 'kios', jumlah: 1 } }]);
    const x = terapkan(b.baru, { jenis: 'bongkar', bangunan: 'kios' });
    expect(peristiwaAksi({ jenis: 'bongkar', bangunan: 'kios' }, x.lama, x.baru)).toEqual([{ nama: 'bongkar', data: { bangunan: 'kios', jumlah: 0 } }]);
    const r = terapkan(s, { jenis: 'rekrut', petugas: 'peron' });
    expect(peristiwaAksi({ jenis: 'rekrut', petugas: 'peron' }, r.lama, r.baru)).toEqual([{ nama: 'rekrut', data: { petugas: 'peron', jumlah: 1 } }]);
    const h = terapkan(r.baru, { jenis: 'berhentikan', petugas: 'peron' });
    expect(peristiwaAksi({ jenis: 'berhentikan', petugas: 'peron' }, h.lama, h.baru)).toEqual([{ nama: 'berhentikan', data: { petugas: 'peron' } }]);
    const t = terapkan(s, { jenis: 'beliTeknologi', teknologi: 'mesinTiket' });
    expect(peristiwaAksi({ jenis: 'beliTeknologi', teknologi: 'mesinTiket' }, t.lama, t.baru)).toEqual([{ nama: 'beli_teknologi', data: { teknologi: 'mesinTiket' } }]);
    s = t.baru;
    const j = terapkan(s, { jenis: 'daftarPo', po: 'peuyeumKilat' });
    expect(peristiwaAksi({ jenis: 'daftarPo', po: 'peuyeumKilat' }, j.lama, j.baru)).toEqual([{ nama: 'daftar_po', data: { po: 'peuyeumKilat', jumlah: 2 } }]);
  });

  it('tarif: atur & saran dicatat tanpa nilainya, sekali per sesi per tarif', () => {
    const s = stateOtomatis({ jalur: 2, jendela: 3 });
    const a = terapkan(s, { jenis: 'aturTarif', tarif: 'parkir', nilai: 6000 });
    expect(peristiwaAksi({ jenis: 'aturTarif', tarif: 'parkir', nilai: 6000 }, a.lama, a.baru)).toEqual([{ nama: 'atur_tarif', data: { tarif: 'parkir' } }]);
    const { analitik, catatan } = rekam();
    const p = new PencatatAnalitik(analitik);
    let x = s;
    for (const nilai of [50_000, 60_000, 80_000]) {
      const baru = terapkanAksi(x, { jenis: 'aturTarif', tarif: 'retribusiBus', nilai });
      p.catatAksi({ jenis: 'aturTarif', tarif: 'retribusiBus', nilai }, x, baru);
      x = baru;
    }
    const baru = terapkanAksi(x, { jenis: 'aturTarif', tarif: 'parkir', nilai: 3000 });
    p.catatAksi({ jenis: 'aturTarif', tarif: 'parkir', nilai: 3000 }, x, baru);
    expect(catatan.map((c) => c.data?.['tarif'])).toEqual(['retribusiBus', 'parkir']);
  });

  it('pencatat: telolet sekali per sesi, peristiwa lain tidak disaring', () => {
    const { analitik, catatan } = rekam();
    const p = new PencatatAnalitik(analitik);
    for (let i = 0; i < 5; i++) {
      p.catat('telolet');
      p.catat('rekrut', { petugas: 'peron', jumlah: 1 });
    }
    expect(catatan.filter((c) => c.nama === 'telolet')).toHaveLength(1);
    expect(catatan.filter((c) => c.nama === 'rekrut')).toHaveLength(5);
  });

  it('pengendali memberi tahu pemantau hanya untuk aksi yang berlaku', () => {
    const pengendali = new PengendaliGame({ ...buatStateBaru(T0), kas: 0 });
    const aksi: string[] = [];
    pengendali.pantauAksi((a, lama, baru) => {
      expect(baru).not.toBe(lama);
      aksi.push(a.jenis);
    });
    pengendali.kirim({ jenis: 'bangun', bangunan: 'jendela' }); // kas kurang: tidak berlaku
    pengendali.kirim({ jenis: 'aturNamaTerminal', nama: 'Sukamaju' });
    expect(aksi).toEqual(['aturNamaTerminal']);
  });
});
