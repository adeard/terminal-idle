/**
 * Terminal terpadu 3D. Gedung utama memanjang di belakang pangkalan: aula kaca
 * (atap lengkung kaca berusuk baja putih dengan tritisan logam, fasad tirai kaca
 * bening) sehingga isinya terlihat dari kamera: deretan jendela loket tiket di
 * dinding utara, labirin tali pembatas antrean, toko, ATM, kursi, meja
 * informasi, dan papan jadwal. Di depannya selasar bertiang, gapura "TERMINAL
 * TERPADU", dan atrium kaca berjam. Ujung timurnya menyatu dengan ruang tunggu
 * keberangkatan: aula berdinding & beratap kaca berisi deretan kursi, kios,
 * papan jadwal, dan lima gerbang JALUR yang langsung membuka ke peron
 * keberangkatan. Peron kedatangan diberi kanopi kaca lengkung senada.
 */
import * as THREE from 'three';
import { WARNA_TAHAP, keHexCss } from '../config/tema';
import { atapLengkung, bayanganKontak, bidang, Busur, dindingBusur, kotak, persegiTegak, rusukBusur, silinder, uvDunia, Kumpulan } from './geometri';
import { SKALA_UV, type PustakaMaterial } from './material3d';
import { bangunSayapBarat } from './sayap3d';
import {
  ATAP,
  type AtapLengkung,
  BLOK_KURSI,
  BORDES,
  GEDUNG,
  GERBANG_X,
  KOLOM_KANOPI_DATANG,
  KIOS_TUNGGU,
  KURSI,
  LEBAR_PINTU_SAYAP,
  LOKET,
  PERON,
  PERON_BERANGKAT,
  PINTU_MASUK,
  PINTU_RUANG_TUNGGU,
  PINTU_SAYAP,
  RUANG_TUNGGU,
  TALI_LABIRIN,
  TINGGI_LANTAI_GEDUNG,
  TINGGI_PERON,
  TOKO_AULA,
  X_ATM,
  X_LOKET,
  Y_MUKA_TOKO,
  type Titik,
} from './tata-letak';

const PENUH = { u0: 0, v0: 0, u1: 1, v1: 1 } as const;
/** Tinggi alas (podium) gedung utama = lantai aula. */
const ALAS = TINGGI_LANTAI_GEDUNG;

function busurAtap(a: AtapLengkung): Busur {
  return new Busur(a.y0, a.y1, a.hTepi, a.hPuncak);
}

/** Penampang atap gedung utama: tepi ±9,5 m, puncak ±15 m, tritisan 0,5 unit di utara & selatan. */
export const ATAP_GEDUNG = busurAtap(ATAP.gedung);
/** Penampang atap kaca ruang tunggu: tritisan utaranya menaungi peron keberangkatan. */
export const ATAP_TUNGGU = busurAtap(ATAP.tunggu);
/** Penampang kanopi kaca peron kedatangan. */
const ATAP_DATANG = busurAtap(ATAP.datang);

/** Gapura masuk: dua pilar granit + balok nama, berpusat di pintu masuk. */
export const GAPURA = { x0: PINTU_MASUK[0] - 2.25, x1: PINTU_MASUK[0] + 2.25, y0: GEDUNG.y1 + 0.02, y1: GEDUNG.y1 + 0.5, tinggi: 3.4, pilar: 0.44 } as const;
/** Atrium kaca di tengah gedung utama, menjulang di atas atap lengkung (di belakang gapura). */
export const ATRIUM = { x0: PINTU_MASUK[0] - 1.5, x1: PINTU_MASUK[0] + 1.5, y0: GEDUNG.y0 + 1.1, y1: GEDUNG.y1 - 0.4, hDinding: 3.75, hPuncak: 4.25 } as const;

/** Deretan kursi aula menghadap selatan: x kursi pertama, y baris, jumlah kursi. */
export const DERET_KURSI_AULA: readonly { readonly x0: number; readonly y: number; readonly jumlah: number }[] = [
  { x0: 12.35, y: 13.3, jumlah: 8 },
  { x0: 14.35, y: 13.3, jumlah: 8 },
  { x0: 12.35, y: 14.0, jumlah: 8 },
  { x0: 14.35, y: 14.0, jumlah: 8 },
  { x0: 23.25, y: 13.4, jumlah: 8 },
  { x0: 24.95, y: 13.4, jumlah: 8 },
  { x0: 23.25, y: 14.1, jumlah: 8 },
  { x0: 24.95, y: 14.1, jumlah: 8 },
];
/** Meja informasi di sisi timur aula (petugasnya diletakkan di terminal3d). */
export const MEJA_INFO: Titik = [27.65, 13.9];

const tanpaBayangan = { bayangan: false, terimaBayangan: false } as const;
/** Kaca bening: tanpa bayangan, digambar setelah benda padat. */
const KACA = { ...tanpaBayangan, urutan: 2 } as const;

export function bangunGedung(k: Kumpulan, m: PustakaMaterial): void {
  gedungUtama(k, m);
  atrium(k, m);
  gapura(k, m);
  deretanLoket(k, m);
  labirinAntrean(k, m);
  isiAula(k, m);
  ruangTunggu(k, m);
  isiRuangTunggu(k, m);
  kanopiKedatangan(k, m);
  bangunSayapBarat(k, m);
}

// ---------------------------------------------------------------------------
// Gedung utama

