import { describe, expect, it } from 'vitest';
import { butirLencana, cadanganKas, daftarTujuan, jumlahLencana, kasMenipis, manajerUntung, pilihTujuan, TAHAN_TUJUAN_MS, type JenisTujuan, type TujuanDinilai } from '../src/app/tujuan';
import { cocokUntukTutorial } from '../src/app/tutorial';
import { EKONOMI } from '../src/config/economy.config';
import { PO_IDS, TEKNOLOGI_IDS, type PoId } from '../src/sim/fitur';
import { acuanHarian, aturTarif, bangun, beliTeknologi, buatStateBaru, daftarPo, DETIK_SEHARI, hitungOffline, mulaiPerluasan, rekrutPetugas, type GameState } from '../src/sim/state';
import { gayaTujuan, sasaranTujuan, teksTujuan } from '../src/ui/baris-tujuan';
import { buatModel } from '../src/ui/model';
import { NAMA_PO, TEKS } from '../src/ui/teks';
import { denganBangunan, denganLevelTerminal, denganPerluasan, denganPetugas, kaya, stateOtomatis, T0 } from './helpers';

const P1 = EKONOMI.mitra.perluasan[0]!;
const jenis = (d: readonly TujuanDinilai[]): JenisTujuan[] => d.map((t) => t.jenis);
const cari = <J extends JenisTujuan>(d: readonly TujuanDinilai[], j: J): Extract<TujuanDinilai, { jenis: J }> | undefined =>
  d.find((t): t is Extract<TujuanDinilai, { jenis: J }> => t.jenis === j);
/** Sisa kontrak semua PO terdaftar (hari terminal). */
const denganSisaKontrak = (s: GameState, hari: number, id?: PoId): GameState => ({
  ...s,
  mitra: { ...s.mitra, terdaftar: s.mitra.terdaftar.map((p) => (id === undefined || p.id === id ? { ...p, kontrakDetik: hari * DETIK_SEHARI } : p)) },
});
/** Terminal dengan dua PO (PO kedua lewat aksi daftar), kas tetap. */
const duaPo = (s: GameState): GameState => ({ ...daftarPo(kaya(s), 'peuyeumKilat'), kas: s.kas });
/** Operasi merugi & kas habis: kas menipis (sama dengan tes notifikasi). */
const menipis = (): GameState => aturTarif(denganPetugas(stateOtomatis({ jalur: 2 }, 0), ['manajerOperasional', 'kebersihan', 'satpam']), 'sewaLoket', 0);

describe('daftarTujuan: urutan & bentuk', () => {
  const contoh: Record<string, GameState> = {
    baru: stateOtomatis(),
    'Lv 3 kaya': kaya(denganLevelTerminal(stateOtomatis(), 3)),
    proyek: mulaiPerluasan(kaya(denganLevelTerminal(stateOtomatis(), 3))),
    'kas menipis': menipis(),
    'semua perluasan selesai': denganPerluasan(kaya(denganLevelTerminal(stateOtomatis(), 40)), EKONOMI.mitra.perluasan.length),
    'Manajer Kemitraan': denganPetugas(kaya(stateOtomatis()), ['manajerKemitraan']),
  };
  for (const [nama, s] of Object.entries(contoh)) {
    it(`${nama}: tidak pernah kosong, urut tingkat, tepat satu tujuan tingkat 5, kunci unik`, () => {
      const d = daftarTujuan(s, null);
      expect(d.length).toBeGreaterThan(0);
      expect(d.map((t) => t.tingkat)).toEqual([...d.map((t) => t.tingkat)].sort((a, b) => a - b));
      expect(d.filter((t) => t.tingkat === 5)).toHaveLength(1);
      expect(new Set(d.map((t) => t.kunci)).size).toBe(d.length);
      // Tingkat 2–3 yang tampil selalu bisa dikerjakan; tingkat 4–5 status menunggu tanpa aksi.
      for (const t of d) if (t.tingkat === 2 || t.tingkat === 3) expect(t.siap && t.aksi !== null).toBe(true);
      for (const t of d) if (t.tingkat >= 4) expect(t.siap || t.aksi !== null).toBe(false);
    });
  }

  it('game baru: daftarkan PO kedua (tingkat 2) lebih dulu dari perbaikan Loket (tingkat 3); naik level ke Perluasan 1 di Lv 3', () => {
    const d = daftarTujuan(stateOtomatis(), null);
    expect(d[0]).toMatchObject({ jenis: 'daftarPo', tingkat: 2, po: 'peuyeumKilat' });
    expect(d.some((t) => t.jenis === 'area' && t.area === 'loket' && t.perbaikan.jenis === 'jendela')).toBe(true);
    expect(d[d.length - 1]).toMatchObject({ jenis: 'naikLevel', tingkat: 5, tahap: 1, level: P1.level, levelSekarang: 1 });
  });

  it('tingkat 3 berisi area paling lambat lebih dulu dari kepuasan, dan Manajer Operasional paling akhir', () => {
    const s = duaPo(stateOtomatis());
    const t3 = daftarTujuan(s, null).filter((t) => t.tingkat === 3);
    expect(t3[0]).toMatchObject({ jenis: 'area', area: 'peron', perbaikan: { jenis: 'rekrut', petugas: 'peron' } });
    expect(jenis(t3)).toContain('kepuasan');
    expect(t3[t3.length - 1]!.jenis).toBe('manajer');
    expect(jenis(t3).indexOf('kepuasan')).toBeGreaterThan(jenis(t3).lastIndexOf('area'));
  });
});

