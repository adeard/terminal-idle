import { VitePWA } from 'vite-plugin-pwa';
import type { Plugin } from 'vite';
import { defineConfig } from 'vitest/config';
import paket from './package.json' with { type: 'json' };
import { ID_PENERBIT_ADSENSE, idPenerbitSah } from './src/config/iklan.config.ts';
import { RILIS } from './src/config/rilis.config.ts';

const WARNA_LATAR = '#1a2129';

/**
 * versi.json di akar situs: versi rilis ini + catatan "Yang baru". Tidak ikut
 * di-cache service worker, jadi game versi lama selalu membaca milik rilis terbaru
 * (lihat src/platform/pembaruan.ts).
 */
function versiJson(): Plugin {
  return {
    name: 'versi-json',
    apply: 'build',
    generateBundle() {
      const isi = { versi: paket.version, versiMinimal: RILIS.versiMinimal, catatan: RILIS.catatan, dibuat: new Date().toISOString() };
      this.emitFile({ type: 'asset', fileName: 'versi.json', source: `${JSON.stringify(isi, null, 2)}\n` });
    },
  };
}

/**
 * AdSense (src/config/iklan.config.ts): kalau ID penerbit diisi, build memasang meta
 * verifikasi situs di index.html dan /ads.txt (penjual iklan resmi situs ini).
 * ID kosong = tidak ada apa pun dari AdSense di situs.
 */
function adsense(): Plugin {
  const id = ID_PENERBIT_ADSENSE;
  return {
    name: 'adsense',
    apply: 'build',
    transformIndexHtml(html) {
      return idPenerbitSah(id) ? html.replace('</head>', `  <meta name="google-adsense-account" content="${id}" />\n  </head>`) : html;
    },
    generateBundle() {
      if (!idPenerbitSah(id)) return;
      this.emitFile({ type: 'asset', fileName: 'ads.txt', source: `google.com, ${id.replace(/^ca-/, '')}, DIRECT, f08c47fec0942fa0\n` });
    },
  };
}

export default defineConfig({
  // Path relatif: situs bisa di-deploy di subfolder (mis. GitHub Pages) dan tetap jalan di APK.
  base: './',
  define: {
    __VERSI_APP__: JSON.stringify(paket.version),
  },
  server: {
    // API papan peringkat (functions/, server/) saat `npm run dev`: jalankan juga
    // `npx wrangler pages dev dist --compatibility-date=2026-05-03` (port 8788, D1 lokal).
    proxy: { '/api': 'http://127.0.0.1:8788' },
  },
  build: {
    // Adegan 3D (three.js + postprocessing) ±1 MB dalam satu chunk yang dimuat terpisah.
    chunkSizeWarningLimit: 2000,
  },
  plugins: [
    versiJson(),
    adsense(),
    // PWA: bisa dipasang di layar utama & dimainkan offline. Versi baru TIDAK langsung
    // aktif; game menawarkan pembaruan lewat popup (registerType 'prompt').
    VitePWA({
      registerType: 'prompt',
      injectRegister: false,
      // Semua file (termasuk ikon) sudah masuk lewat globPatterns di bawah.
      includeManifestIcons: false,
      manifest: {
        name: 'Bustation: Idle Bus',
        short_name: 'Bustation',
        description: 'Bustation: game idle 3D mengelola terminal bus. Upgrade peron, loket, dan keberangkatan, rekrut Kepala, dan raih penghasilan walau game ditutup.',
        lang: 'id',
        start_url: './',
        scope: './',
        display: 'standalone',
        orientation: 'any',
        background_color: WARNA_LATAR,
        theme_color: WARNA_LATAR,
        icons: [
          { src: 'ikon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'ikon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'ikon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,png,svg,json}'],
        globIgnores: ['versi.json'],
        // /__/* = halaman login Firebase (diproksikan, lihat functions/): jangan dijawab index.html dari cache.
        // /privasi = halaman kebijakan privasi (public/privasi.html), bukan game.
        // /api/* = Pages Functions (papan peringkat).
        navigateFallbackDenylist: [/^\/__\//, /^\/privasi/, /^\/api\//],
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
        cleanupOutdatedCaches: true,
      },
    }),
  ],
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
    // Banyak tes menyimulasikan menit-menit keramaian: sendirian ±1–4 dtk, tapi bisa
    // melewati batas bawaan 5 dtk saat semua file berjalan paralel di mesin yang sibuk.
    testTimeout: 20_000,
  },
});
