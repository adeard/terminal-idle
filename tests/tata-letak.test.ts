import { describe, expect, it } from 'vitest';
import { kurvaKeluarPetak, kurvaMasukPetak, posisiLintasan, posisiSlotAntrean, ruteKeHalteBerangkat, ruteKeHalteDatang, ruteLoketKeRuangTunggu } from '../src/game/dunia-visual';
import { Jalur, lintasanS } from '../src/game/jalur';
import {
  BLOK_KURSI,
  BORDES,
  BUS,
  diBawahAtap,
  diGedung,
  GANG_RUKO,
  GEDUNG,
  GERBANG_KELUAR_X,
  GERBANG_MASUK_X,
  GERBANG_X,
  HALTE_BERANGKAT_X,
  HALTE_DATANG_X,
  JALUR_ANTREAN,
  JUMLAH_SLOT_LABIRIN,
  JUMLAH_SLOT_LUAPAN,
  KURSI,
  KURSI_TUNGGU,
  LABIRIN,
  LEBAR_GERBANG_PAGAR,
  LOKET,
  MULUT_ANTREAN,
  LAJUR,
  PERON,
  PERON_BERANGKAT,
  PINTU_BUS,
  PINTU_MASUK,
  PINTU_RUANG_TUNGGU,
  posisiPembeli,
  RUANG_TUNGGU,
  SAMBUNG_BERANGKAT,
  PARKIR_SERONG,
  POS_CUCI,
  TALI_LABIRIN,
  URUTAN_LOKET,
  TINGGI_LANTAI_GEDUNG,
  TINGGI_PERON,
  tinggiLantai,
  TITIK_INTI,
  TITIK_PINTU_LUAR,
  X_JALUR_KAKI,
  X_LOKET,
  Y_DEPAN_GERBANG,
  Y_LORONG_LOKET,
  Y_LORONG_TUNGGU,
  Y_LUAPAN,
  Y_PAGAR,
  Y_TROTOAR_BELAKANG,
  ZONA,
  type Titik,
} from '../src/game/tata-letak';
import { jarakPoligon, jejakBus, ruasBerpotongan } from './helpers';

const di = (x: number, y: number, a: { x0: number; y0: number; x1: number; y1: number }): boolean =>
  x >= a.x0 && x <= a.x1 && y >= a.y0 && y <= a.y1;

