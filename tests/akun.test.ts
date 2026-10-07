import Decimal from 'break_infinity.js';
import { describe, expect, it } from 'vitest';
import {
  bacaAkunAktif,
  hapusDataAkun,
  keluarAkun,
  KUNCI_AKUN_AKTIF,
  KUNCI_SAVE_CADANGAN,
  kunciSaveAkun,
  masukAkun,
  putuskanMasuk,
  putuskanSinkron,
  ringkasSave,
  SlotAkun,
  type HasilUnggah,
  type PenyimpananAwan,
  type PertanyaanKonflik,
  type PilihanKonflik,
  type SaveAwan,
} from '../src/app/akun';
import { KUNCI_SAVE, SesiGame, type Penyimpanan } from '../src/app/sesi';
import { serialisasi } from '../src/sim/save';
import { buatStateBaru } from '../src/sim/state';
import { T0 } from './helpers';

const UID = 'uid-123';
const KUNCI = kunciSaveAkun(UID);

class PenyimpananPalsu implements Penyimpanan {
  readonly isi = new Map<string, string>();

  async baca(kunci: string): Promise<string | null> {
    return this.isi.get(kunci) ?? null;
  }

  async tulis(kunci: string, nilai: string): Promise<void> {
    this.isi.set(kunci, nilai);
  }

  async hapus(kunci: string): Promise<void> {
    this.isi.delete(kunci);
  }
}

/** Cloud di memori dengan tulis bersyarat seperti implementasi sungguhan. */
class AwanPalsu implements PenyimpananAwan {
  dok: SaveAwan | null = null;
  offline = false;
  jumlahUnggah = 0;

  async unduh(): Promise<SaveAwan | null> {
    if (this.offline) throw new Error('offline');
    return this.dok;
  }

  async unggah(isi: string, revisiDasar: number): Promise<HasilUnggah> {
    if (this.offline) throw new Error('offline');
    const revisi = this.dok?.revisi ?? 0;
    if (revisiDasar !== revisi) return { status: 'konflik', awan: this.dok };
    this.jumlahUnggah++;
    this.dok = { isi, revisi: revisi + 1 };
    return { status: 'ok', revisi: revisi + 1 };
  }

  async hapus(): Promise<void> {
    if (this.offline) throw new Error('offline');
    this.dok = null;
  }
}

/** Save dengan uang & total pendapatan tertentu; pendapatan 0 = belum ada progres. */
function buatSave(uang: number, pendapatan: number, waktuMs = T0): string {
  const s = buatStateBaru(T0);
  return serialisasi({
    ...s,
    uang: new Decimal(uang),
    statistik: { ...s.statistik, totalPendapatanSepanjangMasa: new Decimal(pendapatan) },
    waktuTerakhirMs: waktuMs,
  });
}

const KOSONG = buatSave(20, 0);
const SAVE_A = buatSave(1000, 5000);
const SAVE_B = buatSave(3000, 9000);

function siapkan(jawaban: PilihanKonflik = 'lokal') {
  const penyimpanan = new PenyimpananPalsu();
  const awan = new AwanPalsu();
  const waktu = { sekarang: T0 };
  const pertanyaan: PertanyaanKonflik[] = [];
  const log: string[] = [];
  const opsi = {
    uid: UID,
    penyimpanan,
    awan,
    jam: () => waktu.sekarang,
    logGalat: (p: string) => log.push(p),
    tanya: async (p: PertanyaanKonflik) => {
      pertanyaan.push(p);
      return jawaban;
    },
  };
  const catatan = (isi: string, revisi: number, bersih: boolean): void => {
    penyimpanan.isi.set(KUNCI.save, JSON.stringify({ isi, revisi, bersih }));
  };
  const bacaCatatan = (): { isi: string; revisi: number; bersih: boolean } => JSON.parse(penyimpanan.isi.get(KUNCI.save)!);
  return { penyimpanan, awan, waktu, pertanyaan, log, opsi, catatan, bacaCatatan };
}