function gedungUtama(k: Kumpulan, m: PustakaMaterial): void {
  const G = GEDUNG;
  const A = ATAP_GEDUNG;
  const hDinding = A.tinggi(G.y1); // tinggi dinding tepat menyentuh kulit atap
  // Dinding dalam tidak membayangi aula: loket di dinding utara tetap terang.
  const dalam = { bayangan: false } as const;

  // Podium, lantai granit aula, bordes landai di depan pintu masuk.
  k.tambah(m.batu, uvDunia(kotak(G.x0 - 0.3, G.y0 - 0.3, G.x1, G.y1 - 0.02, 0, ALAS), SKALA_UV.beton));
  k.tambah(m.kontak, bayanganKontak(G.x0 - 0.3, G.y0 - 0.3, G.x1, G.y1 + 0.45, 0.5, 0.36), tanpaBayangan);
  k.tambah(m.lantaiGranit, uvDunia(bidang(G.x0, G.y0, G.x1, G.y1 - 0.02, ALAS + 0.002), SKALA_UV.granit), { bayangan: false });
  k.tambah(m.batu, uvDunia(landai(BORDES.x0, BORDES.x1, BORDES.y0, BORDES.y1, ALAS, 0.014), SKALA_UV.beton));

  // Dinding utara (di balik deretan loket): masif, sisi dalamnya terlihat lewat atap kaca.
  k.tambah(m.dindingDalam, uvDunia(kotak(G.x0, G.y0, G.x1, G.y0 + 0.06, ALAS, hDinding), SKALA_UV.plester), dalam);
  dindingBarat(k, m);

  // Ujung timur: panel berpintu di bagian yang menempel ruang tunggu, kaca di luarnya.
  const [, yPintu] = PINTU_RUANG_TUNGGU;
  const [pa, pb] = [yPintu - 0.45, yPintu + 0.45];
  const hPintu = 0.86;
  k.tambah(m.panel, dindingBusur('x', G.x1, G.y0, pa, ALAS, A, 1, 1, 4));
  k.tambah(m.panel, dindingBusur('x', G.x1, pb, RUANG_TUNGGU.y1, ALAS, A, 1, 1, 4));
  k.tambah(m.panel, dindingBusur('x', G.x1, pa, pb, hPintu, A, 1, 1, 3));
  k.tambah(m.kacaDinding, dindingBusur('x', G.x1, RUANG_TUNGGU.y1, G.y1, ALAS, A, 1, 1, 6), KACA);
  for (let y = RUANG_TUNGGU.y1 + 0.5; y < G.y1 - 0.1; y += 0.5) k.tambah(m.panel, kotak(G.x1, y - 0.018, G.x1 + 0.06, y + 0.018, ALAS, A.tinggi(y)));

  // Fasad depan: tirai kaca bening (aula terlihat dari luar), sirip vertikal, lis.
  const [px] = PINTU_MASUK;
  const lebarPintu = 0.36;
  const hPintuMasuk = 0.8;
  k.tambah(m.kacaDinding, persegiTegak([G.x0, G.y1], [px - lebarPintu, G.y1], ALAS, hDinding, PENUH, 0), KACA);
  k.tambah(m.kacaDinding, persegiTegak([px + lebarPintu, G.y1], [G.x1, G.y1], ALAS, hDinding, PENUH, 0), KACA);
  k.tambah(m.kacaDinding, persegiTegak([px - lebarPintu, G.y1], [px + lebarPintu, G.y1], hPintuMasuk, hDinding, PENUH, 0), KACA);
  for (const [xa, xb] of [
    [G.x0, px - lebarPintu],
    [px + lebarPintu, G.x1],
  ] as const) {
    k.tambah(m.panel, kotak(xa, G.y1, xb, G.y1 + 0.05, ALAS, ALAS + 0.05));
  }
  k.tambah(m.panel, kotak(G.x0, G.y1, G.x1, G.y1 + 0.05, 1.02, 1.07));
  k.tambah(m.panel, kotak(G.x0, G.y1, G.x1, G.y1 + 0.04, hDinding - 0.16, hDinding));
  for (let x = G.x0 + 0.25; x < G.x1 - 0.1; x += 0.5) {
    if (Math.abs(x - px) < lebarPintu + 0.05) continue;
    k.tambah(m.panel, kotak(x - 0.018, G.y1, x + 0.018, G.y1 + 0.06, ALAS, hDinding - 0.16));
  }

  // Atap lengkung: tritisan logam di utara & selatan, kulit kaca bening di atas aula.
  const a0 = G.x0 - 0.35;
  const a1 = G.x1;
  const tU = A.tDari(G.y0);
  const tS = A.tDari(G.y1);
  const opsi = { segmen: 3, skalaU: SKALA_UV.logamU, skalaV: SKALA_UV.logamV };
  k.tambah(m.atapLogam, atapLengkung('x', a0, a1, A, { ...opsi, t1: tU }));
  k.tambah(m.atapLogam, atapLengkung('x', a0, a1, A, { ...opsi, t0: tS }));
  k.tambah(m.kacaAtap, atapLengkung('x', a0, a1, A, { t0: tU, t1: tS, segmen: 14 }), { ...tanpaBayangan, urutan: 3 });
  for (const t of [tU, tS]) {
    const [b, h] = A.titik(t);
    k.tambah(m.panel, kotak(a0, b - 0.03, a1, b + 0.03, h - 0.02, h + 0.035));
  }
  // Rusuk baja putih segaris tiang selasar, gording memanjang di bawah kaca.
  for (let x = G.x0 + 0.4; x < G.x1 - 0.15; x += 1.1) k.tambah(m.kanopiRangka, rusukBusur('x', x, A, 0.05, -0.085, 0.012, 16, tU, tS));
  for (const t of [0.25, 0.375, 0.5, 0.625, 0.75]) {
    const [b, h] = A.titik(t, -0.035);
    k.tambah(m.kanopiRangka, kotak(a0, b - 0.016, a1, b + 0.016, h - 0.028, h + 0.006));
  }
  for (const a of [a0 + 0.03, a1 - 0.03]) k.tambah(m.panel, rusukBusur('x', a, A, 0.06, -0.09, 0.02, 12));
  for (const b of [A.b0, A.b1]) k.tambah(m.panel, kotak(a0, b - 0.05, a1, b + 0.03, A.hTepi - 0.12, A.hTepi + 0.01));

  // Selasar depan: tiang ramping di bawah tritisan (kecuali di depan gapura).
  const ySel = G.y1 + 0.32;
  for (let x = G.x0 + 0.4; x < G.x1 - 0.15; x += 1.1) {
    if (x > GAPURA.x0 - 0.2 && x < GAPURA.x1 + 0.2) continue;
    k.tambah(m.panel, silinder(x, ySel, 0.012, A.tinggi(ySel), 0.04, 0.04, 10));
  }

  // Pintu masuk: kusen, daun pintu geser kaca terbuka ke samping, papan MASUK.
  for (const dx of [-lebarPintu - 0.02, lebarPintu + 0.02]) k.tambah(m.panel, kotak(px + dx - 0.03, G.y1 - 0.02, px + dx + 0.03, G.y1 + 0.06, ALAS, hPintuMasuk + 0.02));
  k.tambah(m.panel, kotak(px - lebarPintu - 0.05, G.y1 - 0.02, px + lebarPintu + 0.05, G.y1 + 0.06, hPintuMasuk, hPintuMasuk + 0.06));
  for (const s of [-1, 1]) {
    k.tambah(m.kacaDinding, persegiTegak([px + s * lebarPintu, G.y1 - 0.04], [px + s * (2 * lebarPintu - 0.02), G.y1 - 0.04], ALAS, hPintuMasuk, PENUH, 0), KACA);
  }
  const masuk = m.teks('MASUK', { lebar: 256, tinggi: 72, latar: '#15803d', warna: '#ffffff', ukuranHuruf: 44 });
  k.tambah(masuk.material, persegiTegak([px - 0.24, G.y1 + 0.06], [px + 0.24, G.y1 + 0.06], 0.88, 1.0, masuk.uv, 0.004), { bayangan: false });

  // Pintu dari aula loket ke ruang tunggu (terbuka; terlihat dari dalam aula kaca ruang tunggu).
  for (const dy of [-0.45, 0.45]) k.tambah(m.panel, kotak(G.x1, yPintu + dy - 0.025, G.x1 + 0.05, yPintu + dy + 0.025, TINGGI_PERON, hPintu - 0.02));
  k.tambah(m.panel, kotak(G.x1, yPintu - 0.47, G.x1 + 0.05, yPintu + 0.47, hPintu - 0.06, hPintu));
  const info = m.teks('LOKET · INFORMASI', { lebar: 512, tinggi: 72, latar: '#1e293b', warna: '#ffffff', ukuranHuruf: 40 });
  k.tambah(info.material, persegiTegak([G.x1 + 0.05, yPintu + 0.42], [G.x1 + 0.05, yPintu - 0.42], hPintu + 0.04, hPintu + 0.18, info.uv, 0.004), { bayangan: false });
}