describe('daftarTujuan: tingkat 1 mendesak', () => {
  it('kas menipis (aturan view model) dengan obat berurutan: perpanjang → sewakan → daftarkan PO → kurangi petugas', () => {
    const s = menipis();
    expect(kasMenipis(s)).toBe(true);
    expect(buatModel(s).hud.kasMenipis).toBe(true);
    // Tawaran perpanjangan ada (sisa ≤ 3 hari): obatnya perpanjang.
    const tawar = denganSisaKontrak(s, 2);
    expect(daftarTujuan(tawar, null)[0]).toMatchObject({ jenis: 'kasMenipis', tingkat: 1, siap: true, obat: { jenis: 'perpanjang', po: 'ondelOndel' }, aksi: { jenis: 'perpanjangPo', po: 'ondelOndel' } });
    // Jendela kosong: sewakan.
    const kosong = denganBangunan(s, { jendela: s.terminal.bangunan.jendela + 1 });
    expect(daftarTujuan(kosong, null)[0]).toMatchObject({ jenis: 'kasMenipis', obat: { jenis: 'sewakan' }, aksi: { jenis: 'isiJendelaKosong' } });
    // Ada PO yang bisa didaftarkan: daftarkan (kontraknya dibayar di muka).
    expect(daftarTujuan(s, null)[0]).toMatchObject({ jenis: 'kasMenipis', obat: { jenis: 'daftar', po: 'peuyeumKilat' } });
    // Slot PO penuh: kurangi petugas (yang terakhir direkrut).
    const penuh = { ...duaPo(kaya(s)), kas: 0 };
    expect(kasMenipis(penuh)).toBe(true);
    expect(daftarTujuan(penuh, null)[0]).toMatchObject({ jenis: 'kasMenipis', obat: { jenis: 'petugas' }, aksi: { jenis: 'berhentikan', petugas: 'satpam' } });
  });

  it('kontrak tinggal sehari & PO mau: tingkat 1 (bukan bila Manajer Kemitraan memperpanjangnya)', () => {
    const s = denganSisaKontrak(kaya(stateOtomatis()), 0.5);
    expect(daftarTujuan(s, null)[0]).toMatchObject({ jenis: 'kontrakHampir', tingkat: 1, po: 'ondelOndel', aksi: { jenis: 'perpanjangPo', po: 'ondelOndel' } });
    const mk = denganPetugas(s, ['manajerKemitraan']);
    expect(jenis(daftarTujuan(mk, null))).not.toContain('kontrakHampir');
    expect(jenis(daftarTujuan(mk, null))).not.toContain('perpanjang');
  });

  it('PO menolak memperpanjang (kepuasan mitra) tinggal sehari: tingkat 1 tanpa aksi; PO terakhir tidak (selalu diperpanjang sendiri)', () => {
    const mahal = (s: GameState): GameState => aturTarif(s, 'sewaLoket', EKONOMI.tycoon.tarif.sewaLoket.maks);
    const dua = denganSisaKontrak(mahal(duaPo(kaya(stateOtomatis()))), 0.5, 'ondelOndel');
    const t = daftarTujuan(dua, null)[0]!;
    expect(t).toMatchObject({ jenis: 'poMenolak', tingkat: 1, po: 'ondelOndel', sebab: 'mitra', siap: false, aksi: null });
    expect(teksTujuan(t)).toBe(TEKS.tujuanMenolakMitra(NAMA_PO.ondelOndel.nama));
    const satu = denganSisaKontrak(mahal(kaya(stateOtomatis())), 0.5);
    expect(jenis(daftarTujuan(satu, null))).not.toContain('poMenolak');
  });
});

