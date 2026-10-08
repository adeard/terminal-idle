import Decimal from 'break_infinity.js';
import { describe, expect, it } from 'vitest';
import { PengendaliGame } from '../src/app/pengendali';
import { EKONOMI } from '../src/config/economy.config';
import { terapkanAksi } from '../src/sim/aksi';
import { buatStateBaru, type GameState } from '../src/sim/state';
import { buatModel } from '../src/ui/model';
import { jalankan, padaJam, stateOtomatis, T0 } from './helpers';

describe('view model UI', () => {
  it('awal game: loket bottleneck, hanya upgrade peron yang terjangkau, terminal langsung berjalan', () => {
    const m = buatModel(buatStateBaru(T0));
    expect(m.tahap.loket.bottleneck).toBe(true);
    expect(m.tahap.peron.bottleneck).toBe(false);
    expect(m.tahap.peron.bisaUpgrade).toBe(true); // 20 ≥ 15
    expect(m.tahap.loket.bisaUpgrade).toBe(false); // 20 < 22
    expect(m.tahap.keberangkatan.bisaUpgrade).toBe(false);
    expect(m.tahap.peron.bisaRekrutKepala).toBe(false);
    expect(m.hud.arusAktif).toBe(0.8);
    expect(m.hud.arusPotensial).toBe(0.8);
    expect(m.hud.semuaOtomatis).toBe(false);
    expect(m.tahap.peron.kapasitasSetelahUpgrade).toBe(1.5);
  });

  it('kepuasan: tambahan penumpang dari kepuasan & keterisian kapasitas (malam lebih sepi)', () => {
    const s = buatStateBaru(T0);
    const pagi = buatModel(s);
    expect(pagi.hud.kepuasan.tambahanPenumpang).toBeCloseTo(EKONOMI.permintaan.perKepuasan * pagi.hud.kepuasan.nilai, 10);
    expect(pagi.hud.kepuasan.keterisian).toBe(1);
    const malam = buatModel(padaJam(s, 2));
    expect(malam.hud.kepuasan.keterisian).toBeGreaterThan(0);
    expect(malam.hud.kepuasan.keterisian).toBeLessThan(1);
    expect(malam.hud.arusAktif).toBeCloseTo(0.8 * malam.hud.kepuasan.keterisian, 10);
    expect(malam.hud.arusPotensial).toBe(0.8);
  });

  it('jam ramai: arus aktif = kapasitas; HUD menampilkan hasil hari ini, bukan laju per detik', () => {
    const s = stateOtomatis({ peron: 43, loket: 49, keberangkatan: 44 });
    const m = buatModel(s);
    expect(m.hud.semuaOtomatis).toBe(true);
    expect(m.hud.arusAktif).toBe(44);
    expect(m.hud.hariIni).toEqual({ pendapatan: 0, tiket: 0 });
    expect(m.tahap.peron.bottleneck).toBe(true);
    expect(m.tahap.peron.milestone).toEqual({ dari: 25, ke: 50, rasio: 18 / 25 });
    // 10 detik main: 440 penumpang membeli tiket Rp 5 (PO naik ke Lv 2 di tengah jalan: tiket x1,06).
    const nanti = buatModel(jalankan(s, 10));
    expect(nanti.hud.hariIni.tiket).toBe(440);
    expect(nanti.hud.hariIni.pendapatan).toBeGreaterThanOrEqual(440 * 5 - 1e-6);
    expect(nanti.hud.hariIni.pendapatan).toBeLessThan(440 * 5 * 1.06);
  });
});

describe('aksi & pengendali', () => {
  it('terapkanAksi meneruskan ke fungsi sim', () => {
    const s: GameState = { ...buatStateBaru(T0), uang: new Decimal(1000) };
    expect(terapkanAksi(s, { jenis: 'upgrade', tahap: 'loket' }).terminal.tahap.loket.level).toBe(2);
    expect(terapkanAksi(s, { jenis: 'rekrutKepala', tahap: 'loket' }).terminal.tahap.loket.kepala.direkrut).toBe(true);
  });

  it('pelanggan dipanggil saat berlangganan, saat tick, dan saat aksi berlaku saja', () => {
    const p = new PengendaliGame(stateOtomatis());
    const terlihat: number[] = [];
    const lepas = p.berlangganan((s) => terlihat.push(s.uang.toNumber()));
    expect(terlihat).toEqual([20]);

    p.majukan(0.05); // belum cukup untuk satu tick
    expect(terlihat).toHaveLength(1);
    p.majukan(0.05);
    expect(terlihat).toHaveLength(2);

    expect(p.kirim({ jenis: 'upgrade', tahap: 'keberangkatan' })).toBe(false); // uang kurang
    expect(terlihat).toHaveLength(2);
    expect(p.kirim({ jenis: 'upgrade', tahap: 'peron' })).toBe(true);
    expect(terlihat).toHaveLength(3);

    lepas();
    p.majukan(1);
    expect(terlihat).toHaveLength(3);
  });

  it('setel mengganti state dan mereset akumulator', () => {
    const p = new PengendaliGame(stateOtomatis());
    p.majukan(0.09);
    const baru = buatStateBaru(T0 + 1);
    p.setel(baru);
    expect(p.state).toBe(baru);
    p.majukan(0.05);
    expect(p.state).toBe(baru); // sisa 0.09 tadi tidak terbawa
  });
});

