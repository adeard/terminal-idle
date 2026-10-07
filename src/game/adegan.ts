/**
 * Renderer three.js untuk terminal: kamera perspektif sempit dengan sudut
 * isometrik (kesan foto maket), matahari/bulan dengan bayangan lembut dan cahaya
 * langit yang mengikuti jam terminal (aturSuasana, lihat langit.ts),
 * pantulan langit prosedural (langit3d.ts) di kaca/bodi bus, kabut tipis, dan
 * post-processing lewat pustaka `postprocessing`: ambient occlusion N8AO
 * (perangkat kuat), bloom, tilt-shift, tone mapping ACES, vignette, SMAA.
 *
 * Peta bayangan mengikuti area yang sedang dilihat kamera (makin dekat makin
 * tajam), digeser per texel supaya tepinya tidak berkilau saat kamera bergeser.
 *
 * Kualitas menurun otomatis bila frame terlalu lambat (rasio piksel, AO,
 * multisampling, ukuran & frekuensi peta bayangan, bloom, tilt-shift, lalu tanpa
 * efek sama sekali).
 */
import * as THREE from 'three';
import { MapControls } from 'three/addons/controls/MapControls.js';
import {
  BlendFunction,
  BloomEffect,
  BrightnessContrastEffect,
  EffectComposer,
  EffectPass,
  HueSaturationEffect,
  KernelSize,
  RenderPass,
  SMAAEffect,
  SMAAPreset,
  TiltShiftEffect,
  ToneMappingEffect,
  ToneMappingMode,
  VignetteEffect,
} from 'postprocessing';
import type { N8AOPostPass } from 'n8ao';
import { ELEVASI_MAKS, ELEVASI_MIN, PelacakPelintir, selisihSudut } from './kamera';
import { poseSinema, type PoseSinema } from './sinema';
import { bingkaiBayangan } from './bayangan';
import type { Suasana, Vektor3 } from './langit';
import { LangitLingkungan } from './langit3d';
import type { Proyektor } from './zona3d';

/** Elevasi kamera (radian): sedikit lebih tegak dari isometrik supaya terminal mengisi layar potret. */
export const ELEVASI_KAMERA = (42 * Math.PI) / 180;
const FOV = 26;
/** Arah datang sinar matahari (dari belakang-kanan) → bayangan jatuh ke kiri layar. */
const ARAH_MATAHARI = new THREE.Vector3(10, 17, -8).normalize();
/** Batas setengah sisi peta bayangan (unit); di antaranya mengikuti luas tanah yang terlihat (bayangan.ts). */
const BAYANGAN_MIN = 12;
const BAYANGAN_MAKS = 64;
/** Jarak kamera bayangan dari tanah di sepanjang arah cahaya (unit). */
const JARAK_CAHAYA = 80;
/** Bias kedalaman bayangan dalam unit dunia (dibagi rentang near–far kamera bayangan). */
const BIAS_BAYANGAN = 0.035;
/** Perubahan arah cahaya minimum (±0,2°) sebelum peta bayangan digeser ikut matahari. */
const AMBANG_ARAH_CAHAYA = 0.0035;
/** Pojok layar dalam NDC untuk menghitung jejak pandangan kamera di tanah. */
const POJOK_LAYAR: readonly (readonly [number, number])[] = [
  [-1, -1],
  [1, -1],
  [1, 1],
  [-1, 1],
];
/**
 * Kecerahan acuan environment: kekuatan pantulan = intensitasLingkungan suasana ×
 * acuan ÷ kecerahan langit saat itu (angka suasana ditala untuk environment studio).
 */
const KECERAHAN_ACUAN = 0.42;
const BATAS_TARGET = { x0: -32, x1: 56, z0: -3, z1: 19 } as const;

