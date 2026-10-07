/**
 * Isi tab pengelolaan terminal di panel bawah: Fasilitas, Jurusan,
 * Modernisasi, dan Target (target harian + penghargaan). Semua elemen dibuat
 * sekali; tiap pembaruan state hanya mengubah teks/kelas yang berubah.
 */
import type { Aksi } from '../sim/aksi';
import { LIVERY_PO, type Livery } from '../config/livery.config';
import { FASILITAS_IDS, KELAS_BUS_IDS, PENCAPAIAN_IDS, PO_IDS, TEKNOLOGI_IDS, type FasilitasId, type KelasBusId, type PencapaianId, type TeknologiId } from '../sim/fitur';
import { keHexCss, WARNA_TAHAP } from '../config/tema';
import { formatAngka, formatUang } from './format';
import type { ModelFasilitas, ModelHarga, ModelKelas, ModelMingguan, ModelTampilan, ModelTantangan } from './model';
import { namaKelas, NAMA_EVENT, NAMA_FASILITAS, NAMA_KELAS_BUS, NAMA_PENCAPAIAN, NAMA_PO, NAMA_TEKNOLOGI, sisaWaktuEvent, TEKS } from './teks';

export interface IsiTab {
  readonly elemen: HTMLElement;
  perbarui(m: ModelTampilan): void;
}

type Kirim = (aksi: Aksi) => void;

/** Iklan berhadiah untuk klaim 2× (lihat app/iklan.ts); `tonton` true = selesai ditonton. */
export interface IklanMenu {
  siap(): boolean;
  tonton(tempat: 'target2x' | 'penghargaan2x'): Promise<boolean>;
}

const IKON_PUTAR_KECIL = '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="2.5" y="4.5" width="19" height="15" rx="3" fill="none" stroke="currentColor" stroke-width="2.4"/><path d="M10 9l5 3-5 3z" fill="currentColor"/></svg>';

/** Tombol klaim 2× lewat iklan: ikon layar + "2×" + besar hadiah. */
function tombolGanda(): { tombol: HTMLButtonElement; besar: HTMLSpanElement } {
  const tombol = el('button', 'tombol tombol-iklan tombol-ganda');
  tombol.type = 'button';
  const kecil = el('span', 'tombol-kecil');
  kecil.innerHTML = `${IKON_PUTAR_KECIL}${TEKS.klaimGanda}`;
  const besar = el('span', 'tombol-besar');
  tombol.append(kecil, besar);
  return { tombol, besar };
}

/** Ikon fasilitas (viewBox 24). */
const IKON_FASILITAS: Readonly<Record<FasilitasId, string>> = {
  kios: '<path d="M3 9l1.5-5h15L21 9a3 3 0 0 1-6 0 3 3 0 0 1-6 0 3 3 0 0 1-6 0z" fill="currentColor"/><path d="M5 12v8h14v-8" fill="none" stroke="currentColor" stroke-width="2"/><rect x="10" y="15" width="4" height="5" fill="currentColor"/>',
  parkir: '<rect x="3" y="3" width="18" height="18" rx="4" fill="currentColor"/><path d="M9.5 17V7h3.2a3 3 0 0 1 0 6H9.5" fill="none" stroke="#0b1117" stroke-width="2.2" stroke-linejoin="round"/>',
  toilet: '<circle cx="8" cy="5" r="2" fill="currentColor"/><circle cx="16" cy="5" r="2" fill="currentColor"/><path d="M6 9h4l.5 6H10v5H6v-5h-.5zM14 9h4l2 7h-2v4h-4v-4h-2z" fill="currentColor"/>',
  retribusi: '<rect x="2" y="6" width="20" height="12" rx="2" fill="currentColor"/><circle cx="12" cy="12" r="3" fill="none" stroke="#0b1117" stroke-width="2"/><path d="M5 9v6M19 9v6" stroke="#0b1117" stroke-width="1.6"/>',
};
/** Jalur bus: kanopi dengan dua lajur halte (viewBox 24). */
const IKON_JALUR =
  '<path d="M2 8.5 12 4l10 4.5V10H2z" fill="currentColor"/><path d="M4.5 10v10M12 10v10M19.5 10v10" stroke="currentColor" stroke-width="1.8"/><rect x="6" y="13" width="4.5" height="5.5" rx="1" fill="currentColor"/><rect x="13.5" y="13" width="4.5" height="5.5" rx="1" fill="currentColor" opacity="0.4"/>';
const IKON_GEMBOK = '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="11" width="14" height="10" rx="2" fill="currentColor"/><path d="M8 11V8a4 4 0 0 1 8 0v3" fill="none" stroke="currentColor" stroke-width="2"/></svg>';
const IKON_KAPAL = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 12.5h18l-2.6 5H5.4z" fill="currentColor"/><rect x="7" y="8.2" width="8" height="3.4" rx="0.6" fill="currentColor"/><rect x="11.2" y="5.2" width="2" height="3" fill="currentColor"/><path d="M2 20.5c2 0 2-1 4-1s2 1 4 1 2-1 4-1 2 1 4 1 2-1 4-1" fill="none" stroke="currentColor" stroke-width="1.5"/></svg>';
const IKON_PIALA = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 3h10v5a5 5 0 0 1-10 0z" fill="currentColor"/><path d="M7 5H4a3 3 0 0 0 3 4M17 5h3a3 3 0 0 1-3 4" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M10 13h4v4h3v3H7v-3h3z" fill="currentColor"/></svg>';

const persen = (x: number): number => Math.round(x * 100);
const rupiahKecil = (x: number): string => formatAngka(x, { desimalKecil: 2 });

// ---------------------------------------------------------------------------
// Fasilitas

/** Efek fasilitas sekarang: sewa kios per hari, parkir per penumpang, bonus belanja toilet, retribusi per bus. */
function efekFasilitas(f: ModelFasilitas): string {
  switch (f.id) {
    case 'kios':
      return TEKS.sewaKios(formatUang(f.sewaPerHari), formatUang(f.terkumpul));
    case 'parkir':
      return TEKS.perPenumpang(rupiahKecil(f.nilaiSekarang));
    case 'toilet':
      return TEKS.bonusBelanjaKios(persen(f.nilaiSekarang));
    case 'retribusi':
      return TEKS.perBus(rupiahKecil(f.nilaiSekarang));
  }
}

