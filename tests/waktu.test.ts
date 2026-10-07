import { describe, expect, it } from 'vitest';
import { RITME, WAKTU } from '../src/config/waktu.config';
import { arahMatahari, RENTANG_MATAHARI, suasanaLangit, terapkanCuaca, tingkatMalam } from '../src/game/langit';
import { buatStateBaru } from '../src/sim/state';
import { terapkanRitme, type LajuVisual } from '../src/game/laju';
import { keramaianTerminal, tingkatKeramaian, waktuTerminal } from '../src/sim/waktu';
import { buatModel } from '../src/ui/model';
import { T0 } from './helpers';

/** Detik main sampai jam terminal `jam` pada hari ke-`hari` (hari 0 = Senin). */
const detikKe = (hari: number, jam: number, menit = 0): number => (hari * 24 + jam + menit / 60 - WAKTU.jamAwal) * WAKTU.detikPerJam;

describe('jam terminal (24 jam, Senin–Minggu)', () => {
  it('game baru mulai Senin pukul jamAwal, siang hari', () => {
    const w = waktuTerminal(0);
    expect(w).toMatchObject({ hariKe: 0, indeksHari: 0, jam: WAKTU.jamAwal, menit: 0, siang: true });
  });

  it('satu jam terminal = detikPerJam detik main; menit tepat', () => {
    expect(waktuTerminal(WAKTU.detikPerJam * 2.5)).toMatchObject({ jam: WAKTU.jamAwal + 2, menit: 30 });
    expect(waktuTerminal(detikKe(0, 13, 45))).toMatchObject({ jam: 13, menit: 45 });
  });

  it('berganti hari tepat tengah malam; 00.00–23.59', () => {
    expect(waktuTerminal(detikKe(0, 23, 59))).toMatchObject({ indeksHari: 0, jam: 23, menit: 59 });
    expect(waktuTerminal(detikKe(1, 0))).toMatchObject({ indeksHari: 1, hariKe: 1, jam: 0, menit: 0 });
    for (let d = 0; d < 24 * 60; d += 7) {
      const w = waktuTerminal(detikKe(3, 0) + (d * WAKTU.detikPerJam) / 60);
      expect(w.jam).toBeGreaterThanOrEqual(0);
      expect(w.jam).toBeLessThanOrEqual(23);
      expect(w.menit).toBeLessThanOrEqual(59);
      expect(w.jamDesimal).toBeLessThan(24);
    }
  });

  it('siang dari jam terbit sampai sebelum jam terbenam, sisanya malam', () => {
    expect(waktuTerminal(detikKe(2, WAKTU.jamTerbit, 0)).siang).toBe(true);
    expect(waktuTerminal(detikKe(2, WAKTU.jamTerbit - 1, 59)).siang).toBe(false);
    expect(waktuTerminal(detikKe(2, WAKTU.jamTerbenam - 1, 59)).siang).toBe(true);
    expect(waktuTerminal(detikKe(2, WAKTU.jamTerbenam, 0)).siang).toBe(false);
  });

  it('sepekan berputar Senin → Minggu → Senin', () => {
    const hari = Array.from({ length: 9 }, (_, i) => waktuTerminal(detikKe(i, 12)).indeksHari);
    expect(hari).toEqual([0, 1, 2, 3, 4, 5, 6, 0, 1]);
    expect(waktuTerminal(detikKe(8, 12)).hariKe).toBe(8);
  });

  it('HUD: nama hari, jam HH:MM, siang/malam, Minggu ditandai', () => {
    const dengan = (detik: number) => {
      const s = buatStateBaru(T0);
      return buatModel({ ...s, statistik: { ...s.statistik, waktuMainDetik: detik } }).hud.waktu;
    };
    expect(dengan(0)).toMatchObject({ hari: 'Senin', jam: '06:00', siang: true, hariMinggu: false });
    expect(dengan(detikKe(1, 7, 5))).toMatchObject({ hari: 'Selasa', jam: '07:05', siang: true, hariMinggu: false, keramaian: 'sibuk' });
    expect(dengan(detikKe(6, 21, 30))).toMatchObject({ hari: 'Minggu', jam: '21:30', siang: false, hariMinggu: true });
    expect(dengan(detikKe(2, 3, 0)).keramaian).toBe('sepi');
  });
});

