/**
 * Membagikan atau menyimpan gambar (foto terminal). Web: Web Share API dengan
 * berkas bila didukung (umumnya HP), selain itu diunduh. Belum untuk APK:
 * WebView Android tidak punya Web Share (butuh plugin Capacitor Share +
 * Filesystem), jadi tombol fotonya tidak dipasang di sana.
 */
import { Capacitor } from '@capacitor/core';

export const bisaFoto = !Capacitor.isNativePlatform();

export function bisaBagikanBerkas(berkas: File): boolean {
  return typeof navigator.canShare === 'function' && navigator.canShare({ files: [berkas] });
}

/** @returns 'batal' kalau pemain menutup lembar berbagi. */
export async function bagikanBerkas(berkas: File, judul: string, teks: string): Promise<'dibagikan' | 'batal'> {
  try {
    await navigator.share({ files: [berkas], title: judul, text: teks });
    return 'dibagikan';
  } catch (e) {
    if (e instanceof DOMException && e.name === 'AbortError') return 'batal';
    throw e;
  }
}

export function unduhBerkas(berkas: Blob, nama: string): void {
  const url = URL.createObjectURL(berkas);
  const a = document.createElement('a');
  a.href = url;
  a.download = nama;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
