/**
 * Konfigurasi web Firebase (proyek bustation-a4de9) untuk akun & cloud save.
 * Nilai ini memang publik (ikut terkirim ke browser); yang melindungi data
 * adalah firestore.rules di akar repo. Analytics tidak lewat SDK Firebase
 * (supaya pemain tamu tidak mengunduh Firebase), tapi lewat gtag.js dengan
 * measurementId di analitik.config.ts.
 */
export const FIREBASE = {
  apiKey: 'AIzaSyCVxcjDIVHULZUs6sF2RDiq1Y3pi8ZFY-0',
  authDomain: 'bustation-a4de9.firebaseapp.com',
  projectId: 'bustation-a4de9',
  appId: '1:490709216750:web:abf5d9407d81c03b3132ff',
} as const;

/**
 * Situs resmi. Di sini login memakai authDomain domain sendiri: /__/* diproksikan
 * ke firebaseapp.com oleh functions/__/[[path]].js (Cloudflare Pages). Di tempat
 * lain (localhost, *.pages.dev) tetap memakai `FIREBASE.authDomain`.
 */
export const DOMAIN_SITUS = 'bustation.games';

/** Koleksi Firestore berisi satu dokumen save per pemain: saves/{uid}. */
export const KOLEKSI_SAVE = 'saves';
