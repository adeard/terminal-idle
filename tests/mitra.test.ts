import { describe, expect, it } from 'vitest';
import { EKONOMI } from '../src/config/economy.config';
import { PO_IDS } from '../src/sim/fitur';
import { kelasDariLevel, levelMinimalKelas, levelTerminalDariXp, slotPo, xpKumulatifTerminal } from '../src/sim/level-terminal';
import {
  faktorReputasi,
  hariKontrakPertama,
  indeksJurusan,
  jurusanAktif,
  kelasAktif,
  levelPoDariXp,
  majukanReputasi,
  nilaiJurusan,
  nilaiTiketPo,
  sisaSetelahPerpanjang,
  syaratDaftarKurang,
  targetReputasi,
  xpKumulatifPo,
  xpLevelPo,
} from '../src/sim/mitra';
import { biayaPerluasan, levelCukupPerluasan, tahapPerluasanBerikutnya } from '../src/sim/perluasan';

const M = EKONOMI.mitra;

describe('data mitra PO', () => {
  it('semua jurusan PO ada di EKONOMI.jurusan dan semua jurusan punya nilai tiket', () => {
    for (const id of PO_IDS) for (const nama of M.po[id].jurusan) expect(indeksJurusan(nama), `${id}: ${nama}`).toBeGreaterThanOrEqual(0);
    for (const j of EKONOMI.jurusan) expect(M.nilaiJurusan[j.nama], j.nama).toBeGreaterThan(0);
  });

  it('nilai jurusan naik ke rute yang lebih jauh; jurusan tak dikenal bernilai 1', () => {
    expect(nilaiJurusan(indeksJurusan('JAKARTA'))).toBe(1);
    expect(nilaiJurusan(indeksJurusan('DENPASAR'))).toBeGreaterThan(nilaiJurusan(indeksJurusan('SURABAYA')));
    expect(nilaiJurusan(indeksJurusan('BANDA ACEH'))).toBeGreaterThan(nilaiJurusan(indeksJurusan('MEDAN')));
    expect(nilaiJurusan(999)).toBe(1);
  });

  it('jurusan pertama tiap PO bisa dilayani di kelas terminal syarat daftarnya', () => {
    for (const id of PO_IDS) expect(jurusanAktif(id, 1, M.po[id].kelasTerminal).length, id).toBe(1);
  });

  it('tepat satu PO awal', () => {
    expect(PO_IDS.filter((id) => M.po[id].sumber === 'awal')).toEqual(['ondelOndel']);
  });
});

describe('level & XP PO', () => {
  it('XP kumulatif = xpA × (L − 1)^xpK dan level dibalik dengan tepat di tiap batas', () => {
    expect(xpKumulatifPo(1)).toBe(0);
    expect(xpKumulatifPo(2)).toBe(15);
    expect(xpKumulatifPo(3)).toBe(120);
    expect(xpKumulatifPo(10)).toBe(10_935);
    for (let L = 1; L <= 60; L++) {
      expect(levelPoDariXp(xpKumulatifPo(L)), `tepat di batas L${L}`).toBe(L);
      if (L > 1) expect(levelPoDariXp(xpKumulatifPo(L) - 1e-6), `sedikit di bawah L${L}`).toBe(L - 1);
    }
    expect(levelPoDariXp(0)).toBe(1);
    expect(levelPoDariXp(Number.NaN)).toBe(1);
  });

  it('XP per level naik', () => {
    expect(xpLevelPo(2)).toBeGreaterThan(xpLevelPo(1));
  });

  it('harga tiket PO ×1,06 per level', () => {
    expect(nilaiTiketPo(1)).toBe(1);
    expect(nilaiTiketPo(11)).toBeCloseTo(Math.pow(1.06, 10), 12);
  });
});