/** Tambahan efek per level berikutnya (label tombol upgrade). */
function tambahanFasilitas(f: ModelFasilitas): string {
  switch (f.id) {
    case 'kios':
      return TEKS.tambahBelanja(rupiahKecil(f.nilaiPerLevel));
    case 'parkir':
      return `+Rp ${rupiahKecil(f.nilaiPerLevel)}`;
    case 'toilet':
      return `+${persen(f.nilaiPerLevel)}%`;
    case 'retribusi':
      return TEKS.tambahPerBus(rupiahKecil(f.nilaiPerLevel));
  }
}

export function buatTabFasilitas(kirim: Kirim): IsiTab {
  const elemen = el('div', 'isi-tab daftar-item');
  // Jalur bus paling atas: pembangunan terminal yang langsung terlihat di adegan.
  const jalur = baris3(IKON_JALUR, TEKS.jalurNama, 'jalur');
  jalur.elemen.dataset['jalur'] = '1';
  jalur.tombol.addEventListener('click', () => kirim({ jenis: 'bukaJalur' }));
  elemen.append(jalur.elemen);
  const baris = FASILITAS_IDS.map((id) => {
    const r = baris3(IKON_FASILITAS[id], NAMA_FASILITAS[id].nama, 'fasilitas');
    r.elemen.dataset['fasilitas'] = id;
    r.tombol.addEventListener('click', () => kirim({ jenis: 'bangunFasilitas', fasilitas: id }));
    elemen.append(r.elemen);
    return { id, ...r };
  });
  return {
    elemen,
    perbarui(m) {
      const j = m.jalur;
      const kali = (x: number): string => formatAngka(x, { desimalKecil: 2 });
      setTeks(jalur.level, `${j.jumlah}/${j.maks}`);
      setTeks(jalur.keterangan, j.biaya ? TEKS.jalurKeterangan(kali(j.mult), kali(j.multBerikut)) : TEKS.jalurLengkap(kali(j.mult)));
      setHidden(jalur.tombol, j.biaya === null);
      if (j.biaya) {
        setTeks(jalur.tombolKecil, TEKS.bangunJalur(j.jumlah + 1));
        setTeks(jalur.tombolBesar, formatUang(j.biaya));
        setDisabled(jalur.tombol, !j.bisa);
      }
      for (const b of baris) {
        const f = m.fasilitas.find((x) => x.id === b.id)!;
        setTeks(b.level, f.level > 0 ? TEKS.level(f.level) : '');
        setHidden(b.level, f.level === 0);
        const efek = f.level > 0 ? `${efekFasilitas(f)} · ${NAMA_FASILITAS[b.id].deskripsi}` : NAMA_FASILITAS[b.id].deskripsi;
        setTeks(b.keterangan, efek);
        setTeks(b.tombolKecil, f.level > 0 ? `${TEKS.upgrade} ${tambahanFasilitas(f)}` : TEKS.bangun);
        setTeks(b.tombolBesar, formatUang(f.biaya));
        setDisabled(b.tombol, !f.bisa);
        b.elemen.classList.toggle('belum', f.level === 0);
      }
    },
  };
}

// ---------------------------------------------------------------------------
// Harga tiket (jurusan & kelas bus)

interface PengaturHarga {
  readonly elemen: HTMLElement;
  /** Saran harga (ketuk = pakai) atau peringatan tiket terlalu mahal; diletakkan pemanggil di kolom info. */
  readonly saran: HTMLElement;
  perbarui(h: ModelHarga): void;
}

/** Rupiah harga tiket: "Rp 6,25", atau "+Rp 1,25" untuk tambahan kelas. */
const rupiahHarga = (x: number, tambahan: boolean): string => `${tambahan ? '+' : ''}Rp ${rupiahKecil(x)}`;

/**
 * Tombol − / + dengan harga (Rupiah) di tengahnya, dan tombol saran. `kirimHarga`
 * menerima nilai baru dalam persen harga normal (dirapikan sim).
 * @param tambahan tambahan harga kelas bus (ditulis "+Rp …"), bukan harga jurusan
 */
function pengaturHarga(nama: string, tambahan: boolean, kirimHarga: (persen: number) => void): PengaturHarga {
  const elemen = el('div', 'pengatur-harga');
  const turun = el('button', 'harga-tombol', '−');
  const nilai = el('span', 'harga-nilai');
  const naik = el('button', 'harga-tombol', '+');
  turun.type = 'button';
  naik.type = 'button';
  turun.setAttribute('aria-label', TEKS.hargaTurun(nama));
  naik.setAttribute('aria-label', TEKS.hargaNaik(nama));
  elemen.append(turun, nilai, naik);
  const saran = el('button', 'harga-saran');
  saran.type = 'button';
  let sekarang: ModelHarga | null = null;
  turun.addEventListener('click', () => sekarang && kirimHarga(sekarang.persen - sekarang.langkah));
  naik.addEventListener('click', () => sekarang && kirimHarga(sekarang.persen + sekarang.langkah));
  saran.addEventListener('click', () => sekarang && kirimHarga(sekarang.saranPersen));
  return {
    elemen,
    saran,
    perbarui(h) {
      sekarang = h;
      setTeks(nilai, rupiahHarga(h.rupiah, tambahan));
      const normal = tambahan ? 0 : 100;
      nilai.classList.toggle('murah', h.persen < normal);
      nilai.classList.toggle('mahal', h.persen > normal && !h.terlaluMahal);
      nilai.classList.toggle('terlalu-mahal', h.terlaluMahal);
      setDisabled(turun, !h.bisaTurun);
      setDisabled(naik, !h.bisaNaik);
      const pas = h.persen === h.saranPersen;
      setTeks(saran, h.terlaluMahal ? TEKS.hargaTerlaluMahal(rupiahHarga(h.saranRupiah, tambahan)) : pas ? TEKS.hargaSesuaiSaran : TEKS.hargaSaran(rupiahHarga(h.saranRupiah, tambahan)));
      saran.classList.toggle('terlalu-mahal', h.terlaluMahal);
      setDisabled(saran, pas);
    },
  };
}

