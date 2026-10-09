import { describe, expect, it } from 'vitest';
import { peristiwaAksi } from '../src/app/analitik';
import { EKONOMI } from '../src/config/economy.config';
import { LIVERY_PO } from '../src/config/livery.config';
import { WAKTU } from '../src/config/waktu.config';
import { terapkanAksi } from '../src/sim/aksi';
import { EVENT_IDS, PO_IDS, type PoId } from '../src/sim/fitur';
import { tawaranKontrak, tingkatPo } from '../src/sim/mitra';
import {
  bisaDaftarPo,
  bisaPutusPo,
  buatStateBaru,
  cariPo,
  daftarPo,
  DETIK_SEHARI,
  jendelaKosong,
  kepuasanTerminal,
  kurangPerpanjangPo,
  operasiState,
  pengembalianPutus,
  perpanjangPo,
  putusPo,
  syaratDaftarPoKurang,
  tawaranKontrakPo,
  tick,
  type GameState,
} from '../src/sim/state';
import { NAMA_PO } from '../src/ui/teks';
import { denganLevelTerminal, denganPo, jalankan, kaya, stateOtomatis, T0 } from './helpers';

const K = EKONOMI.mitra.kontrak;
const po = (s: GameState, id: PoId) => cariPo(s, id)!;
const ids = (s: GameState): PoId[] => s.mitra.terdaftar.map((p) => p.id);
/** Kontrak PO tinggal sekian detik main. */
const sisaKontrak = (s: GameState, id: PoId, detik: number): GameState => ({
  ...s,
  mitra: { ...s.mitra, terdaftar: s.mitra.terdaftar.map((p) => (p.id === id ? { ...p, kontrakDetik: detik } : p)) },
});

describe('mitra PO: game baru', () => {
  it('PO awal menyewa satu-satunya jendela loket; kontrak pertamanya termasuk modal awal (nilai 0), reputasi dari tingkatnya', () => {
    const s = buatStateBaru(T0);
    const t = tawaranKontrak('ondelOndel', 0, 1, 0);
    expect(ids(s)).toEqual(['ondelOndel']);
    expect(po(s, 'ondelOndel')).toMatchObject({
      loket: 1,
      xp: 0,
      kontrakDetik: t.hari * DETIK_SEHARI,
      kontrakHari: t.hari,
      nilaiKontrak: 0,
      kontrakKe: 1,
      reputasi: tingkatPo('ondelOndel').reputasiAwal,
    });
    expect(jendelaKosong(s)).toBe(0);
  });

  it('data lengkap: tiap PO punya livery & nama, PO event cocok dengan eventnya', () => {
    for (const id of PO_IDS) {
      expect(LIVERY_PO[id].papan.length).toBeGreaterThan(0);
      expect(NAMA_PO[id].nama).toMatch(/^PO /);
      if (EKONOMI.mitra.po[id].sumber === 'hadiahEvent') expect(EVENT_IDS.some((e) => EKONOMI.event[e].po === id)).toBe(true);
    }
    for (const e of EVENT_IDS) expect(EKONOMI.mitra.po[EKONOMI.event[e].po].sumber).toBe('hadiahEvent');
  });

  it('tawaran kontrak bergabung: per hari makin mahal untuk PO yang lebih besar & terminal yang lebih tinggi kelasnya', () => {
    const s = stateOtomatis();
    const perHari = (x: GameState, id: PoId): number => tawaranKontrakPo(x, id).nilai / tawaranKontrakPo(x, id).hari;
    expect(perHari(s, 'peuyeumKilat')).toBeLessThan(perHari(s, 'bakpiaRasa'));
    expect(perHari(s, 'bakpiaRasa')).toBeLessThan(perHari(s, 'teloletJaya'));
    expect(perHari(denganLevelTerminal(s, 10), 'peuyeumKilat')).toBeGreaterThan(perHari(s, 'peuyeumKilat'));
  });
});