/** Bidang landai (bordes) [x0,x1] dari y0 setinggi h0 turun ke y1 setinggi h1, bersisi tegak. */
/** Tinggi bagian masif dinding barat aula dan tinggi pintunya ke lorong sayap barat. */
const H_DINDING_BARAT = ALAS + 0.62;
const H_PINTU_SAYAP = ALAS + 0.5;

/**
 * Dinding barat aula: bagian bawah masif dengan dua pintu ke lorong sayap
 * barat (toilet & musholla), di atasnya kaca supaya isi sayap barat terlihat
 * dari kamera lewat aula.
 */
function dindingBarat(k: Kumpulan, m: PustakaMaterial): void {
  const G = GEDUNG;
  const A = ATAP_GEDUNG;
  const x1 = G.x0 + 0.06;
  const pintu = PINTU_SAYAP.map((y) => [y - LEBAR_PINTU_SAYAP / 2, y + LEBAR_PINTU_SAYAP / 2] as const);
  let y = G.y0 + 0.06;
  for (const [pa, pb] of pintu) {
    k.tambah(m.dindingDalam, uvDunia(kotak(G.x0, y, x1, pa, ALAS, H_DINDING_BARAT), SKALA_UV.plester), { bayangan: false });
    k.tambah(m.dindingDalam, uvDunia(kotak(G.x0, pa, x1, pb, H_PINTU_SAYAP, H_DINDING_BARAT), SKALA_UV.plester), { bayangan: false });
    for (const yk of [pa, pb]) k.tambah(m.panel, kotak(G.x0 - 0.01, yk - 0.015, x1 + 0.01, yk + 0.015, ALAS, H_PINTU_SAYAP + 0.01));
    y = pb;
  }
  k.tambah(m.dindingDalam, uvDunia(kotak(G.x0, y, x1, G.y1 - 0.02, ALAS, H_DINDING_BARAT), SKALA_UV.plester), { bayangan: false });
  k.tambah(m.panel, kotak(G.x0 - 0.01, G.y0, x1 + 0.01, G.y1, H_DINDING_BARAT - 0.015, H_DINDING_BARAT + 0.015));
  k.tambah(m.kacaDinding, dindingBusur('x', G.x0 + 0.03, G.y0, G.y1, H_DINDING_BARAT, A, 1), KACA);
  for (let yk = G.y0 + 0.45; yk < G.y1 - 0.1; yk += 0.5) k.tambah(m.panel, kotak(G.x0, yk - 0.018, x1, yk + 0.018, H_DINDING_BARAT, A.tinggi(yk)));
  // Papan di atas pintu (menghadap aula).
  const papan = [
    m.teks('TOILET', { lebar: 256, tinggi: 64, latar: '#334155', warna: '#ffffff', ukuranHuruf: 40 }),
    m.teks('MUSHOLLA', { lebar: 256, tinggi: 64, latar: '#15803d', warna: '#ffffff', ukuranHuruf: 40 }),
  ];
  PINTU_SAYAP.forEach((yp, i) => {
    const p = papan[i]!;
    k.tambah(p.material, persegiTegak([x1 + 0.005, yp + 0.28], [x1 + 0.005, yp - 0.28], H_PINTU_SAYAP + 0.015, H_DINDING_BARAT - 0.02, p.uv, 0.004), { bayangan: false });
  });
}

function landai(x0: number, x1: number, y0: number, y1: number, h0: number, h1: number): THREE.BufferGeometry {
  const g = kotak(x0, y0, x1, y1, 0, h0);
  const p = g.getAttribute('position');
  for (let i = 0; i < p.count; i++) if (p.getY(i) > h0 / 2 && p.getZ(i) > (y0 + y1) / 2) p.setY(i, h1);
  g.computeVertexNormals();
  return g;
}

/**
 * Dinding tegak di x tetap (y dari yAwal ke yAkhir) yang alasnya menempel kulit
 * atap gedung utama dan puncaknya rata setinggi hAtas (dinding samping atrium).
 */
function dindingAtasAtap(x: number, yAwal: number, yAkhir: number, hAtas: number, segmen = 8): THREE.BufferGeometry {
  const pos: number[] = [];
  for (let i = 0; i < segmen; i++) {
    const ya = yAwal + ((yAkhir - yAwal) * i) / segmen;
    const yb = yAwal + ((yAkhir - yAwal) * (i + 1)) / segmen;
    const ha = ATAP_GEDUNG.tinggi(ya);
    const hb = ATAP_GEDUNG.tinggi(yb);
    pos.push(x, ha, ya, x, hb, yb, x, hAtas, ya, x, hb, yb, x, hAtas, yb, x, hAtas, ya);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(new Array((pos.length / 3) * 2).fill(0), 2));
  g.computeVertexNormals();
  return g;
}

/**
 * Menara atrium di atas pintu masuk: dinding kaca bening di keempat sisi (alasnya
 * menempel kulit atap aula), atap lengkung kaca melintang (sumbu y) berusuk baja,
 * jam di bidang selatan. Serba kaca supaya aula di bawahnya tetap terlihat.
 */