interface TingkatKualitas {
  readonly rasioMaks: number;
  readonly sampel: number;
  /** Ukuran peta bayangan; 0 = tanpa bayangan. */
  readonly bayangan: number;
  /** Peta bayangan digambar ulang tiap N frame (1 = tiap frame); tetap segera bila kamera/cahaya bergeser. */
  readonly selangBayangan: number;
  readonly tiltShift: boolean;
  /** Bloom: lampu, papan menyala, lampu bus, dan kilau matahari di kaca berpendar. */
  readonly bloom: boolean;
  /** SMAA untuk tingkat tanpa multisampling (tepi tetap halus, jauh lebih murah dari MSAA). */
  readonly smaa: boolean;
  /**
   * Mode kualitas N8AO; null = tanpa ambient occlusion layar. Diukur di Intel
   * Iris Xe: AO memakan 7–10 ms/frame, jadi hanya tingkat tertinggi yang memakainya;
   * tingkat lain mengandalkan bayangan kontak yang dipanggang (geometri.bayanganKontak).
   */
  readonly ao: 'Low' | null;
  /** false = tanpa post-processing (render langsung, tone mapping di renderer). */
  readonly efek: boolean;
}

const TINGKAT: readonly TingkatKualitas[] = [
  { rasioMaks: 2, sampel: 4, bayangan: 2048, selangBayangan: 1, tiltShift: true, bloom: true, smaa: false, ao: 'Low', efek: true },
  { rasioMaks: 1.5, sampel: 4, bayangan: 2048, selangBayangan: 1, tiltShift: true, bloom: true, smaa: false, ao: null, efek: true },
  { rasioMaks: 1.25, sampel: 2, bayangan: 1024, selangBayangan: 2, tiltShift: true, bloom: true, smaa: false, ao: null, efek: true },
  { rasioMaks: 1, sampel: 0, bayangan: 1024, selangBayangan: 3, tiltShift: false, bloom: false, smaa: true, ao: null, efek: true },
  // Jaring pengaman untuk HP lemah: tanpa bayangan & post-processing, resolusi dikurangi.
  { rasioMaks: 0.75, sampel: 0, bayangan: 0, selangBayangan: 1, tiltShift: false, bloom: false, smaa: false, ao: null, efek: false },
];

export class Adegan implements Proyektor {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly kamera: THREE.PerspectiveCamera;
  readonly kontrol: MapControls;
  /** Cahaya utama: matahari di siang hari, bulan di malam hari (lihat langit.ts). */
  readonly matahari: THREE.DirectionalLight;
  private readonly langit: THREE.HemisphereLight;
  /** Arah ke cahaya utama (dari suasana) dan arah yang sedang dipakai peta bayangan. */
  private readonly arahCahaya = ARAH_MATAHARI.clone();
  private readonly arahBayangan = new THREE.Vector3();
  private readonly pusatBayangan = new THREE.Vector3();
  private setengahBayangan = 0;
  private bayanganBerubah = true;
  private readonly lingkungan = new LangitLingkungan();
  private intensitasLingkungan = 0.35;
  private readonly composer: EffectComposer;
  private readonly passRender: RenderPass;
  private passAo: N8AOPostPass | null = null;
  /** Kelas N8AO dimuat terpisah (dynamic import) hanya bila tingkat kualitasnya dipakai. */
  private kelasAo: typeof N8AOPostPass | null = null;
  private memuatAo = false;
  private passEfek: EffectPass | null = null;
  private passSmaa: EffectPass | null = null;
  private readonly tiltShift: TiltShiftEffect;
  // Bloom dari buffer HDR: hanya yang lebih terang dari putih (lampu, emisif, kilau matahari).
  private readonly bloom = new BloomEffect({ blendFunction: BlendFunction.ADD, luminanceThreshold: 1.1, luminanceSmoothing: 0.3, mipmapBlur: true, intensity: 0.4, radius: 0.72, levels: 6 });
  private smaa: SMAAEffect | null = null;
  private readonly toneMapping = new ToneMappingEffect({ mode: ToneMappingMode.ACES_FILMIC });
  private readonly warna = new HueSaturationEffect({ saturation: 0.05 });
  private readonly kontras = new BrightnessContrastEffect({ contrast: 0.06 });
  private readonly vignette = new VignetteEffect({ offset: 0.35, darkness: 0.38 });
  private tingkat = 0;
  /** Mode dev: ?tingkat=N mengunci tingkat kualitas (untuk mengukur performa tiap tingkat). */
  private readonly tingkatTerkunci: number | null = Adegan.bacaTingkatDev();
  private lebar = 1;
  private tinggi = 1;
  private rataFrame = 1 / 60;
  private lambatSejak = 0;
  private turunTerakhir = 0;
  private waktu = 0;
  private frame = 0;
  private nomorFrame = 0;
  private readonly arahKamera = new THREE.Vector3(Math.cos(ELEVASI_KAMERA) * Math.SQRT1_2, Math.sin(ELEVASI_KAMERA), Math.cos(ELEVASI_KAMERA) * Math.SQRT1_2);
  private readonly v = new THREE.Vector3();
  /** Arah & kemiringan kamera awal (koordinat bola three.js di sekitar titik pandang). */
  private readonly bolaAwal = new THREE.Spherical().setFromVector3(this.arahKamera);
  private readonly bola = new THREE.Spherical();
  /** Sisa putaran & kemiringan yang sedang dianimasikan (tombol putar, kembali ke arah awal). */
  private sisaPutar = 0;
  private sisaMiring = 0;
  private readonly pelintir = new PelacakPelintir();
  /** Mode sinema: pose awal orbit, lama berjalan, dan pose kamera pemain yang dipulihkan saat keluar. */
  private sinema: { readonly awal: PoseSinema; readonly posisi: THREE.Vector3; readonly target: THREE.Vector3; waktu: number } | null = null;

