/**
 * Penyedia iklan berhadiah:
 * - web dengan ID penerbit AdSense (config/iklan.config.ts): Google H5 Games Ads
 *   (alurnya di app/iklan-h5.ts); `?iklan=uji` memutar iklan uji Google;
 * - `npm run dev`, atau situs dengan `?iklan=contoh`: IKLAN CONTOH (layar
 *   hitung mundur 5 detik yang bisa dilewati) untuk mencoba mekanik hadiah;
 * - selain itu (ID belum diisi, APK): nonaktif, tombol hadiah disembunyikan.
 *   APK nanti memakai AdMob lewat plugin native.
 */
import { Capacitor } from '@capacitor/core';
import { PengaturIklanH5, type JedaReward } from '../app/iklan-h5';
import { TANPA_IKLAN, type HasilIklan, type PenyediaIklan } from '../app/iklan';
import { ID_PENERBIT_ADSENSE, idPenerbitSah } from '../config/iklan.config';
import { TEKS } from '../ui/teks';

/** Lama iklan contoh (detik). */
const LAMA_CONTOH = 5;

export interface OpsiIklan {
  /** Wadah overlay (iklan contoh digambar di sini). */
  readonly akar: HTMLElement;
  /** Dipanggil sebelum & sesudah iklan (mis. membisukan suara game). */
  readonly sebelum?: () => void;
  readonly sesudah?: () => void;
}

/** Skrip Ad Placement API (AdSense); `client` = ID penerbit. */
const URL_SKRIP_ADSENSE = 'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js';
/** Kalau Google tidak memanggil onReady, siaga pertama tetap diminta sekian setelah skrip termuat. */
const CADANGAN_SIAP_MS = 5_000;

export type ModeIklan = 'h5' | 'uji' | 'contoh' | 'nonaktif';

export function modeIklan(): ModeIklan {
  if (Capacitor.isNativePlatform()) return 'nonaktif';
  const diminta = new URLSearchParams(location.search).get('iklan');
  if (diminta === 'contoh') return 'contoh';
  const adaId = idPenerbitSah(ID_PENERBIT_ADSENSE);
  if (adaId && diminta === 'uji') return 'uji';
  if (import.meta.env.DEV) return 'contoh';
  return adaId ? 'h5' : 'nonaktif';
}

export function buatPenyediaIklan(o: OpsiIklan): PenyediaIklan {
  const mode = modeIklan();
  if (mode === 'h5' || mode === 'uji') return buatPenyediaH5(o, ID_PENERBIT_ADSENSE, mode === 'uji');
  if (mode === 'contoh') return buatPenyediaContoh(o);
  return TANPA_IKLAN;
}

/**
 * Google H5 Games Ads: pasang skrip AdSense (async), adConfig (muat iklan lebih
 * dulu), lalu PengaturIklanH5 meminta jeda reward siaga. Skrip gagal dimuat
 * (diblokir) = tombol hadiah tidak pernah muncul.
 */
function buatPenyediaH5(o: OpsiIklan, idPenerbit: string, uji: boolean): PenyediaIklan {
  const w = window as unknown as { adsbygoogle?: unknown[] };
  w.adsbygoogle = w.adsbygoogle ?? [];
  // Seperti potongan kode Google: adBreak = adConfig = (o) => adsbygoogle.push(o).
  const dorong = (x: object): void => {
    (w.adsbygoogle as unknown[]).push(x);
  };
  const pengatur = new PengaturIklanH5({
    adBreak: (j: JedaReward) => dorong(j),
    penjadwal: { setTimeout: (f, ms) => window.setTimeout(f, ms), clearTimeout: (id) => window.clearTimeout(id) },
    sebelum: o.sebelum,
    sesudah: o.sesudah,
  });
  dorong({ preloadAdBreaks: 'on', sound: 'on', onReady: () => pengatur.mulai() });
  const skrip = document.createElement('script');
  skrip.async = true;
  skrip.crossOrigin = 'anonymous';
  skrip.src = `${URL_SKRIP_ADSENSE}?client=${encodeURIComponent(idPenerbit)}`;
  if (uji) skrip.setAttribute('data-adbreak-test', 'on');
  skrip.addEventListener('load', () => window.setTimeout(() => pengatur.mulai(), CADANGAN_SIAP_MS));
  skrip.addEventListener('error', () => console.info('[iklan] skrip AdSense tidak termuat (diblokir/offline); tombol hadiah disembunyikan'));
  document.head.append(skrip);
  return pengatur;
}

function buatPenyediaContoh(o: OpsiIklan): PenyediaIklan {
  let berjalan = false;
  return {
    nama: 'contoh',
    siap: () => !berjalan,
    async tonton() {
      if (berjalan) return 'gagal';
      berjalan = true;
      o.sebelum?.();
      try {
        return await tampilkanIklanContoh(o.akar);
      } finally {
        berjalan = false;
        o.sesudah?.();
      }
    },
  };
}

/** Layar "iklan" tiruan: hitung mundur, lalu tombol ambil hadiah; bisa dilewati (tanpa hadiah). */
function tampilkanIklanContoh(akar: HTMLElement): Promise<HasilIklan> {
  const latar = document.createElement('div');
  latar.className = 'popup-latar iklan-contoh';
  const kotak = document.createElement('div');
  kotak.className = 'popup iklan-kotak';
  kotak.setAttribute('role', 'dialog');
  kotak.setAttribute('aria-modal', 'true');
  const label = document.createElement('div');
  label.className = 'iklan-label';
  label.textContent = TEKS.iklanContohLabel;
  const isi = document.createElement('div');
  isi.className = 'iklan-isi';
  isi.textContent = TEKS.iklanContohIsi;
  const bar = document.createElement('div');
  bar.className = 'iklan-bar';
  const barIsi = document.createElement('div');
  bar.append(barIsi);
  const tombol = document.createElement('button');
  tombol.type = 'button';
  tombol.className = 'tombol tombol-upgrade popup-tombol';
  const lewati = document.createElement('button');
  lewati.type = 'button';
  lewati.className = 'pembaruan-nanti';
  lewati.textContent = TEKS.iklanLewati;
  kotak.append(label, isi, bar, tombol, lewati);
  latar.append(kotak);
  akar.append(latar);

  return new Promise((selesai) => {
    const mulai = performance.now();
    let rampung = false;
    let bingkai = 0;
    const perbarui = (): void => {
      const detik = (performance.now() - mulai) / 1000;
      barIsi.style.width = `${Math.min(100, (detik / LAMA_CONTOH) * 100).toFixed(1)}%`;
      rampung = detik >= LAMA_CONTOH;
      tombol.disabled = !rampung;
      tombol.textContent = rampung ? TEKS.iklanAmbil : TEKS.iklanTunggu(Math.ceil(LAMA_CONTOH - detik));
      if (!rampung) bingkai = requestAnimationFrame(perbarui);
    };
    perbarui();
    const tutup = (hasil: HasilIklan): void => {
      cancelAnimationFrame(bingkai);
      latar.remove();
      selesai(hasil);
    };
    tombol.addEventListener('click', () => {
      if (rampung) tutup('ditonton');
    });
    lewati.addEventListener('click', () => tutup(rampung ? 'ditonton' : 'dilewati'));
  });
}
