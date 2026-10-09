import { describe, expect, it } from 'vitest';
import { KUNCI_SAVE, KUNCI_SAVE_KORUP, SesiGame, slotLokal, type AlasanSimpan, type Penyimpanan, type SlotSave } from '../src/app/sesi';
import { EKONOMI } from '../src/config/economy.config';
import { deserialisasi, serialisasi } from '../src/sim/save';
import { buatStateBaru, tandaiWaktu, terapkanOffline, type GameState } from '../src/sim/state';
import { jalankan, stateOtomatis } from './helpers';

/**
 * Hari biasa tanpa event musiman: sesi mencocokkan event dengan jam dinding,
 * dan event mengubah pendapatan (lihat tests/event.test.ts).
 */
const T0 = Date.UTC(2026, 3, 15);
const JAM_MS = 3_600_000;

class PenyimpananPalsu implements Penyimpanan {
  readonly isi = new Map<string, string>();
  gagalBaca = false;
  gagalTulis = false;
  jumlahTulis = 0;

  async baca(kunci: string): Promise<string | null> {
    if (this.gagalBaca) throw new Error('baca rusak');
    return this.isi.get(kunci) ?? null;
  }

  async tulis(kunci: string, nilai: string): Promise<void> {
    if (this.gagalTulis) throw new Error('tulis rusak');
    this.jumlahTulis++;
    this.isi.set(kunci, nilai);
  }

  async hapus(kunci: string): Promise<void> {
    this.isi.delete(kunci);
  }
}

function siapkan(awal?: { save?: string; sekarang?: number }) {
  const penyimpanan = new PenyimpananPalsu();
  if (awal?.save !== undefined) penyimpanan.isi.set(KUNCI_SAVE, awal.save);
  const waktu = { sekarang: awal?.sekarang ?? T0 };
  const log: string[] = [];
  const opsi = { slot: slotLokal(penyimpanan), jam: () => waktu.sekarang, logGalat: (p: string) => log.push(p) };
  return { penyimpanan, waktu, log, opsi };
}

const MODAL = EKONOMI.tycoon.modalAwal;
/** Terminal dengan Manajer Operasional (tetap berjalan saat ditutup), kas `kas`, terakhir aktif di `waktuMs`. */
const stateManajer = (kas: number, waktuMs: number): GameState => tandaiWaktu(stateOtomatis({}, kas, ['manajerOperasional']), waktuMs);
const SAVE_OTOMATIS_T0 = serialisasi(stateManajer(MODAL, T0));
/** Laba offline yang diharapkan bila state ini ditinggal `ms`. */
const labaOffline = (s: GameState, ms: number): number => terapkanOffline(s, s.waktuTerakhirMs + ms).laporan.laba;

describe('SesiGame.mulai', () => {
  it('tanpa save: game baru, langsung disimpan, tanpa laporan offline', async () => {
    const { opsi, penyimpanan } = siapkan();
    const { sesi, status, laporan } = await SesiGame.mulai(opsi);
    expect(status).toBe('baru');
    expect(laporan).toBeNull();
    expect(sesi.pengendali.state.kas).toBe(MODAL);
    expect(penyimpanan.isi.has(KUNCI_SAVE)).toBe(true);
  });

  it('save 1 jam lalu, ada Manajer Operasional: laba offline diberikan lalu disimpan', async () => {
    const { opsi, penyimpanan } = siapkan({ save: SAVE_OTOMATIS_T0, sekarang: T0 + JAM_MS });
    const { sesi, status, laporan } = await SesiGame.mulai(opsi);
    const harapan = labaOffline(stateManajer(MODAL, T0), JAM_MS);
    expect(status).toBe('dimuat');
    expect(laporan?.detik).toBe(3600);
    expect(harapan).toBeGreaterThan(0);
    expect(laporan?.laba).toBeCloseTo(harapan, 3);
    expect(sesi.pengendali.state.kas).toBeCloseTo(MODAL + harapan, 3);

    // Save langsung diperbarui: membuka ulang di detik yang sama tidak memberi offline lagi.
    const tersimpan = deserialisasi(penyimpanan.isi.get(KUNCI_SAVE)!, 0);
    expect(tersimpan.waktuTerakhirMs).toBe(T0 + JAM_MS);
    expect(tersimpan.kas).toBeCloseTo(MODAL + harapan, 3);
    const ulang = await SesiGame.mulai(opsi);
    expect(ulang.laporan?.detik).toBe(0);
    expect(ulang.sesi.pengendali.state.kas).toBeCloseTo(MODAL + harapan, 3);
  });

  it('jam HP dimundurkan: tidak ada laba offline, tidak crash', async () => {
    const { opsi } = siapkan({ save: SAVE_OTOMATIS_T0, sekarang: T0 - 5 * JAM_MS });
    const { sesi, laporan } = await SesiGame.mulai(opsi);
    expect(laporan?.laba).toBe(0);
    expect(sesi.pengendali.state.kas).toBe(MODAL);
  });

  it('save korup: game baru, error di-log, salinan disimpan', async () => {
    const { opsi, penyimpanan, log } = siapkan({ save: '{"schemaVersion":1,"uang":"banyak"' });
    const { sesi, status, laporan } = await SesiGame.mulai(opsi);
    expect(status).toBe('korup');
    expect(laporan).toBeNull();
    expect(sesi.pengendali.state.kas).toBe(MODAL);
    expect(log.some((l) => l.includes('korup'))).toBe(true);
    expect(penyimpanan.isi.get(KUNCI_SAVE_KORUP)).toBe('{"schemaVersion":1,"uang":"banyak"');
  });

  it('storage gagal dibaca/ditulis: tetap jalan, error di-log', async () => {
    const { opsi, penyimpanan, log } = siapkan();
    penyimpanan.gagalBaca = true;
    penyimpanan.gagalTulis = true;
    const { sesi, status } = await SesiGame.mulai(opsi);
    expect(status).toBe('baru');
    expect(log).toHaveLength(2);
    await expect(sesi.simpan()).resolves.toBeUndefined();
  });
});

