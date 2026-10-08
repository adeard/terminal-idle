import { describe, expect, it } from 'vitest';

/**
 * Batas antar lapisan. Pemakaian global DOM di sim/, config/, dan app/ juga
 * dicegah oleh tsconfig.sim.json (tanpa lib DOM).
 */
// Opsi import.meta.glob harus literal (dibaca statis oleh Vite).
const MURNI = import.meta.glob<string>(['../src/sim/**/*.ts', '../src/config/**/*.ts', '../src/app/**/*.ts'], { query: '?raw', import: 'default', eager: true });
const UI = import.meta.glob<string>('../src/ui/**/*.ts', { query: '?raw', import: 'default', eager: true });
const GAME = import.meta.glob<string>('../src/game/**/*.ts', { query: '?raw', import: 'default', eager: true });

const IMPORT_RENDER_ATAU_PLATFORM = /from\s+['"](three|three\/[^'"]*|postprocessing|@capacitor\/[^'"]*|\.\.\/(game|ui|platform)\/[^'"]*)['"]/;
const IMPORT_3D = /from\s+['"](three|three\/[^'"]*|postprocessing)['"]/;
/** Modul game yang sengaja murni (tanpa three.js) supaya logikanya bisa dites di Node. */
const GAME_MURNI = ['tata-letak.ts', 'dunia-visual.ts', 'jalur.ts', 'laju.ts', 'langit.ts', 'suara.ts', 'rombongan.ts', 'kamera.ts', 'kehidupan-malam.ts', 'jadwal.ts', 'bayangan.ts', 'label-bus.ts', 'label-loket.ts', 'kas-visual.ts', 'telolet.ts', 'livery.ts', 'aset.ts', 'aset-data.ts', 'kelas-bus.ts', 'cache-sel.ts', 'antarpulau.ts', 'sinema.ts', 'perluasan-adegan.ts', 'kembang-api.ts'];

describe('arsitektur', () => {
  it('menemukan file di tiap lapisan', () => {
    expect(Object.keys(MURNI).length).toBeGreaterThanOrEqual(7);
    expect(Object.keys(UI).length).toBeGreaterThanOrEqual(4);
    expect(Object.keys(GAME).length).toBeGreaterThanOrEqual(3);
  });

  for (const [file, isi] of Object.entries(MURNI)) {
    it(`${file}: tidak import three.js, Capacitor, atau layer rendering/UI/platform`, () => {
      expect(isi).not.toMatch(IMPORT_RENDER_ATAU_PLATFORM);
    });
  }

  for (const [file, isi] of Object.entries(UI)) {
    it(`${file}: UI overlay tidak memakai three.js`, () => {
      expect(isi).not.toMatch(IMPORT_3D);
    });
  }

  for (const [file, isi] of Object.entries(GAME)) {
    it(`${file}: adegan hanya membaca state (tidak mengirim aksi, tidak memanggil fungsi pengubah state)`, () => {
      expect(isi).not.toMatch(/\.kirim\(|\bterapkanAksi\b|\bbeliUpgrade\b|\brekrutKepala\b|\btick\(/);
      expect(isi).not.toMatch(/import\s+\{[^}]*\bPengendaliGame\b/);
    });
    if (GAME_MURNI.some((n) => file.endsWith(`/${n}`))) {
      it(`${file}: logika denah/keramaian tetap bebas three.js`, () => {
        expect(isi).not.toMatch(IMPORT_3D);
      });
    }
  }
});
