import { describe, expect, it } from 'vitest';
import { acakBerbenih, DuniaVisual, kurvaKeluarPetak, kurvaMasukPetak, petugasCuci, posisiPetugasCuci, ruteKeGerbang, ruteKeKursi, saatLewat, tingkatKotor, type BusVisual, type FaseBus } from '../src/game/dunia-visual';
import { Jalur, lintasanS } from '../src/game/jalur';
import { loketBuka } from '../src/game/kehidupan-malam';
import { batasArusJurusan, hitungLajuVisual, lajuDasar, maskJurusanState, terapkanRitme, type LajuVisual } from '../src/game/laju';
import { EKONOMI } from '../src/config/economy.config';
import { MEJA_TUNGGU, Y_MEJA_TUNGGU } from '../src/game/gedung3d';
import { BLOK_KURSI, BUS, CUCI, diGedung, GERBANG_KELUAR_X, GERBANG_X, JUMLAH_ORANG_LABIRIN, JUMLAH_SLOT_LABIRIN, KECEPATAN_JALAN, KIOS_TUNGGU, KURSI_TUNGGU, LAJUR, LEBAR_GERBANG_PAGAR, LOKET, LORONG_PARKIR, MAKS_ORANG, maskAwal, PARKIR_SERONG, PERON, PERON_BERANGKAT, PINTU_BUS, PINTU_RUANG_TUNGGU, RUANG_TUNGGU, TALI_LABIRIN, VARIASI_JALAN, X_LOKET, Y_PAGAR } from '../src/game/tata-letak';
import { buatStateBaru, kepuasanTerminal } from '../src/sim/state';
import { denganPo, jarakPoligon, jarakTitikPoligon, jejakBus, ruasBerpotongan, stateOtomatis, T0 } from './helpers';

/** Rata-rata orang yang berdiri diam di antrean selama `detik` berikutnya. */
function rataBerdiri(dunia: DuniaVisual, detik: number, laju: LajuVisual): number {
  let total = 0;
  let n = 0;
  for (let t = 0; t < detik; t += 1 / 30, n++) {
    dunia.perbarui(1 / 30, laju);
    total += dunia.orang.filter((o) => o.fase === 'antre' && !o.bergerak).length;
  }
  return total / n;
}

function jalankan(dunia: DuniaVisual, detik: number, laju: LajuVisual): void {
  for (let t = 0; t < detik; t += 1 / 30) {
    dunia.perbarui(1 / 30, laju);
    const galat = dunia.periksaKonsistensi();
    if (galat.length > 0) throw new Error(`t=${t.toFixed(2)}: ${galat.join('; ')}`);
  }
}

/** Laju seimbang khas (lihat laju.ts): arus dasar ±1,4 orang/dtk, bus berisi 16. */
const SEIMBANG: LajuVisual = { turun: 1.4, layanLoket: 1.4, naik: 1.4, busDatang: 0.12, muatanBus: 16, faktorKecepatanBus: 1 };

describe('lintasan bus', () => {
  it('kurva S berawal & berakhir dengan arah +x', () => {
    const j = new Jalur(lintasanS([0, 1.9], [3.8, 5.0]));
    // Bézier disampling: arah di ujung meleset beberapa derajat.
    expect(Math.abs(j.pose(0).sudut)).toBeLessThan(0.1);
    expect(Math.abs(j.pose(j.panjang).sudut)).toBeLessThan(0.1);
    expect(j.pose(j.panjang).y).toBeCloseTo(5.0, 5);
  });

  it('masuk petak serong: dari lajur halte berakhir di pusat petak menghadap 45°', () => {
    const sx = PARKIR_SERONG.pusatX[2]!;
    const j = new Jalur(kurvaMasukPetak(sx));
    expect(j.pose(0).y).toBeCloseTo(LAJUR.halte, 5);
    const akhir = j.pose(j.panjang);
    expect(akhir.x).toBeCloseTo(sx, 5);
    expect(akhir.y).toBeCloseTo(PARKIR_SERONG.pusatY, 5);
    expect(akhir.sudut).toBeCloseTo(PARKIR_SERONG.sudut, 5);
  });

  it('keluar petak serong: maju lalu lurus di lorong belakang', () => {
    const j = new Jalur(kurvaKeluarPetak(PARKIR_SERONG.pusatX[0]!));
    expect(j.pose(0).sudut).toBeCloseTo(PARKIR_SERONG.sudut, 5);
    const akhir = j.pose(j.panjang);
    expect(akhir.y).toBeCloseTo(LAJUR.lorong, 5);
    expect(Math.abs(akhir.sudut)).toBeLessThan(0.1);
  });

  it('belokan halus: perubahan arah antar titik kecil', () => {
    for (const titik of [kurvaMasukPetak(16.4), kurvaKeluarPetak(16.4), lintasanS([0, 1.9], [3.8, 5.0])]) {
      const j = new Jalur(titik);
      let sebelum = j.pose(0).sudut;
      for (let s = 0.05; s <= j.panjang; s += 0.05) {
        const sudut = j.pose(s).sudut;
        expect(Math.abs(sudut - sebelum)).toBeLessThan(0.25);
        sebelum = sudut;
      }
    }
  });
});