describe('daftarTujuan: tingkat 2 siap', () => {
  it('tawaran perpanjangan (sisa ≤ 3 hari) dan jendela kosong; Manajer Kemitraan menyembunyikan keduanya', () => {
    const s = denganBangunan(denganSisaKontrak(kaya(stateOtomatis()), 2), { jendela: 2 });
    const d = daftarTujuan(s, null);
    expect(cari(d, 'perpanjang')).toMatchObject({ tingkat: 2, po: 'ondelOndel' });
    expect(cari(d, 'sewakan')).toMatchObject({ tingkat: 2, jumlah: 1 });
    const mk = daftarTujuan(denganPetugas(s, ['manajerKemitraan']), null);
    expect(cari(mk, 'perpanjang')).toBeUndefined();
    expect(cari(mk, 'sewakan')).toBeUndefined();
  });

  it('perluasan: tingkat 2 bila kas sesudah membayar ≥ cadangan A, selain itu "menabung" (tingkat 4) dengan kekurangannya', () => {
    const lv = denganLevelTerminal(duaPo(stateOtomatis()), P1.level);
    const cadanganA = cadanganKas(mulaiPerluasan(kaya(lv)), EKONOMI, 0);
    expect(cadanganA).toBeGreaterThan(0);
    const cukup = { ...lv, kas: P1.biaya + cadanganA + 1 };
    expect(cari(daftarTujuan(cukup, null), 'perluasan')).toMatchObject({ tingkat: 2, tahap: 1, biaya: P1.biaya, aksi: { jenis: 'mulaiPerluasan' } });
    const kurang = { ...lv, kas: P1.biaya + cadanganA - 1_000_000 };
    const d = daftarTujuan(kurang, null);
    expect(cari(d, 'perluasan')).toBeUndefined();
    expect(cari(d, 'menabung')).toMatchObject({ tingkat: 4, tahap: 1, kekurangan: 1_000_000 });
    // Sekali tampil, tujuan perluasan tetap berlaku selama kas ≥ biayanya (anti-kedip).
    expect(cari(daftarTujuan(kurang, 'perluasan:1'), 'perluasan')).toBeDefined();
    expect(cari(daftarTujuan({ ...lv, kas: P1.biaya - 1 }, 'perluasan:1'), 'perluasan')).toBeUndefined();
  });

  it('perluasan tahap ≥ 2: siap bila kas sesudah membayar ≥ cadangan B, selain itu menabung terhadap cadangan B (AC-GP-14)', () => {
    const P2 = EKONOMI.mitra.perluasan[1]!;
    const lv = denganPerluasan(denganLevelTerminal(duaPo(stateOtomatis()), P2.level), 1);
    const mulai = mulaiPerluasan(kaya(lv));
    const cadanganA = cadanganKas(mulai, EKONOMI, 0);
    const cadanganB = cadanganKas(mulai, EKONOMI, 1);
    expect(cadanganB).toBeGreaterThan(cadanganA);
    expect(cari(daftarTujuan({ ...lv, kas: P2.biaya + cadanganB + 1 }, null), 'perluasan')).toMatchObject({ tingkat: 2, tahap: 2, aksi: { jenis: 'mulaiPerluasan' } });
    // Lolos cadangan A tapi tidak B: belum siap (dulu sudah); kekurangannya terhadap cadangan B, kas sudah ≥ biaya.
    const antara = { ...lv, kas: P2.biaya + cadanganA + 1 };
    const d = daftarTujuan(antara, null);
    expect(cari(d, 'perluasan')).toBeUndefined();
    expect(cari(d, 'menabung')).toMatchObject({ tingkat: 4, tahap: 2, kekurangan: Math.ceil(P2.biaya + cadanganB - antara.kas), hanyaCadangan: true });
    expect(butirLencana(antara).terminal).toEqual(['perluasan:2:false']);
    expect(butirLencana({ ...lv, kas: P2.biaya + cadanganB + 1 }).terminal).toEqual(['perluasan:2:true']);
    // Kas kurang dari biaya: teks menabung biasa.
    expect(cari(daftarTujuan({ ...lv, kas: P2.biaya - 1 }, null), 'menabung')).toMatchObject({ hanyaCadangan: false });
    // Tahap 1 tetap cadangan A.
    const lv1 = denganLevelTerminal(duaPo(stateOtomatis()), P1.level);
    const cadanganA1 = cadanganKas(mulaiPerluasan(kaya(lv1)), EKONOMI, 0);
    expect(cari(daftarTujuan({ ...lv1, kas: P1.biaya + cadanganA1 + 1 }, null), 'perluasan')).toMatchObject({ tahap: 1 });
  });

  it('proyek berjalan: hitung mundur (tingkat 4); perluasan berikut terkunci level: naik level (tingkat 5); semua selesai: kelas berikut', () => {
    const p = mulaiPerluasan(kaya(denganLevelTerminal(stateOtomatis(), P1.level)));
    expect(cari(daftarTujuan(p, null), 'proyek')).toMatchObject({ tingkat: 4, tahap: 1, sisaDetik: EKONOMI.mitra.detikProyek });
    const selesai = denganPerluasan(p, 1);
    expect(cari(daftarTujuan(selesai, null), 'naikLevel')).toMatchObject({ tahap: 2, level: EKONOMI.mitra.perluasan[1]!.level, levelSekarang: P1.level });
    const semua = denganPerluasan(kaya(denganLevelTerminal(stateOtomatis(), 40)), EKONOMI.mitra.perluasan.length);
    const t = daftarTujuan(semua, null);
    expect(t[t.length - 1]).toMatchObject({ jenis: 'kelasBerikut', tingkat: 5, levelSekarang: 40 });
  });
});

