import { describe, expect, it } from 'vitest';
import { EKONOMI, SIMULASI } from '../src/config/economy.config';
import { WAKTU } from '../src/config/waktu.config';
import { biayaUnitBerikutnya, slotBangunan } from '../src/sim/bangunan';
import { majukanWaktu } from '../src/sim/loop';
import {
  acuanHarian,
  aturTarif,
  bangun,
  berhentikanPetugas,
  bisaBangun,
  bisaMulaiPerluasan,
  bisaRekrutPetugas,
  biayaBangunState,
  bongkar,
  buatStateBaru,
  cariPo,
  daftarPo,
  hadiahMenit,
  jendelaKosong,
  keuanganSekarang,
  klaimTarget,
  kurangPerpanjangPo,
  labaBuku,
  mulaiPerluasan,
  operasiState,
  pakaiSaranTarif,
  pengembalianBongkarState,
  perpanjangPo,
  poTujuanJendela,
  putusPo,
  rekrutPetugas,
  saranTarif,
  syaratDaftarPoKurang,
  tawaranKontrakPo,
  terapkanOffline,
  tick,
  type GameState,
} from '../src/sim/state';
import { tarifBawaan } from '../src/sim/tarif';
import { denganBangunan, denganLevelTerminal, denganNilaiKontrak, denganPetugas, denganPo, DT, jalankan, kaya, padaJam, stateOtomatis, T0 } from './helpers';

const T = EKONOMI.tycoon;
const JAM_MS = 3600 * 1000;
/** Detik main satu jam terminal. */
const JAM = WAKTU.detikPerJam;

describe('state awal', () => {
  it('modal awal, satu jalur & satu jendela loket untuk PO awal, tanpa petugas, tarif bawaan', () => {
    const s = buatStateBaru(T0);
    expect(s.kas).toBe(T.modalAwal);
    expect(s.terminal.bangunan).toEqual({ jalur: 1, jendela: 1, kursi: 1, kios: 0, toko: 0, toilet: 0, lahanParkir: 0, posRetribusi: 0 });
    expect(s.mitra.terdaftar.map((p) => [p.id, p.loket])).toEqual([['ondelOndel', 1]]);
    expect(s.terminal.petugas).toEqual([]);
    expect(s.terminal.tarif).toEqual(tarifBawaan());
    expect(s.harian.jenis).toBe('penumpang');
    expect(s.harian.target).toBeGreaterThan(0);
    // Jendela loket satu-satunya yang paling lambat (documents/13 bagian 4).
    expect(operasiState(s).bottleneck).toBe('loket');
  });
});