function atrium(k: Kumpulan, m: PustakaMaterial): void {
  const T = ATRIUM;
  const A = ATAP_GEDUNG;
  const hS = A.tinggi(T.y1);
  const hN = A.tinggi(T.y0);
  k.tambah(m.kacaDinding, persegiTegak([T.x0, T.y1], [T.x1, T.y1], hS, T.hDinding, PENUH, 0), KACA);
  k.tambah(m.kacaDinding, persegiTegak([T.x1, T.y0], [T.x0, T.y0], hN, T.hDinding, PENUH, 0), KACA);
  for (const x of [T.x0, T.x1]) k.tambah(m.kacaDinding, dindingAtasAtap(x, T.y0, T.y1, T.hDinding), KACA);
  // Rangka: tiang sudut, sirip vertikal di sisi selatan & timur, lis atas & lis tengah.
  for (let x = T.x0 + 0.25; x < T.x1; x += 0.5) k.tambah(m.panel, kotak(x - 0.02, T.y1, x + 0.02, T.y1 + 0.07, hS, T.hDinding));
  for (let y = T.y0 + 0.3; y < T.y1; y += 0.5) k.tambah(m.panel, kotak(T.x1, y - 0.02, T.x1 + 0.07, y + 0.02, A.tinggi(y), T.hDinding));
  for (const x of [T.x0, T.x1]) for (const y of [T.y0, T.y1]) k.tambah(m.panel, kotak(x - 0.04, y - 0.04, x + 0.04, y + 0.04, A.tinggi(y) - 0.05, T.hDinding));
  for (const [xa, ya, xb, yb] of [
    [T.x0 - 0.04, T.y1, T.x1 + 0.04, T.y1 + 0.08],
    [T.x1, T.y0 - 0.04, T.x1 + 0.08, T.y1 + 0.04],
  ] as const) {
    k.tambah(m.panel, kotak(xa, ya, xb, yb, T.hDinding - 0.1, T.hDinding));
    k.tambah(m.panel, kotak(xa, ya, xb, yb, 2.95, 3.03));
  }
  for (const [xa, ya, xb, yb] of [
    [T.x0 - 0.04, T.y0 - 0.04, T.x1 + 0.04, T.y0],
    [T.x0 - 0.04, T.y0, T.x0, T.y1],
  ] as const) {
    k.tambah(m.panel, kotak(xa, ya, xb, yb, T.hDinding - 0.1, T.hDinding));
  }
  // Atap lengkung melintang: kaca bening, rusuk & gording baja, bidang ujung kaca.
  const B = new Busur(T.x0 - 0.2, T.x1 + 0.2, T.hDinding, T.hPuncak);
  const [ua, ub] = [T.y0 - 0.25, T.y1 + 0.25];
  k.tambah(m.kacaAtap, atapLengkung('y', ua, ub, B, { segmen: 10 }), { ...tanpaBayangan, urutan: 3 });
  for (let i = 0; i <= 4; i++) k.tambah(m.kanopiRangka, rusukBusur('y', ua + 0.03 + ((ub - ua - 0.06) * i) / 4, B, 0.05, -0.08, 0.015, 10));
  for (const t of [0.25, 0.5, 0.75]) {
    const [b, h] = B.titik(t, -0.03);
    k.tambah(m.kanopiRangka, kotak(b - 0.016, ua, b + 0.016, ub, h - 0.028, h + 0.006));
  }
  for (const t of [0, 1]) {
    const [b, h] = B.titik(t);
    k.tambah(m.panel, kotak(b - 0.05, ua, b + 0.05, ub, h - 0.08, h + 0.01));
  }
  k.tambah(m.kacaDinding, dindingBusur('y', T.y1, T.x0, T.x1, T.hDinding - 0.002, B, 1), KACA);
  k.tambah(m.kacaDinding, dindingBusur('y', T.y0, T.x0, T.x1, T.hDinding - 0.002, B, -1), KACA);
  // Jam besar di bidang selatan, berbingkai.
  const cx = (T.x0 + T.x1) / 2;
  k.tambah(m.panel, kotak(cx - 0.27, T.y1 - 0.02, cx + 0.27, T.y1 + 0.008, T.hDinding - 0.03, T.hDinding + 0.47));
  k.tambah(m.jam, persegiTegak([cx - 0.24, T.y1], [cx + 0.24, T.y1], T.hDinding + 0.0, T.hDinding + 0.44, PENUH, 0.01));
}

function gapura(k: Kumpulan, m: PustakaMaterial): void {
  const P = GAPURA;
  for (const x of [P.x0, P.x1 - P.pilar]) {
    k.tambah(m.batu, uvDunia(kotak(x, P.y0, x + P.pilar, P.y1, 0, P.tinggi), SKALA_UV.beton));
    k.tambah(m.kontak, bayanganKontak(x, P.y0, x + P.pilar, P.y1, 0.18, 0.4), tanpaBayangan);
    // Lis emas vertikal di muka pilar.
    k.tambah(m.emas, kotak(x + P.pilar / 2 - 0.02, P.y1, x + P.pilar / 2 + 0.02, P.y1 + 0.012, 0.3, P.tinggi - 0.7));
  }
  k.tambah(m.batu, uvDunia(kotak(P.x0 - 0.1, P.y0, P.x1 + 0.1, P.y1, P.tinggi - 0.62, P.tinggi), SKALA_UV.beton));
  for (const h of [P.tinggi - 0.64, P.tinggi]) k.tambah(m.emas, kotak(P.x0 - 0.12, P.y0 - 0.02, P.x1 + 0.12, P.y1 + 0.02, h - 0.02, h + 0.015));
  // Papan nama di balok gapura berganti sesuai kelas terminal (lihat kelas3d.ts).
}

// ---------------------------------------------------------------------------
// Aula loket (isi gedung utama)

/**
 * Deretan jendela loket di dinding utara aula, menghadap selatan: meja panjang
 * (badan berwarna tahap loket, daun meja granit), sekat rendah antarjendela,
 * kaca loket bening, papan nomor & tujuan di dinding, papan judul. Semua yang
 * di depan petugas dibuat rendah supaya petugas terlihat dari sudut kamera.
 */
function deretanLoket(k: Kumpulan, m: PustakaMaterial): void {
  const L = LOKET;
  const w = L.setengahLebar;
  const xa = X_LOKET[0]! - w;
  const xb = X_LOKET[X_LOKET.length - 1]! + w;
  const yDinding = GEDUNG.y0 + 0.06;
  const hMeja = ALAS + 0.2;
  const warnaLoket = keHexCss(WARNA_TAHAP.loket);
  k.tambah(m.mejaLoket, kotak(xa, L.yMeja - 0.16, xb, L.yMeja, ALAS, hMeja));
  k.tambah(m.granit, kotak(xa - 0.02, L.yMeja - 0.2, xb + 0.02, L.yMeja + 0.03, hMeja, hMeja + 0.025));
  k.tambah(m.kontak, bayanganKontak(xa, L.yMeja - 0.16, xb, L.yMeja, 0.12, 0.28, ALAS + 0.006), tanpaBayangan);
  // Sekat antarjendela, dari dinding sampai muka meja.
  for (const x of [...X_LOKET.map((x) => x - w), xb]) k.tambah(m.panel, kotak(x - 0.018, yDinding, x + 0.018, L.yMeja + 0.01, ALAS, ALAS + 0.5));
  X_LOKET.forEach((x, i) => {
    // Kaca loket di atas meja dengan ambang atas tipis.
    k.tambah(m.kacaDinding, persegiTegak([x - w + 0.02, L.yMeja - 0.1], [x + w - 0.02, L.yMeja - 0.1], hMeja + 0.025, ALAS + 0.45, PENUH, 0), KACA);
    k.tambah(m.panel, kotak(x - w, L.yMeja - 0.115, x + w, L.yMeja - 0.085, ALAS + 0.45, ALAS + 0.47));
    // Monitor kasir menghadap petugas.
    k.tambah(m.besiGelap, kotak(x + 0.12, L.yMeja - 0.2, x + 0.28, L.yMeja - 0.17, hMeja + 0.025, hMeja + 0.13));
    const nomor = m.teks(`LOKET ${i + 1}`, { lebar: 256, tinggi: 60, latar: warnaLoket, warna: '#1d232b', ukuranHuruf: 40 });
    k.tambah(nomor.material, persegiTegak([x - 0.26, yDinding], [x + 0.26, yDinding], ALAS + 0.58, ALAS + 0.7, nomor.uv, 0.004), { bayangan: false });
    // Papan nama PO pemilik jendela di atasnya ada di papan-jurusan3d.ts (mengikuti mitra PO).
  });
  // Papan judul di atas deretan loket.
  const cx = (xa + xb) / 2;
  k.tambah(m.mejaLoket, kotak(xa, yDinding, xb, yDinding + 0.02, ALAS + 1.06, ALAS + 1.34));
  const judul = m.teks('LOKET TIKET BUS', { lebar: 1024, tinggi: 96, latar: warnaLoket, warna: '#1d232b', ukuranHuruf: 72 });
  k.tambah(judul.material, persegiTegak([cx - 1.45, yDinding + 0.02], [cx + 1.45, yDinding + 0.02], ALAS + 1.07, ALAS + 1.33, judul.uv, 0.004), { bayangan: false });
}

