import { describe, expect, it } from 'vitest';
import { peristiwaAksi } from '../src/app/analitik';
import {
  bacaPapan,
  bacaSaya,
  GalatPeringkat,
  idPublik,
  kirimanDari,
  mingguSebelum,
  mulaiMingguDariKunci,
  namaLayakPublik,
  PengirimSkor,
  peringkatBaris,
  SELANG_KIRIM_MS,
  skorMaksWajar,
  TENGGANG_MINGGU_MS,
  validasiKiriman,
  type ApiPeringkat,
  type KirimanSkor,
} from '../src/app/peringkat';
import { LayananPeringkat } from '../src/app/layanan-peringkat';
import { mingguWib } from '../src/sim/tantangan';
import { terapkanAksi } from '../src/sim/aksi';
import { tengahMalamWib } from '../src/sim/event';
import { deserialisasi, serialisasi } from '../src/sim/save';
import { aturIkutPeringkat, aturNamaTerminal, naikKelas, perbaruiTantangan, type GameState } from '../src/sim/state';
import Decimal from 'break_infinity.js';
import { jalankan, stateOtomatis } from './helpers';

const wib = (tahun: number, bulan: number, tanggal: number, jam = 12): number => tengahMalamWib(tahun, bulan, tanggal) + jam * 3_600_000;
const RABU = wib(2026, 9, 30);
const SENIN = tengahMalamWib(2026, 9, 28);