describe('laju visual dari state sim', () => {
  it('game baru (tanpa Kepala): semua tahap langsung berjalan & bus datang', () => {
    const laju = hitungLajuVisual(buatStateBaru(T0));
    expect(laju.turun).toBeGreaterThan(0);
    expect(laju.layanLoket).toBeGreaterThan(0);
    expect(laju.naik).toBeGreaterThan(0);
    expect(laju.busDatang).toBeGreaterThan(0);
  });

  it('makin puas, makin banyak bus & calon penumpang datang; kapasitas tahap tetap', () => {
    const s = buatStateBaru(T0);
    // Kios & Toilet menaikkan kepuasan (komponen fasilitas) tanpa mengubah kapasitas.
    const puas = { ...s, terminal: { ...s.terminal, fasilitas: { ...s.terminal.fasilitas, kios: 3, toilet: 3 } } };
    expect(kepuasanTerminal(puas).nilai).toBeGreaterThan(kepuasanTerminal(s).nilai);
    const biasa = hitungLajuVisual(s);
    const ramai = hitungLajuVisual(puas);
    expect(ramai.busDatang).toBeGreaterThan(biasa.busDatang);
    expect(ramai.muatanBus).toBe(biasa.muatanBus);
    expect(ramai.layanLoket).toBe(biasa.layanLoket);
  });

  it('bottleneck berjalan paling lambat, tahap lain lebih cepat', () => {
    const s = stateOtomatis();
    const laju = hitungLajuVisual(s); // loket 0,8 bottleneck
    expect(laju.layanLoket).toBeCloseTo(Math.min(lajuDasar(0.8), batasArusJurusan(maskJurusanState(s))), 10);
    expect(laju.turun).toBeGreaterThan(laju.layanLoket);
    expect(laju.naik).toBeGreaterThan(laju.layanLoket);
  });

  it('arus visual dibatasi jendela loket yang buka: makin banyak jurusan dilayani, makin ramai', () => {
    const awal = stateOtomatis({ peron: 120, loket: 120, keberangkatan: 120 });
    // Empat PO lokal & regional di Lv 12 melayani kedelapan jurusan Jawa-Bali.
    let semua = awal;
    for (const id of ['ondelOndel', 'peuyeumKilat', 'lumpiaKilat', 'bakpiaRasa'] as const) semua = denganPo(semua, id, { level: 12 });
    expect(maskJurusanState(awal)).toBe(maskAwal(1));
    expect(maskJurusanState(semua)).toBe(maskAwal(8));
    const a = hitungLajuVisual(awal);
    const b = hitungLajuVisual(semua);
    expect(a.maskJurusan).toBe(maskAwal(1));
    expect(a.layanLoket).toBeLessThanOrEqual(batasArusJurusan(maskAwal(1)) * 2 + 1e-9);
    expect(b.turun).toBeGreaterThan(a.turun * 2);
    expect(b.busDatang).toBeGreaterThan(a.busDatang);
    // Tiap jurusan Jawa-Bali membuka satu jendela loket; rute antarpulau dijual di jendela yang sama.
    const darat = EKONOMI.jurusan.filter((j) => j.feri === undefined).length;
    for (let n = 2; n <= darat; n++) expect(batasArusJurusan(maskAwal(n))).toBeGreaterThan(batasArusJurusan(maskAwal(n - 1)));
    for (let n = darat + 1; n <= EKONOMI.jurusan.length; n++) expect(batasArusJurusan(maskAwal(n))).toBe(batasArusJurusan(maskAwal(darat)));
  });
});

