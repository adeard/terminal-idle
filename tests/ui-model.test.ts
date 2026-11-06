import { describe, expect, it } from 'vitest';
import { PengendaliGame } from '../src/app/pengendali';
import { EKONOMI } from '../src/config/economy.config';
import { terapkanAksi } from '../src/sim/aksi';
import { pengaliBiayaKelas, slotBangunan } from '../src/sim/bangunan';
import { GEDUNG_LANTAI_IDS, PO_IDS, type BangunanId, type GedungLantaiId } from '../src/sim/fitur';
import { urutanPo } from '../src/sim/mitra';
import { kasSesudahAksi } from '../src/app/tujuan';
import { acuanHarian, aturTarif, buatStateBaru, daftarPo, kelasTerminal, keuanganSekarang, labaBuku, operasiState, tawaranKontrakPo, tick, type GameState } from '../src/sim/state';
import { formatUang } from '../src/ui/format';
import { AREA_IDS, bagianPratinjau, buatModel, pratinjauLantai, type ModelLantai } from '../src/ui/model';
import { tingkatKepuasan, tingkatPilKepuasan } from '../src/ui/popup-kepuasan';
import { NAMA_GEDUNG_LANTAI, NAMA_PERLUASAN, TEKS, teksIsiLantai, teksJendelaPenuh, teksSlotPenuh, teksStatusLantai } from '../src/ui/teks';
import { denganBangunan, denganLevelTerminal, denganPerluasan, denganPetugas, denganPo, jalankan, kaya, padaJam, stateOtomatis, T0 } from './helpers';

const T = EKONOMI.tycoon;

/** Tahap 3, PO level 8 (3 jendela), jalur & petugas alur lengkap: arus besar untuk pratinjau lantai. */
function tahap3Ramai(level: number, po: number, jalur: number, b: Parameters<typeof stateOtomatis>[0] = {}, petugas: Parameters<typeof stateOtomatis>[2] = []): GameState {
  let s = stateOtomatis({ jalur, ...b }, 1e13);
  s = PO_IDS.slice(0, po).reduce((x, id) => denganPo(x, id, { level: 8, loket: 3 }), s);
  s = denganPetugas(s, [...Array<'peron'>(jalur).fill('peron'), ...Array<'gerbang'>(jalur).fill('gerbang'), ...petugas]);
  return denganPerluasan(denganLevelTerminal(s, level), 3);
}