/** Labirin antrean: tali keliling & antarlajur (tiang besi beralas bundar, sabuk biru), papan di celah masuknya. */
function labirinAntrean(k: Kumpulan, m: PustakaMaterial): void {
  const h = ALAS;
  for (const [x0, y0, x1, y1] of TALI_LABIRIN) {
    const n = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0) / 0.55));
    for (let i = 0; i <= n; i++) {
      const x = x0 + ((x1 - x0) * i) / n;
      const y = y0 + ((y1 - y0) * i) / n;
      k.tambah(m.besi, silinder(x, y, h, h + 0.19, 0.011, 0.011, 6));
      k.tambah(m.besiGelap, silinder(x, y, h, h + 0.012, 0.03, 0.03, 10));
    }
    const t = 0.005;
    k.tambah(m.sabuk, kotak(Math.min(x0, x1) - t, Math.min(y0, y1) - t, Math.max(x0, x1) + t, Math.max(y0, y1) + t, h + 0.155, h + 0.172), { bayangan: false });
  }
  const [x, y] = [19.3, 13.92];
  k.tambah(m.besiGelap, silinder(x, y, h, h + 0.42, 0.012, 0.012, 6));
  k.tambah(m.besiGelap, silinder(x, y, h, h + 0.012, 0.035, 0.035, 10));
  const papan = m.teks('ANTRE DI SINI', { lebar: 256, tinggi: 72, latar: keHexCss(WARNA_TAHAP.loket), warna: '#1d232b', ukuranHuruf: 34 });
  k.tambah(papan.material, persegiTegak([x - 0.2, y + 0.013], [x + 0.2, y + 0.013], h + 0.3, h + 0.41, papan.uv, 0.002), { bayangan: false });
}

/**
 * Isi aula selain loket: toko (minimarket, apotek) & ATM di sisi barat (pintu
 * toilet & musholla di dinding barat: dindingBarat() & sayap3d.ts), deretan kursi, meja informasi, papan jadwal
 * besar di dinding utara, penunjuk arah ke ruang tunggu, pot tanaman.
 */
function isiAula(k: Kumpulan, m: PustakaMaterial): void {
  const G = GEDUNG;
  const h0 = ALAS;
  const yDinding = G.y0 + 0.06;
  const yM = Y_MUKA_TOKO;
  const polos = { bayangan: false } as const;

  // Toko: sekat samping, rak dinding & rak tengah, meja kasir, etalase kaca berpintu, papan nama.
  TOKO_AULA.forEach((t, i) => {
    const rak = m.kios[(i + 1) % m.kios.length]!;
    for (const x of [t.x0, t.x1]) k.tambah(m.dindingDalam, uvDunia(kotak(x - 0.03, yDinding, x + 0.03, yM, h0, h0 + 0.8), SKALA_UV.plester), polos);
    k.tambah(rak, uvDunia(kotak(t.x0 + 0.06, yDinding, t.x1 - 0.06, yDinding + 0.14, h0, h0 + 0.42), SKALA_UV.plester));
    k.tambah(rak, uvDunia(kotak(t.x0 + 0.2, 11.56, t.x1 - 0.58, 11.7, h0, h0 + 0.3), SKALA_UV.plester));
    k.tambah(m.panel, kotak(t.x1 - 0.46, 11.78, t.x1 - 0.08, 11.92, h0, h0 + 0.2));
    k.tambah(m.besiGelap, kotak(t.x1 - 0.2, 11.8, t.x1 - 0.1, 11.83, h0 + 0.2, h0 + 0.28));
    const pintu = [t.x0 + 0.32, t.x0 + 0.62] as const;
    k.tambah(m.kacaDinding, persegiTegak([t.x0, yM], [pintu[0], yM], h0, h0 + 0.62, PENUH, 0), KACA);
    k.tambah(m.kacaDinding, persegiTegak([pintu[1], yM], [t.x1, yM], h0, h0 + 0.62, PENUH, 0), KACA);
    for (const x of pintu) k.tambah(m.panel, kotak(x - 0.015, yM - 0.015, x + 0.015, yM + 0.015, h0, h0 + 0.62));
    k.tambah(m.panel, kotak(t.x0, yM - 0.03, t.x1, yM + 0.02, h0 + 0.62, h0 + 0.8));
    const panjang = t.x1 - t.x0 - 0.16;
    const papan = m.teks(t.nama, { lebar: Math.round((48 * panjang) / 0.14 / 16) * 16, tinggi: 48, latar: t.latar, warna: '#ffffff', ukuranHuruf: 34 });
    k.tambah(papan.material, persegiTegak([t.x0 + 0.08, yM + 0.02], [t.x1 - 0.08, yM + 0.02], h0 + 0.64, h0 + 0.78, papan.uv, 0.003), { bayangan: false });
  });

  // ATM di dinding utara.
  for (const x of X_ATM) {
    k.tambah(m.panel, kotak(x - 0.13, yDinding, x + 0.13, yDinding + 0.22, h0, h0 + 0.42));
    k.tambah(m.layar, persegiTegak([x - 0.08, yDinding + 0.22], [x + 0.08, yDinding + 0.22], h0 + 0.27, h0 + 0.37, PENUH, 0.002), { bayangan: false });
    k.tambah(m.besiGelap, kotak(x - 0.1, yDinding + 0.22, x + 0.1, yDinding + 0.28, h0 + 0.2, h0 + 0.23));
  }
  const atm = m.teks('ATM CENTER', { lebar: 320, tinggi: 60, latar: '#1d4ed8', warna: '#ffffff', ukuranHuruf: 36 });
  k.tambah(atm.material, persegiTegak([15.25, yDinding], [16.15, yDinding], h0 + 0.55, h0 + 0.72, atm.uv, 0.004), { bayangan: false });

  // Pintu toilet & musholla di dinding barat: lihat dindingBarat() dan sayap3d.ts.

  // Deretan kursi menghadap selatan.
  for (const d of DERET_KURSI_AULA) deretKursi(k, m, d.x0, d.y, d.jumlah);

  // Meja informasi.
  const [ix, iy] = MEJA_INFO;
  k.tambah(m.panel, kotak(ix - 0.55, iy - 0.1, ix + 0.55, iy + 0.1, h0, h0 + 0.2));
  k.tambah(m.granit, kotak(ix - 0.58, iy - 0.13, ix + 0.58, iy + 0.13, h0 + 0.2, h0 + 0.225));
  k.tambah(m.besiGelap, kotak(ix - 0.25, iy - 0.05, ix - 0.1, iy - 0.02, h0 + 0.225, h0 + 0.32));
  const info = m.teks('INFORMASI', { lebar: 384, tinggi: 64, latar: '#1d4ed8', warna: '#ffffff', ukuranHuruf: 40 });
  k.tambah(info.material, persegiTegak([ix - 0.42, iy + 0.1], [ix + 0.42, iy + 0.1], h0 + 0.04, h0 + 0.18, info.uv, 0.004), { bayangan: false });

  // Papan jadwal besar di dinding utara, di timur deretan loket.
  const [jx0, jx1] = [26.35, 28.15];
  k.tambah(m.besiGelap, kotak(jx0 - 0.05, yDinding, jx1 + 0.05, yDinding + 0.04, h0 + 0.42, h0 + 1.47));
  k.tambah(m.jadwal, persegiTegak([jx0, yDinding + 0.04], [jx1, yDinding + 0.04], h0 + 0.46, h0 + 1.43, PENUH, 0.002), { bayangan: false });

  // Penunjuk arah ke ruang tunggu, di samping lorong menuju pintunya.
  const [tx, ty] = [28.5, 13.05];
  k.tambah(m.besiGelap, silinder(tx, ty, h0, h0 + 0.55, 0.014, 0.014, 6));
  k.tambah(m.besiGelap, silinder(tx, ty, h0, h0 + 0.012, 0.04, 0.04, 10));
  const arah = m.teks('RUANG TUNGGU →', { lebar: 320, tinggi: 64, latar: keHexCss(WARNA_TAHAP.keberangkatan), warna: '#ffffff', ukuranHuruf: 34 });
  k.tambah(arah.material, persegiTegak([tx - 0.3, ty + 0.015], [tx + 0.3, ty + 0.015], h0 + 0.42, h0 + 0.54, arah.uv, 0.002), { bayangan: false });

  // Pot tanaman.
  for (const [x, y] of [
    [G.x0 + 0.3, G.y1 - 0.3],
    [16.6, 14.65],
    [20.6, 14.7],
    [22.95, 14.7],
    [26.2, 12.85],
    [G.x1 - 0.3, G.y1 - 0.3],
  ] as const) {
    k.tambah(m.plesterGelap, silinder(x, y, h0, h0 + 0.12, 0.07, 0.055, 10));
    const daun = new THREE.IcosahedronGeometry(0.13, 1);
    daun.scale(1, 1.25, 1);
    daun.translate(x, h0 + 0.27, y);
    k.tambah(m.semak, daun);
  }
}

