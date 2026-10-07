/**
 * Label kemajuan (isinya dari label-bus.ts & label-loket.ts):
 * - peron kedatangan: "TURUN 7/16" dan bilah penumpang yang sudah turun;
 * - petak parkir jurusan: cincin loader cuci berwarna jurusan;
 * - halte keberangkatan: jurusan, penumpang naik / kapasitas, dan bilah (naik =
 *   penuh, sudah dipanggil tapi masih berjalan = samar);
 * - jendela loket: cincin loader transaksi tiket di atas pembeli.
 * Cincin dipakai di tempat yang berdempetan (petak parkir, jendela loket).
 * Muncul saat pekerjaannya dimulai dan bertahan sebentar (memudar, ✓) setelah
 * selesai. Label DOM (seperti label zona) supaya teks tetap tajam; mengecil saat
 * kamera menjauh supaya label bersebelahan tidak saling menutupi.
 */
import { WARNA_TAHAP, keHexCss } from '../config/tema';
import type { BusVisual, OrangVisual } from './dunia-visual';
import { isiLabelBus, JENIS_LABEL_BUS, labelAktif, type JenisLabelBus } from './label-bus';
import { kemajuanLoket } from './label-loket';
import { KELOMPOK_PARKIR, LOKET, TINGGI_LANTAI_GEDUNG, X_LOKET } from './tata-letak';
import type { Proyektor } from './zona3d';

/** Detik label tetap terlihat (memudar) setelah pekerjaan bus selesai. */
const SISA_SETELAH_SELESAI = 2.5;
/** Detik cincin loket tetap terlihat setelah transaksi; singkat karena pembeli berikutnya segera maju. */
const SISA_LOKET = 0.8;
/** Ketinggian jangkar label di atas atap bus. */
const H_LABEL = 1.02;
/** Ketinggian jangkar cincin loket: tepat di atas kepala pembeli di jendela. */
const H_LOKET = TINGGI_LANTAI_GEDUNG + 0.5;
/** Garis tengah cincin loader (px CSS, lihat .label-cincin di gaya.css). */
const UKURAN_CINCIN = 26;
/** Skala label menurut jarak kamera: penuh saat dekat, mengecil saat jauh. */
const JARAK_SKALA = { dekat: 22, jauh: 70, min: 0.62 } as const;
const NS_SVG = 'http://www.w3.org/2000/svg';
/** Ikon di tengah cincin: tetes air (cuci), tiket (loket); centang setelah selesai. */
const IKON_TETES = 'M12 2.5C9 6.8 5.5 10.6 5.5 14.4a6.5 6.5 0 0 0 13 0c0-3.8-3.5-7.6-6.5-11.9z';
export const IKON_TIKET = 'M3 7.5A1.5 1.5 0 0 1 4.5 6h15A1.5 1.5 0 0 1 21 7.5v2.6a2 2 0 0 0 0 3.8v2.6a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 16.5v-2.6a2 2 0 0 0 0-3.8z';
const IKON_CENTANG = 'M5 12.5l4.5 4.5L19 7.5';
const WARNA_IKON_TIKET = '#fde68a';

interface Label {
  readonly el: HTMLElement;
  sisa: number;
  tampil: boolean;
  /** Kemajuan terakhir yang ditulis ke DOM (hindari menulis gaya tiap frame tanpa perubahan). */
  kemajuanLalu: number;
}

interface LabelBusDom extends Label {
  readonly jenis: JenisLabelBus;
  readonly judul: HTMLElement | null;
  readonly angka: HTMLElement | null;
  readonly penuh: HTMLElement | null;
  readonly samar: HTMLElement | null;
}

function el(kelas: string): HTMLElement {
  const e = document.createElement('div');
  e.className = kelas;
  return e;
}

const warnaJurusan = (tujuan: number): string => {
  const k = KELOMPOK_PARKIR.find((g) => g.tujuan.includes(tujuan));
  return k ? keHexCss(k.warna) : keHexCss(WARNA_TAHAP.keberangkatan);
};