describe('jurusan & kelas bus yang aktif', () => {
  it('jurusan ke-2 terbuka di Lv 6, ke-3 di Lv 12', () => {
    const j = (L: number) => jurusanAktif('ondelOndel', L, 0).map((i) => EKONOMI.jurusan[i]!.nama);
    expect(j(1)).toEqual(['JAKARTA']);
    expect(j(5)).toEqual(['JAKARTA']);
    expect(j(6)).toEqual(['JAKARTA', 'SEMARANG']);
    expect(j(12)).toEqual(['JAKARTA', 'SEMARANG', 'SURABAYA']);
  });

  it('jurusan antarpulau baru dilayani setelah terminal mencapai kelasnya', () => {
    const nama = (kelas: number) => jurusanAktif('kecakLaju', 12, kelas).map((i) => EKONOMI.jurusan[i]!.nama);
    expect(nama(1)).toEqual(['DENPASAR', 'SURABAYA']);
    expect(nama(2)).toEqual(['DENPASAR', 'SURABAYA', 'MATARAM']);
  });

  it('kelas bus dibatasi level PO, tingkat PO, dan kelas terminal', () => {
    expect(kelasAktif('ondelOndel', 1, 0)).toEqual(['ekonomi']);
    expect(kelasAktif('ondelOndel', 3, 0)).toEqual(['ekonomi', 'patas']);
    expect(kelasAktif('ondelOndel', 6, 0)).toEqual(['ekonomi', 'patas', 'eksekutif']);
    // PO lokal tidak pernah mengoperasikan Sleeper.
    expect(kelasAktif('ondelOndel', 50, 4)).toEqual(['ekonomi', 'patas', 'eksekutif']);
    // Regional: Sleeper di Lv 10, tapi baru setelah terminal Tipe B.
    expect(kelasAktif('bakpiaRasa', 10, 0)).not.toContain('sleeper');
    expect(kelasAktif('bakpiaRasa', 10, 1)).toContain('sleeper');
    expect(kelasAktif('bakpiaRasa', 30, 4)).not.toContain('tingkat');
    // Nasional: Double Decker di Lv 15 & Tipe A.
    expect(kelasAktif('kecakLaju', 15, 1)).not.toContain('tingkat');
    expect(kelasAktif('kecakLaju', 15, 2)).toContain('tingkat');
  });
});

describe('reputasi', () => {
  it('faktor minat 0,7–1,3; reputasi 50 = 1', () => {
    expect(faktorReputasi(0)).toBeCloseTo(0.7, 12);
    expect(faktorReputasi(50)).toBeCloseTo(1, 12);
    expect(faktorReputasi(100)).toBeCloseTo(1.3, 12);
    expect(faktorReputasi(150)).toBeCloseTo(1.3, 12);
  });

  it('target = 25 (harga tiket normal) + 50 × kepuasan + 20 × kelas ÷ 5; tidak lagi ikut harga', () => {
    expect(targetReputasi(1, 5)).toBeCloseTo(95, 9);
    expect(targetReputasi(0, 0)).toBe(25);
    expect(targetReputasi(0.8, 2)).toBeCloseTo(25 + 40 + 8, 9);
    expect(targetReputasi(2, 9)).toBeCloseTo(95, 9);
  });

  it('mendekati target secara eksponensial: satu langkah besar = banyak langkah kecil', () => {
    const besar = majukanReputasi(40, 90, 600);
    let kecil = 40;
    for (let i = 0; i < 6000; i++) kecil = majukanReputasi(kecil, 90, 0.1);
    expect(kecil).toBeCloseTo(besar, 9);
    expect(besar).toBeGreaterThan(40);
    expect(besar).toBeLessThan(90);
    expect(majukanReputasi(40, 90, 0)).toBe(40);
    expect(majukanReputasi(40, 90, 1e9)).toBeCloseTo(90, 9);
  });
});