describe('model keramaian dekoratif', () => {
  it('laju seimbang 5 menit: konsisten, bus parkir & berangkat, penumpang terus mengalir', { timeout: 30_000 }, () => {
    const dunia = new DuniaVisual({ acak: acakBerbenih(1) });
    // Pemanasan: bus pertama baru berangkat setelah turun, parkir, dicuci & menunggu jadwal (±3 menit).
    jalankan(dunia, 240, SEIMBANG);
    const awal = dunia.total;
    jalankan(dunia, 300, SEIMBANG);
    // Kapasitas turun 1,4/dtk; manuver bus & laju jalan alami: hasil nyata ≈ 1,25/dtk.
    expect(dunia.total.busKeluar - awal.busKeluar).toBeGreaterThan(15);
    expect((dunia.total.turun - awal.turun) / 300).toBeGreaterThan(1.05);
    expect((dunia.total.naikBus - awal.naikBus) / 300).toBeGreaterThan(1.0);
  });

  it('loket paling lambat → antrean loket penuh, ruang tunggu sepi', () => {
    const dunia = new DuniaVisual({ acak: acakBerbenih(2) });
    jalankan(dunia, 180, { ...SEIMBANG, layanLoket: 0.7 });
    expect(dunia.jumlahAntrean).toBeGreaterThanOrEqual(JUMLAH_ORANG_LABIRIN);
    expect(dunia.jumlahBerdiriAntre).toBeGreaterThan(JUMLAH_SLOT_LABIRIN);
    expect(dunia.jumlahDuduk).toBeLessThan(KURSI_TUNGGU.length * 0.1);
  });

  it('keberangkatan paling lambat → ruang tunggu penuh sesak', { timeout: 20_000 }, () => {
    const dunia = new DuniaVisual({ acak: acakBerbenih(3) });
    // Ruang tunggu 240 kursi (lima gerbang): butuh ±7 menit sampai penuh sesak.
    jalankan(dunia, 420, { ...SEIMBANG, naik: 0.6 });
    // Kursi terisi penumpang atau dipesan untuk anggota rombongannya.
    expect(dunia.jumlahKursiTerisi).toBeGreaterThan(KURSI_TUNGGU.length * 0.8);
    expect(dunia.jumlahTungguBerangkat).toBeGreaterThan(KURSI_TUNGGU.length * 0.6);
  });

  it('penumpang bertiket duduk di kursi ruang tunggu; hanya berjalan ke bus yang sedang berhenti memuat', () => {
    const dunia = new DuniaVisual({ acak: acakBerbenih(9) });
    let duduk = 0;
    let menujuBus = 0;
    for (let t = 0; t < 150; t += 1 / 30) {
      dunia.perbarui(1 / 30, SEIMBANG);
      for (const o of dunia.orang) {
        if (o.fase === 'tungguBerangkat') {
          duduk++;
          const k = KURSI_TUNGGU[o.slot]!;
          expect(o.x).toBe(k.x);
          expect(o.y).toBe(k.y);
        } else if (o.fase === 'naikBus') {
          menujuBus++;
          // Bus sudah berhenti, atau sedang maju ke halte depan yang kosong (penumpang ikut pindah).
          expect(['muat', 'keHalteBerangkat']).toContain(dunia.bus.find((b) => b.id === o.busId)?.fase);
        }
      }
    }
    expect(duduk).toBeGreaterThan(0);
    expect(menujuBus).toBeGreaterThan(0);
  });

  it('penumpang turun langsung keluar terminal; calon penumpang datang dari luar (trotoar/parkir)', () => {
    const dunia = new DuniaVisual({ acak: acakBerbenih(11) });
    const turun = new Set<number>();
    const calon = new Set<number>();
    let lewatGerbangKeluar = 0;
    for (let t = 0; t < 240; t += 1 / 30) {
      dunia.perbarui(1 / 30, SEIMBANG);
      for (const o of dunia.orang) {
        if (o.fase === 'pulang') {
          if (!turun.has(o.id)) {
            // Baru turun: muncul di pintu bus di halte kedatangan.
            expect(o.y).toBeLessThan(PERON.y1);
            expect(o.x).toBeLessThan(PERON.x1 + 0.5);
          }
          turun.add(o.id);
          if (Math.abs(o.y - Y_PAGAR) < 0.05) {
            expect(Math.abs(o.x - GERBANG_KELUAR_X)).toBeLessThan(LEBAR_GERBANG_PAGAR / 2);
            lewatGerbangKeluar++;
          }
        } else {
          // Tidak ada penumpang turun yang ikut antre lagi.
          expect(turun.has(o.id)).toBe(false);
          if (!calon.has(o.id)) {
            // Calon penumpang pertama kali terlihat di luar pagar atau di lorong parkir.
            const diLuar = o.y > Y_PAGAR || (o.x >= LORONG_PARKIR.x0 - 0.1 && Math.abs(o.y - LORONG_PARKIR.y) < 0.3);
            expect(diLuar).toBe(true);
            calon.add(o.id);
          }
        }
      }
    }
    // Laju jalan alami: arus ±1,1 orang/dtk setelah bus pertama tiba.
    expect(turun.size).toBeGreaterThan(180);
    expect(calon.size).toBeGreaterThan(180);
    expect(lewatGerbangKeluar).toBeGreaterThan(0);
    expect(dunia.total.pulang).toBeGreaterThan(120);
    // Sebagian penumpang mampir dulu (toilet, musholla, ATM, toko), jadi naik bus di awal lebih lambat.
    expect(dunia.total.naikBus).toBeGreaterThan(75);
  }, 30_000);

  it('calon penumpang beli tiket di jendela loket (paling banyak LOKET.maksPembeli per jendela), lalu berjalan ke ruang tunggu tanpa berpindah seketika', () => {
    const dunia = new DuniaVisual({ acak: acakBerbenih(12) });
    const dt = 1 / 30;
    const sebelum = new Map<number, readonly [number, number]>();
    const jendelaTerpakai = new Set<number>();
    const pernahBeli = new Set<number>();
    const galat: string[] = [];
    let sampaiKursi = 0;
    for (let t = 0; t < 180; t += dt) {
      dunia.perbarui(dt, SEIMBANG);
      galat.push(...dunia.periksaKonsistensi());
      for (const o of dunia.orang) {
        const p = sebelum.get(o.id);
        if (p && Math.hypot(o.x - p[0], o.y - p[1]) > KECEPATAN_JALAN * (1 + VARIASI_JALAN) * dt + 1e-9) galat.push(`orang ${o.id} (${o.fase}) berpindah seketika`);
        if (o.fase === 'beliTiket') {
          if (Math.abs(o.x - X_LOKET[o.loket]!) > 1e-9 || Math.abs(o.y - LOKET.yPembeli) > 1e-9) galat.push(`orang ${o.id} membeli tiket di luar jendela loket ${o.loket}`);
          jendelaTerpakai.add(o.loket);
          pernahBeli.add(o.id);
        }
        if (o.fase === 'tungguBerangkat' && pernahBeli.delete(o.id)) sampaiKursi++;
        sebelum.set(o.id, [o.x, o.y]);
      }
    }
    expect(galat.slice(0, 5)).toEqual([]);
    expect(jendelaTerpakai.size).toBe(X_LOKET.length);
    // Transaksi beberapa detik, dan yang mampir (toilet, musholla, ATM, toko) baru sampai kursi belakangan.
    expect(sampaiKursi).toBeGreaterThan(30);
  }, 20_000);

  it('orang di aula menyusuri labirin: tidak pernah menembus tali pembatas', () => {
    for (const [benih, layanLoket] of [
      [13, 0.7],
      [14, 2.5],
    ] as const) {
      const dunia = new DuniaVisual({ acak: acakBerbenih(benih) });
      const sebelum = new Map<number, readonly [number, number]>();
      const tembus: string[] = [];
      for (let t = 0; t < 120; t += 1 / 30) {
        dunia.perbarui(1 / 30, { ...SEIMBANG, layanLoket });
        for (const o of dunia.orang) {
          const p = sebelum.get(o.id);
          sebelum.set(o.id, [o.x, o.y]);
          if (!p || !diGedung(o.x, o.y)) continue;
          for (const [x0, y0, x1, y1] of TALI_LABIRIN) {
            if (ruasBerpotongan(p, [o.x, o.y], [x0, y0], [x1, y1])) tembus.push(`orang ${o.id} (${o.fase}) menembus tali di (${o.x.toFixed(2)}, ${o.y.toFixed(2)})`);
          }
        }
      }
      expect(tembus.slice(0, 5)).toEqual([]);
    }
  }, 20_000);

  it('loket berhenti → jendela loket kosong, antrean tertahan di labirin', () => {
    const dunia = new DuniaVisual({ acak: acakBerbenih(15) });
    jalankan(dunia, 60, SEIMBANG);
    jalankan(dunia, 20, { ...SEIMBANG, layanLoket: 0 });
    expect(dunia.jumlahDiLoket).toBe(0);
    expect(dunia.orang.some((o) => o.fase === 'keLoket')).toBe(false);
    expect(dunia.jumlahAntrean).toBeGreaterThan(10);
  });

  it('loket bukan bottleneck → deretan jendela tidak jadi hambatan palsu: orang di labirin terus berjalan, tidak berdiri menumpuk', () => {
    const seimbang = new DuniaVisual({ acak: acakBerbenih(16) });
    const lajuSeimbang = { ...SEIMBANG, layanLoket: 2.6 };
    jalankan(seimbang, 120, lajuSeimbang);
    expect(rataBerdiri(seimbang, 60, lajuSeimbang)).toBeLessThan(4);
    // Throughput tinggi: jendela tetap sanggup (lama transaksi menyesuaikan laju).
    const cepat = new DuniaVisual({ acak: acakBerbenih(17) });
    const lajuCepat: LajuVisual = { turun: 3.2, layanLoket: 3.6, naik: 3.6, busDatang: 0.125, muatanBus: 19, faktorKecepatanBus: 1.06 };
    jalankan(cepat, 120, lajuCepat);
    // Arus tinggi: beberapa orang sesaat berdiri di kepala/ujung baris, tapi tidak menumpuk.
    expect(rataBerdiri(cepat, 60, lajuCepat)).toBeLessThan(12);
    expect(cepat.jumlahBerdiriAntre).toBeLessThan(20);
    // Pembanding: loket yang memang paling lambat membuat labirin penuh orang berdiri.
    const lambat = new DuniaVisual({ acak: acakBerbenih(18) });
    const lajuLambat = { ...SEIMBANG, layanLoket: 0.7 };
    jalankan(lambat, 150, lajuLambat);
    expect(rataBerdiri(lambat, 30, lajuLambat)).toBeGreaterThan(JUMLAH_SLOT_LABIRIN * 0.7);
  }, 30_000);

  it('sedikit jurusan (2): hanya 2 jendela loket melayani, dan itu tetap bukan hambatan palsu', () => {
    const buka = loketBuka(12, maskAwal(2));
    const galat: string[] = [];
    const dunia = new DuniaVisual({ acak: acakBerbenih(16) });
    const lajuSeimbang: LajuVisual = { ...SEIMBANG, layanLoket: 2.6, loketBuka: buka };
    for (let t = 0; t < 120; t += 1 / 30) {
      dunia.perbarui(1 / 30, lajuSeimbang);
      galat.push(...dunia.periksaKonsistensi());
      for (const o of dunia.orang) if (o.fase === 'beliTiket' && !buka.includes(o.loket)) galat.push(`orang ${o.id} membeli di jendela tutup ${o.loket}`);
    }
    expect(galat.slice(0, 5)).toEqual([]);
    expect(rataBerdiri(dunia, 60, lajuSeimbang)).toBeLessThan(4);
    // Arus tinggi dengan jendela sesedikit ini: sesaat ada yang berdiri, tapi tidak menumpuk.
    const cepat = new DuniaVisual({ acak: acakBerbenih(17) });
    const lajuCepat: LajuVisual = { turun: 3.2, layanLoket: 3.6, naik: 3.6, busDatang: 0.125, muatanBus: 19, faktorKecepatanBus: 1.06, loketBuka: buka };
    jalankan(cepat, 120, lajuCepat);
    expect(rataBerdiri(cepat, 60, lajuCepat)).toBeLessThan(12);
  }, 60_000);

  it('bus datang berdebu, dicuci di petak parkir (ada keneknya), dan baru berangkat setelah bersih', () => {
    const dunia = new DuniaVisual({ acak: acakBerbenih(19) });
    const fase = new Map<number, FaseBus>();
    const galat: string[] = [];
    let berangkatBersih = 0;
    // Bus menunggu jadwal (ISTIRAHAT_DETIK) setelah bersih, jadi keberangkatan pertama lebih lambat.
    for (let t = 0; t < 300; t += 1 / 30) {
      dunia.perbarui(1 / 30, SEIMBANG);
      for (const b of dunia.bus) {
        if (b.jenis !== 'terminal') continue;
        const lalu = fase.get(b.id);
        if (b.fase === 'turunkan' && tingkatKotor(b) < 0.5) galat.push(`bus ${b.id} tiba tanpa debu`);
        if (b.fase === 'parkir' && b.cuci > 0.02 && b.cuci < 0.98 && posisiPetugasCuci(b).length === 0) galat.push(`bus ${b.id} dicuci tanpa petugas`);
        if (lalu === 'parkir' && b.fase !== 'parkir') {
          if (b.cuci < 1 || tingkatKotor(b) > 0) galat.push(`bus ${b.id} berangkat sebelum bersih (cuci ${b.cuci.toFixed(2)})`);
          else berangkatBersih++;
        }
        fase.set(b.id, b.fase);
      }
    }
    expect(galat.slice(0, 5)).toEqual([]);
    expect(berangkatBersih).toBeGreaterThan(10);
  }, 20_000);

  it('kenek (menyabun) lalu sopir (membilas) turun lewat pintu depan, mengelilingi bus tanpa menabrak bus sebelah, lalu naik lagi', () => {
    const X = PARKIR_SERONG.pusatX;
    const i = 4;
    const bus = { x: X[i]!, y: PARKIR_SERONG.pusatY, sudut: PARKIR_SERONG.sudut, fase: 'parkir', cuci: 0 } as unknown as BusVisual;
    const jejak = (sx: number) => jejakBus(sx, PARKIR_SERONG.pusatY, PARKIR_SERONG.sudut, BUS.panjang, BUS.lebar);
    const sendiri = jejak(X[i]!);
    const tetangga = [jejak(X[i - 1]!), jejak(X[i + 1]!)];
    expect(petugasCuci(0)).toEqual([]);
    expect(petugasCuci(1)).toEqual([]);
    // Kenek menyabun lebih dulu, sopir menyusul membilas; busa luntur setelah dibilas.
    expect(petugasCuci(0.1).map((q) => q.peran)).toEqual(['kenek']);
    expect(petugasCuci(0.5).map((q) => q.peran)).toEqual(['kenek', 'sopir']);
    expect(petugasCuci(0.95).map((q) => q.peran)).toEqual(['sopir']);
    for (let u = 0; u <= 1; u += 0.1) expect(saatLewat('sopir', u)).toBeGreaterThan(saatLewat('kenek', u) + 0.1);
    for (const peran of ['kenek', 'sopir'] as const) {
      let lalu: readonly [number, number] | null = null;
      let tempuhKeliling = 0;
      let muncul = 0;
      for (let p = 0.0005; p < 1; p += 0.0005) {
        bus.cuci = p;
        const q = petugasCuci(p).find((x) => x.peran === peran);
        const pos = posisiPetugasCuci(bus).find((x) => x.peran === peran)?.titik;
        if (!q || !pos) {
          lalu = null;
          continue;
        }
        // Muncul & menghilang di balik pintu depan (tertutup badan bus).
        if (!lalu) {
          expect(q.lokal[0]).toBeCloseTo(PINTU_BUS, 9);
          expect(q.lokal[1]).toBeLessThan(BUS.lebar / 2);
          muncul++;
        } else {
          const langkah = Math.hypot(pos[0] - lalu[0], pos[1] - lalu[1]);
          expect(langkah).toBeLessThan(0.02); // tidak berpindah seketika
          if (q.bekerja) tempuhKeliling += langkah;
        }
        lalu = pos;
        if (q.bekerja) {
          expect(jarakTitikPoligon(pos, sendiri)).toBeGreaterThan(0.06);
          for (const t of tetangga) expect(jarakTitikPoligon(pos, t)).toBeGreaterThan(0.1);
        }
      }
      expect(muncul).toBe(1);
      // Satu putaran penuh mengelilingi bus dengan laju jalan biasa.
      expect(tempuhKeliling).toBeGreaterThan(2 * (BUS.panjang + BUS.lebar));
      expect(tempuhKeliling / (CUCI.detik * CUCI.lamaPutaran)).toBeLessThanOrEqual(KECEPATAN_JALAN * (1 + VARIASI_JALAN));
    }
  });

  it('tanpa bus di halte keberangkatan, penumpang tetap duduk menunggu', () => {
    const dunia = new DuniaVisual({ acak: acakBerbenih(10) });
    jalankan(dunia, 90, { ...SEIMBANG, naik: 0.6 });
    // Bus berhenti datang (dan tidak ada yang naik) sampai bus yang tersisa pergi.
    // Bus di pangkalan (cuci, menunggu jadwal) dikosongkan lewat lima halte (ngetem 15 dtk): < 4 menit.
    jalankan(dunia, 240, { ...SEIMBANG, busDatang: 0, naik: 0 });
    expect(dunia.bus.filter((b) => b.jenis === 'terminal')).toHaveLength(0);
    // Penumpang bertiket (termasuk yang sedang ke kios lalu kembali ke kursinya) tidak berkurang.
    const bertiket = (): number => dunia.orang.filter((o) => o.slot >= 0).length;
    const sebelum = bertiket();
    expect(dunia.jumlahDuduk).toBeGreaterThan(5);
    jalankan(dunia, 20, { ...SEIMBANG, busDatang: 0 });
    expect(bertiket()).toBe(sebelum);
    expect(dunia.orang.some((o) => o.fase === 'naikBus')).toBe(false);
  });

  it('rute di ruang tunggu tidak menembus blok kursi dan keluar lewat gerbang', () => {
    const blok = BLOK_KURSI.map((b) => ({ x0: b.x0, x1: b.x1 }));
    const barisY = KURSI_TUNGGU.map((k) => k.y);
    const menembus = (x: number, y: number): boolean =>
      blok.some((b) => x > b.x0 + 0.01 && x < b.x1 - 0.01) && barisY.some((yb) => y > yb - 0.07 && y < yb + 0.09);
    const periksa = (awal: readonly [number, number], rute: readonly (readonly [number, number])[], lewatiAwal: boolean, lewatiAkhir: boolean): void => {
      let p = awal;
      rute.forEach((q, i) => {
        const dilewati = (lewatiAwal && i === 0) || (lewatiAkhir && i === rute.length - 1);
        if (!dilewati) {
          for (let t = 0.05; t < 0.95; t += 0.05) expect(menembus(p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t)).toBe(false);
        }
        p = q;
      });
    };
    KURSI_TUNGGU.forEach((k, i) => {
      periksa(PINTU_RUANG_TUNGGU, ruteKeKursi(i), false, true);
      for (const g of GERBANG_X) {
        const rute = ruteKeGerbang(i, g);
        periksa([k.x, k.y], rute, true, false);
        expect(rute[rute.length - 1]).toEqual([g, PERON_BERANGKAT.y1]);
      }
    });
  });

  it('rute di ruang tunggu tidak menabrak meja makan dan kios', () => {
    const titik: [number, number][] = [];
    const kumpulkan = (awal: readonly [number, number], rute: readonly (readonly [number, number])[]): void => {
      let p = awal;
      for (const q of rute) {
        for (let t = 0; t <= 1; t += 0.05) titik.push([p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t]);
        p = q;
      }
    };
    KURSI_TUNGGU.forEach((k, i) => {
      kumpulkan(PINTU_RUANG_TUNGGU, ruteKeKursi(i));
      for (const g of GERBANG_X) kumpulkan([k.x, k.y], ruteKeGerbang(i, g));
    });
    let jarakMeja = Number.POSITIVE_INFINITY;
    let xDekatKios = Number.POSITIVE_INFINITY;
    for (const [x, y] of titik) {
      for (const mx of MEJA_TUNGGU) jarakMeja = Math.min(jarakMeja, Math.hypot(x - mx, y - Y_MEJA_TUNGGU));
      if (KIOS_TUNGGU.some(([ya, yb]) => y > ya && y < yb)) xDekatKios = Math.min(xDekatKios, x);
    }
    expect(jarakMeja).toBeGreaterThan(0.31);
    expect(xDekatKios).toBeGreaterThan(RUANG_TUNGGU.x0 + 0.82);
  });

  it('peron diam → bus menumpuk di jalan raya (macet), tidak ada yang turun', () => {
    const dunia = new DuniaVisual({ acak: acakBerbenih(4) });
    jalankan(dunia, 120, { ...SEIMBANG, turun: 0 });
    expect(dunia.orang).toHaveLength(0);
    expect(dunia.jumlahBusMenunggu).toBeGreaterThanOrEqual(2);
  });

  it('semua berhenti lalu jalan lagi: tidak macet permanen', () => {
    const dunia = new DuniaVisual({ acak: acakBerbenih(5) });
    jalankan(dunia, 90, { ...SEIMBANG, turun: 0, layanLoket: 0, naik: 0 });
    const sebelum = dunia.total.naikBus;
    jalankan(dunia, 240, SEIMBANG);
    // Laju naik tunak ±0,9/dtk. Selama ±1,5 menit pertama penumpang baru berjalan dari bus
    // ke loket, antre, (sebagian mampir dulu) ke kursi, dan bus pertama dicuci dulu sebelum bisa berangkat.
    expect(dunia.total.naikBus - sebelum).toBeGreaterThan(0.75 * 0.9 * (240 - 90));
    expect(dunia.bus.length).toBeLessThan(40);
  });

  it('laju sangat tinggi: jumlah orang tetap dibatasi', () => {
    const dunia = new DuniaVisual({ acak: acakBerbenih(6) });
    jalankan(dunia, 120, { turun: 7, layanLoket: 7, naik: 7, busDatang: 1, muatanBus: 18, faktorKecepatanBus: 1.8 });
    expect(dunia.orang.length).toBeLessThanOrEqual(MAKS_ORANG);
  });

  it('laju berganti acak 10 menit: invarian tetap terjaga', () => {
    const acak = acakBerbenih(7);
    const dunia = new DuniaVisual({ acak });
    for (let i = 0; i < 20; i++) {
      const r = (): number => (acak() < 0.2 ? 0 : acak() * 6);
      jalankan(dunia, 30, {
        turun: r(),
        layanLoket: r(),
        naik: r(),
        busDatang: 0.1 + acak() * 0.6,
        muatanBus: 8 + Math.floor(acak() * 11),
        faktorKecepatanBus: 1 + acak() * 0.8,
      });
    }
    expect(dunia.periksaKonsistensi()).toEqual([]);
  });

  it('ritme harian: jam sibuk menumpuk antrean di loket yang lambat, lalu surut & lengang saat sepi', () => {
    const dunia = new DuniaVisual({ acak: acakBerbenih(21) });
    const dasar = { ...SEIMBANG, layanLoket: 1.0 };
    jalankan(dunia, 180, terapkanRitme(dasar, 1));
    expect(dunia.jumlahAntrean).toBeGreaterThan(60);
    const orangSibuk = dunia.orang.length;
    const busSibuk = dunia.total.busKeluar;
    // Dini hari: bus jarang & kosong. Kapasitas loket tetap, jadi sisa antrean jam sibuk
    // terlayani; bus tetap berangkat (kursinya penuh oleh penumpang yang menunggu).
    // Terminal panjang (5 halte, 20 petak): bus & orang yang masih di jalan butuh ±8 menit.
    jalankan(dunia, 480, terapkanRitme(dasar, 0.15));
    expect(dunia.jumlahAntrean).toBeLessThan(25);
    expect(dunia.jumlahTungguBerangkat).toBeLessThan(40);
    expect(dunia.orang.length).toBeLessThan(orangSibuk * 0.45);
    expect(dunia.total.busKeluar).toBeGreaterThan(busSibuk + 8);
  }, 40_000);

  it('laju tinggi dari state nyata: loket lambat tetap memicu antrean', () => {
    // Dua jurusan dilayani (PO kedua sudah bergabung), Loket jauh lebih lambat dari tahap lain.
    const laju = hitungLajuVisual(denganPo(stateOtomatis({ peron: 120, loket: 60, keberangkatan: 120 }), 'peuyeumKilat'));
    const dunia = new DuniaVisual({ acak: acakBerbenih(8) });
    jalankan(dunia, 150, laju);
    expect(dunia.jumlahAntrean).toBeGreaterThan(JUMLAH_SLOT_LABIRIN * 0.7);
  });
});