describe('mitra PO: mendaftarkan', () => {
  it('gratis: PO membayar kontrak pertamanya di muka; butuh slot; langsung menyewa jendela bawaannya', () => {
    const s = { ...stateOtomatis(), kas: 0 };
    expect(bisaDaftarPo(s, 'lumpiaKilat')).toBe(true);
    const tawaran = tawaranKontrakPo(s, 'lumpiaKilat');
    expect(tawaran.nilai).toBeGreaterThan(0);
    const t = daftarPo(s, 'lumpiaKilat');
    expect(ids(t)).toEqual(['ondelOndel', 'lumpiaKilat']);
    expect(po(t, 'lumpiaKilat')).toMatchObject({
      loket: tingkatPo('lumpiaKilat').loketBawaan,
      kontrakDetik: tawaran.hari * DETIK_SEHARI,
      kontrakHari: tawaran.hari,
      nilaiKontrak: tawaran.nilai,
      kontrakKe: 1,
    });
    expect(t.kas).toBe(tawaran.nilai);
    expect(t.keuangan.hariIni.pendapatan.kontrak).toBe(tawaran.nilai);
    expect(t.statistik.totalPendapatan).toBe(s.statistik.totalPendapatan + tawaran.nilai);
    expect(syaratDaftarPoKurang(t, 'lumpiaKilat')).toEqual({ jenis: 'terdaftar' });
    // Terminal Lv 1 hanya punya dua slot.
    expect(syaratDaftarPoKurang(t, 'peuyeumKilat')).toEqual({ jenis: 'slot' });
    expect(daftarPo(t, 'peuyeumKilat')).toBe(t);
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
    // Kontrak pertama PO hadiah lebih panjang.
    const t = daftarPo(hadiah, 'mudikCeria');
    expect(po(t, 'mudikCeria').kontrakDetik).toBe(K.hariHadiah * DETIK_SEHARI);
  });

  it('PO baru menambah pasar: jurusan baru, permintaan jam sibuk naik', () => {
    const s = kaya(stateOtomatis());
    const t = daftarPo(s, 'peuyeumKilat');
    expect(operasiState(t).permintaanPuncak).toBeGreaterThan(operasiState(s).permintaanPuncak);
  });
});

