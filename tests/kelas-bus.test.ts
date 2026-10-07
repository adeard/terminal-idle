import Decimal from 'break_infinity.js';
import { describe, expect, it } from 'vitest';
import { peristiwaAksi } from '../src/app/analitik';
import { EKONOMI } from '../src/config/economy.config';
import { CacheSel } from '../src/game/cache-sel';
import { JARI_LENGKUNG_RODA, panjangSisiBadan, pilihKelasBus, pusatRoda, TAMPIL_KELAS_BUS, tinggiSisiTegak, type Kotak } from '../src/game/kelas-bus';
import { BAGASI, BUS, PINTU_BUS } from '../src/game/tata-letak';
import { terapkanAksi } from '../src/sim/aksi';
import { KELAS_BUS_IDS, type KelasBusId } from '../src/sim/fitur';
import { deserialisasi, serialisasi } from '../src/sim/save';
import {
  beliKelasBus,
  bisaBeliKelasBus,
  kelasBusBeroperasi,
  kelasBusBerikutnya,
  multKelasBus,
  naikKelas,
  nilaiPerPenumpangState,
  syaratKelasBusKurang,
  tick,
  type GameState,
} from '../src/sim/state';
import { buatModel } from '../src/ui/model';
import { stateOtomatis, T0 } from './helpers';

const kaya = (s: GameState, uang = 1e12): GameState => ({ ...s, uang: new Decimal(uang) });
const kelas = (s: GameState, jumlahReset: number): GameState => ({ ...s, prestige: { ...s.prestige, jumlahReset } });