describe('pangkalan per jurusan', () => {
  it('bus parkir di kelompok jurusannya; semua kelompok terpakai; pengumuman memakai jurusan bus', async () => {
    const { KELOMPOK_PARKIR, kelompokPetak } = await import('../src/game/tata-letak');
    const dunia = new DuniaVisual({ acak: acakBerbenih(51) });
    const kelompokDipakai = new Set<number>();
    const petakDipakai = new Set<number>();
    const galat: string[] = [];
    let panggil = 0;
    for (let t = 0; t < 300; t += 1 / 30) {
      dunia.perbarui(1 / 30, { ...SEIMBANG, naik: 0.9 });
      for (const b of dunia.bus) {
        if (b.fase !== 'parkir') continue;
        const k = kelompokPetak(b.petak);
        kelompokDipakai.add(k);
        petakDipakai.add(b.petak);
        if (!KELOMPOK_PARKIR[k]!.tujuan.includes(b.tujuan)) galat.push(`bus ${b.id} jurusan ${b.tujuan} parkir di kelompok ${k}`);
      }
      for (const e of dunia.peristiwa) {
        if (e.jenis !== 'panggil') continue;
        panggil++;
        if (e.tujuan < 0) galat.push(`bus ${e.busId} dipanggil tanpa jurusan`);
      }
    }
    expect(galat.slice(0, 5)).toEqual([]);
    expect(kelompokDipakai.size).toBe(4);
    expect(petakDipakai.size).toBeGreaterThan(9);
    expect(panggil).toBeGreaterThan(5);
  }, 30_000);
});