describe('papan peringkat: aturan bersama', () => {
  it('nama publik: kata kasar ditolak, nama biasa (termasuk yang memuat potongan kata) boleh', () => {
    for (const nama of ['Sukamaju', 'Pantai Indah', 'Pasuruan', 'Taipan Jaya', 'Gebang-2 St. Jo\'', 'Ñusantara Café', 'Asunaro', 'Bangsal']) expect(namaLayakPublik(nama), nama).toBe(true);
    for (const nama of ['Anjing Laut', 'K0NT0L', 'kontolodon', 'Jancokers', 'B4ngs4t', 'Tai', 'Fuck Yeah', 'Terminal Babi', 'Ng ent ot']) expect(namaLayakPublik(nama), nama).toBe(false);
  });

  it('id publik: stabil, berbeda tiap akun, tidak memuat uid', () => {
    const a = idPublik('Xy12AbCdEfGhIjKlMnOpQrStUv01');
    expect(a).toBe(idPublik('Xy12AbCdEfGhIjKlMnOpQrStUv01'));
    expect(a).not.toBe(idPublik('Xy12AbCdEfGhIjKlMnOpQrStUv02'));
    expect(a).toMatch(/^[0-9a-z]{11}$/);
    expect(a).not.toContain('Xy12');
  });

  it('kunci minggu: awal minggu & minggu sebelumnya; kunci yang bukan Senin ditolak', () => {
    expect(mulaiMingguDariKunci('2026-09-28')).toBe(SENIN);
    expect(mulaiMingguDariKunci('2026-09-29')).toBeNull();
    expect(mulaiMingguDariKunci('28-09-2026')).toBeNull();
    expect(mingguSebelum('2026-09-28')).toBe('2026-09-21');
    expect(mingguSebelum('2026-01-05')).toBe('2025-12-29');
  });

  it('validasi kiriman: minggu ini (atau minggu lalu sebentar setelah berganti), nama dirapikan & disaring, skor dibulatkan', () => {
    const ok = validasiKiriman({ minggu: '2026-09-28', skor: 1234.9, kelas: 1, nama: ' Terminal  Sukamaju ' }, RABU);
    expect(ok).toEqual({ ok: true, kiriman: { minggu: '2026-09-28', skor: 1234, kelas: 1, nama: 'Sukamaju' } });
    const senin = tengahMalamWib(2026, 10, 5);
    expect(validasiKiriman({ minggu: '2026-09-28', skor: 1, kelas: 0, nama: 'A' }, senin + 60_000).ok).toBe(true);
    expect(validasiKiriman({ minggu: '2026-09-28', skor: 1, kelas: 0, nama: 'A' }, senin + TENGGANG_MINGGU_MS + 1)).toEqual({ ok: false, kode: 'minggu-lain' });
    expect(validasiKiriman({ minggu: '2026-10-05', skor: 1, kelas: 0, nama: 'A' }, RABU)).toEqual({ ok: false, kode: 'minggu-lain' });
    expect(validasiKiriman({ minggu: '2026-09-28', skor: 1, kelas: 0, nama: 'Terminal' }, RABU)).toEqual({ ok: false, kode: 'nama-kosong' });
    expect(validasiKiriman({ minggu: '2026-09-28', skor: 1, kelas: 0, nama: 'Anjing' }, RABU)).toEqual({ ok: false, kode: 'nama-ditolak' });
    for (const salah of [null, 'x', { minggu: '2026-09-28', skor: Number.NaN, kelas: 0, nama: 'A' }, { minggu: '2026-09-28', skor: -1, kelas: 0, nama: 'A' }, { minggu: '2026-09-28', skor: 1, kelas: 0.5, nama: 'A' }, { minggu: '2026-09-28', skor: 1, kelas: 0 }]) {
      expect(validasiKiriman(salah, RABU)).toEqual({ ok: false, kode: 'data-salah' });
    }
  });

  it('skor wajar maksimal tumbuh dengan waktu', () => {
    expect(skorMaksWajar(100, 0, 0)).toBe(1100);
    expect(skorMaksWajar(0, 0, 10_000)).toBeGreaterThan(1_000_000);
  });

  it('jawaban server dibaca & diperiksa bentuknya; peringkat tampilan untuk skor sama', () => {
    const papan = bacaPapan({ minggu: '2026-09-28', jumlah: 3, daftar: [{ id: 'a', nama: 'X', kelas: 0, skor: 5 }] });
    expect(papan.daftar[0]).toEqual({ id: 'a', nama: 'X', kelas: 0, skor: 5 });
    expect(() => bacaPapan({ minggu: '2026-09-28', jumlah: 3, daftar: [{ id: 'a', nama: 'X', kelas: '0', skor: 5 }] })).toThrow();
    expect(() => bacaPapan(null)).toThrow();
    expect(bacaSaya({ minggu: '2026-09-28', skor: null, peringkat: null, jumlah: 0 })).toEqual({ minggu: '2026-09-28', skor: null, peringkat: null, jumlah: 0 });
    const e = (skor: number) => ({ id: String(skor), nama: 'x', kelas: 0, skor });
    expect(peringkatBaris([e(9), e(7), e(7), e(3)])).toEqual([1, 2, 2, 4]);
  });
});

