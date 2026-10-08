/**
 * Lingkungan di sekitar kompleks terminal supaya terasa berada di tengah kota:
 * jalan lingkungan dua arah di belakang terminal, pagar kompleks, parkir mobil
 * & motor, deretan ruko, kampung beratap genteng, SPBU, tiang listrik berkabel.
 */
import * as THREE from 'three';
import { acakBerbenih } from './dunia-visual';
import { atapLimas, bayanganKontak, bidang, kotak, persegiTegak, silinder, uvDunia, type Kumpulan } from './geometri';
import { SKALA_UV, type PustakaMaterial } from './material3d';
import { geometriMobil, geometriMotor, kendaraanDiwarnai, WARNA_BAJU, WARNA_MOBIL } from './mobil3d';
import { GANG_RUKO, GERBANG_KELUAR_X, GERBANG_MASUK_X, JALAN_DALAM, LEBAR_GERBANG_PAGAR, RUANG_TUNGGU, Y_PAGAR } from './tata-letak';

/** Jalan lingkungan di belakang terminal (y) dan lajurnya (dipakai lalu lintas dekoratif). */
export const JALAN_BELAKANG = { y0: 20.4, y1: 21.8, lajurTimur: 20.75, lajurBarat: 21.45, x0: -60, x1: 100 } as const;

const PENUH = { u0: 0, v0: 0, u1: 1, v1: 1 } as const;

/**
 * @param parkirBaris2 tempat mobil di baris kedua parkir mobil (dibangun di tahap
 *   perluasan 2; pemanggil menampilkannya setelah tahap itu selesai)
 */
export function bangunSekitar(k: Kumpulan, m: PustakaMaterial, garisListrik: THREE.Object3D, parkirBaris2: Kumpulan = k): void {
  jalanBelakang(k, m);
  pagarKompleks(k, m);
  parkir(k, m, parkirBaris2);
  ruko(k, m);
  kampung(k, m);
  spbu(k, m);
  tiangListrik(k, m, garisListrik);
}

function jalanBelakang(k: Kumpulan, m: PustakaMaterial): void {
  const J = JALAN_BELAKANG;
  k.tambah(m.aspal, uvDunia(bidang(J.x0, J.y0, J.x1, J.y1, 0.02), SKALA_UV.aspal), { bayangan: false });
  const tengah = (J.y0 + J.y1) / 2;
  for (let x = J.x0; x < J.x1; x += 1.2) k.tambah(m.marka, bidang(x, tengah - 0.025, x + 0.55, tengah + 0.025, 0.026), { bayangan: false });
  for (const [a, b] of [
    [19.95, J.y0],
    [J.y1, 22.3],
  ] as const) {
    k.tambah(m.beton, uvDunia(kotak(J.x0, a, J.x1, b, 0, 0.035), SKALA_UV.beton), { bayangan: false });
  }
}

/**
 * Pagar kompleks (tembok rendah + jeruji besi) dengan dua gerbang pejalan kaki
 * bergapura: KELUAR (penumpang turun pulang) dan MASUK (calon penumpang), masing-
 * masing tersambung jalan paving lewat gang di sela ruko ke trotoar.
 */