/** "Peminat −20% · kursi terisi 78%" atau "… · kursi penuh, 15% tak terangkut" (tanda untuk menaikkan harga). */
function teksHarga(h: ModelHarga): string {
  const kursi = h.minat > 1.005 ? TEKS.hargaPenuh(persen(h.minat - 1)) : TEKS.hargaTerisi(persen(h.terisi));
  return `${TEKS.hargaPeminat(persen(h.peminat))} · ${kursi}`;
}

// ---------------------------------------------------------------------------
// Jurusan

export function buatTabJurusan(kirim: Kirim): IsiTab {
  const elemen = el('div', 'isi-tab daftar-item');
  const ringkasan = el('div', 'jurusan-ringkasan');
  const grid = el('div', 'jurusan-grid');
  const chip: HTMLElement[] = [];
  const tombolBuka = baris3('<path d="M4 12h12M12 6l6 6-6 6" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>', '', 'jurusan');
  tombolBuka.tombol.addEventListener('click', () => kirim({ jenis: 'bukaJurusan' }));
  // Harga tiket tiap jurusan yang sudah dibuka (baris dibuat saat pertama kali dibutuhkan).
  const judulHarga = el('div', 'judul-bagian', TEKS.hargaJudulJurusan);
  const catatanHarga = el('div', 'harga-catatan', TEKS.hargaCatatan);
  // Batas tiket yang masih diterima penumpang, atau peringatan bila sudah terlalu mahal.
  const wajarHarga = el('div', 'harga-wajar');
  const barisHarga: { elemen: HTMLElement; keterangan: HTMLElement; pengatur: PengaturHarga }[] = [];
  elemen.append(ringkasan, grid, tombolBuka.elemen, judulHarga, catatanHarga, wajarHarga);
  return {
    elemen,
    perbarui(m) {
      const j = m.jurusan;
      setTeks(ringkasan, TEKS.nilaiTiket(formatAngka(j.multTiket, { desimalKecil: 2 }), rupiahKecil(j.nilaiPerPenumpang), rupiahKecil(j.nilaiDibayar)));
      setTeks(wajarHarga, j.penaltiHarga > 0 ? TEKS.hargaPenaltiAktif(persen(j.penaltiHarga)) : TEKS.hargaBatasWajar(rupiahKecil(j.batasWajar)));
      wajarHarga.classList.toggle('terlalu-mahal', j.penaltiHarga > 0);
      j.daftar.forEach((d, i) => {
        const h = d.harga;
        let b = barisHarga[i];
        if (!b && h) {
          const baris = el('div', 'item item-harga');
          baris.dataset['hargaJurusan'] = String(i);
          baris.classList.toggle('antarpulau', d.feri !== null);
          const info = el('div', 'item-info');
          const keterangan = el('div', 'item-keterangan');
          const pengatur = pengaturHarga(d.nama, false, (persen) => kirim({ jenis: 'aturHargaJurusan', indeks: i, persen }));
          info.append(el('span', 'item-nama', d.nama), keterangan, pengatur.saran);
          baris.append(info, pengatur.elemen);
          // Urut jurusan: sisipkan sebelum baris jurusan berikutnya yang sudah ada.
          const sesudah = barisHarga.slice(i + 1).find((x) => x)?.elemen ?? null;
          elemen.insertBefore(baris, sesudah);
          b = { elemen: baris, keterangan, pengatur };
          barisHarga[i] = b;
        }
        if (!b) return;
        setHidden(b.elemen, h === null);
        if (h) {
          setTeks(b.keterangan, teksHarga(h));
          b.pengatur.perbarui(h);
        }
      });
      j.daftar.forEach((d, i) => {
        let c = chip[i];
        if (!c) {
          // Pemisah sebelum rute antarpulau pertama.
          if (d.feri !== null && !grid.querySelector('.jurusan-pemisah')) grid.append(el('div', 'jurusan-pemisah', TEKS.jurusanAntarpulau));
          c = el('div', 'jurusan-chip');
          grid.append(c);
          chip[i] = c;
        }
        const teks = d.bonusTiket > 0 ? `${d.nama} +${persen(d.bonusTiket)}%` : d.nama;
        if (c.dataset['teks'] !== teks + d.buka) {
          c.dataset['teks'] = teks + d.buka;
          const ikon = !d.buka ? IKON_GEMBOK : d.feri !== null ? IKON_KAPAL : '';
          c.innerHTML = `${ikon}${escapeHtml(teks)}`;
        }
        c.classList.toggle('buka', d.buka);
        c.classList.toggle('antarpulau', d.feri !== null);
      });
      const b = j.berikutnya;
      setHidden(tombolBuka.tombol, b === null);
      setTeks(tombolBuka.nama, b ? TEKS.bukaJurusan(b.nama, persen(b.bonusTiket)) : TEKS.semuaJurusanBuka);
      const ikutPo = b?.po ? ` · ${TEKS.poIkutJurusan(NAMA_PO[b.po].nama)}` : '';
      const feri = b?.feri ? `${TEKS.lewatFeri(b.feri)} · ` : '';
      const syarat = b && b.kurangKelas !== null ? TEKS.jurusanButuhTerminal(namaKelas(b.kurangKelas)) : TEKS.tiketSetelahBuka(formatAngka(j.multTiket + (b?.bonusTiket ?? 0), { desimalKecil: 2 }));
      setTeks(tombolBuka.keterangan, b ? `${feri}${syarat}${ikutPo}` : '');
      tombolBuka.elemen.classList.toggle('terkunci', b !== null && b.kurangKelas !== null);
      if (b) {
        setTeks(tombolBuka.tombolKecil, TEKS.buka);
        setTeks(tombolBuka.tombolBesar, formatUang(b.biaya));
        setDisabled(tombolBuka.tombol, !b.bisa);
      }
    },
  };
}

// ---------------------------------------------------------------------------
// Armada: kelas bus & mitra PO