describe('daftarTujuan: tingkat 3 hanya yang aman', () => {
  it('berbiaya: kas sesudah aksi ≥ cadangan B (rugi operasi sampai tawaran kontrak + 1 hari)', () => {
    const s = stateOtomatis();
    const sesudah = bangun(kaya(s), 'jendela');
    const cadanganB = cadanganKas(sesudah, EKONOMI, 1);
    const biayaNyata = 1e15 - sesudah.kas;
    expect(biayaNyata).toBeGreaterThan(0);
    const adaJendela = (kas: number): boolean => daftarTujuan({ ...s, kas }, null).some((t) => t.jenis === 'area' && t.perbaikan.jenis === 'jendela');
    expect(adaJendela(biayaNyata + cadanganB + 1)).toBe(true);
    expect(adaJendela(biayaNyata + cadanganB - 1)).toBe(false);
  });

  it('aksi bergaji tidak disarankan bila laba rata-rata sehari (dengan kontrak) sesudahnya < 0', () => {
    const rugi = stateOtomatis();
    const labaSesudah = (s: GameState): number => {
      const a = acuanHarian(rekrutPetugas(s, 'manajerOperasional'), EKONOMI, s.terminal.tarif);
      return a.laba + a.kontrak;
    };
    expect(labaSesudah(rugi)).toBeLessThan(0);
    expect(jenis(daftarTujuan(kaya(rugi), null))).not.toContain('manajer');
    const untung = duaPo(stateOtomatis());
    expect(labaSesudah(untung)).toBeGreaterThanOrEqual(0);
    expect(jenis(daftarTujuan(untung, null))).toContain('manajer');
  });

  it('perluasan didahulukan: selama Perluasan 1 terbuka, perbaikan berbiaya butuh kas untuk keduanya', () => {
    // Keadaan sesudah empat langkah tutorial, di Lv 3: Loket paling lambat, mesin tiket disarankan.
    let t = kaya(stateOtomatis());
    t = bangun(rekrutPetugas(daftarPo(bangun(t, 'jendela'), 'peuyeumKilat'), 'peron'), 'jalur');
    const lv = denganLevelTerminal(t, P1.level);
    const tek = 'mesinTiket';
    expect(daftarTujuan(lv, null).some((x) => x.jenis === 'area' && x.area === 'loket' && x.perbaikan.jenis === 'teknologi' && x.perbaikan.teknologi === tek)).toBe(true);
    const cadanganB = cadanganKas(beliTeknologi(lv, tek), EKONOMI, 1);
    expect(cadanganB).toBeGreaterThan(0);
    const harga = EKONOMI.teknologi[tek].biaya;
    const adaModern = (kas: number): boolean => daftarTujuan({ ...lv, kas }, null).some((x) => x.jenis === 'area' && x.perbaikan.jenis === 'teknologi');
    // Cukup untuk modernisasi + cadangan saja: tidak disarankan karena perluasan didahulukan.
    expect(adaModern(harga + cadanganB + 1)).toBe(false);
    expect(adaModern(harga + P1.biaya + cadanganB + 1)).toBe(true);
    // Tanpa perluasan terbuka (Lv 2), modernisasi + cadangan sudah cukup.
    expect(daftarTujuan({ ...denganLevelTerminal(t, 2), kas: harga + cadanganKas(beliTeknologi(denganLevelTerminal(t, 2), tek), EKONOMI, 1) + 1 }, null).some((x) => x.jenis === 'area' && x.perbaikan.jenis === 'teknologi')).toBe(true);
  });

  it('kepuasan < 75%: komponen berbobot paling kurang yang punya perbaikan (di sini kebersihan → petugas kebersihan)', () => {
    const s = duaPo(stateOtomatis());
    const t = cari(daftarTujuan(s, null), 'kepuasan')!;
    expect(t).toMatchObject({ tingkat: 3, komponen: 'kebersihan', perbaikan: { jenis: 'rekrut', petugas: 'kebersihan' } });
    expect(t.nilai).toBeLessThan(0.75);
  });
});