function pagarKompleks(k: Kumpulan, m: PustakaMaterial): void {
  const [x0, x1] = [JALAN_DALAM.x0 - 0.4, RUANG_TUNGGU.x1 + 0.5];
  const y = Y_PAGAR;
  const w = LEBAR_GERBANG_PAGAR / 2;
  const celah = [GERBANG_KELUAR_X, GERBANG_MASUK_X].sort((a, b) => a - b).map((g): [number, number] => [g - w, g + w]);
  const ruas: [number, number][] = [];
  let mulai = x0;
  for (const [a, b] of celah) {
    ruas.push([mulai, a]);
    mulai = b;
  }
  ruas.push([mulai, x1]);
  for (const [a, b] of ruas) {
    k.tambah(m.plester, uvDunia(kotak(a, y - 0.05, b, y + 0.05, 0, 0.14), SKALA_UV.plester));
    for (let x = a; x < b; x += 0.25) k.tambah(m.besiGelap, kotak(x - 0.008, y - 0.008, x + 0.008, y + 0.008, 0.14, 0.28), { bayangan: false });
    k.tambah(m.besiGelap, kotak(a, y - 0.01, b, y + 0.01, 0.27, 0.29));
  }
  for (let x = x0; x <= x1; x += 2.05) {
    if (celah.some(([a, b]) => x > a - 0.2 && x < b + 0.2)) continue;
    k.tambah(m.plesterGelap, uvDunia(kotak(x - 0.07, y - 0.07, x + 0.07, y + 0.07, 0, 0.3), SKALA_UV.plester));
  }
  gerbangPagar(k, m, GERBANG_KELUAR_X, 'PINTU KELUAR', '#15803d');
  gerbangPagar(k, m, GERBANG_MASUK_X, 'PINTU MASUK', '#1d4ed8');
}

/** Gapura gerbang pejalan kaki di pagar + jalan paving dari halaman terminal lewat gang ke trotoar. */
function gerbangPagar(k: Kumpulan, m: PustakaMaterial, x: number, tulisan: string, warna: string): void {
  const y = Y_PAGAR;
  const w = LEBAR_GERBANG_PAGAR / 2;
  for (const dx of [-w - 0.06, w + 0.06]) k.tambah(m.plesterGelap, uvDunia(kotak(x + dx - 0.07, y - 0.07, x + dx + 0.07, y + 0.07, 0, 0.72), SKALA_UV.plester));
  k.tambah(m.plesterGelap, uvDunia(kotak(x - w - 0.13, y - 0.07, x + w + 0.13, y + 0.07, 0.62, 0.76), SKALA_UV.plester));
  const papan = m.teks(tulisan, { lebar: 512, tinggi: 96, latar: warna, warna: '#ffffff', ukuranHuruf: 54 });
  k.tambah(papan.material, persegiTegak([x - w, y + 0.07], [x + w, y + 0.07], 0.63, 0.75, papan.uv, 0.004), { bayangan: false });
  k.tambah(m.pavingGang, uvDunia(bidang(x - w - 0.05, 17.55, x + w + 0.05, 19.96, 0.016), SKALA_UV.paving), { bayangan: false });
}

function parkir(k: Kumpulan, m: PustakaMaterial, baris2: Kumpulan): void {
  const acak = acakBerbenih(61);
  const mobil = geometriMobil();
  const motor = geometriMotor();
  // Dua baris petak mobil (menghadap ke utara/selatan bergantian); mobil baris kedua di kumpulan sendiri.
  for (const [yBaris, sudut, kMobil] of [
    [14.95, Math.PI / 2, k],
    [16.75, -Math.PI / 2, baris2],
  ] as const) {
    for (let i = 0; i < 30; i++) {
      const x = 30.8 + i * 0.52;
      if (x > RUANG_TUNGGU.x1 - 0.2) break;
      k.tambah(m.marka, bidang(x - 0.26, yBaris - 0.5, x - 0.235, yBaris + 0.5, 0.026), { bayangan: false });
      if (acak() < 0.72) {
        kMobil.tambah(m.kendaraan, kendaraanDiwarnai(mobil, WARNA_MOBIL[Math.floor(acak() * WARNA_MOBIL.length)]!, x, yBaris, sudut));
        kMobil.tambah(m.kontak, bayanganKontak(x - 0.17, yBaris - 0.44, x + 0.17, yBaris + 0.44, 0.12, 0.4, 0.03), { bayangan: false, terimaBayangan: false });
      }
    }
  }
  // Deret motor.
  for (let x = 31.2; x < RUANG_TUNGGU.x1 - 0.4; x += 0.2) {
    if (acak() < 0.25) continue;
    const g = kendaraanDiwarnai(motor, WARNA_BAJU[Math.floor(acak() * WARNA_BAJU.length)]!, x, 13.95, Math.PI / 2 + (acak() - 0.5) * 0.3);
    // Motor parkir tanpa pengendara: buang badan atas (y > 0.13).
    const pos = g.getAttribute('position');
    for (let i = 0; i < pos.count; i++) if (pos.getY(i) > 0.15) pos.setY(i, 0.13);
    k.tambah(m.kendaraan, g);
  }
}

