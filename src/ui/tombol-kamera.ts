/**
 * Tombol kamera di pojok kanan atas area adegan (di bawah tombol suara):
 * kompas yang jarumnya selalu menunjuk utara (ketuk = kembali ke arah awal),
 * putar kiri, dan putar kanan. Di desktop juga tombol Q/E.
 */
import { TEKS } from './teks';

export interface PengaturKamera {
  /** Radian; positif = isi layar searah jarum jam. */
  putarKamera(sudut: number): void;
  kembalikanKamera(): void;
}

export interface TombolKamera {
  /** Arah utara di layar (radian searah jarum jam dari atas), dipanggil tiap frame. */
  perbarui(arahUtara: number): void;
}

const LANGKAH = Math.PI / 4;

const SVG_KOMPAS =
  '<circle cx="24" cy="24" r="21" fill="none" stroke="currentColor" stroke-width="2" opacity="0.5"/>' +
  '<g class="kompas-jarum"><path d="M24 7l6 17h-12z" fill="#ef4444"/><path d="M24 41l-6-17h12z" fill="#e5e7eb"/>' +
  '<text x="24" y="5.5" text-anchor="middle" font-size="7" font-weight="800" fill="#fff">U</text></g>';
/** Panah melingkar; `cermin` = putar kanan. */
const svgPutar = (cermin: boolean): string =>
  `<g${cermin ? ' transform="translate(24 0) scale(-1 1)"' : ''}><path d="M6.5 12a7.5 7.5 0 1 1 1.8 7.9" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round"/>` +
  '<path d="M3.5 8.5l3 4.6 4.4-3.1" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"/></g>';

export function pasangTombolKamera(induk: HTMLElement, kamera: PengaturKamera): TombolKamera {
  const tombol = (kelas: string, judul: string, svg: string, viewBox: string, aksi: () => void): HTMLButtonElement => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = `tombol-kamera ${kelas}`;
    b.title = judul;
    b.setAttribute('aria-label', judul);
    b.innerHTML = `<svg viewBox="${viewBox}" aria-hidden="true">${svg}</svg>`;
    b.addEventListener('click', aksi);
    induk.append(b);
    return b;
  };
  const kompas = tombol('kompas', TEKS.arahAwal, SVG_KOMPAS, '0 0 48 48', () => kamera.kembalikanKamera());
  tombol('putar-kiri', TEKS.putarKiri, svgPutar(false), '0 0 24 24', () => kamera.putarKamera(-LANGKAH));
  tombol('putar-kanan', TEKS.putarKanan, svgPutar(true), '0 0 24 24', () => kamera.putarKamera(LANGKAH));
  window.addEventListener('keydown', (e) => {
    if (e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
    const k = e.key.toLowerCase();
    if (k === 'q') kamera.putarKamera(-LANGKAH);
    else if (k === 'e') kamera.putarKamera(LANGKAH);
  });

  const jarum = kompas.querySelector<SVGGElement>('.kompas-jarum')!;
  let lalu = Number.NaN;
  return {
    perbarui(arahUtara) {
      // Tulis hanya kalau berubah berarti (hemat layout tiap frame).
      if (Math.abs(arahUtara - lalu) < 0.002) return;
      lalu = arahUtara;
      jarum.setAttribute('transform', `rotate(${((arahUtara * 180) / Math.PI).toFixed(2)} 24 24)`);
    },
  };
}
