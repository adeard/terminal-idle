import Decimal from 'break_infinity.js';
import { describe, expect, it } from 'vitest';
import { cocokUntukTutorial, langkahBerikut, sasaranLangkah } from '../src/app/tutorial';
import { EKONOMI } from '../src/config/economy.config';
import { terapkanAksi, type Aksi } from '../src/sim/aksi';
import { buatStateBaru, poTujuanLoket, tahapBottleneck, type GameState } from '../src/sim/state';
import { TAHAP_IDS } from '../src/sim/tahap';
import { jalankan, stateOtomatis, T0 } from './helpers';

const baru = (): GameState => buatStateBaru(T0);
const lakukan = (s: GameState, ...aksi: Aksi[]): GameState => aksi.reduce((st, a) => terapkanAksi(st, a), s);
const kaya = (s: GameState): GameState => ({ ...s, uang: new Decimal(1e9) });

describe('tutorial terpandu', () => {
  it('dimulai hanya untuk game yang benar-benar baru, bukan save pemain lama', () => {
    expect(cocokUntukTutorial(baru())).toBe(true);
    // Terminal berjalan sendiri sejak awal: sudah ada penumpang tapi belum membeli apa pun = tetap baru.
    expect(cocokUntukTutorial(jalankan(baru(), 5))).toBe(true);
    expect(cocokUntukTutorial(stateOtomatis({ peron: 10, loket: 10, keberangkatan: 10 }))).toBe(false);
    expect(cocokUntukTutorial({ ...baru(), renovasi: { ...baru().renovasi, poin: new Decimal(1) } })).toBe(false);
    expect(cocokUntukTutorial({ ...baru(), renovasi: { ...baru().renovasi, jumlah: 1 } })).toBe(false);
  });

  it('langkah maju sendiri saat syaratnya terpenuhi: loket → PO kedua → Kepala → Jalur 2 → tamat', () => {
    let s = baru();
    expect(langkahBerikut(s)).toBe('upgrade');
    // Uang masuk tanpa diketuk; langkah upgrade menunggu pemain membeli.
    s = jalankan(s, 5);
    expect(s.statistik.totalPenumpang).toBeGreaterThan(0);
    expect(langkahBerikut(s)).toBe('upgrade');
    s = lakukan(kaya(s), { jenis: 'upgrade', tahap: 'loket' });
    expect(langkahBerikut(s)).toBe('po');
    s = lakukan(s, { jenis: 'daftarPo', po: 'peuyeumKilat' });
    expect(s.mitra.terdaftar).toHaveLength(2);
    expect(langkahBerikut(s)).toBe('kepala');
    s = lakukan(s, { jenis: 'rekrutKepala', tahap: 'peron' });
    expect(langkahBerikut(s)).toBe('jalur');
    s = lakukan(s, { jenis: 'bukaJalur' });
    expect(s.terminal.jalur).toBe(2);
    expect(langkahBerikut(s)).toBeNull();
  });

  it('urutan bebas: langkah yang terpenuhi lebih dulu tetap dihitung, yang ditampilkan langkah pertama yang belum', () => {
    // PO kedua langsung menyewa loket bawaannya: Loket naik level, langkah pertama ikut terpenuhi.
    expect(langkahBerikut(lakukan(kaya(baru()), { jenis: 'daftarPo', po: 'peuyeumKilat' }))).toBe('kepala');
    let s = lakukan(kaya(baru()), { jenis: 'rekrutKepala', tahap: 'peron' }, { jenis: 'bukaJalur' });
    expect(langkahBerikut(s)).toBe('upgrade');
    s = lakukan(s, { jenis: 'upgrade', tahap: 'peron' });
    expect(langkahBerikut(s)).toBe('po');
    s = lakukan(s, { jenis: 'daftarPo', po: 'lumpiaKilat' });
    expect(langkahBerikut(s)).toBeNull();
  });

  it('sasaran: tahap paling lambat (Loket: loket untuk PO tujuannya), PO termurah yang bisa didaftarkan, Kepala termurah, Jalur 2', () => {
    let s = baru();
    const up = sasaranLangkah('upgrade', s);
    expect(up.jenis === 'upgrade' && up.tahap).toBe(tahapBottleneck(s));
    // Di awal Loket yang paling lambat: tombolnya membangun loket untuk PO pertama.
    expect(up).toMatchObject({ jenis: 'upgrade', tahap: 'loket', po: s.mitra.terdaftar[0]!.id });
    expect(up.jenis === 'upgrade' && up.po).toBe(poTujuanLoket(s));
    expect(sasaranLangkah('upgrade', stateOtomatis({ peron: 1, loket: 50, keberangkatan: 50 }))).toMatchObject({ jenis: 'upgrade', tahap: 'peron', po: null });
    const po = sasaranLangkah('po', s);
    expect(po).toMatchObject({ jenis: 'po', po: 'peuyeumKilat' });
    expect(po.biaya.toNumber()).toBe(EKONOMI.mitra.po.peuyeumKilat.biayaDaftar);
    // PO yang sedang jeda (baru diputus) dilewati: berikutnya yang termurah.
    const jeda: GameState = { ...s, mitra: { ...s.mitra, jedaSampai: { peuyeumKilat: s.statistik.waktuMainDetik + 1000 } } };
    expect(sasaranLangkah('po', jeda)).toMatchObject({ jenis: 'po', po: 'lumpiaKilat' });
    const kepala = sasaranLangkah('kepala', s);
    const termurah = [...TAHAP_IDS].sort((a, b) => EKONOMI.tahap[a].biayaKepala - EKONOMI.tahap[b].biayaKepala)[0];
    expect(kepala.jenis === 'kepala' && kepala.tahap).toBe(termurah);
    s = lakukan(kaya(s), { jenis: 'rekrutKepala', tahap: termurah! });
    const berikut = sasaranLangkah('kepala', s);
    expect(berikut.jenis === 'kepala' && berikut.tahap).not.toBe(termurah);
    expect(sasaranLangkah('jalur', s)).toMatchObject({ jenis: 'jalur' });
    const j = sasaranLangkah('jalur', s);
    expect(j.jenis === 'jalur' && j.biaya.toNumber()).toBe(EKONOMI.jalur.biaya[0]);
  });
});