describe('denah', () => {
  it('slot orang berada di peron / ruang tunggu / area antrean yang benar', () => {
    for (const k of KURSI_TUNGGU) expect(di(k.x, k.y, RUANG_TUNGGU)).toBe(true);
    // Tiap slot labirin di dalam tali keliling, bergeser geserKolom dari garis tengah lajurnya.
    const xB = Math.min(...TALI_LABIRIN.flatMap(([x0, , x1]) => [x0, x1]));
    const xT = Math.max(...TALI_LABIRIN.flatMap(([x0, , x1]) => [x0, x1]));
    const yU = Math.min(...TALI_LABIRIN.flatMap(([, y0, , y1]) => [y0, y1]));
    const yS = Math.max(...TALI_LABIRIN.flatMap(([, y0, , y1]) => [y0, y1]));
    const lintasan = new Jalur(JALUR_ANTREAN);
    for (let i = 0; i < JUMLAH_SLOT_LABIRIN; i++) {
      const tengah = lintasan.pose(i * LABIRIN.jarak);
      for (const kolom of [0, 1]) {
        const [x, y] = posisiSlotAntrean(i, kolom);
        expect(diGedung(x, y)).toBe(true);
        expect(x > xB && x < xT && y > yU && y < yS).toBe(true);
        expect(Math.hypot(x - tengah.x, y - tengah.y)).toBeCloseTo(LABIRIN.geserKolom, 9);
      }
    }
    expect(di(PINTU_RUANG_TUNGGU[0], PINTU_RUANG_TUNGGU[1], RUANG_TUNGGU)).toBe(true);
  });

  it('ruang tunggu: gerbang tepat di depan pintu bus, di antara rusuk atap, lorongnya tidak melewati kursi', () => {
    expect(GERBANG_X).toHaveLength(HALTE_BERANGKAT_X.length);
    GERBANG_X.forEach((g, i) => {
      expect(g).toBeCloseTo(HALTE_BERANGKAT_X[i]! + PINTU_BUS, 9);
      expect(g > RUANG_TUNGGU.x0 + 0.3 && g < RUANG_TUNGGU.x1 - 0.3).toBe(true);
      // Rusuk atap tiap 1 petak dari x0: gerbang di tengah bentang.
      expect(Math.abs(((g - RUANG_TUNGGU.x0) % 1) - 0.5)).toBeLessThan(0.02);
      for (const b of BLOK_KURSI) expect(g < b.x0 - 0.2 || g > b.x1 + 0.2).toBe(true);
    });
    const barisAkhir = KURSI.yBaris0 + (KURSI.jumlahBaris - 1) * KURSI.jarakBaris;
    expect(Y_LORONG_TUNGGU).toBeGreaterThan(barisAkhir + 0.2);
    expect(Y_LORONG_TUNGGU).toBeLessThan(RUANG_TUNGGU.y1 - 0.5);
    expect(Y_DEPAN_GERBANG).toBeLessThan(KURSI.yBaris0 - 0.3);
    expect(Y_DEPAN_GERBANG).toBeGreaterThan(RUANG_TUNGGU.y0);
  });

  it('bus yang berbelok dari lorong pangkalan ke halte keberangkatan tidak menyerempet ruang tunggu', () => {
    const j = new Jalur(lintasanS(SAMBUNG_BERANGKAT.dari, SAMBUNG_BERANGKAT.ke));
    for (let s = 0; s <= j.panjang; s += 0.05) {
      const p = j.pose(s);
      const c = Math.cos(p.sudut);
      const sn = Math.sin(p.sudut);
      for (const [dl, dw] of [
        [1, 1],
        [1, -1],
        [-1, 1],
        [-1, -1],
      ] as const) {
        const x = p.x + (c * dl * BUS.panjang) / 2 - (sn * dw * BUS.lebar) / 2;
        const y = p.y + (sn * dl * BUS.panjang) / 2 + (c * dw * BUS.lebar) / 2;
        if (y > PERON_BERANGKAT.y0) expect(x).toBeLessThan(RUANG_TUNGGU.x0 - 0.05);
      }
    }
  });

  it('halte berada di sepanjang peronnya', () => {
    for (const x of HALTE_DATANG_X) expect(x > PERON.x0 && x < PERON.x1).toBe(true);
    for (const x of HALTE_BERANGKAT_X) expect(x > PERON_BERANGKAT.x0 && x < PERON_BERANGKAT.x1).toBe(true);
  });

  it('petak parkir serong tidak menyentuh lajur halte maupun lorong belakang', () => {
    // Bus miring 45°: setengah tinggi jejak di sumbu y ≈ (panjang + lebar) · sin45 / 2
    const setengah = ((BUS.panjang + BUS.lebar) * Math.SQRT1_2) / 2;
    expect(PARKIR_SERONG.pusatY - setengah).toBeGreaterThan(LAJUR.halte + BUS.lebar / 2);
    expect(PARKIR_SERONG.pusatY + setengah).toBeLessThan(LAJUR.lorong - BUS.lebar / 2);
  });

  it('pangkalan menampung 20 bus; bus yang parkir, masuk, dan keluar petak tidak menyenggol bus di petak sebelah', () => {
    const X = PARKIR_SERONG.pusatX;
    expect(X.length).toBe(20);
    const parkir = (sx: number) => jejakBus(sx, PARKIR_SERONG.pusatY, PARKIR_SERONG.sudut, BUS.panjang, BUS.lebar);
    for (let i = 1; i < X.length; i++) expect(jarakPoligon(parkir(X[i - 1]!), parkir(X[i]!))).toBeGreaterThan(0.25);
    X.forEach((sx, i) => {
      const tetangga = [X[i - 1], X[i + 1]].filter((x): x is number => x !== undefined).map(parkir);
      for (const titik of [kurvaMasukPetak(sx), kurvaKeluarPetak(sx)]) {
        const j = new Jalur(titik);
        for (let s = 0; s <= j.panjang; s += 0.03) {
          const p = j.pose(s);
          const jejak = jejakBus(p.x, p.y, p.sudut, BUS.panjang, BUS.lebar);
          for (const t of tetangga) expect(jarakPoligon(jejak, t)).toBeGreaterThan(0.15);
        }
      }
      // Kurva masuk berawal di depan halte kedatangan terdepan; kurva keluar berakhir sebelum belokan ke halte keberangkatan.
      expect(sx - PARKIR_SERONG.jarakMasuk).toBeGreaterThan(HALTE_DATANG_X[0]!);
      expect(sx + PARKIR_SERONG.jarakKeluar).toBeLessThanOrEqual(SAMBUNG_BERANGKAT.dari[0] + 1e-9);
    });
  });

  it('pos cuci di pangkalan tidak menghalangi bus yang keluar petak atau berbelok ke halte keberangkatan', () => {
    const pos = [
      [POS_CUCI.x0, POS_CUCI.y0],
      [POS_CUCI.x1, POS_CUCI.y0],
      [POS_CUCI.x1, POS_CUCI.y1],
      [POS_CUCI.x0, POS_CUCI.y1],
    ] as const;
    const X = PARKIR_SERONG.pusatX;
    const lintasan = [kurvaKeluarPetak(X[X.length - 1]!), kurvaMasukPetak(X[X.length - 1]!), lintasanS(SAMBUNG_BERANGKAT.dari, SAMBUNG_BERANGKAT.ke)];
    for (const titik of lintasan) {
      const j = new Jalur(titik);
      for (let s = 0; s <= j.panjang; s += 0.03) {
        const p = j.pose(s);
        expect(jarakPoligon(jejakBus(p.x, p.y, p.sudut, BUS.panjang, BUS.lebar), pos)).toBeGreaterThan(0.2);
      }
    }
    expect(jarakPoligon(jejakBus(X[X.length - 1]!, PARKIR_SERONG.pusatY, PARKIR_SERONG.sudut, BUS.panjang, BUS.lebar), pos)).toBeGreaterThan(0.2);
    expect(POS_CUCI.y0).toBeGreaterThan(LAJUR.halte + BUS.lebar / 2 + 0.3);
  });

  it('gerbang pagar: KELUAR di ujung jalur pejalan kaki, MASUK segaris pintu masuk, keduanya di gang tanpa ruko', () => {
    expect(GERBANG_KELUAR_X).toBe(X_JALUR_KAKI);
    for (const g of [GERBANG_KELUAR_X, GERBANG_MASUK_X]) {
      expect(GANG_RUKO.some(([a, b]) => g - LEBAR_GERBANG_PAGAR / 2 > a && g + LEBAR_GERBANG_PAGAR / 2 < b)).toBe(true);
    }
    expect(Y_PAGAR).toBeLessThan(Y_TROTOAR_BELAKANG);
    expect(Y_PAGAR).toBeGreaterThan(Y_LUAPAN + 0.5);
  });

  it('antrean: slot berjarak rata di sepanjang lintasan; luapan keluar lewat pintu masuk lalu berbaris di luar gedung', () => {
    const n = JUMLAH_SLOT_LABIRIN + JUMLAH_SLOT_LUAPAN;
    for (const kolom of [0, 1]) {
      for (let i = 1; i < n; i++) {
        const [ax, ay] = posisiSlotAntrean(i - 1, kolom);
        const [bx, by] = posisiSlotAntrean(i, kolom);
        const d = Math.hypot(bx - ax, by - ay);
        // Baris sebelah dalam belokan memotong sudut, baris luar sedikit melebar.
        expect(d).toBeLessThanOrEqual(LABIRIN.jarak + 2 * LABIRIN.geserKolom);
        expect(d).toBeGreaterThan(LABIRIN.jarak * 0.55);
      }
    }
    // Lintasan cukup panjang untuk semua slot, dan melewati ambang pintu masuk.
    expect(new Jalur(JALUR_ANTREAN).panjang).toBeGreaterThan((n - 1) * LABIRIN.jarak);
    expect(JALUR_ANTREAN).toContainEqual(TITIK_PINTU_LUAR);
    expect(Math.abs(TITIK_PINTU_LUAR[0] - PINTU_MASUK[0])).toBeLessThan(1e-9);
    const [xAkhir, yAkhir] = posisiSlotAntrean(n - 1);
    expect(diGedung(xAkhir, yAkhir)).toBe(false);
    expect(Math.abs(yAkhir - Y_LUAPAN)).toBeLessThanOrEqual(LABIRIN.geserKolom + 1e-9);
    // Mulut antrean di plaza, di luar gedung & bordes.
    expect(MULUT_ANTREAN[1]).toBeGreaterThan(BORDES.y1 + 0.3);
  });

  it('loket: jendela berderet di dinding utara aula; lorong loket di antara pembeli dan labirin', () => {
    for (let i = 1; i < X_LOKET.length; i++) expect(X_LOKET[i]! - X_LOKET[i - 1]!).toBeCloseTo(2 * LOKET.setengahLebar, 9);
    for (const x of X_LOKET) {
      expect(diGedung(x - LOKET.setengahLebar, LOKET.yPetugas)).toBe(true);
      expect(diGedung(x + LOKET.setengahLebar, LOKET.yPetugas)).toBe(true);
    }
    expect(LOKET.yPetugas).toBeGreaterThan(GEDUNG.y0 + 0.15);
    expect(LOKET.yPetugas).toBeLessThan(LOKET.yMeja - 0.2);
    expect(LOKET.yPembeli).toBeGreaterThan(LOKET.yMeja + 0.1);
    // Tempat menunggu di tiap loket: berbeda-beda, di dalam lebar jendelanya, tidak di lorong loket.
    for (const x of X_LOKET) {
      const tempat = Array.from({ length: LOKET.maksPembeli }, (_, k) => posisiPembeli(x, k));
      for (let a = 0; a < tempat.length; a++) {
        expect(Math.abs(tempat[a]![0] - x)).toBeLessThan(LOKET.setengahLebar - 0.15);
        expect(tempat[a]![1]).toBeLessThan(Y_LORONG_LOKET - 0.15);
        for (let b = 0; b < a; b++) expect(Math.hypot(tempat[a]![0] - tempat[b]![0], tempat[a]![1] - tempat[b]![1])).toBeGreaterThan(0.18);
      }
    }
    // Jendela yang dibuka lebih dulu (jurusan awal) tepat di depan kepala antrean: jalan ke jendela pendek.
    const xKepala = posisiSlotAntrean(0, 0)[0];
    const terdekat = X_LOKET.reduce((b, x, i) => (Math.abs(x - xKepala) < Math.abs(X_LOKET[b]! - xKepala) ? i : b), 0);
    expect(URUTAN_LOKET[0]).toBe(terdekat);
    expect([...URUTAN_LOKET].sort((a, b) => a - b)).toEqual(X_LOKET.map((_, i) => i));
    const taliUtara = Math.min(...TALI_LABIRIN.map(([, y0, , y1]) => Math.min(y0, y1)));
    expect(Y_LORONG_LOKET).toBeLessThan(taliUtara - 0.1);
  });

  it('lintasan antrean, jalan ke jendela loket, dan jalan ke ruang tunggu tidak menembus tali pembatas', () => {
    const menembus = (rute: readonly Titik[]): boolean => {
      for (let i = 1; i < rute.length; i++) {
        for (const [x0, y0, x1, y1] of TALI_LABIRIN) if (ruasBerpotongan(rute[i - 1]!, rute[i]!, [x0, y0], [x1, y1], 1e-6)) return true;
      }
      return false;
    };
    expect(menembus(JALUR_ANTREAN)).toBe(false);
    for (const kolom of [0, 1]) {
      // Kedua baris antrean menyusuri lintasan tanpa menembus tali.
      const baris: Titik[] = [];
      for (let s = 0; s <= new Jalur(JALUR_ANTREAN).panjang; s += 0.02) baris.push(posisiLintasan(s, kolom));
      expect(menembus(baris)).toBe(false);
      // Tali antarlajur: dari celah masuk (ujung barat lajur 2) tidak ada jalan pintas
      // lurus ke slot mana pun di lajur 0 dan 1; harus menyusuri lajur berkelok.
      const celah = posisiSlotAntrean(JUMLAH_SLOT_LABIRIN - 1, kolom);
      const perLajur = JUMLAH_SLOT_LABIRIN / LABIRIN.yLajur.length;
      for (let r = 0; r < JUMLAH_SLOT_LABIRIN - perLajur; r++) expect(menembus([celah, posisiSlotAntrean(r, kolom)])).toBe(true);
      const kepala = posisiSlotAntrean(0, kolom);
      X_LOKET.forEach((x) => {
        for (let k = 0; k < LOKET.maksPembeli; k++) expect(menembus([kepala, [kepala[0], Y_LORONG_LOKET], [x, Y_LORONG_LOKET], posisiPembeli(x, k)])).toBe(false);
      });
    }
    X_LOKET.forEach((x) => expect(menembus([[x, LOKET.yPembeli], ...ruteLoketKeRuangTunggu(x)])).toBe(false));
    // Dua baris berdampingan di tiap lajur, di antara tali antarlajur.
    for (let r = 0; r < JUMLAH_SLOT_LABIRIN; r++) {
      const [ax, ay] = posisiSlotAntrean(r, 0);
      const [bx, by] = posisiSlotAntrean(r, 1);
      expect(Math.hypot(ax - bx, ay - by)).toBeCloseTo(2 * LABIRIN.geserKolom, 6);
    }
    for (let i = 1; i < LABIRIN.yLajur.length; i++) {
      const y = (LABIRIN.yLajur[i - 1]! + LABIRIN.yLajur[i]!) / 2;
      expect(TALI_LABIRIN.some(([, y0, , y1]) => Math.abs(y0 - y) < 1e-9 && Math.abs(y1 - y) < 1e-9)).toBe(true);
    }
  });

  it('tinggi lantai: aula di atas podium, bordes landai ke plaza, peron & ruang tunggu', () => {
    expect(tinggiLantai(20, 13)).toBe(TINGGI_LANTAI_GEDUNG);
    expect(tinggiLantai(PINTU_MASUK[0], BORDES.y0)).toBeCloseTo(TINGGI_LANTAI_GEDUNG, 9);
    expect(tinggiLantai(PINTU_MASUK[0], (BORDES.y0 + BORDES.y1) / 2)).toBeCloseTo(TINGGI_LANTAI_GEDUNG / 2, 9);
    expect(tinggiLantai(PINTU_MASUK[0], BORDES.y1)).toBeCloseTo(0, 9);
    expect(tinggiLantai((PERON.x0 + PERON.x1) / 2, 6)).toBe(TINGGI_PERON);
    expect(tinggiLantai(PINTU_RUANG_TUNGGU[0], PINTU_RUANG_TUNGGU[1])).toBe(TINGGI_PERON);
    expect(tinggiLantai(MULUT_ANTREAN[0], MULUT_ANTREAN[1])).toBeNull();
  });

  it('jalur kaki di luar gedung dan pangkalan; gedung utama menyatu dengan ruang tunggu', () => {
    expect(X_JALUR_KAKI).toBeLessThan(GEDUNG.x0);
    expect(X_JALUR_KAKI).toBeLessThan(PARKIR_SERONG.pusatX[0]! - 1);
    expect(GEDUNG.x1).toBe(RUANG_TUNGGU.x0);
    expect(GEDUNG.y0).toBeLessThan(PINTU_RUANG_TUNGGU[1]);
    expect(GEDUNG.y1).toBeGreaterThan(PINTU_RUANG_TUNGGU[1]);
    expect(GEDUNG.y0).toBeGreaterThan(LAJUR.lorong + BUS.lebar);
  });

  it('setiap zona punya volume & label dalam satuan dunia (unit, bukan piksel)', () => {
    for (const z of Object.values(ZONA)) {
      expect(z.balok.length).toBeGreaterThan(0);
      expect(z.label).toHaveLength(3);
      for (const b of z.balok) expect(b.tinggi).toBeLessThan(5);
      expect(z.label[2]).toBeLessThan(5);
    }
    for (const [, , h] of TITIK_INTI) expect(h).toBeLessThan(5);
  });
});