describe('ringkasSave', () => {
  it('meringkas save; kosong atau korup → null', () => {
    const r = ringkasSave(SAVE_A);
    expect(r?.uang.toNumber()).toBe(1000);
    expect(r?.totalPendapatan.toNumber()).toBe(5000);
    expect(r?.totalLevel).toBe(3);
    expect(ringkasSave(null)).toBeNull();
    expect(ringkasSave('{"rusak"')).toBeNull();
  });
});

describe('putuskanSinkron (save akun di perangkat ini vs cloud)', () => {
  const lokal = (isi: string, revisi: number, bersih: boolean) => ({ isi, revisi, bersih });

  it('salah satu belum ada atau isinya sama', () => {
    expect(putuskanSinkron(lokal(SAVE_A, 1, false), null).pakai).toBe('lokal');
    expect(putuskanSinkron(null, { isi: SAVE_A, revisi: 2 }).pakai).toBe('awan');
    expect(putuskanSinkron(lokal(SAVE_A, 1, false), { isi: SAVE_A, revisi: 5 }).pakai).toBe('awan');
  });

  it('cloud belum berubah sejak sinkron terakhir → perangkat ini', () => {
    expect(putuskanSinkron(lokal(SAVE_A, 3, false), { isi: SAVE_B, revisi: 3 }).pakai).toBe('lokal');
  });

  it('pindah perangkat biasa: hanya cloud yang berubah → cloud tanpa bertanya', () => {
    expect(putuskanSinkron(lokal(SAVE_A, 3, true), { isi: SAVE_B, revisi: 4 }).pakai).toBe('awan');
  });

  it('keduanya berubah dan punya progres → tanya, dengan ringkasan keduanya', () => {
    const k = putuskanSinkron(lokal(SAVE_A, 3, false), { isi: SAVE_B, revisi: 4 });
    expect(k.pakai).toBe('tanya');
    if (k.pakai !== 'tanya') return;
    expect(k.lokal.uang.toNumber()).toBe(1000);
    expect(k.awan.uang.toNumber()).toBe(3000);
    // Revisi cloud mundur (anomali) juga ditanyakan.
    expect(putuskanSinkron(lokal(SAVE_A, 7, true), { isi: SAVE_B, revisi: 4 }).pakai).toBe('tanya');
  });

  it('keduanya berubah tapi salah satu tanpa progres → yang berprogres', () => {
    expect(putuskanSinkron(lokal(KOSONG, 3, false), { isi: SAVE_B, revisi: 4 }).pakai).toBe('awan');
    expect(putuskanSinkron(lokal(SAVE_A, 3, false), { isi: KOSONG, revisi: 4 }).pakai).toBe('lokal');
    expect(putuskanSinkron(lokal(SAVE_A, 3, false), { isi: '{"rusak"', revisi: 4 }).pakai).toBe('lokal');
  });
});

describe('putuskanMasuk (save tamu vs save akun)', () => {
  it('tabel login', () => {
    expect(putuskanMasuk(null, null).pakai).toBe('awan');
    expect(putuskanMasuk(KOSONG, null).pakai).toBe('awan');
    expect(putuskanMasuk(SAVE_A, null).pakai).toBe('lokal');
    expect(putuskanMasuk(KOSONG, SAVE_B).pakai).toBe('awan');
    expect(putuskanMasuk(SAVE_A, KOSONG).pakai).toBe('lokal');
    expect(putuskanMasuk(SAVE_A, SAVE_A).pakai).toBe('awan');
    expect(putuskanMasuk(SAVE_A, SAVE_B).pakai).toBe('tanya');
  });
});