describe('hitungan penumpang saat keberangkatan', () => {
  it('penumpang naik bertambah selama memuat, tak pernah melebihi kapasitas, dan sama dengan muatan saat bus berangkat', () => {
    const dunia = new DuniaVisual({ acak: acakBerbenih(61) });
    const fase = new Map<number, string>();
    const naikLalu = new Map<number, number>();
    const galat: string[] = [];
    let berangkat = 0;
    let berisi = 0;
    for (let t = 0; t < 300; t += 1 / 30) {
      dunia.perbarui(1 / 30, SEIMBANG);
      galat.push(...dunia.periksaKonsistensi());
      for (const b of dunia.bus) {
        if (b.jenis !== 'terminal') continue;
        if (b.penumpangNaik < (naikLalu.get(b.id) ?? 0)) galat.push(`bus ${b.id} penumpang naik berkurang`);
        naikLalu.set(b.id, b.penumpangNaik);
        if (b.penumpangNaik > b.kapasitas) galat.push(`bus ${b.id} melebihi kapasitas`);
        if (fase.get(b.id) === 'muat' && b.fase === 'keluar') {
          berangkat++;
          if (b.penumpangNaik !== b.muatan) galat.push(`bus ${b.id} berangkat dengan naik ${b.penumpangNaik} ≠ muatan ${b.muatan}`);
          if (b.penumpangNaik > 0) berisi++;
        }
        fase.set(b.id, b.fase);
      }
    }
    expect(galat.slice(0, 5)).toEqual([]);
    expect(berangkat).toBeGreaterThan(5);
    expect(berisi).toBeGreaterThan(3);
  }, 30_000);
});