describe('kelas bus (sim)', () => {
  it('game baru: hanya ekonomi yang beroperasi, tanpa bonus tiket', () => {
    const s = stateOtomatis();
    expect(kelasBusBeroperasi(s)).toEqual(['ekonomi']);
    expect(kelasBusBerikutnya(s)).toBe('patas');
    expect(multKelasBus(s)).toBe(1);
  });

  it('didatangkan berurutan; kelas besar butuh kelas terminal; uang dipotong, tiket naik', () => {
    let s = kaya(stateOtomatis());
    // Tidak bisa melompati urutan.
    expect(syaratKelasBusKurang(s, 'eksekutif')).toEqual({ jenis: 'sebelumnya', kelas: 'patas' });
    expect(beliKelasBus(s, 'eksekutif')).toBe(s);
    const tiketAwal = nilaiPerPenumpangState(s);
    const uangAwal = s.uang.toNumber();
    s = beliKelasBus(s, 'patas');
    expect(s.terminal.kelasBus.patas).toBe(true);
    expect(s.uang.toNumber()).toBeCloseTo(uangAwal - EKONOMI.kelasBus.patas.biaya, 0);
    expect(nilaiPerPenumpangState(s)).toBeCloseTo(tiketAwal * (1 + EKONOMI.kelasBus.patas.bonusTiket), 9);
    s = beliKelasBus(s, 'eksekutif');
    expect(s.terminal.kelasBus.eksekutif).toBe(true);
    // Sleeper butuh Tipe B, Double Decker butuh Tipe A.
    expect(syaratKelasBusKurang(s, 'sleeper')).toEqual({ jenis: 'terminal', kelas: EKONOMI.kelasBus.sleeper.kelasTerminal });
    expect(bisaBeliKelasBus(s, 'sleeper')).toBe(false);
    s = kelas(s, 1);
    expect(syaratKelasBusKurang(s, 'sleeper')).toBeNull();
    s = beliKelasBus(s, 'sleeper');
    expect(syaratKelasBusKurang(s, 'tingkat')).toEqual({ jenis: 'terminal', kelas: 2 });
    s = beliKelasBus(kelas(s, 2), 'tingkat');
    expect(kelasBusBeroperasi(s)).toEqual([...KELAS_BUS_IDS]);
    expect(kelasBusBerikutnya(s)).toBeNull();
    const totalBonus = KELAS_BUS_IDS.reduce((a, id) => a + EKONOMI.kelasBus[id].bonusTiket, 0);
    expect(multKelasBus(s)).toBeCloseTo(1 + totalBonus, 9);
    // Sudah beroperasi: tidak bisa dibeli lagi.
    expect(beliKelasBus(s, 'tingkat')).toBe(s);
    expect(tick(s, 0.1).pencapaian.tercapai).toContain('armadaLengkap');
  });

  it('uang kurang: tidak terjadi apa-apa', () => {
    const s = stateOtomatis({}, EKONOMI.kelasBus.patas.biaya - 1);
    expect(bisaBeliKelasBus(s, 'patas')).toBe(false);
    expect(beliKelasBus(s, 'patas')).toBe(s);
  });

  it('naik kelas terminal mengulang armada ke ekonomi', () => {
    let s = kaya(stateOtomatis());
    s = beliKelasBus(beliKelasBus(s, 'patas'), 'eksekutif');
    s = { ...s, statistik: { ...s.statistik, totalPendapatanRun: new Decimal(1e8) } };
    const baru = naikKelas(s);
    expect(baru.prestige.jumlahReset).toBe(1);
    expect(kelasBusBeroperasi(baru)).toEqual(['ekonomi']);
  });

  it('tersimpan; save lama tanpa blok kelas bus = ekonomi saja; ekonomi selalu beroperasi', () => {
    const s = beliKelasBus(kaya(stateOtomatis()), 'patas');
    const d = deserialisasi(serialisasi(s), T0);
    expect(d.terminal.kelasBus).toEqual(s.terminal.kelasBus);
    const mentah = JSON.parse(serialisasi(s)) as { terminal: Record<string, unknown> };
    delete mentah.terminal['kelasBus'];
    expect(kelasBusBeroperasi(deserialisasi(JSON.stringify(mentah), T0))).toEqual(['ekonomi']);
    mentah.terminal['kelasBus'] = { ekonomi: false, patas: true };
    expect(kelasBusBeroperasi(deserialisasi(JSON.stringify(mentah), T0))).toEqual(['ekonomi', 'patas']);
    mentah.terminal['kelasBus'] = { patas: 'ya' };
    expect(() => deserialisasi(JSON.stringify(mentah), T0)).toThrow();
  });

  it('aksi, analitik, dan model tab Armada', () => {
    const s = kaya(stateOtomatis());
    const baru = terapkanAksi(s, { jenis: 'beliKelasBus', kelas: 'patas' });
    expect(baru.terminal.kelasBus.patas).toBe(true);
    expect(peristiwaAksi({ jenis: 'beliKelasBus', kelas: 'patas' }, s, baru)).toEqual([{ nama: 'beli_kelas_bus', data: { kelas: 'patas' } }]);
    const m = buatModel(baru).armada;
    expect(m.jumlahKelasBus).toBe(2);
    expect(m.bonusKelasBus).toBeCloseTo(EKONOMI.kelasBus.patas.bonusTiket, 9);
    expect(m.kelasBus.find((k) => k.id === 'eksekutif')).toMatchObject({ beroperasi: false, bisa: true, kurang: null });
    expect(m.kelasBus.find((k) => k.id === 'sleeper')?.kurang).toEqual({ jenis: 'terminal', kelas: EKONOMI.kelasBus.sleeper.kelasTerminal });
    // Terminal sudah cukup tinggi: tinggal urutan kelas bus.
    expect(buatModel(kelas(baru, 1)).armada.kelasBus.find((k) => k.id === 'sleeper')?.kurang).toEqual({ jenis: 'sebelumnya', kelas: 'eksekutif' });
    // Popup naik kelas menyebut kelas bus yang terbuka di kelas terminal berikutnya.
    expect(buatModel(baru).kelas.kelasBusTerbuka).toEqual(KELAS_BUS_IDS.filter((id) => EKONOMI.kelasBus[id].kelasTerminal === 1));
  });

  it('konfigurasi: urut makin mahal, bonus positif, syarat kelas terminal tidak menurun', () => {
    for (let i = 1; i < KELAS_BUS_IDS.length; i++) {
      const a = EKONOMI.kelasBus[KELAS_BUS_IDS[i - 1]!];
      const b = EKONOMI.kelasBus[KELAS_BUS_IDS[i]!];
      expect(b.biaya).toBeGreaterThan(a.biaya);
      expect(b.bonusTiket).toBeGreaterThan(0);
      expect(b.kelasTerminal).toBeGreaterThanOrEqual(a.kelasTerminal);
    }
    expect(EKONOMI.kelasBus.ekonomi).toMatchObject({ biaya: 0, bonusTiket: 0, kelasTerminal: 0 });
  });
});