describe('view model UI: HUD', () => {
  it('awal game: kas modal awal, jendela loket yang paling lambat, terminal langsung berjalan', () => {
    const s = buatStateBaru(T0);
    const m = buatModel(s);
    expect(m.hud.kas).toBe(T.modalAwal);
    // Penumpang di terminal = yang sedang menunggu (arus × lama menunggu), sama dengan kebutuhan kursi.
    expect(m.hud.penumpangDiTerminal).toBe(Math.round(operasiState(s).arus * EKONOMI.tycoon.kepuasan.jamTunggu));
    expect(m.hud.labaPerJam).toBeCloseTo(keuanganSekarang(s).laba, 9);
    expect(m.hud.labaHariIni).toBe(0);
    expect(m.hud.adaManajer).toBe(false);
    expect(m.hud.kasMenipis).toBe(false);
    expect(m.bangun.area.map((a) => a.id)).toEqual(AREA_IDS);
    expect(m.bangun.area.find((a) => a.bottleneck)?.id).toBe('loket');
    expect(m.hud.kepuasan.bottleneck).toBe('loket');
  });

  it('laba (termasuk kontrak PO yang diterima) & penumpang hari ini dari buku harian; malam lebih sepi', () => {
    const s = stateOtomatis({ jalur: 2, jendela: 3 });
    const b = jalankan(daftarPo(s, 'peuyeumKilat'), 60);
    const m = buatModel(b);
    expect(m.hud.penumpangHariIni).toBe(Math.floor(b.keuangan.hariIni.penumpang + 1e-9));
    expect(m.hud.labaHariIni).toBeCloseTo(labaBuku(b.keuangan.hariIni), 6);
    expect(m.hud.labaHariIni).toBeGreaterThan(0);
    const isi = denganPo(s, 'ondelOndel', { loket: 3 });
    expect(buatModel(padaJam(isi, 2)).hud.penumpangDiTerminal).toBeLessThan(buatModel(padaJam(isi, 8)).hud.penumpangDiTerminal);
  });

  it('pil laba: rata-rata sehari dengan kontrak = angka laporan keuangan; boost menaikkan pendapatan operasi saja; jam pertama "awal"', () => {
    const s = daftarPo(kaya(stateOtomatis()), 'peuyeumKilat');
    const m = buatModel(s);
    expect(m.hud.labaHarian).toBeCloseTo(m.terminal.keuangan.rataRata.laba, 6);
    expect(m.hud.labaHarian).toBeGreaterThan(0);
    // Detik pertama game baru: rata-rata sehari negatif (sebelum PO kedua), tapi masih jam pertama.
    const baru = buatModel(buatStateBaru(T0));
    expect(baru.hud.labaHarian).toBeLessThan(0);
    expect(baru.hud.awal).toBe(true);
    expect(buatModel(jalankan(buatStateBaru(T0), 61)).hud.awal).toBe(false);
    const boost = { ...s, hadiah: { ...s.hadiah, boostDetik: 600 } };
    const a = acuanHarian(s, EKONOMI, s.terminal.tarif);
    expect(buatModel(boost).hud.labaHarian - m.hud.labaHarian).toBeCloseTo(a.pendapatan * (EKONOMI.hadiah.pengaliBoost - 1) * 24, 3);
    expect(buatModel(boost).terminal.keuangan.rataRata.laba).toBeCloseTo(m.terminal.keuangan.rataRata.laba, 6);
  });

  it('pil kepuasan: netral selama tutorial & jam pertama seperti pil laba, angka & wajah tetap (AC-GP-16)', () => {
    // Detik pertama game baru: kepuasan < 45% (merah bila tidak netral), jam pertama.
    const baru = buatModel(buatStateBaru(T0)).hud;
    expect(baru.kepuasan.nilai).toBeLessThan(0.45);
    expect(baru.awal).toBe(true);
    expect(tingkatKepuasan(baru.kepuasan.nilai)).toBe('kurang');
    expect(tingkatPilKepuasan(baru.kepuasan.nilai, baru.awal)).toBe('netral');
    // Lewat jam pertama: netral hanya selama tutorial aktif.
    const nanti = buatModel(jalankan(buatStateBaru(T0), 61)).hud;
    expect(nanti.awal).toBe(false);
    expect(tingkatPilKepuasan(nanti.kepuasan.nilai, true)).toBe('netral');
    expect(tingkatPilKepuasan(nanti.kepuasan.nilai, false)).toBe(tingkatKepuasan(nanti.kepuasan.nilai));
    expect(tingkatPilKepuasan(0.3, false)).toBe('kurang');
    expect(tingkatPilKepuasan(0.9, false)).toBe('baik');
  });

  it('kepuasan: komponen, kebutuhan kursi/petugas kebersihan/satpam, fasilitas yang belum ada', () => {
    const k = buatModel(stateOtomatis({ jalur: 2 })).hud.kepuasan;
    expect(k.satpam).toEqual({ ada: 0, perlu: 2 });
    expect(k.petugasKebersihan.ada).toBe(0);
    expect(k.fasilitasKurang).toEqual(['toilet', 'kios', 'lahanParkir']);
    expect(k.tambahanPenumpang).toBeCloseTo((T.pasar.dayaTarikPerKepuasan * k.nilai) / T.pasar.dayaTarikDasar, 9);
    const lengkap = buatModel(denganPetugas(stateOtomatis({ jalur: 2, toilet: 1, toko: 1, lahanParkir: 1 }), ['satpam', 'satpam'])).hud.kepuasan;
    expect(lengkap.fasilitasKurang).toEqual([]);
    expect(lengkap.keamanan).toBe(1);
  });

  it('kas menipis bila rata-rata sehari merugi dan kas kurang dari sehari kerugian; petunjuk manajer', () => {
    const rugi = aturTarif(denganPetugas(stateOtomatis({ jalur: 2 }, 1000), ['kebersihan', 'satpam', 'manajerOperasional']), 'sewaLoket', 0);
    expect(buatModel(rugi).hud.kasMenipis).toBe(true);
    expect(buatModel({ ...rugi, kas: 1e12 }).hud.kasMenipis).toBe(false);
    expect(buatModel(rugi).hud.adaManajer).toBe(true);
  });
});

