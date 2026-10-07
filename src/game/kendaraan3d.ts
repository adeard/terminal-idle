/**
 * Armada bus 3D. Semua badan kendaraan satu InstancedMesh (satu draw call):
 * profil berujung atap melengkung yang di-scale per tipe, dengan UV per instans
 * menunjuk sel livery di lembar bus (lembar-bus.ts). Bus terminal yang datang
 * memakai salah satu kelas bus yang beroperasi (aturKelasBus: ukuran badan &
 * gambar sampingnya, lihat kelas-bus.ts) dan livery bawaan atau livery mitra
 * PO yang sudah bergabung (aturPo). Tambahan per instans: roda 3D berputar,
 * pintu bagasi yang diangkat di halte (dengan barang di sampingnya), pintu
 * depan berengsel yang terbuka di halte, lampu rem & sein, dan bayangan kolong
 * lembut di aspal.
 */
import * as THREE from 'three';
import { KELAS_BUS_IDS, type KelasBusId, type PoId } from '../sim/fitur';
import { BUS_TERMINAL, KENDARAAN_LEWAT, type TipeKendaraan } from './aset';
import { busDiHalte, petugasDiPintu, tingkatKotor, type BusVisual } from './dunia-visual';
import { LENGKUNG, pilihKelasBus, RODA_BUS, TAMPIL_KELAS_BUS } from './kelas-bus';
import { LembarBus, R, SEL, type LiveryBus } from './lembar-bus';
import { pilihLivery } from './livery';
import { BAGASI, BUS, PINTU_BUS } from './tata-letak';

/** Bus Emas: tipe bus kuning terminal dengan rona emas (warna > 1 supaya sedikit berkilau). */
const BUS_EMAS = BUS_TERMINAL.find((t) => t.frame === 'bus/kuning-1') ?? BUS_TERMINAL[0]!;
const WARNA_EMAS = new THREE.Color(1.25, 0.95, 0.45);

const KAPASITAS = 64;
/** Lampu per bus paling banyak: rem 2 + sein 2 + depan 2 + belakang 2. */
const MAKS_LAMPU = KAPASITAS * 8;
const PINTU = { lebar: 0.2, tinggi: 0.7, sudutBuka: 1.35 } as const;

// ---------------------------------------------------------------------------
// Geometri badan

/** Titik profil (z, y) berlawanan jarum jam: sisi kanan naik → atap → sisi kiri turun. */
function profilBadan(): [number, number][] {
  const { z: rz, y: ry, segmen } = LENGKUNG;
  const t: [number, number][] = [
    [0.5, 0],
    [0.5, 1 - ry],
  ];
  for (let i = 1; i <= segmen; i++) {
    const a = (i / segmen) * (Math.PI / 2);
    t.push([0.5 - rz + Math.cos(a) * rz, 1 - ry + Math.sin(a) * ry]);
  }
  t.push([-(0.5 - rz), 1]);
  for (let i = 1; i <= segmen; i++) {
    const a = Math.PI / 2 + (i / segmen) * (Math.PI / 2);
    t.push([-(0.5 - rz) + Math.cos(a) * rz, 1 - ry + Math.sin(a) * ry]);
  }
  t.push([-0.5, 0]);
  return t;
}

/** UV sel (0..1, v ke atas) untuk titik (px, py) di kanvas sel. */
const uvSel = (px: number, py: number): [number, number] => [px / SEL.w, 1 - py / SEL.h];

/**
 * Badan satuan: x −0,5..0,5 (belakang→depan), y 0..1, z −0,5..0,5 (kiri→kanan).
 * Sisi kanan/kiri memakai gambar samping (bagian lengkung = pita atap gambar),
 * bagian datar atas = sel atap, tutup depan/belakang = sel depan/belakang.
 */