/** Deretan kursi berangka baja menghadap selatan (sandaran di sisi utara), mulai dari x0. */
function deretKursi(k: Kumpulan, m: PustakaMaterial, x0: number, y: number, jumlah: number): void {
  const h0 = ALAS;
  const x1 = x0 + KURSI.jarak * jumlah;
  const warna = m.kursi[0]!;
  k.tambah(m.besiGelap, kotak(x0 + 0.02, y - 0.012, x1 - 0.02, y + 0.012, h0 + 0.05, h0 + 0.068));
  for (const x of [x0 + 0.1, (x0 + x1) / 2, x1 - 0.1]) k.tambah(m.besiGelap, kotak(x - 0.012, y - 0.05, x + 0.012, y + 0.05, h0, h0 + 0.055));
  for (let c = 0; c < jumlah; c++) {
    const x = x0 + KURSI.jarak * (c + 0.5);
    k.tambah(warna, kotak(x - 0.072, y - 0.045, x + 0.072, y + 0.065, h0 + 0.075, h0 + 0.095));
    k.tambah(warna, kotak(x - 0.072, y - 0.072, x + 0.072, y - 0.05, h0 + 0.1, h0 + 0.235));
  }
}

/** Posisi (pinggul) kursi ke-c pada deretan kursi aula. */
export function posisiKursiAula(deret: { readonly x0: number; readonly y: number }, c: number): Titik {
  return [deret.x0 + KURSI.jarak * (c + 0.5), deret.y];
}

// ---------------------------------------------------------------------------
// Ruang tunggu keberangkatan

