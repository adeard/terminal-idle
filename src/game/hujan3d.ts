/**
 * Hujan: butiran air (garis tipis miring tertiup angin), cipratan kecil di
 * aspal & paving, dan genangan mengilap yang muncul saat tanah basah lalu
 * mengering perlahan setelah hujan reda. Gerak butiran & cipratan dihitung di
 * vertex shader (CPU hanya mengubah uniform), jadi murah di HP.
 *
 * Butiran menempati kotak di sekitar titik pandang kamera; posisinya tetap di
 * dunia (tidak ikut bergeser saat kamera digeser) dan berhenti di permukaan
 * atap terminal, jadi di bawah atap kaca tidak ada hujan.
 */
import * as THREE from 'three';
import { acakBerbenih } from './dunia-visual';
import { ATAP, JALAN, JALAN_DALAM, PANGKALAN, Y_PAGAR, Y_TROTOAR_BELAKANG, type AtapLengkung, type Persegi } from './tata-letak';

const MAKS_BUTIR = 7000;
/** Kotak butiran: lebar (x & z) dan tinggi jatuh (unit dunia). */
const UKURAN_KOTAK = 64;
const TINGGI_JATUH = 16;
const KECEPATAN_JATUH = 17;
const PANJANG_BUTIR = 0.6;
/** Kemiringan hujan (geser x, z per satu unit jatuh). */
const ANGIN: readonly [number, number] = [0.14, 0.05];
const MAKS_CIPRATAN = 3400;
/** Garis tengah cincin cipratan terbesar (unit dunia). */
const UKURAN_CIPRATAN = 0.16;
const MAKS_GENANGAN = 70;
/** Permukaan terbuka tempat cipratan & genangan (x0, y0, x1, y1). */
const PERMUKAAN: readonly Persegi[] = [
  { x0: -38, y0: JALAN.y0 + 0.2, x1: 66, y1: JALAN.y1 - 0.2 },
  JALAN_DALAM,
  PANGKALAN,
  // Plaza depan gedung & lorong parkir sampai pagar.
  { x0: 10.6, y0: 15.6, x1: 39, y1: Y_PAGAR - 0.2 },
  // Jalan lingkungan di belakang terminal.
  { x0: -38, y0: Y_TROTOAR_BELAKANG + 0.3, x1: 66, y1: Y_TROTOAR_BELAKANG + 1.5 },
];

const ATAP_DAFTAR: readonly AtapLengkung[] = [ATAP.gedung, ATAP.tunggu, ATAP.datang, ATAP.sayap];

/** Parameter lengkung atap untuk shader: pusat, jari-jari, tinggi pusat lingkaran. */
function lengkung(a: AtapLengkung): THREE.Vector3 {
  const s = (a.y1 - a.y0) / 2;
  const naik = a.hPuncak - a.hTepi;
  const r = (s * s + naik * naik) / (2 * naik);
  return new THREE.Vector3((a.y0 + a.y1) / 2, r, a.hPuncak - r);
}

const SHADER_BUTIR = {
  vertex: /* glsl */ `
    uniform float uWaktu;
    uniform vec2 uPusat;
    uniform vec4 uAtapKotak[${ATAP_DAFTAR.length}];
    uniform vec3 uAtapLengkung[${ATAP_DAFTAR.length}];
    attribute float ujung;
    varying float vAlfa;
    const float UKURAN = ${UKURAN_KOTAK.toFixed(1)};
    const float TINGGI = ${TINGGI_JATUH.toFixed(1)};
    const vec2 ANGIN = vec2(${ANGIN[0].toFixed(3)}, ${ANGIN[1].toFixed(3)});
    void main() {
      float y = mod(position.y - uWaktu * ${KECEPATAN_JATUH.toFixed(1)}, TINGGI);
      // Kolom butiran tetap di dunia, dibungkus ke kotak di sekitar titik pandang.
      vec2 xz = uPusat + mod(position.xz - uPusat + 0.5 * UKURAN, UKURAN) - 0.5 * UKURAN;
      xz += ANGIN * y;
      float atas = y + ujung * ${PANJANG_BUTIR.toFixed(2)};
      vec3 p = vec3(xz.x + ujung * ANGIN.x * ${PANJANG_BUTIR.toFixed(2)}, atas, xz.y + ujung * ANGIN.y * ${PANJANG_BUTIR.toFixed(2)});
      float alfa = (1.0 - 0.85 * ujung) * (1.0 - smoothstep(TINGGI - 3.0, TINGGI, y));
      // Di bawah atap terminal tidak ada hujan.
      for (int i = 0; i < ${ATAP_DAFTAR.length}; i++) {
        vec4 k = uAtapKotak[i];
        vec3 l = uAtapLengkung[i];
        if (xz.x > k.x && xz.x < k.z && xz.y > k.y && xz.y < k.w) {
          float d = xz.y - l.x;
          float hAtap = l.z + sqrt(max(0.0, l.y * l.y - d * d));
          if (y < hAtap) alfa = 0.0;
        }
      }
      vAlfa = alfa;
      gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
    }`,
  fragment: /* glsl */ `
    uniform vec3 uWarna;
    uniform float uOpasitas;
    varying float vAlfa;
    void main() {
      if (vAlfa <= 0.001) discard;
      gl_FragColor = vec4(uWarna, uOpasitas * vAlfa);
    }`,
};