export function geometriBadanBus(): THREE.BufferGeometry {
  const prof = profilBadan();
  const pos: number[] = [];
  const nor: number[] = [];
  const uv: number[] = [];
  const idx: number[] = [];
  const tambahVerteks = (x: number, y: number, z: number, n: readonly number[], t: [number, number]): number => {
    pos.push(x, y, z);
    nor.push(n[0]!, n[1]!, n[2]!);
    uv.push(t[0], t[1]);
    return pos.length / 3 - 1;
  };

  // Panjang lintasan sisi kanan (dari bawah ke puncak lengkung) untuk v gambar samping.
  const indeksPuncakKanan = 1 + LENGKUNG.segmen; // titik terakhir lengkung kanan
  const indeksAwalKiri = indeksPuncakKanan + 1; // awal lengkung kiri (di atap)
  const panjangKe: number[] = [0];
  for (let i = 1; i < prof.length; i++) panjangKe.push(panjangKe[i - 1]! + Math.hypot(prof[i]![0] - prof[i - 1]![0], prof[i]![1] - prof[i - 1]![1]));
  const panjangKanan = panjangKe[indeksPuncakKanan]!;
  const panjangKiri = panjangKe[prof.length - 1]! - panjangKe[indeksAwalKiri]!;

  const [kx, ky, kw, kh] = R.kanan;
  const [lx, ly, lw, lh] = R.kiri;
  const [ax, ay, aw, ah] = R.atap;
  const uvTitik = (seg: 'kanan' | 'atap' | 'kiri', i: number, x: number): [number, number] => {
    const z = prof[i]![0];
    if (seg === 'kanan') {
      const v = panjangKe[i]! / panjangKanan; // 0 = bawah gambar, 1 = atas
      return uvSel(kx + (x + 0.5) * kw, ky + kh - v * kh);
    }
    if (seg === 'kiri') {
      const v = (panjangKe[prof.length - 1]! - panjangKe[i]!) / panjangKiri;
      return uvSel(lx + (0.5 - x) * lw, ly + lh - v * lh);
    }
    const t = (0.5 - LENGKUNG.z - z) / (1 - 2 * LENGKUNG.z); // 0 = tepi kanan atap, 1 = kiri
    return uvSel(ax + (x + 0.5) * aw, ay + ah - t * ah);
  };

  for (let i = 0; i < prof.length - 1; i++) {
    const [z0, y0] = prof[i]!;
    const [z1, y1] = prof[i + 1]!;
    const dz = z1 - z0;
    const dy = y1 - y0;
    const d = Math.hypot(dz, dy);
    const n = [0, -dz / d, dy / d]; // normal keluar (profil berlawanan jarum jam)
    const seg = i < indeksPuncakKanan ? 'kanan' : i < indeksAwalKiri ? 'atap' : 'kiri';
    const a = tambahVerteks(-0.5, y0, z0, n, uvTitik(seg, i, -0.5));
    const b = tambahVerteks(0.5, y0, z0, n, uvTitik(seg, i, 0.5));
    const c = tambahVerteks(0.5, y1, z1, n, uvTitik(seg, i + 1, 0.5));
    const e = tambahVerteks(-0.5, y1, z1, n, uvTitik(seg, i + 1, -0.5));
    idx.push(a, b, c, a, c, e);
  }

  // Tutup depan (+x) & belakang (−x): kipas dari titik tengah profil.
  const tutup = (x: number, r: readonly [number, number, number, number], depan: boolean): void => {
    const [rx, ry, rw, rh] = r;
    const uvTutup = (z: number, y: number): [number, number] => uvSel(rx + (depan ? 0.5 - z : z + 0.5) * rw, ry + rh - y * rh);
    const n = [depan ? 1 : -1, 0, 0];
    const pusat = tambahVerteks(x, 0.5, 0, n, uvTutup(0, 0.5));
    const cincin = prof.map(([z, y]) => tambahVerteks(x, y, z, n, uvTutup(z, y)));
    for (let i = 0; i < cincin.length; i++) {
      const p = cincin[i]!;
      const q = cincin[(i + 1) % cincin.length]!;
      // Dilihat dari +x, sumbu z tercermin: lilitan dibalik untuk tutup depan.
      if (depan) idx.push(pusat, q, p);
      else idx.push(pusat, p, q);
    }
  };
  tutup(0.5, R.depan, true);
  tutup(-0.5, R.belakang, false);

  // Spion: balok kecil di sudut depan atas, UV ke area kaca depan (gelap).
  const uvKaca = uvSel(R.depan[0] + R.depan[2] * 0.5, R.depan[1] + R.depan[3] * 0.45);
  for (const zs of [-1, 1]) {
    const g = new THREE.BoxGeometry(0.02, 0.08, 0.05);
    g.translate(0.49, 0.74, zs * 0.53);
    const gp = g.getAttribute('position');
    const gn = g.getAttribute('normal');
    const o = pos.length / 3;
    for (let i = 0; i < gp.count; i++) tambahVerteks(gp.getX(i), gp.getY(i), gp.getZ(i), [gn.getX(i), gn.getY(i), gn.getZ(i)], uvKaca);
    const gi = g.getIndex()!;
    for (let i = 0; i < gi.count; i++) idx.push(o + gi.getX(i));
    g.dispose();
  }

  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  return g;
}