describe('SlotAkun: memuat', () => {
  it('perangkat baru: pakai save cloud', async () => {
    const { opsi, awan } = siapkan();
    awan.dok = { isi: SAVE_A, revisi: 4 };
    expect(await new SlotAkun(opsi).baca()).toBe(SAVE_A);
  });

  it('belum ada di mana pun → null (game baru)', async () => {
    const { opsi } = siapkan();
    expect(await new SlotAkun(opsi).baca()).toBeNull();
  });

  it('save perangkat ini bersih, cloud lebih baru → cloud tanpa bertanya', async () => {
    const { opsi, awan, catatan, pertanyaan } = siapkan();
    catatan(SAVE_A, 1, true);
    awan.dok = { isi: SAVE_B, revisi: 3 };
    expect(await new SlotAkun(opsi).baca()).toBe(SAVE_B);
    expect(pertanyaan).toHaveLength(0);
  });

  it('keduanya berubah → pemain ditanya; pilih perangkat ini → unggahan berikutnya menimpa cloud', async () => {
    const { opsi, awan, catatan, pertanyaan } = siapkan('lokal');
    catatan(SAVE_A, 1, false);
    awan.dok = { isi: SAVE_B, revisi: 2 };
    const slot = new SlotAkun(opsi);
    expect(await slot.baca()).toBe(SAVE_A);
    expect(pertanyaan.map((p) => p.situasi)).toEqual(['sinkron']);

    const baru = buatSave(1100, 5100);
    expect(await slot.tulis(baru, 'penting')).toBeNull();
    expect(awan.dok).toEqual({ isi: baru, revisi: 3 });
  });

  it('cloud tak terjangkau → pakai save perangkat ini', async () => {
    const { opsi, awan, catatan, log } = siapkan();
    catatan(SAVE_A, 1, false);
    awan.offline = true;
    expect(await new SlotAkun(opsi).baca()).toBe(SAVE_A);
    expect(log.some((l) => l.includes('tidak terjangkau'))).toBe(true);
  });

  it('save akun di perangkat ini korup → salinan disimpan, cloud dipakai', async () => {
    const { opsi, awan, penyimpanan } = siapkan();
    penyimpanan.isi.set(KUNCI.save, '{"isi":');
    awan.dok = { isi: SAVE_B, revisi: 2 };
    expect(await new SlotAkun(opsi).baca()).toBe(SAVE_B);
    expect(penyimpanan.isi.get(KUNCI.korup)).toBe('{"isi":');
  });
});