const SHADER_CIPRATAN = {
  vertex: /* glsl */ `
    uniform float uWaktu;
    uniform float uSkala;
    attribute float fase;
    varying float vAlfa;
    void main() {
      float t = fract(uWaktu * 2.3 + fase);
      // Cipratan hanya sesaat: membesar lalu hilang.
      float hidup = step(t, 0.22);
      float u = t / 0.22;
      vAlfa = hidup * (1.0 - u);
      vec4 mv = viewMatrix * vec4(position, 1.0);
      gl_PointSize = hidup * uSkala * (0.35 + u) / -mv.z;
      gl_Position = projectionMatrix * mv;
    }`,
  fragment: /* glsl */ `
    uniform vec3 uWarna;
    uniform float uOpasitas;
    varying float vAlfa;
    void main() {
      vec2 d = gl_PointCoord - 0.5;
      float r = length(d) * 2.0;
      // Cincin tipis.
      float cincin = smoothstep(0.55, 0.8, r) * (1.0 - smoothstep(0.8, 1.0, r));
      float a = cincin * vAlfa * uOpasitas;
      if (a <= 0.003) discard;
      gl_FragColor = vec4(uWarna, a);
    }`,
};

function teksturGenangan(): THREE.CanvasTexture {
  const U = 128;
  const c = document.createElement('canvas');
  c.width = U;
  c.height = U;
  const ctx = c.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D tidak tersedia');
  // Beberapa lingkaran lembut bertumpuk → tepi genangan tidak bulat sempurna.
  const acak = acakBerbenih(5);
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, U, U);
  for (let i = 0; i < 6; i++) {
    const x = U / 2 + (acak() - 0.5) * U * 0.35;
    const y = U / 2 + (acak() - 0.5) * U * 0.3;
    const r = U * (0.18 + acak() * 0.14);
    const g = ctx.createRadialGradient(x, y, r * 0.4, x, y, r);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, U, U);
  }
  return new THREE.CanvasTexture(c);
}

export class Hujan3D {
  readonly objek = new THREE.Group();
  private readonly butir: THREE.LineSegments;
  private readonly cipratan: THREE.Points;
  private readonly genangan: THREE.InstancedMesh;
  private readonly bahanButir: THREE.ShaderMaterial;
  private readonly bahanCipratan: THREE.ShaderMaterial;
  private readonly bahanGenangan: THREE.MeshStandardMaterial;