describe('aksi & pengendali', () => {
  it('terapkanAksi meneruskan ke fungsi sim', () => {
    const s: GameState = { ...buatStateBaru(T0), kas: 1e8 };
    expect(terapkanAksi(s, { jenis: 'bangun', bangunan: 'jendela' }).terminal.bangunan.jendela).toBe(2);
    expect(terapkanAksi(s, { jenis: 'rekrut', petugas: 'peron' }).terminal.petugas).toEqual(['peron']);
    expect(terapkanAksi(s, { jenis: 'aturTarif', tarif: 'retribusiBus', nilai: 30_000 }).terminal.tarif.retribusiBus).toBe(30_000);
  });

  it('pelanggan dipanggil saat berlangganan, saat tick, dan saat aksi berlaku saja', () => {
    const p = new PengendaliGame({ ...stateOtomatis(), kas: 1_000_000 });
    const terlihat: number[] = [];
    const lepas = p.berlangganan((s) => terlihat.push(s.kas));
    expect(terlihat).toEqual([1_000_000]);

    p.majukan(0.05); // belum cukup untuk satu tick
    expect(terlihat).toHaveLength(1);
    p.majukan(0.05);
    expect(terlihat).toHaveLength(2);

    expect(p.kirim({ jenis: 'bangun', bangunan: 'jalur' })).toBe(false); // kas kurang
    expect(terlihat).toHaveLength(2);
    expect(p.kirim({ jenis: 'rekrut', petugas: 'peron' })).toBe(true);
    expect(terlihat).toHaveLength(3);

    lepas();
    p.majukan(1);
    expect(terlihat).toHaveLength(3);
  });

  it('setel mengganti state dan mereset akumulator', () => {
    const p = new PengendaliGame(stateOtomatis());
    p.majukan(0.09);
    const baru = buatStateBaru(T0 + 1);
    p.setel(baru);
    expect(p.state).toBe(baru);
    p.majukan(0.05);
    expect(p.state).toBe(baru); // sisa 0.09 tadi tidak terbawa
  });
});