  constructor(wadah: HTMLElement) {
    this.renderer = new THREE.WebGLRenderer({ antialias: false, stencil: false, powerPreference: 'high-performance' });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.info.autoReset = false; // dihitung per frame (composer memanggil render beberapa kali)
    this.renderer.domElement.style.display = 'block';
    this.renderer.domElement.style.touchAction = 'none';
    wadah.prepend(this.renderer.domElement);

    const langit = new THREE.Color(0xcfdde6);
    this.scene.background = langit;
    this.scene.fog = new THREE.Fog(langit, 140, 320);
    this.scene.environment = this.lingkungan.tekstur;

    this.langit = new THREE.HemisphereLight(0xdcecff, 0x7b8a5c, 1.35);
    this.scene.add(this.langit);
    this.matahari = new THREE.DirectionalLight(0xfff1dc, 3.1);
    this.matahari.castShadow = true;
    const cam = this.matahari.shadow.camera;
    cam.near = 1;
    cam.far = JARAK_CAHAYA + BAYANGAN_MAKS * 1.6;
    this.matahari.shadow.bias = -BIAS_BAYANGAN / (cam.far - cam.near);
    this.matahari.shadow.radius = 3;
    // Digambar ulang manual (perbaruiBayangan): tiap frame di tingkat tinggi, berselang di HP.
    this.matahari.shadow.autoUpdate = false;
    this.scene.add(this.matahari, this.matahari.target);

    this.kamera = new THREE.PerspectiveCamera(FOV, 1, 1, 700);
    this.kontrol = new MapControls(this.kamera, this.renderer.domElement);
    this.kontrol.enableDamping = true;
    this.kontrol.dampingFactor = 0.14;
    this.kontrol.screenSpacePanning = false;
    this.kontrol.zoomToCursor = true;
    // Putar & miringkan: klik kanan (atau Shift/Ctrl + klik kiri) lalu seret. Di HP:
    // pelintir dua jari (lihat pasangPelintir), cubit tetap untuk zoom.
    this.kontrol.enableRotate = true;
    this.kontrol.rotateSpeed = 0.6;
    this.kontrol.minPolarAngle = Math.PI / 2 - ELEVASI_MAKS;
    this.kontrol.maxPolarAngle = Math.PI / 2 - ELEVASI_MIN;
    this.kontrol.touches = { ONE: THREE.TOUCH.PAN, TWO: THREE.TOUCH.DOLLY_PAN };
    this.kontrol.mouseButtons = { LEFT: THREE.MOUSE.PAN, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.ROTATE };
    this.pasangPelintir();

    // Pita fokus lebar & blur ringan: kesan foto maket tanpa mengaburkan area bermain.
    this.tiltShift = new TiltShiftEffect({ offset: 0.0, focusArea: 0.62, feather: 0.4, kernelSize: KernelSize.SMALL });
    this.composer = new EffectComposer(this.renderer, { frameBufferType: THREE.HalfFloatType, multisampling: 0 });
    this.passRender = new RenderPass(this.scene, this.kamera);
    this.tingkat = this.tingkatAwal();
    this.susunPass();
    this.terapkanTingkat(this.tingkat);
  }

