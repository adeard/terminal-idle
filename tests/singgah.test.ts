import { describe, expect, it } from 'vitest';
import { EKONOMI } from '../src/config/economy.config';
import { acakBerbenih, DuniaVisual, type OrangVisual } from '../src/game/dunia-visual';
import { loketBuka } from '../src/game/kehidupan-malam';
import { hitungLajuVisual, type LajuVisual } from '../src/game/laju';
import {
  BILIK,
  BLOK_KURSI,
  GEDUNG,
  KURSI_TUNGGU,
  LEBAR_PINTU_SAYAP,
  LORONG_SAYAP,
  PINTU_SAYAP,
  RUANG_SAYAP,
  ruteKeluarSayap,
  ruteMasukSayap,
  SAYAP_BARAT,
  SINGGAH,
  TALI_LABIRIN,
  tinggiLantai,
  xBilik,
  X_LOKET,
  Y_LORONG_LOKET,
  type JenisKelamin,
  type Persegi,
  type Titik,
  type TitikSinggah,
} from '../src/game/tata-letak';
import { ruasBerpotongan, stateOtomatis } from './helpers';

const JK: readonly JenisKelamin[] = ['pria', 'wanita'];
type Ruas = readonly [number, number, number, number];

/** Dinding lurus dari a ke b (sepanjang x atau y) dengan celah pintu [pusat, setengah lebar]. */
function dindingBercelah(x0: number, y0: number, x1: number, y1: number, celah: readonly (readonly [number, number])[]): Ruas[] {
  const sepanjangY = x0 === x1;
  const a = sepanjangY ? y0 : x0;
  const b = sepanjangY ? y1 : x1;
  const hasil: Ruas[] = [];
  let mulai = a;
  for (const [pusat, w] of [...celah].sort((p, q) => p[0] - q[0])) {
    hasil.push(sepanjangY ? [x0, mulai, x0, pusat - w] : [mulai, y0, pusat - w, y0]);
    mulai = pusat + w;
  }
  hasil.push(sepanjangY ? [x0, mulai, x0, b] : [mulai, y0, b, y0]);
  return hasil;
}

/** Semua dinding & sekat sayap barat (serta dinding barat aula) yang tidak boleh ditembus. */
const DINDING: readonly Ruas[] = (() => {
  const S = SAYAP_BARAT;
  const R = RUANG_SAYAP;
  const d: Ruas[] = [
    [S.x0, S.y0, S.x0, S.y1],
    [S.x0, S.y0, S.x1, S.y0],
    [S.x0, S.y1, S.x1, S.y1],
    ...dindingBercelah(GEDUNG.x0, S.y0, GEDUNG.x0, S.y1, PINTU_SAYAP.map((y) => [y, LEBAR_PINTU_SAYAP / 2] as const)),
    ...dindingBercelah(LORONG_SAYAP.x0, S.y0, LORONG_SAYAP.x0, S.y1, [R.toilet.pria, R.toilet.wanita, R.wudhu.pria, R.wudhu.wanita].map((r) => [r.yPintu, 0.17] as const)),
    ...[R.toilet.pria.y1, R.toilet.wanita.y1, R.musholla.pria.y1].map((y): Ruas => [S.x0, y, LORONG_SAYAP.x0, y]),
  ];
  for (const jk of JK) {
    const w = R.wudhu[jk];
    d.push(...dindingBercelah(w.x0, w.y0, w.x0, w.y1, [[w.yPintu, 0.15]]));
    // Sekat samping bilik (pintunya boleh dilewati).
    for (const x of xBilik(jk)) for (const s of [-1, 1]) d.push([x + (s * BILIK.lebar) / 2, R.toilet[jk].y0 + 0.05, x + (s * BILIK.lebar) / 2, R.toilet[jk].y0 + BILIK.dalam]);
  }
  return [...d, ...TALI_LABIRIN];
})();

function menembus(rute: readonly Titik[]): string | null {
  for (let i = 1; i < rute.length; i++) {
    const a = rute[i - 1]!;
    const b = rute[i]!;
    for (const [x0, y0, x1, y1] of DINDING) if (ruasBerpotongan(a, b, [x0, y0], [x1, y1], 1e-6)) return `ruas (${a.join(', ')}) → (${b.join(', ')}) menembus dinding (${x0}, ${y0})–(${x1}, ${y1})`;
  }
  return null;
}

