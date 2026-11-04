import { describe, expect, it } from 'vitest';
import { AntreanPerayaan, JEDA_PERAYAAN_DETIK, perluPeresmianSusulan, TAHAP_SAYAP_2_LANTAI } from '../src/app/peresmian-bentuk';
import { KembangApi } from '../src/game/kembang-api';
import { antreNotif, MAKS_ANTREAN_NOTIF, notifBahaya, type PesanNotif } from '../src/ui/notifikasi';
import { EFEK_PERLUASAN, NAMA_PERLUASAN, TEKS } from '../src/ui/teks';

const DT = 0.1;
const bebas = (): boolean => false;
const terhalang = (): boolean => true;

describe('antrean perayaan: proyek selesai saat offline (AC-GP-03)', () => {
  it('kembang api menunggu popup ditutup, lalu tayang sekali untuk tahap itu', () => {
    const a = new AntreanPerayaan(true);
    a.catatProyekOffline(2, false);
    expect(a.ambil(DT, 2, terhalang)).toBeNull();
    expect(a.ambil(DT, 2, bebas)).toEqual({ kembangApi: 2, susulan: false });
    for (let i = 0; i < 200; i++) expect(a.ambil(DT, 2, bebas)).toBeNull();
  });

  it('popup tanpa proyek selesai tidak memicu apa-apa', () => {
    const a = new AntreanPerayaan(true);
    for (let i = 0; i < 200; i++) expect(a.ambil(DT, 3, bebas)).toBeNull();
  });

  it('tiap tahap dirayakan di tahapnya sendiri', () => {
    for (const tahap of [1, 2, 3, 4, 5]) {
      const a = new AntreanPerayaan(true);
      a.catatProyekOffline(tahap, false);
      expect(a.ambil(DT, tahap, bebas)).toEqual({ kembangApi: tahap, susulan: false });
    }
  });

  it('tutorial tidak menahan kembang api proyek, tapi menahan peresmian susulan', () => {
    const tutorialTerbuka = (susulan: boolean): boolean => susulan;
    const a = new AntreanPerayaan(true);
    a.catatProyekOffline(2, false);
    expect(a.ambil(DT, 2, tutorialTerbuka)).toEqual({ kembangApi: 2, susulan: false });
    const b = new AntreanPerayaan(false);
    expect(b.ambil(DT, 3, tutorialTerbuka)).toBeNull();
  });

  it('sesi yang sudah berjalan: adegan merayakan sendiri, jadi tidak dipanggil lagi, dan waktunya ditahan selama popup', () => {
    const a = new AntreanPerayaan(true);
    expect(a.tahanAdegan).toBe(false);
    a.catatProyekOffline(3, true);
    expect(a.tahanAdegan).toBe(true);
    expect(a.ambil(DT, 3, terhalang)).toBeNull();
    expect(a.tahanAdegan).toBe(true);
    expect(a.ambil(DT, 3, bebas)).toEqual({ kembangApi: null, susulan: false });
    expect(a.tahanAdegan).toBe(false);
    for (let i = 0; i < 200; i++) expect(a.ambil(DT, 3, bebas)).toBeNull();
  });

  it('muat dingin tidak menahan waktu adegan', () => {
    const a = new AntreanPerayaan(true);
    a.catatProyekOffline(3, false);
    expect(a.tahanAdegan).toBe(false);
  });

  it('laporan baru tidak tertahan jeda perayaan sebelumnya, jadi adegan tidak membeku tanpa popup', () => {
    const a = new AntreanPerayaan(false);
    expect(a.ambil(DT, 3, bebas)).toEqual({ kembangApi: 3, susulan: true });
    a.catatProyekOffline(4, true);
    expect(a.ambil(DT, 4, bebas)).toEqual({ kembangApi: null, susulan: false });
    expect(a.tahanAdegan).toBe(false);
  });
});

