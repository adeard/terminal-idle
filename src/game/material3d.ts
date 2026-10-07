/**
 * Material dunia 3D. Tanah (bidang besar yang menutupi layar) memakai
 * MeshLambertMaterial yang ringan; bangunan & kendaraan MeshStandardMaterial
 * (PBR) supaya pantulan environment map & bayangan terlihat meyakinkan.
 */
import * as THREE from 'three';
import { WARNA_TAHAP } from '../config/tema';
import type { TahapId } from '../sim/tahap';
import type { PersegiUv } from './aset';
import { KELOMPOK_PARKIR } from './tata-letak';
import {
  teksturAspal,
  teksturAtapLogam,
  teksturBata,
  teksturBendera,
  teksturBeton,
  teksturFasadKaca,
  teksturFasadKota,
  teksturGenteng,
  teksturJadwal,
  teksturJam,
  teksturJendelaMalam,
  teksturLantaiGranit,
  teksturLantaiPeron,
  teksturMakro,
  teksturPaving,
  teksturPelepah,
  teksturPlester,
  teksturRumput,
  teksturTeks,
  teksturTenda,
  type OpsiTeks,
} from './tekstur3d';

/** Satuan dunia per satu pengulangan tekstur (dipakai uvDunia). */
export const SKALA_UV = {
  rumput: 4,
  aspal: 2.5,
  paving: 1.4,
  beton: 1.2,
  peron: 1,
  genteng: 0.9,
  plester: 1.2,
  bata: 0.6,
  kota: 5.6,
  /** Atap logam: 8 lipatan per ulangan → lipatan tiap 0,1 unit (±50 cm). */
  logamU: 0.8,
  logamV: 2,
  /** Dinding tirai kaca: satu modul (4 kolom × 2 baris panel) per unit. */
  kaca: 1,
  granit: 1.2,
} as const;

/** Papan nama: semua teks berbagi satu atlas & material (satu draw call). */
export interface PapanTeks {
  readonly material: THREE.Material;
  readonly uv: PersegiUv;
}

