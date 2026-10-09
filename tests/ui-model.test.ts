import { describe, expect, it } from 'vitest';
import { PengendaliGame } from '../src/app/pengendali';
import { EKONOMI } from '../src/config/economy.config';
import { terapkanAksi } from '../src/sim/aksi';
import { slotBangunan } from '../src/sim/bangunan';
import { urutanPo } from '../src/sim/mitra';
import { aturTarif, buatStateBaru, daftarPo, keuanganSekarang, labaBuku, operasiState, tawaranKontrakPo, tick, type GameState } from '../src/sim/state';
import { AREA_IDS, buatModel } from '../src/ui/model';
import { denganBangunan, denganPetugas, denganPo, jalankan, kaya, padaJam, stateOtomatis, T0 } from './helpers';

const T = EKONOMI.tycoon;

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
    expect(b.bangunan.jendela).toMatchObject({ jumlah: 1, slot: slotBangunan('jendela', 0), biaya: T.bangunan.jendela.biaya[0], bisa: true, bongkar: null });
    expect(b.bangunan.toilet).toMatchObject({ jumlah: 1, slot: 1, biaya: null, slotBerikut: 3, perawatan: T.bangunan.toilet.perawatan });
    expect(b.bangunan.toilet.bongkar).toBeGreaterThan(0);
    expect(b.bangunan.posRetribusi.slotBerikut).toBeNull();
    expect(b.petakBus).toBe(T.petakBus[0]);
    expect(b.teknologi.find((t) => t.id === 'eTiket')?.syaratKurang).toBe('mesinTiket');
    // Biaya ikut kelas terminal.
    expect(buatModel({ ...s, perkembangan: { ...s.perkembangan, xpTerminal: 1e9 } }).bangun.bangunan.toilet.perawatan).toBeGreaterThan(T.bangunan.toilet.perawatan);
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