/** Ikon kelas bus (viewBox 24): bentuk badan, jendela, dan atapnya. */
const IKON_KELAS_BUS: Readonly<Record<KelasBusId, string>> = {
  ekonomi:
    '<rect x="2" y="7" width="20" height="11" rx="2" fill="currentColor"/><rect x="6" y="5.6" width="3" height="1.4" fill="currentColor"/><rect x="14" y="5.6" width="3" height="1.4" fill="currentColor"/><path d="M4 9.5h4v3.5H4zM9.5 9.5h4v3.5h-4zM15 9.5h5v3.5h-5z" fill="#0b1117" opacity="0.85"/><circle cx="7" cy="18.5" r="2" fill="#0b1117"/><circle cx="17" cy="18.5" r="2" fill="#0b1117"/>',
  patas:
    '<rect x="2" y="7" width="20" height="11" rx="2" fill="currentColor"/><rect x="8" y="4.6" width="7" height="2.4" rx="0.8" fill="currentColor" opacity="0.8"/><path d="M4 9.5h16v3.5H4z" fill="#0b1117" opacity="0.85"/><circle cx="7" cy="18.5" r="2" fill="#0b1117"/><circle cx="17" cy="18.5" r="2" fill="#0b1117"/>',
  eksekutif:
    '<path d="M2 6.5h17.5a2.5 2.5 0 0 1 2.5 2.5v9H2z" fill="currentColor"/><path d="M3.5 8.4h13.8v4.4H3.5zM18.5 8.4h2.3v5.6h-2.3z" fill="#0b1117" opacity="0.9"/><path d="M3 14.6h14" stroke="#0b1117" stroke-width="0.8" opacity="0.5"/><circle cx="7" cy="18.5" r="2" fill="#0b1117"/><circle cx="17" cy="18.5" r="2" fill="#0b1117"/>',
  sleeper:
    '<path d="M2 5h17.5A2.5 2.5 0 0 1 22 7.5V18H2z" fill="currentColor"/><path d="M3.5 7h2.6v2.4H3.5zM7.4 7H10v2.4H7.4zM11.3 7h2.6v2.4h-2.6zM3.5 11h2.6v2.4H3.5zM7.4 11H10v2.4H7.4zM11.3 11h2.6v2.4h-2.6zM16 7h4.8v7H16z" fill="#0b1117" opacity="0.9"/><circle cx="7" cy="18.5" r="2" fill="#0b1117"/><circle cx="17" cy="18.5" r="2" fill="#0b1117"/>',
  tingkat:
    '<path d="M2 3.5h17.5A2.5 2.5 0 0 1 22 6v12H2z" fill="currentColor"/><path d="M3.5 5.3h17.2v3.9H3.5zM3.5 11.3h12v3.2h-12zM17 11.3h3.7v4.3H17z" fill="#0b1117" opacity="0.9"/><circle cx="7" cy="18.5" r="2" fill="#0b1117"/><circle cx="17" cy="18.5" r="2" fill="#0b1117"/>',
};

const hexWarna = (c: number): string => `#${c.toString(16).padStart(6, '0')}`;

/** Ikon bus kecil bercat livery PO (viewBox 24): badan, pola aksen, jendela, roda. */
function ikonLivery(l: Livery): string {
  const a = hexWarna(l.aksen);
  const pola =
    l.pola === 'garis'
      ? `<rect x="2" y="8.6" width="20" height="1.6" fill="${a}"/><rect x="2" y="15.4" width="20" height="0.9" fill="${a}"/>`
      : l.pola === 'dua'
        ? `<path d="M2 14.2h20v2.8a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2z" fill="${a}"/>`
        : l.pola === 'sapuan'
          ? `<path d="M2 16.5 12 13l10-6.2v2.6L12 15.6 2 19z" fill="${a}"/>`
          : '';
  return `<rect x="2" y="5" width="20" height="14" rx="2.5" fill="${hexWarna(l.warna)}"/>${pola}<rect x="4" y="10.6" width="16" height="3" rx="0.6" fill="#1e293b" opacity="0.9"/><circle cx="7" cy="19" r="2" fill="#0b1117"/><circle cx="17" cy="19" r="2" fill="#0b1117"/>`;
}