describe('tick: uang mengalir dari operasi', () => {
  it('fungsi murni: state masukan tidak berubah; dt ≤ 0 atau NaN tidak mengubah apa pun', () => {
    const s = stateOtomatis();
    const salinan = JSON.stringify(s);
    tick(s, DT);
    expect(JSON.stringify(s)).toBe(salinan);
    expect(tick(s, 0)).toBe(s);
    expect(tick(s, -1)).toBe(s);
    expect(tick(s, Number.NaN)).toBe(s);
  });

  it('kas bertambah sebesar laba × waktu, dicatat di buku hari ini & statistik', () => {
    const s = stateOtomatis({ posRetribusi: 1, lahanParkir: 1 });
    const keu = keuanganSekarang(s);
    const op = operasiState(s);
    const b = tick(s, DT);
    const dtJam = DT / JAM;
    expect(keu.laba).toBeGreaterThan(0);
    expect(b.kas).toBeCloseTo(s.kas + keu.laba * dtJam, 6);
    expect(b.keuangan.hariIni.pendapatan.sewaLoket).toBeCloseTo(keu.pendapatan.sewaLoket * dtJam, 6);
    expect(b.keuangan.hariIni.biaya.listrik).toBeCloseTo(keu.biaya.listrik * dtJam, 6);
    expect(b.keuangan.hariIni.penumpang).toBeCloseTo(op.arus * dtJam, 9);
    expect(b.statistik.totalPenumpang).toBeCloseTo(op.arus * dtJam, 9);
    expect(b.statistik.totalPendapatan).toBeCloseTo(keu.totalPendapatan * dtJam, 6);
    expect(b.perkembangan.xpTerminal).toBeCloseTo(op.arus * dtJam, 9);
    expect(labaBuku(b.keuangan.hariIni)).toBeCloseTo(keu.laba * dtJam, 6);
  });

  it('game baru: tanpa fasilitas operasi sedikit merugi (penumpang tidak membayar terminal); PO kedua membayar kontraknya di muka, pos retribusi membuat operasi berlaba', () => {
    const s = buatStateBaru(T0);
    const rugiSehari = -keuanganSekarang(s).laba * 24;
    expect(rugiSehari).toBeGreaterThan(0);
    expect(rugiSehari).toBeLessThan(T.modalAwal / 10);
    const po = daftarPo(s, 'peuyeumKilat');
    expect(po.kas).toBe(s.kas + tawaranKontrakPo(s, 'peuyeumKilat').nilai);
    const pos = bangun(po, 'posRetribusi');
    const b = jalankan(pos, JAM);
    expect(b.kas).toBeGreaterThan(pos.kas);
    expect(b.statistik.totalPenumpang).toBeGreaterThan(10);
  });

  it('malam berangsur sepi: arus jam 03.00 lebih sedikit dari jam sibuk, tapi tidak berhenti', () => {
    const s = stateOtomatis({ jalur: 3, jendela: 6 });
    const isi = denganPo(s, 'ondelOndel', { loket: 6 });
    const sibuk = operasiState(padaJam(isi, 7.25)).arus;
    const malam = operasiState(padaJam(isi, 3)).arus;
    expect(malam).toBeLessThan(sibuk);
    expect(malam).toBeGreaterThan(0);
  });

  it('boost iklan menggandakan pendapatan, biaya tetap', () => {
    const s = stateOtomatis();
    const boost = { ...s, hadiah: { ...s.hadiah, boostDetik: 100 } };
    const a = keuanganSekarang(s);
    const b = keuanganSekarang(boost);
    expect(b.totalPendapatan).toBeCloseTo(a.totalPendapatan * EKONOMI.hadiah.pengaliBoost, 6);
    expect(b.totalBiaya).toBeCloseTo(a.totalBiaya, 6);
  });
});

describe('bangun & bongkar', () => {
  it('bangun memotong kas sebesar biaya; jendela loket langsung disewa PO yang antreannya paling panjang', () => {
    const s = stateOtomatis();
    const biaya = biayaBangunState(s, 'jendela')!;
    expect(biaya).toBe(T.bangunan.jendela.biaya[0]);
    expect(poTujuanJendela(s)).toBe('ondelOndel');
    const b = bangun(s, 'jendela');
    expect(b.kas).toBe(s.kas - biaya);
    expect(b.terminal.bangunan.jendela).toBe(2);
    expect(cariPo(b, 'ondelOndel')!.loket).toBe(2);
    // Jendela berikutnya lebih mahal (pertumbuhan).
    expect(biayaBangunState(b, 'jendela')).toBeCloseTo(biaya * T.bangunan.jendela.pertumbuhan, 6);
  });

  it('jendela untuk PO tertentu; PO yang tidak terdaftar ditolak', () => {
    const s = denganPo(stateOtomatis(), 'peuyeumKilat', { loket: 1 });
    const b = bangun(s, 'jendela', 'peuyeumKilat');
    expect(cariPo(b, 'peuyeumKilat')!.loket).toBe(2);
    expect(cariPo(b, 'ondelOndel')!.loket).toBe(1);
    expect(bangun(s, 'jendela', 'kopiGayo')).toBe(s);
    expect(bisaBangun(s, 'kursi', 'peuyeumKilat')).toBe(false);
  });

  it('slot penuh atau kas kurang → tidak bisa; slot bertambah lewat perluasan', () => {
    const s = denganPo(stateOtomatis(), 'ondelOndel', { loket: slotBangunan('jendela', 0) });
    expect(biayaBangunState(s, 'jendela')).toBeNull();
    expect(bangun(s, 'jendela')).toBe(s);
    const miskin = { ...stateOtomatis(), kas: 1000 };
    expect(bisaBangun(miskin, 'jendela')).toBe(false);
    expect(bangun(miskin, 'jendela')).toBe(miskin);
    expect(biayaBangunState({ ...s, perkembangan: { ...s.perkembangan, perluasan: 1 } }, 'jendela')).not.toBeNull();
  });

  it('bongkar mengembalikan sebagian harga; jalur permanen; jendela hanya yang kosong; petugasnya ikut keluar', () => {
    const s = denganPetugas(stateOtomatis({ toilet: 1 }), ['petugasToilet', 'peron']);
    expect(pengembalianBongkarState(s, 'jalur')).toBeNull();
    expect(pengembalianBongkarState(s, 'jendela')).toBeNull();
    const kembali = pengembalianBongkarState(s, 'toilet')!;
    expect(kembali).toBe(Math.floor(biayaUnitBerikutnya('toilet', 0) * T.bongkar));
    const b = bongkar(s, 'toilet');
    expect(b.kas).toBe(s.kas + kembali);
    expect(b.terminal.bangunan.toilet).toBe(0);
    expect(b.terminal.petugas).toEqual(['peron']);
    // Jendela kosong setelah PO keluar boleh dibongkar.
    const duaPo = denganPo(stateOtomatis(), 'peuyeumKilat', { loket: 2 });
    const keluar = putusPo(duaPo, 'peuyeumKilat');
    expect(jendelaKosong(keluar)).toBe(2);
    expect(bongkar(keluar, 'jendela').terminal.bangunan.jendela).toBe(2);
  });

  it('membangun menambah progres tantangan "bangun"', () => {
    const s = kaya(stateOtomatis());
    const t = { ...s, tantangan: { minggu: 'x', selesaiMs: 0, penumpang: 0, daftar: [{ jenis: 'bangun' as const, target: 3, progres: 0, diklaim: false }] } };
    expect(bangun(t, 'kursi').tantangan.daftar[0]!.progres).toBe(1);
  });
});

