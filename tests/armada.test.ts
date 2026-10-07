import Decimal from 'break_infinity.js';
import { describe, expect, it } from 'vitest';
import { peristiwaAksi } from '../src/app/analitik';
import { EKONOMI } from '../src/config/economy.config';
import { LIVERY_PO } from '../src/config/livery.config';
import { terapkanAksi } from '../src/sim/aksi';
import { EVENT_IDS, PO_IDS, type PoId } from '../src/sim/fitur';
import { biayaPerpanjang, jatahLoket, nilaiJurusan, sisaSetelahPerpanjang, tingkatPo, xpLoketBaru } from '../src/sim/mitra';
import {
  bangunLoket,
  biayaLoketBaru,
  biayaPerpanjangPo,
  bisaBangunLoket,
  bisaDaftarPo,
  bisaPerpanjangPo,
  bisaPutusPo,
  buatStateBaru,
  cariPo,
  daftarPo,
  DETIK_SEHARI,
  isiLoketKosong,
  kepuasanTerminal,
  levelPo,
  loketTerisi,
  nilaiPerPenumpangState,
  pendapatanPoPerDetik,
  perpanjangPo,
  poTujuanLoket,
  putusPo,
  syaratDaftarPoKurang,
  throughputState,
  tick,
  type GameState,
} from '../src/sim/state';
import { NAMA_PO } from '../src/ui/teks';
import { denganLevelTerminal, denganPo, jalankan, kaya, stateOtomatis, T0 } from './helpers';

const K = EKONOMI.mitra.kontrak;
const po = (s: GameState, id: PoId) => cariPo(s, id)!;
const ids = (s: GameState): PoId[] => s.mitra.terdaftar.map((p) => p.id);
const tanpaKepalaLoket = (s: GameState): GameState => ({
  ...s,
  terminal: { ...s.terminal, tahap: { ...s.terminal.tahap, loket: { ...s.terminal.tahap.loket, kepala: { direkrut: false } } } },
});
/** Kontrak PO tinggal sekian detik main. */
const sisaKontrak = (s: GameState, id: PoId, detik: number): GameState => ({
  ...s,
  mitra: { ...s.mitra, terdaftar: s.mitra.terdaftar.map((p) => (p.id === id ? { ...p, kontrakDetik: detik } : p)) },
});

describe('mitra PO: game baru', () => {
  it('PO awal menyewa satu loket; level Loket = loket milik terminal; tiket sama dengan rumus dasar', () => {
    const s = buatStateBaru(T0);
    expect(ids(s)).toEqual(['ondelOndel']);
    const p = po(s, 'ondelOndel');
    expect(p).toMatchObject({ loket: 1, rekorLoket: 1, xp: 0, harga: {}, kontrakDetik: K.hari * DETIK_SEHARI, reputasi: tingkatPo('ondelOndel').reputasiAwal });
    expect(s.terminal.tahap.loket.level).toBe(1);
    expect(s.terminal.loketKosong).toBe(0);
    expect(nilaiPerPenumpangState(s)).toBeCloseTo(EKONOMI.nilaiPerPenumpang * nilaiJurusan(0), 12);
  });

  it('data lengkap: tiap PO punya livery & nama, PO event cocok dengan eventnya', () => {
    for (const id of PO_IDS) {
      expect(LIVERY_PO[id].papan.length).toBeGreaterThan(0);
      expect(NAMA_PO[id].nama).toMatch(/^PO /);
      if (EKONOMI.mitra.po[id].sumber === 'hadiahEvent') expect(EVENT_IDS.some((e) => EKONOMI.event[e].po === id)).toBe(true);
    }
    for (const e of EVENT_IDS) expect(EKONOMI.mitra.po[EKONOMI.event[e].po].sumber).toBe('hadiahEvent');
  });
});

