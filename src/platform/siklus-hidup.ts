/**
 * Event pause/resume aplikasi.
 * - Native: @capacitor/app 'pause' / 'resume' (diverifikasi di definitions.d.ts 7.1.2).
 * - Browser: visibilitychange (tab disembunyikan/ditampilkan) + pagehide (tab ditutup).
 * Pemanggilan ganda (mis. pagehide setelah hidden) disaring di sini, dan
 * SesiGame juga mengabaikan jeda/lanjut ganda.
 */
import { App } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';

export interface PendengarSiklus {
  saatPause(): void;
  saatResume(): void;
}

export async function pasangSiklusHidup(p: PendengarSiklus): Promise<() => void> {
  let dijeda = false;
  const pause = (): void => {
    if (dijeda) return;
    dijeda = true;
    p.saatPause();
  };
  const resume = (): void => {
    if (!dijeda) return;
    dijeda = false;
    p.saatResume();
  };

  if (Capacitor.isNativePlatform()) {
    const hPause = await App.addListener('pause', pause);
    const hResume = await App.addListener('resume', resume);
    return () => {
      void hPause.remove();
      void hResume.remove();
    };
  }

  const saatVisibilitas = (): void => (document.visibilityState === 'hidden' ? pause() : resume());
  document.addEventListener('visibilitychange', saatVisibilitas);
  window.addEventListener('pagehide', pause);
  return () => {
    document.removeEventListener('visibilitychange', saatVisibilitas);
    window.removeEventListener('pagehide', pause);
  };
}