describe('papan peringkat di game', () => {
  const siap = (): GameState => perbaruiTantangan({ ...stateOtomatis({ peron: 20, loket: 20, keberangkatan: 20 }), uang: new Decimal(1e6) }, RABU);

  it('penumpang minggu ini dihitung dari main aktif, tetap walau naik kelas, mulai dari nol di minggu baru', () => {
    let s = jalankan(siap(), 30);
    expect(s.tantangan.penumpang).toBeGreaterThan(0);
    expect(s.tantangan.penumpang).toBeCloseTo(s.statistik.totalPenumpang, 6);
    const naik = naikKelas({ ...s, statistik: { ...s.statistik, totalPendapatanRun: new Decimal(1e8) } });
    expect(naik.tantangan.penumpang).toBe(s.tantangan.penumpang);
    s = perbaruiTantangan(s, RABU + 7 * 86_400_000);
    expect(s.tantangan.penumpang).toBe(0);
  });

  it('ikut papan: aksi, tersimpan, save lama = belum ikut, analitik tanpa nama', () => {
    const s = siap();
    expect(s.profil.ikutPeringkat).toBe(false);
    const ikut = terapkanAksi(s, { jenis: 'aturIkutPeringkat', ikut: true });
    expect(ikut.profil.ikutPeringkat).toBe(true);
    expect(aturIkutPeringkat(ikut, true)).toBe(ikut);
    expect(peristiwaAksi({ jenis: 'aturIkutPeringkat', ikut: true }, s, ikut)).toEqual([{ nama: 'peringkat_ikut' }]);
    expect(peristiwaAksi({ jenis: 'aturIkutPeringkat', ikut: false }, ikut, s)).toEqual([{ nama: 'peringkat_keluar' }]);
    const muat = deserialisasi(serialisasi(jalankan(ikut, 5)), RABU);
    expect(muat.profil.ikutPeringkat).toBe(true);
    expect(muat.tantangan.penumpang).toBeGreaterThan(0);
    const mentah = JSON.parse(serialisasi(ikut)) as { profil: Record<string, unknown>; tantangan: Record<string, unknown> };
    delete mentah.profil['ikutPeringkat'];
    delete mentah.tantangan['penumpang'];
    const lama = deserialisasi(JSON.stringify(mentah), RABU);
    expect(lama.profil.ikutPeringkat).toBe(false);
    expect(lama.tantangan.penumpang).toBe(0);
  });

  it('isi kiriman hanya ada kalau ikut & minggu sudah dimulai', () => {
    const s = aturNamaTerminal(siap(), 'Sukamaju');
    expect(kirimanDari(s)).toBeNull();
    const ikut = jalankan(aturIkutPeringkat(s, true), 10);
    expect(kirimanDari(ikut)).toEqual({ minggu: '2026-09-28', skor: Math.floor(ikut.tantangan.penumpang), kelas: 0, nama: 'Sukamaju' });
    expect(kirimanDari({ ...ikut, tantangan: { ...ikut.tantangan, minggu: null } })).toBeNull();
  });
});