export function buatTabArmada(kirim: Kirim): IsiTab {
  const elemen = el('div', 'isi-tab daftar-item');
  // Kelas bus: didatangkan berurutan, diulang saat naik kelas terminal.
  const ringkasanKelas = el('div', 'jurusan-ringkasan');
  elemen.append(el('div', 'judul-bagian', TEKS.judulKelasBus), ringkasanKelas);
  const barisKelas = KELAS_BUS_IDS.map((id) => {
    const r = baris3(IKON_KELAS_BUS[id], NAMA_KELAS_BUS[id].nama, 'kelas-bus');
    r.elemen.dataset['kelasBus'] = id;
    r.tombol.addEventListener('click', () => kirim({ jenis: 'beliKelasBus', kelas: id }));
    // Kelas yang beroperasi: tombol beli diganti pengatur tambahan harga, dan baris peminat, kursi terisi, & saran.
    const infoHarga = el('div', 'item-keterangan item-harga-info');
    const pengatur = pengaturHarga(NAMA_KELAS_BUS[id].nama, true, (persen) => kirim({ jenis: 'aturTambahanKelas', kelas: id, persen }));
    r.keterangan.after(infoHarga, pengatur.saran);
    r.elemen.append(pengatur.elemen);
    elemen.append(r.elemen);
    return { id, ...r, infoHarga, pengatur };
  });
  const ringkasan = el('div', 'jurusan-ringkasan');
  elemen.append(el('div', 'judul-bagian', TEKS.judulMitraPo), ringkasan);
  const baris = PO_IDS.map((id) => {
    const r = baris3(ikonLivery(LIVERY_PO[id]), NAMA_PO[id].nama, 'po');
    r.elemen.dataset['po'] = id;
    r.tombol.addEventListener('click', () => kirim({ jenis: 'kontrakPo', po: id }));
    elemen.append(r.elemen);
    return { id, ...r };
  });
  return {
    elemen,
    perbarui(m) {
      const a = m.armada;
      setTeks(ringkasanKelas, `${TEKS.kelasBusRingkas(a.jumlahKelasBus, a.kelasBus.length, persen(a.bonusKelasBus))} · ${TEKS.kelasBusDiulang} ${TEKS.hargaKelasCatatan}`);
      for (const b of barisKelas) {
        const k = a.kelasBus.find((x) => x.id === b.id)!;
        const nama = NAMA_KELAS_BUS[b.id];
        const status = k.beroperasi
          ? k.bonusTiket > 0
            ? TEKS.kelasBusBeroperasi(persen(k.bonusTiket))
            : TEKS.kelasBusAwal
          : k.kurang?.jenis === 'sebelumnya'
            ? TEKS.kelasBusSyaratSebelumnya(NAMA_KELAS_BUS[k.kurang.kelas].nama)
            : k.kurang?.jenis === 'terminal'
              ? TEKS.kelasBusSyaratTerminal(namaKelas(k.kurang.kelas))
              : TEKS.kelasBusTiket(persen(k.bonusTiket));
        setTeks(b.keterangan, `${nama.deskripsi} · ${status}`);
        setTeks(b.level, '✓');
        setHidden(b.level, !k.beroperasi);
        setHidden(b.tombol, k.beroperasi);
        setHidden(b.infoHarga, k.harga === null);
        setHidden(b.pengatur.elemen, k.harga === null);
        setHidden(b.pengatur.saran, k.harga === null);
        if (k.harga) {
          setTeks(b.infoHarga, teksHarga(k.harga));
          b.pengatur.perbarui(k.harga);
        }
        setTeks(b.tombolKecil, TEKS.beli);
        setTeks(b.tombolBesar, formatUang(k.biaya));
        setDisabled(b.tombol, !k.bisa);
        b.elemen.classList.toggle('belum', !k.beroperasi);
        b.elemen.classList.toggle('terkunci', !k.beroperasi && k.kurang !== null);
      }
      setTeks(ringkasan, TEKS.armadaRingkas(a.jumlah, a.daftar.length, persen(a.bonusTiket)));
      for (const b of baris) {
        const po = a.daftar.find((x) => x.id === b.id)!;
        const sy = po.syarat;
        const status = po.bergabung
          ? TEKS.poBergabung(persen(a.bonusPerPo))
          : sy.jenis === 'jurusan'
            ? TEKS.poSyaratJurusan(sy.kota)
            : sy.jenis === 'kelas'
              ? TEKS.poSyaratKelas(namaKelas(sy.kelas))
              : sy.jenis === 'event'
                ? TEKS.poSyaratEvent(NAMA_EVENT[sy.event].nama)
                : sy.kepuasanKurang && sy.kepuasanMin !== null
                  ? TEKS.poSyaratKepuasan(persen(sy.kepuasanMin))
                  : TEKS.poSyaratKontrak(persen(a.bonusPerPo));
        setTeks(b.keterangan, `${NAMA_PO[b.id].asal} · ${status}`);
        setTeks(b.level, '✓');
        setHidden(b.level, !po.bergabung);
        setHidden(b.tombol, po.bergabung || sy.jenis !== 'kontrak');
        if (sy.jenis === 'kontrak') {
          setTeks(b.tombolKecil, TEKS.kontrak);
          setTeks(b.tombolBesar, formatUang(sy.biaya));
          setDisabled(b.tombol, !sy.bisa);
        }
        b.elemen.classList.toggle('belum', !po.bergabung);
      }
    },
  };
}

// ---------------------------------------------------------------------------
// Modernisasi

export function buatTabModern(kirim: Kirim): IsiTab {
  const elemen = el('div', 'isi-tab daftar-item');
  const baris = TEKNOLOGI_IDS.map((id: TeknologiId) => {
    const r = baris3('<path d="M12 2l2.4 6.3L21 9l-5 4.5L17.5 21 12 17.3 6.5 21 8 13.5 3 9l6.6-.7z" fill="currentColor"/>', NAMA_TEKNOLOGI[id], 'modern');
    r.tombol.addEventListener('click', () => kirim({ jenis: 'beliTeknologi', teknologi: id }));
    elemen.append(r.elemen);
    return { id, ...r };
  });
  return {
    elemen,
    perbarui(m) {
      for (const b of baris) {
        const t = m.teknologi.find((x) => x.id === b.id)!;
        b.elemen.style.setProperty('--warna', keHexCss(WARNA_TAHAP[t.tahap]));
        setTeks(b.keterangan, t.syaratKurang ? TEKS.butuh(NAMA_TEKNOLOGI[t.syaratKurang]) : TEKS.kapasitasPersen(persen(t.multKapasitas - 1), t.namaTahap));
        setHidden(b.level, !t.dimiliki);
        setTeks(b.level, '✓');
        setHidden(b.tombol, t.dimiliki);
        setTeks(b.tombolKecil, TEKS.pasang);
        setTeks(b.tombolBesar, formatUang(t.biaya));
        setDisabled(b.tombol, !t.bisa);
        b.elemen.classList.toggle('belum', !t.dimiliki);
        b.elemen.classList.toggle('terkunci', t.syaratKurang !== null);
      }
    },
  };
}

// ---------------------------------------------------------------------------
// Tantangan mingguan & rekor

/** Tugas satu tantangan mingguan. */
function teksTantangan(t: ModelTantangan, m: ModelMingguan): string {
  switch (t.jenis) {
    case 'penumpang':
      return TEKS.tantanganPenumpang(formatAngka(t.target));
    case 'pendapatan':
      return TEKS.tantanganPendapatan(formatUang(t.target));
    case 'upgrade':
      return TEKS.tantanganUpgrade(t.target);
    case 'kepuasan':
      return TEKS.tantanganKepuasan(persen(m.kepuasanMin), Math.round(t.target / 60));
    case 'fasilitas':
      return TEKS.tantanganFasilitas(t.target);
  }
}

/** Kemajuan "x / target" dalam satuan tantangannya. */
function angkaTantangan(t: ModelTantangan): string {
  const ada = Math.min(t.progres, t.target);
  switch (t.jenis) {
    case 'pendapatan':
      return `${formatUang(Math.floor(ada))} / ${formatUang(t.target)}`;
    case 'kepuasan':
      return TEKS.tantanganMenit(Math.floor(ada / 60), Math.round(t.target / 60));
    default:
      return `${formatAngka(Math.floor(ada))} / ${formatAngka(t.target)}`;
  }
}

