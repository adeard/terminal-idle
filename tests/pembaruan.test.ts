import { describe, expect, it } from 'vitest';
import { bacaInfoRilis, bandingkanVersi, MAKS_CATATAN, pembaruanWajib, teksPerubahanVersi } from '../src/app/pembaruan';
import { RILIS } from '../src/config/rilis.config';
import paket from '../package.json';

describe('pembaruan versi', () => {
  it('membandingkan versi per angka, bukan per huruf', () => {
    expect(bandingkanVersi('0.2.0', '0.10.0')).toBeLessThan(0);
    expect(bandingkanVersi('1.0.0', '0.9.9')).toBeGreaterThan(0);
    expect(bandingkanVersi('1.2', '1.2.0')).toBe(0);
    expect(bandingkanVersi('v1.3.0', '1.3.0')).toBe(0);
    expect(bandingkanVersi('1.3.0-beta', '1.3.0')).toBe(0);
    expect(bandingkanVersi('2.0.1', '2.0.0')).toBeGreaterThan(0);
  });

  it('membaca versi.json dengan aman: bentuk salah → null, catatan dibersihkan & dibatasi', () => {
    expect(bacaInfoRilis(null)).toBeNull();
    expect(bacaInfoRilis('0.2.0')).toBeNull();
    expect(bacaInfoRilis({ versi: '' })).toBeNull();
    expect(bacaInfoRilis({ versi: 2 })).toBeNull();
    expect(bacaInfoRilis({ versi: '0.2.0' })).toEqual({ versi: '0.2.0', versiMinimal: '0.0.0', catatan: [] });
    const info = bacaInfoRilis({ versi: ' 0.3.0 ', versiMinimal: '0.2.0', catatan: ['Satu', '', 3, 'Dua', 'Tiga', 'Empat', 'Lima', 'Enam'] });
    expect(info?.versi).toBe('0.3.0');
    expect(info?.catatan).toEqual(['Satu', 'Dua', 'Tiga', 'Empat', 'Lima'].slice(0, MAKS_CATATAN));
  });

  it('wajib memperbarui hanya bila versi yang berjalan di bawah versi minimal rilis baru', () => {
    const info = { versi: '0.3.0', versiMinimal: '0.2.0', catatan: [] };
    expect(pembaruanWajib('0.1.5', info)).toBe(true);
    expect(pembaruanWajib('0.2.0', info)).toBe(false);
    expect(pembaruanWajib('0.2.4', info)).toBe(false);
    // versi.json tidak terbaca: tetap boleh ditunda.
    expect(pembaruanWajib('0.1.0', null)).toBe(false);
  });

  it('teks perubahan versi hanya bila nomor versinya berbeda', () => {
    expect(teksPerubahanVersi('0.1.0', { versi: '0.2.0', versiMinimal: '0.0.0', catatan: [] })).toBe('0.1.0 → 0.2.0');
    expect(teksPerubahanVersi('0.2.0', { versi: '0.2.0', versiMinimal: '0.0.0', catatan: [] })).toBeNull();
    expect(teksPerubahanVersi('0.2.0', null)).toBeNull();
  });

  it('konfigurasi rilis konsisten dengan package.json', () => {
    // Versi minimal tidak boleh di atas versi rilis ini (semua pemain terkunci di popup wajib).
    expect(bandingkanVersi(RILIS.versiMinimal, paket.version)).toBeLessThanOrEqual(0);
    expect(RILIS.catatan.length).toBeLessThanOrEqual(MAKS_CATATAN);
  });
});