describe('halte', () => {
  it('jarak antarhalte cukup untuk panjang bus + jarak aman', async () => {
    const { BUS, HALTE_BERANGKAT_X, HALTE_DATANG_X } = await import('../src/game/tata-letak');
    for (const daftar of [HALTE_DATANG_X, HALTE_BERANGKAT_X]) {
      for (let i = 1; i < daftar.length; i++) {
        expect(daftar[i - 1]! - daftar[i]!).toBeGreaterThanOrEqual(BUS.panjang + BUS.jarak);
      }
    }
  });
});

describe('atap terminal (payung saat hujan)', () => {
  it('aula, ruang tunggu, peron berkanopi terlindung; plaza, luapan antrean, trotoar tidak', () => {
    expect(diBawahAtap(X_LOKET[3]!, LOKET.yPembeli)).toBe(true);
    for (const k of KURSI_TUNGGU) expect(diBawahAtap(k.x, k.y)).toBe(true);
    expect(diBawahAtap((PERON.x0 + PERON.x1) / 2, (PERON.y0 + PERON.y1) / 2)).toBe(true);
    expect(diBawahAtap((PERON_BERANGKAT.x0 + PERON_BERANGKAT.x1) / 2, (PERON_BERANGKAT.y0 + PERON_BERANGKAT.y1) / 2)).toBe(true);
    // Selasar depan gedung beratap, baris luapan antrean di plaza tidak.
    expect(diBawahAtap(PINTU_MASUK[0] + 2, GEDUNG.y1 + 0.3)).toBe(true);
    expect(diBawahAtap(PINTU_MASUK[0], Y_LUAPAN)).toBe(false);
    expect(diBawahAtap(20, Y_TROTOAR_BELAKANG)).toBe(false);
  });
});