describe('ritme keramaian harian', () => {
  const pada = (hari: number, jam: number): number => keramaianTerminal({ indeksHari: hari, jamDesimal: jam });
  const SELASA = 1;

  it('selalu 0–1 dan berubah halus sepanjang pekan, termasuk saat berganti hari', () => {
    let lalu = keramaianTerminal(waktuTerminal(0));
    for (let d = 1; d <= 8 * 24 * 60; d++) {
      const k = keramaianTerminal(waktuTerminal((d * WAKTU.detikPerJam) / 60));
      expect(k).toBeGreaterThanOrEqual(0);
      expect(k).toBeLessThanOrEqual(1);
      expect(Math.abs(k - lalu)).toBeLessThan(0.01);
      lalu = k;
    }
  });

  it('hari biasa: jam sibuk pagi & sore, sepi dini hari, sedang di siang hari', () => {
    expect(pada(SELASA, 7.25)).toBeGreaterThanOrEqual(RITME.ambangLabel.sibuk);
    expect(pada(SELASA, 17.5)).toBeGreaterThanOrEqual(RITME.ambangLabel.sibuk);
    for (let j = 0.5; j <= 4; j += 0.5) expect(pada(SELASA, j)).toBeLessThan(0.2);
    expect(pada(SELASA, 12)).toBeGreaterThan(pada(SELASA, 2) * 3);
    expect(pada(SELASA, 12)).toBeLessThan(pada(SELASA, 7.25));
  });

  it('Senin pagi, Jumat sore, Minggu sore lebih ramai; Minggu pagi lengang', () => {
    expect(pada(0, 6.5)).toBeGreaterThan(pada(SELASA, 6.5) + 0.1);
    for (const hari of [4, 6]) expect(pada(hari, 15.5)).toBeGreaterThan(pada(SELASA, 15.5) + 0.1);
    expect(pada(6, 7.5)).toBeLessThan(pada(SELASA, 7.5) - 0.08);
    expect(pada(5, 11)).toBeGreaterThan(pada(SELASA, 11));
  });

  it('label HUD mengikuti ambang', () => {
    expect(tingkatKeramaian(1)).toBe('sibuk');
    expect(tingkatKeramaian(RITME.ambangLabel.ramai)).toBe('ramai');
    expect(tingkatKeramaian(0.4)).toBe('sedang');
    expect(tingkatKeramaian(0.1)).toBe('sepi');
  });

  it('ritme hanya mengubah permintaan (bus & penumpang datang), kapasitas tahap tetap', () => {
    const laju: LajuVisual = { turun: 1.4, layanLoket: 1.1, naik: 1.3, busDatang: 0.12, muatanBus: 16, faktorKecepatanBus: 1 };
    expect(terapkanRitme(laju, 1)).toMatchObject({ ...laju, kapasitasBus: 16 });
    const sepi = terapkanRitme(laju, 0.15);
    expect(sepi).toMatchObject({ turun: 1.4, layanLoket: 1.1, naik: 1.3, faktorKecepatanBus: 1, kapasitasBus: 16 });
    // Orang/detik yang dibawa bus sebanding keramaian; bus datang lebih jarang & lebih kosong.
    expect(sepi.busDatang * sepi.muatanBus).toBeCloseTo(0.15 * laju.busDatang * laju.muatanBus, 10);
    expect(sepi.muatanBus).toBeLessThan(laju.muatanBus);
    expect(sepi.busDatang).toBeLessThan(laju.busDatang);
    expect(terapkanRitme(laju, 0).busDatang).toBe(0);
  });
});