describe('petugas', () => {
  it('rekrut tanpa biaya sekali bayar, dibatasi bangunan; gajinya masuk biaya per jam', () => {
    const s = stateOtomatis();
    const b = rekrutPetugas(s, 'peron');
    expect(b.kas).toBe(s.kas);
    expect(b.terminal.petugas).toEqual(['peron']);
    // Satu petugas peron per halte kedatangan.
    expect(bisaRekrutPetugas(b, 'peron')).toBe(false);
    expect(rekrutPetugas(b, 'peron')).toBe(b);
    expect(keuanganSekarang(b).biaya.gaji - keuanganSekarang(s).biaya.gaji).toBeCloseTo(T.gaji.peron / 24, 6);
    // Petugas peron menambah kapasitas halte.
    expect(operasiState(b).kapasitas.peron).toBeCloseTo(operasiState(s).kapasitas.peron * (1 + T.kapasitas.bonusPetugas), 6);
  });

  it('berhentikan yang paling akhir direkrut dari peran itu', () => {
    const s = denganPetugas(stateOtomatis({ jalur: 2 }), ['kebersihan', 'satpam', 'kebersihan']);
    expect(berhentikanPetugas(s, 'kebersihan').terminal.petugas).toEqual(['kebersihan', 'satpam']);
    expect(berhentikanPetugas(s, 'peron')).toBe(s);
  });

  it('kas tidak pernah minus: gaji tertunggak membuat petugas terakhir berhenti tiap jam terminal, manajer paling akhir', () => {
    const awal = denganPetugas(stateOtomatis({}, 0), ['manajerOperasional', 'peron', 'kebersihan', 'satpam']);
    // Tanpa sewa jendela loket, pendapatan tidak menutup gaji.
    const s = aturTarif(awal, 'sewaLoket', 0);
    expect(keuanganSekarang(s).laba).toBeLessThan(0);
    const b = jalankan(s, JAM * 1.05);
    expect(b.kas).toBe(0);
    expect(b.terminal.petugas).toEqual(['manajerOperasional', 'peron', 'kebersihan']);
    expect(b.keuangan.petugasBerhenti).toBe(1);
    const c = jalankan(b, JAM * 2);
    expect(c.terminal.petugas).toEqual(['manajerOperasional']);
    expect(c.kas).toBe(0);
  });
});

