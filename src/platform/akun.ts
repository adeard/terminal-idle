/**
 * Pintu masuk Firebase yang dimuat malas: platform/firebase.ts baru diunduh
 * saat pertama dibutuhkan (menu akun dibuka, atau pemain sudah login).
 */
import { Capacitor } from '@capacitor/core';
import type { HasilUnggah, PenyimpananAwan, SaveAwan } from '../app/akun';

export type ModulFirebase = typeof import('./firebase');

/**
 * Login Google lewat popup hanya jalan di browser. Di APK butuh plugin native
 * (@capacitor-firebase/authentication), yang belum dipasang.
 */
export const bisaLogin = !Capacitor.isNativePlatform();

let janji: Promise<ModulFirebase> | null = null;
let termuat: ModulFirebase | null = null;

export function muatFirebase(): Promise<ModulFirebase> {
  janji ??= import('./firebase').then(
    (m) => (termuat = m),
    (e: unknown) => {
      janji = null; // chunk gagal diunduh (mis. offline): boleh dicoba lagi nanti
      throw e;
    },
  );
  return janji;
}

/**
 * Modul yang sudah termuat, atau null. Handler klik yang membuka popup login
 * memakai ini supaya popup dibuka tanpa menunggu (browser memblokir popup
 * yang dibuka setelah await).
 */
export function firebaseTermuat(): ModulFirebase | null {
  return termuat;
}

/** ID token akun `uid` (null kalau sesi loginnya sudah berakhir); Firebase dimuat saat panggilan pertama. */
export async function tokenAkun(uid: string): Promise<string | null> {
  const fb = await muatFirebase();
  const p = await fb.penggunaSekarang();
  return p?.uid === uid ? fb.tokenId() : null;
}

/** Cloud save akun `uid`; Firebase dimuat saat panggilan pertama. */
export function awanAkun(uid: string): PenyimpananAwan {
  let awan: PenyimpananAwan | null = null;
  const ambil = async (): Promise<PenyimpananAwan> => (awan ??= (await muatFirebase()).buatAwan(uid));
  return {
    unduh: async (): Promise<SaveAwan | null> => (await ambil()).unduh(),
    unggah: async (isi: string, revisiDasar: number): Promise<HasilUnggah> => (await ambil()).unggah(isi, revisiDasar),
    hapus: async (): Promise<void> => (await ambil()).hapus(),
  };
}