describe('kelas bus di adegan', () => {
  it('pilihKelasBus: hanya kelas yang beroperasi, kurang lebih sama rata', () => {
    const beroperasi: KelasBusId[] = ['ekonomi', 'patas', 'eksekutif'];
    const hitung = new Map<KelasBusId, number>();
    for (let id = 0; id < 3000; id++) {
      const k = pilihKelasBus(id, id % 40, beroperasi);
      expect(beroperasi).toContain(k);
      hitung.set(k, (hitung.get(k) ?? 0) + 1);
    }
    for (const k of beroperasi) expect(hitung.get(k)!).toBeGreaterThan(3000 / 3 - 200);
    expect(pilihKelasBus(7, 3, ['ekonomi'])).toBe('ekonomi');
  });

  const dalam = (k: Kotak, tinggi: number): boolean => k.x0 >= 0 && k.x1 <= BUS.panjang + 1e-9 && k.h0 >= 0 && k.h1 <= tinggiSisiTegak(tinggi) + 1e-9 && k.x0 < k.x1 && k.h0 < k.h1;
  const tumpang = (a: Kotak, b: Kotak): boolean => a.x0 < b.x1 && b.x0 < a.x1 && a.h0 < b.h1 && b.h0 < a.h1;

  it('panjang lintasan sisi badan: sisi tegak + lengkung atap', () => {
    const p = panjangSisiBadan();
    expect(p).toBeGreaterThan(1);
    expect(p).toBeLessThan(1.13);
  });

  for (const id of KELAS_BUS_IDS) {
    const t = TAMPIL_KELAS_BUS[id];
    it(`${id}: tata letak sisi cocok dengan pintu & bagasi 3D, jendela tidak menabrak roda`, () => {
      expect(t.tinggi).toBeGreaterThanOrEqual(0.8);
      expect(t.tinggiPintu).toBeLessThan(tinggiSisiTegak(t.tinggi));
      const l = t.lukis;
      if (!l) return;
      // Pintu tergambar tepat di lubang pintu 3D (berpusat di PINTU_BUS, lebar 0,2) dan setinggi lubangnya.
      expect((l.pintu.x0 + l.pintu.x1) / 2).toBeCloseTo(BUS.panjang / 2 + PINTU_BUS, 6);
      expect(l.pintu.x1 - l.pintu.x0).toBeCloseTo(0.2, 6);
      expect(l.pintu.h1).toBeCloseTo(0.03 + t.tinggiPintu, 2);
      // Bagasi tengah tepat di pintu bagasi 3D.
      const tengah = l.bagasi.find((b) => Math.abs((b.x0 + b.x1) / 2 - (BUS.panjang / 2 + BAGASI.a)) < 1e-6);
      expect(tengah).toBeDefined();
      for (const k of [...l.jendela, ...l.kacaDepan, ...l.bagasi, l.pintu, l.nama]) expect(dalam(k, t.tinggi)).toBe(true);
      // Jendela & area nama di atas lengkung roda, tidak menimpa pintu.
      const atasRoda = Math.max(...pusatRoda().map(([, h]) => h)) + JARI_LENGKUNG_RODA;
      for (const k of [...l.jendela, l.nama]) {
        expect(k.h0).toBeGreaterThan(atasRoda);
        expect(tumpang(k, l.pintu)).toBe(false);
      }
      // Bagasi di antara kedua roda.
      const [xBelakang, xDepan] = pusatRoda().map(([x]) => x);
      for (const b of l.bagasi) {
        expect(b.x0).toBeGreaterThan(xBelakang! + JARI_LENGKUNG_RODA);
        expect(b.x1).toBeLessThan(xDepan! - JARI_LENGKUNG_RODA);
      }
    });
  }
});

describe('CacheSel', () => {
  it('kunci yang sama berbagi slot; slot kosong dipakai dulu', () => {
    const c = new CacheSel(3);
    expect(c.pesan('a')).toEqual({ slot: 0, baru: true });
    expect(c.pesan('a')).toEqual({ slot: 0, baru: false });
    expect(c.pesan('b')).toEqual({ slot: 1, baru: true });
    expect(c.pemakaiDi(0)).toBe(2);
  });

  it('penuh: slot yang tidak dipakai & paling lama diganti; semua dipakai = null', () => {
    const c = new CacheSel(2);
    c.pesan('a');
    c.pesan('b');
    expect(c.pesan('c')).toBeNull();
    c.lepas(0);
    // 'a' tak dipakai lagi → slotnya diisi 'c'.
    expect(c.pesan('c')).toEqual({ slot: 0, baru: true });
    expect(c.kunciDi(0)).toBe('c');
    // 'b' dilepas lalu diminta lagi: masih tersimpan, tidak perlu dilukis ulang.
    c.lepas(1);
    expect(c.pesan('b')).toEqual({ slot: 1, baru: false });
  });

  it('LRU: dari slot tak terpakai, yang paling lama tidak dipakai yang diganti', () => {
    const c = new CacheSel(3);
    c.pesan('a');
    c.pesan('b');
    c.pesan('c');
    c.lepas(1); // b
    c.lepas(0); // a (lebih baru dilepas)
    expect(c.pesan('d')).toEqual({ slot: 1, baru: true });
    expect(c.pesan('e')).toEqual({ slot: 0, baru: true });
  });

  it('cari: kunci tersimpan yang cocok, dipilih dengan acak', () => {
    const c = new CacheSel(4);
    for (const k of ['eksekutif|b1', 'patas|b2', 'eksekutif|po:x']) c.pesan(k);
    expect(c.cari((k) => k.startsWith('eksekutif|'), 0)).toBe('eksekutif|b1');
    expect(c.cari((k) => k.startsWith('eksekutif|'), 0.99)).toBe('eksekutif|po:x');
    expect(c.cari((k) => k.startsWith('sleeper|'))).toBeNull();
  });
});