describe('tarif terminal', () => {
  it('dirapikan ke rentang & langkahnya; nilai sama → state sama', () => {
    const s = stateOtomatis();
    expect(aturTarif(s, 'retribusiBus', 24_400).terminal.tarif.retribusiBus).toBe(25_000);
    expect(aturTarif(s, 'retribusiBus', 999_999).terminal.tarif.retribusiBus).toBe(T.tarif.retribusiBus.maks);
    expect(aturTarif(s, 'parkir', -5).terminal.tarif.parkir).toBe(0);
    expect(aturTarif(s, 'retribusiBus', T.tarif.retribusiBus.bawaan)).toBe(s);
  });

  it('saran: laba sehari tidak lebih buruk dari tarif sekarang, dan mitra PO tetap mau memperpanjang', () => {
    const s = denganPo(stateOtomatis({ jalur: 2, jendela: 4, posRetribusi: 1 }), 'ondelOndel', { loket: 4 });
    for (const id of ['sewaLoket', 'retribusiBus'] as const) {
      const v = saranTarif(s, id);
      const tarif = { ...s.terminal.tarif, [id]: v };
      const saran = acuanHarian(s, EKONOMI, tarif);
      expect(saran.laba).toBeGreaterThanOrEqual(acuanHarian(s, EKONOMI, s.terminal.tarif).laba - 1);
      expect(saran.kepuasanMitraMin).toBeGreaterThanOrEqual(T.mitra.minimal);
    }
    // Sewa loket bisa dinaikkan selama mitra masih puas: saran di atas bawaan.
    expect(saranTarif(s, 'sewaLoket')).toBeGreaterThan(T.tarif.sewaLoket.bawaan);
    expect(pakaiSaranTarif(s, 'sewaLoket').terminal.tarif.sewaLoket).toBe(saranTarif(s, 'sewaLoket'));
  });

  it('saran tidak mengubah tarif yang tidak berpengaruh (lahan parkir belum dibangun)', () => {
    const s = aturTarif(stateOtomatis(), 'parkir', 7000);
    expect(saranTarif(s, 'parkir')).toBe(7000);
  });
});

describe('buku harian, rekor, target harian', () => {
  it('hari berganti: buku hari ini jadi kemarin, rekor & hari tanpa rugi dihitung, target baru', () => {
    const s = jalankan(padaJam(stateOtomatis(), 23.5, 1), JAM * 0.4);
    expect(s.keuangan.hariIni.hariKe).toBe(1);
    const b = jalankan(s, JAM * 0.2);
    expect(b.keuangan.hariIni.hariKe).toBe(2);
    expect(b.keuangan.kemarin?.hariKe).toBe(1);
    expect(b.keuangan.kemarin!.penumpang).toBeGreaterThan(0);
    expect(b.rekor.penumpangHarian).toBeCloseTo(b.keuangan.kemarin!.penumpang, 9);
    expect(b.keuangan.hariTanpaRugi).toBe(labaBuku(b.keuangan.kemarin!) >= 0 ? 1 : 0);
    expect(b.harian.hariKe).toBe(2);
    expect(b.harian.jenis).toBe('penumpang');
  });

  it('target laba: progres dari laba bersih & kontrak PO yang diterima; selesai → hadiah sekian menit laba', () => {
    const harian = { hariKe: 0, jenis: 'laba' as const, target: 50_000, progres: 0, diklaim: false, jumlahSelesai: 0 };
    const s = { ...stateOtomatis({ posRetribusi: 1, lahanParkir: 1 }), harian };
    const b = jalankan(s, JAM);
    expect(b.harian.progres).toBe(50_000);
    expect(b.harian.jumlahSelesai).toBe(1);
    expect(daftarPo({ ...stateOtomatis(), harian }, 'peuyeumKilat').harian.progres).toBe(50_000);
    const hadiah = hadiahMenit(b, EKONOMI.harian.hadiahMenit);
    expect(klaimTarget(b).kas).toBe(b.kas + hadiah);
    expect(klaimTarget(b, EKONOMI, true).kas).toBe(b.kas + 2 * hadiah);
    expect(klaimTarget(klaimTarget(b)).harian.diklaim).toBe(true);
  });

  it('hadiah "N menit laba" dari rata-rata sehari dengan tarif bawaan, ada batas bawahnya', () => {
    const s = stateOtomatis();
    expect(hadiahMenit(s, 10)).toBe(Math.floor(Math.max(acuanHarian(s).laba, EKONOMI.hadiah.minPerMenit) * 10));
    // Tarif ekstrem tidak menggelembungkan hadiah.
    expect(hadiahMenit(aturTarif(s, 'sewaLoket', T.tarif.sewaLoket.maks), 10)).toBe(hadiahMenit(s, 10));
    const rugi = denganPetugas(stateOtomatis({ jalur: 3 }), ['manajerOperasional', 'manajerKemitraan', 'satpam', 'satpam', 'kebersihan', 'kebersihan']);
    expect(acuanHarian(rugi).laba).toBeLessThan(EKONOMI.hadiah.minPerMenit);
    expect(hadiahMenit(rugi, 3)).toBe(EKONOMI.hadiah.minPerMenit * 3);
  });
});