describe('mitra PO: mendaftarkan', () => {
  it('butuh uang & slot; langsung menyewa loket bawaannya (dibangun PO, gratis bagi pemain)', () => {
    const miskin = buatStateBaru(T0);
    expect(bisaDaftarPo(miskin, 'lumpiaKilat')).toBe(false);
    expect(daftarPo(miskin, 'lumpiaKilat')).toBe(miskin);
    const s = kaya(stateOtomatis());
    const t = daftarPo(s, 'lumpiaKilat');
    expect(ids(t)).toEqual(['ondelOndel', 'lumpiaKilat']);
    expect(po(t, 'lumpiaKilat').loket).toBe(tingkatPo('lumpiaKilat').loketBawaan);
    expect(t.terminal.tahap.loket.level).toBe(1 + tingkatPo('lumpiaKilat').loketBawaan);
    expect(t.uang.toNumber()).toBeCloseTo(s.uang.toNumber() - EKONOMI.mitra.po.lumpiaKilat.biayaDaftar, 0);
    expect(syaratDaftarPoKurang(t, 'lumpiaKilat')).toEqual({ jenis: 'terdaftar' });
    // Terminal Lv 1 hanya punya dua slot.
    expect(syaratDaftarPoKurang(t, 'peuyeumKilat')).toEqual({ jenis: 'slot' });
    expect(daftarPo(t, 'peuyeumKilat')).toBe(t);
  });

  it('loket kosong dipakai lebih dulu, sisanya diisi ke PO yang jatahnya masih ada', () => {
    let s = kaya(stateOtomatis());
    s = { ...s, terminal: { ...s.terminal, loketKosong: 3, tahap: { ...s.terminal.tahap, loket: { ...s.terminal.tahap.loket, level: 4 } } } };
    const t = daftarPo(s, 'lumpiaKilat');
    expect(t.terminal.tahap.loket.level).toBe(4); // tidak ada loket baru dibangun
    expect(t.terminal.loketKosong).toBe(0);
    expect(loketTerisi(t)).toBe(4);
  });

  it('syarat: kelas terminal, kepuasan untuk PO premium, hadiah event', () => {
    const s = kaya(stateOtomatis());
    expect(syaratDaftarPoKurang(s, 'apelBatu')).toEqual({ jenis: 'kelas', kelas: 1 });
    expect(syaratDaftarPoKurang(denganLevelTerminal(s, 10), 'apelBatu')).toBeNull();
    const tipeB = denganLevelTerminal(s, 10);
    expect(kepuasanTerminal(tipeB).nilai).toBeLessThan(EKONOMI.mitra.po.sultanGarasi.kepuasanMin!);
    expect(syaratDaftarPoKurang(tipeB, 'sultanGarasi')).toEqual({ jenis: 'kepuasan', min: EKONOMI.mitra.po.sultanGarasi.kepuasanMin });
    expect(syaratDaftarPoKurang(s, 'mudikCeria')).toEqual({ jenis: 'event' });
    const hadiah = { ...s, mitra: { ...s.mitra, hadiahEvent: ['mudikCeria' as const] } };
    expect(syaratDaftarPoKurang(hadiah, 'mudikCeria')).toBeNull();
    // PO hadiah gratis & kontrak pertamanya lebih panjang.
    const t = daftarPo({ ...hadiah, uang: new Decimal(0) }, 'mudikCeria');
    expect(po(t, 'mudikCeria').kontrakDetik).toBe(K.hariHadiah * DETIK_SEHARI);
  });
});

describe('mitra PO: loket', () => {
  it('bangun loket untuk PO: dibayar, jatahnya dibatasi level PO, XP hanya untuk loket di atas rekornya', () => {
    const s = kaya(stateOtomatis());
    const biaya = biayaLoketBaru(s);
    const t = bangunLoket(s, 'ondelOndel');
    expect(po(t, 'ondelOndel').loket).toBe(2);
    expect(t.terminal.tahap.loket.level).toBe(2);
    expect(t.uang.toNumber()).toBeCloseTo(s.uang.sub(biaya).toNumber(), 0);
    expect(po(t, 'ondelOndel').xp).toBeCloseTo(xpLoketBaru(1), 12);
    // Loket yang sudah pernah dimiliki (di bawah rekor) tidak memberi XP lagi.
    const turun = { ...t, mitra: { ...t.mitra, terdaftar: t.mitra.terdaftar.map((p) => ({ ...p, loket: 1, xp: 0 })) } };
    expect(po(bangunLoket(turun, 'ondelOndel'), 'ondelOndel').xp).toBe(0);
    // Jatah penuh: tidak bisa membangun lagi.
    const penuh = denganPo(s, 'ondelOndel', { loket: jatahLoket(1) });
    expect(bisaBangunLoket(penuh, 'ondelOndel')).toBe(false);
    expect(bangunLoket(penuh, 'ondelOndel')).toBe(penuh);
    expect(poTujuanLoket(penuh)).toBeNull();
  });

  it('tanpa PO dipilih (upgrade Loket): loket diberikan ke PO yang paling menguntungkan per kursi', () => {
    let s = kaya(stateOtomatis());
    s = denganPo(s, 'lumpiaKilat', { level: EKONOMI.mitra.levelJurusan[2]! });
    expect(poTujuanLoket(s)).toBe('lumpiaKilat'); // level lebih tinggi: nilai tiket & jurusan lebih banyak
    const t = terapkanAksi(s, { jenis: 'upgrade', tahap: 'loket' });
    expect(po(t, 'lumpiaKilat').loket).toBe(po(s, 'lumpiaKilat').loket + 1);
    expect(po(t, 'ondelOndel').loket).toBe(po(s, 'ondelOndel').loket);
  });

  it('isi loket kosong: gratis, tanpa XP, sebatas jatah', () => {
    let s = denganPo(stateOtomatis(), 'ondelOndel', { loket: jatahLoket(1) - 1 });
    s = { ...s, terminal: { ...s.terminal, loketKosong: 3, tahap: { ...s.terminal.tahap, loket: { ...s.terminal.tahap.loket, level: s.terminal.tahap.loket.level + 3 } } } };
    const t = isiLoketKosong(s, 'ondelOndel');
    expect(po(t, 'ondelOndel').loket).toBe(jatahLoket(1));
    expect(t.terminal.loketKosong).toBe(2);
    expect(po(t, 'ondelOndel').xp).toBe(po(s, 'ondelOndel').xp);
    expect(t.uang.eq(s.uang)).toBe(true);
    expect(t.terminal.tahap.loket.level).toBe(s.terminal.tahap.loket.level);
  });

  it('XP PO dari bus yang datang: terminal yang ramai menaikkan level PO lebih cepat', () => {
    const sepi = jalankan(stateOtomatis(), 60);
    const ramai = jalankan(stateOtomatis({ peron: 15, loket: 15, keberangkatan: 15 }), 60);
    expect(po(sepi, 'ondelOndel').xp).toBeGreaterThan(0);
    expect(po(ramai, 'ondelOndel').xp).toBeGreaterThan(po(sepi, 'ondelOndel').xp * 3);
    // Satu bus = penumpangPerBus penumpang PO itu.
    const s = stateOtomatis({ peron: 15, loket: 15, keberangkatan: 15 });
    const arus = throughputState(s, 'aktif');
    expect(po(tick(s, 1), 'ondelOndel').xp).toBeCloseTo(arus / EKONOMI.penumpangPerBus, 2);
  });
});