describe('jalur lebih panjang & pangkalan 20 bus per jurusan', () => {
  it('5 halte kedatangan & 5 halte keberangkatan berjarak cukup; tiap halte keberangkatan punya gerbang', async () => {
    const t = await import('../src/game/tata-letak');
    for (const daftar of [t.HALTE_DATANG_X, t.HALTE_BERANGKAT_X]) {
      expect(daftar).toHaveLength(5);
      for (let i = 1; i < daftar.length; i++) expect(daftar[i - 1]! - daftar[i]!).toBeGreaterThanOrEqual(t.BUS.panjang + t.BUS.jarak);
    }
    expect(t.GERBANG_X).toHaveLength(5);
    for (const g of t.GERBANG_X) expect(g).toBeLessThan(t.RUANG_TUNGGU.x1 - 0.5);
    // Bus di halte terdepan belum melewati awal kurva masuk petak parkir paling barat.
    expect(t.HALTE_DATANG_X[0]!).toBeLessThan(t.PARKIR_SERONG.pusatX[0]! - t.PARKIR_SERONG.jarakMasuk);
    expect(t.PERON.x1).toBeLessThan(t.X_JALUR_KAKI);
    expect(t.X_JALUR_KAKI).toBeLessThan(t.PANGKALAN.x0);
  });

  it('20 petak dalam 4 kelompok jurusan (5 petak, warna & kota berbeda)', async () => {
    const t = await import('../src/game/tata-letak');
    expect(t.PARKIR_SERONG.pusatX).toHaveLength(20);
    expect(t.KELOMPOK_PARKIR).toHaveLength(4);
    const petak = t.KELOMPOK_PARKIR.flatMap((k) => k.petak).sort((a, b) => a - b);
    expect(petak).toEqual(Array.from({ length: 20 }, (_, i) => i));
    expect(new Set(t.KELOMPOK_PARKIR.map((k) => k.warna)).size).toBe(4);
    const kota = t.KELOMPOK_PARKIR.flatMap((k) => k.tujuan);
    expect(new Set(kota).size).toBe(t.TUJUAN_BUS.length);
    for (let i = 0; i < 20; i++) expect(t.KELOMPOK_PARKIR[t.kelompokPetak(i)]!.petak).toContain(i);
  });

  it('pulau papan jurusan di awal tiap kelompok: tidak tersenggol bus yang keluar-masuk petak, papan di atas atap bus', async () => {
    const t = await import('../src/game/tata-letak');
    const { PAPAN_JURUSAN } = await import('../src/game/papan-jurusan3d');
    expect(t.PULAU_JURUSAN).toHaveLength(t.KELOMPOK_PARKIR.length);
    const { pusatY, sudut } = t.PARKIR_SERONG;
    t.KELOMPOK_PARKIR.forEach((g, i) => {
      // Pulau tepat di barat petak pertama kelompoknya.
      expect(t.PARKIR_SERONG.pusatX[g.petak[0]!]! - t.PULAU_JURUSAN[i]!).toBeCloseTo(1.25, 9);
    });
    const kerb = t.PULAU_JURUSAN.map((px) => jejakBus(px, pusatY, sudut, 2.1, 0.5));
    for (const sx of t.PARKIR_SERONG.pusatX) {
      for (const titik of [kurvaMasukPetak(sx), kurvaKeluarPetak(sx)]) {
        const j = new Jalur(titik);
        for (let s = 0; s <= j.panjang; s += 0.03) {
          const p = j.pose(s);
          const bus = jejakBus(p.x, p.y, p.sudut, t.BUS.panjang, t.BUS.lebar);
          for (const k of kerb) expect(jarakPoligon(bus, k)).toBeGreaterThan(0.1);
        }
      }
      // Bus parkir di sebelah pulau juga tidak menempel.
      for (const k of kerb) expect(jarakPoligon(jejakBus(sx, pusatY, sudut, t.BUS.panjang, t.BUS.lebar), k)).toBeGreaterThan(0.15);
    }
    // Papan menjulang di atas atap bus (tinggi 0,8) supaya tidak tertutup & tidak tertabrak.
    expect(PAPAN_JURUSAN.bawah).toBeGreaterThan(0.8 + 0.25);
    // Pulau pertama tidak memotong jalur pejalan kaki dari peron kedatangan.
    expect(t.PULAU_JURUSAN[0]! - 1.0).toBeGreaterThan(t.X_JALUR_KAKI);
  });
});