describe('PengirimSkor', () => {
  const dasar = (): GameState => aturIkutPeringkat(aturNamaTerminal(perbaruiTantangan(stateOtomatis(), RABU), 'Sukamaju'), true);
  const denganSkor = (s: GameState, penumpang: number): GameState => ({ ...s, tantangan: { ...s.tantangan, penumpang } });
  const siapkan = (gagal?: (k: KirimanSkor) => GalatPeringkat | Error | null) => {
    let jam = RABU;
    const terkirim: KirimanSkor[] = [];
    let tunda: Promise<void> = Promise.resolve();
    const p = new PengirimSkor(
      (k) => {
        terkirim.push(k);
        const g = gagal?.(k) ?? null;
        tunda = g ? Promise.reject(g) : Promise.resolve();
        return tunda;
      },
      () => jam,
    );
    const selesai = async (): Promise<void> => {
      await tunda.catch(() => undefined);
      await new Promise((r) => setTimeout(r, 0));
    };
    return { p, terkirim, maju: (ms: number) => (jam += ms), selesai };
  };

  it('kirim segera saat ikut, lalu paling sering tiap selang; skor sama tidak dikirim ulang; dijeda = kirim segera', async () => {
    const { p, terkirim, maju, selesai } = siapkan();
    const s = dasar();
    p.periksa(denganSkor(s, 10));
    await selesai();
    expect(terkirim.map((k) => k.skor)).toEqual([10]);
    p.periksa(denganSkor(s, 10));
    maju(60_000);
    p.periksa(denganSkor(s, 20));
    await selesai();
    expect(terkirim).toHaveLength(1);
    maju(SELANG_KIRIM_MS);
    p.periksa(denganSkor(s, 20));
    await selesai();
    expect(terkirim.map((k) => k.skor)).toEqual([10, 20]);
    maju(30_000);
    p.periksa(denganSkor(s, 25), true);
    await selesai();
    expect(terkirim.map((k) => k.skor)).toEqual([10, 20, 25]);
  });

  it('ganti nama dikirim tanpa menunggu selang (tetap di atas batas server)', async () => {
    const { p, terkirim, maju, selesai } = siapkan();
    const s = denganSkor(dasar(), 10);
    p.periksa(s);
    await selesai();
    maju(5_000);
    p.periksa(aturNamaTerminal(s, 'Makmur'));
    await selesai();
    expect(terkirim).toHaveLength(1);
    maju(25_000);
    p.periksa(aturNamaTerminal(s, 'Makmur'));
    await selesai();
    expect(terkirim.map((k) => k.nama)).toEqual(['Sukamaju', 'Makmur']);
  });

  it('nama ditolak: berhenti sampai nama diganti; token tidak sah: berhenti sampai dimuat ulang', async () => {
    const ditolak = siapkan((k) => (k.nama === 'Sukamaju' ? new GalatPeringkat('nama-ditolak') : null));
    const s = denganSkor(dasar(), 10);
    ditolak.p.periksa(s);
    await ditolak.selesai();
    expect(ditolak.p.galat).toBe('nama-ditolak');
    ditolak.maju(SELANG_KIRIM_MS * 2);
    ditolak.p.periksa(denganSkor(s, 99));
    expect(ditolak.terkirim).toHaveLength(1);
    ditolak.p.periksa(aturNamaTerminal(s, 'Makmur'));
    await ditolak.selesai();
    expect(ditolak.terkirim.map((k) => k.nama)).toEqual(['Sukamaju', 'Makmur']);
    expect(ditolak.p.galat).toBeNull();

    const token = siapkan(() => new GalatPeringkat('token'));
    token.p.periksa(s);
    await token.selesai();
    token.maju(SELANG_KIRIM_MS * 5);
    token.p.periksa(aturNamaTerminal(denganSkor(s, 50), 'Lain'));
    expect(token.terkirim).toHaveLength(1);
    expect(token.p.galat).toBe('token');
  });

  it('gangguan jaringan dicoba lagi dengan jeda makin panjang; terlalu sering = tunggu sesuai server', async () => {
    let gagal = true;
    const j = siapkan(() => (gagal ? new Error('offline') : null));
    const s = denganSkor(dasar(), 10);
    j.p.periksa(s);
    await j.selesai();
    j.maju(20_000);
    j.p.periksa(s);
    expect(j.terkirim).toHaveLength(1);
    j.maju(15_000);
    j.p.periksa(s);
    await j.selesai();
    expect(j.terkirim).toHaveLength(2);
    j.maju(45_000);
    j.p.periksa(s);
    expect(j.terkirim).toHaveLength(2);
    j.maju(20_000);
    gagal = false;
    j.p.periksa(s);
    await j.selesai();
    expect(j.terkirim).toHaveLength(3);

    const sering = siapkan(() => new GalatPeringkat('terlalu-sering', 40_000));
    sering.p.periksa(s);
    await sering.selesai();
    sering.maju(39_000);
    sering.p.periksa(s);
    expect(sering.terkirim).toHaveLength(1);
    sering.maju(2_000);
    sering.p.periksa(s);
    expect(sering.terkirim).toHaveLength(2);
  });

  it('keluar papan: berhenti dan lupa kiriman terakhir (ikut lagi = langsung dikirim)', async () => {
    const { p, terkirim, selesai } = siapkan();
    const s = denganSkor(dasar(), 10);
    p.periksa(s);
    await selesai();
    p.periksa(aturIkutPeringkat(s, false));
    expect(p.terakhir).toBeNull();
    p.periksa(s);
    await selesai();
    expect(terkirim).toHaveLength(2);
  });
});

