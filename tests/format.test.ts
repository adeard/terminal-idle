import Decimal from 'break_infinity.js';
import { describe, expect, it } from 'vitest';
import { formatAngka, formatBulat, formatDurasi, formatUang } from '../src/ui/format';

describe('formatAngka (gaya Indonesia)', () => {
  it('contoh dari spesifikasi', () => {
    expect(formatAngka(1250)).toBe('1.250');
    expect(formatAngka(12_500)).toBe('12,5 rb');
    expect(formatAngka(3_400_000)).toBe('3,4 jt');
    expect(formatAngka(1_200_000_000)).toBe('1,2 M');
    expect(formatAngka(5.6e12)).toBe('5,6 T');
  });

  it('angka kecil: maksimal 1 desimal dengan koma, dipotong', () => {
    expect(formatAngka(0)).toBe('0');
    expect(formatAngka(0.8)).toBe('0,8');
    expect(formatAngka(0.3)).toBe('0,3');
    expect(formatAngka(20)).toBe('20');
    expect(formatAngka(20.49)).toBe('20,4');
    expect(formatAngka(44.8)).toBe('44,8');
    expect(formatAngka(99.99)).toBe('99,9');
  });

  it('100 sampai 9.999: bilangan bulat dengan titik ribuan', () => {
    expect(formatAngka(100)).toBe('100');
    expect(formatAngka(380.09)).toBe('380');
    expect(formatAngka(1608)).toBe('1.608');
    expect(formatAngka(9999.99)).toBe('9.999');
  });

  it('singkatan: 1 desimal di bawah 100, bulat di atasnya, tanpa ",0"', () => {
    expect(formatAngka(10_000)).toBe('10 rb');
    expect(formatAngka(99_999)).toBe('99,9 rb');
    expect(formatAngka(125_000)).toBe('125 rb');
    expect(formatAngka(999_999)).toBe('999 rb');
    expect(formatAngka(1_000_000)).toBe('1 jt');
    expect(formatAngka(999.9e12)).toBe('999 T');
  });

  it('notasi ilmiah setelah triliun', () => {
    expect(formatAngka(1e15)).toBe('1e15');
    expect(formatAngka(1.234e15)).toBe('1,23e15');
    expect(formatAngka(new Decimal('9.999e307'))).toBe('9,99e307');
    expect(formatAngka(Decimal.pow(10, 500).times(4.5))).toBe('4,5e500');
  });

  it('menerima Decimal, string, number; negatif & NaN aman', () => {
    expect(formatAngka(new Decimal(12_500))).toBe('12,5 rb');
    expect(formatAngka('3400000')).toBe('3,4 jt');
    expect(formatAngka(-1250)).toBe('-1.250');
    expect(formatAngka(Number.NaN)).toBe('–');
  });

  it('opsi desimalKecil', () => {
    expect(formatAngka(20.7, { desimalKecil: 0 })).toBe('20');
    expect(formatAngka(0.85, { desimalKecil: 2 })).toBe('0,85');
  });

  it('pemotongan monoton: nilai lebih besar tidak pernah tampil lebih kecil', () => {
    let sebelumnya = -1;
    for (let i = 0; i < 5000; i++) {
      const x = Math.pow(10, i / 400);
      const tampil = formatAngka(x);
      // Urutan unit supaya string bisa dibandingkan secara numerik.
      const m = /^([\d.,]+)(?: (rb|jt|M|T))?$/.exec(tampil) ?? /^([\d,]+)e(\d+)$/.exec(tampil);
      expect(m, tampil).not.toBeNull();
      const pengali = { rb: 1e3, jt: 1e6, M: 1e9, T: 1e12 } as Record<string, number>;
      const angka = tampil.includes('e')
        ? Number(m![1]!.replace(',', '.')) * 10 ** Number(m![2])
        : Number(m![1]!.replace(/\./g, '').replace(',', '.')) * (m![2] ? pengali[m![2]]! : 1);
      expect(angka).toBeGreaterThanOrEqual(sebelumnya);
      expect(angka).toBeLessThanOrEqual(x * (1 + 1e-9));
      sebelumnya = angka;
    }
  });
});

describe('formatUang', () => {
  it('prefiks Rp dan bilangan bulat di bawah 100', () => {
    expect(formatUang(20)).toBe('Rp 20');
    expect(formatUang(24.9)).toBe('Rp 24');
    expect(formatUang(16.2)).toBe('Rp 16');
    expect(formatUang(1250)).toBe('Rp 1.250');
    expect(formatUang(new Decimal(3.4e6))).toBe('Rp 3,4 jt');
  });
});

describe('formatDurasi', () => {
  it('detik, menit, jam', () => {
    expect(formatDurasi(0)).toBe('0 detik');
    expect(formatDurasi(45.9)).toBe('45 detik');
    expect(formatDurasi(60)).toBe('1 menit');
    expect(formatDurasi(3599)).toBe('59 menit');
    expect(formatDurasi(3600)).toBe('1 jam');
    expect(formatDurasi(8100)).toBe('2 jam 15 menit');
    expect(formatDurasi(14_400)).toBe('4 jam');
    expect(formatDurasi(-5)).toBe('0 detik');
  });
});

describe('formatBulat (skor papan peringkat)', () => {
  it('lengkap dengan pemisah ribuan, dipotong ke bawah', () => {
    expect(formatBulat(0)).toBe('0');
    expect(formatBulat(999.9)).toBe('999');
    expect(formatBulat(1_012_000)).toBe('1.012.000');
    expect(formatBulat(9_999_999)).toBe('9.999.999');
  });
});
