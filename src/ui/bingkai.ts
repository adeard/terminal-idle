/**
 * Bingkai layar responsif: overlay DOM dirancang dalam piksel logis lalu
 * di-scale supaya selalu MENGISI layar (tanpa pita kosong), baik portrait
 * maupun landscape.
 *   - portrait: lebar logis 720, tinggi mengikuti layar (HUD atas, adegan,
 *     panel bawah);
 *   - landscape: tinggi logis 720, lebar mengikuti layar (adegan di kiri,
 *     bilah samping berisi HUD & panel di kanan).
 * Skala dibatasi supaya teks tidak membesar berlebihan di layar lebar; sisa
 * ruangnya dipakai tata letak (CSS flex/grid di gaya.css).
 * Wadah adegan 3D ditempatkan tepat di atas elemen `.area-adegan` di overlay.
 */
export type Orientasi = 'potret' | 'lanskap';

export interface TataLetakLayar {
  readonly orientasi: Orientasi;
  readonly lebarLogis: number;
  readonly tinggiLogis: number;
  /** Piksel CSS per piksel logis. */
  readonly skala: number;
}

/** Sisi pendek layar dirancang sebesar ini (piksel logis). */
export const SISI_DASAR = 720;
/** Skala maksimum (layar desktop besar): teks & tombol tidak ikut membesar tanpa batas. */
const SKALA_MAKS = 1.1;
/** Layar dianggap landscape bila lebarnya melebihi tinggi sebesar ini. */
const RASIO_LANSKAP = 1.05;

export function hitungTataLetakLayar(lebar: number, tinggi: number): TataLetakLayar {
  const w = Math.max(1, lebar);
  const h = Math.max(1, tinggi);
  const orientasi: Orientasi = w > h * RASIO_LANSKAP ? 'lanskap' : 'potret';
  const skala = Math.min(SKALA_MAKS, (orientasi === 'lanskap' ? h : w) / SISI_DASAR);
  return { orientasi, lebarLogis: w / skala, tinggiLogis: h / skala, skala };
}

export interface OpsiBingkai {
  readonly induk: HTMLElement;
  readonly overlay: HTMLElement;
  readonly adegan: HTMLElement;
  /** Dipanggil dengan ukuran area adegan (piksel CSS) setiap kali berubah. */
  readonly saatUkur: (lebar: number, tinggi: number) => void;
}

export function pasangBingkai(o: OpsiBingkai): () => void {
  let dijadwalkan = false;

  const terapkan = (): void => {
    dijadwalkan = false;
    const r = o.induk.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) return;
    const t = hitungTataLetakLayar(r.width, r.height);
    const ui = o.overlay;
    ui.classList.toggle('potret', t.orientasi === 'potret');
    ui.classList.toggle('lanskap', t.orientasi === 'lanskap');
    ui.style.width = `${t.lebarLogis}px`;
    ui.style.height = `${t.tinggiLogis}px`;
    ui.style.transform = `scale(${t.skala})`;
    ui.style.visibility = 'visible';
    // Panel layar penuh menutupi adegan: kanvas dibiarkan di tempat & ukurannya (kamera tidak
    // dibingkai ulang), lalu ditempatkan lagi begitu panel kembali (overlay memicu resize).
    if (ui.classList.contains('panel-penuh')) return;
    // Adegan 3D menempati kotak `.area-adegan` (diukur setelah tata letak CSS diterapkan).
    const area = ui.querySelector('.area-adegan')?.getBoundingClientRect();
    const kotak = area && area.width > 0 && area.height > 0 ? area : r;
    const s = o.adegan.style;
    s.left = `${kotak.left - r.left}px`;
    s.top = `${kotak.top - r.top}px`;
    s.width = `${kotak.width}px`;
    s.height = `${kotak.height}px`;
    o.saatUkur(kotak.width, kotak.height);
  };

  const jadwalkan = (): void => {
    if (dijadwalkan) return;
    dijadwalkan = true;
    requestAnimationFrame(terapkan);
  };

  const pengamat = new ResizeObserver(jadwalkan);
  pengamat.observe(o.induk);
  // Tinggi HUD & panel bisa berubah (mis. baris petunjuk muncul/hilang).
  const pengamatIsi = new ResizeObserver(jadwalkan);
  for (const el of o.overlay.querySelectorAll('.hud, .panel-daftar')) pengamatIsi.observe(el);
  window.addEventListener('resize', jadwalkan);
  terapkan();

  return () => {
    pengamat.disconnect();
    pengamatIsi.disconnect();
    window.removeEventListener('resize', jadwalkan);
  };
}