/** Kartu tantangan mingguan: tiga baris berbilah dengan tombol klaim. */
function buatKartuTantangan(kirim: Kirim): { readonly elemen: HTMLElement; perbarui(m: ModelMingguan | null): void } {
  const elemen = el('div', 'target-kartu kartu-kolom tantangan-kartu');
  const judul = el('div', 'target-judul');
  const daftar = el('div', 'tantangan-daftar');
  const catatan = el('div', 'kelas-berikut', TEKS.tantanganCatatan);
  elemen.append(judul, daftar, catatan);
  const baris: { readonly elemen: HTMLElement; readonly label: HTMLElement; readonly isi: HTMLElement; readonly angka: HTMLElement; readonly tombol: HTMLButtonElement; readonly besar: HTMLElement }[] = [];
  return {
    elemen,
    perbarui(m) {
      setHidden(elemen, m === null);
      if (!m) return;
      const sisa = m.selesaiMs - Date.now();
      setTeks(judul, sisa > 0 ? TEKS.tantanganJudul(sisaWaktuEvent(sisa)) : TEKS.tantanganBerakhir);
      m.daftar.forEach((t, i) => {
        let b = baris[i];
        if (!b) {
          const e = el('div', 'tantangan-baris');
          const label = el('div', 'tantangan-label');
          const bar = el('div', 'bar');
          const isi = el('div', 'bar-isi');
          bar.append(isi);
          const angka = el('div', 'tantangan-angka');
          const tombol = el('button', 'tombol tombol-beli tombol-klaim');
          tombol.type = 'button';
          const kecil = el('span', 'tombol-kecil', TEKS.klaim);
          const besar = el('span', 'tombol-besar');
          tombol.append(kecil, besar);
          tombol.addEventListener('click', () => kirim({ jenis: 'klaimTantangan', indeks: i }));
          e.append(label, tombol, bar, angka);
          daftar.append(e);
          b = { elemen: e, label, isi, angka, tombol, besar };
          baris[i] = b;
        }
        setTeks(b.label, teksTantangan(t, m));
        setStyle(b.isi, 'width', `${(t.rasio * 100).toFixed(1)}%`);
        setTeks(b.angka, t.diklaim ? TEKS.diklaim : angkaTantangan(t));
        setTeks(b.besar, `+${formatUang(m.hadiah)}`);
        setHidden(b.tombol, t.diklaim);
        setDisabled(b.tombol, !t.selesai || t.diklaim);
        b.elemen.classList.toggle('selesai', t.selesai);
        b.elemen.classList.toggle('siap', t.selesai && !t.diklaim);
      });
    },
  };
}

/** Kartu rekor pribadi: hari ini, rekor harian, arus tertinggi. */
function buatKartuRekor(): { readonly elemen: HTMLElement; perbarui(m: ModelTampilan): void } {
  const elemen = el('div', 'target-kartu kartu-kolom rekor-kartu');
  const judul = el('div', 'target-judul', TEKS.rekorJudul);
  const hariIni = el('div', 'kelas-berikut');
  const daftar = el('div', 'rekor-daftar');
  const nilai = [TEKS.rekorPenumpang, TEKS.rekorPendapatan, TEKS.rekorArus].map((label) => {
    const v = el('span', 'rekor-nilai');
    daftar.append(el('span', 'rekor-label', label), v);
    return v;
  });
  elemen.append(judul, hariIni, daftar);
  return {
    elemen,
    perbarui(m) {
      const r = m.rekor;
      setTeks(hariIni, TEKS.rekorHariIni(formatAngka(Math.floor(r.penumpangHariIni)), formatUang(Math.floor(r.pendapatanHariIni))));
      const [p, rp, arus] = nilai as [HTMLElement, HTMLElement, HTMLElement];
      setTeks(p, r.penumpangHarian > 0 ? formatAngka(Math.floor(r.penumpangHarian)) : TEKS.rekorBelum);
      setTeks(rp, r.pendapatanHarian > 0 ? formatUang(Math.floor(r.pendapatanHarian)) : TEKS.rekorBelum);
      setTeks(arus, `${formatAngka(r.arusTertinggi)} ${TEKS.satuanArus}`);
    },
  };
}

// ---------------------------------------------------------------------------
// Target harian & penghargaan

export interface OpsiTabTarget {
  /** Iklan berhadiah untuk klaim 2× (tanpa ini tombolnya tidak ada). */
  readonly iklan?: IklanMenu;
  /** Membuka konfirmasi naik kelas (naik kelas mengulang terminal dari awal, jadi tidak langsung dikirim dari tombol). */
  readonly konfirmasiNaikKelas?: (m: ModelKelas) => void;
  /** Membuka popup nama terminal (lihat popup-nama.ts) dengan nama & kelas sekarang. */
  readonly ubahNama?: (m: ModelKelas) => void;
  /** Kartu papan peringkat (ui/peringkat.ts), di bawah tantangan mingguan. */
  readonly kartuPeringkat?: { readonly elemen: HTMLElement; perbarui(m: ModelTampilan): void };
}