describe('autosave & lifecycle', () => {
  it('autosave setiap 10 detik waktu main', async () => {
    const { opsi, penyimpanan, waktu } = siapkan({ save: SAVE_OTOMATIS_T0 });
    const { sesi } = await SesiGame.mulai(opsi);
    const stateAwal = sesi.pengendali.state;
    const awal = penyimpanan.jumlahTulis;
    for (let i = 0; i < 99; i++) {
      waktu.sekarang += 100;
      sesi.detak(0.1);
    }
    expect(penyimpanan.jumlahTulis).toBe(awal);
    waktu.sekarang += 100;
    sesi.detak(0.1);
    expect(penyimpanan.jumlahTulis).toBe(awal + 1);
    const tersimpan = deserialisasi(penyimpanan.isi.get(KUNCI_SAVE)!, 0);
    expect(tersimpan.waktuTerakhirMs).toBe(T0 + 10_000);
    expect(tersimpan.kas).toBeCloseTo(jalankan(stateAwal, 10).kas, 3);
  });

  it('kecepatan 3×: waktu main & pendapatan maju 3 kali lebih cepat, autosave tetap per 10 detik nyata', async () => {
    const { opsi, penyimpanan, waktu } = siapkan({ save: SAVE_OTOMATIS_T0 });
    const { sesi } = await SesiGame.mulai(opsi);
    const stateAwal = sesi.pengendali.state;
    const awal = penyimpanan.jumlahTulis;
    for (let i = 0; i < 99; i++) {
      waktu.sekarang += 100;
      sesi.detak(0.1, 3);
    }
    // 9,9 detik nyata = 29,7 detik main, tapi belum autosave.
    expect(sesi.pengendali.state.statistik.waktuMainDetik).toBeCloseTo(29.7, 6);
    expect(penyimpanan.jumlahTulis).toBe(awal);
    waktu.sekarang += 100;
    sesi.detak(0.1, 3);
    expect(penyimpanan.jumlahTulis).toBe(awal + 1);
    const tersimpan = deserialisasi(penyimpanan.isi.get(KUNCI_SAVE)!, 0);
    expect(tersimpan.statistik.waktuMainDetik).toBeCloseTo(30, 6);
    expect(tersimpan.kas).toBeCloseTo(jalankan(stateAwal, 30).kas, 3);
  });

  it('pause menyimpan dan menghentikan sim; resume memberi offline lalu menyimpan', async () => {
    const { opsi, penyimpanan, waktu } = siapkan({ save: SAVE_OTOMATIS_T0 });
    const { sesi } = await SesiGame.mulai(opsi);

    waktu.sekarang += 3000;
    for (let i = 0; i < 30; i++) sesi.detak(0.1); // 3 detik main
    await sesi.jeda();
    expect(sesi.sedangDijeda).toBe(true);
    expect(deserialisasi(penyimpanan.isi.get(KUNCI_SAVE)!, 0).waktuTerakhirMs).toBe(T0 + 3000);

    const saatPause = sesi.pengendali.state;
    sesi.detak(5); // diabaikan selama pause
    expect(sesi.pengendali.state.kas).toBe(saatPause.kas);

    waktu.sekarang += 2 * JAM_MS;
    const laporan = await sesi.lanjut();
    expect(laporan?.detik).toBe(7200);
    expect(laporan?.laba).toBeCloseTo(labaOffline(saatPause, 2 * JAM_MS), 3);
    expect(sesi.perluPopup(laporan)).toBe(true);
    expect(deserialisasi(penyimpanan.isi.get(KUNCI_SAVE)!, 0).waktuTerakhirMs).toBe(waktu.sekarang);
  });

  it('waktu yang sudah disimulasikan tidak dibayar lagi sebagai offline', async () => {
    const { opsi, waktu } = siapkan({ save: SAVE_OTOMATIS_T0 });
    const { sesi } = await SesiGame.mulai(opsi);
    const stateAwal = sesi.pengendali.state;
    // Main 9 detik (belum autosave), lalu langsung pause & resume.
    for (let i = 0; i < 90; i++) {
      waktu.sekarang += 100;
      sesi.detak(0.1);
    }
    await sesi.jeda();
    const laporan = await sesi.lanjut();
    expect(laporan?.detik).toBe(0);
    expect(sesi.pengendali.state.kas).toBeCloseTo(jalankan(stateAwal, 9).kas, 3);
  });

  it('resume tanpa pause diabaikan; pause ganda aman', async () => {
    const { opsi, waktu } = siapkan({ save: SAVE_OTOMATIS_T0 });
    const { sesi } = await SesiGame.mulai(opsi);
    expect(await sesi.lanjut()).toBeNull();
    await sesi.jeda();
    await sesi.jeda();
    waktu.sekarang += JAM_MS;
    expect((await sesi.lanjut())?.detik).toBe(3600);
    expect(await sesi.lanjut()).toBeNull();
  });

  it('popup hanya untuk kepergian ≥ minDetikPopupOffline; tanpa Manajer Operasional terminal tutup', async () => {
    const tanpaManajer = serialisasi(tandaiWaktu({ ...buatStateBaru(T0), kas: 99 }, T0));
    const { opsi, waktu } = siapkan({ save: tanpaManajer, sekarang: T0 + 20_000 });
    const { sesi, laporan } = await SesiGame.mulai(opsi);
    expect(laporan?.tutup).toBe(true);
    expect(laporan?.laba).toBe(0);
    expect(sesi.perluPopup(laporan)).toBe(false); // 20 detik < 30

    await sesi.jeda();
    waktu.sekarang += 60_000;
    const l2 = await sesi.lanjut();
    expect(l2?.laba).toBe(0);
    expect(sesi.perluPopup(l2)).toBe(true);
  });
});