describe('mitra PO', () => {
  it('daftar: gratis, PO membayar kontraknya di muka; jendela bawaannya dibangun PO sendiri di slot kosong', () => {
    const s = stateOtomatis();
    const b = daftarPo(s, 'peuyeumKilat');
    expect(b.kas).toBe(s.kas + tawaranKontrakPo(s, 'peuyeumKilat').nilai);
    expect(cariPo(b, 'peuyeumKilat')!.loket).toBe(EKONOMI.mitra.tingkat.lokal.loketBawaan);
    expect(b.terminal.bangunan.jendela).toBe(1 + EKONOMI.mitra.tingkat.lokal.loketBawaan);
  });

  it('jendela kosong dipakai lebih dulu; tanpa jendela kosong maupun slot, PO tidak bisa bergabung', () => {
    const duaPo = denganPo(stateOtomatis(), 'lumpiaKilat', { loket: 2 });
    const kosong = putusPo(duaPo, 'lumpiaKilat');
    const b = daftarPo(kosong, 'peuyeumKilat');
    expect(b.terminal.bangunan.jendela).toBe(kosong.terminal.bangunan.jendela);
    expect(jendelaKosong(b)).toBe(0);
    const penuh = denganPo(stateOtomatis(), 'ondelOndel', { loket: slotBangunan('jendela', 0) });
    expect(syaratDaftarPoKurang(penuh, 'peuyeumKilat')).toEqual({ jenis: 'jendela' });
  });

  it('sewa loket & retribusi yang terlalu mahal: PO baru menolak bergabung', () => {
    const s = aturTarif(aturTarif(stateOtomatis({ posRetribusi: 1 }), 'sewaLoket', T.tarif.sewaLoket.maks), 'retribusiBus', T.tarif.retribusiBus.maks);
    expect(syaratDaftarPoKurang(s, 'peuyeumKilat')?.jenis).toBe('mitra');
    expect(daftarPo(s, 'peuyeumKilat')).toBe(s);
  });

  it('kontrak habis: PO keluar dan jendelanya kosong; PO terakhir menerima tawaran perpanjangannya', () => {
    const duaPo = denganPo(stateOtomatis(), 'peuyeumKilat', { loket: 2 });
    const habis = { ...duaPo, mitra: { ...duaPo.mitra, terdaftar: duaPo.mitra.terdaftar.map((p) => (p.id === 'peuyeumKilat' ? { ...p, kontrakDetik: 0.05 } : p)) } };
    const b = tick(habis, DT);
    expect(cariPo(b, 'peuyeumKilat')).toBeUndefined();
    expect(b.mitra.riwayat.peuyeumKilat).toBeDefined();
    expect(jendelaKosong(b)).toBe(2);
    const satu = stateOtomatis();
    const sendiri = { ...satu, mitra: { ...satu.mitra, terdaftar: satu.mitra.terdaftar.map((p) => ({ ...p, kontrakDetik: 0.05 })) } };
    const tawaran = tawaranKontrakPo(sendiri, 'ondelOndel');
    const c = tick(sendiri, DT);
    expect(cariPo(c, 'ondelOndel')!.kontrakDetik).toBeGreaterThan(tawaran.hari * 1440 - 1);
    expect(c.keuangan.hariIni.pendapatan.kontrak).toBe(tawaran.nilai);
  });

  it('perpanjang selama kepuasan mitra cukup; sewa loket terlalu mahal → PO tidak menawarkan perpanjangan', () => {
    const s = stateOtomatis();
    const hampir = { ...s, mitra: { ...s.mitra, terdaftar: s.mitra.terdaftar.map((p) => ({ ...p, kontrakDetik: 1440 })) } };
    expect(kurangPerpanjangPo(hampir, 'ondelOndel')).toBeNull();
    const b = perpanjangPo(hampir, 'ondelOndel');
    expect(b.kas).toBe(hampir.kas + tawaranKontrakPo(hampir, 'ondelOndel').nilai);
    expect(cariPo(b, 'ondelOndel')!.kontrakDetik).toBeGreaterThan(cariPo(hampir, 'ondelOndel')!.kontrakDetik);
    const mahal = aturTarif(hampir, 'sewaLoket', T.tarif.sewaLoket.maks);
    expect(kurangPerpanjangPo(mahal, 'ondelOndel')).toBe('mitra');
    expect(perpanjangPo(mahal, 'ondelOndel')).toBe(mahal);
  });

  it('Manajer Kemitraan memperpanjang kontrak yang tinggal sehari & menyewakan jendela kosong', () => {
    const s = denganPo(denganPetugas(stateOtomatis(), ['manajerKemitraan']), 'peuyeumKilat', { loket: 1 });
    const hampir = { ...s, mitra: { ...s.mitra, terdaftar: s.mitra.terdaftar.map((p) => ({ ...p, kontrakDetik: 500 })) } };
    const b = tick(denganBangunan(hampir, { jendela: 4 }), DT);
    for (const p of b.mitra.terdaftar) expect(p.kontrakDetik).toBeGreaterThan(1440);
    expect(jendelaKosong(b)).toBe(0);
  });
});