describe('peron kedatangan', () => {
  it('semua bus di samping peron menurunkan penumpang bersamaan, diam selama menurunkan, dan yang selesai lebih dulu mendahului', async () => {
    const { HALTE_DATANG_X } = await import('../src/game/tata-letak');
    const dunia = new DuniaVisual({ acak: acakBerbenih(71) });
    // Bus datang rapat supaya beberapa halte kedatangan terisi sekaligus.
    const laju: LajuVisual = { ...SEIMBANG, turun: 1.6, busDatang: 0.3, muatanBus: 16 };
    const muatanLalu = new Map<number, number>();
    const posisiTurun = new Map<number, readonly [number, number]>();
    const turunTerakhir = new Map<number, number>();
    const galat: string[] = [];
    let saatBersamaan = 0;
    let mendahului = 0;
    let turunDiHalteBelakang = 0;
    for (let t = 0; t < 240; t += 1 / 30) {
      const faseLalu = new Map(dunia.bus.map((b) => [b.id, { fase: b.fase, halte: b.halte }] as const));
      dunia.perbarui(1 / 30, laju);
      for (const b of dunia.bus) {
        if (b.jenis !== 'terminal') continue;
        const lalu = muatanLalu.get(b.id);
        if (b.fase === 'turunkan' && lalu !== undefined && b.muatan < lalu) {
          turunTerakhir.set(b.id, t);
          if (b.halte > 0) turunDiHalteBelakang++;
        }
        muatanLalu.set(b.id, b.muatan);
        // Diam selama menurunkan penumpang.
        if (b.fase === 'turunkan' && b.muatan > 0) {
          const p = posisiTurun.get(b.id);
          if (!p) posisiTurun.set(b.id, [b.x, b.y]);
          else if (Math.hypot(b.x - p[0], b.y - p[1]) > 1e-9) galat.push(`bus ${b.id} bergerak saat menurunkan penumpang`);
        }
        // Mendahului: bus di halte belakang berangkat saat bus di depannya masih menurunkan penumpang.
        const f = faseLalu.get(b.id);
        if (f?.fase === 'turunkan' && b.fase === 'kePetak' && f.halte > 0) {
          const depanMasihTurun = dunia.bus.some((c) => c.fase === 'turunkan' && c.muatan > 0 && c.halte >= 0 && c.halte < f.halte);
          if (depanMasihTurun) mendahului++;
        }
      }
      // Dua bus atau lebih menurunkan penumpang dalam 3 detik terakhir.
      if ([...turunTerakhir.values()].filter((w) => t - w < 3).length >= 2) saatBersamaan++;
    }
    expect(galat.slice(0, 5)).toEqual([]);
    expect(HALTE_DATANG_X.length).toBe(5);
    expect(turunDiHalteBelakang).toBeGreaterThan(20);
    expect(saatBersamaan).toBeGreaterThan(30 * 30);
    expect(mendahului).toBeGreaterThan(0);
  }, 30_000);

  it('bus baru langsung mengisi halte kosong di depan bus yang sedang menurunkan penumpang (menyalip lewat sirkulasi), tanpa bertumpuk', async () => {
    const { MASUK } = await import('../src/game/tata-letak');
    const dunia = new DuniaVisual({ acak: acakBerbenih(29) });
    // Peron lambat & bus rapat: halte belakang sering terisi bus yang masih menurunkan penumpang.
    const laju: LajuVisual = { ...SEIMBANG, turun: 0.9, busDatang: 0.3, muatanBus: 16 };
    const galat: string[] = [];
    let menyalipMasuk = 0;
    let tertahanPadahalKosong = 0;
    for (let t = 0; t < 240; t += 1 / 30) {
      const faseLalu = new Map(dunia.bus.map((b) => [b.id, b.fase] as const));
      dunia.perbarui(1 / 30, laju);
      const turunkan = dunia.bus.filter((b) => b.fase === 'turunkan');
      for (const b of dunia.bus) {
        if (b.jenis !== 'terminal') continue;
        // Tiba di halte yang ada bus lain masih menurunkan penumpang di belakangnya.
        if (faseLalu.get(b.id) === 'masuk' && b.fase === 'turunkan' && turunkan.some((c) => c !== b && c.muatan > 0 && c.halte > b.halte)) menyalipMasuk++;
        // Menunggu di jalan raya padahal ada halte kedatangan yang kosong.
        const adaKosong = [0, 1, 2, 3, 4].some((k) => !dunia.bus.some((c) => (c.fase === 'masuk' || c.fase === 'turunkan') && c.halte === k));
        if (b.fase === 'masuk' && b.halte < 0 && b.x < MASUK.dari[0] && b.v < 0.05 && adaKosong) tertahanPadahalKosong++;
      }
      // Bus di sekitar peron kedatangan tidak pernah bertumpuk.
      const dekat = dunia.bus.filter((b) => b.jenis === 'terminal' && b.x < -5 && b.fase !== 'parkir');
      for (let i = 0; i < dekat.length; i++) {
        for (let j = i + 1; j < dekat.length; j++) {
          const a = dekat[i]!;
          const c = dekat[j]!;
          if (Math.hypot(a.x - c.x, a.y - c.y) > BUS.panjang + 0.2) continue;
          const d = jarakPoligon(jejakBus(a.x, a.y, a.sudut, BUS.panjang, BUS.lebar), jejakBus(c.x, c.y, c.sudut, BUS.panjang, BUS.lebar));
          if (d < 0.05) galat.push(`t=${t.toFixed(1)} bus ${a.id} (${a.fase}) & ${c.id} (${c.fase}) berjarak ${d.toFixed(3)}`);
        }
      }
      galat.push(...dunia.periksaKonsistensi());
    }
    expect(galat.slice(0, 5)).toEqual([]);
    expect(menyalipMasuk).toBeGreaterThan(3);
    // Hanya sesaat (satu frame pemesanan), bukan antre panjang di jalan raya.
    expect(tertahanPadahalKosong).toBeLessThan(30);
  }, 30_000);
});