export const skalaJarak = (jarakKamera: number): number => {
  const t = Math.min(1, Math.max(0, (jarakKamera - JARAK_SKALA.dekat) / (JARAK_SKALA.jauh - JARAK_SKALA.dekat)));
  return 1 - t * (1 - JARAK_SKALA.min);
};

/** Cincin loader: lingkar kemajuan berwarna, ikon di tengah, centang saat selesai. */
function buatCincin(wadah: HTMLElement, warna: string, ikon: string, warnaIkon?: string): HTMLElement {
  const e = el('label-cincin');
  e.style.setProperty('--warna', warna);
  if (warnaIkon) e.style.setProperty('--ikon', warnaIkon);
  const svg = document.createElementNS(NS_SVG, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  for (const [kelas, d] of [
    ['lc-ikon', ikon],
    ['lc-centang', IKON_CENTANG],
  ] as const) {
    const path = document.createElementNS(NS_SVG, 'path');
    path.setAttribute('class', kelas);
    path.setAttribute('d', d);
    svg.append(path);
  }
  e.append(svg);
  wadah.append(e);
  return e;
}

/** Tulis kemajuan cincin per 1 % saja (kemajuan naik sedikit tiap frame). */
function isiCincin(l: Label, kemajuan: number, selesai: boolean): void {
  l.el.classList.toggle('penuh', selesai);
  const p = Math.floor(kemajuan * 100) / 100;
  if (p !== l.kemajuanLalu) {
    l.kemajuanLalu = p;
    l.el.style.setProperty('--p', p.toFixed(2));
  }
}

export class LabelBus {
  /** Kunci: `${idBus}:${jenis}`; bus yang baru selesai satu pekerjaan bisa masih memudarkan labelnya. */
  private readonly label = new Map<string, LabelBusDom>();
  /** Cincin transaksi per jendela loket (null = jendela tidak sedang melayani). */
  private readonly cincinLoket: (Label | null)[] = X_LOKET.map(() => null);

  constructor(private readonly wadah: HTMLElement) {}

  /** @param jarakKamera jarak kamera ke titik pandang (skala label). */
  perbarui(daftar: readonly BusVisual[], dt: number, kamera: Proyektor, lebar: number, tinggi: number, jarakKamera: number): void {
    const skala = skalaJarak(jarakKamera).toFixed(3);
    const ada = new Set<string>();
    for (const b of daftar) {
      if (b.jenis !== 'terminal') continue;
      const aktifSekarang = labelAktif(b);
      for (const jenis of JENIS_LABEL_BUS) {
        const kunci = `${b.id}:${jenis}`;
        const aktif = aktifSekarang === jenis;
        let l = this.label.get(kunci);
        if (!l) {
          if (!aktif) continue;
          l = this.buat(b, jenis);
          this.label.set(kunci, l);
        }
        ada.add(kunci);
        if (aktif) l.sisa = SISA_SETELAH_SELESAI;
        else l.sisa -= dt;
        if (l.sisa <= 0) {
          this.hapus(kunci);
          continue;
        }
        this.isi(l, b, aktif);
        const p = kamera.proyeksi(b.x, b.y, H_LABEL);
        this.tempatkan(l, p, p.terlihat, lebar, tinggi, skala, aktif ? 1 : l.sisa / SISA_SETELAH_SELESAI);
      }
    }
    for (const kunci of [...this.label.keys()]) if (!ada.has(kunci)) this.hapus(kunci);
  }

  /**
   * Cincin transaksi tiket di atas pembeli di tiap jendela loket. Disembunyikan
   * bila kamera terlalu jauh sehingga cincin jendela bersebelahan bertumpuk.
   */
  perbaruiLoket(orang: readonly OrangVisual[], dt: number, kamera: Proyektor, lebar: number, tinggi: number, jarakKamera: number): void {
    const kemajuan = kemajuanLoket(orang, X_LOKET.length);
    const s = skalaJarak(jarakKamera);
    const skala = s.toFixed(3);
    const a = kamera.proyeksi(X_LOKET[0]!, LOKET.yPembeli, H_LOKET);
    const b = kamera.proyeksi(X_LOKET[1]!, LOKET.yPembeli, H_LOKET);
    const muat = Math.hypot(a.x - b.x, a.y - b.y) >= UKURAN_CINCIN * s * 0.9;
    X_LOKET.forEach((x, i) => {
      const k = kemajuan[i] ?? null;
      let l = this.cincinLoket[i] ?? null;
      if (!l) {
        if (k === null) return;
        l = { el: buatCincin(this.wadah, keHexCss(WARNA_TAHAP.loket), IKON_TIKET, WARNA_IKON_TIKET), sisa: SISA_LOKET, tampil: true, kemajuanLalu: -1 };
        this.cincinLoket[i] = l;
      }
      if (k !== null) l.sisa = SISA_LOKET;
      else l.sisa -= dt;
      if (l.sisa <= 0) {
        l.el.remove();
        this.cincinLoket[i] = null;
        return;
      }
      isiCincin(l, k ?? 1, k === null);
      const p = kamera.proyeksi(x, LOKET.yPembeli, H_LOKET);
      this.tempatkan(l, p, muat && p.terlihat, lebar, tinggi, skala, k !== null ? 1 : l.sisa / SISA_LOKET);
    });
  }

  private tempatkan(l: Label, p: { x: number; y: number }, terlihat: boolean, lebar: number, tinggi: number, skala: string, opasitas: number): void {
    const tampil = terlihat && p.x > -40 && p.x < lebar + 40 && p.y > 0 && p.y < tinggi + 40;
    if (tampil !== l.tampil) {
      l.tampil = tampil;
      l.el.hidden = !tampil;
    }
    if (!tampil) return;
    l.el.style.transform = `translate(${p.x.toFixed(1)}px, ${p.y.toFixed(1)}px) translate(-50%, -100%) scale(${skala})`;
    l.el.style.opacity = opasitas >= 1 ? '1' : opasitas.toFixed(2);
  }

  private buat(b: BusVisual, jenis: JenisLabelBus): LabelBusDom {
    if (jenis === 'cuci') {
      const e = buatCincin(this.wadah, warnaJurusan(b.tujuan), IKON_TETES);
      return { jenis, el: e, judul: null, angka: null, penuh: null, samar: null, sisa: SISA_SETELAH_SELESAI, tampil: true, kemajuanLalu: -1 };
    }
    const e = el('label-bus');
    e.style.setProperty('--warna', jenis === 'turun' ? keHexCss(WARNA_TAHAP.peron) : warnaJurusan(b.tujuan));
    const baris = el('lb-baris');
    const judul = el('lb-judul');
    const angka = el('lb-angka');
    baris.append(judul, angka);
    const bar = el('lb-bar');
    const samar = el('lb-dipanggil');
    const penuh = el('lb-naik');
    bar.append(samar, penuh);
    e.append(baris, bar);
    this.wadah.append(e);
    return { jenis, el: e, judul, angka, penuh, samar, sisa: SISA_SETELAH_SELESAI, tampil: true, kemajuanLalu: -1 };
  }

  private isi(l: LabelBusDom, b: BusVisual, aktif: boolean): void {
    const isi = isiLabelBus(b, l.jenis, aktif);
    if (l.jenis === 'cuci') {
      isiCincin(l, isi.kemajuan, isi.selesai);
      return;
    }
    l.el.classList.toggle('penuh', isi.selesai);
    if (l.judul && l.judul.textContent !== isi.judul) l.judul.textContent = isi.judul;
    if (l.angka && l.angka.textContent !== isi.angka) l.angka.textContent = isi.angka;
    if (isi.kemajuan !== l.kemajuanLalu) {
      l.kemajuanLalu = isi.kemajuan;
      if (l.penuh) l.penuh.style.width = `${(100 * isi.kemajuan).toFixed(1)}%`;
    }
    if (l.samar) l.samar.style.width = `${(100 * isi.samar).toFixed(1)}%`;
  }

  private hapus(kunci: string): void {
    this.label.get(kunci)?.el.remove();
    this.label.delete(kunci);
  }
}
