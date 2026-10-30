import { describe, expect, it } from 'vitest';
import { KEPUASAN_TURUN, kepuasanTurunBerlaku, periksaKepuasanTurun, type KepuasanTurun, type SampelKepuasan } from '../src/app/kepuasan-turun';
import type { AreaId, KepuasanTycoon } from '../src/sim/operasi';
import { ambilNotif, antreNotif, teksKepuasanTurun, type PesanNotif } from '../src/ui/notifikasi';
import { TEKS } from '../src/ui/teks';

const K = KEPUASAN_TURUN;
/** Kepuasan dengan komponen sama rata (nilai = rata-rata berbobot = nilai komponen), kecuali yang diubah. */
const kepuasan = (nilai: number, ubah: Partial<KepuasanTycoon> = {}): KepuasanTycoon => ({
  nilai,
  kelancaran: nilai,
  kenyamanan: nilai,
  kebersihan: nilai,
  keamanan: nilai,
  fasilitas: nilai,
  harga: nilai,
  ...ubah,
});
const sampel = (ms: number, k: KepuasanTycoon, bottleneck: AreaId | null = null): SampelKepuasan => ({ ms, kepuasan: k, bottleneck });

describe('periksaKepuasanTurun', () => {
  it('aturan dari rancangan: 10 poin, jendela 5 menit, jeda 120 dtk (waktu nyata)', () => {
    expect(K).toEqual({ poin: 10, jendelaMs: 300_000, jedaMs: 120_000 });
  });

  it(`turun ≥ ${K.poin} poin dari nilai tertinggi dalam jendela: toast; kurang dari itu tidak`, () => {
    const riwayat = [sampel(0, kepuasan(0.44)), sampel(1000, kepuasan(0.4))];
    expect(periksaKepuasanTurun(riwayat, sampel(2000, kepuasan(0.35)), null)).toBeNull();
    const t = periksaKepuasanTurun(riwayat, sampel(2000, kepuasan(0.28, { kelancaran: 0 }), 'peron'), null)!;
    expect(t.dari).toBeCloseTo(0.44, 9);
    expect(t.ke).toBeCloseTo(0.28, 9);
    // Tepat 10 poin juga dihitung.
    expect(periksaKepuasanTurun([sampel(0, kepuasan(0.5))], sampel(1000, kepuasan(0.4)), null)).not.toBeNull();
  });

  it('acuan hanya dari sampel dalam 5 menit terakhir', () => {
    const lama = sampel(0, kepuasan(0.9));
    const baru = sampel(200_000, kepuasan(0.62));
    expect(periksaKepuasanTurun([lama, baru], sampel(K.jendelaMs + 1, kepuasan(0.6)), null)).toBeNull();
    expect(periksaKepuasanTurun([lama, baru], sampel(K.jendelaMs, kepuasan(0.6)), null)).not.toBeNull();
  });

  it('jeda: paling cepat 120 dtk setelah toast kepuasan terakhir', () => {
    const riwayat = [sampel(100_000, kepuasan(0.8))];
    const kini = sampel(130_000, kepuasan(0.5));
    expect(periksaKepuasanTurun(riwayat, kini, 130_000 - K.jedaMs + 1)).toBeNull();
    expect(periksaKepuasanTurun(riwayat, kini, 130_000 - K.jedaMs)).not.toBeNull();
  });

  it('sebab: komponen dengan penurunan berbobot terbesar; area paling lambat ikut untuk kelancaran', () => {
    const acuan = sampel(0, kepuasan(0.6));
    // Kebersihan turun 0,5 (bobot 0,2 → 0,1) lebih berat dari keamanan turun 0,6 (bobot 0,1 → 0,06).
    const t = periksaKepuasanTurun([acuan], sampel(1000, kepuasan(0.45, { kebersihan: 0.1, keamanan: 0 }), 'loket'), null)!;
    expect(t.sebab).toEqual({ komponen: 'kebersihan', area: 'loket' });
    const k = periksaKepuasanTurun([acuan], sampel(1000, kepuasan(0.45, { kelancaran: 0.1 }), 'peron'), null)!;
    expect(k.sebab).toEqual({ komponen: 'kelancaran', area: 'peron' });
  });

  it('teks toast: wajah, persen acuan → sekarang, sebab, ajakan mengetuk', () => {
    expect(teksKepuasanTurun({ dari: 0.44, ke: 0.28, sebab: { komponen: 'kelancaran', area: 'peron' } })).toBe('🙁 Kepuasan turun 44% → 28%: antrean di Peron. Ketuk untuk rincian');
    expect(teksKepuasanTurun({ dari: 0.8, ke: 0.65, sebab: { komponen: 'kelancaran', area: null } })).toBe(TEKS.notifKepuasanTurun('🙂', 80, 65, TEKS.sebabAntrean));
    expect(teksKepuasanTurun({ dari: 0.8, ke: 0.65, sebab: { komponen: 'harga', area: 'loket' } })).toContain(TEKS.sebabHarga);
  });
});