/** Slot yang bisa diatur test: tulis/perbarui mengembalikan save pengganti yang disiapkan. */
class SlotPalsu implements SlotSave {
  isi: string | null = null;
  readonly alasan: AlasanSimpan[] = [];
  penggantiTulis: string | null = null;
  penggantiPerbarui: string | null = null;
  /** Kalau diisi, perbarui() menunggu promise ini dulu. */
  tahanPerbarui: Promise<void> | null = null;

  async baca(): Promise<string | null> {
    return this.isi;
  }

  async tulis(isi: string, alasan: AlasanSimpan): Promise<string | null> {
    this.isi = isi;
    this.alasan.push(alasan);
    const p = this.penggantiTulis;
    this.penggantiTulis = null;
    return p;
  }

  async simpanKorup(): Promise<void> {}

  async perbarui(): Promise<string | null> {
    if (this.tahanPerbarui) await this.tahanPerbarui;
    const p = this.penggantiPerbarui;
    this.penggantiPerbarui = null;
    return p;
  }
}

function siapkanSlot() {
  const slot = new SlotPalsu();
  slot.isi = SAVE_OTOMATIS_T0;
  const waktu = { sekarang: T0 };
  const log: string[] = [];
  const diganti: number[] = [];
  const opsi = {
    slot,
    jam: () => waktu.sekarang,
    logGalat: (p: string) => log.push(p),
    saatSaveDiganti: (l: { detik: number }) => diganti.push(l.detik),
  };
  return { slot, waktu, log, diganti, opsi };
}

/** Save dari perangkat lain: ada Manajer Operasional, kas `kas`, terakhir aktif di `waktuMs`. */
const saveLain = (kas: number, waktuMs: number): string => serialisasi(stateManajer(kas, waktuMs));

