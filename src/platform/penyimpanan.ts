/**
 * Storage save: @capacitor/preferences di Android/iOS, localStorage di browser.
 *
 * Diverifikasi terhadap @capacitor/preferences 7.0.4 (definitions.d.ts):
 * Preferences.get({ key }) → { value: string | null }, Preferences.set({ key, value }).
 */
import { Capacitor } from '@capacitor/core';
import { Preferences } from '@capacitor/preferences';
import type { Penyimpanan } from '../app/sesi';

class PenyimpananNative implements Penyimpanan {
  async baca(kunci: string): Promise<string | null> {
    const { value } = await Preferences.get({ key: kunci });
    return value;
  }

  async tulis(kunci: string, nilai: string): Promise<void> {
    await Preferences.set({ key: kunci, value: nilai });
  }

  async hapus(kunci: string): Promise<void> {
    await Preferences.remove({ key: kunci });
  }
}

/**
 * localStorage bisa melempar (mode privat, storage penuh, diblokir). Kalau
 * tidak tersedia sama sekali, jatuh ke memori supaya game tetap jalan
 * (progres hilang saat tab ditutup, tapi tidak crash).
 */
class PenyimpananWeb implements Penyimpanan {
  private readonly memori = new Map<string, string>();
  private readonly adaLocalStorage = cekLocalStorage();

  async baca(kunci: string): Promise<string | null> {
    if (this.adaLocalStorage) return localStorage.getItem(kunci);
    return this.memori.get(kunci) ?? null;
  }

  /** Penulisan localStorage sinkron di dalam pemanggilan, jadi aman dipakai di pagehide. */
  async tulis(kunci: string, nilai: string): Promise<void> {
    if (this.adaLocalStorage) localStorage.setItem(kunci, nilai);
    else this.memori.set(kunci, nilai);
  }

  async hapus(kunci: string): Promise<void> {
    if (this.adaLocalStorage) localStorage.removeItem(kunci);
    else this.memori.delete(kunci);
  }
}

function cekLocalStorage(): boolean {
  try {
    const k = '__cek_storage__';
    localStorage.setItem(k, '1');
    localStorage.removeItem(k);
    return true;
  } catch {
    return false;
  }
}

export function buatPenyimpanan(): Penyimpanan {
  return Capacitor.isNativePlatform() ? new PenyimpananNative() : new PenyimpananWeb();
}