describe('penutup tutorial & saran Manajer Operasional (AC-GP-13)', () => {
  it('penutup tidak lagi menyarankan Manajer Operasional; baris tujuan menyarankannya hanya saat gajinya aman', () => {
    expect(TEKS.tutorialSelesai).toBe('Baris di bawah kas selalu menunjukkan langkah berikutnya. Ketuk untuk menuju ke sana. Tips: ketuk bus untuk klakson telolet!');
    expect(TEKS.tutorialSelesai).not.toMatch(/manajer|toilet|kios/i);
    // Sesudah empat langkah tutorial: disarankan bila kas ≥ cadangan B sesudah gajinya, selain itu tidak.
    const t = bangun(rekrutPetugas(daftarPo(bangun(kaya(stateOtomatis()), 'jendela'), 'peuyeumKilat'), 'peron'), 'jalur');
    const cadanganB = cadanganKas(rekrutPetugas(t, 'manajerOperasional'), EKONOMI, 1);
    expect(cadanganB).toBeGreaterThan(0);
    const manajer = (kas: number): TujuanDinilai | undefined => cari(daftarTujuan({ ...t, kas }, null), 'manajer');
    expect(manajer(cadanganB + 1)).toMatchObject({ tingkat: 3, siap: true, aksi: { jenis: 'rekrut', petugas: 'manajerOperasional' } });
    expect(manajer(cadanganB - 1)).toBeUndefined();
    expect(teksTujuan(manajer(cadanganB + 1)!)).toBe(TEKS.tujuanManajer);
  });

  it('Manajer hanya disarankan bila laba offline sehari sesudahnya juga ≥ 0: dua PO tidak, tiga PO ya (AC-GP-13, playtest P-1)', () => {
    const offlineSehari = (s: GameState): number => hitungOffline({ ...rekrutPetugas(s, 'manajerOperasional'), waktuTerakhirMs: 0 }, DETIK_SEHARI * 1000).laba;
    const labaRata = (s: GameState): number => {
      const a = acuanHarian(rekrutPetugas(s, 'manajerOperasional'), EKONOMI, s.terminal.tarif);
      return a.laba + a.kontrak;
    };
    // Sesudah tutorial, Lv 3, Perluasan 1 selesai, dua PO: online untung tapi offline (pendapatan 60 %, biaya penuh) rugi.
    const tutorial = bangun(rekrutPetugas(daftarPo(bangun(kaya(stateOtomatis()), 'jendela'), 'peuyeumKilat'), 'peron'), 'jalur');
    const dua = denganPerluasan(denganLevelTerminal(tutorial, P1.level), 1);
    expect(dua.mitra.terdaftar).toHaveLength(2);
    expect(labaRata(dua)).toBeGreaterThan(0);
    expect(offlineSehari(dua)).toBeLessThan(0);
    expect(manajerUntung(dua)).toBe(false);
    expect(jenis(daftarTujuan(dua, null))).not.toContain('manajer');
    // PO ketiga: offline untung, Manajer disarankan (kas cukup).
    const tiga = daftarPo(dua, 'lumpiaKilat');
    expect(tiga.mitra.terdaftar).toHaveLength(3);
    expect(offlineSehari(tiga)).toBeGreaterThan(0);
    expect(manajerUntung(tiga)).toBe(true);
    expect(cari(daftarTujuan(tiga, null), 'manajer')).toMatchObject({ tingkat: 3, siap: true });
    // Sudah ada Manajer: tidak disarankan lagi.
    expect(manajerUntung(rekrutPetugas(tiga, 'manajerOperasional'))).toBe(false);
  });
});

describe('pilihTujuan: histeresis', () => {
  const t = (tingkat: TujuanDinilai['tingkat'], kunci: string, siap = true): TujuanDinilai => ({ jenis: 'manajer', tingkat, kunci, siap, aksi: null });
  const t1 = t(1, 'mendesak');
  const t2 = t(2, 'siap');
  const t2b = t(2, 'siap-lain');
  const t3 = t(3, 'perbaikan');
  const t4 = t(4, 'tunggu', false);

  it('tanpa yang tampil: tingkat terkecil, yang siap lebih dulu', () => {
    expect(pilihTujuan([t3, t4], null, 0)).toBe(t3);
    expect(pilihTujuan([t(2, 'belum', false), t2, t3], null, 0)).toBe(t2);
  });

  it(`tingkat lebih tinggi menggantikan setelah ${TAHAN_TUJUAN_MS} ms; tingkat 1 langsung; setingkat tidak`, () => {
    const tampil = { kunci: t3.kunci, sejakMs: 1000 };
    expect(pilihTujuan([t2, t3], tampil, 1000 + TAHAN_TUJUAN_MS - 1)).toBe(t3);
    expect(pilihTujuan([t2, t3], tampil, 1000 + TAHAN_TUJUAN_MS)).toBe(t2);
    expect(pilihTujuan([t1, t2, t3], tampil, 1001)).toBe(t1);
    expect(pilihTujuan([t2b, t2], { kunci: t2.kunci, sejakMs: 0 }, 60_000)).toBe(t2);
    expect(pilihTujuan([t4, t3], { kunci: t3.kunci, sejakMs: 0 }, 60_000)).toBe(t3);
  });

  it('yang tampil tidak berlaku lagi (mis. baru dikerjakan): langsung diganti yang terbaik', () => {
    expect(pilihTujuan([t2b, t4], { kunci: t2.kunci, sejakMs: 0 }, 1)).toBe(t2b);
  });
});

