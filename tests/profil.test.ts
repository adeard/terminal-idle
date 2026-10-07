import Decimal from 'break_infinity.js';
import { describe, expect, it } from 'vitest';
import { peristiwaAksi } from '../src/app/analitik';
import { terapkanAksi } from '../src/sim/aksi';
import { MAKS_NAMA_TERMINAL, rapikanNamaTerminal } from '../src/sim/profil';
import { deserialisasi, serialisasi } from '../src/sim/save';
import { aturNamaTerminal, renovasi } from '../src/sim/state';
import { buatModel } from '../src/ui/model';
import { TEKS } from '../src/ui/teks';
import { stateOtomatis, T0 } from './helpers';

describe('nama terminal', () => {
  it('dirapikan: spasi, karakter aneh, awalan "Terminal", panjang maksimal', () => {
    expect(rapikanNamaTerminal('  Suka   maju ')).toBe('Suka maju');
    expect(rapikanNamaTerminal('Terminal Sukamaju')).toBe('Sukamaju');
    expect(rapikanNamaTerminal('TERMINAL')).toBe('');
    expect(rapikanNamaTerminal('Terminalku')).toBe('Terminalku');
    expect(rapikanNamaTerminal('<b>Jaya</b> 🚌!')).toBe('bJayab');
    expect(rapikanNamaTerminal("Gebang-2 St. Jo'")).toBe("Gebang-2 St. Jo'");
    expect(rapikanNamaTerminal('Ñusantara Café')).toBe('Ñusantara Café');
    expect(rapikanNamaTerminal('x'.repeat(40))).toHaveLength(MAKS_NAMA_TERMINAL);
    expect(rapikanNamaTerminal('Terminal Bersama Kita Semua Jaya')).toBe('Bersama Kita Semua');
  });

  it('aksi mengganti nama; nama yang sama tidak mengubah state; tetap walau Renovasi', () => {
    const s = { ...stateOtomatis(), uang: new Decimal(1e6) };
    expect(s.profil.namaTerminal).toBe('');
    const n = terapkanAksi(s, { jenis: 'aturNamaTerminal', nama: ' Terminal Sukamaju ' });
    expect(n.profil.namaTerminal).toBe('Sukamaju');
    expect(aturNamaTerminal(n, 'Sukamaju')).toBe(n);
    const naik = renovasi({ ...n, statistik: { ...n.statistik, totalPendapatanRun: new Decimal(1e9) } });
    expect(naik.renovasi.jumlah).toBe(1);
    expect(naik.profil.namaTerminal).toBe('Sukamaju');
  });

  it('analitik hanya mencatat ada/tidaknya nama, bukan namanya', () => {
    const s = stateOtomatis();
    const n = aturNamaTerminal(s, 'Sukamaju');
    expect(peristiwaAksi({ jenis: 'aturNamaTerminal', nama: 'Sukamaju' }, s, n)).toEqual([{ nama: 'nama_terminal', data: { ada: true } }]);
    expect(peristiwaAksi({ jenis: 'aturNamaTerminal', nama: '' }, n, aturNamaTerminal(n, ''))).toEqual([{ nama: 'nama_terminal', data: { ada: false } }]);
  });

  it('tersimpan & dirapikan saat dimuat; save lama tanpa profil memakai nama bawaan', () => {
    const n = aturNamaTerminal(stateOtomatis(), 'Sukamaju');
    expect(deserialisasi(serialisasi(n), T0).profil.namaTerminal).toBe('Sukamaju');
    const mentah = JSON.parse(serialisasi(n)) as Record<string, unknown>;
    mentah['profil'] = { namaTerminal: 'Terminal <x>Baru!!' };
    expect(deserialisasi(JSON.stringify(mentah), T0).profil.namaTerminal).toBe('xBaru');
    delete mentah['profil'];
    expect(deserialisasi(JSON.stringify(mentah), T0).profil.namaTerminal).toBe('');
    mentah['profil'] = { namaTerminal: 5 };
    expect(() => deserialisasi(JSON.stringify(mentah), T0)).toThrow();
  });

  it('judul kartu terminal & keterangan foto memakai nama', () => {
    const n = aturNamaTerminal(stateOtomatis(), 'Sukamaju');
    expect(buatModel(n).terminal.nama).toBe('Sukamaju');
    expect(TEKS.kelasJudul('Tipe C', 'Sukamaju')).toBe('Terminal Sukamaju · Tipe C');
    expect(TEKS.kelasJudul('Tipe C')).toBe('Terminal Tipe C');
    expect(TEKS.fotoKeterangan('Tipe A', 5, '120', 3, 'Sukamaju')).toBe('Terminal Sukamaju · Tipe A · 5 jurusan · 120 pnp/dtk · 3 PO');
    expect(TEKS.namaPratinjau('Sukamaju', 'Tipe C')).toBe('TERMINAL SUKAMAJU · TIPE C');
  });
});
