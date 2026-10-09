import { describe, expect, it } from 'vitest';
import { EKONOMI, type TingkatPo } from '../src/config/economy.config';
import { CacheSel } from '../src/game/cache-sel';
import { JARI_LENGKUNG_RODA, panjangSisiBadan, pilihKelasBus, pusatRoda, TAMPIL_KELAS_BUS, tinggiSisiTegak, type Kotak } from '../src/game/kelas-bus';
import { BAGASI, BUS, PINTU_BUS } from '../src/game/tata-letak';
import { KELAS_BUS_IDS, type KelasBusId } from '../src/sim/fitur';
import { levelMinimalKelas } from '../src/sim/level-terminal';
import { kelasAktif } from '../src/sim/mitra';
import { kelasBusBeroperasi, tick } from '../src/sim/state';
import { buatModel } from '../src/ui/model';
import { denganLevelTerminal, denganPo, stateOtomatis } from './helpers';

const lv = EKONOMI.mitra.kelas;

describe('kelas bus (sim): dioperasikan mitra PO', () => {
  it('game baru: hanya ekonomi; kelas berikutnya terbuka seiring level PO (tiketnya lebih mahal, untuk PO)', () => {
    const s = stateOtomatis();
    expect(kelasBusBeroperasi(s)).toEqual(['ekonomi']);
    const patas = denganPo(s, 'ondelOndel', { level: lv.patas.levelPo });
    expect(kelasBusBeroperasi(patas)).toEqual(['ekonomi', 'patas']);
    expect(kelasBusBeroperasi(denganPo(s, 'ondelOndel', { level: lv.patas.levelPo - 1 }))).toEqual(['ekonomi']);
    expect(lv.patas.nilai).toBeGreaterThan(lv.ekonomi.nilai);
  });

  it('dibatasi tingkat PO: lokal sampai Eksekutif, regional sampai Sleeper, nasional & premium sampai Double Decker', () => {
    const batas: Record<TingkatPo, KelasBusId> = { lokal: 'eksekutif', regional: 'sleeper', nasional: 'tingkat', premium: 'tingkat' };
    for (const [tingkat, maks] of Object.entries(batas) as [TingkatPo, KelasBusId][]) {
      expect(KELAS_BUS_IDS[EKONOMI.mitra.tingkat[tingkat].kelasMaks - 1]).toBe(maks);
    }
    // Ondel-Ondel (lokal) di Lv 30, terminal Terpadu: tetap paling tinggi Eksekutif.
    expect(kelasAktif('ondelOndel', 30, 3)).toEqual(['ekonomi', 'patas', 'eksekutif']);
    expect(kelasAktif('bakpiaRasa', 30, 3)).toEqual(['ekonomi', 'patas', 'eksekutif', 'sleeper']);
    expect(kelasAktif('kecakLaju', 30, 3)).toEqual([...KELAS_BUS_IDS]);
  });

  it('kelas besar butuh kelas terminal: Sleeper di Tipe B, Double Decker di Tipe A', () => {
    let s = denganPo(stateOtomatis(), 'kecakLaju', { level: lv.tingkat.levelPo });
    expect(kelasBusBeroperasi(s)).toEqual(['ekonomi', 'patas', 'eksekutif']);
    s = denganLevelTerminal(s, levelMinimalKelas(EKONOMI.kelasBus.sleeper.kelasTerminal));
    expect(kelasBusBeroperasi(s)).toEqual(['ekonomi', 'patas', 'eksekutif', 'sleeper']);
    s = denganLevelTerminal(s, levelMinimalKelas(EKONOMI.kelasBus.tingkat.kelasTerminal));
    expect(kelasBusBeroperasi(s)).toEqual([...KELAS_BUS_IDS]);
    expect(tick(s, 0.1).pencapaian.tercapai).toContain('armadaLengkap');
  });

  it('PO tanpa loket tidak mengoperasikan kelasnya', () => {
    const s = denganPo(denganLevelTerminal(stateOtomatis(), 30), 'kecakLaju', { level: lv.tingkat.levelPo, loket: 0 });
    expect(kelasBusBeroperasi(s)).toEqual(['ekonomi']);
  });

  it('model: kelas bus di tab Terminal beserta syaratnya, dan kelas berikutnya di kartu PO', () => {
    const s = stateOtomatis();
    const m = buatModel(s);
    expect(m.terminal.kelasBus.find((k) => k.id === 'ekonomi')).toMatchObject({ beroperasi: true, levelPo: 1, tingkatMin: 'lokal', kelasTerminal: 0 });
    expect(m.terminal.kelasBus.find((k) => k.id === 'sleeper')).toMatchObject({ beroperasi: false, levelPo: lv.sleeper.levelPo, tingkatMin: 'regional', kelasTerminal: 1 });
    expect(m.terminal.kelasBus.find((k) => k.id === 'tingkat')).toMatchObject({ beroperasi: false, levelPo: lv.tingkat.levelPo, tingkatMin: 'nasional', kelasTerminal: 2 });
    expect(m.mitra.terdaftar[0]!.kelas).toEqual(['ekonomi']);
    expect(m.mitra.terdaftar[0]!.kelasBerikut).toEqual({ kelas: 'patas', level: lv.patas.levelPo, kurangKelas: null });
    // Lokal yang sudah sampai Eksekutif: tidak ada kelas berikutnya lagi.
    expect(buatModel(denganPo(s, 'ondelOndel', { level: lv.eksekutif.levelPo })).mitra.terdaftar[0]!.kelasBerikut).toBeNull();
    // Regional di Lv 10 tapi masih Tipe C: Sleeper menunggu kelas terminal.
    const regional = buatModel(denganPo(s, 'bakpiaRasa', { level: lv.sleeper.levelPo })).mitra.terdaftar.find((p) => p.id === 'bakpiaRasa')!;
    expect(regional.kelasBerikut).toEqual({ kelas: 'sleeper', level: lv.sleeper.levelPo, kurangKelas: 1 });
  });

  it('konfigurasi: nilai tiket & level PO naik tiap kelas, syarat kelas terminal tidak menurun', () => {
    for (let i = 1; i < KELAS_BUS_IDS.length; i++) {
      const a = KELAS_BUS_IDS[i - 1]!;
      const b = KELAS_BUS_IDS[i]!;
      expect(lv[b].nilai).toBeGreaterThan(lv[a].nilai);
      expect(lv[b].levelPo).toBeGreaterThan(lv[a].levelPo);
      expect(EKONOMI.kelasBus[b].kelasTerminal).toBeGreaterThanOrEqual(EKONOMI.kelasBus[a].kelasTerminal);
    }
    expect(lv.ekonomi).toEqual({ nilai: 1, levelPo: 1 });
    expect(EKONOMI.kelasBus.ekonomi.kelasTerminal).toBe(0);
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