describe('perluasan', () => {
  it('butuh level terminal & kas; proyek sehari terminal lalu slot bertambah dan gedungnya berbiaya', () => {
    const s = kaya(stateOtomatis());
    expect(bisaMulaiPerluasan(s)).toBe(false);
    const lv = denganLevelTerminal(s, EKONOMI.mitra.perluasan[0]!.level);
    expect(bisaMulaiPerluasan(lv)).toBe(true);
    const b = mulaiPerluasan(lv);
    expect(b.kas).toBe(lv.kas - EKONOMI.mitra.perluasan[0]!.biaya);
    expect(b.perkembangan.proyekDetik).toBe(EKONOMI.mitra.detikProyek);
    const c = tick(b, EKONOMI.mitra.detikProyek);
    expect(c.perkembangan.perluasan).toBe(1);
    expect(slotBangunan('jendela', c.perkembangan.perluasan)).toBeGreaterThan(slotBangunan('jendela', 0));
    expect(keuanganSekarang(c).biaya.gedung).toBeCloseTo(EKONOMI.mitra.perluasan[0]!.operasional / 24, 6);
  });
});

describe('offline', () => {
  const pergi = (s: GameState, jam: number) => terapkanOffline(s, s.waktuTerakhirMs + jam * JAM_MS);

  it('tanpa Manajer Operasional terminal tutup: tanpa pendapatan & biaya, tapi proyek perluasan tetap jalan', () => {
    const s = { ...stateOtomatis(), perkembangan: { xpTerminal: 0, perluasan: 0, proyekDetik: 1000 } };
    const { state, laporan } = pergi(s, 1);
    expect(laporan.tutup).toBe(true);
    expect(laporan.laba).toBe(0);
    expect(state.kas).toBe(s.kas);
    expect(state.perkembangan.perluasan).toBe(1);
    expect(state.waktuTerakhirMs).toBe(s.waktuTerakhirMs + JAM_MS);
  });

  it('dengan Manajer Operasional: (pendapatan + kontrak PO dirata-rata) × efisiensi − biaya penuh dari rata-rata sehari', () => {
    const s = denganNilaiKontrak(denganPetugas(stateOtomatis(), ['manajerOperasional']), 70_000_000);
    const { state, laporan } = pergi(s, 1);
    const a = acuanHarian(s, EKONOMI, s.terminal.tarif);
    const jam = 3600 / JAM;
    expect(a.kontrak).toBeCloseTo(70_000_000 / s.mitra.terdaftar[0]!.kontrakHari / 24, 6);
    expect(laporan.tutup).toBe(false);
    expect(laporan.detik).toBe(3600);
    expect(laporan.laba).toBeGreaterThan(0);
    expect(laporan.pendapatan).toBeCloseTo((a.pendapatan + a.kontrak) * T.offline.efisiensi * jam, 3);
    expect(laporan.biaya).toBeCloseTo(a.biaya * jam, 3);
    expect(state.kas).toBeCloseTo(s.kas + laporan.laba, 3);
    expect(state.perkembangan.xpTerminal).toBeCloseTo(a.arus * jam * T.offline.efisiensi, 3);
    expect(state.hadiah.bonusOffline).toBe(Math.floor(laporan.laba));
    // Kontrak tidak berkurang: hari terminal berhenti saat game ditutup.
    expect(state.mitra.terdaftar[0]!.kontrakDetik).toBe(s.mitra.terdaftar[0]!.kontrakDetik);
  });

  it('paling lama 8 jam; jam dimundurkan → 0', () => {
    const s = denganPetugas(stateOtomatis(), ['manajerOperasional']);
    const lama = pergi(s, 10).laporan;
    expect(lama.detik).toBe(T.offline.batasDetik);
    expect(lama.dibatasi).toBe(true);
    const mundur = terapkanOffline(s, s.waktuTerakhirMs - JAM_MS);
    expect(mundur.laporan.detik).toBe(0);
    expect(mundur.state.kas).toBe(s.kas);
  });

  it('tarif ekstrem tidak menggelembungkan pendapatan offline', () => {
    const s = denganPetugas(stateOtomatis(), ['manajerOperasional']);
    const mahal = aturTarif(s, 'sewaLoket', T.tarif.sewaLoket.maks);
    expect(pergi(mahal, 1).laporan.pendapatan).toBeLessThanOrEqual(pergi(s, 1).laporan.pendapatan + 1e-6);
  });

  it('rugi saat pergi: kas tidak minus, petugas berhenti satu per satu (manajer paling akhir)', () => {
    const s = aturTarif(denganPetugas(stateOtomatis({ jalur: 2 }, 1_000_000), ['manajerOperasional', 'kebersihan', 'kebersihan', 'satpam', 'satpam']), 'sewaLoket', 0);
    const { state, laporan } = pergi(s, 2);
    expect(laporan.laba).toBeLessThan(0);
    expect(state.kas).toBeGreaterThanOrEqual(0);
    expect(laporan.berhenti).toBeGreaterThan(0);
    expect(state.terminal.petugas.length).toBe(s.terminal.petugas.length - laporan.berhenti);
    expect(state.hadiah.bonusOffline).toBe(0);
  });
});

