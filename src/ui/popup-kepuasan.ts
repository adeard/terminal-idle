/**
 * Rincian kepuasan penumpang (dibuka dari pil kepuasan di HUD): nilai,
 * tambahan calon penumpang, lalu enam komponen berbilah dengan saran yang
 * langsung bisa dikerjakan pemain (area paling lambat, kursi, petugas
 * kebersihan, satpam, fasilitas, tarif).
 */
import type { ModelKepuasan } from './model';
import { NAMA_AREA, NAMA_BANGUNAN, TEKS } from './teks';

function el<K extends keyof HTMLElementTagNameMap>(tag: K, kelas?: string, teks?: string): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (kelas) e.className = kelas;
  if (teks !== undefined) e.textContent = teks;
  return e;
}

const persen = (x: number): number => Math.round(x * 100);

/** Wajah pil kepuasan: makin puas makin senang. */
export function wajahKepuasan(nilai: number): string {
  return nilai >= 0.8 ? '😀' : nilai >= 0.6 ? '🙂' : nilai >= 0.4 ? '😐' : '🙁';
}

/** Tingkat warna pil & bilah: baik / sedang / kurang. */
export function tingkatKepuasan(nilai: number): 'baik' | 'sedang' | 'kurang' {
  return nilai >= 0.75 ? 'baik' : nilai >= 0.45 ? 'sedang' : 'kurang';
}

/** Saran fasilitas: yang belum ada sama sekali, atau tambah sesuai keramaian. */
function saranFasilitas(m: ModelKepuasan): string {
  if (m.fasilitasKurang.length === 0) return TEKS.kepuasanSaranFasilitasCukup;
  return TEKS.kepuasanSaranFasilitas(m.fasilitasKurang.map((id) => NAMA_BANGUNAN[id].nama.toLowerCase()).join(', '));
}

export function tampilkanPopupKepuasan(akar: HTMLElement, m: ModelKepuasan): void {
  akar.querySelector('.popup-latar.latar-kepuasan')?.remove();
  const latar = el('div', 'popup-latar latar-kepuasan');
  const kotak = el('div', 'popup popup-kepuasan');
  kotak.setAttribute('role', 'dialog');
  kotak.setAttribute('aria-modal', 'true');
  kotak.setAttribute('aria-labelledby', 'popup-kepuasan-judul');
  const wajah = el('div', 'kepuasan-wajah', wajahKepuasan(m.nilai));
  const judul = el('h2', undefined, TEKS.kepuasanJudul(persen(m.nilai)));
  judul.id = 'popup-kepuasan-judul';
  const penumpang = el('p', 'kepuasan-penumpang', TEKS.kepuasanPenumpang(persen(m.tambahanPenumpang)));
  const baris = (label: string, nilai: number, saran: string): HTMLElement => {
    const b = el('div', 'kepuasan-baris');
    b.dataset['tingkat'] = tingkatKepuasan(nilai);
    const atas = el('div', 'kepuasan-atas');
    atas.append(el('span', 'kepuasan-label', label), el('span', 'kepuasan-persen', `${persen(nilai)}%`));
    const bar = el('div', 'bar');
    const isi = el('div', 'bar-isi');
    isi.style.width = `${(nilai * 100).toFixed(1)}%`;
    bar.append(isi);
    b.append(atas, bar, el('div', 'kepuasan-saran', nilai >= 0.995 ? TEKS.kepuasanBaik : saran));
    return b;
  };
  const daftar = el('div', 'kepuasan-daftar');
  daftar.append(
    baris(TEKS.kepuasanKelancaran, m.kelancaran, m.bottleneck ? TEKS.kepuasanSaranKelancaran(NAMA_AREA[m.bottleneck]) : TEKS.kepuasanBaik),
    baris(TEKS.kepuasanKenyamanan, m.kenyamanan, m.kursi.ada < m.kursi.perlu || m.papanJadwal ? TEKS.kepuasanSaranKenyamanan(m.kursi.ada, m.kursi.perlu) : TEKS.kepuasanSaranJadwal),
    baris(TEKS.kepuasanKebersihan, m.kebersihan, TEKS.kepuasanSaranKebersihan(m.petugasKebersihan.ada, m.petugasKebersihan.perlu)),
    baris(TEKS.kepuasanKeamanan, m.keamanan, TEKS.kepuasanSaranKeamanan(m.satpam.ada, m.satpam.perlu)),
    baris(TEKS.kepuasanFasilitas, m.fasilitas, saranFasilitas(m)),
    baris(TEKS.kepuasanHarga, m.harga, TEKS.kepuasanSaranHarga),
  );
  const catatan = el('p', 'popup-catatan', TEKS.kepuasanCatatan);
  const tutupB = el('button', 'tombol tombol-hijau popup-tombol', TEKS.kepuasanTutup);
  tutupB.type = 'button';
  kotak.append(wajah, judul, penumpang, daftar, catatan, tutupB);
  latar.append(kotak);
  akar.append(latar);
  const tutup = (): void => {
    window.removeEventListener('keydown', saatTombol);
    latar.remove();
  };
  const saatTombol = (e: KeyboardEvent): void => {
    if (e.key === 'Escape') tutup();
  };
  tutupB.addEventListener('click', tutup);
  latar.addEventListener('click', (e) => {
    if (e.target === latar) tutup();
  });
  window.addEventListener('keydown', saatTombol);
}