export interface PustakaMaterial {
  readonly rumput: THREE.Material;
  readonly rumputTaman: THREE.Material;
  readonly aspal: THREE.Material;
  readonly aspalPangkalan: THREE.Material;
  readonly paving: THREE.Material;
  readonly pavingMerah: THREE.Material;
  readonly pavingAntrean: THREE.Material;
  readonly pavingGang: THREE.Material;
  readonly beton: THREE.Material;
  readonly peron: THREE.Material;
  readonly taktil: THREE.Material;
  readonly marka: THREE.Material;
  readonly markaKuning: THREE.Material;
  readonly tali: THREE.Material;
  readonly genteng: THREE.Material;
  readonly gentengSayap: THREE.Material;
  readonly bubungan: THREE.Material;
  readonly plester: THREE.Material;
  readonly plesterGelap: THREE.Material;
  readonly bata: THREE.Material;
  readonly batu: THREE.Material;
  readonly kayu: THREE.Material;
  readonly besi: THREE.Material;
  readonly besiGelap: THREE.Material;
  readonly kaca: THREE.Material;
  readonly emas: THREE.Material;
  readonly semak: THREE.Material;
  readonly daun: THREE.Material;
  readonly batang: THREE.Material;
  readonly bulu: THREE.Material;
  /** Bayangan kontak dipanggang (hitam, alpha per verteks). */
  readonly kontak: THREE.Material;
  readonly pelepah: THREE.Material;
  readonly pelepahKedalaman: THREE.Material;
  readonly tenda: THREE.Material;
  readonly atapKios: THREE.Material;
  readonly kios: readonly THREE.Material[];
  readonly kotaFasad: readonly THREE.Material[];
  readonly rukoDinding: readonly THREE.Material[];
  readonly atapRumah: readonly THREE.Material[];
  readonly kendaraan: THREE.Material;
  readonly merahSpbu: THREE.Material;
  readonly atapKota: THREE.Material;
  readonly masjid: THREE.Material;
  readonly kubah: THREE.Material;
  readonly hijauGelap: THREE.Material;
  readonly biruPos: THREE.Material;
  readonly lampuMenyala: THREE.Material;
  readonly jam: THREE.Material;
  readonly atapMenara: THREE.Material;
  readonly bendera: THREE.Material;
  readonly kanopi: Readonly<Record<TahapId, THREE.Material>>;
  readonly kanopiRangka: THREE.Material;
  /** Terminal terpadu: atap logam, tirai kaca, panel aluminium, kaca tembus pandang, lantai granit. */
  readonly atapLogam: THREE.Material;
  readonly fasadKaca: THREE.Material;
  readonly panel: THREE.Material;
  readonly kacaAtap: THREE.Material;
  readonly kacaDinding: THREE.Material;
  readonly lantaiGranit: THREE.Material;
  readonly granit: THREE.Material;
  readonly kursi: readonly THREE.Material[];
  /** Aula loket: dinding dalam (plester terang), meja loket (warna tahap loket), tali pembatas antrean. */
  readonly dindingDalam: THREE.Material;
  readonly mejaLoket: THREE.Material;
  readonly sabuk: THREE.Material;
  /** Warna tiap kelompok jurusan di pangkalan (tanda lantai & papan), urut KELOMPOK_PARKIR. */
  readonly kelompokParkir: readonly THREE.Material[];
  readonly pintuGelap: THREE.Material;
  readonly layar: THREE.Material;
  readonly jadwal: THREE.Material;
  readonly air: THREE.Material;
  readonly percikan: THREE.Material;
  /** Tekstur atlas mentah (sisi bus disusun ulang dari sini di kendaraan3d.ts). */
  readonly teksturAtlas: THREE.Texture;
  teks(teks: string, opsi: OpsiTeks): PapanTeks;
  /**
   * Nyalakan cahaya malam (0 = siang, 1 = malam penuh): lampu jalan, jendela
   * gedung kota, lantai & dinding aula, kaca terminal, layar, papan nama.
   * Hanya mengubah emissiveIntensity, jadi shader tidak dikompilasi ulang.
   */
  aturMalam(malam: number): void;
  /** Permukaan terbuka basah kena hujan (0 = kering, 1 = basah kuyup): aspal, paving, rumput, genteng menggelap. */
  aturBasah(basah: number): void;
}

type MaterialBercahaya = THREE.MeshStandardMaterial | THREE.MeshLambertMaterial;

interface CahayaMalam {
  readonly material: MaterialBercahaya;
  readonly siang: number;
  readonly malam: number;
}