export function buatTabTarget(kirim: Kirim, o: OpsiTabTarget = {}): IsiTab {
  const { iklan, konfirmasiNaikKelas, ubahNama, kartuPeringkat } = o;
  let menonton = false;
  /** Tonton iklan lalu kirim aksi klaim ganda; satu iklan pada satu waktu. */
  const klaimGanda = (tempat: 'target2x' | 'penghargaan2x', aksi: Aksi): void => {
    if (!iklan || menonton) return;
    menonton = true;
    void iklan
      .tonton(tempat)
      .then((ok) => ok && kirim(aksi))
      .finally(() => (menonton = false));
  };
  const elemen = el('div', 'isi-tab daftar-item');
  // Event musiman: sisa waktu, pengali pendapatan, tahap target & klaim hadiahnya.
  const kartuEvent = el('div', 'target-kartu event-kartu');
  const eventJudul = el('div', 'target-judul event-judul');
  const eventTugas = el('div', 'target-tugas');
  const eventKet = el('div', 'kelas-berikut');
  const eventBar = el('div', 'bar');
  const eventBarIsi = el('div', 'bar-isi');
  eventBar.append(eventBarIsi);
  const eventAngka = el('div', 'target-angka');
  const tombolEvent = el('button', 'tombol tombol-beli tombol-klaim');
  tombolEvent.type = 'button';
  const eventKecil = el('span', 'tombol-kecil', TEKS.klaim);
  const eventBesar = el('span', 'tombol-besar');
  tombolEvent.append(eventKecil, eventBesar);
  tombolEvent.addEventListener('click', () => kirim({ jenis: 'klaimEvent' }));
  const eventKiri = el('div', 'target-kiri');
  eventKiri.append(eventJudul, eventTugas, eventKet, eventBar, eventAngka);
  const eventKanan = el('div', 'target-tombol');
  eventKanan.append(tombolEvent);
  kartuEvent.append(eventKiri, eventKanan);
  kartuEvent.hidden = true;
  // Kelas terminal: bonus sekarang, kemajuan menuju naik kelas, tombol naik kelas.
  const kartuKelas = el('div', 'target-kartu kelas-kartu');
  const kelasJudul = el('div', 'target-judul kelas-judul');
  // Nama terminal: tombol ✎ di samping judul kartu kelas.
  const tombolNama = el('button', 'tombol-nama');
  tombolNama.type = 'button';
  tombolNama.title = TEKS.namaTombol;
  tombolNama.setAttribute('aria-label', TEKS.namaTombol);
  tombolNama.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20h4L19 9l-4-4L4 16z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><path d="M13.5 6.5l4 4" stroke="currentColor" stroke-width="2"/></svg>';
  const barisJudulKelas = el('div', 'kelas-judul-baris');
  barisJudulKelas.append(kelasJudul, tombolNama);
  const kelasBonus = el('div', 'target-tugas');
  const kelasBar = el('div', 'bar');
  const kelasBarIsi = el('div', 'bar-isi');
  kelasBar.append(kelasBarIsi);
  const kelasAngka = el('div', 'target-angka');
  const kelasBerikut = el('div', 'kelas-berikut');
  const tombolKelas = el('button', 'tombol tombol-beli tombol-kelas');
  tombolKelas.type = 'button';
  const kelasKecil = el('span', 'tombol-kecil', TEKS.naikKelas);
  const kelasBesar = el('span', 'tombol-besar');
  tombolKelas.append(kelasKecil, kelasBesar);
  let modelKelas: ModelKelas | null = null;
  tombolKelas.addEventListener('click', () => {
    if (modelKelas?.bisa) konfirmasiNaikKelas?.(modelKelas);
  });
  tombolNama.addEventListener('click', () => {
    if (modelKelas) ubahNama?.(modelKelas);
  });
  const kelasKiri = el('div', 'target-kiri');
  kelasKiri.append(barisJudulKelas, kelasBonus, kelasBerikut, kelasBar, kelasAngka);
  const kelasKanan = el('div', 'target-tombol');
  kelasKanan.append(tombolKelas);
  kartuKelas.append(kelasKiri, kelasKanan);
  const kartu = el('div', 'target-kartu');
  const judul = el('div', 'target-judul');
  const tugas = el('div', 'target-tugas');
  const bar = el('div', 'bar');
  const barIsi = el('div', 'bar-isi');
  bar.append(barIsi);
  const angka = el('div', 'target-angka');
  const tombolTarget = el('button', 'tombol tombol-beli tombol-klaim');
  tombolTarget.type = 'button';
  const targetKecil = el('span', 'tombol-kecil');
  const targetBesar = el('span', 'tombol-besar');
  tombolTarget.append(targetKecil, targetBesar);
  tombolTarget.addEventListener('click', () => kirim({ jenis: 'klaimTarget' }));
  const gandaTarget = tombolGanda();
  gandaTarget.tombol.addEventListener('click', () => klaimGanda('target2x', { jenis: 'klaimTarget', ganda: true }));
  const kiri = el('div', 'target-kiri');
  kiri.append(judul, tugas, bar, angka);
  const tombolKanan = el('div', 'target-tombol');
  tombolKanan.append(gandaTarget.tombol, tombolTarget);
  kartu.append(kiri, tombolKanan);
  const judulPenghargaan = el('div', 'judul-bagian', TEKS.penghargaan);
  const kartuTantangan = buatKartuTantangan(kirim);
  const kartuRekor = buatKartuRekor();
  elemen.append(kartuEvent, kartuKelas, kartu, kartuTantangan.elemen, ...(kartuPeringkat ? [kartuPeringkat.elemen] : []), kartuRekor.elemen, judulPenghargaan);
  const baris = PENCAPAIAN_IDS.map((id: PencapaianId) => {
    const r = baris3(IKON_PIALA.replace(/^<svg[^>]*>|<\/svg>$/g, ''), NAMA_PENCAPAIAN[id].nama, 'penghargaan');
    setTeks(r.keterangan, NAMA_PENCAPAIAN[id].deskripsi);
    r.tombol.addEventListener('click', () => kirim({ jenis: 'klaimPencapaian', pencapaian: id }));
    const ganda = tombolGanda();
    ganda.tombol.addEventListener('click', () => klaimGanda('penghargaan2x', { jenis: 'klaimPencapaian', pencapaian: id, ganda: true }));
    r.tombol.before(ganda.tombol);
    elemen.append(r.elemen);
    return { id, ...r, ganda };
  });
  return {
    elemen,
    perbarui(m) {
      kartuTantangan.perbarui(m.mingguan);
      kartuPeringkat?.perbarui(m);
      kartuRekor.perbarui(m);
      const ev = m.event;
      setHidden(kartuEvent, ev === null);
      if (ev) {
        const nama = NAMA_EVENT[ev.id];
        const sisa = ev.selesaiMs !== null ? TEKS.eventSisa(sisaWaktuEvent(ev.selesaiMs - Date.now())) : TEKS.eventBerakhir;
        setTeks(eventJudul, `${nama.ikon} ${TEKS.eventJudul(nama.nama, ev.tahun)} · ${sisa}`);
        const tuntas = ev.tahap >= ev.jumlahTahap;
        setTeks(eventTugas, tuntas ? TEKS.eventTuntas : TEKS.eventTugas(formatAngka(ev.target), ev.tahap + 1, ev.jumlahTahap));
        setTeks(eventKet, TEKS.eventKeterangan(formatAngka(ev.pengali, { desimalKecil: 2 }), NAMA_PO[ev.po].nama, ev.poSudah));
        setStyle(eventBarIsi, 'width', `${((tuntas ? 1 : ev.rasio) * 100).toFixed(1)}%`);
        setTeks(eventAngka, tuntas ? '' : `${formatAngka(Math.floor(Math.min(ev.progres, ev.target)))} / ${formatAngka(ev.target)}`);
        setHidden(tombolEvent, tuntas);
        setTeks(eventBesar, `+${formatUang(ev.hadiah)}`);
        setDisabled(tombolEvent, !ev.bisaKlaim);
        kartuEvent.classList.toggle('siap', ev.bisaKlaim);
        kartuEvent.dataset['event'] = ev.id;
      }
      const k = m.kelas;
      modelKelas = k;
      const berikut = namaKelas(k.kelas + 1);
      setTeks(kelasJudul, TEKS.kelasJudul(namaKelas(k.kelas), k.nama));
      setHidden(tombolNama, !ubahNama);
      setTeks(kelasBonus, TEKS.kelasBonus(persen(k.bonus)));
      setTeks(kelasBerikut, k.bisa ? TEKS.kelasBerikut(berikut, k.poinTersedia, persen(k.bonusSetelah)) : TEKS.kelasSyarat(berikut, k.poinMinimal));
      setStyle(kelasBarIsi, 'width', `${(k.rasio * 100).toFixed(1)}%`);
      setTeks(kelasAngka, TEKS.kelasKemajuan(formatUang(k.pendapatanRun), formatUang(k.pendapatanPerlu)));
      setTeks(kelasBesar, k.bisa ? TEKS.poin(k.poinTersedia) : TEKS.poinDari(k.poinTersedia, k.poinMinimal));
      setDisabled(tombolKelas, !k.bisa);
      kartuKelas.classList.toggle('siap', k.bisa);
      const t = m.target;
      setTeks(judul, TEKS.targetHari(t.hari));
      setTeks(tugas, t.jenis === 'upgrade' ? TEKS.targetUpgrade(formatAngka(t.target)) : TEKS.targetPenumpang(formatAngka(t.target)));
      setStyle(barIsi, 'width', `${(t.rasio * 100).toFixed(1)}%`);
      setTeks(angka, `${formatAngka(Math.floor(t.progres))} / ${formatAngka(t.target)}`);
      setTeks(targetKecil, t.diklaim ? '' : TEKS.klaim);
      setTeks(targetBesar, t.diklaim ? TEKS.diklaim : `+${formatUang(t.hadiah)}`);
      setDisabled(tombolTarget, !t.selesai || t.diklaim);
      const bisaIklan = iklan?.siap() ?? false;
      setHidden(gandaTarget.tombol, !bisaIklan || !t.selesai || t.diklaim);
      setTeks(gandaTarget.besar, `+${formatUang(t.hadiah.times(2))}`);
      kartu.classList.toggle('siap', t.selesai && !t.diklaim);
      for (const b of baris) {
        const p = m.pencapaian.find((x) => x.id === b.id)!;
        b.elemen.classList.toggle('belum', !p.tercapai);
        b.elemen.classList.toggle('siap', p.tercapai && !p.diklaim);
        // Belum tercapai: tanpa tombol. Tercapai: tombol klaim. Diklaim: tanda ✓.
        setHidden(b.tombol, !p.tercapai || p.diklaim);
        setHidden(b.level, !p.diklaim);
        setTeks(b.level, '✓');
        setTeks(b.tombolKecil, TEKS.klaim);
        setTeks(b.tombolBesar, `+${formatUang(m.hadiahPencapaian)}`);
        setHidden(b.ganda.tombol, !bisaIklan || !p.tercapai || p.diklaim);
        setTeks(b.ganda.besar, `+${formatUang(m.hadiahPencapaian.times(2))}`);
      }
    },
  };
}