const PAPAN_RUKO = ['TOKO SEMBAKO', 'RM PADANG', 'APOTEK', 'BENGKEL MOTOR', 'LAUNDRY', 'KONTER HP', 'TOKO BANGUNAN', 'WARKOP', 'FOTOKOPI', 'BAKSO', 'ATK', 'MINIMARKET'];
const WARNA_PAPAN = ['#b91c1c', '#1d4ed8', '#15803d', '#a16207', '#7c3aed', '#0e7490'];

/** Ruko dua lantai berjajar di utara jalan belakang, menghadap ke jalan (+y, terlihat kamera). */
function ruko(k: Kumpulan, m: PustakaMaterial): void {
  const acak = acakBerbenih(67);
  let papan = 0;
  for (let x = -42; x < 70; ) {
    const jumlah = 3 + Math.floor(acak() * 4);
    const lebar = 1.05;
    for (let i = 0; i < jumlah; i++) {
      const x0 = x + i * lebar;
      const x1 = x0 + lebar - 0.02;
      // Gang menuju gerbang pagar terminal dibiarkan kosong.
      if (GANG_RUKO.some(([a, b]) => x1 > a && x0 < b)) continue;
      const [y0, y1] = [18.45, 19.95];
      const tinggi = 0.95 + (acak() < 0.3 ? 0.4 : 0);
      const dinding = m.rukoDinding[Math.floor(acak() * m.rukoDinding.length)]!;
      k.tambah(dinding, uvDunia(kotak(x0, y0, x1, y1, 0, tinggi), SKALA_UV.plester));
      k.tambah(m.kontak, bayanganKontak(x0, y0, x1, y1, 0.3, 0.3), { bayangan: false, terimaBayangan: false });
      k.tambah(m.atapKota, uvDunia(kotak(x0 - 0.02, y0 - 0.02, x1 + 0.02, y1 + 0.02, tinggi, tinggi + 0.05), SKALA_UV.beton));
      // Lantai dasar: rolling door / etalase gelap; lantai atas: jendela.
      k.tambah(m.besiGelap, persegiTegak([x0 + 0.08, y1], [x1 - 0.08, y1], 0.02, 0.36, PENUH));
      k.tambah(m.kaca, persegiTegak([x0 + 0.2, y1], [x1 - 0.2, y1], 0.56, 0.8, PENUH));
      // Kanopi & papan nama.
      k.tambah(m.hijauGelap, kotak(x0, y1, x1, y1 + 0.32, 0.4, 0.44));
      const teks = PAPAN_RUKO[papan++ % PAPAN_RUKO.length]!;
      const mat = m.teks(teks, { lebar: 256, tinggi: 64, latar: WARNA_PAPAN[papan % WARNA_PAPAN.length]!, warna: '#ffffff', ukuranHuruf: 30 });
      k.tambah(mat.material, persegiTegak([x0 + 0.04, y1 + 0.32], [x1 - 0.04, y1 + 0.32], 0.44, 0.55, mat.uv, 0.01), { bayangan: false });
    }
    x += jumlah * lebar + 0.9 + acak() * 1.5;
  }
}

