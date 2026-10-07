/**
 * Sayap barat gedung utama: lorong di sepanjang dinding aula, toilet pria &
 * wanita (bilik, urinoir, wastafel), tempat wudhu (keran berderet, saluran air)
 * dan musholla pria & wanita (karpet, sajadah per shaf menghadap kiblat di
 * barat, mihrab). Beratap kaca dan bersekat rendah supaya isinya terlihat dari
 * kamera; fasad selatan kaca. Denah & titik singgah orang di tata-letak.ts.
 */
import { Busur, atapLengkung, bayanganKontak, bidang, dindingBusur, kotak, persegiTegak, silinder, uvDunia, type Kumpulan } from './geometri';
import { SKALA_UV, type PustakaMaterial } from './material3d';
import {
  ATAP,
  BILIK,
  DY_SAJADAH,
  LORONG_SAYAP,
  RUANG_SAYAP,
  SAYAP_BARAT,
  TINGGI_LANTAI_GEDUNG,
  X_KERAN_WUDHU,
  X_SHAF,
  X_URINOIR,
  X_WASTAFEL,
  xBilik,
  type JenisKelamin,
  type RuangSayap,
} from './tata-letak';

const PENUH = { u0: 0, v0: 0, u1: 1, v1: 1 } as const;
const ALAS = TINGGI_LANTAI_GEDUNG;
/** Tinggi sekat antarruangan & bilik: rendah, supaya isi ruangan terlihat dari atas. */
const H_SEKAT = 0.34;
const H_BILIK = 0.3;
/** Pintu tiap ruangan (setengah lebar bukaan di sekat). */
const SETENGAH_PINTU = 0.17;
const polos = { bayangan: false } as const;
const KACA = { bayangan: false, terimaBayangan: false, urutan: 2 } as const;

const ATAP_SAYAP = new Busur(ATAP.sayap.y0, ATAP.sayap.y1, ATAP.sayap.hTepi, ATAP.sayap.hPuncak);

export function bangunSayapBarat(k: Kumpulan, m: PustakaMaterial): void {
  const S = SAYAP_BARAT;

  // Podium & lantai: granit di lorong & toilet, granit gelap di tempat wudhu.
  k.tambah(m.batu, uvDunia(kotak(S.x0 - 0.2, S.y0 - 0.2, S.x1 - 0.3, S.y1 - 0.02, 0, ALAS), SKALA_UV.beton));
  k.tambah(m.kontak, bayanganKontak(S.x0 - 0.2, S.y0 - 0.2, S.x1 - 0.3, S.y1 + 0.3, 0.4, 0.3), { bayangan: false, terimaBayangan: false });
  k.tambah(m.lantaiGranit, uvDunia(bidang(S.x0, S.y0, S.x1, S.y1 - 0.02, ALAS + 0.002), SKALA_UV.granit), polos);
  for (const jk of ['pria', 'wanita'] as const) {
    const w = RUANG_SAYAP.wudhu[jk];
    k.tambah(m.granit, uvDunia(bidang(w.x0, w.y0, w.x1, w.y1, ALAS + 0.004), SKALA_UV.granit), polos);
  }

  dindingLuar(k, m);
  sekat(k, m);
  for (const jk of ['pria', 'wanita'] as const) {
    toilet(k, m, jk);
    wudhu(k, m, jk);
    musholla(k, m, jk);
  }
  papanPintu(k, m);
  atap(k, m);
}