describe('manuver keluar halte', () => {
  it('bus di halte mana pun bisa berbelok ke lajur sirkulasi tanpa menyenggol bus yang berhenti di halte depannya', async () => {
    const t = await import('../src/game/tata-letak');
    for (const daftar of [t.HALTE_DATANG_X, t.HALTE_BERANGKAT_X]) {
      for (let k = 1; k < daftar.length; k++) {
        const depan = jejakBus(daftar[k - 1]!, t.LAJUR.halte, 0, t.BUS.panjang, t.BUS.lebar);
        const x = daftar[k]!;
        const j = new Jalur(lintasanS([x, t.LAJUR.halte], [x + t.PANJANG_PINDAH_LAJUR, t.LAJUR.sirkulasi]));
        for (let s = 0; s <= j.panjang; s += 0.02) {
          const p = j.pose(s);
          expect(jarakPoligon(jejakBus(p.x, p.y, p.sudut, t.BUS.panjang, t.BUS.lebar), depan)).toBeGreaterThan(0.35);
        }
      }
    }
  });

  it('bus di halte keberangkatan terdepan keluar ke jalan raya lewat bukaan median; masuk juga lewat bukaan', async () => {
    const t = await import('../src/game/tata-letak');
    const [barat, timur] = t.BUKAAN_MEDIAN as [readonly [number, number], readonly [number, number]];
    for (const [dari, ke, bukaan] of [
      [t.MASUK.dari, t.MASUK.ke, barat],
      [t.MASUK_SIRKULASI.dari, t.MASUK_SIRKULASI.ke, barat],
      [t.KELUAR.dari, t.KELUAR.ke, timur],
    ] as const) {
      const j = new Jalur(lintasanS(dari, ke));
      for (let s = 0; s <= j.panjang; s += 0.02) {
        const p = j.pose(s);
        const jejak = jejakBus(p.x, p.y, p.sudut, t.BUS.panjang, t.BUS.lebar);
        // Saat melintasi median, seluruh badan bus di dalam bukaan.
        for (const [x, y] of jejak) if (y > t.MEDIAN.y0 && y < t.MEDIAN.y1) {
          expect(x).toBeGreaterThan(bukaan[0]);
          expect(x).toBeLessThan(bukaan[1]);
        }
      }
    }
    // Halte terdepan: kurva pindah lajur selesai sebelum kurva keluar dimulai.
    expect(t.HALTE_BERANGKAT_X[0]! + t.PANJANG_PINDAH_LAJUR).toBeLessThanOrEqual(t.KELUAR.dari[0]);
    // Kurva masuk berakhir di belakang halte kedatangan terakhir (bus tidak mundur).
    expect(t.MASUK.ke[0]).toBeLessThan(t.HALTE_DATANG_X[t.HALTE_DATANG_X.length - 1]! - t.BUS.panjang / 2);
    // Pos retribusi di luar lintasan masuk.
    const pos = [
      [t.POS_RETRIBUSI.x0, t.POS_RETRIBUSI.y0],
      [t.POS_RETRIBUSI.x1, t.POS_RETRIBUSI.y0],
      [t.POS_RETRIBUSI.x1, t.POS_RETRIBUSI.y1],
      [t.POS_RETRIBUSI.x0, t.POS_RETRIBUSI.y1],
    ] as const;
    for (const { dari, ke } of [t.MASUK, t.MASUK_SIRKULASI]) {
      const jm = new Jalur(lintasanS(dari, ke));
      for (let s = 0; s <= jm.panjang; s += 0.02) {
        const p = jm.pose(s);
        expect(jarakPoligon(jejakBus(p.x, p.y, p.sudut, t.BUS.panjang, t.BUS.lebar), pos)).toBeGreaterThan(0.2);
      }
    }
  });
});

