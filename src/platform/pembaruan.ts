/**
 * Deteksi versi baru untuk versi web (PWA). Service worker (vite-plugin-pwa,
 * mode 'prompt') mengunduh rilis baru di latar lalu menunggu; game diberi tahu
 * lewat `saatTersedia` dan baru beralih ke versi baru setelah pemain memilih
 * "Perbarui" (lihat popup-pembaruan.ts).
 *
 * Game idle sering dibiarkan terbuka berjam-jam, jadi selain saat dibuka,
 * pembaruan diperiksa berkala dan setiap kali tab/app kembali terlihat.
 *
 * Di APK (Capacitor) & mode dev tidak aktif: kode game ikut di dalam APK, jadi
 * pembaruannya nanti lewat Play Store/unduhan APK.
 */
import { Capacitor } from '@capacitor/core';
import { bacaInfoRilis, type InfoRilis } from '../app/pembaruan';

/** Selang pemeriksaan berkala saat game terbuka. */
const SELANG_PERIKSA_MS = 30 * 60 * 1000;
/** Jeda minimum antarpemeriksaan saat tab/app kembali terlihat. */
const JEDA_PERIKSA_TERLIHAT_MS = 60 * 1000;

export interface OpsiPembaruan {
  /**
   * Versi baru sudah diunduh dan siap. `info` null bila versi.json tidak terbaca;
   * `aktifkan` beralih ke versi baru lalu memuat ulang halaman.
   */
  saatTersedia(info: InfoRilis | null, aktifkan: () => Promise<void>): void;
}

/** @returns false bila tidak aktif (APK, mode dev, atau browser tanpa service worker). */
export async function pasangPembaruan(opsi: OpsiPembaruan): Promise<boolean> {
  if (!import.meta.env.PROD || Capacitor.isNativePlatform() || !('serviceWorker' in navigator)) return false;
  const { registerSW } = await import('virtual:pwa-register');
  let terakhirDiperiksa = 0;
  const perbaruiSW = registerSW({
    onNeedRefresh: () => void ambilInfoRilis().then((info) => opsi.saatTersedia(info, () => perbaruiSW(true))),
    onRegisteredSW: (_url, reg) => {
      if (!reg) return;
      const periksa = (): void => {
        if (!navigator.onLine) return;
        terakhirDiperiksa = Date.now();
        void reg.update().catch(() => undefined);
      };
      setInterval(periksa, SELANG_PERIKSA_MS);
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible' && Date.now() - terakhirDiperiksa > JEDA_PERIKSA_TERLIHAT_MS) periksa();
      });
    },
    onRegisterError: (e: unknown) => console.warn('[pembaruan] service worker gagal didaftarkan', e),
  });
  return true;
}

/** versi.json milik rilis terbaru di server (tidak di-cache service worker). */
async function ambilInfoRilis(): Promise<InfoRilis | null> {
  try {
    const r = await fetch(`versi.json?t=${Date.now()}`, { cache: 'no-store' });
    return r.ok ? bacaInfoRilis(await r.json()) : null;
  } catch {
    return null;
  }
}
