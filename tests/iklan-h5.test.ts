import { describe, expect, it } from 'vitest';
import { BATAS_MULAI_MS, JEDA_SETELAH_IKLAN_MS, JEDA_ULANG_MS, PengaturIklanH5, type JedaReward, type Penjadwal } from '../src/app/iklan-h5';
import { idPenerbitSah } from '../src/config/iklan.config';

/** Penjadwal tiruan: waktu maju hanya lewat `maju`. */
function penjadwalTiruan(): Penjadwal & { maju(ms: number): void } {
  let jam = 0;
  let id = 0;
  const antre = new Map<number, { readonly saat: number; readonly f: () => void }>();
  return {
    setTimeout(f, ms) {
      antre.set(++id, { saat: jam + ms, f });
      return id;
    },
    clearTimeout(x) {
      antre.delete(x);
    },
    maju(ms) {
      const akhir = jam + ms;
      for (;;) {
        const berikut = [...antre.entries()].filter(([, t]) => t.saat <= akhir).sort((a, b) => a[1].saat - b[1].saat)[0];
        if (!berikut) break;
        antre.delete(berikut[0]);
        jam = berikut[1].saat;
        berikut[1].f();
      }
      jam = akhir;
    },
  };
}

function siapkan() {
  const jeda: JedaReward[] = [];
  const suara: string[] = [];
  const penjadwal = penjadwalTiruan();
  const p = new PengaturIklanH5({ adBreak: (j) => jeda.push(j), penjadwal, sebelum: () => suara.push('bisu'), sesudah: () => suara.push('nyala') });
  return { p, jeda, suara, penjadwal, terakhir: () => jeda.at(-1)! };
}

describe('iklan berhadiah Google H5 Games Ads', () => {
  it('ID penerbit harus berbentuk ca-pub-16 angka', () => {
    expect(idPenerbitSah('ca-pub-1234567890123456')).toBe(true);
    expect(idPenerbitSah('')).toBe(false);
    expect(idPenerbitSah('pub-1234567890123456')).toBe(false);
    expect(idPenerbitSah('ca-pub-123')).toBe(false);
  });

  it('belum ada iklan: tombol tetap tersembunyi, siaga dicoba lagi dengan jeda makin panjang', () => {
    const { p, jeda, penjadwal, terakhir } = siapkan();
    p.mulai();
    p.mulai();
    expect(jeda).toHaveLength(1);
    expect(terakhir()).toMatchObject({ type: 'reward', name: 'hadiah' });
    terakhir().adBreakDone({ breakStatus: 'notReady' });
    expect(p.siap()).toBe(false);
    penjadwal.maju(JEDA_ULANG_MS[0]! - 1);
    expect(jeda).toHaveLength(1);
    penjadwal.maju(1);
    expect(jeda).toHaveLength(2);
    terakhir().adBreakDone({ breakStatus: 'frequencyCapped' });
    penjadwal.maju(JEDA_ULANG_MS[0]!);
    expect(jeda).toHaveLength(2);
    penjadwal.maju(JEDA_ULANG_MS[1]! - JEDA_ULANG_MS[0]!);
    expect(jeda).toHaveLength(3);
  });

  it('iklan ditonton sampai habis: showAdFn dipanggil di dalam ketukan, suara dibisukan lalu dinyalakan, siaga berikutnya diminta', async () => {
    const { p, jeda, suara, penjadwal, terakhir } = siapkan();
    p.mulai();
    let ditampilkan = 0;
    const j = terakhir();
    j.beforeReward(() => {
      ditampilkan++;
      j.beforeAd();
    });
    expect(p.siap()).toBe(true);
    const hasil = p.tonton();
    expect(ditampilkan).toBe(1);
    expect(p.siap()).toBe(false);
    expect(suara).toEqual(['bisu']);
    j.adViewed();
    j.afterAd();
    j.adBreakDone({ breakStatus: 'viewed' });
    expect(await hasil).toBe('ditonton');
    expect(suara).toEqual(['bisu', 'nyala']);
    penjadwal.maju(JEDA_SETELAH_IKLAN_MS);
    expect(jeda).toHaveLength(2);
  });

  it('iklan ditutup sebelum selesai = dilewati (tanpa hadiah); tonton tanpa iklan siap = gagal', async () => {
    const { p, terakhir } = siapkan();
    expect(await p.tonton()).toBe('gagal');
    p.mulai();
    const j = terakhir();
    j.beforeReward(() => j.beforeAd());
    const hasil = p.tonton();
    j.adDismissed();
    j.afterAd();
    j.adBreakDone({ breakStatus: 'dismissed' });
    expect(await hasil).toBe('dilewati');
  });

  it('showAdFn tidak memutar apa pun: gagal setelah batas waktu, panggilan balik terlambat diabaikan, suara tidak tertinggal bisu', async () => {
    const { p, jeda, suara, penjadwal, terakhir } = siapkan();
    p.mulai();
    const j = terakhir();
    j.beforeReward(() => {});
    const hasil = p.tonton();
    penjadwal.maju(BATAS_MULAI_MS);
    expect(await hasil).toBe('gagal');
    penjadwal.maju(JEDA_SETELAH_IKLAN_MS);
    expect(jeda).toHaveLength(2);
    // Jeda lama yang terlambat menjawab tidak mengganggu siaga baru.
    j.beforeAd();
    j.adBreakDone({ breakStatus: 'error' });
    expect(suara).toEqual([]);
    terakhir().beforeReward(() => {});
    expect(p.siap()).toBe(true);
  });

  it('iklan mulai tapi afterAd tidak dipanggil: suara tetap dipulihkan saat jeda selesai', async () => {
    const { p, suara, terakhir } = siapkan();
    p.mulai();
    const j = terakhir();
    j.beforeReward(() => j.beforeAd());
    const hasil = p.tonton();
    j.adViewed();
    j.adBreakDone({ breakStatus: 'viewed' });
    expect(await hasil).toBe('ditonton');
    expect(suara).toEqual(['bisu', 'nyala']);
  });
});