/** Dinding utara & barat masif (plester), fasad selatan kaca di atas dinding rendah. */
function dindingLuar(k: Kumpulan, m: PustakaMaterial): void {
  const S = SAYAP_BARAT;
  const A = ATAP_SAYAP;
  const hU = A.tinggi(S.y0);
  const hS = A.tinggi(S.y1);
  k.tambah(m.plester, uvDunia(kotak(S.x0, S.y0, S.x1 - 0.06, S.y0 + 0.06, ALAS, hU), SKALA_UV.plester));
  k.tambah(m.plester, uvDunia(dindingBusur('x', S.x0, S.y0, S.y1, ALAS, A, -1), SKALA_UV.plester));
  k.tambah(m.dindingDalam, uvDunia(dindingBusur('x', S.x0 + 0.06, S.y0, S.y1, ALAS, A, 1), SKALA_UV.plester), polos);
  // Selatan: dinding rendah + kaca, tiang tiap 0,5, lis atas.
  k.tambah(m.plester, uvDunia(kotak(S.x0, S.y1 - 0.06, S.x1 - 0.06, S.y1, ALAS, ALAS + 0.26), SKALA_UV.plester));
  k.tambah(m.kacaDinding, persegiTegak([S.x0, S.y1], [S.x1 - 0.06, S.y1], ALAS + 0.26, hS, PENUH, 0), KACA);
  for (let x = S.x0 + 0.02; x < S.x1 - 0.1; x += 0.5) k.tambah(m.panel, kotak(x - 0.018, S.y1 - 0.02, x + 0.018, S.y1 + 0.02, ALAS + 0.26, hS));
  k.tambah(m.panel, kotak(S.x0, S.y1 - 0.03, S.x1 - 0.06, S.y1 + 0.03, hS - 0.05, hS));
  const papan = m.teks('MUSHOLLA · TOILET', { lebar: 512, tinggi: 64, latar: '#0f766e', warna: '#ffffff', ukuranHuruf: 40 });
  k.tambah(papan.material, persegiTegak([8.2, S.y1 + 0.03], [10.4, S.y1 + 0.03], hS - 0.2, hS - 0.06, papan.uv, 0.004), polos);
}

/** Sekat rendah antarruangan, sekat lorong (berpintu), dan sekat wudhu–musholla (berbukaan). */
function sekat(k: Kumpulan, m: PustakaMaterial): void {
  const S = SAYAP_BARAT;
  const R = RUANG_SAYAP;
  const xL = LORONG_SAYAP.x0;
  const dinding = (x0: number, y0: number, x1: number, y1: number): void => {
    if (x1 - x0 > 0.01 && y1 - y0 > 0.01) k.tambah(m.dindingDalam, uvDunia(kotak(x0, y0, x1, y1, ALAS, ALAS + H_SEKAT), SKALA_UV.plester));
  };
  for (const y of [R.toilet.pria.y1, R.toilet.wanita.y1, R.musholla.pria.y1]) dinding(S.x0 + 0.06, y - 0.025, xL, y + 0.025);
  // Sekat lorong (x = xL): terbuka di pintu tiap ruangan.
  const pintu = [R.toilet.pria, R.toilet.wanita, R.wudhu.pria, R.wudhu.wanita].map((r) => r.yPintu).sort((a, b) => a - b);
  let y = S.y0 + 0.06;
  for (const yp of pintu) {
    dinding(xL - 0.025, y, xL + 0.025, yp - SETENGAH_PINTU);
    y = yp + SETENGAH_PINTU;
  }
  dinding(xL - 0.025, y, xL + 0.025, S.y1 - 0.06);
  // Sekat wudhu–musholla: bukaan di yPintu.
  for (const jk of ['pria', 'wanita'] as const) {
    const w = R.wudhu[jk];
    dinding(w.x0 - 0.025, w.y0 + 0.025, w.x0 + 0.025, w.yPintu - SETENGAH_PINTU + 0.02);
    dinding(w.x0 - 0.025, w.yPintu + SETENGAH_PINTU - 0.02, w.x0 + 0.025, w.y1 - 0.025);
  }
}

