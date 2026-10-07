import Decimal from 'break_infinity.js';
import { describe, expect, it } from 'vitest';
import { peristiwaAksi } from '../src/app/analitik';
import { EKONOMI } from '../src/config/economy.config';
import { LIVERY_PO } from '../src/config/livery.config';
import { terapkanAksi } from '../src/sim/aksi';
import { PO_IDS } from '../src/sim/fitur';
import { deserialisasi, serialisasi } from '../src/sim/save';
import {
  bisaKontrakPo,
  buatStateBaru,
  bukaJurusan,
  kontrakPo,
  multJurusan,
  multPo,
  naikKelas,
  nilaiPerPenumpangState,
  perbaruiArmada,
  poBergabung,
  tick,
  type GameState,
} from '../src/sim/state';
import { NAMA_PO } from '../src/ui/teks';
import { T0 } from './helpers';

const kaya = (s: GameState = buatStateBaru(T0)): GameState => ({ ...s, uang: new Decimal(1e12) });

describe('mitra PO', () => {
  it('game baru belum punya PO: harga tiket sama dengan rumus lama', () => {
    const s = buatStateBaru(T0);
    expect(s.armada.po).toEqual([]);
    expect(multPo(s)).toBe(1);
    expect(nilaiPerPenumpangState(s)).toBeCloseTo(EKONOMI.nilaiPerPenumpang * multJurusan(s), 12);
  });

  it('PO kota langsung bergabung saat jurusannya dibuka, dan menaikkan harga tiket', () => {
    let s = bukaJurusan(kaya());
    expect(poBergabung(s, 'lumpiaKilat')).toBe(true);
    s = tick(s, 0.1);
    expect(s.armada.po).toEqual(['lumpiaKilat']);
    expect(multPo(s)).toBeCloseTo(1 + EKONOMI.po.bonusTiket, 12);
    expect(nilaiPerPenumpangState(s)).toBeCloseTo(EKONOMI.nilaiPerPenumpang * multJurusan(s) * (1 + EKONOMI.po.bonusTiket), 12);
    // Tidak ada yang baru: state sama persis.
    expect(perbaruiArmada(s)).toBe(s);
  });

  it('kontrak PO: butuh uang, sekali saja, langsung bergabung', () => {
    const miskin = buatStateBaru(T0);
    expect(bisaKontrakPo(miskin, 'ondelOndel')).toBe(false);
    expect(kontrakPo(miskin, 'ondelOndel')).toBe(miskin);
    const s = kaya();
    const sy = EKONOMI.po.syarat.ondelOndel;
    const biaya = sy.jenis === 'kontrak' ? sy.biaya : 0;
    const t = kontrakPo(s, 'ondelOndel');
    expect(t.armada.po).toEqual(['ondelOndel']);
    expect(t.uang.toNumber()).toBeCloseTo(s.uang.toNumber() - biaya, 0);
    expect(kontrakPo(t, 'ondelOndel')).toBe(t);
    // PO kota tidak bisa dikontrak.
    expect(bisaKontrakPo(s, 'lumpiaKilat')).toBe(false);
    expect(terapkanAksi(s, { jenis: 'kontrakPo', po: 'teloletJaya' }).armada.po).toEqual(['teloletJaya']);
  });

  it('permanen: tetap bergabung setelah prestige walau jurusannya direset', () => {
    let s = tick(bukaJurusan(bukaJurusan(kaya())), 0.1);
    s = kontrakPo(s, 'ondelOndel');
    s = { ...s, statistik: { ...s.statistik, totalPendapatanRun: new Decimal(1e9) } };
    const p = naikKelas(s);
    expect(p.terminal.jurusanBuka).toBe(EKONOMI.jurusanAwal);
    // PO hadiah naik ke Tipe B ikut bergabung.
    expect(p.armada.po).toEqual(['lumpiaKilat', 'bakpiaRasa', 'ondelOndel', 'juaraKelas']);
    expect(perbaruiArmada(p)).toBe(p);
  });

  it('tersimpan: urutan bergabung dipertahankan, id tak dikenal diabaikan, save lama menyusul di tick pertama', () => {
    const s = kontrakPo(tick(bukaJurusan(kaya()), 0.1), 'ondelOndel');
    const dimuat = deserialisasi(serialisasi(s), T0);
    expect(dimuat.armada.po).toEqual(['lumpiaKilat', 'ondelOndel']);
    const mentah = JSON.parse(serialisasi(s)) as Record<string, unknown>;
    mentah['armada'] = { po: ['sultanGarasi', 'poDariMasaDepan', 'sultanGarasi'] };
    expect(deserialisasi(JSON.stringify(mentah), T0).armada.po).toEqual(['sultanGarasi']);
    delete mentah['armada'];
    const lama = deserialisasi(JSON.stringify(mentah), T0);
    expect(lama.armada.po).toEqual([]);
    expect(tick(lama, 0.1).armada.po).toEqual(['lumpiaKilat']);
  });

  it('data lengkap: tiap PO punya syarat, livery, nama; PO kota menunjuk jurusan yang ada & berbeda-beda', () => {
    const kota = new Set<number>();
    for (const id of PO_IDS) {
      const sy = EKONOMI.po.syarat[id];
      expect(LIVERY_PO[id].papan.length).toBeGreaterThan(0);
      expect(NAMA_PO[id].nama).toMatch(/^PO /);
      if (sy.jenis === 'jurusan') {
        expect(sy.ke).toBeGreaterThanOrEqual(EKONOMI.jurusanAwal);
        expect(sy.ke).toBeLessThan(EKONOMI.jurusan.length);
        expect(kota.has(sy.ke)).toBe(false);
        kota.add(sy.ke);
        expect(NAMA_PO[id].asal.toUpperCase()).toBe(EKONOMI.jurusan[sy.ke]!.nama);
      } else if (sy.jenis === 'kontrak') {
        expect(sy.biaya).toBeGreaterThan(0);
      } else if (sy.jenis === 'kelas') {
        expect(sy.kelas).toBeGreaterThanOrEqual(1);
      } else {
        expect(EKONOMI.event[sy.event].po).toBe(id);
      }
    }
  });

  it('analitik: kontrak PO tercatat', () => {
    const s = kaya();
    const aksi = { jenis: 'kontrakPo', po: 'peuyeumKilat' } as const;
    expect(peristiwaAksi(aksi, s, terapkanAksi(s, aksi))).toEqual([{ nama: 'kontrak_po', data: { po: 'peuyeumKilat' } }]);
  });
});
