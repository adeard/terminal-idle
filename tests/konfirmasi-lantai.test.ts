import { describe, expect, it } from 'vitest';
import { kasSesudahAksi } from '../src/app/tujuan';
import { terapkanAksi, type Aksi } from '../src/sim/aksi';
import { type GameState } from '../src/sim/state';
import { buatModel } from '../src/ui/model';
import { ketukBeliLantai, konfirmasiSesudahAksi, menungguKonfirmasi, type KonfirmasiLantai } from '../src/ui/konfirmasi-lantai';
import { TEKS } from '../src/ui/teks';
import { denganLevelTerminal, denganPerluasan, denganPetugas, stateOtomatis } from './helpers';

/** Batas tunggu ketukan kedua (menu.ts memakai MS_YAKIN tombol Bongkar). */
const MS = 3000;
const beliParkir: Aksi = { jenis: 'tambahLantai', gedung: 'parkir' };

/** Lv 15, Perluasan 3, terminal merugi tanpa kontrak (petugas lebih) supaya cadangan B > 0. */
const rugi = (kas: number): GameState => denganPetugas(denganLevelTerminal(denganPerluasan(stateOtomatis({}, kas), 3), 15), ['kebersihan', 'kebersihan', 'kebersihan', 'satpam', 'satpam']);

/** Jalankan urutan ketukan seperti menu.ts: perluYakin dari kartu (ModelLantai.peringatanKas). */
function ketukKartu(s: GameState, ketukan: readonly number[]): { readonly s: GameState; readonly dibeli: number } {
  let k: KonfirmasiLantai | null = null;
  let dibeli = 0;
  for (const ms of ketukan) {
    const perlu = buatModel(s).bangun.lantai.parkir!.peringatanKas;
    const h = ketukBeliLantai(k, 'parkir', perlu, ms, MS);
    k = h.konfirmasi;
    if (h.beli) {
      s = terapkanAksi(s, beliParkir);
      dibeli++;
    }
  }
  return { s, dibeli };
}

describe('konfirmasi ketuk kedua kartu lantai (temuan playtest T-1)', () => {
  const ks = kasSesudahAksi(rugi(1e13), beliParkir)!;

  it('kas aman sesudah membeli (≥ cadangan B, aturan baris tujuan): sekali ketuk langsung membeli', () => {
    expect(ks.cadangan).toBeGreaterThan(0);
    const aman = rugi(300_000_000 + Math.ceil(ks.cadangan));
    const r = ketukKartu(aman, [0]);
    expect(r.dibeli).toBe(1);
    expect(r.s.terminal.lantai.parkir).toBe(1);
    expect(ketukBeliLantai(null, 'parkir', false, 0, MS)).toEqual({ beli: true, konfirmasi: null });
  });

  it('kas tidak aman: ketuk pertama tidak membeli, ketuk kedua sebelum batas waktu membeli', () => {
    const tipis = rugi(300_000_000 + Math.floor(ks.cadangan) - 1);
    expect(buatModel(tipis).bangun.lantai.parkir).toMatchObject({ keadaan: 'terjangkau', peringatanKas: true });
    const satu = ketukKartu(tipis, [0]);
    expect(satu.dibeli).toBe(0);
    expect(satu.s).toBe(tipis);
    const dua = ketukKartu(tipis, [0, 1200]);
    expect(dua.dibeli).toBe(1);
    expect(dua.s.terminal.lantai.parkir).toBe(1);
    // Batas waktu lewat: ketukan berikutnya kembali hanya meminta konfirmasi.
    expect(ketukKartu(tipis, [0, MS]).dibeli).toBe(0);
    expect(ketukKartu(tipis, [0, MS, MS + 500]).dibeli).toBe(1);
  });

  it('batas tepat di cadangan B: sisa = cadangan aman (sekali ketuk), satu rupiah kurang meminta konfirmasi', () => {
    // Aturan bersama yang sama persis dengan baris tujuan: aman bila sisa ≥ cadangan.
    const k = kasSesudahAksi(rugi(300_000_000 + Math.ceil(ks.cadangan)), beliParkir)!;
    expect(k.sisa).toBeGreaterThanOrEqual(k.cadangan);
    expect(ketukKartu(rugi(300_000_000 + Math.ceil(ks.cadangan)), [0]).dibeli).toBe(1);
    expect(ketukKartu(rugi(300_000_000 + Math.floor(ks.cadangan) - 1), [0]).dibeli).toBe(0);
  });

  it('aksi lain membatalkan konfirmasi; konfirmasi gedung lain tidak berlaku untuk gedung ini', () => {
    const k = ketukBeliLantai(null, 'parkir', true, 0, MS).konfirmasi!;
    expect(menungguKonfirmasi(k, 'parkir', 100)).toBe(true);
    expect(konfirmasiSesudahAksi(k, { jenis: 'bangun', bangunan: 'kursi' })).toBeNull();
    expect(konfirmasiSesudahAksi(k, { jenis: 'tambahLantai', gedung: 'aula' })).toBeNull();
    expect(konfirmasiSesudahAksi(k, beliParkir)).toBe(k);
    // Sesudah dibatalkan, ketukan berikutnya kembali hanya meminta konfirmasi.
    expect(ketukBeliLantai(konfirmasiSesudahAksi(k, { jenis: 'rekrut', petugas: 'satpam' }), 'parkir', true, 500, MS).beli).toBe(false);
    // Konfirmasi Gedung parkir tidak membuat ketukan pertama Ruang tunggu langsung membeli.
    const lain = ketukBeliLantai(k, 'ruangTunggu', true, 500, MS);
    expect(lain).toEqual({ beli: false, konfirmasi: { gedung: 'ruangTunggu', sampaiMs: 500 + MS } });
  });

  it('teks status konfirmasi menyebut sisa kas dan akibatnya', () => {
    expect(TEKS.lantaiKonfirmasi('Rp 8 jt')).toBe('⚠️ Kas tinggal Rp 8 jt: gaji bisa tak terbayar, petugas berhenti. Ketuk lagi untuk membeli.');
    expect(TEKS.lantaiKetukLagi).toBe('Ketuk lagi');
  });
});