describe('slot save & save pengganti', () => {
  it('autosave dikirim sebagai rutin, jeda sebagai penting', async () => {
    const { opsi, slot } = siapkanSlot();
    const { sesi } = await SesiGame.mulai(opsi);
    for (let i = 0; i < 100; i++) sesi.detak(0.1);
    await sesi.jeda();
    expect(slot.alasan).toEqual(['rutin', 'rutin', 'penting']);
  });

  it('slot mengembalikan pengganti saat menyimpan: state diganti, offline sejak save itu, lalu disimpan', async () => {
    const { opsi, slot, diganti } = siapkanSlot();
    const { sesi } = await SesiGame.mulai(opsi);
    slot.penggantiTulis = saveLain(500, T0 - JAM_MS);
    await sesi.simpan();
    const harapan = 500 + labaOffline(stateManajer(500, T0 - JAM_MS), JAM_MS);
    expect(sesi.pengendali.state.kas).toBeCloseTo(harapan, 3);
    expect(diganti).toEqual([3600]);
    expect(deserialisasi(slot.isi!, 0).kas).toBeCloseTo(harapan, 3);
  });

  it('pengganti tidak valid diabaikan dan di-log', async () => {
    const { opsi, slot, log, diganti } = siapkanSlot();
    const { sesi } = await SesiGame.mulai(opsi);
    slot.penggantiTulis = '{"rusak"';
    await sesi.simpan();
    expect(sesi.pengendali.state.kas).toBe(MODAL);
    expect(diganti).toEqual([]);
    expect(log.some((l) => l.includes('pengganti'))).toBe(true);
  });

  it('lanjut: slot punya save lebih baru → state diganti dan laporan dihitung dari save itu', async () => {
    const { opsi, slot, waktu, diganti } = siapkanSlot();
    const { sesi } = await SesiGame.mulai(opsi);
    await sesi.jeda();
    waktu.sekarang += 2 * JAM_MS;
    slot.penggantiPerbarui = saveLain(1000, T0 + JAM_MS);
    const laporan = await sesi.lanjut();
    expect(sesi.sedangDijeda).toBe(false);
    expect(laporan?.detik).toBe(3600);
    expect(sesi.pengendali.state.kas).toBeCloseTo(1000 + labaOffline(stateManajer(1000, T0 + JAM_MS), JAM_MS), 3);
    expect(diganti).toEqual([]); // dilaporkan lewat nilai balik lanjut(), bukan callback
    expect(deserialisasi(slot.isi!, 0).waktuTerakhirMs).toBe(waktu.sekarang);
  });

  it('dijeda lagi saat lanjut menunggu slot: tetap dijeda, pengganti tetap disimpan', async () => {
    const { opsi, slot, waktu } = siapkanSlot();
    const { sesi } = await SesiGame.mulai(opsi);
    await sesi.jeda();
    let lepas = (): void => {};
    slot.tahanPerbarui = new Promise((r) => (lepas = r));
    slot.penggantiPerbarui = saveLain(1000, T0);
    waktu.sekarang += JAM_MS;
    const menunggu = sesi.lanjut();
    await sesi.jeda();
    lepas();
    expect(await menunggu).toBeNull();
    expect(sesi.sedangDijeda).toBe(true);
    expect(deserialisasi(slot.isi!, 0).kas).toBeCloseTo(1000 + labaOffline(stateManajer(1000, T0), JAM_MS), 3);
    // Resume berikutnya jalan normal tanpa membayar ulang waktu yang sama.
    expect((await sesi.lanjut())?.detik).toBe(0);
    expect(sesi.sedangDijeda).toBe(false);
  });
});

describe('hentikan', () => {
  it('menyimpan sekali (penting) lalu tidak menyimpan/resume lagi', async () => {
    const { opsi, slot, waktu } = siapkanSlot();
    const { sesi } = await SesiGame.mulai(opsi);
    await sesi.hentikan();
    expect(slot.alasan).toEqual(['rutin', 'penting']);
    expect(sesi.sudahDihentikan).toBe(true);
    expect(sesi.sedangDijeda).toBe(true);

    for (let i = 0; i < 200; i++) sesi.detak(0.1);
    await sesi.simpan();
    await sesi.jeda();
    waktu.sekarang += JAM_MS;
    expect(await sesi.lanjut()).toBeNull();
    expect(sesi.sedangDijeda).toBe(true);
    expect(slot.alasan).toEqual(['rutin', 'penting']);
  });

  it('pengganti yang datang saat simpan terakhir tetap ditulis', async () => {
    const { opsi, slot } = siapkanSlot();
    const { sesi } = await SesiGame.mulai(opsi);
    slot.penggantiTulis = saveLain(500, T0);
    await sesi.hentikan();
    expect(deserialisasi(slot.isi!, 0).kas).toBe(500);
  });
});