export function buatMaterial(renderer: THREE.WebGLRenderer, teksturAtlas: THREE.Texture): PustakaMaterial {
  const aniso = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  const tex = (c: HTMLCanvasElement, ulang = true): THREE.CanvasTexture => {
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    if (ulang) t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.anisotropy = aniso;
    return t;
  };
  const makro = new THREE.CanvasTexture(teksturMakro());
  makro.wrapS = makro.wrapT = THREE.RepeatWrapping;
  /**
   * Variasi makro: warna permukaan dikalikan noise yang diambil per posisi dunia
   * (skala puluhan unit), jadi pengulangan tekstur tidak terlihat sebagai pola.
   */
  const variasiMakro = (mat: THREE.Material, skala: number, kuat: number): void => {
    const s1 = (1 / skala).toFixed(5);
    const s2 = (1 / (skala * 3.7)).toFixed(5);
    mat.onBeforeCompile = (shader) => {
      shader.uniforms['petaMakro'] = { value: makro };
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nvarying vec2 vPosDunia;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nvPosDunia = (modelMatrix * vec4(transformed, 1.0)).xz;');
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', '#include <common>\nvarying vec2 vPosDunia;\nuniform sampler2D petaMakro;')
        .replace(
          '#include <map_fragment>',
          `#include <map_fragment>
          float makroA = texture2D(petaMakro, vPosDunia * ${s1}).r;
          float makroB = texture2D(petaMakro, vPosDunia * ${s2} + 0.37).r;
          diffuseColor.rgb *= mix(${(1 - kuat).toFixed(3)}, ${(1 + kuat).toFixed(3)}, makroA * 0.6 + makroB * 0.4);`,
        );
    };
  };
  const lambert = (map: THREE.Texture | null, color = 0xffffff, bump = 0, makroSkala = 0, makroKuat = 0): THREE.MeshLambertMaterial => {
    const m = new THREE.MeshLambertMaterial({ color, map });
    if (bump > 0 && map) {
      m.bumpMap = map;
      m.bumpScale = bump;
    }
    if (makroSkala > 0) variasiMakro(m, makroSkala, makroKuat);
    return m;
  };
  const standar = (p: THREE.MeshStandardMaterialParameters): THREE.MeshStandardMaterial => new THREE.MeshStandardMaterial({ roughness: 0.85, metalness: 0, ...p });

  const rumput = tex(teksturRumput());
  const aspal = tex(teksturAspal());
  const paving = tex(teksturPaving());
  const pavingMerah = tex(teksturPaving(41, [[176, 96, 72], [164, 86, 64], [188, 106, 80], [158, 82, 60]]));
  const beton = tex(teksturBeton());
  const peron = tex(teksturLantaiPeron());
  const genteng = tex(teksturGenteng());
  const plester = tex(teksturPlester());
  const bata = tex(teksturBata());
  const pelepah = tex(teksturPelepah(), false);

  const kanopi = {} as Record<TahapId, THREE.Material>;
  for (const id of Object.keys(WARNA_TAHAP) as TahapId[]) {
    kanopi[id] = standar({ color: WARNA_TAHAP[id], roughness: 0.25, metalness: 0.1, transparent: true, opacity: 0.55, side: THREE.DoubleSide, depthWrite: false, forceSinglePass: true });
  }

  // Cahaya malam: warna emisif dipasang sekali, kekuatannya diatur tiap frame.
  const nyala: CahayaMalam[] = [];
  const daftar = (mat: THREE.Material, warna: number | null, malam: number, siang = 0): void => {
    const b = mat as MaterialBercahaya;
    if (warna !== null) b.emissive.setHex(warna);
    nyala.push({ material: b, siang, malam });
  };
  // Papan nama menyala dari belakang di malam hari (tiap halaman atlas).
  const atlasTeks = buatAtlasTeks(aniso, (mat) => daftar(mat, null, 0.6));
  const papanTersimpan = new Map<string, PapanTeks>();

  teksturAtlas.colorSpace = THREE.SRGBColorSpace;
  teksturAtlas.anisotropy = aniso;

  const m = {
    rumput: lambert(rumput, 0xf2f2ea, 0, 26, 0.22),
    rumputTaman: lambert(rumput, 0xe2f0cc, 0, 18, 0.14),
    aspal: lambert(aspal, 0xffffff, 0.6, 14, 0.12),
    aspalPangkalan: lambert(aspal, 0xe8e6e2, 0.6, 14, 0.12),
    paving: lambert(paving, 0xffffff, 0.8, 16, 0.1),
    pavingMerah: lambert(pavingMerah, 0xffffff, 0.8),
    pavingAntrean: lambert(paving, 0xcfc6b6, 0.8),
    pavingGang: lambert(paving, 0xe0d8c8, 0.8),
    beton: lambert(beton, 0xffffff, 0.4),
    peron: lambert(peron, 0xffffff, 0.3),
    taktil: lambert(null, 0xf2c230),
    marka: lambert(null, 0xf2f1ea),
    markaKuning: lambert(null, 0xf2c230),
    tali: lambert(null, 0xb91c1c),
    genteng: standar({ map: genteng, bumpMap: genteng, bumpScale: 1.2, roughness: 0.75, color: 0xe6d2c6 }),
    gentengSayap: standar({ map: genteng, bumpMap: genteng, bumpScale: 1.2, roughness: 0.75, color: 0xd7c2b8 }),
    bubungan: standar({ color: 0x7a3a24, roughness: 0.7 }),
    plester: standar({ map: plester }),
    plesterGelap: standar({ map: plester, color: 0xd8ccb4 }),
    bata: standar({ map: bata, bumpMap: bata, bumpScale: 0.8 }),
    batu: standar({ map: beton, color: 0xd9ceb8 }),
    kayu: standar({ color: 0x6e4428, roughness: 0.7 }),
    besi: standar({ color: 0x9aa3ad, roughness: 0.35, metalness: 0.7 }),
    besiGelap: standar({ color: 0x3b4149, roughness: 0.45, metalness: 0.6 }),
    kaca: standar({ color: 0x5f7f96, roughness: 0.06, metalness: 0.3 }),
    emas: standar({ color: 0xd4a017, roughness: 0.3, metalness: 0.9 }),
    semak: standar({ color: 0x3f7f3a, roughness: 0.95 }),
    daun: standar({ vertexColors: true, roughness: 0.95 }),
    batang: standar({ color: 0x6b4a30, roughness: 0.9 }),
    bulu: standar({ color: 0xb07a45, roughness: 0.95 }),
    kontak: new THREE.MeshBasicMaterial({ color: 0x000000, vertexColors: true, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }),
    pelepah: standar({ map: pelepah, alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.9 }),
    pelepahKedalaman: new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map: pelepah, alphaTest: 0.5 }),
    tenda: standar({ map: tex(teksturTenda()), side: THREE.DoubleSide, roughness: 0.8 }),
    atapKios: standar({ color: 0x7c5334 }),
    kios: [0xfde68a, 0xbfdbfe, 0xfecaca, 0xbbf7d0].map((c) => standar({ map: plester, color: c })),
    // Jendela menyala di malam hari lewat emissiveMap bergrid sama dengan fasad.
    kotaFasad: [
      standar({ map: tex(teksturFasadKota(51, [214, 218, 222], [58, 88, 120])), roughness: 0.5, metalness: 0.15, emissiveMap: tex(teksturJendelaMalam(61)), emissive: 0xffffff }),
      standar({ map: tex(teksturFasadKota(52, [226, 210, 182], [70, 90, 110])), roughness: 0.7, emissiveMap: tex(teksturJendelaMalam(62)), emissive: 0xffffff }),
      standar({ map: tex(teksturFasadKota(53, [120, 150, 180], [60, 100, 140])), roughness: 0.25, metalness: 0.35, emissiveMap: tex(teksturJendelaMalam(63)), emissive: 0xffffff }),
    ],
    atapKota: standar({ map: beton, color: 0xb9b7b0 }),
    rukoDinding: [0xf4f1ea, 0xf1e3c3, 0xd8ead0, 0xd5e3ee, 0xf1d9d2, 0xf5eab8].map((c) => standar({ map: plester, color: c })),
    kendaraan: standar({ vertexColors: true, roughness: 0.45, metalness: 0.25 }),
    atapRumah: [
      standar({ map: genteng, bumpMap: genteng, bumpScale: 1.2, roughness: 0.75 }),
      standar({ map: genteng, bumpMap: genteng, bumpScale: 1.2, roughness: 0.75, color: 0xd7c2b8 }),
      standar({ map: genteng, bumpMap: genteng, bumpScale: 1.2, roughness: 0.75, color: 0x9a7e70 }),
      standar({ map: genteng, bumpMap: genteng, bumpScale: 1.2, roughness: 0.75, color: 0xb86a55 }),
      standar({ color: 0x7f8a96, roughness: 0.45, metalness: 0.5 }),
    ],
    merahSpbu: standar({ color: 0xd62828, roughness: 0.5 }),
    masjid: standar({ map: plester, color: 0xfaf6ec }),
    kubah: standar({ color: 0x2e8b57, roughness: 0.35, metalness: 0.4 }),
    hijauGelap: standar({ color: 0x2f5d50 }),
    biruPos: standar({ color: 0x1d4ed8, roughness: 0.5 }),
    lampuMenyala: new THREE.MeshStandardMaterial({ color: 0xfff4d0, emissive: 0xffe6a0, emissiveIntensity: 1.2 }),
    jam: (() => {
      const peta = tex(teksturJam(), false);
      return standar({ map: peta, emissiveMap: peta, emissive: 0xfff6e0, roughness: 0.6 });
    })(),
    atapMenara: standar({ color: 0x3f4650, roughness: 0.6 }),
    bendera: standar({ map: tex(teksturBendera(), false), side: THREE.DoubleSide, roughness: 0.8 }),
    kanopi,
    kanopiRangka: standar({ color: 0xe5e7eb, roughness: 0.4, metalness: 0.6 }),
    atapLogam: standar({ map: tex(teksturAtapLogam()), roughness: 0.38, metalness: 0.55, color: 0xf2f4f7 }),
    fasadKaca: standar({ map: tex(teksturFasadKaca()), roughness: 0.12, metalness: 0.45, envMapIntensity: 1.3 }),
    panel: standar({ color: 0xeef1f4, roughness: 0.45, metalness: 0.3 }),
    kacaAtap: standar({ color: 0x9ccbe4, roughness: 0.08, metalness: 0.1, transparent: true, opacity: 0.14, side: THREE.DoubleSide, depthWrite: false, forceSinglePass: true, envMapIntensity: 0.7 }),
    kacaDinding: standar({ color: 0x8fc3de, roughness: 0.08, metalness: 0.1, transparent: true, opacity: 0.13, side: THREE.DoubleSide, depthWrite: false, forceSinglePass: true, envMapIntensity: 0.7 }),
    lantaiGranit: standar({ map: tex(teksturLantaiGranit()), color: 0xc9bfae, roughness: 0.3, metalness: 0.05 }),
    granit: standar({ map: beton, color: 0x3c424b, roughness: 0.3, metalness: 0.15 }),
    kursi: [0x1f5fd0, 0x0e8f8a].map((c) => standar({ color: c, roughness: 0.5 })),
    dindingDalam: standar({ map: plester, color: 0xf6f1e7 }),
    mejaLoket: standar({ color: WARNA_TAHAP.loket, roughness: 0.55 }),
    sabuk: lambert(null, 0x1e40af),
    kelompokParkir: KELOMPOK_PARKIR.map((g) => lambert(null, g.warna)),
    pintuGelap: standar({ color: 0x1a2027, roughness: 0.3, metalness: 0.4 }),
    layar: new THREE.MeshStandardMaterial({ color: 0x0b1220, emissive: 0x1e3a8a, emissiveIntensity: 0.35, roughness: 0.3 }),
    air: standar({ color: 0x2f86b0, roughness: 0.06, metalness: 0.35, envMapIntensity: 1.4 }),
    percikan: standar({ color: 0xeaf6ff, roughness: 0.2, transparent: true, opacity: 0.55, depthWrite: false }),
    jadwal: (() => {
      const peta = tex(teksturJadwal(), false);
      return new THREE.MeshStandardMaterial({ map: peta, emissiveMap: peta, emissive: 0xffffff, emissiveIntensity: 0.55, roughness: 0.35 });
    })(),
    teksturAtlas,
    teks: (isi: string, opsi: OpsiTeks): PapanTeks => {
      // Papan bertulisan & bergaya sama (mis. deretan ruko) berbagi satu tempat di atlas.
      const kunci = `${isi}|${JSON.stringify(opsi)}`;
      let papan = papanTersimpan.get(kunci);
      if (!papan) {
        papan = atlasTeks.tambah(teksturTeks(isi, opsi));
        papanTersimpan.set(kunci, papan);
      }
      return papan;
    },
  };

  daftar(m.lampuMenyala, null, 3.2, 0.15);
  for (const f of m.kotaFasad) daftar(f, null, 1.1);
  daftar(m.lantaiGranit, 0xffe3b8, 0.3);
  daftar(m.dindingDalam, 0xfff0d6, 0.32);
  daftar(m.mejaLoket, WARNA_TAHAP.loket, 0.25);
  daftar(m.peron, 0xffe8c0, 0.16);
  for (const id of Object.keys(kanopi) as TahapId[]) daftar(kanopi[id], WARNA_TAHAP[id], 0.45);
  daftar(m.kacaAtap, 0xffdcaa, 0.5);
  daftar(m.kacaDinding, 0xffdcaa, 0.55);
  daftar(m.kaca, 0xffd9a0, 0.35);
  daftar(m.jadwal, null, 1.3, 0.55);
  daftar(m.layar, null, 0.9, 0.35);
  daftar(m.jam, null, 0.9);
  const aturMalam = (malam: number): void => {
    for (const c of nyala) c.material.emissiveIntensity = c.siang + (c.malam - c.siang) * malam;
  };
  aturMalam(0);

  // Basah: warna dasar dipasang sekali, digelapkan sebanding kebasahan (tanpa kompilasi ulang shader).
  const basahDaftar: { readonly material: THREE.MeshLambertMaterial | THREE.MeshStandardMaterial; readonly asli: THREE.Color; readonly gelap: number }[] = [];
  const basahkan = (gelap: number, ...mat: THREE.Material[]): void => {
    for (const x of mat) {
      const b = x as THREE.MeshLambertMaterial | THREE.MeshStandardMaterial;
      basahDaftar.push({ material: b, asli: b.color.clone(), gelap });
    }
  };
  basahkan(0.42, m.aspal, m.aspalPangkalan);
  basahkan(0.35, m.paving, m.pavingMerah, m.pavingAntrean, m.pavingGang);
  basahkan(0.3, m.beton, m.marka, m.markaKuning, m.atapKota);
  basahkan(0.18, m.rumput, m.rumputTaman);
  basahkan(0.25, m.genteng, m.gentengSayap, ...m.atapRumah);
  const aturBasah = (basah: number): void => {
    for (const b of basahDaftar) b.material.color.copy(b.asli).multiplyScalar(1 - b.gelap * basah);
  };
  return { ...m, aturMalam, aturBasah };
}