  constructor() {
    const acak = acakBerbenih(31);

    // Butiran: dua titik per garis (kepala & ekor), posisi dasar acak di kotak.
    const pos = new Float32Array(MAKS_BUTIR * 6);
    const ujung = new Float32Array(MAKS_BUTIR * 2);
    for (let i = 0; i < MAKS_BUTIR; i++) {
      const x = acak() * UKURAN_KOTAK;
      const y = acak() * TINGGI_JATUH;
      const z = acak() * UKURAN_KOTAK;
      pos.set([x, y, z, x, y, z], i * 6);
      ujung[i * 2 + 1] = 1;
    }
    const gb = new THREE.BufferGeometry();
    gb.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    gb.setAttribute('ujung', new THREE.BufferAttribute(ujung, 1));
    gb.setDrawRange(0, 0);
    this.bahanButir = new THREE.ShaderMaterial({
      uniforms: {
        uWaktu: { value: 0 },
        uPusat: { value: new THREE.Vector2() },
        uAtapKotak: { value: ATAP_DAFTAR.map((a) => new THREE.Vector4(a.x0, a.y0, a.x1, a.y1)) },
        uAtapLengkung: { value: ATAP_DAFTAR.map(lengkung) },
        uWarna: { value: new THREE.Color(0xc8d4e2) },
        uOpasitas: { value: 0 },
      },
      vertexShader: SHADER_BUTIR.vertex,
      fragmentShader: SHADER_BUTIR.fragment,
      transparent: true,
      depthWrite: false,
    });
    this.butir = new THREE.LineSegments(gb, this.bahanButir);
    this.butir.frustumCulled = false;
    this.butir.renderOrder = 6;

    // Cipratan: titik tetap di permukaan terbuka, tiap titik berkedip pada fasenya sendiri.
    const luas = PERMUKAAN.map((p) => (p.x1 - p.x0) * (p.y1 - p.y0));
    const totalLuas = luas.reduce((a, b) => a + b, 0);
    const posC = new Float32Array(MAKS_CIPRATAN * 3);
    const fase = new Float32Array(MAKS_CIPRATAN);
    for (let i = 0; i < MAKS_CIPRATAN; i++) {
      let r = acak() * totalLuas;
      let k = 0;
      while (k < PERMUKAAN.length - 1 && r > luas[k]!) r -= luas[k++]!;
      const p = PERMUKAAN[k]!;
      posC.set([p.x0 + acak() * (p.x1 - p.x0), 0.035, p.y0 + acak() * (p.y1 - p.y0)], i * 3);
      fase[i] = acak();
    }
    const gc = new THREE.BufferGeometry();
    gc.setAttribute('position', new THREE.BufferAttribute(posC, 3));
    gc.setAttribute('fase', new THREE.BufferAttribute(fase, 1));
    gc.setDrawRange(0, 0);
    this.bahanCipratan = new THREE.ShaderMaterial({
      uniforms: { uWaktu: { value: 0 }, uSkala: { value: 60 }, uWarna: { value: new THREE.Color(0xdde6f0) }, uOpasitas: { value: 0 } },
      vertexShader: SHADER_CIPRATAN.vertex,
      fragmentShader: SHADER_CIPRATAN.fragment,
      transparent: true,
      depthWrite: false,
    });
    this.cipratan = new THREE.Points(gc, this.bahanCipratan);
    this.cipratan.frustumCulled = false;
    this.cipratan.renderOrder = 5;

    // Genangan: bercak air gelap mengilap (memantulkan langit lewat environment map).
    const gg = new THREE.PlaneGeometry(1, 1);
    gg.rotateX(-Math.PI / 2);
    this.bahanGenangan = new THREE.MeshStandardMaterial({
      color: 0x1b232c,
      roughness: 0.08,
      metalness: 0.2,
      alphaMap: teksturGenangan(),
      transparent: true,
      opacity: 0,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
    });
    this.genangan = new THREE.InstancedMesh(gg, this.bahanGenangan, MAKS_GENANGAN);
    this.genangan.receiveShadow = true;
    this.genangan.renderOrder = 1;
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const sumbuY = new THREE.Vector3(0, 1, 0);
    for (let i = 0; i < MAKS_GENANGAN; i++) {
      // Genangan di tepi jalan & cekungan: lebih banyak di jalan dan pangkalan.
      const p = PERMUKAAN[i % PERMUKAAN.length]!;
      const x = p.x0 + acak() * (p.x1 - p.x0);
      const y = p.y0 + 0.15 + acak() * (p.y1 - p.y0 - 0.3);
      const panjang = 0.5 + acak() * 1.3;
      q.setFromAxisAngle(sumbuY, acak() * Math.PI);
      m.compose(new THREE.Vector3(x, 0.028, y), q, new THREE.Vector3(panjang, 1, panjang * (0.45 + acak() * 0.4)));
      this.genangan.setMatrixAt(i, m);
    }
    this.genangan.visible = false;

    this.objek.add(this.butir, this.cipratan, this.genangan);
  }

  /**
   * @param hujan intensitas hujan 0–1
   * @param basah kebasahan tanah 0–1 (tertinggal dari hujan, lambat mengering)
   * @param terang kecerahan langit (butiran lebih samar di malam hari)
   * @param pikselPerUnit piksel layar per unit dunia pada jarak 1 (tinggi kanvas / (2 tan(fov/2)))
   */
  perbarui(hujan: number, basah: number, waktu: number, pusatX: number, pusatY: number, terang: number, pikselPerUnit: number): void {
    const nButir = Math.round(MAKS_BUTIR * Math.min(1, hujan * 1.1));
    this.butir.geometry.setDrawRange(0, nButir * 2);
    this.butir.visible = nButir > 0;
    this.bahanButir.uniforms['uWaktu']!.value = waktu % 1000;
    (this.bahanButir.uniforms['uPusat']!.value as THREE.Vector2).set(pusatX, pusatY);
    this.bahanButir.uniforms['uOpasitas']!.value = (0.22 + 0.2 * hujan) * (0.45 + 0.55 * terang);

    const nCipratan = Math.round(MAKS_CIPRATAN * hujan);
    this.cipratan.geometry.setDrawRange(0, nCipratan);
    this.cipratan.visible = nCipratan > 0;
    this.bahanCipratan.uniforms['uWaktu']!.value = waktu % 1000;
    this.bahanCipratan.uniforms['uSkala']!.value = pikselPerUnit * UKURAN_CIPRATAN;
    this.bahanCipratan.uniforms['uOpasitas']!.value = 0.55 * (0.4 + 0.6 * terang);

    this.genangan.visible = basah > 0.02;
    this.bahanGenangan.opacity = 0.78 * basah;
  }
}
