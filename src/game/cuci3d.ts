/**
 * Efek cuci bus di petak parkir (hanya membaca BusVisual, lihat petugasCuci di
 * dunia-visual.ts): gumpalan busa sabun muncul di badan bus mengikuti langkah
 * kenek lalu luntur saat sopir yang menyusul membilasnya, semprotan air dari
 * sopir ke badan bus, dan genangan basah mengilap di petak yang mengering
 * perlahan setelah bus pergi. Semuanya InstancedMesh (3 draw call).
 */
import * as THREE from 'three';
import { lokalBusKeDunia, petugasCuci, saatLewat, tingkatKotor, titikLingkarCuci, type BusVisual } from './dunia-visual';
import { langkahHalus } from './langit';
import { BUS, CUCI, PARKIR_SERONG } from './tata-letak';

const BUSA_PER_BUS = 28;
const AIR_PER_BUS = 14;
const MAKS_BUS_DICUCI = PARKIR_SERONG.pusatX.length;
/** Detik sampai genangan di petak kering setelah bilas selesai. */
const DETIK_KERING = 40;
const H_GENANGAN = 0.03;
/** Tinggi badan bus terminal (lihat BUS_TERMINAL di aset.ts). */
const TINGGI_BUS = 0.8;

/** Pecahan acak tetap per indeks (tanpa generator acak). */
const pecahan = (n: number, k: number): number => (((n * k) % 1) + 1) % 1;

/**
 * Titik lokal [sepanjang, ke samping] di kulit badan bus yang paling dekat
 * dengan titik lintasan kenek (sisi panjang atau ujung depan/belakang).
 */
function titikBadan(a: number, l: number): [number, number] {
  const setengahP = BUS.panjang / 2 + 0.012;
  const setengahL = BUS.lebar / 2 + 0.012;
  if (Math.abs(a) >= CUCI.jarakUjung - 1e-6) return [Math.sign(a) * setengahP, Math.max(-setengahL + 0.05, Math.min(setengahL - 0.05, l))];
  return [Math.max(-setengahP + 0.05, Math.min(setengahP - 0.05, a)), Math.sign(l) * setengahL];
}

function teksturGenangan(): THREE.CanvasTexture {
  const U = 64;
  const c = document.createElement('canvas');
  c.width = U;
  c.height = U;
  const ctx = c.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D tidak tersedia');
  const g = ctx.createRadialGradient(U / 2, U / 2, U * 0.2, U / 2, U / 2, U / 2);
  g.addColorStop(0, '#ffffff');
  g.addColorStop(0.7, '#b0b0b0');
  g.addColorStop(1, '#000000');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, U, U);
  return new THREE.CanvasTexture(c);
}

export class PencucianBus {
  readonly objek = new THREE.Group();
  private readonly busa: THREE.InstancedMesh;
  private readonly air: THREE.InstancedMesh;
  private readonly genangan: THREE.InstancedMesh;
  /** Kebasahan tiap petak (0–1). */
  private readonly basah: number[] = PARKIR_SERONG.pusatX.map(() => 0);
  private readonly m = new THREE.Matrix4();
  private readonly q = new THREE.Quaternion();
  private readonly qNol = new THREE.Quaternion();
  private readonly p = new THREE.Vector3();
  private readonly s = new THREE.Vector3();
  private readonly sumbuY = new THREE.Vector3(0, 1, 0);

  constructor() {
    const geoBusa = new THREE.IcosahedronGeometry(1, 0);
    geoBusa.scale(1, 0.75, 1);
    this.busa = new THREE.InstancedMesh(geoBusa, new THREE.MeshStandardMaterial({ color: 0xf8fbff, roughness: 0.95 }), BUSA_PER_BUS * MAKS_BUS_DICUCI);
    this.air = new THREE.InstancedMesh(
      new THREE.SphereGeometry(1, 5, 4),
      new THREE.MeshBasicMaterial({ color: 0xcfe8ff, transparent: true, opacity: 0.8, depthWrite: false }),
      AIR_PER_BUS * MAKS_BUS_DICUCI,
    );
    const geoGenangan = new THREE.PlaneGeometry(1, 1);
    geoGenangan.rotateX(-Math.PI / 2);
    this.genangan = new THREE.InstancedMesh(
      geoGenangan,
      new THREE.MeshStandardMaterial({
        color: 0x12181e,
        roughness: 0.12,
        metalness: 0.15,
        alphaMap: teksturGenangan(),
        transparent: true,
        opacity: 0.72,
        depthWrite: false,
        polygonOffset: true,
        polygonOffsetFactor: -3,
        polygonOffsetUnits: -3,
      }),
      MAKS_BUS_DICUCI,
    );
    this.busa.castShadow = true;
    this.air.renderOrder = 3;
    this.genangan.renderOrder = 1;
    this.genangan.receiveShadow = true;
    for (const mesh of [this.busa, this.air, this.genangan]) {
      mesh.frustumCulled = false;
      mesh.count = 0;
      this.objek.add(mesh);
    }
  }