/** Rumah kampung: dinding plester berwarna, atap limas genteng, pohon di sela-sela. */
function rumah(k: Kumpulan, m: PustakaMaterial, x: number, y: number, acak: () => number): void {
  const w = 1.0 + acak() * 0.5;
  const d = 0.9 + acak() * 0.4;
  const tinggi = acak() < 0.18 ? 0.85 : 0.45 + acak() * 0.1;
  const dinding = m.rukoDinding[Math.floor(acak() * m.rukoDinding.length)]!;
  k.tambah(dinding, uvDunia(kotak(x, y, x + w, y + d, 0, tinggi), SKALA_UV.plester));
  k.tambah(m.kontak, bayanganKontak(x, y, x + w, y + d, 0.28, 0.3), { bayangan: false, terimaBayangan: false });
  k.tambah(m.besiGelap, persegiTegak([x + w * 0.6, y + d], [x + w * 0.78, y + d], 0.0, 0.3, PENUH));
  k.tambah(m.kaca, persegiTegak([x + w * 0.15, y + d], [x + w * 0.45, y + d], 0.17, 0.33, PENUH));
  const atap = m.atapRumah[Math.floor(acak() * m.atapRumah.length)]!;
  // Bubungan sejajar sisi terpanjang: bangun di titik asal sepanjang x, lalu putar 90° bila perlu.
  const sejajarX = w >= d;
  const [pj, lb] = sejajarX ? [w + 0.2, d + 0.2] : [d + 0.2, w + 0.2];
  const g = atapLimas(-pj / 2, -lb / 2, pj / 2, lb / 2, tinggi, tinggi + 0.38, SKALA_UV.genteng);
  if (!sejajarX) g.rotateY(Math.PI / 2);
  g.translate(x + w / 2, 0, y + d / 2);
  k.tambah(atap, g);
}

function pohonKecil(k: Kumpulan, m: PustakaMaterial, x: number, y: number, acak: () => number): void {
  const s = 0.7 + acak() * 0.5;
  k.tambah(m.batang, silinder(x, y, 0, 0.45 * s, 0.045 * s, 0.035 * s, 5));
  const g = new THREE.IcosahedronGeometry(0.42 * s, 1);
  g.scale(1, 0.85, 1);
  g.translate(x, 0.75 * s, y);
  const pos = g.getAttribute('position');
  const warna = new Float32Array(pos.count * 3);
  const c = new THREE.Color().setHSL(0.25 + acak() * 0.07, 0.42, 0.24 + acak() * 0.08);
  for (let i = 0; i < pos.count; i++) {
    const t = 0.8 + (pos.getY(i) - 0.75 * s) * 0.6;
    warna[i * 3] = c.r * t;
    warna[i * 3 + 1] = c.g * t;
    warna[i * 3 + 2] = c.b * t;
  }
  g.setAttribute('color', new THREE.BufferAttribute(warna, 3));
  k.tambah(m.daun, g);
}

function kampung(k: Kumpulan, m: PustakaMaterial): void {
  const acak = acakBerbenih(71);
  // Selatan jalan belakang, di balik deret ruko.
  for (let y = 23.2; y < 37; y += 1.75) {
    for (let x = -46; x < 74; x += 1.9) {
      const r = acak();
      const px = x + (acak() - 0.5) * 0.3;
      const py = y + (acak() - 0.5) * 0.25;
      if (r < 0.14) pohonKecil(k, m, px + 0.6, py + 0.5, acak);
      else if (r < 0.2) continue;
      else rumah(k, m, px, py, acak);
    }
  }
  // Barat terminal (di balik taman kedatangan) dan timur (di balik SPBU).
  for (const [xa, xb, ya, yb] of [
    [-44, JALAN_DALAM.x0 - 1.4, 6.0, 17.8],
    [65.5, 78, 4.0, 17.8],
  ] as const) {
    for (let y = ya; y < yb; y += 1.8) {
      for (let x = xa; x < xb; x += 1.95) {
        const r = acak();
        if (r < 0.3) pohonKecil(k, m, x + 0.5, y + 0.5, acak);
        else if (r < 0.36) continue;
        else rumah(k, m, x, y, acak);
      }
    }
  }
  // Pohon peneduh di trotoar jalan belakang.
  for (let x = -44; x < 72; x += 3.2) pohonKecil(k, m, x + acak() * 0.4, 22.1, acak);
}