function ruangTunggu(k: Kumpulan, m: PustakaMaterial): void {
  const R = RUANG_TUNGGU;
  const P = PERON_BERANGKAT;
  const A = ATAP_TUNGGU;
  const h0 = TINGGI_PERON;
  const kaca = { ...tanpaBayangan, urutan: 2 } as const;

  // Lantai: selasar gerbang (lantai peron + ubin pemandu) dan aula granit.
  k.tambah(m.peron, uvDunia(kotak(P.x0, P.y0, P.x1, P.y1, 0, h0), SKALA_UV.peron));
  k.tambah(m.lantaiGranit, uvDunia(kotak(R.x0, R.y0, R.x1, R.y1, 0, h0), SKALA_UV.granit));
  k.tambah(m.kontak, bayanganKontak(P.x0, P.y0, R.x1, R.y1, 0.25, 0.3), tanpaBayangan);
  k.tambah(m.taktil, bidang(P.x0, P.y0 + 0.03, P.x1, P.y0 + 0.16, h0 + 0.003), { bayangan: false });

  // Atap kaca lengkung, rusuk baja putih tiap 1 unit (jatuh di antara gerbang), gording, talang.
  const a0 = R.x0;
  const a1 = R.x1 + 0.2;
  k.tambah(m.kacaAtap, atapLengkung('x', a0, a1, A, { segmen: 16 }), { ...tanpaBayangan, urutan: 3 });
  for (let x = R.x0; x <= R.x1 + 1e-6; x += 1) k.tambah(m.kanopiRangka, rusukBusur('x', x, A, 0.05, -0.075, 0.012, 16));
  k.tambah(m.panel, rusukBusur('x', a1 - 0.03, A, 0.06, -0.1, 0.02, 16));
  for (const t of [0.14, 0.32, 0.5, 0.68, 0.86]) {
    const [b, h] = A.titik(t, -0.035);
    k.tambah(m.kanopiRangka, kotak(a0, b - 0.016, a1, b + 0.016, h - 0.028, h + 0.006));
  }
  for (const t of [0, 1]) {
    const [b, h] = A.titik(t);
    k.tambah(m.panel, kotak(a0, b - 0.06, a1, b + 0.06, h - 0.13, h + 0.01));
  }
  // Tiang di selasar gerbang, segaris rusuk (di tengah antara dua gerbang).
  const yTiang = P.y0 + 0.25;
  for (let x = R.x0; x <= R.x1 + 1e-6; x += 1) k.tambah(m.kanopiRangka, silinder(x, yTiang, h0, A.tinggi(yTiang), 0.035, 0.035, 8));

  // Dinding utara: kaca di antara gerbang, gerbang berbingkai dengan papan JALUR.
  const hU = A.tinggi(R.y0);
  const hGerbang = h0 + 0.62;
  const lebarG = 0.2;
  const urutG = [...GERBANG_X].sort((a, b) => a - b);
  const tepi = [R.x0, ...urutG.flatMap((g) => [g - lebarG, g + lebarG]), R.x1];
  for (let i = 0; i + 1 < tepi.length; i += 2) {
    k.tambah(m.kacaDinding, persegiTegak([tepi[i]!, R.y0], [tepi[i + 1]!, R.y0], h0, hU, PENUH, 0), kaca);
    k.tambah(m.panel, kotak(tepi[i]!, R.y0 - 0.02, tepi[i + 1]!, R.y0 + 0.02, h0, h0 + 0.05));
  }
  for (const g of urutG) k.tambah(m.kacaDinding, persegiTegak([g - lebarG, R.y0], [g + lebarG, R.y0], hGerbang, hU, PENUH, 0), kaca);
  for (let x = R.x0 + 0.5; x < R.x1 - 0.1; x += 0.5) {
    if (urutG.some((g) => Math.abs(x - g) < lebarG + 0.03)) continue;
    k.tambah(m.kanopiRangka, kotak(x - 0.014, R.y0 - 0.014, x + 0.014, R.y0 + 0.014, h0, hU));
  }
  k.tambah(m.kanopiRangka, kotak(R.x0, R.y0 - 0.016, R.x1, R.y0 + 0.016, hGerbang, hGerbang + 0.03));
  const warnaBerangkat = keHexCss(WARNA_TAHAP.keberangkatan);
  GERBANG_X.forEach((g, i) => {
    for (const dx of [-lebarG, lebarG]) k.tambah(m.panel, kotak(g + dx - 0.025, R.y0 - 0.035, g + dx + 0.025, R.y0 + 0.035, h0, hGerbang + 0.03));
    const papan = m.teks(`JALUR ${i + 1}`, { lebar: 256, tinggi: 80, latar: warnaBerangkat, warna: '#ffffff', ukuranHuruf: 48 });
    k.tambah(papan.material, persegiTegak([g - 0.27, R.y0 + 0.035], [g + 0.27, R.y0 + 0.035], hGerbang + 0.05, hGerbang + 0.22, papan.uv, 0.004), { bayangan: false });
    // Tanda lantai kuning di ambang gerbang (sisi peron).
    k.tambah(m.markaKuning, bidang(g - lebarG, P.y1 - 0.12, g + lebarG, P.y1 - 0.02, h0 + 0.004), { bayangan: false });
  });

  // Dinding timur, selatan, dan barat (bagian yang tidak menempel gedung utama): kaca bermullion.
  const hS = A.tinggi(R.y1);
  k.tambah(m.kacaDinding, dindingBusur('x', R.x1, R.y0, R.y1, h0, A, 1), kaca);
  k.tambah(m.kacaDinding, dindingBusur('x', R.x0, R.y0, GEDUNG.y0, h0, A, -1), kaca);
  k.tambah(m.kacaDinding, persegiTegak([R.x0, R.y1], [R.x1, R.y1], h0, hS, PENUH, 0), kaca);
  for (let y = R.y0 + 0.6; y < R.y1 - 0.1; y += 0.6) k.tambah(m.kanopiRangka, kotak(R.x1 - 0.014, y - 0.014, R.x1 + 0.014, y + 0.014, h0, A.tinggi(y)));
  for (let y = R.y0 + 0.6; y < GEDUNG.y0 - 0.1; y += 0.6) k.tambah(m.kanopiRangka, kotak(R.x0 - 0.014, y - 0.014, R.x0 + 0.014, y + 0.014, h0, A.tinggi(y)));
  for (let x = R.x0 + 0.5; x < R.x1 - 0.1; x += 0.5) k.tambah(m.kanopiRangka, kotak(x - 0.014, R.y1 - 0.014, x + 0.014, R.y1 + 0.014, h0, hS));
  for (const [xa, ya, xb, yb] of [
    [R.x1 - 0.02, R.y0, R.x1 + 0.02, R.y1],
    [R.x0, R.y1 - 0.02, R.x1, R.y1 + 0.02],
    [R.x0 - 0.02, R.y0, R.x0 + 0.02, GEDUNG.y0],
  ] as const) {
    k.tambah(m.panel, kotak(xa, ya, xb, yb, h0, h0 + 0.05));
  }
  // Papan nama berdiri di atas talang selatan (menghadap kamera, terbaca dari jauh).
  const cx = (R.x0 + R.x1) / 2;
  const [bTalang, hTalang] = A.titik(1);
  k.tambah(m.panel, kotak(cx - 2.4, bTalang - 0.02, cx + 2.4, bTalang + 0.04, hTalang, hTalang + 0.32));
  for (const dx of [-1.8, 0, 1.8]) k.tambah(m.besiGelap, kotak(cx + dx - 0.02, bTalang - 0.12, cx + dx + 0.02, bTalang - 0.02, hTalang, hTalang + 0.26));
  const papan = m.teks('RUANG TUNGGU KEBERANGKATAN', { lebar: 1024, tinggi: 88, latar: warnaBerangkat, warna: '#ffffff', ukuranHuruf: 56 });
  k.tambah(papan.material, persegiTegak([cx - 2.36, bTalang + 0.04], [cx + 2.36, bTalang + 0.04], hTalang + 0.02, hTalang + 0.3, papan.uv, 0.004), { bayangan: false });
}

/**
 * Deretan kursi tunggu, satu grup per blok (urut BLOK_KURSI) yang ditampilkan
 * sesuai kursi yang dibangun (lihat blokKursiTerpasang): rangka baja, dudukan &
 * sandaran plastik (warna per blok).
 */
export function bangunKursiTunggu(m: PustakaMaterial): THREE.Group[] {
  return BLOK_KURSI.map((_, i) => {
    const k = new Kumpulan();
    kursiTunggu(k, m, i);
    const grup = new THREE.Group();
    k.bangun(grup);
    return grup;
  });
}

function kursiTunggu(k: Kumpulan, m: PustakaMaterial, blok: number): void {
  const h0 = TINGGI_PERON;
  const b = BLOK_KURSI[blok]!;
  const warna = m.kursi[blok % m.kursi.length]!;
  for (let r = 0; r < KURSI.jumlahBaris; r++) {
    const y = KURSI.yBaris0 + r * KURSI.jarakBaris;
    k.tambah(m.besiGelap, kotak(b.x0 + 0.02, y - 0.012, b.x1 - 0.02, y + 0.012, h0 + 0.05, h0 + 0.068));
    for (const x of [b.x0 + 0.1, (b.x0 + b.x1) / 2, b.x1 - 0.1]) k.tambah(m.besiGelap, kotak(x - 0.012, y - 0.05, x + 0.012, y + 0.05, h0, h0 + 0.055));
    for (let c = 0; c < KURSI.perBaris; c++) {
      const x = b.x0 + KURSI.jarak * (c + 0.5);
      k.tambah(warna, kotak(x - 0.072, y - 0.065, x + 0.072, y + 0.045, h0 + 0.075, h0 + 0.095));
      k.tambah(warna, kotak(x - 0.072, y + 0.05, x + 0.072, y + 0.072, h0 + 0.1, h0 + 0.235));
    }
  }
}