/** Bilik berpintu di dinding utara, urinoir (pria), wastafel berkaca di dinding selatan. */
function toilet(k: Kumpulan, m: PustakaMaterial, jk: JenisKelamin): void {
  const r = RUANG_SAYAP.toilet[jk];
  const pintu = m.kios[jk === 'pria' ? 1 : 2]!;
  const w = BILIK.lebar / 2;
  const yDepan = r.y0 + BILIK.dalam;
  const xs = xBilik(jk);
  for (const x of xs) {
    k.tambah(m.panel, kotak(x - w - 0.012, r.y0 + 0.05, x - w + 0.012, yDepan, ALAS, ALAS + H_BILIK));
    k.tambah(pintu, kotak(x - w + 0.015, yDepan - 0.012, x + w - 0.015, yDepan + 0.012, ALAS + 0.03, ALAS + H_BILIK - 0.02));
    // Kloset di dalam bilik.
    k.tambah(m.panel, kotak(x - 0.05, r.y0 + 0.07, x + 0.05, r.y0 + 0.2, ALAS, ALAS + 0.07));
  }
  const xAkhir = xs[xs.length - 1]! + w;
  k.tambah(m.panel, kotak(xAkhir - 0.012, r.y0 + 0.05, xAkhir + 0.012, yDepan, ALAS, ALAS + H_BILIK));
  if (jk === 'pria') {
    for (const x of X_URINOIR) {
      k.tambah(m.panel, kotak(x - 0.045, r.y0 + 0.055, x + 0.045, r.y0 + 0.11, ALAS + 0.08, ALAS + 0.2));
      k.tambah(m.panel, kotak(x + 0.11, r.y0 + 0.055, x + 0.13, r.y0 + 0.2, ALAS + 0.06, ALAS + 0.26));
    }
  }
  // Meja wastafel granit, bak, keran, cermin di sekat selatan.
  const x0 = X_WASTAFEL[0]! - 0.15;
  const x1 = X_WASTAFEL[X_WASTAFEL.length - 1]! + 0.15;
  const yM = r.y1 - 0.025;
  k.tambah(m.panel, kotak(x0, yM - 0.12, x1, yM, ALAS, ALAS + 0.15));
  k.tambah(m.granit, kotak(x0 - 0.01, yM - 0.13, x1 + 0.01, yM, ALAS + 0.15, ALAS + 0.17));
  for (const x of X_WASTAFEL) {
    k.tambah(m.air, bidang(x - 0.05, yM - 0.1, x + 0.05, yM - 0.04, ALAS + 0.171), polos);
    k.tambah(m.besi, silinder(x, yM - 0.02, ALAS + 0.17, ALAS + 0.22, 0.008, 0.008, 6));
  }
  k.tambah(m.kacaDinding, persegiTegak([x1, yM - 0.001], [x0, yM - 0.001], ALAS + 0.2, ALAS + H_SEKAT - 0.01, PENUH, 0), KACA);
}

/** Tempat wudhu: dinding keramik berkeran di utara, saluran air, genangan tipis. */
function wudhu(k: Kumpulan, m: PustakaMaterial, jk: JenisKelamin): void {
  const r = RUANG_SAYAP.wudhu[jk];
  const y = r.y0 + 0.025;
  k.tambah(m.granit, kotak(r.x0 + 0.05, y, r.x1 - 0.05, y + 0.05, ALAS, ALAS + 0.28));
  k.tambah(m.besiGelap, bidang(r.x0 + 0.06, y + 0.06, r.x1 - 0.06, y + 0.11, ALAS + 0.006), polos);
  for (const x of X_KERAN_WUDHU) {
    k.tambah(m.besi, kotak(x - 0.007, y + 0.05, x + 0.007, y + 0.1, ALAS + 0.2, ALAS + 0.214));
    k.tambah(m.air, bidang(x - 0.05, y + 0.12, x + 0.05, y + 0.2, ALAS + 0.007), polos);
  }
}