function spbu(k: Kumpulan, m: PustakaMaterial): void {
  const [x0, y0, x1, y1] = [58.3, 6.3, 63.3, 10.4];
  k.tambah(m.beton, uvDunia(bidang(x0 - 0.5, 3.4, x1 + 0.5, y1 + 1.6, 0.014), SKALA_UV.beton), { bayangan: false });
  for (const x of [x0 + 0.6, x1 - 0.6]) for (const y of [y0 + 0.6, y1 - 0.6]) k.tambah(m.plester, silinder(x, y, 0, 0.9, 0.07, 0.07, 10));
  k.tambah(m.plester, uvDunia(kotak(x0, y0, x1, y1, 0.9, 1.05), SKALA_UV.plester));
  k.tambah(m.merahSpbu, kotak(x0 - 0.01, y0 - 0.01, x1 + 0.01, y1 + 0.01, 0.9, 0.97));
  for (const y of [y0 + 1.3, y1 - 1.3]) {
    k.tambah(m.beton, uvDunia(kotak(x0 + 1.0, y - 0.18, x1 - 1.0, y + 0.18, 0, 0.06), SKALA_UV.beton));
    for (const x of [x0 + 1.6, x1 - 1.6]) {
      k.tambah(m.plester, kotak(x - 0.12, y - 0.08, x + 0.12, y + 0.08, 0.06, 0.4));
      k.tambah(m.merahSpbu, kotak(x - 0.125, y - 0.085, x + 0.125, y + 0.085, 0.32, 0.4));
    }
  }
  // Toko & menara harga.
  k.tambah(m.plester, uvDunia(kotak(x0 + 0.5, y1 + 0.3, x1 - 0.5, y1 + 1.4, 0, 0.55), SKALA_UV.plester));
  k.tambah(m.kaca, persegiTegak([x0 + 0.8, y1 + 1.4], [x1 - 0.8, y1 + 1.4], 0.08, 0.42, PENUH));
  k.tambah(m.besiGelap, silinder(x0 - 0.2, 4.2, 0, 1.4, 0.05, 0.05, 8));
  k.tambah(m.merahSpbu, kotak(x0 - 0.5, 4.17, x0 + 0.1, 4.23, 1.0, 1.75));
  const papan = m.teks('SPBU', { lebar: 256, tinggi: 96, latar: '#dc2626', warna: '#ffffff', ukuranHuruf: 64 });
  k.tambah(papan.material, persegiTegak([x0 - 0.48, 4.235], [x0 + 0.08, 4.235], 1.45, 1.72, papan.uv, 0.002), { bayangan: false });
}

/** Tiang listrik beton dengan kabel melengkung (garis tipis) di sepanjang jalan belakang. */
function tiangListrik(k: Kumpulan, m: PustakaMaterial, garis: THREE.Object3D): void {
  const y = 22.05;
  const tinggi = 1.6;
  const tiang: number[] = [];
  for (let x = -48; x <= 76; x += 4.2) tiang.push(x);
  for (const x of tiang) {
    k.tambah(m.beton, silinder(x, y, 0, tinggi, 0.035, 0.025, 6));
    k.tambah(m.besiGelap, kotak(x - 0.02, y - 0.22, x + 0.02, y + 0.22, tinggi - 0.1, tinggi - 0.07));
  }
  const titik: number[] = [];
  for (let i = 1; i < tiang.length; i++) {
    for (const dz of [-0.2, 0, 0.2]) {
      const a = tiang[i - 1]!;
      const b = tiang[i]!;
      const n = 8;
      for (let s = 0; s < n; s++) {
        for (const t of [s / n, (s + 1) / n]) {
          const kendur = 4 * t * (1 - t) * 0.12;
          titik.push(a + (b - a) * t, tinggi - 0.08 - kendur, y + dz);
        }
      }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(titik, 3));
  garis.add(new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: 0x1f2328, transparent: true, opacity: 0.7 })));
}