  private static bacaTingkatDev(): number | null {
    if (!import.meta.env.DEV) return null;
    const n = Number(new URLSearchParams(location.search).get('tingkat'));
    return Number.isInteger(n) && n >= 0 && n < TINGKAT.length && location.search.includes('tingkat') ? n : null;
  }

  /** Tingkat awal dari kemampuan perangkat; frame lambat menurunkannya lagi saat berjalan. */
  private tingkatAwal(): number {
    if (this.tingkatTerkunci !== null) return this.tingkatTerkunci;
    const dpr = window.devicePixelRatio || 1;
    const kecil = Math.min(screen.width, screen.height) * dpr < 720;
    const sampelMaks = this.renderer.capabilities.maxSamples;
    if (kecil || sampelMaks < 2) return 2;
    return dpr > 2 ? 1 : 0;
  }

  private muatAo(): void {
    if (this.memuatAo) return;
    this.memuatAo = true;
    void import('n8ao')
      .then(({ N8AOPostPass }) => {
        this.kelasAo = N8AOPostPass;
        if (TINGKAT[this.tingkat]!.ao) this.susunPass();
      })
      .catch((e: unknown) => console.warn('[grafis] N8AO gagal dimuat, lanjut tanpa AO', e));
  }

  /** Susun ulang rantai pass sesuai tingkat: render → (AO) → efek. */
  private susunPass(): void {
    const t = TINGKAT[this.tingkat]!;
    const adaKedalaman = this.composer.inputBuffer.depthTexture !== null;
    this.composer.removeAllPasses();
    // removeAllPasses membuang depth texture (float, diminta N8AO) tanpa membangun
    // ulang framebuffer: buffer MSAA lama tetap berdepth 32F, sedangkan three.js
    // memasang renderbuffer depth 24-bit di framebuffer resolve. Blit warna+depth
    // lalu ditolak GPU tiap frame dan layar membeku. Buang kedua buffer supaya
    // dibangun ulang dengan format depth yang sama.
    if (adaKedalaman) {
      this.composer.inputBuffer.dispose();
      this.composer.outputBuffer.dispose();
    }
    this.composer.addPass(this.passRender);
    if (t.ao && !this.kelasAo) this.muatAo();
    if (t.ao && this.kelasAo) {
      if (!this.passAo) {
        // Kontak bayangan di sudut dinding, kolong bus, dan celah antarrumah.
        this.passAo = new this.kelasAo(this.scene, this.kamera, this.lebar, this.tinggi);
        const c = this.passAo.configuration;
        c.aoRadius = 0.9;
        c.distanceFalloff = 1.0;
        c.intensity = 4.2;
        c.color = new THREE.Color(0x0f1418);
        c.halfRes = true;
        c.gammaCorrection = false; // bukan pass terakhir; konversi warna di EffectPass
      }
      this.passAo.setQualityMode(t.ao);
      this.composer.addPass(this.passAo);
    }
    this.passEfek?.dispose();
    const efek = [t.bloom ? this.bloom : null, t.tiltShift ? this.tiltShift : null, this.toneMapping, this.warna, this.kontras, this.vignette];
    this.passEfek = new EffectPass(this.kamera, ...efek.filter((e) => e !== null));
    this.composer.addPass(this.passEfek);
    // SMAA di pass terpisah setelah tone mapping: deteksi tepinya bekerja pada warna akhir.
    this.passSmaa?.dispose();
    this.passSmaa = null;
    if (t.smaa) {
      this.smaa ??= new SMAAEffect({ preset: SMAAPreset.MEDIUM });
      this.passSmaa = new EffectPass(this.kamera, this.smaa);
      this.composer.addPass(this.passSmaa);
    }
  }

