import { describe, expect, it } from 'vitest';
import type { LaporanOffline } from '../src/sim/state';
import { teksCatatanOffline, teksIzinOffline, teksTombolOffline } from '../src/ui/popup-offline';
import { TEKS } from '../src/ui/teks';

const laporan = (o: Partial<LaporanOffline>): LaporanOffline => ({
  detik: 600,
  dibatasi: false,
  tutup: false,
  pendapatan: 0,
  biaya: 0,
  laba: 0,
  detikBoost: 0,
  berhenti: 0,
  proyek: null,
  naikLevel: null,
  ...o,
});

describe('popup offline: tombol & catatan', () => {
  it('tombol "Ambil" hanya bila ada laba; laba ≤ 0 atau terminal tutup: "Oke" (AC-GP-15)', () => {
    expect(TEKS.offlineOke).toBe('Oke');
    expect(teksTombolOffline(laporan({ pendapatan: 2_000_000, biaya: 400_000, laba: 1_600_000 }))).toBe(TEKS.offlineAmbil);
    expect(teksTombolOffline(laporan({ pendapatan: 400_000, biaya: 2_000_000, laba: -1_600_000 }))).toBe(TEKS.offlineOke);
    expect(teksTombolOffline(laporan({ laba: 0 }))).toBe(TEKS.offlineOke);
    expect(teksTombolOffline(laporan({ tutup: true }))).toBe(TEKS.offlineOke);
  });

  it('catatan: dengan Manajer rumus offline; tutup: saran Manajer hanya bila ia sudah untung (AC-GP-13)', () => {
    expect(teksCatatanOffline(laporan({ laba: 1 }), false)).toMatch(/^Manajer Operasional menjalankan terminal: pendapatan 60%/);
    expect(teksCatatanOffline(laporan({ tutup: true }), true)).toBe(TEKS.offlineTutup);
    expect(teksCatatanOffline(laporan({ tutup: true }), false)).toBe('Terminal tutup selama kamu pergi: tanpa pendapatan, tanpa biaya.');
  });

  it('izin baru bila terminal naik level selama pergi, yang ada saja (documents/15 bagian 3.5, AC-GP-06)', () => {
    expect(teksIzinOffline(laporan({}), 3)).toBe('');
    expect(teksIzinOffline(laporan({ naikLevel: { dari: 15, ke: 17 } }), 4)).toBe('🎫 Izin baru: jendela +2, jalur +1, slot PO ke-7');
    expect(teksIzinOffline(laporan({ naikLevel: { dari: 20, ke: 22 } }), 3)).toBe('🎫 Izin baru: jendela +2');
    expect(teksIzinOffline(laporan({ naikLevel: { dari: 2, ke: 3 } }), 0)).toBe('🎫 Izin baru: slot PO ke-3');
    // Naik level tanpa izin (Lv 4 → 5 sebelum Perluasan 3).
    expect(teksIzinOffline(laporan({ naikLevel: { dari: 4, ke: 5 } }), 1)).toBe('');
  });
});