describe('antrean perayaan: bertemu peresmian susulan (AC-GP-02 + AC-GP-03)', () => {
  it('proyek tahap 3 selesai pada jalan pertama: satu kembang api, dengan toast susulan', () => {
    const a = new AntreanPerayaan(false);
    a.catatProyekOffline(3, false);
    expect(a.ambil(DT, 3, terhalang)).toBeNull();
    expect(a.ambil(DT, 3, bebas)).toEqual({ kembangApi: 3, susulan: true });
    for (let i = 0; i < 200; i++) expect(a.ambil(DT, 3, bebas)).toBeNull();
  });

  it('proyek tahap 4–5 selesai pada jalan pertama: proyek dulu, jeda, baru susulan di tahap 3', () => {
    for (const tahap of [4, 5]) {
      const a = new AntreanPerayaan(false);
      a.catatProyekOffline(tahap, false);
      expect(a.ambil(DT, tahap, bebas)).toEqual({ kembangApi: tahap, susulan: false });
      let langkah = 0;
      let p = null;
      while (p === null && langkah < 200) {
        p = a.ambil(DT, tahap, bebas);
        langkah++;
      }
      expect(p).toEqual({ kembangApi: TAHAP_SAYAP_2_LANTAI, susulan: true });
      expect(langkah * DT).toBeGreaterThanOrEqual(JEDA_PERAYAAN_DETIK - 1e-9);
      for (let i = 0; i < 200; i++) expect(a.ambil(DT, tahap, bebas)).toBeNull();
    }
  });

  it('dua kembang api berurutan tidak pernah tumpang tindih di KembangApi asli', () => {
    for (const tahap of [4, 5]) {
      const api = new KembangApi();
      const a = new AntreanPerayaan(false);
      a.catatProyekOffline(tahap, false);
      let tayang = 0;
      for (let i = 0; i < 300; i++) {
        const p = a.ambil(DT, tahap, bebas);
        if (p?.kembangApi) {
          expect(api.aktif).toBe(false);
          api.rayakan(0, 0, 3, 11 + p.kembangApi);
          tayang++;
        }
        api.perbarui(DT);
      }
      expect(tayang).toBe(2);
    }
  });

  it('frame panjang (kompilasi shader di frame pertama) tidak menghabiskan jeda: tetap tidak tumpang tindih', () => {
    for (const dtPanjang of [0.5, 7, 60]) {
      const api = new KembangApi();
      const a = new AntreanPerayaan(false);
      a.catatProyekOffline(5, false);
      let tayang = 0;
      for (let i = 0; i < 300; i++) {
        // Frame sesudah kembang api pertama dipanggil membawa dt besar, seperti di dev server (7 detik).
        const dt = i === 1 ? dtPanjang : 0.016;
        const p = a.ambil(dt, 5, bebas);
        if (p?.kembangApi) {
          expect(api.aktif).toBe(false);
          api.rayakan(0, 0, 3, 11 + p.kembangApi);
          tayang++;
        }
        // Jam kembang api di adegan: Terminal3D.perbarui membatasi dt nyata 0,1 detik per frame.
        api.perbarui(Math.min(dt, 0.1));
      }
      expect(tayang).toBe(1);
    }
  });

  it('sesi berjalan dengan susulan yang masih tertunda: adegan merayakan proyeknya, jeda, lalu susulan dipanggil', () => {
    const a = new AntreanPerayaan(false);
    a.catatProyekOffline(4, true);
    expect(a.ambil(DT, 4, bebas)).toEqual({ kembangApi: null, susulan: false });
    let langkah = 0;
    let p = null;
    while (p === null && langkah < 200) {
      p = a.ambil(DT, 4, bebas);
      langkah++;
    }
    expect(p).toEqual({ kembangApi: TAHAP_SAYAP_2_LANTAI, susulan: true });
    expect(langkah * DT).toBeGreaterThanOrEqual(JEDA_PERAYAAN_DETIK - 1e-9);
  });

  it('susulan menunggu popup yang muncul selama jeda', () => {
    const a = new AntreanPerayaan(false);
    a.catatProyekOffline(4, false);
    a.ambil(DT, 4, bebas);
    for (let i = 0; i < 100; i++) expect(a.ambil(DT, 4, terhalang)).toBeNull();
    expect(a.ambil(DT, 4, bebas)).toEqual({ kembangApi: TAHAP_SAYAP_2_LANTAI, susulan: true });
  });

  it('tanda sudah ada: hanya kembang api proyek', () => {
    const a = new AntreanPerayaan(true);
    a.catatProyekOffline(4, false);
    expect(a.ambil(DT, 4, bebas)).toEqual({ kembangApi: 4, susulan: false });
    for (let i = 0; i < 200; i++) expect(a.ambil(DT, 4, bebas)).toBeNull();
  });

  it('peresmian susulan saja, tanpa laporan offline', () => {
    const a = new AntreanPerayaan(false);
    expect(a.ambil(DT, 3, terhalang)).toBeNull();
    expect(a.ambil(DT, 5, bebas)).toEqual({ kembangApi: TAHAP_SAYAP_2_LANTAI, susulan: true });
    for (let i = 0; i < 200; i++) expect(a.ambil(DT, 5, bebas)).toBeNull();
  });
});