/** Roda satuan (jari-jari 1, lebar 1, poros sumbu z): ban gelap + palang velg terang supaya putarannya terlihat. */
function geometriRoda(): THREE.BufferGeometry {
  const bagian: THREE.BufferGeometry[] = [];
  const warnai = (g: THREE.BufferGeometry, c: THREE.Color): THREE.BufferGeometry => {
    const nd = g.index ? g.toNonIndexed() : g;
    const w = new Float32Array(nd.getAttribute('position').count * 3);
    for (let i = 0; i < w.length; i += 3) {
      w[i] = c.r;
      w[i + 1] = c.g;
      w[i + 2] = c.b;
    }
    nd.setAttribute('color', new THREE.BufferAttribute(w, 3));
    nd.deleteAttribute('uv');
    return nd;
  };
  const ban = new THREE.CylinderGeometry(1, 1, 1, 16);
  ban.rotateX(Math.PI / 2);
  bagian.push(warnai(ban, new THREE.Color(0.06, 0.06, 0.07)));
  const velg = new THREE.CylinderGeometry(0.62, 0.62, 1.04, 12);
  velg.rotateX(Math.PI / 2);
  bagian.push(warnai(velg, new THREE.Color(0.55, 0.57, 0.6)));
  for (const a of [0, Math.PI / 3, (2 * Math.PI) / 3]) {
    const palang = new THREE.BoxGeometry(1.1, 0.16, 1.08);
    palang.rotateZ(a);
    bagian.push(warnai(palang, new THREE.Color(0.2, 0.21, 0.23)));
  }
  const pos: number[] = [];
  const nor: number[] = [];
  const col: number[] = [];
  for (const g of bagian) {
    pos.push(...(g.getAttribute('position').array as Float32Array));
    nor.push(...(g.getAttribute('normal').array as Float32Array));
    col.push(...(g.getAttribute('color').array as Float32Array));
    g.dispose();
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  return g;
}

/** Bayangan kolong: persegi hitam dengan tepi kabur (dipakai juga untuk mobil). */
export function teksturKolong(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 64;
  const ctx = c.getContext('2d')!;
  ctx.filter = 'blur(9px)';
  ctx.fillStyle = 'rgba(0,0,0,0.9)';
  ctx.fillRect(22, 18, 84, 28);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// ---------------------------------------------------------------------------

/** Ukuran badan, roda, dan pintu satu bus (tipe kendaraan tanpa frame atlas). */
type BentukBus = Omit<TipeKendaraan, 'frame'>;

/** Yang digambar untuk satu bus: bentuknya dan slot selnya di lembar. */
interface TipeTampil {
  readonly tipe: BentukBus;
  readonly slot: number;
  /** Sel bus terminal (dilepas saat bus pergi); bus lewat & Bus Emas memakai sel tetap. */
  readonly terminal: boolean;
}

interface StatusBus {
  /** Kelas & livery dipilih sekali saat bus muncul (tidak berganti walau kelas/PO baru bergabung). */
  readonly tampil: TipeTampil;
  vLalu: number;
  sudutLalu: number;
  rem: number;
  sein: number;
  seinSisa: number;
  angguk: number;
  roda: number;
  pintu: number;
  bagasi: number;
}

/** Barang di samping pintu bagasi yang terbuka: [geser sepanjang bus, jarak dari sisi, lebar, tinggi, tebal]. */
const BARANG_BAGASI: readonly (readonly [number, number, number, number, number])[] = [
  [-0.17, 0.09, 0.05, 0.085, 0.035], // koper tegak
  [-0.08, 0.11, 0.075, 0.05, 0.06], // kardus
  [0.02, 0.08, 0.065, 0.035, 0.04], // tas jinjing
];
const WARNA_BARANG = [0x1f2937, 0xa47148, 0x7f1d1d, 0x1e40af, 0x6b7280, 0xc49a6c, 0x0f766e].map((c) => new THREE.Color(c));

export class ArmadaKendaraan {
  readonly objek = new THREE.Group();
  private readonly badan: THREE.InstancedMesh;
  private readonly roda: THREE.InstancedMesh;
  private readonly daunPintu: THREE.InstancedMesh;
  private readonly lubangPintu: THREE.InstancedMesh;
  private readonly daunBagasi: THREE.InstancedMesh;
  private readonly lubangBagasi: THREE.InstancedMesh;
  private readonly barang: THREE.InstancedMesh;
  private readonly lampu: THREE.InstancedMesh;
  private readonly kolong: THREE.InstancedMesh;
  private readonly sel: THREE.InstancedBufferAttribute;
  private readonly lembar: LembarBus;
  /** Mitra PO yang sudah bergabung (livery-nya ikut dipakai bus terminal yang baru muncul). */
  private po: readonly PoId[] = [];
  /** Kelas bus yang beroperasi (bus terminal yang baru muncul memakai salah satunya). */
  private kelasBus: readonly KelasBusId[] = ['ekonomi'];
  private rekamanKelasBus: Readonly<Record<KelasBusId, boolean>> | null = null;
  /** Bagian penumpang tiap kelas (harga tiket); null = sama rata. */
  private bagianKelas: Readonly<Record<KelasBusId, number>> | null = null;
  private readonly status = new Map<number, StatusBus>();
  private readonly m = new THREE.Matrix4();
  private readonly q = new THREE.Quaternion();
  private readonly qYaw = new THREE.Quaternion();
  private readonly qLokal = new THREE.Quaternion();
  private readonly e = new THREE.Euler(0, 0, 0, 'YXZ');
  private readonly p = new THREE.Vector3();
  private readonly s = new THREE.Vector3();
  private readonly lokal = new THREE.Vector3();
  private readonly ukuran = new THREE.Vector3();
  private readonly sumbuY = new THREE.Vector3(0, 1, 0);
  private readonly sumbuZ = new THREE.Vector3(0, 0, 1);
  private readonly sumbuX = new THREE.Vector3(1, 0, 0);
  private readonly qDatar = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -Math.PI / 2);
  // Lampu lebih terang dari putih (HDR) supaya berpendar lewat bloom; tanpa efek tetap jenuh biasa.
  private readonly warnaRem = new THREE.Color(0xff2020).multiplyScalar(3);
  private readonly warnaSein = new THREE.Color(0xffa000).multiplyScalar(3);
  private readonly warnaDepan = new THREE.Color(1, 0.96, 0.84).multiplyScalar(4);
  private readonly warnaBelakang = new THREE.Color(0.55, 0.04, 0.04).multiplyScalar(3);
  /** Warna pengali badan saat berdebu penuh (debu jalanan, kusam). */
  private readonly warnaDebu = new THREE.Color(0.56, 0.5, 0.42);
  private readonly warnaBadan = new THREE.Color();
  private readonly putih = new THREE.Color(1, 1, 1);

  constructor(
    gambarAtlas: CanvasImageSource,
    anisotropi: number,
    private readonly renderer: THREE.WebGLRenderer,
  ) {
    this.lembar = new LembarBus(gambarAtlas, anisotropi, [...KENDARAAN_LEWAT, BUS_EMAS]);
    const tekstur = this.lembar.peta;
    const permukaan = this.lembar.permukaan;

    const geo = geometriBadanBus();
    this.sel = new THREE.InstancedBufferAttribute(new Float32Array(KAPASITAS * 2), 2);
    geo.setAttribute('sel', this.sel);
    const material = new THREE.MeshStandardMaterial({ map: tekstur, roughnessMap: permukaan, metalnessMap: permukaan, roughness: 1, metalness: 1, envMapIntensity: 1.6 });
    const ukuranSel = `vec2(${this.lembar.ukuranSelUv[0].toFixed(6)}, ${this.lembar.ukuranSelUv[1].toFixed(6)})`;
    material.onBeforeCompile = (shader) => {
      shader.vertexShader = shader.vertexShader.replace('#include <common>', '#include <common>\nattribute vec2 sel;').replace(
        '#include <uv_vertex>',
        `#include <uv_vertex>
        vMapUv = sel + uv * ${ukuranSel};
        #ifdef USE_ROUGHNESSMAP
          vRoughnessMapUv = vMapUv;
        #endif
        #ifdef USE_METALNESSMAP
          vMetalnessMapUv = vMapUv;
        #endif`,
      );
    };
    this.badan = new THREE.InstancedMesh(geo, material, KAPASITAS);
    this.badan.castShadow = true;
    this.badan.receiveShadow = true;

    this.roda = new THREE.InstancedMesh(geometriRoda(), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6, metalness: 0.3 }), KAPASITAS * 4);
    this.roda.castShadow = true;

    const geoDaun = new THREE.BoxGeometry(1, 1, 1);
    geoDaun.translate(-0.5, 0.5, 0); // engsel di tepi depan, daun memanjang ke belakang
    this.daunPintu = new THREE.InstancedMesh(geoDaun, new THREE.MeshStandardMaterial({ color: 0x2b3845, roughness: 0.15, metalness: 0.35 }), KAPASITAS);
    this.daunPintu.castShadow = true;
    const geoLubang = new THREE.PlaneGeometry(1, 1);
    geoLubang.translate(0, 0.5, 0);
    this.lubangPintu = new THREE.InstancedMesh(geoLubang, new THREE.MeshBasicMaterial({ color: 0x14181d }), KAPASITAS);

    // Pintu bagasi: engsel di tepi atas, daun menggantung ke bawah lalu diangkat keluar.
    const geoDaunBagasi = new THREE.BoxGeometry(1, 1, 1);
    geoDaunBagasi.translate(0, -0.5, 0.5);
    this.daunBagasi = new THREE.InstancedMesh(geoDaunBagasi, new THREE.MeshStandardMaterial({ roughness: 0.35, metalness: 0.3 }), KAPASITAS);
    this.daunBagasi.castShadow = true;
    this.daunBagasi.setColorAt(0, this.putih);
    this.lubangBagasi = new THREE.InstancedMesh(geoLubang, new THREE.MeshBasicMaterial({ color: 0x101317 }), KAPASITAS);
    this.barang = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ roughness: 0.7 }), KAPASITAS * BARANG_BAGASI.length);
    this.barang.castShadow = true;
    this.barang.setColorAt(0, this.putih);

    this.lampu = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial({ toneMapped: false }), MAKS_LAMPU);
    this.lampu.setColorAt(0, this.warnaRem);
    // Warna per instans badan: pengali debu (kusam sebelum dicuci, putih = bersih).
    this.badan.setColorAt(0, this.putih);

    this.kolong = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: teksturKolong(), transparent: true, depthWrite: false, opacity: 0.55 }), KAPASITAS);
    this.kolong.renderOrder = 1;

    for (const mesh of [this.badan, this.roda, this.daunPintu, this.lubangPintu, this.daunBagasi, this.lubangBagasi, this.barang, this.lampu, this.kolong]) {
      mesh.frustumCulled = false;
      mesh.count = 0;
      this.objek.add(mesh);
    }
  }

  /** Mitra PO yang sudah bergabung (dari state); berlaku untuk bus terminal yang muncul berikutnya. */
  aturPo(po: readonly PoId[]): void {
    this.po = po;
  }

  /**
   * Kelas bus yang beroperasi (dari state) & bagian penumpangnya menurut harga tiket;
   * berlaku untuk bus terminal yang muncul berikutnya.
   */
  aturKelasBus(kelasBus: Readonly<Record<KelasBusId, boolean>>, bagian?: Readonly<Record<KelasBusId, number>>): void {
    this.bagianKelas = bagian ?? null;
    if (kelasBus === this.rekamanKelasBus) return;
    this.rekamanKelasBus = kelasBus;
    const beroperasi = KELAS_BUS_IDS.filter((id) => kelasBus[id]);
    this.kelasBus = beroperasi.length > 0 ? beroperasi : ['ekonomi'];
  }

  private tampilUntuk(b: BusVisual): TipeTampil {
    const tetap = (t: TipeKendaraan): TipeTampil => ({ tipe: t, slot: this.lembar.slotTetap(t.frame), terminal: false });
    // Bus Emas: bus kuning besar, diberi rona emas (lihat perbarui).
    if (b.emas) return tetap(BUS_EMAS);
    if (b.jenis === 'lewat') return tetap(KENDARAAN_LEWAT[b.livery % KENDARAAN_LEWAT.length]!);
    const p = pilihLivery(b.id, b.livery, BUS_TERMINAL.length, this.po);
    const livery: LiveryBus = p.jenis === 'po' ? { jenis: 'po', po: p.po } : { jenis: 'bawaan', indeks: p.indeks };
    const bagian = this.bagianKelas;
    const kelas = pilihKelasBus(b.id, b.livery, this.kelasBus, bagian ? (k) => bagian[k] : undefined);
    const sel = this.lembar.pesan(kelas, livery, (b.id * 0.3819660113) % 1);
    const k = TAMPIL_KELAS_BUS[sel.kelas];
    return {
      tipe: { panjang: BUS.panjang, lebar: BUS.lebar, tinggi: k.tinggi, tinggiPintu: k.tinggiPintu, warna: sel.warnaBagasi, roda: RODA_BUS, pintu: true },
      slot: sel.slot,
      terminal: true,
    };
  }

  /** @param malam 0 = siang, 1 = malam penuh (lampu depan & belakang menyala). */
  perbarui(daftar: readonly BusVisual[], dt: number, waktu: number, malam = 0): void {
    let n = 0;
    let nRoda = 0;
    let nPintu = 0;
    let nBagasi = 0;
    let nBarang = 0;
    let nLampu = 0;
    const hidup = new Set<number>();
    for (const b of daftar) {
      if (n >= KAPASITAS) break;
      hidup.add(b.id);
      let st = this.status.get(b.id);
      if (!st) {
        st = { tampil: this.tampilUntuk(b), vLalu: b.v, sudutLalu: b.sudut, rem: 0, sein: 0, seinSisa: 0, angguk: 0, roda: 0, pintu: 0, bagasi: 0 };
        this.status.set(b.id, st);
      }
      const t = st.tampil.tipe;
      const dtAman = Math.max(dt, 1e-3);
      const perlambatan = (st.vLalu - b.v) / dtAman;
      let dSudut = b.sudut - st.sudutLalu;
      dSudut = Math.atan2(Math.sin(dSudut), Math.cos(dSudut));
      const putar = dSudut / dtAman;
      st.vLalu = b.v;
      st.sudutLalu = b.sudut;
      st.rem = perlambatan > 0.4 || (b.v < 0.02 && b.fase !== 'parkir') ? 1 : 0;
      if (Math.abs(putar) > 0.25) {
        st.sein = Math.sign(putar);
        st.seinSisa = 0.6;
      } else if ((st.seinSisa -= dt) <= 0) st.sein = 0;
      const target = -Math.max(-0.015, Math.min(0.015, perlambatan * 0.006));
      st.angguk += (target - st.angguk) * Math.min(1, dt * 6);
      st.roda -= (b.v * dt) / t.roda.r; // putaran maju: puncak roda bergerak ke depan
      // Pintu terbuka saat naik-turun penumpang, dan saat kenek/sopir turun-naik untuk mencuci bus.
      const kenekDiPintu = b.fase === 'parkir' && petugasDiPintu(b.cuci);
      const bukaTarget = t.pintu && (((b.fase === 'turunkan' || b.fase === 'muat') && b.v < 0.05) || kenekDiPintu) ? 1 : 0;
      st.pintu += (bukaTarget - st.pintu) * Math.min(1, dt * 3.5);
      // Bagasi dibuka kenek selama bus berhenti menurunkan/memuat penumpang.
      const bagasiTarget = t.pintu && busDiHalte(b) ? 1 : 0;
      st.bagasi += (bagasiTarget - st.bagasi) * Math.min(1, dt * 2.2);

      // Badan (anggukan saat mengerem).
      this.qYaw.setFromAxisAngle(this.sumbuY, -b.sudut);
      this.e.set(0, -b.sudut, st.angguk, 'YXZ');
      this.q.setFromEuler(this.e);
      this.p.set(b.x, 0.02, b.y);
      this.s.set(t.panjang, t.tinggi, t.lebar);
      this.m.compose(this.p, this.q, this.s);
      this.badan.setMatrixAt(n, this.m);
      const [su, sv] = this.lembar.uvSlot(st.tampil.slot);
      this.sel.setXY(n, su, sv);
      if (b.emas) this.badan.setColorAt(n, WARNA_EMAS);
      else this.badan.setColorAt(n, this.warnaBadan.copy(this.putih).lerp(this.warnaDebu, tingkatKotor(b)));

      // Bayangan kolong.
      this.qLokal.copy(this.qYaw).multiply(this.qDatar);
      this.ukuran.set(t.panjang * 1.25, t.lebar * 1.9, 1);
      this.m.compose(this.lokal.set(b.x, 0.024, b.y), this.qLokal, this.ukuran);
      this.kolong.setMatrixAt(n, this.m);
      n++;

      // Roda: posisi ikut belok badan, putaran pada porosnya, tanpa anggukan.
      const titikDunia = (lx: number, ly: number, lz: number): THREE.Vector3 => this.lokal.set(lx, ly, lz).applyQuaternion(this.qYaw).add(this.p);
      this.qLokal.setFromAxisAngle(this.sumbuZ, st.roda).premultiply(this.qYaw);
      for (const u of t.roda.u) {
        for (const sisi of [-1, 1]) {
          if (nRoda >= KAPASITAS * 4) break;
          const lx = (u - 0.5) * t.panjang;
          const lz = sisi * (t.lebar / 2 - 0.025);
          this.ukuran.set(t.roda.r, t.roda.r, 0.075);
          this.m.compose(titikDunia(lx, t.roda.r, lz), this.qLokal, this.ukuran);
          this.roda.setMatrixAt(nRoda++, this.m);
        }
      }

      // Pintu depan (sisi kanan, menghadap peron): lubang gelap + daun berengsel.
      if (st.pintu > 0.03) {
        const xPintu = PINTU_BUS;
        const tinggiPintu = t.tinggiPintu ?? t.tinggi * PINTU.tinggi;
        const zSisi = t.lebar / 2;
        this.ukuran.set(PINTU.lebar, tinggiPintu, 1);
        this.m.compose(titikDunia(xPintu, 0.05, zSisi + 0.004), this.qYaw, this.ukuran);
        this.lubangPintu.setMatrixAt(nPintu, this.m);
        this.qLokal.setFromAxisAngle(this.sumbuY, PINTU.sudutBuka * st.pintu).premultiply(this.qYaw);
        this.ukuran.set(PINTU.lebar, tinggiPintu, 0.012);
        this.m.compose(titikDunia(xPintu + PINTU.lebar / 2, 0.05, zSisi + 0.01), this.qLokal, this.ukuran);
        this.daunPintu.setMatrixAt(nPintu, this.m);
        nPintu++;
      }

      // Pintu bagasi (sisi pintu, di antara roda): lubang gelap + daun terangkat, barang di sampingnya.
      if (st.bagasi > 0.03) {
        const zSisi = t.lebar / 2;
        const tinggi = BAGASI.atas - BAGASI.bawah;
        this.ukuran.set(BAGASI.lebar, tinggi, 1);
        this.m.compose(titikDunia(BAGASI.a, BAGASI.bawah, zSisi + 0.004), this.qYaw, this.ukuran);
        this.lubangBagasi.setMatrixAt(nBagasi, this.m);
        this.qLokal.setFromAxisAngle(this.sumbuX, -1.4 * st.bagasi).premultiply(this.qYaw);
        this.ukuran.set(BAGASI.lebar, tinggi, 0.01);
        this.m.compose(titikDunia(BAGASI.a, BAGASI.atas, zSisi + 0.006), this.qLokal, this.ukuran);
        this.daunBagasi.setMatrixAt(nBagasi, this.m);
        // Daun bagasi sewarna badan bus.
        this.daunBagasi.setColorAt(nBagasi, this.warnaBadan.setHex(t.warna));
        nBagasi++;
        const muncul = Math.max(0, (st.bagasi - 0.5) / 0.5);
        if (muncul > 0) {
          BARANG_BAGASI.forEach(([da, dl, w, h, d], i) => {
            this.ukuran.set(w * muncul, h * muncul, d * muncul);
            this.m.compose(titikDunia(BAGASI.a + da, 0.02 + (h * muncul) / 2, zSisi + dl), this.qYaw, this.ukuran);
            this.barang.setMatrixAt(nBarang, this.m);
            this.barang.setColorAt(nBarang, WARNA_BARANG[(b.id * 3 + i * 5) % WARNA_BARANG.length]!);
            nBarang++;
          });
        }
      }

      // Lampu rem & sein.
      const lampu = (lx: number, ly: number, lz: number, warna: THREE.Color): void => {
        if (nLampu >= MAKS_LAMPU) return;
        this.lokal.set(lx, ly, lz).multiply(this.s).applyQuaternion(this.q).add(this.p);
        this.ukuran.set(0.025, t.tinggi * 0.07, t.lebar * 0.16);
        this.m.compose(this.lokal, this.q, this.ukuran);
        this.lampu.setMatrixAt(nLampu, this.m);
        this.lampu.setColorAt(nLampu, warna);
        nLampu++;
      };
      if (st.rem) for (const z of [-0.36, 0.36]) lampu(-0.505, 0.22, z, this.warnaRem);
      // Malam: lampu depan & lampu belakang menyala selama mesin hidup (bus parkir mati mesin).
      if (malam > 0.35 && b.fase !== 'parkir') {
        for (const z of [-0.36, 0.36]) {
          lampu(0.505, 0.16, z, this.warnaDepan);
          if (!st.rem) lampu(-0.505, 0.22, z, this.warnaBelakang);
        }
      }
      if (st.sein !== 0 && Math.floor(waktu * 3.2) % 2 === 0) {
        const z = st.sein > 0 ? 0.42 : -0.42; // sudut membesar = belok ke kanan bus (+z lokal)
        lampu(0.505, 0.16, z, this.warnaSein);
        lampu(-0.505, 0.3, z, this.warnaSein);
      }
    }
    for (const [id, st] of this.status) {
      if (hidup.has(id)) continue;
      if (st.tampil.terminal) this.lembar.lepas(st.tampil.slot);
      this.status.delete(id);
    }
    this.lembar.unggah(this.renderer);
    const selesai = (mesh: THREE.InstancedMesh, jumlah: number): void => {
      mesh.count = jumlah;
      mesh.instanceMatrix.needsUpdate = true;
    };
    selesai(this.badan, n);
    selesai(this.kolong, n);
    selesai(this.roda, nRoda);
    selesai(this.lubangPintu, nPintu);
    selesai(this.daunPintu, nPintu);
    selesai(this.lubangBagasi, nBagasi);
    selesai(this.daunBagasi, nBagasi);
    selesai(this.barang, nBarang);
    if (this.barang.instanceColor) this.barang.instanceColor.needsUpdate = true;
    if (this.daunBagasi.instanceColor) this.daunBagasi.instanceColor.needsUpdate = true;
    selesai(this.lampu, nLampu);
    this.sel.needsUpdate = true;
    if (this.badan.instanceColor) this.badan.instanceColor.needsUpdate = true;
    if (this.lampu.instanceColor) this.lampu.instanceColor.needsUpdate = true;
  }
}