describe('pendaftaran & kontrak', () => {
  const biasa = { kelasTerminal: 0, kepuasan: 0.5 };

  it('syarat kelas terminal, kepuasan, dan hadiah event', () => {
    expect(syaratDaftarKurang('peuyeumKilat', biasa)).toBeNull();
    expect(syaratDaftarKurang('apelBatu', biasa)).toEqual({ jenis: 'kelas', kelas: 1 });
    expect(syaratDaftarKurang('teloletJaya', biasa)).toEqual({ jenis: 'kepuasan', min: 0.65 });
    expect(syaratDaftarKurang('teloletJaya', { ...biasa, kepuasan: 0.7 })).toBeNull();
    expect(syaratDaftarKurang('mudikCeria', { ...biasa, kelasTerminal: 4 })).toEqual({ jenis: 'event' });
    expect(syaratDaftarKurang('mudikCeria', { ...biasa, hadiahEvent: true })).toBeNull();
    // Hadiah kelas: tersedia (gratis) begitu terminal mencapai kelasnya.
    expect(syaratDaftarKurang('juaraKelas', biasa)).toEqual({ jenis: 'kelas', kelas: 1 });
    expect(syaratDaftarKurang('juaraKelas', { ...biasa, kelasTerminal: 1 })).toBeNull();
  });

  it('PO hadiah mendapat kontrak pertama 14 hari, lainnya 7', () => {
    expect(hariKontrakPertama('peuyeumKilat')).toBe(7);
    expect(hariKontrakPertama('juaraKelas')).toBe(14);
    expect(hariKontrakPertama('kembangApi')).toBe(14);
  });

  it('perpanjang menambah 7 hari, sisa maksimal 14 hari', () => {
    expect(sisaSetelahPerpanjang(2)).toBe(9);
    expect(sisaSetelahPerpanjang(10)).toBe(14);
    expect(sisaSetelahPerpanjang(-3)).toBe(7);
  });
});

describe('level & kelas terminal', () => {
  it('XP kumulatif = 50 × (T − 1)^2,75 dan dibalik tepat di tiap batas', () => {
    expect(xpKumulatifTerminal(1)).toBe(0);
    expect(xpKumulatifTerminal(2)).toBe(50);
    expect(xpKumulatifTerminal(11)).toBeCloseTo(50 * Math.pow(10, 2.75), 6);
    for (let T = 1; T <= 80; T++) {
      expect(levelTerminalDariXp(xpKumulatifTerminal(T)), `T${T}`).toBe(T);
      if (T > 1) expect(levelTerminalDariXp(xpKumulatifTerminal(T) * (1 - 1e-9)), `di bawah T${T}`).toBe(T - 1);
    }
    expect(levelTerminalDariXp(-5)).toBe(1);
  });

  it('kelas: Tipe C 1–9, B 10–19, A 20–29, Terpadu ★1 30–39, ★2 40–49', () => {
    const kasus: [number, number][] = [[1, 0], [9, 0], [10, 1], [19, 1], [20, 2], [29, 2], [30, 3], [39, 3], [40, 4], [55, 5]];
    for (const [level, kelas] of kasus) expect(kelasDariLevel(level), `Lv ${level}`).toBe(kelas);
    for (let kelas = 0; kelas <= 6; kelas++) {
      const L = levelMinimalKelas(kelas);
      expect(kelasDariLevel(L)).toBe(kelas);
      if (L > 1) expect(kelasDariLevel(L - 1)).toBe(kelas - 1);
    }
  });

  it('slot PO naik dengan level; di atas 8 butuh aula kedua (perluasan tahap 4)', () => {
    expect(slotPo(1, 0)).toBe(2);
    expect(slotPo(3, 0)).toBe(3);
    expect(slotPo(10, 3)).toBe(5);
    expect(slotPo(25, 3)).toBe(8);
    expect(slotPo(30, 3)).toBe(8);
    expect(slotPo(30, 4)).toBe(9);
    expect(slotPo(60, 5)).toBe(12);
  });

});

describe('perluasan terminal', () => {
  it('tahap berurutan, dibuka level terminal', () => {
    expect(tahapPerluasanBerikutnya(0)?.level).toBe(3);
    expect(levelCukupPerluasan(0, 2)).toBe(false);
    expect(levelCukupPerluasan(0, 3)).toBe(true);
    expect(levelCukupPerluasan(3, 19)).toBe(false);
    expect(levelCukupPerluasan(3, 20)).toBe(true);
    expect(tahapPerluasanBerikutnya(M.perluasan.length)).toBeNull();
    expect(biayaPerluasan(M.perluasan.length)).toBeNull();
    expect(biayaPerluasan(1)).toBe(M.perluasan[1]!.biaya);
  });

});