describe('SlotAkun: menyimpan & mengunggah', () => {
  it('lokal tiap tulis; unggah rutin paling sering tiap 60 detik; penting langsung', async () => {
    const { opsi, awan, waktu, bacaCatatan } = siapkan();
    const slot = new SlotAkun(opsi);
    await slot.baca();

    waktu.sekarang += 10_000;
    await slot.tulis(buatSave(30, 10), 'rutin');
    expect(bacaCatatan()).toMatchObject({ revisi: 0, bersih: false });
    waktu.sekarang += 49_000; // 59 detik sejak mulai
    await slot.tulis(buatSave(40, 20), 'rutin');
    expect(awan.jumlahUnggah).toBe(0);

    waktu.sekarang += 1_000;
    const isi60 = buatSave(50, 30);
    await slot.tulis(isi60, 'rutin');
    expect(awan.dok).toEqual({ isi: isi60, revisi: 1 });
    expect(bacaCatatan()).toEqual({ isi: isi60, revisi: 1, bersih: true });

    waktu.sekarang += 10_000;
    const isiJeda = buatSave(60, 40);
    await slot.tulis(isiJeda, 'penting');
    expect(awan.dok).toEqual({ isi: isiJeda, revisi: 2 });
  });

  it('gagal unggah (offline): tetap tersimpan lokal sebagai belum bersih, dicoba lagi nanti', async () => {
    const { opsi, awan, bacaCatatan } = siapkan();
    const slot = new SlotAkun(opsi);
    await slot.baca();
    awan.offline = true;
    await slot.tulis(SAVE_A, 'penting');
    expect(bacaCatatan()).toEqual({ isi: SAVE_A, revisi: 0, bersih: false });
    awan.offline = false;
    await slot.tulis(SAVE_A, 'penting');
    expect(awan.dok).toEqual({ isi: SAVE_A, revisi: 1 });
  });

  it('konflik saat unggah (perangkat lain menulis): pilih cloud → save pengganti dikembalikan', async () => {
    const { opsi, awan, pertanyaan } = siapkan('awan');
    const slot = new SlotAkun(opsi);
    await slot.baca();
    await slot.tulis(SAVE_A, 'penting');
    awan.dok = { isi: SAVE_B, revisi: 2 }; // perangkat lain
    expect(await slot.tulis(buatSave(1100, 5100), 'penting')).toBe(SAVE_B);
    expect(pertanyaan.map((p) => p.situasi)).toEqual(['sinkron']);
    expect(awan.dok).toEqual({ isi: SAVE_B, revisi: 2 });
  });

  it('konflik saat unggah: pilih perangkat ini → cloud ditimpa di atas revisi terbarunya', async () => {
    const { opsi, awan } = siapkan('lokal');
    const slot = new SlotAkun(opsi);
    await slot.baca();
    await slot.tulis(SAVE_A, 'penting');
    awan.dok = { isi: SAVE_B, revisi: 2 };
    const baru = buatSave(1100, 5100);
    expect(await slot.tulis(baru, 'penting')).toBeNull();
    expect(awan.dok).toEqual({ isi: baru, revisi: 3 });
  });

  it('konflik dengan cloud tanpa progres: ditimpa tanpa bertanya', async () => {
    const { opsi, awan, pertanyaan } = siapkan();
    const slot = new SlotAkun(opsi);
    await slot.baca();
    awan.dok = { isi: KOSONG, revisi: 1 };
    expect(await slot.tulis(SAVE_A, 'penting')).toBeNull();
    expect(pertanyaan).toHaveLength(0);
    expect(awan.dok).toEqual({ isi: SAVE_A, revisi: 2 });
  });
});

describe('SlotAkun: kembali dari background', () => {
  it('perangkat lain menulis saat app di background → versi cloud dipakai tanpa bertanya', async () => {
    const { opsi, awan, pertanyaan } = siapkan();
    const slot = new SlotAkun(opsi);
    await slot.baca();
    await slot.tulis(SAVE_A, 'penting');
    awan.dok = { isi: SAVE_B, revisi: 2 };
    expect(await slot.perbarui()).toBe(SAVE_B);
    expect(pertanyaan).toHaveLength(0);
    // Sudah sama dengan cloud: tidak ada yang perlu diganti lagi.
    expect(await slot.perbarui()).toBeNull();
  });

  it('cloud tidak berubah atau tak terjangkau → null', async () => {
    const { opsi, awan } = siapkan();
    const slot = new SlotAkun(opsi);
    await slot.baca();
    await slot.tulis(SAVE_A, 'penting');
    expect(await slot.perbarui()).toBeNull();
    awan.offline = true;
    expect(await slot.perbarui()).toBeNull();
  });

  it('terpasang di SesiGame: resume memuat progres dari perangkat lain', async () => {
    const { opsi, awan, waktu } = siapkan();
    const { sesi } = await SesiGame.mulai({ slot: new SlotAkun(opsi), jam: () => waktu.sekarang });
    waktu.sekarang += 5_000;
    await sesi.jeda();
    expect(awan.dok?.revisi).toBe(1);

    awan.dok = { isi: buatSave(3000, 9000, T0 + 10_000), revisi: 2 };
    waktu.sekarang += 60_000;
    await sesi.lanjut();
    expect(sesi.pengendali.state.uang.toNumber()).toBe(3000);
    expect(sesi.sedangDijeda).toBe(false);
  });
});