const tempatBerdiri = (t: TitikSinggah): Titik => t.masuk[t.masuk.length - 1]!;
const di = (p: Titik, r: Persegi): boolean => p[0] > r.x0 && p[0] < r.x1 && p[1] > r.y0 && p[1] < r.y1;

describe('sayap barat: toilet & musholla', () => {
  it('ruangan di dalam sayap barat, tidak bertumpuk; lantai setinggi aula', () => {
    const semua = JK.flatMap((jk) => [RUANG_SAYAP.toilet[jk], RUANG_SAYAP.wudhu[jk], RUANG_SAYAP.musholla[jk]]);
    for (const r of semua) {
      expect(r.x0).toBeGreaterThanOrEqual(SAYAP_BARAT.x0);
      expect(r.x1).toBeLessThanOrEqual(LORONG_SAYAP.x0);
      expect(r.y0).toBeGreaterThanOrEqual(SAYAP_BARAT.y0);
      expect(r.y1).toBeLessThanOrEqual(SAYAP_BARAT.y1);
      expect(r.yPintu).toBeGreaterThan(r.y0 + 0.2);
      expect(r.yPintu).toBeLessThan(r.y1 - 0.2);
      expect(tinggiLantai((r.x0 + r.x1) / 2, (r.y0 + r.y1) / 2)).toBe(tinggiLantai(20, 13));
    }
    for (let a = 0; a < semua.length; a++) {
      for (let b = 0; b < a; b++) {
        const p = semua[a]!;
        const q = semua[b]!;
        expect(p.x0 >= q.x1 - 1e-9 || q.x0 >= p.x1 - 1e-9 || p.y0 >= q.y1 - 1e-9 || q.y0 >= p.y1 - 1e-9).toBe(true);
      }
    }
  });

  it('tempat berdiri tiap titik singgah ada di ruang yang benar & tidak berhimpit', () => {
    for (const jk of JK) {
      const t = SINGGAH.toilet[jk];
      const m = SINGGAH.musholla[jk];
      for (const k of [t.bilik, t.wastafel, ...(t.urinoir ? [t.urinoir] : [])]) for (const p of k.titik) expect(di(tempatBerdiri(p), RUANG_SAYAP.toilet[jk])).toBe(true);
      for (const p of m.wudhu.titik) expect(di(tempatBerdiri(p), RUANG_SAYAP.wudhu[jk])).toBe(true);
      for (const p of m.sholat.titik) expect(di(tempatBerdiri(p), RUANG_SAYAP.musholla[jk])).toBe(true);
    }
    const semua = [
      ...JK.flatMap((jk) => [SINGGAH.toilet[jk].bilik, SINGGAH.toilet[jk].wastafel, SINGGAH.musholla[jk].wudhu, SINGGAH.musholla[jk].sholat]),
      SINGGAH.toilet.pria.urinoir!,
      SINGGAH.atm,
      SINGGAH.minimarket,
      SINGGAH.apotek,
      ...SINGGAH.kios,
    ].flatMap((k) => k.titik.map(tempatBerdiri));
    for (let a = 0; a < semua.length; a++) for (let b = 0; b < a; b++) expect(Math.hypot(semua[a]![0] - semua[b]![0], semua[a]![1] - semua[b]![1])).toBeGreaterThan(0.12);
  });

  it('rute dari jendela loket ke setiap titik singgah aula & kembali tidak menembus dinding, sekat, atau tali antrean', () => {
    const galat: string[] = [];
    const periksa = (rute: readonly Titik[]): void => {
      const g = menembus(rute);
      if (g) galat.push(g);
    };
    for (const x of X_LOKET) {
      const awal: Titik[] = [
        [x + 0.28, 12.07],
        [x + 0.4, Y_LORONG_LOKET],
      ];
      for (const jk of JK) {
        const t = SINGGAH.toilet[jk];
        const m = SINGGAH.musholla[jk];
        const yT = RUANG_SAYAP.toilet[jk].yPintu;
        const yW = RUANG_SAYAP.wudhu[jk].yPintu;
        for (const buang of [...t.bilik.titik, ...(t.urinoir?.titik ?? [])]) {
          for (const cuci of t.wastafel.titik) periksa([...awal, ...ruteMasukSayap(0, yT), ...buang.masuk, ...buang.keluar, ...cuci.masuk, ...cuci.keluar, ...ruteKeluarSayap(0, yT)]);
        }
        for (const keran of m.wudhu.titik) {
          for (const sajadah of m.sholat.titik) periksa([...awal, ...ruteMasukSayap(1, yW), ...keran.masuk, ...keran.keluar, ...sajadah.masuk, ...sajadah.keluar, ...ruteKeluarSayap(1, yW)]);
        }
      }
      for (const k of [SINGGAH.atm, SINGGAH.minimarket, SINGGAH.apotek]) for (const p of k.titik) periksa([...awal, ...p.masuk, ...p.keluar, [GEDUNG.x1 - 0.45, Y_LORONG_LOKET]]);
    }
    expect(galat.slice(0, 5)).toEqual([]);
  });

  it('rute dari kursi ruang tunggu ke kios & kembali tidak menembus blok kursi', () => {
    const blok = BLOK_KURSI.map((b) => ({ x0: b.x0, x1: b.x1 }));
    const barisY = KURSI_TUNGGU.map((k) => k.y);
    const kenaKursi = (x: number, y: number): boolean => blok.some((b) => x > b.x0 + 0.01 && x < b.x1 - 0.01) && barisY.some((yb) => y > yb - 0.07 && y < yb + 0.09);
    for (const k of SINGGAH.kios) {
      for (const p of k.titik) {
        const rute = [...p.masuk, ...p.keluar];
        for (let i = 1; i < rute.length; i++) {
          const [a, b] = [rute[i - 1]!, rute[i]!];
          for (let t = 0; t <= 1; t += 0.05) expect(kenaKursi(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t)).toBe(false);
        }
      }
    }
  });
});

