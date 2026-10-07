/**
 * Penyedia analitik: Google Analytics 4 lewat gtag.js (tanpa SDK Firebase,
 * jadi pemain tamu tidak ikut mengunduh Firebase). Skrip baru dimuat bila
 * ID_GA4 diisi, dan hanya di web: APK belum punya aliran data sendiri.
 *
 * Tanpa sinyal Google & personalisasi iklan (tidak ada profil iklan dari
 * game ini). `?analitik=debug` di URL: peristiwa juga tampil di DebugView GA4
 * dan di konsol (juga saat server dev, yang biasanya tidak mengirim apa pun).
 */
import { Capacitor } from '@capacitor/core';
import type { Analitik, DataAnalitik } from '../app/analitik';
import { ID_GA4 } from '../config/analitik.config';

type FungsiGtag = (...argumen: unknown[]) => void;

export function buatAnalitik(): Analitik {
  const debug = new URLSearchParams(location.search).get('analitik') === 'debug';
  const log = (nama: string, data?: DataAnalitik): void => console.debug('[analitik]', nama, data ?? {});
  if (!ID_GA4 || Capacitor.isNativePlatform() || (import.meta.env.DEV && !debug)) {
    return { catat: import.meta.env.DEV ? log : () => {} };
  }

  const w = window as unknown as { dataLayer?: unknown[] };
  const antrean = (w.dataLayer ??= []);
  // gtag.js membaca objek `arguments` (bukan array), persis seperti cuplikan resminya.
  const gtag: FungsiGtag = function () {
    // eslint-disable-next-line prefer-rest-params
    antrean.push(arguments);
  };
  gtag('js', new Date());
  gtag('config', ID_GA4, {
    app_version: __VERSI_APP__,
    allow_google_signals: false,
    allow_ad_personalization_signals: false,
    ...(debug ? { debug_mode: true } : {}),
  });
  const skrip = document.createElement('script');
  skrip.async = true;
  skrip.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(ID_GA4)}`;
  document.head.append(skrip);

  return {
    catat(nama, data) {
      gtag('event', nama, data ?? {});
      if (debug) log(nama, data);
    },
  };
}