describe('peresmian susulan Sayap 2 Lantai (documents/16 bagian 7)', () => {
  it('tahap ≥ 3 tanpa tanda menayangkan, termasuk tahap 4–5', () => {
    for (const tahap of [3, 4, 5]) expect(perluPeresmianSusulan(tahap, false)).toBe(true);
  });

  it('tahap < 3 tidak menayangkan', () => {
    for (const tahap of [0, 1, 2]) expect(perluPeresmianSusulan(tahap, false)).toBe(false);
  });

  it('tanda sudah ada: tidak menayangkan di tahap mana pun (jalan kedua)', () => {
    for (const tahap of [0, 1, 2, 3, 4, 5]) expect(perluPeresmianSusulan(tahap, true)).toBe(false);
  });

  it('kembang apinya selalu untuk Perluasan 3: tahap 4–5 merayakan gedung yang sama', () => {
    expect(TAHAP_SAYAP_2_LANTAI).toBe(3);
  });

  it('toast peresmian melompati antrean yang penuh, jadi tidak terbuang', () => {
    expect(notifBahaya(TEKS.notifPeresmianBentuk)).toBe(true);
    const penuh: PesanNotif[] = ['a', 'b', 'c'].map((teks) => ({ teks }));
    expect(penuh).toHaveLength(MAKS_ANTREAN_NOTIF);
    const hasil = antreNotif(penuh, { teks: TEKS.notifPeresmianBentuk, bahaya: true });
    expect(hasil.map((p) => p.teks)).toEqual([TEKS.notifPeresmianBentuk, 'a', 'b']);
  });

  it('pesan bahaya tetap di depan toast peresmian', () => {
    const antrean: PesanNotif[] = [{ teks: TEKS.notifKasMenipis, bahaya: true }];
    const hasil = antreNotif(antrean, { teks: TEKS.notifPeresmianBentuk, bahaya: true });
    expect(hasil.map((p) => p.teks)).toEqual([TEKS.notifKasMenipis, TEKS.notifPeresmianBentuk]);
  });
});

describe('teks Perluasan 3 (documents/16 bagian 4.5 & 9.3, playtest P-1 & P-2)', () => {
  it('nama & deskripsi kartu', () => {
    expect(NAMA_PERLUASAN[2]).toEqual({
      nama: 'Sayap\u00a02\u00a0lantai',
      deskripsi: 'Loket, ruang tunggu & food court: jendela +4, petak bus +10, kursi, toko, toilet; sesudahnya naik level menambah slot jendela & jalur',
    });
  });

  it('efek singkat tidak berubah', () => {
    expect(EFEK_PERLUASAN[2]).toBe('lantai 2, jendela +4, izin level');
  });

  it('nama gedung tidak bisa terpotong: spasi tak terputus, tanpa spasi biasa', () => {
    expect(NAMA_PERLUASAN[2]!.nama).not.toMatch(/ /);
    expect(NAMA_PERLUASAN[2]!.nama.replace(/\u00a0/g, ' ')).toBe('Sayap 2 lantai');
  });

  it('toast selesai & toast peresmian susulan', () => {
    expect(TEKS.notifPerluasan(3, NAMA_PERLUASAN[2]!.nama)).toBe('🏗️ Perluasan 3 selesai: Sayap\u00a02\u00a0lantai!');
    expect(TEKS.notifPeresmianBentuk).toBe('🎉 Perluasan 3 kini punya gedung: Sayap\u00a02\u00a0lantai!');
    expect(TEKS.notifPeresmianBentuk).toContain(NAMA_PERLUASAN[2]!.nama);
  });

  it('popup offline menyebut gedungnya', () => {
    expect(TEKS.offlineProyekSelesai(3, NAMA_PERLUASAN[2]!.nama)).toBe('🏗️ Perluasan 3 selesai selama kamu pergi: Sayap\u00a02\u00a0lantai!');
    expect(TEKS.offlineProyekSelesai(1, NAMA_PERLUASAN[0]!.nama)).toBe('🏗️ Perluasan 1 selesai selama kamu pergi: Aula loket diperluas!');
    expect(TEKS.offlineProyekSelesai(6, '')).toBe('🏗️ Perluasan 6 selesai selama kamu pergi!');
  });
});