describe('halte kedatangan diisi bebas', () => {
  it('bus baru mencapai halte kedatangan kosong di depan bus yang sedang menurunkan penumpang tanpa menyenggolnya', async () => {
    const t = await import('../src/game/tata-letak');
    t.HALTE_DATANG_X.forEach((xHalte, k) => {
      for (const lewatSirkulasi of [false, true]) {
        const rute = ruteKeHalteDatang(k, lewatSirkulasi);
        const akhir = rute[rute.length - 1]!;
        expect(akhir[0]).toBeCloseTo(xHalte, 9);
        expect(akhir[1]).toBeCloseTo(t.LAJUR.halte, 9);
        // Lewat lajur halte: halte di belakang kosong, yang di depan boleh terisi.
        // Lewat sirkulasi: kasus terburuk, semua halte lain terisi.
        const lain = t.HALTE_DATANG_X.filter((_, i) => (lewatSirkulasi ? i !== k : i < k)).map((x) => jejakBus(x, t.LAJUR.halte, 0, t.BUS.panjang, t.BUS.lebar));
        const j = new Jalur(rute);
        for (let s = 0; s <= j.panjang; s += 0.02) {
          const p = j.pose(s);
          const bus = jejakBus(p.x, p.y, p.sudut, t.BUS.panjang, t.BUS.lebar);
          for (const q of lain) expect(jarakPoligon(bus, q)).toBeGreaterThan(0.35);
        }
      }
    });
  });
});

describe('halte keberangkatan diisi bebas', () => {
  it('bus dari pangkalan mencapai halte keberangkatan mana pun tanpa menyenggol bus yang berhenti di halte lain', async () => {
    const t = await import('../src/game/tata-letak');
    t.HALTE_BERANGKAT_X.forEach((xHalte, k) => {
      const rute = ruteKeHalteBerangkat(k);
      const akhir = rute[rute.length - 1]!;
      expect(akhir[0]).toBeCloseTo(xHalte, 9);
      expect(akhir[1]).toBeCloseTo(t.LAJUR.halte, 9);
      // Kasus terburuk: semua halte lain terisi.
      const lain = t.HALTE_BERANGKAT_X.filter((_, i) => i !== k).map((x) => jejakBus(x, t.LAJUR.halte, 0, t.BUS.panjang, t.BUS.lebar));
      const j = new Jalur(rute);
      for (let s = 0; s <= j.panjang; s += 0.02) {
        const p = j.pose(s);
        const bus = jejakBus(p.x, p.y, p.sudut, t.BUS.panjang, t.BUS.lebar);
        for (const q of lain) expect(jarakPoligon(bus, q)).toBeGreaterThan(0.35);
      }
    });
  });
});