describe('LayananPeringkat', () => {
  const kunci = mingguWib(RABU).kunci;
  const siapkan = (o: { uid?: string | null; galatKirim?: () => GalatPeringkat | null; galatKeluar?: boolean } = {}) => {
    let jam = RABU;
    const panggilan: string[] = [];
    let state = aturNamaTerminal(perbaruiTantangan(stateOtomatis(), RABU), 'Sukamaju');
    const api: ApiPeringkat = {
      async papan(minggu) {
        panggilan.push(`papan:${minggu}`);
        return { minggu, jumlah: 1, daftar: [{ id: idPublik('uid-1'), nama: 'Sukamaju', kelas: 0, skor: 7 }] };
      },
      async saya() {
        panggilan.push('saya');
        return { minggu: kunci, skor: 7, peringkat: 1, jumlah: 1 };
      },
      async kirim(k) {
        panggilan.push(`kirim:${k.nama}`);
        const g = o.galatKirim?.() ?? null;
        if (g) throw g;
      },
      async keluar() {
        panggilan.push('keluar');
        if (o.galatKeluar) throw new GalatPeringkat('jaringan');
      },
    };
    const layanan: LayananPeringkat = new LayananPeringkat({
      api,
      uid: o.uid === undefined ? 'uid-1' : o.uid,
      ambilState: () => state,
      // Seperti PengendaliGame: aksi diterapkan lalu pelanggan (pengirim skor) langsung diberi tahu.
      kirimAksi: (a) => {
        state = terapkanAksi(state, a);
        layanan.periksa(state);
      },
      jam: () => jam,
    });
    return { layanan, panggilan, ambil: () => state, maju: (ms: number) => (jam += ms) };
  };

  it('tamu hanya bisa melihat: tidak pernah mengirim, ikut ditolak', async () => {
    const { layanan, panggilan, ambil } = siapkan({ uid: null });
    expect(layanan.masuk).toBe(false);
    expect(layanan.idSaya).toBeNull();
    layanan.periksa(aturIkutPeringkat(ambil(), true));
    await expect(layanan.ikut()).rejects.toBeInstanceOf(GalatPeringkat);
    expect(panggilan).toEqual([]);
    expect((await layanan.papan(kunci)).daftar).toHaveLength(1);
  });

  it('ikut: tercatat di save, skor pertama dikirim SEKALI, lalu peringkat sendiri dimuat', async () => {
    const { layanan, panggilan, ambil } = siapkan();
    await layanan.ikut();
    expect(ambil().profil.ikutPeringkat).toBe(true);
    expect(panggilan).toEqual(['kirim:Sukamaju', 'saya']);
    expect(layanan.saya).toEqual({ minggu: kunci, skor: 7, peringkat: 1, jumlah: 1 });
  });

  it('ikut dengan nama ditolak server: galatnya sampai ke UI, persetujuan tetap tercatat', async () => {
    const { layanan, ambil } = siapkan({ galatKirim: () => new GalatPeringkat('nama-ditolak') });
    await expect(layanan.ikut()).rejects.toMatchObject({ kode: 'nama-ditolak' });
    expect(ambil().profil.ikutPeringkat).toBe(true);
    expect(layanan.pengirim.galat).toBe('nama-ditolak');
  });

  it('keluar: skor dihapus di server dulu; gagal → tetap ikut', async () => {
    const gagal = siapkan({ galatKeluar: true });
    await gagal.layanan.ikut();
    await expect(gagal.layanan.keluar()).rejects.toBeInstanceOf(GalatPeringkat);
    expect(gagal.ambil().profil.ikutPeringkat).toBe(true);

    const ok = siapkan();
    await ok.layanan.ikut();
    await ok.layanan.keluar();
    expect(ok.ambil().profil.ikutPeringkat).toBe(false);
    expect(ok.layanan.saya).toBeNull();
    expect(ok.panggilan.at(-1)).toBe('keluar');
  });

  it('papan disimpan sebentar; peringkat sendiri paling sering tiap 5 menit', async () => {
    const { layanan, panggilan, maju } = siapkan();
    await layanan.papan(kunci);
    await layanan.papan(kunci);
    expect(panggilan.filter((p) => p.startsWith('papan'))).toHaveLength(1);
    await layanan.papan(kunci, true);
    maju(61_000);
    await layanan.papan(kunci);
    expect(panggilan.filter((p) => p.startsWith('papan'))).toHaveLength(3);
    await layanan.ikut();
    const saya = () => panggilan.filter((p) => p === 'saya').length;
    expect(saya()).toBe(1);
    maju(60_000);
    await layanan.segarkanSaya();
    expect(saya()).toBe(1);
    maju(4 * 60_000);
    await layanan.segarkanSaya();
    expect(saya()).toBe(2);
  });
});