describe('mitra PO: kontrak', () => {
  it('putus: loket jadi kosong, reputasi −10 ke riwayat, masa jeda; PO terakhir tidak bisa diputus', () => {
    const s = daftarPo(kaya(stateOtomatis()), 'lumpiaKilat');
    const lumpia = po(s, 'lumpiaKilat');
    const t = putusPo(s, 'lumpiaKilat');
    expect(ids(t)).toEqual(['ondelOndel']);
    expect(t.terminal.loketKosong).toBe(lumpia.loket);
    expect(t.terminal.tahap.loket.level).toBe(s.terminal.tahap.loket.level);
    expect(t.mitra.riwayat.lumpiaKilat).toEqual({ xp: lumpia.xp, reputasi: lumpia.reputasi - K.penaltiReputasiPutus, rekorLoket: lumpia.rekorLoket, harga: lumpia.harga });
    expect(t.mitra.jedaSampai.lumpiaKilat).toBe(s.statistik.waktuMainDetik + K.jedaPutusHari * DETIK_SEHARI);
    expect(syaratDaftarPoKurang(t, 'lumpiaKilat')).toMatchObject({ jenis: 'jeda' });
    expect(bisaPutusPo(t, 'ondelOndel')).toBe(false);
    expect(putusPo(t, 'ondelOndel')).toBe(t);
    // Setelah jeda: boleh kembali, melanjutkan XP & reputasinya.
    const nanti = { ...t, statistik: { ...t.statistik, waktuMainDetik: t.mitra.jedaSampai.lumpiaKilat! } };
    const kembali = daftarPo(nanti, 'lumpiaKilat');
    expect(po(kembali, 'lumpiaKilat')).toMatchObject({ xp: lumpia.xp, reputasi: lumpia.reputasi - K.penaltiReputasiPutus });
    expect(kembali.mitra.riwayat.lumpiaKilat).toBeUndefined();
  });

  it('kontrak berkurang dengan waktu main; habis → PO keluar tanpa penalti; PO terakhir diperpanjang gratis', () => {
    // Tanpa Kepala Loket (yang memperpanjang otomatis).
    let s = tanpaKepalaLoket(daftarPo(kaya(stateOtomatis()), 'lumpiaKilat'));
    const awal = po(s, 'lumpiaKilat').kontrakDetik;
    expect(po(tick(s, 1), 'lumpiaKilat').kontrakDetik).toBeCloseTo(awal - 1, 9);
    s = sisaKontrak(s, 'lumpiaKilat', 0.5);
    const t = tick(s, 1);
    expect(ids(t)).toEqual(['ondelOndel']);
    expect(t.mitra.riwayat.lumpiaKilat?.reputasi).toBeCloseTo(po(s, 'lumpiaKilat').reputasi, 0);
    expect(t.mitra.jedaSampai.lumpiaKilat).toBeUndefined();
    expect(t.terminal.loketKosong).toBe(po(s, 'lumpiaKilat').loket);
    const terakhir = tick(sisaKontrak(tanpaKepalaLoket(stateOtomatis()), 'ondelOndel', 0.5), 1);
    expect(ids(terakhir)).toEqual(['ondelOndel']);
    expect(po(terakhir, 'ondelOndel').kontrakDetik).toBeCloseTo(K.hari * DETIK_SEHARI - 0.5, 6);
  });

  it('perpanjang: 10 menit pendapatan PO, sisa paling lama 14 hari; PO premium menolak bila kepuasan kurang', () => {
    const s = kaya(stateOtomatis({ peron: 10, loket: 10, keberangkatan: 10 }));
    expect(biayaPerpanjangPo(s, 'ondelOndel').eq(biayaPerpanjang(pendapatanPoPerDetik(s, 'ondelOndel')))).toBe(true);
    const t = perpanjangPo(s, 'ondelOndel');
    expect(po(t, 'ondelOndel').kontrakDetik).toBeCloseTo(sisaSetelahPerpanjang(K.hari) * DETIK_SEHARI, 6);
    expect(t.uang.toNumber()).toBeCloseTo(s.uang.sub(biayaPerpanjangPo(s, 'ondelOndel')).toNumber(), 0);
    const penuh = perpanjangPo(t, 'ondelOndel');
    expect(po(penuh, 'ondelOndel').kontrakDetik).toBeCloseTo(K.hariMaks * DETIK_SEHARI, 6);
    expect(bisaPerpanjangPo(penuh, 'ondelOndel')).toBe(false);
    // PO premium dengan syarat kepuasan.
    const premium = denganPo(denganLevelTerminal(s, 10), 'sultanGarasi');
    expect(kepuasanTerminal(premium).nilai).toBeLessThan(EKONOMI.mitra.po.sultanGarasi.kepuasanMin!);
    expect(bisaPerpanjangPo(premium, 'sultanGarasi')).toBe(false);
    expect(bisaPerpanjangPo({ ...s, uang: new Decimal(0) }, 'ondelOndel')).toBe(false);
  });

  it('Kepala Loket mengisi loket kosong dan memperpanjang kontrak yang tinggal sehari bila uang cukup', () => {
    let s = kaya(stateOtomatis({ loket: 3 }));
    s = { ...s, terminal: { ...s.terminal, loketKosong: 2, tahap: { ...s.terminal.tahap, loket: { ...s.terminal.tahap.loket, level: 5 } } } };
    s = sisaKontrak(s, 'ondelOndel', DETIK_SEHARI * 0.5);
    const t = tick(s, 0.1);
    expect(t.terminal.loketKosong).toBe(0);
    expect(po(t, 'ondelOndel').loket).toBe(5);
    expect(po(t, 'ondelOndel').kontrakDetik).toBeGreaterThan(DETIK_SEHARI * K.hari);
    expect(t.uang.lt(s.uang)).toBe(true);
    // Tanpa Kepala Loket tidak ada yang diurus otomatis.
    const u = tick(tanpaKepalaLoket(s), 0.1);
    expect(u.terminal.loketKosong).toBe(2);
    expect(po(u, 'ondelOndel').kontrakDetik).toBeLessThan(DETIK_SEHARI);
  });
});