describe('halte keberangkatan', () => {
  it('bus di halte belakang yang berangkat lebih dulu mendahului bus yang masih memuat di depannya (tidak tertahan)', () => {
    const dunia = new DuniaVisual({ acak: acakBerbenih(81) });
    // Naik lambat: bus sering berangkat setelah batas ngetem, di halte mana pun.
    const laju: LajuVisual = { ...SEIMBANG, naik: 0.5, busDatang: 0.2 };
    const pantau = new Map<number, { t: number; xDepan: number }>();
    const galat: string[] = [];
    let mendahului = 0;
    const faseLalu = new Map<number, { fase: string; halte: number }>();
    for (let t = 0; t < 420; t += 1 / 30) {
      dunia.perbarui(1 / 30, laju);
      for (const b of dunia.bus) {
        if (b.jenis !== 'terminal') continue;
        const lalu = faseLalu.get(b.id);
        if (lalu?.fase === 'muat' && b.fase === 'keluar' && lalu.halte > 0) {
          const depan = dunia.bus.find((c) => c.fase === 'muat' && c.halte >= 0 && c.halte < lalu.halte);
          if (depan) pantau.set(b.id, { t, xDepan: depan.x });
        }
        faseLalu.set(b.id, { fase: b.fase, halte: b.halte });
        const p = pantau.get(b.id);
        if (p && t - p.t > 8) {
          if (b.x > p.xDepan + 1) mendahului++;
          else galat.push(`bus ${b.id} tertahan di belakang bus yang memuat (x ${b.x.toFixed(2)})`);
          pantau.delete(b.id);
        }
      }
    }
    expect(galat.slice(0, 5)).toEqual([]);
    expect(mendahului).toBeGreaterThan(0);
  }, 30_000);
});

