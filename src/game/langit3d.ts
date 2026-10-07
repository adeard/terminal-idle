/**
 * Langit prosedural (gradasi zenit → cakrawala, pendar & piringan matahari atau
 * bulan, awan yang menebal saat mendung) yang dirender ke cube map kecil lalu
 * dipakai sebagai environment map adegan: kaca, bodi bus, fasad kota, dan
 * genangan memantulkan langit sesuai jam & cuaca (jingga saat senja, gelap di
 * malam hari, kelabu saat hujan).
 *
 * Kubahnya tidak digambar di adegan utama: kamera tidak pernah menatap
 * cakrawala (elevasi ≥ 25°), jadi yang terlihat hanya pantulannya.
 *
 * Tekstur cube yang sama dipakai terus. three.js mem-PMREM ulang ke render
 * target yang sama setiap kali `needsPMREMUpdate`, jadi material tidak
 * berganti program shader saat langit berubah.
 */
import * as THREE from 'three';
import type { Suasana } from './langit';

/** Sisi cube map (px): cukup untuk pantulan kaca yang agak kasar, murah dibuat ulang. */
const UKURAN_CUBE = 128;
/** Jeda minimum antarpembaruan (detik nyata); langit berubah pelan, tidak perlu tiap frame. */
const JEDA_PEMBARUAN = 1.2;
/** Kecerahan piringan matahari (HDR): pantulannya di kaca cukup terang untuk memicu bloom. */
const TERANG_MATAHARI = 6;
/** Pendar lampu kota di cakrawala & tanah saat malam (radiance linear, kuning sodium). */
const CAHAYA_KOTA = new THREE.Color(1, 0.62, 0.32).multiplyScalar(0.05);
/** Bagian cakrawala, zenit, dan tanah dalam perkiraan kecerahan rata-rata langit. */
const BOBOT_KECERAHAN = { cakrawala: 0.3, zenit: 0.2, tanah: 0.5 } as const;

const luminans = (c: THREE.Color): number => 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b;