describe('login, logout, hapus akun', () => {
  it('tamu berprogres, akun baru → save tamu pindah ke akun', async () => {
    const { opsi, penyimpanan, bacaCatatan } = siapkan();
    penyimpanan.isi.set(KUNCI_SAVE, SAVE_A);
    await masukAkun(opsi);
    expect(bacaCatatan()).toEqual({ isi: SAVE_A, revisi: 0, bersih: false });
    expect(penyimpanan.isi.has(KUNCI_SAVE)).toBe(false);
    expect(penyimpanan.isi.has(KUNCI_SAVE_CADANGAN)).toBe(false);
    expect(await bacaAkunAktif(penyimpanan)).toBe(UID);
  });

  it('tamu tanpa progres, akun punya save → pakai save akun tanpa bertanya', async () => {
    const { opsi, penyimpanan, awan, pertanyaan, bacaCatatan } = siapkan();
    penyimpanan.isi.set(KUNCI_SAVE, KOSONG);
    awan.dok = { isi: SAVE_B, revisi: 4 };
    await masukAkun(opsi);
    expect(pertanyaan).toHaveLength(0);
    expect(bacaCatatan()).toEqual({ isi: SAVE_B, revisi: 4, bersih: true });
    expect(penyimpanan.isi.has(KUNCI_SAVE)).toBe(false);
  });

  it('keduanya berprogres → tanya; pilih tamu → akun memakai save tamu, save akun lama dicadangkan', async () => {
    const { opsi, penyimpanan, awan, pertanyaan } = siapkan('lokal');
    penyimpanan.isi.set(KUNCI_SAVE, SAVE_A);
    awan.dok = { isi: SAVE_B, revisi: 4 };
    await masukAkun(opsi);
    expect(pertanyaan.map((p) => p.situasi)).toEqual(['masuk']);
    expect(penyimpanan.isi.get(KUNCI_SAVE_CADANGAN)).toBe(SAVE_B);

    // Sesi akun berikutnya memakai save tamu dan menimpa cloud saat sinkron.
    const slot = new SlotAkun(opsi);
    expect(await slot.baca()).toBe(SAVE_A);
    await slot.tulis(SAVE_A, 'penting');
    expect(awan.dok).toEqual({ isi: SAVE_A, revisi: 5 });
  });

  it('pilih save akun → save tamu dicadangkan', async () => {
    const { opsi, penyimpanan, awan, bacaCatatan } = siapkan('awan');
    penyimpanan.isi.set(KUNCI_SAVE, SAVE_A);
    awan.dok = { isi: SAVE_B, revisi: 4 };
    await masukAkun(opsi);
    expect(bacaCatatan().isi).toBe(SAVE_B);
    expect(penyimpanan.isi.get(KUNCI_SAVE_CADANGAN)).toBe(SAVE_A);
  });

  it('cloud tak terjangkau atau dialog dibatalkan → login batal, tidak ada yang berubah', async () => {
    const offline = siapkan();
    offline.penyimpanan.isi.set(KUNCI_SAVE, SAVE_A);
    offline.awan.offline = true;
    await expect(masukAkun(offline.opsi)).rejects.toThrow('offline');
    expect(offline.penyimpanan.isi.get(KUNCI_SAVE)).toBe(SAVE_A);
    expect(await bacaAkunAktif(offline.penyimpanan)).toBeNull();

    const batal = siapkan();
    batal.penyimpanan.isi.set(KUNCI_SAVE, SAVE_A);
    batal.awan.dok = { isi: SAVE_B, revisi: 1 };
    await expect(masukAkun({ ...batal.opsi, tanya: () => Promise.reject(new Error('batal')) })).rejects.toThrow('batal');
    expect(batal.penyimpanan.isi.get(KUNCI_SAVE)).toBe(SAVE_A);
    expect(batal.penyimpanan.isi.has(KUNCI.save)).toBe(false);
    expect(await bacaAkunAktif(batal.penyimpanan)).toBeNull();
  });

  it('sesi tamu dihentikan setelah pilihan dibuat; save tamu final yang dipindah', async () => {
    const { opsi, penyimpanan, awan, bacaCatatan } = siapkan('lokal');
    penyimpanan.isi.set(KUNCI_SAVE, SAVE_A);
    awan.dok = { isi: SAVE_B, revisi: 1 };
    const final = buatSave(1200, 5200);
    const urutan: string[] = [];
    await masukAkun({
      ...opsi,
      tanya: async () => {
        urutan.push('tanya');
        return 'lokal';
      },
      hentikanTamu: async () => {
        urutan.push('hentikan');
        penyimpanan.isi.set(KUNCI_SAVE, final); // simpan terakhir sesi tamu
      },
    });
    expect(urutan).toEqual(['tanya', 'hentikan']);
    expect(bacaCatatan().isi).toBe(final);
  });

  it('login batal: sesi tamu tidak dihentikan', async () => {
    const { opsi, penyimpanan, awan } = siapkan();
    penyimpanan.isi.set(KUNCI_SAVE, SAVE_A);
    awan.offline = true;
    let dihentikan = false;
    const hentikanTamu = async (): Promise<void> => {
      dihentikan = true;
    };
    await expect(masukAkun({ ...opsi, hentikanTamu })).rejects.toThrow();
    expect(dihentikan).toBe(false);
  });

  it('logout → tamu baru; save akun tetap di perangkat', async () => {
    const { opsi, penyimpanan } = siapkan();
    penyimpanan.isi.set(KUNCI_SAVE, SAVE_A);
    await masukAkun(opsi);
    await keluarAkun(penyimpanan);
    expect(await bacaAkunAktif(penyimpanan)).toBeNull();
    expect(penyimpanan.isi.has(KUNCI_SAVE)).toBe(false);
    expect(penyimpanan.isi.has(KUNCI.save)).toBe(true);
  });

  it('hapus akun: cloud & perangkat dibersihkan; cloud gagal → lokal tidak disentuh', async () => {
    const { opsi, penyimpanan, awan } = siapkan();
    penyimpanan.isi.set(KUNCI_SAVE, SAVE_A);
    await masukAkun(opsi);
    await new SlotAkun(opsi).tulis(SAVE_A, 'penting');
    expect(awan.dok).not.toBeNull();

    awan.offline = true;
    await expect(hapusDataAkun(opsi)).rejects.toThrow();
    expect(penyimpanan.isi.has(KUNCI.save)).toBe(true);

    awan.offline = false;
    await hapusDataAkun(opsi);
    expect(awan.dok).toBeNull();
    expect(penyimpanan.isi.has(KUNCI.save)).toBe(false);
    expect(penyimpanan.isi.has(KUNCI_AKUN_AKTIF)).toBe(false);
  });

  it('hapus akun: skor papan peringkat dihapus lebih dulu; gagal → cloud save & perangkat tidak disentuh', async () => {
    const { opsi, penyimpanan, awan } = siapkan();
    penyimpanan.isi.set(KUNCI_SAVE, SAVE_A);
    await masukAkun(opsi);
    await new SlotAkun(opsi).tulis(SAVE_A, 'penting');
    const urutan: string[] = [];
    await expect(
      hapusDataAkun({
        ...opsi,
        hapusPeringkat: async () => {
          throw new Error('papan peringkat tidak terjangkau');
        },
      }),
    ).rejects.toThrow();
    expect(awan.dok).not.toBeNull();
    expect(penyimpanan.isi.has(KUNCI.save)).toBe(true);
    await hapusDataAkun({ ...opsi, hapusPeringkat: async () => void urutan.push('peringkat') });
    expect(urutan).toEqual(['peringkat']);
    expect(awan.dok).toBeNull();
  });
});