describe('suasana langit (siang–malam)', () => {
  it('tengah hari terang tanpa lampu, tengah malam gelap dengan lampu menyala', () => {
    const siang = suasanaLangit(12);
    const malam = suasanaLangit(0);
    expect(siang.malam).toBe(0);
    expect(malam.malam).toBe(1);
    expect(siang.intensitasCahaya).toBeGreaterThan(malam.intensitasCahaya * 3);
    expect(siang.intensitasLangit).toBeGreaterThan(malam.intensitasLangit);
    // Latar malam jauh lebih gelap daripada siang.
    const terang = (w: number): number => ((w >> 16) & 0xff) + ((w >> 8) & 0xff) + (w & 0xff);
    expect(terang(malam.warnaLatar)).toBeLessThan(terang(siang.warnaLatar) / 3);
  });

  it('matahari terbit di timur, tertinggi tengah hari, terbenam di barat; selalu di atas cakrawala', () => {
    expect(arahMatahari(7)[0]).toBeGreaterThan(0.5);
    expect(arahMatahari(17)[0]).toBeLessThan(-0.5);
    expect(arahMatahari(12)[1]).toBeGreaterThan(arahMatahari(8)[1]);
    for (let j = 6; j <= 18; j += 0.25) expect(arahMatahari(j)[1]).toBeGreaterThan(0.25);
  });

  it('berubah halus sepanjang hari; cahaya utama padam saat berpindah matahari ↔ bulan', () => {
    let lalu = suasanaLangit(0);
    const kanal = (w: number, g: number): number => (w >> g) & 0xff;
    for (let menit = 1; menit <= 24 * 60; menit++) {
      const s = suasanaLangit(menit / 60);
      expect(Math.abs(s.intensitasCahaya - lalu.intensitasCahaya)).toBeLessThan(0.1);
      expect(Math.abs(s.malam - lalu.malam)).toBeLessThan(0.05);
      for (const g of [16, 8, 0]) expect(Math.abs(kanal(s.warnaLatar, g) - kanal(lalu.warnaLatar, g))).toBeLessThan(16);
      if (s.arahCahaya !== lalu.arahCahaya && s.arahCahaya.some((v, i) => Math.abs(v - lalu.arahCahaya[i]!) > 0.05)) {
        // Arah hanya boleh melompat saat cahaya utama padam.
        expect(s.intensitasCahaya).toBeLessThan(0.02);
      }
      lalu = s;
    }
    for (const j of RENTANG_MATAHARI) expect(suasanaLangit(j).intensitasCahaya).toBeLessThan(0.02);
  });

  it('langit untuk pantulan: zenit lebih biru-gelap dari cakrawala, matahari siang, bulan malam, mendung memucat', () => {
    const kanal = (w: number, g: number): number => (w >> g) & 0xff;
    const terang = (w: number): number => kanal(w, 16) + kanal(w, 8) + kanal(w, 0);
    const siang = suasanaLangit(12);
    expect(terang(siang.warnaZenit)).toBeLessThan(terang(siang.warnaLatar));
    expect(kanal(siang.warnaZenit, 0)).toBeGreaterThan(kanal(siang.warnaZenit, 16)); // biru
    expect(siang.bendaLangit).toBe('matahari');
    expect(suasanaLangit(0).bendaLangit).toBe('bulan');
    expect(siang.mendung).toBe(0);
    // Zenit juga berubah halus sepanjang hari.
    let lalu = suasanaLangit(0);
    for (let menit = 1; menit <= 24 * 60; menit++) {
      const s = suasanaLangit(menit / 60);
      for (const g of [16, 8, 0]) expect(Math.abs(kanal(s.warnaZenit, g) - kanal(lalu.warnaZenit, g))).toBeLessThan(16);
      lalu = s;
    }
    const hujan = terapkanCuaca(siang, 1, 0.5);
    expect(hujan.mendung).toBe(1);
    expect(hujan.kilat).toBe(0.5);
    // Langit mendung kelabu: selisih kanal biru-merah zenit mengecil.
    const biru = (w: number): number => kanal(w, 0) - kanal(w, 16);
    expect(biru(terapkanCuaca(siang, 1).warnaZenit)).toBeLessThan(biru(siang.warnaZenit) / 2);
  });

  it('lampu menyala sepanjang malam dan padam di siang hari', () => {
    expect(tingkatMalam(WAKTU.jamTerbit + 1)).toBe(0);
    expect(tingkatMalam(WAKTU.jamTerbenam - 1)).toBe(0);
    expect(tingkatMalam(WAKTU.jamTerbenam + 1.5)).toBe(1);
    expect(tingkatMalam(3)).toBe(1);
  });
});