describe('mitra PO: aksi & analitik', () => {
  it('aksi diteruskan ke sim dan tercatat', () => {
    const s = kaya(stateOtomatis());
    const daftar = { jenis: 'daftarPo', po: 'peuyeumKilat' } as const;
    const a = terapkanAksi(s, daftar);
    expect(ids(a)).toEqual(['ondelOndel', 'peuyeumKilat']);
    expect(peristiwaAksi(daftar, s, a)).toEqual([{ nama: 'daftar_po', data: { po: 'peuyeumKilat', jumlah: 2 } }]);
    const putus = { jenis: 'putusPo', po: 'peuyeumKilat' } as const;
    const b = terapkanAksi(a, putus);
    expect(ids(b)).toEqual(['ondelOndel']);
    expect(peristiwaAksi(putus, a, b)).toEqual([{ nama: 'putus_po', data: { po: 'peuyeumKilat' } }]);
    const perpanjang = { jenis: 'perpanjangPo', po: 'ondelOndel' } as const;
    const c = terapkanAksi(b, perpanjang);
    expect(po(c, 'ondelOndel').kontrakDetik).toBeGreaterThan(po(b, 'ondelOndel').kontrakDetik);
    expect(peristiwaAksi(perpanjang, b, c)).toEqual([{ nama: 'perpanjang_po', data: { po: 'ondelOndel' } }]);
    const isi = terapkanAksi(b, { jenis: 'isiLoketKosong' });
    expect(isi.terminal.loketKosong).toBe(0);
    expect(po(terapkanAksi(s, { jenis: 'bangunLoket', po: 'ondelOndel' }), 'ondelOndel').loket).toBe(2);
    expect(levelPo(po(s, 'ondelOndel'))).toBe(1);
  });
});