/** Isi aula: kios di dinding barat, meja makan, papan jadwal, pot tanaman, tempat sampah. */
function isiRuangTunggu(k: Kumpulan, m: PustakaMaterial): void {
  const R = RUANG_TUNGGU;
  const h0 = TINGGI_PERON;
  // Kios menghadap timur (ke kamera): lemari belakang, etalase, papan nama.
  const nama = ['KOPI', 'ROTI & KUE', 'OLEH-OLEH'];
  KIOS_TUNGGU.forEach(([ya, yb], i) => {
    k.tambah(m.plester, uvDunia(kotak(R.x0 + 0.04, ya, R.x0 + 0.2, yb, h0, h0 + 0.56), SKALA_UV.plester));
    k.tambah(m.kios[i % m.kios.length]!, uvDunia(kotak(R.x0 + 0.58, ya, R.x0 + 0.76, yb, h0, h0 + 0.3), SKALA_UV.plester));
    k.tambah(m.kaca, kotak(R.x0 + 0.6, ya + 0.05, R.x0 + 0.74, yb - 0.05, h0 + 0.3, h0 + 0.36));
    for (const y of [ya + 0.02, yb - 0.02]) k.tambah(m.panel, kotak(R.x0 + 0.72, y - 0.015, R.x0 + 0.76, y + 0.015, h0, h0 + 0.62));
    k.tambah(m.panel, kotak(R.x0 + 0.72, ya, R.x0 + 0.76, yb, h0 + 0.5, h0 + 0.64));
    const papan = m.teks(nama[i]!, { lebar: 256, tinggi: 72, latar: '#7c2d12', warna: '#fff7ed', ukuranHuruf: 40 });
    k.tambah(papan.material, persegiTegak([R.x0 + 0.76, yb - 0.05], [R.x0 + 0.76, ya + 0.05], h0 + 0.51, h0 + 0.63, papan.uv, 0.004), { bayangan: false });
  });
  // Meja makan bundar berkursi di belakang ruang tunggu.
  for (const x of MEJA_TUNGGU) {
    const y = Y_MEJA_TUNGGU;
    k.tambah(m.panel, silinder(x, y, h0 + 0.16, h0 + 0.175, 0.13, 0.13, 14));
    k.tambah(m.besiGelap, silinder(x, y, h0, h0 + 0.16, 0.015, 0.015, 6));
    for (const [dx, dy] of [
      [-0.2, 0],
      [0.2, 0],
      [0, -0.2],
    ] as const) {
      k.tambah(m.kursi[1]!, silinder(x + dx, y + dy, h0 + 0.08, h0 + 0.095, 0.05, 0.05, 10));
      k.tambah(m.besiGelap, silinder(x + dx, y + dy, h0, h0 + 0.08, 0.01, 0.01, 5));
    }
  }
  // Papan jadwal digital di zona gerbang dipasang lewat modernisasi (modernisasi3d.ts).
  // Pot tanaman & tempat sampah.
  for (const [x, y] of [
    [R.x1 - 0.25, R.y1 - 0.25],
    [R.x1 - 0.25, R.y0 + 1.1],
    [BLOK_KURSI[0]!.x0 - 0.3, 10.1],
    [BLOK_KURSI[BLOK_KURSI.length - 1]!.x1 + 0.3, 10.1],
    [R.x0 + 0.3, R.y1 - 0.25],
  ] as const) {
    k.tambah(m.plesterGelap, silinder(x, y, h0, h0 + 0.12, 0.07, 0.055, 10));
    const daun = new THREE.IcosahedronGeometry(0.13, 1);
    daun.scale(1, 1.25, 1);
    daun.translate(x, h0 + 0.27, y);
    k.tambah(m.semak, daun);
  }
  for (const b of BLOK_KURSI) {
    for (const x of [b.x0 - 0.12, b.x1 + 0.12]) k.tambah(m.hijauGelap, silinder(x, KURSI.yBaris0 - 0.1, h0, h0 + 0.15, 0.04, 0.045, 10));
  }
}

/** Meja makan di bagian belakang ruang tunggu (di luar lintasan dari pintu gedung). */
export const MEJA_TUNGGU: readonly number[] = Array.from({ length: 9 }, (_, i) => RUANG_TUNGGU.x0 + 2.26 + i * 1.5).filter((x) => x < RUANG_TUNGGU.x1 - 1.2);
export const Y_MEJA_TUNGGU = 11.95;

// ---------------------------------------------------------------------------
// Peron kedatangan

function kanopiKedatangan(k: Kumpulan, m: PustakaMaterial): void {
  const A = ATAP_DATANG;
  const a0 = PERON.x0 - 0.1;
  const a1 = PERON.x1 + 0.1;
  k.tambah(m.kanopi.peron, atapLengkung('x', a0, a1, A, { segmen: 10 }), { ...tanpaBayangan, urutan: 2 });
  // Tiang di sela slot tunggu penumpang supaya tidak menembus orang.
  const kolom = KOLOM_KANOPI_DATANG;
  for (const x of [a0 + 0.03, ...kolom, a1 - 0.03]) k.tambah(m.kanopiRangka, rusukBusur('x', x, A, 0.045, -0.06, 0.012, 10));
  for (const t of [0, 1]) {
    const [b, h] = A.titik(t);
    k.tambah(m.kanopiRangka, kotak(a0, b - 0.035, a1, b + 0.035, h - 0.08, h + 0.005));
  }
  for (const t of [0.3, 0.5, 0.7]) {
    const [b, h] = A.titik(t, -0.03);
    k.tambah(m.kanopiRangka, kotak(a0, b - 0.014, a1, b + 0.014, h - 0.024, h + 0.004));
  }
  for (const x of kolom) for (const y of [5.72, 7.1]) k.tambah(m.kanopiRangka, silinder(x, y, TINGGI_PERON, A.tinggi(y), 0.03, 0.03, 8));
  const cx = (PERON.x0 + PERON.x1) / 2;
  const papan = m.teks('KEDATANGAN', { lebar: 1024, tinggi: 96, latar: keHexCss(WARNA_TAHAP.peron), warna: '#ffffff', ukuranHuruf: 62 });
  k.tambah(papan.material, persegiTegak([cx - 1.7, A.b1 + 0.035], [cx + 1.7, A.b1 + 0.035], A.hTepi - 0.28, A.hTepi - 0.08, papan.uv, 0.004), { bayangan: false });
}