// ---------------------------------------------------------------------------
// Simulasi

const SEIMBANG: LajuVisual = { turun: 1.4, layanLoket: 2.2, naik: 1.4, busDatang: 0.12, muatanBus: 16, faktorKecepatanBus: 1 };
const wanita = (v: number): boolean => v % 3 === 0;

function ruangOrang(o: OrangVisual): Persegi | null {
  const semua = JK.flatMap((jk) => [RUANG_SAYAP.toilet[jk], RUANG_SAYAP.wudhu[jk], RUANG_SAYAP.musholla[jk]].map((r) => ({ r, jk })));
  for (const { r, jk } of semua) if (di([o.x, o.y], r)) return jk === (wanita(o.varian) ? 'wanita' : 'pria') ? r : null;
  return SAYAP_BARAT;
}

describe('penumpang mampir', () => {
  it('siang: mampir ke toilet, musholla, ATM, toko & kios; satu orang per titik; pria/wanita di ruangnya; semua kembali ke kursi', () => {
    const dunia = new DuniaVisual({ acak: acakBerbenih(41), wanita });
    const tempat = new Set<string>();
    const gaya = new Set<string>();
    const galat: string[] = [];
    const jalankan = (detik: number, laju: LajuVisual): void => {
      for (let t = 0; t < detik; t += 1 / 30) {
        dunia.perbarui(1 / 30, laju);
        galat.push(...dunia.periksaKonsistensi());
        const ditempati = new Map<string, number>();
        for (const o of dunia.orang) {
          if (!o.singgah) continue;
          tempat.add(o.singgah.tempat);
          gaya.add(o.gaya);
          if (di([o.x, o.y], SAYAP_BARAT) && ruangOrang(o) === null) galat.push(`orang ${o.id} (${wanita(o.varian) ? 'wanita' : 'pria'}) masuk ruang lawan jenis`);
          if (o.singgah.tiba) {
            const kunci = `${o.x.toFixed(3)},${o.y.toFixed(3)}`;
            if (ditempati.has(kunci)) galat.push(`orang ${o.id} & ${ditempati.get(kunci)} di titik singgah yang sama`);
            ditempati.set(kunci, o.id);
          }
        }
      }
    };
    // Bus memuat pelan: penumpang cukup lama duduk sehingga sebagian bangun ke kios ruang tunggu.
    jalankan(420, { ...SEIMBANG, naik: 0.5, jam: 12.2 });
    expect(galat.slice(0, 5)).toEqual([]);
    for (const n of ['toilet', 'musholla', 'atm', 'minimarket', 'kios']) expect(tempat).toContain(n);
    expect(gaya).toContain('bilik');
    expect(gaya).toContain('sholatBerdiri');
    expect(gaya).toContain('sholatDuduk');
    // Arus berhenti & kios tutup: semua yang mampir selesai dan kembali duduk (tidak ada yang tersangkut).
    // (calon penumpang yang tertunda masih datang dari luar pagar & kursi terjauh ±45 detik jalan kaki)
    jalankan(420, { ...SEIMBANG, turun: 0, busDatang: 0, naik: 0, jam: 23.5 });
    expect(galat.slice(0, 5)).toEqual([]);
    expect(dunia.orang.filter((o) => o.fase === 'singgah' || o.fase === 'keRuangTunggu')).toEqual([]);
  }, 90_000);

  it('malam: apotek & kios tutup, jadi tidak ada yang mampir ke sana', () => {
    const dunia = new DuniaVisual({ acak: acakBerbenih(42), wanita });
    const tempat = new Set<string>();
    for (let t = 0; t < 400; t += 1 / 30) {
      dunia.perbarui(1 / 30, { ...SEIMBANG, jam: 23.5 });
      for (const o of dunia.orang) if (o.singgah) tempat.add(o.singgah.tempat);
    }
    expect(tempat.size).toBeGreaterThan(0);
    expect(tempat.has('apotek')).toBe(false);
    expect(tempat.has('kios')).toBe(false);
  }, 30_000);

  it('Kios & Minimarket belum dibangun: tidak ada yang belanja di kios, minimarket, atau apotek; toilet, musholla & ATM tetap', () => {
    const s = stateOtomatis({ peron: 10, loket: 10, keberangkatan: 10 });
    expect(hitungLajuVisual(s).kiosDibangun).toBe(false);
    expect(hitungLajuVisual({ ...s, terminal: { ...s.terminal, fasilitas: { ...s.terminal.fasilitas, kios: 1 } } }).kiosDibangun).toBe(true);
    const dunia = new DuniaVisual({ acak: acakBerbenih(41), wanita });
    const tempat = new Set<string>();
    let belanja = 0;
    for (let t = 0; t < 420; t += 1 / 30) {
      dunia.perbarui(1 / 30, { ...SEIMBANG, jam: 12.2, kiosDibangun: false });
      for (const o of dunia.orang) if (o.singgah) tempat.add(o.singgah.tempat);
      belanja += dunia.transaksi.filter((x) => x.jenis === 'belanja').length;
    }
    for (const n of ['toilet', 'musholla', 'atm']) expect(tempat).toContain(n);
    for (const n of ['kios', 'minimarket', 'apotek']) expect(tempat.has(n)).toBe(false);
    expect(belanja).toBe(0);
  }, 60_000);

  it('beli tiket tidak instan: beberapa detik per pembeli, dan jendela yang buka tetap bukan hambatan palsu', () => {
    // Beberapa benih: antrean dua baris yang bergerombol per baris dulu hanya menumpuk pada sebagian benih.
    for (const [jurusan, benih] of [EKONOMI.jurusanAwal, EKONOMI.jurusan.length].flatMap((j) => [0, 2, 5].map((b) => [j, b] as const))) {
      const s = stateOtomatis({ peron: 120, loket: 200, keberangkatan: 120 });
      // Seperti di game: hanya jendela jurusan yang dibuka yang melayani.
      const laju: LajuVisual = { ...hitungLajuVisual({ ...s, terminal: { ...s.terminal, jurusanBuka: jurusan } }), loketBuka: loketBuka(12, jurusan) };
      const dunia = new DuniaVisual({ acak: acakBerbenih(43 + jurusan + benih * 100), wanita });
      const lama: number[] = [];
      const dicatat = new Set<number>();
      let berdiri = 0;
      let n = 0;
      for (let t = 0; t < 300; t += 1 / 30) {
        dunia.perbarui(1 / 30, laju);
        for (const o of dunia.orang) {
          if (o.fase === 'beliTiket' && !dicatat.has(o.id)) {
            dicatat.add(o.id);
            lama.push(o.lamaTimer);
          }
        }
        if (t > 150) {
          berdiri += dunia.orang.filter((o) => o.fase === 'antre' && !o.bergerak).length;
          n++;
        }
      }
      const rata = lama.reduce((a, b) => a + b, 0) / lama.length;
      expect(lama.length).toBeGreaterThan(20);
      // Santai ±2,5–3 detik di arus puncak (lebih sepi = lebih lama); petugas bergegas saat antrean menumpuk.
      expect(rata).toBeGreaterThan(2.2);
      expect(berdiri / n).toBeLessThan(4);
    }
  }, 60_000);
});