  perbarui(bus: readonly BusVisual[], dt: number, waktu: number): void {
    let nBusa = 0;
    let nAir = 0;
    const dibilas = new Set<number>();
    for (const b of bus) {
      if (b.fase !== 'parkir' || b.petak < 0) continue;
      const p = b.cuci;
      const awalBilas = saatLewat('sopir', 0);
      if (p >= awalBilas) {
        dibilas.add(b.petak);
        this.basah[b.petak] = Math.max(this.basah[b.petak]!, langkahHalus(awalBilas, saatLewat('sopir', 1), p));
      }
      if (!(p > 0 && p < 1) || b.debu <= 0) continue;

      // Busa: muncul saat kenek melewati titiknya, luntur saat sopir membilasnya.
      for (let i = 0; i < BUSA_PER_BUS && nBusa < this.busa.instanceMatrix.count; i++) {
        const u = (i + 0.5) / BUSA_PER_BUS;
        const tSabun = saatLewat('kenek', u);
        const tBilas = saatLewat('sopir', u);
        const ada = langkahHalus(tSabun, tSabun + 0.03, p) * (1 - langkahHalus(tBilas, tBilas + 0.04, p));
        if (ada < 0.02) continue;
        const [la, ll] = titikLingkarCuci(u);
        const [a, l] = titikBadan(la + (pecahan(i, 0.618) - 0.5) * 0.2, ll);
        const [x, y] = lokalBusKeDunia(b, a, l);
        const h = 0.1 + pecahan(i, 0.377) * TINGGI_BUS * 0.55;
        const r = (0.035 + pecahan(i, 0.719) * 0.03) * ada;
        this.m.compose(this.p.set(x, 0.02 + h, y), this.qNol, this.s.set(r, r, r));
        this.busa.setMatrixAt(nBusa++, this.m);
      }

      // Semprotan air dari tangan sopir ke badan bus selama ia berkeliling membilas.
      const sopir = petugasCuci(p).find((q) => q.peran === 'sopir' && q.bekerja);
      if (!sopir || tingkatKotor(b) <= 0) continue;
      const [ka, kl] = sopir.lokal;
      const [ta, tl] = titikBadan(ka, kl);
      const [ax, ay] = lokalBusKeDunia(b, ka + (ta - ka) * 0.15, kl + (tl - kl) * 0.15);
      for (let d = 0; d < AIR_PER_BUS && nAir < this.air.instanceMatrix.count; d++) {
        const t = (waktu * 2.6 + d / AIR_PER_BUS) % 1;
        const geser = (pecahan(d, 0.618) - 0.5) * 0.45;
        const sisiPanjang = Math.abs(ta) < BUS.panjang / 2;
        const [bx, by] = lokalBusKeDunia(b, ta + (sisiPanjang ? geser : 0), tl + (sisiPanjang ? 0 : geser * 0.4));
        const hAwal = 0.26;
        const hAkhir = 0.18 + pecahan(d, 0.43) * 0.4;
        const h = hAwal + (hAkhir - hAwal) * t + Math.sin(Math.PI * t) * 0.1;
        const r = t > 0.85 ? 0.03 : 0.014;
        this.m.compose(this.p.set(ax + (bx - ax) * t, 0.02 + h, ay + (by - ay) * t), this.qNol, this.s.set(r, r, r));
        this.air.setMatrixAt(nAir++, this.m);
      }
    }

    // Genangan basah per petak: melebar selama bilas, menyusut saat mengering.
    let nGenangan = 0;
    PARKIR_SERONG.pusatX.forEach((sx, i) => {
      if (!dibilas.has(i)) this.basah[i] = Math.max(0, this.basah[i]! - dt / DETIK_KERING);
      const w = this.basah[i]!;
      if (w < 0.01) return;
      const skala = 0.45 + 0.55 * Math.sqrt(w);
      this.q.setFromAxisAngle(this.sumbuY, -PARKIR_SERONG.sudut);
      this.m.compose(this.p.set(sx, H_GENANGAN, PARKIR_SERONG.pusatY), this.q, this.s.set(3.3 * skala, 1, 1.45 * skala));
      this.genangan.setMatrixAt(nGenangan++, this.m);
    });

    const selesai = (mesh: THREE.InstancedMesh, n: number): void => {
      mesh.count = n;
      mesh.instanceMatrix.needsUpdate = true;
    };
    selesai(this.busa, nBusa);
    selesai(this.air, nAir);
    selesai(this.genangan, nGenangan);
  }
}