describe('mitra PO: XP & kontrak', () => {
  it('XP PO dari bus yang berangkat (penumpangPerBus penumpang PO itu = 1 XP)', () => {
    const s = denganPo(stateOtomatis({ jalur: 2, jendela: 3 }), 'ondelOndel', { loket: 3 });
    const arus = operasiState(s).po[0]!.arus;
    expect(po(tick(s, 1), 'ondelOndel').xp).toBeCloseTo((arus / WAKTU.detikPerJam) / EKONOMI.tycoon.kapasitas.penumpangPerBus, 9);
    const sepi = jalankan(stateOtomatis(), 60);
    const ramai = jalankan(s, 60);
    expect(po(ramai, 'ondelOndel').xp).toBeGreaterThan(po(sepi, 'ondelOndel').xp * 1.5);
  });

  it('putus: jendela jadi kosong, reputasi −10 ke riwayat, masa jeda; PO terakhir tidak bisa diputus', () => {
    const s = denganPo(kaya(stateOtomatis()), 'lumpiaKilat', { loket: 2, reputasi: 60 });
    const t = putusPo(s, 'lumpiaKilat');
    expect(ids(t)).toEqual(['ondelOndel']);
    expect(jendelaKosong(t)).toBe(2);
    expect(t.mitra.riwayat.lumpiaKilat).toMatchObject({ reputasi: 60 - K.penaltiReputasiPutus });
    expect(syaratDaftarPoKurang(t, 'lumpiaKilat')).toEqual({ jenis: 'jeda', sampaiDetik: K.jedaPutusHari * DETIK_SEHARI });
    expect(bisaPutusPo(t, 'ondelOndel')).toBe(false);
    expect(putusPo(t, 'ondelOndel')).toBe(t);
    // Daftar ulang melanjutkan XP & reputasi dari riwayat.
    const ulang = daftarPo({ ...t, statistik: { ...t.statistik, waktuMainDetik: K.jedaPutusHari * DETIK_SEHARI + 1 } }, 'lumpiaKilat');
    expect(po(ulang, 'lumpiaKilat').reputasi).toBe(60 - K.penaltiReputasiPutus);
  });

  it('putus: sisa nilai kontrak dikembalikan pro-rata (kompensasi), kas harus cukup', () => {
    const s = daftarPo(stateOtomatis(), 'lumpiaKilat');
    const p = po(s, 'lumpiaKilat');
    expect(pengembalianPutus(p)).toBe(p.nilaiKontrak);
    const separuh = sisaKontrak(s, 'lumpiaKilat', p.kontrakDetik / 2);
    const kembali = pengembalianPutus(po(separuh, 'lumpiaKilat'));
    expect(kembali).toBe(Math.round(p.nilaiKontrak / 2));
    const t = putusPo(separuh, 'lumpiaKilat');
    expect(ids(t)).toEqual(['ondelOndel']);
    expect(t.kas).toBe(separuh.kas - kembali);
    expect(t.keuangan.hariIni.biaya.kompensasi).toBe(kembali);
    expect(t.statistik.totalBiaya).toBe(separuh.statistik.totalBiaya + kembali);
    const kurang = { ...separuh, kas: kembali - 1 };
    expect(bisaPutusPo(kurang, 'lumpiaKilat')).toBe(false);
    expect(putusPo(kurang, 'lumpiaKilat')).toBe(kurang);
  });

  it('perpanjang: tawaran muncul saat sisa kontrak paling lama hariTawaran, dibayar di muka, menyambung sisa lama', () => {
    const s = stateOtomatis();
    expect(kurangPerpanjangPo(s, 'ondelOndel')).toBe('belum');
    expect(perpanjangPo(s, 'ondelOndel')).toBe(s);
    const sisa = K.hariTawaran * DETIK_SEHARI;
    const hampir = sisaKontrak(s, 'ondelOndel', sisa);
    expect(kurangPerpanjangPo(hampir, 'ondelOndel')).toBeNull();
    const tawaran = tawaranKontrakPo(hampir, 'ondelOndel');
    expect(tawaran).toEqual(tawaranKontrak('ondelOndel', 1, 1, 0));
    const t = perpanjangPo(hampir, 'ondelOndel');
    expect(t.kas).toBe(hampir.kas + tawaran.nilai);
    expect(t.keuangan.hariIni.pendapatan.kontrak).toBe(tawaran.nilai);
    expect(po(t, 'ondelOndel')).toMatchObject({ kontrakDetik: sisa + tawaran.hari * DETIK_SEHARI, kontrakHari: tawaran.hari, nilaiKontrak: tawaran.nilai, kontrakKe: 2 });
    expect(kurangPerpanjangPo(t, 'ondelOndel')).toBe('belum');
  });

  it('kontrak berkurang dengan waktu main; habis → PO keluar tanpa penalti', () => {
    const s = denganPo(stateOtomatis(), 'lumpiaKilat', { loket: 2 });
    const t = tick(s, 10);
    expect(po(t, 'lumpiaKilat').kontrakDetik).toBeCloseTo(po(s, 'lumpiaKilat').kontrakDetik - 10, 9);
    const habis = tick(sisaKontrak(s, 'lumpiaKilat', 0.05), 0.1);
    expect(ids(habis)).toEqual(['ondelOndel']);
    expect(habis.mitra.riwayat.lumpiaKilat?.reputasi).toBeCloseTo(po(s, 'lumpiaKilat').reputasi, 1);
    expect(habis.mitra.jedaSampai.lumpiaKilat).toBeUndefined();
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
    const hampir = sisaKontrak(b, 'ondelOndel', DETIK_SEHARI);
    const c = terapkanAksi(hampir, perpanjang);
    expect(po(c, 'ondelOndel').kontrakDetik).toBeGreaterThan(po(hampir, 'ondelOndel').kontrakDetik);
    expect(peristiwaAksi(perpanjang, hampir, c)).toEqual([{ nama: 'perpanjang_po', data: { po: 'ondelOndel' } }]);
    const isi = terapkanAksi(b, { jenis: 'isiJendelaKosong' });
    expect(jendelaKosong(isi)).toBe(0);
    expect(po(isi, 'ondelOndel').loket).toBe(1 + jendelaKosong(b));
    expect(po(terapkanAksi(s, { jenis: 'bangun', bangunan: 'jendela', po: 'ondelOndel' }), 'ondelOndel').loket).toBe(2);
    // Satu jendela kosong untuk PO tertentu.
    expect(po(terapkanAksi(b, { jenis: 'isiJendelaKosong', po: 'ondelOndel' }), 'ondelOndel').loket).toBe(2);
  });
});