describe('toast kepuasan tidak basi (temuan QA M-2)', () => {
  // p-06-penutup: toast "44% → 28%" baru tampil dari antrean saat pil HUD sudah 44%.
  const turun: KepuasanTurun = { dari: 0.44, ke: 0.28, sebab: { komponen: 'kelancaran', area: 'peron' } };
  const toast: PesanNotif = { teks: teksKepuasanTurun(turun), kepuasan: turun };
  const biasa: PesanNotif = { teks: TEKS.notifPo('PO Uji') };

  it(`kepuasanTurunBerlaku: kepuasan sekarang masih ≥ ${K.poin} poin di bawah acuan`, () => {
    expect(kepuasanTurunBerlaku(turun, 0.28)).toBe(true);
    expect(kepuasanTurunBerlaku(turun, 0.2)).toBe(true);
    // Tepat 10 poin masih berlaku (sama dengan periksaKepuasanTurun).
    expect(kepuasanTurunBerlaku(turun, 0.34)).toBe(true);
    expect(kepuasanTurunBerlaku(turun, 0.345)).toBe(false);
    expect(kepuasanTurunBerlaku(turun, 0.44)).toBe(false);
    expect(kepuasanTurunBerlaku(turun, 0.6)).toBe(false);
  });

  it('ambilNotif: toast kepuasan yang sudah pulih dibuang, pesan berikutnya yang tampil', () => {
    expect(ambilNotif([toast, biasa], 0.44)).toEqual({ pesan: biasa, sisa: [] });
    expect(ambilNotif([toast], 0.44)).toEqual({ pesan: null, sisa: [] });
    expect(ambilNotif([], 0.44)).toEqual({ pesan: null, sisa: [] });
  });

  it('ambilNotif: toast yang masih berlaku memakai kepuasan saat tampil, sama dengan pil HUD', () => {
    const { pesan, sisa } = ambilNotif([toast, biasa], 0.31);
    expect(pesan?.teks).toBe(teksKepuasanTurun({ ...turun, ke: 0.31 }));
    expect(pesan?.teks).toContain('44% → 31%');
    expect(pesan?.kepuasan).toEqual({ ...turun, ke: 0.31 });
    expect(sisa).toEqual([biasa]);
    // Kepuasan yang turun lebih jauh juga ikut.
    expect(ambilNotif([toast], 0.2).pesan?.teks).toContain('44% → 20%');
  });

  it('ambilNotif: pesan biasa keluar apa adanya dan urutan antrean tetap', () => {
    const lain: PesanNotif = { teks: TEKS.notifKasMenipis, bahaya: true };
    const antrean = antreNotif(antreNotif(antreNotif([], biasa), toast), lain);
    expect(antrean.map((p) => p.teks)).toEqual([lain.teks, biasa.teks, toast.teks]);
    const a = ambilNotif(antrean, 0.44);
    expect(a.pesan).toBe(lain);
    const b = ambilNotif(a.sisa, 0.44);
    expect(b).toEqual({ pesan: biasa, sisa: [toast] });
    expect(ambilNotif(b.sisa, 0.44)).toEqual({ pesan: null, sisa: [] });
  });
});