describe('baris tujuan: teks, warna, sasaran', () => {
  const panjang = PO_IDS.reduce((a, b) => (NAMA_PO[b].nama.length > NAMA_PO[a].nama.length ? b : a));
  const besar = 999_900_000;
  const d = { tingkat: 1 as const, kunci: 'x', siap: true, aksi: null };
  const semua: TujuanDinilai[] = [
    { ...d, jenis: 'kasMenipis', obat: { jenis: 'perpanjang', po: panjang } },
    { ...d, jenis: 'kasMenipis', obat: { jenis: 'sewakan' } },
    { ...d, jenis: 'kasMenipis', obat: { jenis: 'daftar', po: panjang, nilai: besar } },
    { ...d, jenis: 'kasMenipis', obat: { jenis: 'petugas', petugas: 'manajerOperasional' } },
    { ...d, jenis: 'kontrakHampir', po: panjang },
    { ...d, jenis: 'poMenolak', po: panjang, sebab: 'kepuasan', kepuasanMin: 0.85 },
    { ...d, jenis: 'poMenolak', po: panjang, sebab: 'mitra', kepuasanMin: null },
    { ...d, tingkat: 2, jenis: 'perpanjang', po: panjang, nilai: besar },
    { ...d, tingkat: 2, jenis: 'sewakan', jumlah: 12 },
    { ...d, tingkat: 2, jenis: 'daftarPo', po: panjang, nilai: besar },
    ...[1, 2, 3, 4, 5].map((tahap): TujuanDinilai => ({ ...d, tingkat: 2, jenis: 'perluasan', tahap, biaya: besar })),
    { ...d, tingkat: 3, jenis: 'area', area: 'keberangkatan', perbaikan: { jenis: 'rekrut', petugas: 'gerbang' } },
    { ...d, tingkat: 3, jenis: 'area', area: 'loket', perbaikan: { jenis: 'jendela', biaya: besar } },
    ...TEKNOLOGI_IDS.map((id): TujuanDinilai => ({ ...d, tingkat: 3, jenis: 'area', area: 'keberangkatan', perbaikan: { jenis: 'teknologi', teknologi: id, biaya: besar } })),
    { ...d, tingkat: 3, jenis: 'area', area: 'keberangkatan', perbaikan: { jenis: 'jalur', nomor: 10, biaya: besar } },
    ...(['kebersihan', 'petugasToilet', 'satpam'] as const).map((p): TujuanDinilai => ({ ...d, tingkat: 3, jenis: 'kepuasan', komponen: 'kebersihan', nilai: 0.3, perbaikan: { jenis: 'rekrut', petugas: p } })),
    ...(['kursi', 'toilet', 'kios', 'lahanParkir'] as const).map((b): TujuanDinilai => ({ ...d, tingkat: 3, jenis: 'kepuasan', komponen: 'fasilitas', nilai: 0.3, perbaikan: { jenis: 'bangun', bangunan: b, biaya: besar } })),
    { ...d, tingkat: 3, jenis: 'manajer' },
    { ...d, tingkat: 4, siap: false, jenis: 'proyek', tahap: 5, sisaDetik: EKONOMI.mitra.detikProyek },
    { ...d, tingkat: 4, siap: false, jenis: 'menabung', tahap: 5, kekurangan: besar, hanyaCadangan: false },
    { ...d, tingkat: 4, siap: false, jenis: 'menabung', tahap: 5, kekurangan: besar, hanyaCadangan: true },
    { ...d, tingkat: 5, siap: false, jenis: 'naikLevel', tahap: 5, level: 100, levelSekarang: 99 },
    { ...d, tingkat: 5, siap: false, jenis: 'kelasBerikut', kelas: 14, level: 100, levelSekarang: 99 },
  ];

  it(`semua teks ≤ 60 karakter, juga untuk PO bernama terpanjang (${NAMA_PO[panjang].nama}) dan nilai ratusan juta`, () => {
    for (const x of semua) {
      const teks = teksTujuan(x);
      expect(teks.length, teks).toBeGreaterThan(10);
      expect(Array.from(teks).length, teks).toBeLessThanOrEqual(60);
    }
  });

  it('teks sesuai rancangan (contoh)', () => {
    expect(teksTujuan(semua[9]!)).toBe(`🚌 Daftarkan ${NAMA_PO[panjang].nama}: +Rp 999 jt di muka`);
    expect(teksTujuan({ ...d, tingkat: 2, jenis: 'daftarPo', po: 'peuyeumKilat', nilai: 39_400_000 })).toBe('🚌 Daftarkan PO Peuyeum Kilat: +Rp 39,4 jt di muka');
    expect(teksTujuan(semua[10]!)).toBe('🏗️ Bangun Perluasan 1: slot jendela loket +2');
    expect(teksTujuan({ ...d, tingkat: 3, jenis: 'area', area: 'loket', perbaikan: { jenis: 'teknologi', teknologi: 'mesinTiket', biaya: 1 } })).toBe('🚦 Loket paling lambat: pasang mesin tiket');
    // AC-GP-17 (playtest P-4, P-5): hitung mundur boleh ditinggal; menabung saat kas ≥ biaya = untuk cadangan.
    expect(teksTujuan({ ...d, tingkat: 4, siap: false, jenis: 'proyek', tahap: 1, sisaDetik: 1440 })).toBe('🏗️ Perluasan 1 jadi dalam 24 menit, walau game ditutup');
    expect(teksTujuan({ ...d, tingkat: 4, siap: false, jenis: 'menabung', tahap: 2, kekurangan: 12_300_000, hanyaCadangan: true })).toBe(
      '🏗️ Perluasan 2: kumpulkan Rp 12,3 jt lagi untuk cadangan',
    );
    expect(teksTujuan({ ...d, tingkat: 4, siap: false, jenis: 'menabung', tahap: 2, kekurangan: 12_300_000, hanyaCadangan: false })).toBe('🏗️ Perluasan 2: kumpulkan Rp 12,3 jt lagi');
  });

  it('warna per tingkat: 1 merah, 2–3 kuning, 4–5 netral', () => {
    expect(semua.map((x) => `${x.tingkat}:${gayaTujuan(x)}`).filter((v, i, a) => a.indexOf(v) === i)).toEqual(['1:bahaya', '2:siap', '3:siap', '4:netral', '5:netral']);
  });

  it('ketukan menuju tab yang tepat', () => {
    const tab = (x: TujuanDinilai): string => sasaranTujuan(x).tab;
    expect(tab(semua[0]!)).toBe('po');
    expect(sasaranTujuan(semua[0]!).selektor).toContain(`[data-po="${panjang}"]`);
    expect(tab(semua[3]!)).toBe('petugas');
    expect(tab(semua[10]!)).toBe('terminal');
    expect(sasaranTujuan(semua[10]!).selektor).toBe('[data-kartu="perluasan"]');
    expect(tab(cari(semua, 'manajer')!)).toBe('petugas');
    expect(tab(cari(semua, 'kelasBerikut')!)).toBe('terminal');
    for (const x of semua) if (x.jenis === 'area' && x.perbaikan.jenis !== 'rekrut') expect(tab(x)).toBe('bangun');
  });

  it('kas menipis "kurangi petugas": tombol − petugas yang terakhir direkrut, cadangannya ringkasan gaji (playtest P-11)', () => {
    expect(sasaranTujuan(semua[3]!)).toEqual({ tab: 'petugas', selektor: '.item-petugas[data-petugas="manajerOperasional"] .tombol-kurang', cadangan: '[data-kartu="gaji"]' });
    expect(sasaranTujuan({ ...d, jenis: 'kasMenipis', obat: { jenis: 'petugas', petugas: null } })).toEqual({ tab: 'petugas', selektor: '[data-kartu="gaji"]' });
    // Petugas yang disorot = yang diberhentikan aksinya (slot PO penuh, seperti tes obat kas menipis).
    const t = daftarTujuan({ ...duaPo(kaya(menipis())), kas: 0 }, null)[0]!;
    expect(t).toMatchObject({ jenis: 'kasMenipis', obat: { jenis: 'petugas', petugas: 'satpam' }, aksi: { jenis: 'berhentikan', petugas: 'satpam' } });
    expect(sasaranTujuan(t).selektor).toBe('.item-petugas[data-petugas="satpam"] .tombol-kurang');
  });
});

