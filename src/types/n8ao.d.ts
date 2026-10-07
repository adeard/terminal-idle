/**
 * Deklarasi minimal untuk pustaka `n8ao` (tidak menyertakan tipe TypeScript).
 * Hanya bagian yang dipakai adegan.ts; diverifikasi di node_modules/n8ao/dist/N8AO.js
 * v2.0.1: N8AOPostPass extends Pass (postprocessing), constructor(scene, camera, w, h),
 * setQualityMode(mode), setSize(w, h), configuration.{aoRadius, distanceFalloff,
 * intensity, color, halfRes, depthAwareUpsampling, gammaCorrection}.
 */
declare module 'n8ao' {
  import type { Camera, Color, Scene } from 'three';
  import { Pass } from 'postprocessing';

  export interface KonfigurasiN8AO {
    aoRadius: number;
    distanceFalloff: number;
    intensity: number;
    color: Color;
    halfRes: boolean;
    depthAwareUpsampling: boolean;
    gammaCorrection: boolean;
    screenSpaceRadius: boolean;
  }

  export class N8AOPostPass extends Pass {
    constructor(scene: Scene, camera: Camera, width?: number, height?: number);
    configuration: KonfigurasiN8AO;
    setQualityMode(mode: 'Performance' | 'Low' | 'Medium' | 'High' | 'Ultra'): void;
    setSize(width: number, height: number): void;
  }
}