// ---------------------------------------------------------------------------
// Baris item: ikon | nama + level + keterangan | tombol

interface Baris {
  readonly elemen: HTMLElement;
  readonly nama: HTMLElement;
  readonly level: HTMLElement;
  readonly keterangan: HTMLElement;
  readonly tombol: HTMLButtonElement;
  readonly tombolKecil: HTMLElement;
  readonly tombolBesar: HTMLElement;
}

function baris3(ikonSvg: string, nama: string, jenis: string): Baris {
  const elemen = el('div', `item item-${jenis}`);
  const ikon = el('div', 'item-ikon');
  ikon.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true">${ikonSvg}</svg>`;
  const info = el('div', 'item-info');
  const atas = el('div', 'item-atas');
  const namaEl = el('span', 'item-nama', nama);
  const level = el('span', 'item-level');
  atas.append(namaEl, level);
  const keterangan = el('div', 'item-keterangan');
  info.append(atas, keterangan);
  const tombol = el('button', 'tombol tombol-beli');
  tombol.type = 'button';
  const tombolKecil = el('span', 'tombol-kecil');
  const tombolBesar = el('span', 'tombol-besar');
  tombol.append(tombolKecil, tombolBesar);
  elemen.append(ikon, info, tombol);
  return { elemen, nama: namaEl, level, keterangan, tombol, tombolKecil, tombolBesar };
}

// ---------------------------------------------------------------------------
// Helper DOM: tulis hanya kalau berubah

function el<K extends keyof HTMLElementTagNameMap>(tag: K, kelas?: string, teks?: string): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (kelas) e.className = kelas;
  if (teks !== undefined) e.textContent = teks;
  return e;
}

function setTeks(e: HTMLElement, teks: string): void {
  if (e.textContent !== teks) e.textContent = teks;
}

function setHidden(e: HTMLElement, hidden: boolean): void {
  if (e.hidden !== hidden) e.hidden = hidden;
}

function setDisabled(e: HTMLButtonElement, disabled: boolean): void {
  if (e.disabled !== disabled) e.disabled = disabled;
}

function setStyle(e: HTMLElement, prop: 'width', nilai: string): void {
  if (e.style[prop] !== nilai) e.style[prop] = nilai;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
}