describe('view model pengelolaan terminal', () => {
  it('fasilitas, mitra PO, terminal, modernisasi, target, dan penghargaan tampil sesuai state', async () => {
    const { bangunFasilitas, beliTeknologi, daftarPo, tick } = await import('../src/sim/state');
    const { EKONOMI } = await import('../src/config/economy.config');
    let s: GameState = { ...stateOtomatis({ peron: 10, loket: 10, keberangkatan: 10 }), uang: new Decimal(1e7) };
    let m = buatModel(s);
    expect(m.fasilitas.every((f) => f.level === 0 && f.bisa)).toBe(true);
    expect(m.mitra.terdaftar.map((p) => p.id)).toEqual(['ondelOndel']);
    expect(m.mitra).toMatchObject({ slot: 2, slotBerikut: { level: 3, slot: 3 }, loketKosong: 0 });
    expect(m.mitra.tersedia.find((p) => p.id === 'peuyeumKilat')).toMatchObject({ bisa: true, kurang: null, levelRiwayat: null });
    expect(m.mitra.tersedia.find((p) => p.id === 'apelBatu')?.kurang).toEqual({ jenis: 'kelas', kelas: 1 });
    expect(m.mitra.tersedia.some((p) => p.id === 'ondelOndel')).toBe(false);
    // Di tiap golongan yang termurah dulu: PO kedua yang disarankan tutorial di paling atas.
    expect(m.mitra.tersedia[0]!.id).toBe('peuyeumKilat');
    const bisa = m.mitra.tersedia.filter((p) => p.kurang === null).map((p) => p.biaya.toNumber());
    expect(bisa).toEqual([...bisa].sort((a, b) => a - b));
    expect(m.terminal).toMatchObject({ level: 1, kelas: 0, slot: 2, levelKelasBerikut: 10 });
    expect(m.terminal.perluasan.berikut).toMatchObject({ tahap: 1, level: EKONOMI.mitra.perluasan[0]!.level, levelKurang: true, bisa: false });
    expect(m.terminal.renovasi).toMatchObject({ jumlah: 0, poin: 0, bisa: false, poinMin: EKONOMI.mitra.poinMinRenovasi });
    // 10 loket sudah melebihi jatah PO Lv 1: tidak ada PO yang bisa menerima loket baru.
    expect(m.tahap.loket.loket).toEqual({ tujuan: null, kosong: 0 });
    expect(m.teknologi.find((t) => t.id === 'eTiket')?.syaratKurang).toBe('mesinTiket');
    expect(m.target).toMatchObject({ jenis: 'upgrade', progres: 0, selesai: false });

    s = tick(daftarPo(beliTeknologi(bangunFasilitas(s, 'kios'), 'mesinTiket'), 'peuyeumKilat'), 0.1);
    m = buatModel(s);
    expect(m.fasilitas.find((f) => f.id === 'kios')?.level).toBe(1);
    expect(m.mitra.terdaftar.map((p) => p.id)).toEqual(['ondelOndel', 'peuyeumKilat']);
    expect(m.tahap.loket.loket).toEqual({ tujuan: 'peuyeumKilat', kosong: 0 });
    expect(m.teknologi.find((t) => t.id === 'mesinTiket')?.dimiliki).toBe(true);
    expect(m.teknologi.find((t) => t.id === 'eTiket')?.syaratKurang).toBeNull();
    // Kapasitas loket (loket disewa kedua PO) & kapasitas setelah upgrade ikut modernisasi.
    const loket = 10 + EKONOMI.mitra.tingkat.lokal.loketBawaan;
    expect(m.tahap.loket.level).toBe(loket);
    expect(m.tahap.loket.kapasitas).toBeCloseTo((0.8 + 0.45 * (loket - 1)) * EKONOMI.teknologi.mesinTiket.multKapasitas, 10);
    expect(m.tahap.loket.kapasitasSetelahUpgrade).toBeCloseTo((0.8 + 0.45 * loket) * EKONOMI.teknologi.mesinTiket.multKapasitas, 10);
    // Kepala + fasilitas pertama tercapai → hadiah siap diklaim (lencana tab).
    expect(m.pencapaian.filter((p) => p.tercapai).map((p) => p.id)).toEqual(expect.arrayContaining(['kepalaPertama', 'semuaOtomatis', 'fasilitasPertama']));
    expect(m.jumlahKlaim).toBe(m.pencapaian.filter((p) => p.tercapai && !p.diklaim).length);
  });
});