/** Musholla: karpet hijau, sajadah per shaf, mihrab di dinding kiblat, rak alas kaki dekat bukaan. */
function musholla(k: Kumpulan, m: PustakaMaterial, jk: JenisKelamin): void {
  const r: RuangSayap = RUANG_SAYAP.musholla[jk];
  const S = SAYAP_BARAT;
  k.tambah(m.hijauGelap, bidang(S.x0 + 0.08, r.y0 + 0.05, r.x1 - 0.3, r.y1 - 0.05, ALAS + 0.005), polos);
  const warnaSajadah = [m.merahSpbu, m.kursi[0]!, m.kursi[1]!];
  X_SHAF.forEach((x, s) => {
    for (const dy of DY_SAJADAH) {
      const y = r.y0 + dy;
      k.tambah(warnaSajadah[s % warnaSajadah.length]!, bidang(x - 0.14, y - 0.055, x + 0.05, y + 0.055, ALAS + 0.008), polos);
    }
  });
  // Mihrab: ceruk kayu berbingkai emas di tengah dinding kiblat.
  const yc = (r.y0 + r.y1) / 2;
  k.tambah(m.kayu, kotak(S.x0 + 0.06, yc - 0.16, S.x0 + 0.1, yc + 0.16, ALAS, ALAS + 0.5));
  k.tambah(m.emas, kotak(S.x0 + 0.1, yc - 0.17, S.x0 + 0.11, yc + 0.17, ALAS + 0.5, ALAS + 0.52));
  k.tambah(m.masjid, kotak(S.x0 + 0.1, yc - 0.1, S.x0 + 0.105, yc + 0.1, ALAS + 0.02, ALAS + 0.42));
  // Rak alas kaki di sudut utara dekat bukaan dari tempat wudhu.
  k.tambah(m.kayu, kotak(r.x1 - 0.3, r.y0 + 0.05, r.x1 - 0.06, r.y0 + 0.13, ALAS, ALAS + 0.12));
}

/** Papan nama di samping pintu tiap ruangan (menghadap lorong) dan di sekat musholla. */
function papanPintu(k: Kumpulan, m: PustakaMaterial): void {
  const R = RUANG_SAYAP;
  const xL = LORONG_SAYAP.x0 + 0.03;
  const papan = (teks: string, latar: string, x: number, y: number): void => {
    const p = m.teks(teks, { lebar: 384, tinggi: 64, latar, warna: '#ffffff', ukuranHuruf: 34 });
    k.tambah(p.material, persegiTegak([x, y + 0.42], [x, y + SETENGAH_PINTU + 0.03], ALAS + H_SEKAT - 0.12, ALAS + H_SEKAT - 0.02, p.uv, 0.004), polos);
  };
  papan('TOILET PRIA', '#1d4ed8', xL, R.toilet.pria.yPintu);
  papan('TOILET WANITA', '#be185d', xL, R.toilet.wanita.yPintu);
  papan('WUDHU PRIA', '#0f766e', xL, R.wudhu.pria.yPintu);
  papan('WUDHU WANITA', '#0f766e', xL, R.wudhu.wanita.yPintu);
  papan('MUSHOLLA PRIA', '#15803d', R.wudhu.pria.x0 + 0.03, R.wudhu.pria.yPintu);
  papan('MUSHOLLA WANITA', '#15803d', R.wudhu.wanita.x0 + 0.03, R.wudhu.wanita.yPintu);
}

/** Atap kaca nyaris datar berbingkai, gording melintang. */
function atap(k: Kumpulan, m: PustakaMaterial): void {
  const A = ATAP_SAYAP;
  const a0 = ATAP.sayap.x0;
  const a1 = ATAP.sayap.x1;
  k.tambah(m.kacaAtap, atapLengkung('x', a0, a1, A, { segmen: 6 }), { bayangan: false, terimaBayangan: false, urutan: 3 });
  for (const t of [0, 1]) {
    const [b, h] = A.titik(t);
    k.tambah(m.panel, kotak(a0, b - 0.03, a1, b + 0.03, h - 0.03, h + 0.02));
  }
  for (const x of [a0 + 0.03, a1 - 0.03]) k.tambah(m.panel, kotak(x - 0.03, A.b0, x + 0.03, A.b1, A.hTepi - 0.02, A.hTepi + 0.03));
  for (let x = SAYAP_BARAT.x0 + 0.5; x < a1 - 0.2; x += 1.0) {
    k.tambah(m.kanopiRangka, kotak(x - 0.015, A.b0, x + 0.015, A.b1, A.hTepi - 0.04, A.hTepi - 0.01));
  }
}
