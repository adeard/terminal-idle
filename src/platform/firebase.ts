/**
 * Firebase untuk akun & cloud save (web). Modul ini jadi chunk terpisah dan
 * hanya dimuat lewat platform/akun.ts saat pemain membuka menu akun atau
 * sudah login, jadi tamu tidak ikut mengunduh Firebase.
 *
 * - Auth: login Google lewat popup. Di APK popup tidak bisa (Google memblokir
 *   login di WebView); itu butuh plugin native, belum dipasang.
 * - Firestore Lite: satu dokumen per pemain, saves/{uid} =
 *   { isi, revisi, schemaVersion, diperbarui }. Tulis bersyarat ditegakkan
 *   firestore.rules (revisi harus naik tepat 1 dari yang ada), jadi unggahan
 *   yang ketinggalan revisi ditolak tanpa perlu membaca dulu.
 *
 * Diverifikasi terhadap firebase 12.19.0 (auth-public.d.ts, firestore/lite index.d.ts).
 */
import { initializeApp } from 'firebase/app';
import {
  browserLocalPersistence,
  browserPopupRedirectResolver,
  deleteUser,
  GoogleAuthProvider,
  indexedDBLocalPersistence,
  initializeAuth,
  reauthenticateWithPopup,
  signInWithPopup,
  signOut,
  type User,
} from 'firebase/auth';
import { deleteDoc, doc, getDoc, getFirestore, serverTimestamp, setDoc, type DocumentData } from 'firebase/firestore/lite';
import type { HasilUnggah, PenyimpananAwan, SaveAwan } from '../app/akun';
import { DOMAIN_SITUS, FIREBASE, KOLEKSI_SAVE } from '../config/firebase.config';
import { VERSI_SKEMA } from '../sim/save';

/** Batas tunggu cloud; saat memulai game, pemain yang login menunggu paling lama selama ini. */
const BATAS_UNDUH_MS = 6000;
const BATAS_UNGGAH_MS = 12000;

const app = initializeApp({
  ...FIREBASE,
  authDomain: location.hostname === DOMAIN_SITUS ? DOMAIN_SITUS : FIREBASE.authDomain,
});
const auth = initializeAuth(app, {
  persistence: [indexedDBLocalPersistence, browserLocalPersistence],
  popupRedirectResolver: browserPopupRedirectResolver,
});
const db = getFirestore(app);

export interface InfoPengguna {
  readonly uid: string;
  readonly nama: string | null;
  readonly email: string | null;
}

const info = (u: User): InfoPengguna => ({ uid: u.uid, nama: u.displayName, email: u.email });

function penyediaGoogle(): GoogleAuthProvider {
  const p = new GoogleAuthProvider();
  p.setCustomParameters({ prompt: 'select_account' });
  return p;
}

/** Pengguna yang tersimpan di perangkat ini (tidak butuh jaringan), atau null. */
export async function penggunaSekarang(): Promise<InfoPengguna | null> {
  await auth.authStateReady();
  return auth.currentUser ? info(auth.currentUser) : null;
}

/** Buka popup login Google. Panggil langsung dari handler klik supaya popup tidak diblokir. */
export async function masukGoogle(): Promise<InfoPengguna> {
  const { user } = await signInWithPopup(auth, penyediaGoogle());
  return info(user);
}

/** ID token login sekarang (diperbarui Firebase sendiri sebelum kedaluwarsa), untuk API papan peringkat. */
export async function tokenId(): Promise<string | null> {
  await auth.authStateReady();
  return auth.currentUser ? auth.currentUser.getIdToken() : null;
}

export async function keluarGoogle(): Promise<void> {
  await signOut(auth);
}

/**
 * Firebase hanya mengizinkan penghapusan akun setelah login baru-baru ini:
 * minta pemain memilih akun Google-nya lagi. Panggil langsung dari handler klik.
 */
export async function konfirmasiUlang(): Promise<void> {
  const u = auth.currentUser;
  if (!u) throw new Error('Belum login');
  await reauthenticateWithPopup(u, penyediaGoogle());
}

export async function hapusPengguna(): Promise<void> {
  const u = auth.currentUser;
  if (!u) throw new Error('Belum login');
  await deleteUser(u);
}

/** Kode galat Firebase (mis. 'auth/popup-blocked', 'permission-denied'), kalau ada. */
export function kodeGalat(e: unknown): string | null {
  return typeof e === 'object' && e !== null && 'code' in e && typeof e.code === 'string' ? e.code : null;
}

export function buatAwan(uid: string): PenyimpananAwan {
  return new AwanFirestore(uid);
}

class AwanFirestore implements PenyimpananAwan {
  constructor(private readonly uid: string) {}

  unduh(): Promise<SaveAwan | null> {
    return batasWaktu(this.baca(), BATAS_UNDUH_MS, 'Cloud save tidak menjawab');
  }

  unggah(isi: string, revisiDasar: number): Promise<HasilUnggah> {
    return batasWaktu(this.tulis(isi, revisiDasar), BATAS_UNGGAH_MS, 'Unggah cloud save tidak menjawab');
  }

  async hapus(): Promise<void> {
    await this.pastikanMasuk();
    await deleteDoc(this.ref());
  }

  private ref() {
    return doc(db, KOLEKSI_SAVE, this.uid);
  }

  private async baca(): Promise<SaveAwan | null> {
    await this.pastikanMasuk();
    const snap = await getDoc(this.ref());
    return snap.exists() ? bacaDokumen(snap.data()) : null;
  }

  private async tulis(isi: string, revisiDasar: number): Promise<HasilUnggah> {
    await this.pastikanMasuk();
    const revisi = revisiDasar + 1;
    try {
      await setDoc(this.ref(), { isi, revisi, schemaVersion: VERSI_SKEMA, diperbarui: serverTimestamp() });
      return { status: 'ok', revisi };
    } catch (e) {
      if (kodeGalat(e) !== 'permission-denied') throw e;
      // Ditolak rules: biasanya karena revisi cloud sudah berubah. Pastikan dengan membaca.
      const awan = await this.baca();
      if ((awan?.revisi ?? 0) === revisiDasar) throw e;
      return { status: 'konflik', awan };
    }
  }

  private async pastikanMasuk(): Promise<void> {
    await auth.authStateReady();
    if (auth.currentUser?.uid !== this.uid) throw new Error('Sesi login untuk akun ini tidak ada');
  }
}

function bacaDokumen(d: DocumentData): SaveAwan {
  const { isi, revisi, schemaVersion } = d;
  if (typeof isi !== 'string' || typeof revisi !== 'number' || !Number.isSafeInteger(revisi) || revisi < 1) {
    throw new Error('Dokumen cloud save tidak valid');
  }
  // Save dari versi game yang lebih baru: jangan dibaca (dan jangan pernah ditimpa) versi lama ini.
  if (typeof schemaVersion === 'number' && schemaVersion > VERSI_SKEMA) {
    throw new Error(`Cloud save dari versi game lebih baru (skema ${schemaVersion}); perbarui game`);
  }
  return { isi, revisi };
}

function batasWaktu<T>(janji: Promise<T>, ms: number, pesan: string): Promise<T> {
  return new Promise((ok, gagal) => {
    const t = setTimeout(() => gagal(new Error(pesan)), ms);
    janji.then(
      (v) => {
        clearTimeout(t);
        ok(v);
      },
      (e: unknown) => {
        clearTimeout(t);
        gagal(e);
      },
    );
  });
}