/**
 * Atlas papan nama: kanvas teks disusun (shelf packing) di kanvas 2048².
 * Bila penuh, halaman baru (kanvas + material sendiri) dibuat, jadi papan
 * tambahan tidak pernah menggagalkan pemuatan adegan. Tekstur diunggah saat
 * render pertama, setelah semua papan ditambahkan.
 */
function buatAtlasTeks(aniso: number, saatHalamanBaru: (material: THREE.MeshStandardMaterial) => void): { tambah(c: HTMLCanvasElement): PapanTeks } {
  const U = 2048;
  const JARAK = 4;
  interface Halaman {
    readonly ctx: CanvasRenderingContext2D;
    readonly tekstur: THREE.CanvasTexture;
    readonly material: THREE.MeshStandardMaterial;
    x: number;
    y: number;
    tinggiBaris: number;
  }
  const halamanBaru = (): Halaman => {
    const kanvas = document.createElement('canvas');
    kanvas.width = U;
    kanvas.height = U;
    const ctx = kanvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D tidak tersedia');
    const tekstur = new THREE.CanvasTexture(kanvas);
    tekstur.colorSpace = THREE.SRGBColorSpace;
    tekstur.anisotropy = aniso;
    // Papan nama menyala dari belakang di malam hari (emissiveMap = teksnya sendiri).
    const material = new THREE.MeshStandardMaterial({ map: tekstur, emissiveMap: tekstur, emissive: 0xffffff, emissiveIntensity: 0, roughness: 0.6 });
    saatHalamanBaru(material);
    return { ctx, tekstur, material, x: 0, y: 0, tinggiBaris: 0 };
  };
  let h = halamanBaru();
  return {
    tambah(c) {
      if (c.width > U || c.height > U) throw new Error('papan nama lebih besar dari atlas');
      if (h.x + c.width > U) {
        h.x = 0;
        h.y += h.tinggiBaris + JARAK;
        h.tinggiBaris = 0;
      }
      if (h.y + c.height > U) h = halamanBaru();
      h.ctx.drawImage(c, h.x, h.y);
      const uv: PersegiUv = { u0: (h.x + 0.5) / U, u1: (h.x + c.width - 0.5) / U, v0: 1 - (h.y + c.height - 0.5) / U, v1: 1 - (h.y + 0.5) / U };
      h.x += c.width + JARAK;
      h.tinggiBaris = Math.max(h.tinggiBaris, c.height);
      h.tekstur.needsUpdate = true;
      return { material: h.material, uv };
    },
  };
}