describe('view model pengelolaan terminal', () => {
  it('tab Bangun: jumlah/slot, biaya, perawatan, bongkar; slot penuh menunjuk perluasan yang menambahnya', () => {
    const s = kaya(stateOtomatis({ toilet: 1 }));
    const b = buatModel(s).bangun;
    expect(b.bangunan.jendela).toMatchObject({ jumlah: 1, slot: slotBangunan('jendela', 0, 1), biaya: T.bangunan.jendela.biaya[0], bisa: true, bongkar: null });
    expect(b.bangunan.toilet).toMatchObject({ jumlah: 1, slot: 1, biaya: null, slotBerikut: { jenis: 'perluasan', tahap: 3 }, perawatan: T.bangunan.toilet.perawatan });
    expect(b.bangunan.toilet.bongkar).toBeGreaterThan(0);
    expect(b.bangunan.posRetribusi.slotBerikut).toBeNull();
    expect(b.petakBus).toBe(T.petakBus[0]);
    expect(b.teknologi.find((t) => t.id === 'eTiket')?.syaratKurang).toBe('mesinTiket');
    // Biaya ikut kelas terminal.
    expect(buatModel({ ...s, perkembangan: { ...s.perkembangan, xpTerminal: 1e9 } }).bangun.bangunan.toilet.perawatan).toBeGreaterThan(T.bangunan.toilet.perawatan);
  });

  it('izin level (documents/15 bagian 3.5): slot penuh menunjuk level izin bila lebih dulu dari perluasan; kartu level dua izin berikutnya', () => {
    // Perluasan 3 di Lv 15: jendela 12 + 5 izin = 17, jalur 5; izin Lv 16 (jendela & jalur) lebih dulu dari Perluasan 4 (Lv 20).
    const s = denganBangunan(kaya(denganPerluasan(denganLevelTerminal(stateOtomatis(), 15), 3)), { jendela: 17, jalur: 5 });
    const m = buatModel(s);
    expect(m.bangun.bangunan.jendela).toMatchObject({ jumlah: 17, slot: 17, biaya: null, slotBerikut: { jenis: 'level', level: 16 } });
    expect(m.bangun.bangunan.jalur).toMatchObject({ jumlah: 5, slot: 5, biaya: null, slotBerikut: { jenis: 'level', level: 16 } });
    expect(m.terminal.izinBerikut).toEqual([
      { level: 16, izin: { jendela: 1, jalur: 1, slotPo: 0 } },
      { level: 17, izin: { jendela: 1, jalur: 0, slotPo: 7 } },
    ]);
    // Izin jalur habis (Lv 26): slot jalur berikutnya dari Perluasan 4.
    const lv26 = denganBangunan(kaya(denganPerluasan(denganLevelTerminal(stateOtomatis(), 26), 3)), { jalur: 7 });
    expect(buatModel(lv26).bangun.bangunan.jalur).toMatchObject({ slot: 7, biaya: null, slotBerikut: { jenis: 'perluasan', tahap: 4 } });
    // Sebelum Perluasan 3 tidak ada izin jendela/jalur: slot penuh menunjuk perluasan, kartu level hanya slot PO.
    const awal = buatModel(denganBangunan(kaya(stateOtomatis()), { jendela: 4 }));
    expect(awal.bangun.bangunan.jendela.slotBerikut).toEqual({ jenis: 'perluasan', tahap: 1 });
    expect(awal.terminal.izinBerikut).toEqual([
      { level: 3, izin: { jendela: 0, jalur: 0, slotPo: 3 } },
      { level: 6, izin: { jendela: 0, jalur: 0, slotPo: 4 } },
    ]);
    // Lv 140 di Terpadu: tidak ada izin lagi.
    expect(buatModel(denganPerluasan(denganLevelTerminal(stateOtomatis(), 140), 5)).terminal.izinBerikut).toEqual([]);
  });

  it('tab PO, slot jendela penuh (playtest P-4, AC-GP-22): status PO tersedia menunjuk izin level atau perluasan berikutnya', () => {
    // Lv 17, Perluasan 3, jendela 19/19 disewa, slot PO ke-7 terbuka: +1 jendela di Lv 18, bukan perluasan.
    const lv17 = buatModel(denganPo(kaya(denganPerluasan(denganLevelTerminal(stateOtomatis(), 17), 3)), 'ondelOndel', { loket: 19 }));
    expect(lv17.mitra).toMatchObject({ slot: 7, jendelaKosong: 0 });
    expect(lv17.bangun.bangunan.jendela).toMatchObject({ jumlah: 19, slot: 19, biaya: null, slotBerikut: { jenis: 'level', level: 18 } });
    expect(lv17.mitra.tersedia.some((p) => p.kurang?.jenis === 'jendela')).toBe(true);
    expect(teksJendelaPenuh(lv17.bangun.bangunan.jendela.slotBerikut)).toBe('Jendela penuh · +1 di Lv 18');
    // Lv 12, Perluasan 2 (jendela 8/8): sebelum Perluasan 3 slot jendela hanya dari perluasan.
    const lv12 = buatModel(denganPo(kaya(denganPerluasan(denganLevelTerminal(stateOtomatis(), 12), 2)), 'ondelOndel', { loket: 8 }));
    expect(lv12.mitra.tersedia.some((p) => p.kurang?.jenis === 'jendela')).toBe(true);
    expect(teksJendelaPenuh(lv12.bangun.bangunan.jendela.slotBerikut)).toBe('Jendela penuh · Perluasan 3');
    // Tidak ada slot jendela lagi; teks status ≤ 28 karakter supaya tidak terpotong di landscape.
    expect(teksJendelaPenuh(null)).toBe('Jendela penuh');
    expect(TEKS.poJendelaPenuhLevel(140).length).toBeLessThanOrEqual(28);
  });

  it('teks aturan armada (playtest P-3, AC-GP-21): catatan tantangan & tab PO menyebut PO berlevel terendah', () => {
    expect(TEKS.tantanganCatatan).toBe('Tantangan baru tiap Senin (WIB). Laba dihitung seperti Laba/hari: kontrak PO dirata-rata. 🚌 Armada selalu untuk PO berlevel terendah.');
    expect(TEKS.poCatatan.endsWith('Manajer Kemitraan menyewakan jendela kosong dan memperpanjang kontrak otomatis. Hadiah armada (target, tantangan, Bus Emas) menaikkan level PO berlevel terendah.')).toBe(true);
  });

  it('kartu Tambah lantai (AC-GP-04, documents/18 bagian 4.4): tersembunyi, terkunci, terjangkau, kurang, gagal, selesai, maksimal', () => {
    const tahap3 = (level: number, kas: number, b: Parameters<typeof stateOtomatis>[0] = {}): GameState => denganPerluasan(denganLevelTerminal(stateOtomatis(b, kas), level), 3);
    const lantai = (s: GameState, l: Partial<GameState['terminal']['lantai']>): GameState => ({ ...s, terminal: { ...s.terminal, lantai: { ...s.terminal.lantai, ...l } } });
    const kartu = (s: GameState, g: GedungLantaiId): ModelLantai | null => buatModel(s).bangun.lantai[g];
    // Tersembunyi sebelum Perluasan 3; kartu Perluasan 3 menyebut "membuka Tambah lantai".
    const tahap2 = denganPerluasan(denganLevelTerminal(kaya(stateOtomatis()), 40), 2);
    for (const g of GEDUNG_LANTAI_IDS) expect(kartu(tahap2, g)).toBeNull();
    expect(NAMA_PERLUASAN[2]!.deskripsi).toContain('membuka Tambah lantai');
    // Terkunci level: "🔒 Terbuka di Lv 15", tanpa tombol beli & tanpa "👁 Lihat" (lantai 0).
    const lv14 = kartu(tahap3(14, 1e13), 'parkir')!;
    expect(lv14).toMatchObject({ keadaan: 'terkunci', lantai: 0, berikut: { lantai: 2, level: 15, biaya: 300_000_000 }, kurang: 0, pratinjau: [] });
    expect(teksStatusLantai(lv14)).toBe('🔒 Terbuka di Lv 15');
    expect(TEKS.judulLantai(2, NAMA_GEDUNG_LANTAI.parkir.nama)).toBe(`Lantai 2 · ${NAMA_GEDUNG_LANTAI.parkir.nama}`);
    // Terjangkau: operasional, petugas yang ikut direkrut (dua juru parkir menjaga dua lahan lama).
    const dijaga = tahap3Ramai(15, 8, 6, { lahanParkir: 2 }, ['juruParkir', 'juruParkir']);
    const terjangkau = kartu(dijaga, 'parkir')!;
    expect(terjangkau).toMatchObject({ keadaan: 'terjangkau', kurang: 0, operasional: 1_000_000, peringatanKas: false });
    expect(terjangkau.petugas).toEqual({ id: 'juruParkir', jumlah: 2, gaji: T.gaji.juruParkir * 2 * pengaliBiayaKelas(kelasTerminal(dijaga), EKONOMI) });
    expect(teksStatusLantai(terjangkau)).toBe(`Operasional Rp 1 jt/hari · Ikut direkrut: 2 juru parkir (${formatUang(terjangkau.petugas!.gaji)}/hari)`);
    // Pratinjau parkir: pendapatan parkir naik, paling banyak 2 bagian.
    expect(terjangkau.pratinjau.length).toBeGreaterThan(0);
    expect(terjangkau.pratinjau.length).toBeLessThanOrEqual(2);
    expect(terjangkau.pratinjau[0]).toMatchObject({ jenis: 'parkir' });
    expect(teksIsiLantai(terjangkau).startsWith(`${NAMA_GEDUNG_LANTAI.parkir.isi} · Parkir +Rp `)).toBe(true);
    // Kas kurang: tombol redup "Kurang Rp 120 jt".
    const kurang = kartu(tahap3(15, 180_000_000), 'parkir')!;
    expect(kurang).toMatchObject({ keadaan: 'kurang', kurang: 120_000_000 });
    expect(`${TEKS.lantaiKurang} ${formatUang(kurang.kurang)}`).toBe('Kurang Rp 120 jt');
    // Gagal: kas berubah antara ketuk dan aksi → aksi tidak berlaku, kartu kembali "kurang".
    const tipis = tahap3(15, 300_000_000 - 1);
    expect(terapkanAksi(tipis, { jenis: 'tambahLantai', gedung: 'parkir' })).toBe(tipis);
    expect(kartu(tipis, 'parkir')!.keadaan).toBe('kurang');
    // Peringatan kas = aturan aman baris tujuan (kasSesudahAksi; temuan playtest T-1): sisa kas sesudah membeli < cadangan B.
    // Terminal merugi tanpa kontrak (petugas lebih) supaya cadangan B > 0. Tepat di cadangan B (dibulatkan ke rupiah) = aman.
    const rugi = (kas: number): GameState => denganPetugas(tahap3(15, kas), ['kebersihan', 'kebersihan', 'kebersihan', 'satpam', 'satpam']);
    const ks = kasSesudahAksi(rugi(1e13), { jenis: 'tambahLantai', gedung: 'parkir' })!;
    expect(ks.cadangan).toBeGreaterThan(0);
    const aman = kartu(rugi(300_000_000 + Math.ceil(ks.cadangan)), 'parkir')!;
    expect(aman).toMatchObject({ keadaan: 'terjangkau', peringatanKas: false });
    expect(aman.sisaKas).toBeCloseTo(Math.ceil(ks.cadangan), 3);
    const pas = kartu(rugi(300_000_000 + Math.floor(ks.cadangan) - 1), 'parkir')!;
    expect(pas).toMatchObject({ keadaan: 'terjangkau', peringatanKas: true });
    expect(teksStatusLantai(pas)).toContain(TEKS.lantaiPeringatanKas(formatUang(pas.sisaKas)));
    expect(TEKS.lantaiPeringatanKas('Rp 8 jt')).toBe('⚠️ Kas tinggal Rp 8 jt sesudahnya');
    // Kas 0 sesudah membeli: tetap boleh dibeli (tanpa kunci), dengan peringatan.
    expect(kartu(rugi(300_000_000), 'parkir')).toMatchObject({ keadaan: 'terjangkau', peringatanKas: true, sisaKas: 0 });
    // Selesai dengan lantai berikutnya terkunci: "✓ 2 lantai · lantai 3 di Lv 38".
    const selesai = kartu(lantai(tahap3(20, 1e13), { parkir: 1 }), 'parkir')!;
    expect(selesai).toMatchObject({ keadaan: 'selesai', lantai: 1, berikut: { lantai: 3, level: 38, biaya: 2_000_000_000 } });
    expect(teksStatusLantai(selesai)).toBe('✓ 2 lantai · lantai 3 di Lv 38');
    // Lantai 3 terbuka: kartu kembali terjangkau dengan "👁 Lihat" (lantai > 0).
    expect(kartu(lantai(tahap3(38, 1e13), { parkir: 1 }), 'parkir')).toMatchObject({ keadaan: 'terjangkau', lantai: 1, berikut: { lantai: 3 } });
    // Maksimal: "✓ 2 lantai" / Gedung parkir "✓ 3 lantai".
    const maks = lantai(tahap3(60, 1e13), { parkir: 2, ruangTunggu: 1, sayapBarat: 1, aula: 1 });
    for (const g of GEDUNG_LANTAI_IDS) expect(kartu(maks, g)).toMatchObject({ keadaan: 'maks', berikut: null, pratinjau: [] });
    expect(teksStatusLantai(kartu(maks, 'parkir')!)).toBe('✓ 3 lantai');
    expect(teksStatusLantai(kartu(maks, 'aula')!)).toBe('✓ 2 lantai');
  });

  it('pratinjau lantai (rancangan 8.3): salinan state dengan lantai terpasang; komponen kepuasan & parkir per hari', () => {
    // Kursi 8/8 dan arus besar: lantai Ruang tunggu menaikkan kenyamanan.
    const s = tahap3Ramai(21, 12, 8, { kursi: 8, kios: 3 });
    const p = pratinjauLantai(s, 'ruangTunggu');
    expect(p.sesudah.kenyamanan).toBeGreaterThan(p.sebelum.kenyamanan);
    expect(p.parkirHarian).toBe(0);
    const bagian = bagianPratinjau(p);
    expect(bagian[0]).toEqual({ jenis: 'komponen', komponen: 'kenyamanan', dari: Math.round(p.sebelum.kenyamanan * 100), ke: Math.round(p.sesudah.kenyamanan * 100) });
    expect(TEKS.pratinjauKomponen(TEKS.kepuasanKenyamanan, 89, 100)).toBe(`${TEKS.kepuasanKenyamanan} 89 → 100%`);
    // Pratinjau tidak mengubah state aslinya.
    expect(s.terminal.lantai.ruangTunggu).toBe(0);
    expect(s.terminal.bangunan.kursi).toBe(8);
    // Paling banyak 2 bagian, parkir lebih dulu bila naik.
    expect(bagianPratinjau({ sebelum: p.sebelum, sesudah: { ...p.sesudah, fasilitas: p.sebelum.fasilitas + 0.1, kebersihan: p.sebelum.kebersihan - 0.05 }, labaHarian: 0, parkirHarian: 8e6 }).map((x) => x.jenis)).toEqual(['parkir', 'komponen']);
  });

  it('slot penuh menunjuk lantai bila lantai sumber slot berikutnya (AC-GP-05); teks lama untuk perluasan & izin', () => {
    const slot = (s: GameState, id: BangunanId): string => {
      const b = buatModel(s).bangun.bangunan[id];
      expect(b.biaya, id).toBeNull();
      return teksSlotPenuh(b.slotBerikut);
    };
    const tahap3 = (level: number, b: Parameters<typeof stateOtomatis>[0], l: Partial<GameState['terminal']['lantai']> = {}): GameState => {
      const s = denganPerluasan(denganLevelTerminal(kaya(stateOtomatis(b)), level), 3);
      return { ...s, terminal: { ...s.terminal, lantai: { ...s.terminal.lantai, ...l } } };
    };
    const n = NAMA_GEDUNG_LANTAI;
    // Lantai belum terbuka: "Slot penuh: lantai 2 Ruang tunggu di Lv 21"; sudah terbuka: "Slot penuh: tambah lantai Ruang tunggu".
    expect(slot(tahap3(20, { kursi: 8 }), 'kursi')).toBe(`Slot penuh: lantai 2 ${n.ruangTunggu.nama} di Lv 21`);
    expect(slot(tahap3(21, { kursi: 8 }), 'kursi')).toBe(`Slot penuh: tambah lantai ${n.ruangTunggu.nama}`);
    expect(slot(tahap3(21, { kios: 3 }), 'kios')).toBe(`Slot penuh: tambah lantai ${n.ruangTunggu.nama}`);
    expect(slot(tahap3(30, { toko: 4 }), 'toko')).toBe(`Slot penuh: lantai 2 ${n.aula.nama} di Lv 33`);
    expect(slot(tahap3(25, { toilet: 2 }), 'toilet')).toBe(`Slot penuh: lantai 2 ${n.sayapBarat.nama} di Lv 26`);
    expect(slot(tahap3(14, { lahanParkir: 2 }), 'lahanParkir')).toBe(`Slot penuh: lantai 2 ${n.parkir.nama} di Lv 15`);
    // Sesudah Ruang tunggu 2: kursi berikutnya dari Aula loket 2; Gedung parkir 2 → lantai 3 di Lv 38.
    expect(slot(tahap3(25, { kursi: 12 }, { ruangTunggu: 1 }), 'kursi')).toBe(`Slot penuh: lantai 2 ${n.aula.nama} di Lv 33`);
    expect(slot(tahap3(20, { lahanParkir: 4 }, { parkir: 1 }), 'lahanParkir')).toBe(`Slot penuh: lantai 3 ${n.parkir.nama} di Lv 38`);
    // Semua lantai sudah dibangun: "Slot penuh" biasa.
    expect(slot(tahap3(60, { kios: 4 }, { ruangTunggu: 1 }), 'kios')).toBe(TEKS.slotPenuh);
    // Sebelum Perluasan 3: teks lama perluasan; jendela tidak pernah menunjuk lantai.
    expect(slot(denganPerluasan(denganLevelTerminal(kaya(stateOtomatis({ kursi: 4 })), 12), 2), 'kursi')).toBe(TEKS.slotPenuhPerluasan(3));
    expect(buatModel(tahap3(15, { jendela: 17 })).bangun.bangunan.jendela.slotBerikut).toEqual({ jenis: 'level', level: 16 });
    // Teks terpanjang yang bisa tampil (tiap lantai di levelnya) tetap satu baris status kartu unit (dicek juga di gambar 360 & 900×420).
    for (const g of GEDUNG_LANTAI_IDS) EKONOMI.tycoon.lantai[g].level.forEach((lv, i) => expect(Array.from(TEKS.slotPenuhLantaiLevel(i + 2, n[g].nama, lv)).length).toBeLessThanOrEqual(44));
  });

  it('tab Petugas: jumlah/maks, gaji, kebutuhan; total gaji per hari', () => {
    const s = denganPetugas(stateOtomatis({ jalur: 2 }), ['satpam', 'peron', 'manajerOperasional']);
    const p = buatModel(s).petugas;
    expect(p.jumlah).toBe(3);
    expect(p.gajiHarian).toBe(T.gaji.satpam + T.gaji.peron + T.gaji.manajerOperasional);
    expect(p.daftar.find((x) => x.id === 'satpam')).toMatchObject({ jumlah: 1, maks: 4, perlu: 2, bisaRekrut: true, bisaBerhentikan: true });
    expect(p.daftar.find((x) => x.id === 'juruParkir')).toMatchObject({ jumlah: 0, maks: 0, bisaRekrut: false });
    expect(p.daftar.find((x) => x.id === 'manajerOperasional')).toMatchObject({ jumlah: 1, maks: 1, bisaRekrut: false });
  });

  it('tab PO: kartu tanpa harga per jurusan (harga tiket informasi), jendela, kepuasan mitra, kontrak; PO tersedia urut katalog dengan tawaran kontraknya', () => {
    let s = kaya(stateOtomatis());
    let m = buatModel(s);
    expect(m.mitra.terdaftar.map((p) => p.id)).toEqual(['ondelOndel']);
    expect(m.mitra).toMatchObject({ slot: 2, slotBerikut: { level: 3, slot: 3 }, jendelaKosong: 0, minimalMitra: T.mitra.minimal });
    const ondel = m.mitra.terdaftar[0]!;
    expect(ondel).toMatchObject({ loket: 1, kapasitasLoket: T.kapasitas.jendela, bisaIsiKosong: false, biayaJendela: T.bangunan.jendela.biaya[0], bisaTambahJendela: true });
    expect(ondel.kepuasanMitra).toBeGreaterThan(T.mitra.minimal);
    // Kontrak pertama PO awal termasuk modal awal: tidak ada yang dikembalikan; perpanjangan belum ditawarkan.
    expect(ondel).toMatchObject({ kurangPerpanjang: 'belum', pengembalianPutus: 0, tawaran: tawaranKontrakPo(s, 'ondelOndel') });
    expect(ondel.jurusan[0]).toMatchObject({ nama: 'JAKARTA', aktif: true, harga: T.hargaTiketDasar });
    expect(ondel.jurusan[1]).toMatchObject({ aktif: false, levelBuka: EKONOMI.mitra.levelJurusan[1] });
    expect(m.mitra.tersedia[0]!.id).toBe('peuyeumKilat');
    expect(m.mitra.tersedia[0]!.tawaran).toEqual(tawaranKontrakPo(s, 'peuyeumKilat'));
    for (const p of m.mitra.tersedia) expect(p.tawaran.nilai, p.id).toBeGreaterThan(0);
    const bisa = m.mitra.tersedia.filter((p) => p.kurang === null).map((p) => urutanPo(p.id));
    expect(bisa).toEqual([...bisa].sort((a, b) => a - b));
    expect(m.mitra.tersedia.find((p) => p.id === 'apelBatu')?.kurang).toEqual({ jenis: 'kelas', kelas: 1 });
    s = tick(daftarPo(s, 'peuyeumKilat'), 0.1);
    m = buatModel(s);
    expect(m.mitra.terdaftar.map((p) => p.id)).toEqual(['ondelOndel', 'peuyeumKilat']);
    expect(m.mitra.terdaftar[1]!.bagian).toBeGreaterThan(0);
  });

  it('tab Terminal: tarif, laporan keuangan hari ini & kemarin, perluasan dengan biaya operasionalnya', () => {
    const s = jalankan(padaJam(stateOtomatis({ jalur: 2, jendela: 3 }), 23.8, 0), 30);
    const t = buatModel(s).terminal;
    expect(t.tarif.map((x) => x.id)).toEqual(['sewaLoket', 'retribusiBus', 'parkir', 'sewaKios']);
    expect(t.tarif[0]).toMatchObject({ nilai: T.tarif.sewaLoket.bawaan, bawaan: T.tarif.sewaLoket.bawaan, bisaTurun: true, bisaNaik: true });
    expect(t.keuangan.kemarin).not.toBeNull();
    expect(t.keuangan.hariIni.laba).toBeCloseTo(t.keuangan.hariIni.totalPendapatan - t.keuangan.hariIni.totalBiaya, 6);
    expect(t.keuangan.kemarin!.hari).toBe('Senin');
    expect(t.keuangan.hariIni.hari).toBe('Selasa');
    expect(t.perluasan.berikut).toMatchObject({ tahap: 1, level: EKONOMI.mitra.perluasan[0]!.level, operasional: EKONOMI.mitra.perluasan[0]!.operasional, levelKurang: true, bisa: false });
  });

  it('target & penghargaan: lencana klaim', () => {
    const s = tick(denganBangunan(denganPetugas(stateOtomatis(), ['peron']), { toilet: 1 }), 0.1);
    const m = buatModel(s);
    expect(m.target).toMatchObject({ jenis: 'penumpang', selesai: false });
    expect(m.pencapaian.filter((p) => p.tercapai).map((p) => p.id)).toEqual(expect.arrayContaining(['petugasPertama', 'fasilitasPertama']));
    expect(m.jumlahKlaim).toBe(m.pencapaian.filter((p) => p.tercapai && !p.diklaim).length);
  });
});