describe('halte keberangkatan tanpa maju', () => {
  it('bus yang memuat tetap di halte (gerbang)-nya; bus dari pangkalan mengisi halte kosong mana pun', () => {
    const dunia = new DuniaVisual({ acak: acakBerbenih(91) });
    const halteMuat = new Map<number, number>();
    const galat: string[] = [];
    let isiBebas = 0;
    const faseLalu = new Map<number, string>();
    for (let t = 0; t < 420; t += 1 / 30) {
      dunia.perbarui(1 / 30, { ...SEIMBANG, naik: 0.8, busDatang: 0.18 });
      galat.push(...dunia.periksaKonsistensi());
      for (const b of dunia.bus) {
        if (b.jenis !== 'terminal') continue;
        if (b.fase === 'muat') {
          const h = halteMuat.get(b.id);
          if (h === undefined) halteMuat.set(b.id, b.halte);
          else if (h !== b.halte) galat.push(`bus ${b.id} pindah halte ${h} → ${b.halte}`);
        }
        // Baru dipanggil dari pangkalan ke halte yang di belakangnya masih ada bus.
        if (faseLalu.get(b.id) === 'parkir' && b.fase === 'keHalteBerangkat') {
          if (dunia.bus.some((c) => c !== b && c.halte > b.halte && (c.fase === 'muat' || c.fase === 'keHalteBerangkat'))) isiBebas++;
        }
        faseLalu.set(b.id, b.fase);
      }
    }
    expect(galat.slice(0, 5)).toEqual([]);
    expect(halteMuat.size).toBeGreaterThan(10);
    expect(isiBebas).toBeGreaterThan(0);
  }, 30_000);
});

describe('jurusan yang dilayani', () => {
  /** Jalankan 300 detik: jurusan tujuan bus & berapa kali bus parkir di kelompok yang jurusannya dilayani / tidak. */
  async function amati(mask: number, benih: number): Promise<{ tujuan: Set<number>; parkirTerbuka: number; parkirLain: number }> {
    const { KELOMPOK_PARKIR, kelompokPetak, jurusanDiMask } = await import('../src/game/tata-letak');
    const dunia = new DuniaVisual({ acak: acakBerbenih(benih) });
    const tujuan = new Set<number>();
    let parkirTerbuka = 0;
    let parkirLain = 0;
    for (let t = 0; t < 300; t += 1 / 30) {
      dunia.perbarui(1 / 30, { ...SEIMBANG, maskJurusan: mask });
      for (const b of dunia.bus) {
        if (b.tujuan >= 0) tujuan.add(b.tujuan);
        if (b.fase === 'parkir') {
          if (KELOMPOK_PARKIR[kelompokPetak(b.petak)]!.tujuan.some((j) => jurusanDiMask(mask, j))) parkirTerbuka++;
          else parkirLain++;
        }
      }
    }
    return { tujuan, parkirTerbuka, parkirLain };
  }

  it('bus hanya melayani jurusan yang dilayani PO; kelompok parkir tanpa jurusan dilayani dipagari', async () => {
    const h = await amati(maskAwal(3), 101);
    expect([...h.tujuan].every((j) => j < 3)).toBe(true);
    expect(h.tujuan.size).toBe(3);
    expect(h.parkirTerbuka).toBeGreaterThan(0);
    expect(h.parkirLain).toBe(0);
  }, 30_000);

  it('jurusan yang dilayani tidak harus urut (tiap PO punya jurusannya sendiri)', async () => {
    // Jakarta & Surabaya saja: kelompok Jakarta-Bandung dan Surabaya-Denpasar.
    const mask = 2 ** 0 + 2 ** 5;
    const h = await amati(mask, 102);
    expect([...h.tujuan].sort((a, b) => a - b)).toEqual([0, 5]);
    expect(h.parkirTerbuka).toBeGreaterThan(0);
    expect(h.parkirLain).toBe(0);
  }, 30_000);
});