const SHADER = {
  vertex: /* glsl */ `
    varying vec3 vArah;
    void main() {
      vArah = position;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragment: /* glsl */ `
    uniform vec3 uZenit;
    uniform vec3 uCakrawala;
    uniform vec3 uTanah;
    uniform vec3 uArahSurya;
    uniform vec3 uWarnaSurya;
    uniform float uMatahari;
    uniform float uBulan;
    uniform float uMendung;
    uniform float uTerangSurya;
    uniform vec3 uKota;
    varying vec3 vArah;

    float acak(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
    float derau(vec2 p) {
      vec2 i = floor(p);
      vec2 f = fract(p);
      vec2 u = f * f * (3.0 - 2.0 * f);
      return mix(mix(acak(i), acak(i + vec2(1.0, 0.0)), u.x), mix(acak(i + vec2(0.0, 1.0)), acak(i + vec2(1.0, 1.0)), u.x), u.y);
    }
    float fbm(vec2 p) {
      float v = 0.0;
      float a = 0.5;
      for (int i = 0; i < 4; i++) { v += a * derau(p); p *= 2.03; a *= 0.5; }
      return v;
    }

    void main() {
      vec3 d = normalize(vArah);
      float h = d.y;
      vec3 warna = mix(uCakrawala, uZenit, pow(clamp(h, 0.0, 1.0), 0.45));
      float cerah = 1.0 - uMendung;
      float c = max(dot(d, uArahSurya), 0.0);
      // Pendar lebar di sekitar matahari (senja jadi jingga di sisi baratnya), lalu piringannya.
      warna += uWarnaSurya * (pow(c, 5.0) * 0.28 + pow(c, 60.0) * 0.4) * uMatahari * (1.0 - 0.75 * uMendung);
      warna += uWarnaSurya * smoothstep(0.99935, 0.9997, c) * uTerangSurya * uMatahari * cerah;
      warna += vec3(0.75, 0.8, 0.95) * smoothstep(0.9990, 0.9994, c) * 1.6 * uBulan * cerah;
      // Awan: bidang datar di atas kepala, menebal & menggelap saat mendung.
      if (h > 0.0) {
        vec2 uv = d.xz / (h + 0.18) * 1.7;
        float n = fbm(uv + vec2(3.7, 1.3));
        float ambang = mix(0.6, 0.2, uMendung);
        float awan = smoothstep(ambang, ambang + 0.22, n) * smoothstep(0.0, 0.22, h);
        vec3 warnaAwan = mix(uCakrawala * 1.12 + uWarnaSurya * 0.12 * uMatahari, uCakrawala * 0.72, uMendung);
        warna = mix(warna, warnaAwan, awan * 0.85);
      }
      // Malam: cakrawala memerah-kuning oleh lampu kota.
      warna += uKota * (1.0 - smoothstep(0.0, 0.35, h));
      // Di bawah cakrawala: tanah & atap sekitar yang redup (malam: diterangi lampu jalan).
      warna = mix(warna, uTanah + uKota * 0.8, smoothstep(0.02, -0.1, h));
      gl_FragColor = vec4(warna, 1.0);
    }
  `,
};

export class LangitLingkungan {
  private readonly adegan = new THREE.Scene();
  private readonly target: THREE.WebGLCubeRenderTarget;
  private readonly kamera: THREE.CubeCamera;
  private readonly bahan: THREE.ShaderMaterial;
  private kunciLalu = '';
  private kunci = '';
  private sejak = Infinity;
  private kecerahanBaru = 1;
  /**
   * Perkiraan radiance rata-rata cube map yang sedang dipakai. Adegan membagi
   * kekuatan environment dengan angka ini: warna & arah pantulan mengikuti langit,
   * kekuatannya tetap mengikuti suasana (langit malam yang nyaris hitam tidak
   * membuat bangunan gelap gulita).
   */
  kecerahan = 1;

  constructor() {
    this.target = new THREE.WebGLCubeRenderTarget(UKURAN_CUBE, { type: THREE.HalfFloatType, generateMipmaps: false });
    this.kamera = new THREE.CubeCamera(0.1, 100, this.target);
    this.bahan = new THREE.ShaderMaterial({
      uniforms: {
        uZenit: { value: new THREE.Color() },
        uCakrawala: { value: new THREE.Color() },
        uTanah: { value: new THREE.Color() },
        uArahSurya: { value: new THREE.Vector3(0, 1, 0) },
        uWarnaSurya: { value: new THREE.Color() },
        uMatahari: { value: 0 },
        uBulan: { value: 0 },
        uMendung: { value: 0 },
        uTerangSurya: { value: TERANG_MATAHARI },
        uKota: { value: new THREE.Color() },
      },
      vertexShader: SHADER.vertex,
      fragmentShader: SHADER.fragment,
      side: THREE.BackSide,
      depthTest: false,
      depthWrite: false,
    });
    this.adegan.add(new THREE.Mesh(new THREE.SphereGeometry(10, 48, 24), this.bahan));
  }

  /** Tekstur cube untuk `scene.environment` (objeknya tetap sepanjang permainan). */
  get tekstur(): THREE.Texture {
    return this.target.texture;
  }

  /** Pasang suasana; cube map dibuat ulang di `perbarui` bila tampilannya berubah cukup jelas. */
  atur(s: Suasana): void {
    const u = this.bahan.uniforms;
    (u.uZenit!.value as THREE.Color).setHex(s.warnaZenit);
    (u.uCakrawala!.value as THREE.Color).setHex(s.warnaLatar);
    (u.uTanah!.value as THREE.Color).setHex(s.warnaTanah).multiplyScalar(0.55);
    (u.uArahSurya!.value as THREE.Vector3).set(...s.arahCahaya);
    // Warna surya dinormalkan ke kanal terkuat; kekuatannya dari intensitas cahaya utama (siang 3,1).
    const surya = u.uWarnaSurya!.value as THREE.Color;
    surya.setHex(s.warnaCahaya);
    surya.multiplyScalar(1 / Math.max(surya.r, surya.g, surya.b, 1e-3));
    const matahari = s.bendaLangit === 'matahari' ? Math.min(1, s.intensitasCahaya / 1.2) : 0;
    u.uMatahari!.value = matahari;
    u.uBulan!.value = s.bendaLangit === 'bulan' ? s.malam : 0;
    u.uMendung!.value = s.mendung;
    const kota = (u.uKota!.value as THREE.Color).copy(CAHAYA_KOTA).multiplyScalar(s.malam);
    const tanah = (u.uTanah!.value as THREE.Color).clone().add(kota.clone().multiplyScalar(0.8));
    const cakrawala = (u.uCakrawala!.value as THREE.Color).clone().add(kota);
    this.kecerahanBaru =
      BOBOT_KECERAHAN.cakrawala * luminans(cakrawala) + BOBOT_KECERAHAN.zenit * luminans(u.uZenit!.value as THREE.Color) + BOBOT_KECERAHAN.tanah * luminans(tanah);
    // Kunci kasar: warna per 8 tingkat, arah per ±3°, mendung per 0,1.
    const w = (hex: number): string => (hex & 0xf8f8f8).toString(36);
    const [x, y, z] = s.arahCahaya;
    this.kunci = [w(s.warnaZenit), w(s.warnaLatar), w(s.warnaCahaya), w(s.warnaTanah), Math.round(x * 20), Math.round(y * 20), Math.round(z * 20), Math.round(matahari * 10), Math.round(s.mendung * 10)].join('|');
  }

  /** @param dt detik nyata sejak frame lalu */
  perbarui(renderer: THREE.WebGLRenderer, dt: number): void {
    this.sejak += dt;
    if (this.kunci === this.kunciLalu || this.sejak < JEDA_PEMBARUAN) return;
    this.kunciLalu = this.kunci;
    this.sejak = 0;
    this.kamera.update(renderer, this.adegan);
    this.target.texture.needsPMREMUpdate = true;
    this.kecerahan = Math.max(this.kecerahanBaru, 1e-3);
  }
}