describe('fixed timestep (majukanWaktu)', () => {
  function jalankanDenganFrame(frameDetik: number[]): { state: GameState; tick: number } {
    let state = stateOtomatis();
    let akumulator = 0;
    let total = 0;
    for (const dt of frameDetik) {
      const h = majukanWaktu(state, akumulator, dt);
      state = h.state;
      akumulator = h.akumulatorDetik;
      total += h.jumlahTick;
    }
    return { state, tick: total };
  }

  it('hasil sama untuk frame rate berbeda', () => {
    const detik = 10;
    const fps60 = jalankanDenganFrame(Array(600).fill(1 / 60));
    const fps30 = jalankanDenganFrame(Array(300).fill(1 / 30));
    const fps7 = jalankanDenganFrame(Array(70).fill(1 / 7));
    const tidakRata: number[] = [];
    for (let sisa = detik, i = 0; sisa > 1e-9; i++) {
      const dt = Math.min(sisa, [0.013, 0.051, 0.2, 0.0337][i % 4]!);
      tidakRata.push(dt);
      sisa -= dt;
    }
    const acak = jalankanDenganFrame(tidakRata);

    const n = detik * SIMULASI.tickPerDetik;
    for (const h of [fps60, fps30, fps7, acak]) {
      expect(h.tick).toBe(n);
      expect(h.state.kas).toBeCloseTo(fps60.state.kas, 6);
    }
  });

  it('frame yang sangat panjang dibatasi maksKejarDetik', () => {
    const h = majukanWaktu(stateOtomatis(), 0, 30);
    expect(h.jumlahTick).toBe(SIMULASI.maksKejarDetik * SIMULASI.tickPerDetik);
  });

  it('dt negatif atau NaN diabaikan', () => {
    const s = stateOtomatis();
    expect(majukanWaktu(s, 0, -5).jumlahTick).toBe(0);
    expect(majukanWaktu(s, 0, Number.NaN).jumlahTick).toBe(0);
  });
});