  private terapkanTingkat(i: number): void {
    const lama = TINGKAT[this.tingkat]!;
    this.tingkat = i;
    const t = TINGKAT[i]!;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, t.rasioMaks));
    this.composer.multisampling = Math.min(t.sampel, this.renderer.capabilities.maxSamples);
    this.renderer.shadowMap.enabled = t.bayangan > 0;
    if (t.bayangan > 0 && this.matahari.shadow.mapSize.x !== t.bayangan) {
      this.matahari.shadow.mapSize.set(t.bayangan, t.bayangan);
      this.matahari.shadow.map?.dispose();
      this.matahari.shadow.map = null;
    }
    // Tanpa composer, tone mapping dikerjakan renderer (dengan composer: ToneMappingEffect).
    this.renderer.toneMapping = t.efek ? THREE.NoToneMapping : THREE.ACESFilmicToneMapping;
    if (lama.bayangan > 0 !== t.bayangan > 0 || lama.efek !== t.efek) {
      this.scene.traverse((o) => {
        const m = (o as THREE.Mesh).material;
        for (const mat of Array.isArray(m) ? m : m ? [m] : []) mat.needsUpdate = true;
      });
    }
    if (lama.tiltShift !== t.tiltShift || lama.ao !== t.ao || lama.bloom !== t.bloom || lama.smaa !== t.smaa) this.susunPass();
    this.bayanganBerubah = true;
    this.ukur(this.lebar, this.tinggi);
  }

  /** Terapkan suasana siang–malam: cahaya utama, cahaya langit, latar, kabut, pantulan langit, bloom. */
  aturSuasana(s: Suasana): void {
    this.arahCahaya.set(...s.arahCahaya);
    this.matahari.intensity = s.intensitasCahaya;
    this.matahari.color.setHex(s.warnaCahaya);
    this.langit.intensity = s.intensitasLangit;
    this.langit.color.setHex(s.warnaLangit);
    this.langit.groundColor.setHex(s.warnaTanah);
    if (this.scene.background instanceof THREE.Color) this.scene.background.setHex(s.warnaLatar);
    this.scene.fog?.color.setHex(s.warnaLatar);
    this.intensitasLingkungan = s.intensitasLingkungan;
    this.lingkungan.atur(s);
    // Malam: ambang turun & bloom menguat supaya lampu berpendar; siang hanya kilau terkuat.
    this.bloom.intensity = THREE.MathUtils.lerp(0.22, 0.95, s.malam) + 0.4 * s.kilat;
    this.bloom.luminanceMaterial.threshold = THREE.MathUtils.lerp(1.3, 0.8, s.malam);
  }

  get lebarCss(): number {
    return this.lebar;
  }

  get tinggiCss(): number {
    return this.tinggi;
  }

  /** Ukuran canvas dalam piksel CSS. */
  ukur(lebar: number, tinggi: number): void {
    this.lebar = Math.max(1, Math.round(lebar));
    this.tinggi = Math.max(1, Math.round(tinggi));
    this.renderer.setSize(this.lebar, this.tinggi, false);
    this.renderer.domElement.style.width = `${this.lebar}px`;
    this.renderer.domElement.style.height = `${this.tinggi}px`;
    this.composer.setSize(this.lebar, this.tinggi, false);
    this.kamera.aspect = this.lebar / this.tinggi;
    this.kamera.updateProjectionMatrix();
  }

  /** Arahkan kamera supaya semua titik (x, y, tinggi) muat; atur batas zoom dari jarak itu. */
  bingkai(titik: readonly (readonly [number, number, number])[], margin = 0.94): void {
    let x0 = Infinity;
    let x1 = -Infinity;
    let z0 = Infinity;
    let z1 = -Infinity;
    for (const [x, y] of titik) {
      x0 = Math.min(x0, x);
      x1 = Math.max(x1, x);
      z0 = Math.min(z0, y);
      z1 = Math.max(z1, y);
    }
    const target = new THREE.Vector3((x0 + x1) / 2, 0, (z0 + z1) / 2);
    const d = this.arahKamera;
    const maju = d.clone().negate();
    const kanan = new THREE.Vector3().crossVectors(maju, new THREE.Vector3(0, 1, 0)).normalize();
    const atas = new THREE.Vector3().crossVectors(kanan, maju);
    const tanV = Math.tan(THREE.MathUtils.degToRad(FOV / 2)) * margin;
    const tanH = tanV * this.kamera.aspect;
    let jarak = 10;
    for (const [x, y, h] of titik) {
      const q = new THREE.Vector3(x, h, y).sub(target);
      const dalam = q.dot(d);
      jarak = Math.max(jarak, dalam + Math.abs(q.dot(kanan)) / tanH, dalam + Math.abs(q.dot(atas)) / tanV);
    }
    this.kontrol.target.copy(target);
    this.kamera.position.copy(target).addScaledVector(d, jarak);
    this.kontrol.minDistance = 7;
    this.kontrol.maxDistance = jarak * 1.25;
    this.kontrol.update();
  }

  /**
   * Mode sinema: kamera berputar pelan sendiri mengelilingi titik pandang
   * sekarang (sinema.ts) dan kontrol pemain dimatikan. false = kembali ke pose
   * kamera sebelum mode sinema.
   */
  aturSinema(aktif: boolean): void {
    if (aktif && !this.sinema) {
      const t = this.kontrol.target;
      this.bola.setFromVector3(this.v.copy(this.kamera.position).sub(t));
      const awal: PoseSinema = { x: t.x, z: t.z, jarak: this.bola.radius, theta: this.bola.theta, phi: this.bola.phi };
      this.sinema = { awal, posisi: this.kamera.position.clone(), target: t.clone(), waktu: 0 };
      this.sisaPutar = this.sisaMiring = 0;
      this.kontrol.enabled = false;
    } else if (!aktif && this.sinema) {
      this.kamera.position.copy(this.sinema.posisi);
      this.kontrol.target.copy(this.sinema.target);
      this.sinema = null;
      this.kontrol.enabled = true;
      this.kontrol.update();
    }
  }

  private gerakSinema(dt: number): void {
    const s = this.sinema!;
    s.waktu += dt;
    const p = poseSinema(s.waktu, s.awal, this.kontrol.minPolarAngle, this.kontrol.maxPolarAngle);
    const t = this.kontrol.target;
    t.set(p.x, t.y, p.z);
    this.bola.set(p.jarak, p.phi, p.theta);
    this.kamera.position.copy(t).add(this.v.setFromSpherical(this.bola));
    this.kamera.lookAt(t);
  }

  /** Titik tanah yang dilihat kamera (koordinat denah) dan jarak kamera ke sana, untuk suara. */
  titikPandang(): { readonly x: number; readonly y: number; readonly jarak: number } {
    const t = this.kontrol.target;
    return { x: t.x, y: t.z, jarak: this.kamera.position.distanceTo(t) };
  }

  /**
   * Putar kamera mengelilingi titik pandang (radian; positif = isi layar
   * berputar searah jarum jam). Beranimasi halus kecuali `segera`.
   */
  putar(sudut: number, segera = false): void {
    if (segera) this.geserBola(sudut, 0);
    else this.sisaPutar += sudut;
  }

  /** Kembali ke arah & kemiringan awal (jarak zoom dan titik pandang tetap). */
  kembalikanArah(): void {
    this.bola.setFromVector3(this.v.copy(this.kamera.position).sub(this.kontrol.target));
    this.sisaPutar = selisihSudut(this.bola.theta, this.bolaAwal.theta);
    this.sisaMiring = this.bolaAwal.phi - this.bola.phi;
  }

  /** Arah utara (−y denah) di layar: radian searah jarum jam dari atas layar, untuk kompas. */
  arahUtaraLayar(): number {
    const t = this.kontrol.target;
    const a = this.proyeksi(t.x, t.z, 0);
    const b = this.proyeksi(t.x, t.z - 5, 0);
    return Math.atan2(b.x - a.x, -(b.y - a.y));
  }

  /** Geser kamera di permukaan bola sekitar titik pandang: putar (theta) & miring (phi, dibatasi). */
  private geserBola(dTheta: number, dPhi: number): void {
    const t = this.kontrol.target;
    this.bola.setFromVector3(this.v.copy(this.kamera.position).sub(t));
    // Isi layar searah jarum jam = kamera berputar berlawanan di sekitar sumbu tegak.
    this.bola.theta += dTheta;
    this.bola.phi = THREE.MathUtils.clamp(this.bola.phi + dPhi, this.kontrol.minPolarAngle, this.kontrol.maxPolarAngle);
    this.kamera.position.copy(t).add(this.v.setFromSpherical(this.bola));
    this.kamera.lookAt(t);
  }

  /** Animasi putar/miring yang tersisa: mendekat eksponensial, selesai dalam ±0,4 dtk. */
  private animasiArah(dt: number): void {
    if (Math.abs(this.sisaPutar) < 1e-4 && Math.abs(this.sisaMiring) < 1e-4) {
      this.sisaPutar = this.sisaMiring = 0;
      return;
    }
    const k = Math.min(1, dt * 9);
    const dTheta = this.sisaPutar * k;
    const dPhi = this.sisaMiring * k;
    this.sisaPutar -= dTheta;
    this.sisaMiring -= dPhi;
    this.geserBola(dTheta, dPhi);
  }

  /** Pelintir dua jari di layar sentuh memutar peta mengikuti jari. */
  private pasangPelintir(): void {
    const el = this.renderer.domElement;
    const posisi = (e: PointerEvent): [number, number] => {
      const r = el.getBoundingClientRect();
      return [e.clientX - r.left, e.clientY - r.top];
    };
    el.addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'touch') this.pelintir.turun(e.pointerId, ...posisi(e));
    });
    el.addEventListener('pointermove', (e) => {
      if (e.pointerType !== 'touch') return;
      const sudut = this.pelintir.gerak(e.pointerId, ...posisi(e));
      if (sudut !== 0) this.putar(sudut, true);
    });
    const angkat = (e: PointerEvent): void => this.pelintir.angkat(e.pointerId);
    el.addEventListener('pointerup', angkat);
    el.addEventListener('pointercancel', angkat);
  }

  proyeksi(x: number, y: number, h: number): { x: number; y: number; terlihat: boolean } {
    this.v.set(x, h, y).project(this.kamera);
    const terlihat = this.v.z < 1 && Math.abs(this.v.x) < 1.1 && Math.abs(this.v.y) < 1.1;
    return { x: ((this.v.x + 1) / 2) * this.lebar, y: ((1 - this.v.y) / 2) * this.tinggi, terlihat };
  }

  /**
   * Salinan gambar adegan sekarang, tanpa label DOM: render sekali lalu langsung
   * disalin, sebelum browser membersihkan kanvas WebGL (preserveDrawingBuffer mati).
   */
  foto(): HTMLCanvasElement {
    this.render(0);
    const sumber = this.renderer.domElement;
    const c = document.createElement('canvas');
    c.width = sumber.width;
    c.height = sumber.height;
    c.getContext('2d')?.drawImage(sumber, 0, 0);
    return c;
  }

  render(dt: number): void {
    this.waktu += dt;
    if (this.sinema) {
      this.gerakSinema(dt);
    } else {
      this.animasiArah(dt);
      this.kontrol.update(dt);
      this.jepitTarget();
    }
    // Pita fokus melebar saat kamera mendekat supaya detail (orang, bus) tetap tajam.
    const jarak = this.kamera.position.distanceTo(this.kontrol.target);
    // Kabut mulai sedikit di belakang titik pandang, jadi terminal tidak memudar saat kamera menjauh.
    const kabut = this.scene.fog;
    if (kabut instanceof THREE.Fog) {
      kabut.near = jarak + 70;
      kabut.far = jarak + 280;
    }
    const t = THREE.MathUtils.clamp((jarak - 10) / 50, 0, 1);
    this.tiltShift.focusArea = THREE.MathUtils.lerp(0.95, 0.62, t);
    this.tiltShift.feather = THREE.MathUtils.lerp(0.25, 0.4, t);
    this.lingkungan.perbarui(this.renderer, dt);
    this.scene.environmentIntensity = (this.intensitasLingkungan * KECERAHAN_ACUAN) / this.lingkungan.kecerahan;
    this.perbaruiBayangan();
    this.renderer.info.reset();
    if (TINGKAT[this.tingkat]!.efek) this.composer.render(dt);
    else this.renderer.render(this.scene, this.kamera);
    this.pantauKualitas(dt);
    if (import.meta.env.DEV && ++this.frame === 120) {
      const info = this.renderer.info.render;
      console.info(`[grafis] draw call ${info.calls}, segitiga ${info.triangles}, tingkat kualitas ${this.tingkat}`);
    }
  }

  /**
   * Arahkan peta bayangan ke tanah yang sedang terlihat: jejak pojok-pojok layar di
   * tanah diproyeksikan ke bidang tegak lurus cahaya, lalu dibungkus persegi. Pusatnya
   * digeser per texel supaya tepi bayangan tidak berkilau saat kamera bergeser.
   */
  private perbaruiBayangan(): void {
    const t = TINGKAT[this.tingkat]!;
    if (t.bayangan === 0) return;
    const bayangan = this.matahari.shadow;
    if (this.arahBayangan.distanceToSquared(this.arahCahaya) > AMBANG_ARAH_CAHAYA ** 2) {
      this.arahBayangan.copy(this.arahCahaya);
      this.bayanganBerubah = true;
    }
    const w = this.arahBayangan;
    // Jejak pandangan: pojok layar di tanah, sinar yang tidak mengenai tanah dipotong.
    const posisi = this.kamera.position;
    const jarakMaks = posisi.distanceTo(this.kontrol.target) * 1.8;
    const jejak = POJOK_LAYAR.map(([nx, ny]): Vektor3 => {
      const arah = this.v.set(nx, ny, 0.5).unproject(this.kamera).sub(posisi).normalize();
      const s = arah.y < -1e-3 ? Math.min(-posisi.y / arah.y, jarakMaks) : jarakMaks;
      const p = arah.multiplyScalar(s).add(posisi);
      return [p.x, p.y, p.z];
    });
    const t0 = this.kontrol.target;
    const { pusat, setengah, texel } = bingkaiBayangan(jejak, [w.x, w.y, w.z], [t0.x, t0.y, t0.z], {
      ukuranPeta: bayangan.mapSize.x,
      min: BAYANGAN_MIN,
      maks: BAYANGAN_MAKS,
      langkah: 4,
      margin: 3,
    });
    this.v.set(...pusat);
    if (setengah !== this.setengahBayangan || !this.v.equals(this.pusatBayangan)) {
      this.setengahBayangan = setengah;
      this.pusatBayangan.copy(this.v);
      this.bayanganBerubah = true;
    }
    if (this.bayanganBerubah) {
      this.matahari.target.position.copy(this.pusatBayangan);
      this.matahari.position.copy(this.pusatBayangan).addScaledVector(w, JARAK_CAHAYA);
      const cam = bayangan.camera;
      cam.left = cam.bottom = -setengah;
      cam.right = cam.top = setengah;
      cam.updateProjectionMatrix();
      // Texel makin besar saat zoom jauh: geser normal sebanding supaya tidak berjerawat.
      bayangan.normalBias = texel;
    }
    bayangan.needsUpdate = this.bayanganBerubah || ++this.nomorFrame % t.selangBayangan === 0;
    this.bayanganBerubah = false;
  }

  /** Target geser tetap di sekitar terminal; kamera ikut bergeser sejauh koreksi. */
  private jepitTarget(): void {
    const t = this.kontrol.target;
    const x = THREE.MathUtils.clamp(t.x, BATAS_TARGET.x0, BATAS_TARGET.x1);
    const z = THREE.MathUtils.clamp(t.z, BATAS_TARGET.z0, BATAS_TARGET.z1);
    const dx = x - t.x;
    const dz = z - t.z;
    const dy = -t.y;
    if (dx !== 0 || dz !== 0 || dy !== 0) {
      t.set(x, 0, z);
      this.kamera.position.x += dx;
      this.kamera.position.y += dy;
      this.kamera.position.z += dz;
    }
  }

  private pantauKualitas(dt: number): void {
    // Jeda app/tab sudah menghentikan loop (main.ts), jadi frame lambat di sini
    // memang lambat; hanya lompatan ekstrem yang diabaikan. Empat detik pertama
    // (unggah tekstur, kompilasi pass efek) tidak dihitung supaya HP kuat tidak ikut turun kualitas.
    if (dt <= 0 || dt > 5 || this.waktu < 4 || this.tingkatTerkunci !== null) return;
    this.rataFrame += (Math.min(dt, 1) - this.rataFrame) * 0.05;
    if (this.rataFrame > 1 / 38) {
      if (this.lambatSejak === 0) this.lambatSejak = this.waktu;
      if (this.waktu - this.lambatSejak > 2.5 && this.waktu - this.turunTerakhir > 4 && this.tingkat < TINGKAT.length - 1) {
        this.turunTerakhir = this.waktu;
        this.lambatSejak = 0;
        this.terapkanTingkat(this.tingkat + 1);
        console.info(`[grafis] kualitas diturunkan ke tingkat ${this.tingkat}`);
      }
    } else {
      this.lambatSejak = 0;
    }
  }
}