describe('lencana tab Terminal & PO (butirLencana)', () => {
  it('Terminal: perluasan berikut terbuka & belum dibangun, kuncinya ikut siap/belum; hilang saat proyek dimulai', () => {
    const lv = denganLevelTerminal(duaPo(stateOtomatis()), P1.level);
    expect(butirLencana(denganLevelTerminal(stateOtomatis(), 2)).terminal).toEqual([]);
    expect(butirLencana({ ...lv, kas: 0 }).terminal).toEqual(['perluasan:1:false']);
    expect(butirLencana(kaya(lv)).terminal).toEqual(['perluasan:1:true']);
    expect(butirLencana(mulaiPerluasan(kaya(lv))).terminal).toEqual([]);
  });

  it('PO: tawaran perpanjangan, ada PO yang bisa didaftarkan, jendela kosong; Manajer Kemitraan menghapus tawaran & jendela kosong', () => {
    const s = denganBangunan(denganSisaKontrak(kaya(stateOtomatis()), 2), { jendela: 2 });
    const b = butirLencana(s);
    expect(b.po).toEqual([`perpanjang:ondelOndel:${s.mitra.terdaftar[0]!.kontrakKe}`, expect.stringMatching(/^daftar:\d+:\d+$/), 'kosong:1']);
    expect(butirLencana(denganPetugas(s, ['manajerKemitraan'])).po).toEqual([expect.stringMatching(/^daftar:/)]);
  });

  it('jumlahLencana: Terminal 1 bila ada butir yang belum dilihat, PO = banyaknya butir yang belum dilihat', () => {
    const butir = { terminal: ['perluasan:1:false', 'perluasan:1:true'], po: ['perpanjang:ondelOndel:1', 'daftar:3:4', 'kosong:1'] };
    expect(jumlahLencana(butir, new Set(), false)).toEqual({ terminal: 1, po: 3, target: 0 });
    expect(jumlahLencana(butir, new Set(['perluasan:1:false', 'daftar:3:4']), false)).toEqual({ terminal: 1, po: 2, target: 0 });
    expect(jumlahLencana(butir, new Set([...butir.terminal, ...butir.po]), false)).toEqual({ terminal: 0, po: 0, target: 0 });
    expect(jumlahLencana({ terminal: [], po: [] }, new Set(), false)).toEqual({ terminal: 0, po: 0, target: 0 });
  });

  it('jumlahLencana: lencana Target = hadiah siap diklaim, ditahan selama tutorial aktif (playtest P-9)', () => {
    const kosong = { terminal: [], po: [] };
    expect(jumlahLencana(kosong, new Set(), false, 2)).toEqual({ terminal: 0, po: 0, target: 2 });
    expect(jumlahLencana(kosong, new Set(), true, 2)).toEqual({ terminal: 0, po: 0, target: 0 });
  });

  it('jumlahLencana: ditahan selama tutorial aktif (sambutan & langkah), muncul lagi setelahnya (temuan QA M-1)', () => {
    // Game baru (p-01-sambutan): PO bisa didaftarkan, jadi tanpa tutorial tab PO berlencana "1".
    const baru = buatStateBaru(T0);
    expect(cocokUntukTutorial(baru)).toBe(true);
    const b = butirLencana(baru);
    expect(b.po).toEqual([expect.stringMatching(/^daftar:/)]);
    expect(jumlahLencana(b, new Set(), true)).toEqual({ terminal: 0, po: 0, target: 0 });
    expect(jumlahLencana(b, new Set(), false)).toEqual({ terminal: 0, po: 1, target: 0 });
    // Perluasan terbuka & butir PO lain juga ditahan; butir yang tidak dilihat selama tutorial tetap muncul sesudahnya.
    const lv = kaya(denganLevelTerminal(duaPo(stateOtomatis()), P1.level));
    const bl = butirLencana(lv);
    expect(bl.terminal).toEqual(['perluasan:1:true']);
    expect(jumlahLencana(bl, new Set(), true)).toEqual({ terminal: 0, po: 0, target: 0 });
    expect(jumlahLencana(bl, new Set(), false)).toEqual({ terminal: 1, po: bl.po.length, target: 0 });
  });
});

describe('cadanganKas', () => {
  it('rugi operasi sehari (tanpa kontrak) × (hari sampai tawaran kontrak berikutnya + tambahan), paling sedikit sehari', () => {
    const s = denganSisaKontrak(stateOtomatis(), 7);
    const rugi = Math.max(0, -acuanHarian(s, EKONOMI, s.terminal.tarif).laba * 24);
    expect(rugi).toBeGreaterThan(0);
    const hari = 7 - EKONOMI.mitra.kontrak.hariTawaran;
    expect(cadanganKas(s, EKONOMI, 0)).toBeCloseTo(rugi * hari, 3);
    expect(cadanganKas(s, EKONOMI, 1)).toBeCloseTo(rugi * (hari + 1), 3);
    expect(cadanganKas(denganSisaKontrak(s, 1), EKONOMI, 0)).toBeCloseTo(rugi, 3);
  });
});
