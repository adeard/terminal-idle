/**
 * Isi tab pengelolaan terminal di panel bawah: Bangun (kapasitas tiap area,
 * bangunan di slot, modernisasi), Petugas, PO (mitra PO), Terminal (level,
 * perluasan, tarif, laporan keuangan, kelas bus), dan Target (target harian,
 * tantangan, penghargaan). Elemen dibuat sekali (kartu PO saat PO bergabung);
 * tiap pembaruan state hanya mengubah teks/kelas yang berubah.
 */
import type { Aksi } from '../sim/aksi';
import { EKONOMI } from '../config/economy.config';
import { LIVERY_PO, type Livery } from '../config/livery.config';
import { KELAS_BUS_IDS, PENCAPAIAN_IDS, PETUGAS_IDS, TARIF_IDS, TEKNOLOGI_IDS, type BangunanId, type KelasBusId, type PencapaianId, type PetugasId, type PoId, type TarifId, type TeknologiId } from '../sim/fitur';
import type { RincianBiaya, RincianPendapatan } from '../sim/keuangan';
import type { AreaId } from '../sim/operasi';
import { keHexCss, WARNA_TAHAP } from '../config/tema';
import { formatAngka, formatDurasi, formatUang, formatUangBertanda } from './format';
import type { ModelBuku, ModelMingguan, ModelMitra, ModelPoTerdaftar, ModelPoTersedia, ModelTampilan, ModelTantangan, ModelTarif } from './model';
import {
  namaKelas,
  NAMA_AREA,
  NAMA_BANGUNAN,
  NAMA_BIAYA,
  NAMA_EVENT,
  NAMA_KELAS_BUS,
  NAMA_PENCAPAIAN,
  NAMA_PENDAPATAN,
  NAMA_PERLUASAN,
  NAMA_PETUGAS,
  NAMA_PO,
  NAMA_TAHAP,
  NAMA_TARIF,
  NAMA_TEKNOLOGI,
  NAMA_TINGKAT_PO,
  sisaWaktuEvent,
  TEKS,
} from './teks';

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

/** Tombol beli dua baris: teks kecil (aksi) di atas harga. */
function tombolBeli(): { tombol: HTMLButtonElement; kecil: HTMLSpanElement; besar: HTMLSpanElement } {
  const tombol = el('button', 'tombol tombol-beli');
  tombol.type = 'button';
  const kecil = el('span', 'tombol-kecil');
  const besar = el('span', 'tombol-besar');
  tombol.append(kecil, besar);
  return { tombol, kecil, besar };
}

/** Lama tombol berakibat besar (bongkar, putus kontrak) menunggu ketukan kedua. */
const MS_YAKIN = 3000;

/**
 * Tombol dua ketukan: ketukan pertama menampilkan `teksYakin` (dan, lewat
 * `menunggu()`, keterangan akibatnya), ketukan kedua dalam MS_YAKIN menjalankan `aksi`.
 */
function tombolYakin(kelas: string, teksYakin: string, aksi: () => void): { readonly tombol: HTMLButtonElement; menunggu(): boolean; aturTeks(teks: string): void } {
  const tombol = el('button', kelas);
  tombol.type = 'button';
  let teks = '';
  let sampai = 0;
  let timer = 0;
  const batal = (): void => {
    sampai = 0;
    tombol.textContent = teks;
    tombol.classList.remove('yakin');
  };
  tombol.addEventListener('click', () => {
    window.clearTimeout(timer);
    if (performance.now() < sampai) {
      batal();
      aksi();
      return;
    }
    sampai = performance.now() + MS_YAKIN;
    tombol.textContent = teksYakin;
    tombol.classList.add('yakin');
    timer = window.setTimeout(batal, MS_YAKIN);
  });
  return {
    tombol,
    menunggu: () => performance.now() < sampai,
    aturTeks(t) {
      teks = t;
      if (!(performance.now() < sampai)) setTeks(tombol, t);
    },
  };
}

/** Pengatur − nilai + (petugas, tarif). */
function pengatur(labelTurun: string, labelNaik: string, saatTurun: () => void, saatNaik: () => void): { readonly elemen: HTMLElement; readonly turun: HTMLButtonElement; readonly nilai: HTMLElement; readonly naik: HTMLButtonElement } {
  const elemen = el('div', 'pengatur-harga');
  const turun = el('button', 'harga-tombol tombol-kurang', '−');
  const nilai = el('span', 'harga-nilai');
  const naik = el('button', 'harga-tombol tombol-tambah', '+');
  turun.type = 'button';
  naik.type = 'button';
  turun.setAttribute('aria-label', labelTurun);
  naik.setAttribute('aria-label', labelNaik);
  turun.addEventListener('click', saatTurun);
  naik.addEventListener('click', saatNaik);
  elemen.append(turun, nilai, naik);
  return { elemen, turun, nilai, naik };
}

// ---------------------------------------------------------------------------
// Ikon (viewBox 24)

const IKON_JALUR =
  '<path d="M2 8.5 12 4l10 4.5V10H2z" fill="currentColor"/><path d="M4.5 10v10M12 10v10M19.5 10v10" stroke="currentColor" stroke-width="1.8"/><rect x="6" y="13" width="4.5" height="5.5" rx="1" fill="currentColor"/><rect x="13.5" y="13" width="4.5" height="5.5" rx="1" fill="currentColor" opacity="0.4"/>';
const IKON_LOKET =
  '<path d="M3 7a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v2.5a2.5 2.5 0 0 0 0 5V17a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-2.5a2.5 2.5 0 0 0 0-5z" fill="currentColor"/><path d="M14.5 6.5v11" stroke="#0b1117" stroke-width="1.4" stroke-dasharray="1.6 1.6" opacity="0.5"/>';
const IKON_BANGUNAN: Readonly<Record<BangunanId, string>> = {
  jalur: IKON_JALUR,
  jendela: IKON_LOKET,
  kursi: '<rect x="4" y="5" width="16" height="7" rx="2" fill="currentColor"/><rect x="3" y="12" width="18" height="3.2" rx="1" fill="currentColor"/><path d="M6 15v5M18 15v5" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>',
  kios: '<path d="M3 9l1.5-5h15L21 9a3 3 0 0 1-6 0 3 3 0 0 1-6 0 3 3 0 0 1-6 0z" fill="currentColor"/><path d="M5 12v8h14v-8" fill="none" stroke="currentColor" stroke-width="2"/><rect x="10" y="15" width="4" height="5" fill="currentColor"/>',
  toko: '<path d="M4.5 8h15l-1.3 12.5H5.8z" fill="currentColor"/><path d="M8.5 8V6.5a3.5 3.5 0 0 1 7 0V8" fill="none" stroke="currentColor" stroke-width="2"/><path d="M9 12.5h6" stroke="#0b1117" stroke-width="1.6" opacity="0.5"/>',
  toilet: '<circle cx="8" cy="5" r="2" fill="currentColor"/><circle cx="16" cy="5" r="2" fill="currentColor"/><path d="M6 9h4l.5 6H10v5H6v-5h-.5zM14 9h4l2 7h-2v4h-4v-4h-2z" fill="currentColor"/>',
  lahanParkir: '<rect x="3" y="3" width="18" height="18" rx="4" fill="currentColor"/><path d="M9.5 17V7h3.2a3 3 0 0 1 0 6H9.5" fill="none" stroke="#0b1117" stroke-width="2.2" stroke-linejoin="round"/>',
  posRetribusi: '<rect x="2" y="6" width="20" height="12" rx="2" fill="currentColor"/><circle cx="12" cy="12" r="3" fill="none" stroke="#0b1117" stroke-width="2"/><path d="M5 9v6M19 9v6" stroke="#0b1117" stroke-width="1.6"/>',
};
const IKON_MODERN = '<path d="M12 2l2.4 6.3L21 9l-5 4.5L17.5 21 12 17.3 6.5 21 8 13.5 3 9l6.6-.7z" fill="currentColor"/>';
const IKON_PANGKALAN =
  '<rect x="2" y="4" width="20" height="16" rx="2" fill="none" stroke="currentColor" stroke-width="2"/><path d="M8 4v16M16 4v16" stroke="currentColor" stroke-width="1.6" stroke-dasharray="2 2"/><rect x="3.8" y="7" width="2.6" height="10" rx="1" fill="currentColor"/><rect x="17.6" y="7" width="2.6" height="10" rx="1" fill="currentColor"/>';
const IKON_PETUGAS = '<circle cx="12" cy="7" r="3.6" fill="currentColor"/><path d="M4.5 21v-1.5a7.5 7.5 0 0 1 15 0V21z" fill="currentColor"/><path d="M8.5 4.6h7l-.8-2H9.3z" fill="currentColor"/>';
const IKON_MANAJER = '<circle cx="12" cy="7" r="3.6" fill="currentColor"/><path d="M4.5 21v-1.5a7.5 7.5 0 0 1 15 0V21z" fill="currentColor"/><path d="M12 13.2l1.4 1.6-1.4 5-1.4-5z" fill="#0b1117" opacity="0.6"/>';
const IKON_TARIF = '<circle cx="12" cy="12" r="9" fill="currentColor"/><path d="M8.5 15.5l7-7" stroke="#0b1117" stroke-width="2" stroke-linecap="round"/><circle cx="9" cy="9" r="1.6" fill="#0b1117"/><circle cx="15" cy="15" r="1.6" fill="#0b1117"/>';
const IKON_PIALA = '<path d="M7 3h10v5a5 5 0 0 1-10 0z" fill="currentColor"/><path d="M7 5H4a3 3 0 0 0 3 4M17 5h3a3 3 0 0 1-3 4" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M10 13h4v4h3v3H7v-3h3z" fill="currentColor"/>';
const IKON_PENSIL =
  '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20h4L19 9l-4-4L4 16z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><path d="M13.5 6.5l4 4" stroke="currentColor" stroke-width="2"/></svg>';

/** Warna area (kapasitas & bangunan): tiga area rantai penumpang mengikuti warna zonanya di adegan. */
const WARNA_AREA: Readonly<Record<AreaId, string>> = {
  peron: keHexCss(WARNA_TAHAP.peron),
  loket: keHexCss(WARNA_TAHAP.loket),
  keberangkatan: keHexCss(WARNA_TAHAP.keberangkatan),
  pangkalan: '#a78bfa',
};

const persen = (x: number): number => Math.round(x * 100);
const arus = (x: number): string => formatAngka(Math.round(x));

// ---------------------------------------------------------------------------
// Bangun

/** Kelompok bangunan di tab Bangun (per area), urut alur penumpang. */
const GRUP_BANGUN: readonly { readonly judul: string; readonly warna: string; readonly bangunan: readonly BangunanId[] }[] = [
  { judul: TEKS.grupPeron, warna: WARNA_AREA.peron, bangunan: ['jalur'] },
  { judul: TEKS.grupLoket, warna: WARNA_AREA.loket, bangunan: ['jendela'] },
  { judul: TEKS.grupRuangTunggu, warna: WARNA_AREA.keberangkatan, bangunan: ['kursi', 'kios', 'toko'] },
  { judul: TEKS.grupFasilitas, warna: '#14b8a6', bangunan: ['toilet', 'lahanParkir', 'posRetribusi'] },
];

interface BarisBangunan {
  readonly elemen: HTMLElement;
  perbarui(m: ModelTampilan): void;
}

function buatBarisBangunan(id: BangunanId, warna: string, kirim: Kirim): BarisBangunan {
  const r = baris3(IKON_BANGUNAN[id], NAMA_BANGUNAN[id].nama, 'bangun');
  r.elemen.dataset['bangunan'] = id;
  r.elemen.style.setProperty('--warna', warna);
  setTeks(r.keterangan, NAMA_BANGUNAN[id].deskripsi);
  const status = el('div', 'item-keterangan bangun-status');
  const bongkar = tombolYakin('tombol-bongkar', TEKS.bongkarYakin, () => kirim({ jenis: 'bongkar', bangunan: id }));
  const bawah = el('div', 'bangun-bawah');
  bawah.append(status, bongkar.tombol);
  r.keterangan.after(bawah);
  r.tombolKecil.textContent = TEKS.bangun;
  r.tombol.addEventListener('click', () => kirim({ jenis: 'bangun', bangunan: id }));
  return {
    elemen: r.elemen,
    perbarui(m) {
      const b = m.bangun.bangunan[id];
      setTeks(r.level, TEKS.bangunanJumlah(b.jumlah, b.slot));
      const kosong = id === 'jendela' && m.bangun.jendelaKosong > 0 ? ` · ${TEKS.jendelaKosong(m.bangun.jendelaKosong)}` : '';
      const teksStatus =
        b.biaya === null ? (b.slotBerikut !== null ? TEKS.slotPenuhPerluasan(b.slotBerikut) : TEKS.slotPenuh) : `${TEKS.perawatanPerHari(formatUang(b.perawatan))}${kosong}`;
      setTeks(status, teksStatus);
      status.classList.toggle('penuh', b.biaya === null);
      setHidden(r.tombol, b.biaya === null);
      if (b.biaya !== null) {
        setTeks(r.tombolBesar, formatUang(b.biaya));
        setDisabled(r.tombol, !b.bisa);
      }
      setHidden(bongkar.tombol, b.bongkar === null);
      if (b.bongkar !== null) bongkar.aturTeks(TEKS.bongkar(formatUang(b.bongkar)));
      r.elemen.classList.toggle('belum', b.jumlah === 0);
    },
  };
}

export function buatTabBangun(kirim: Kirim): IsiTab {
  const elemen = el('div', 'isi-tab daftar-item');
  // Kapasitas jam sibuk tiap area: yang paling lambat ditandai.
  const kartu = el('div', 'kapasitas-kartu');
  const judul = el('div', 'po-subjudul', TEKS.kapasitasJudul);
  const daftarArea = el('div', 'kapasitas-area');
  const area = (['peron', 'loket', 'keberangkatan', 'pangkalan'] as const).map((id) => {
    const e = el('div', 'area-chip');
    e.dataset['area'] = id;
    e.style.setProperty('--warna', WARNA_AREA[id]);
    const nilai = el('span', 'area-nilai');
    e.append(el('span', 'area-nama', NAMA_AREA[id]), nilai);
    daftarArea.append(e);
    return { id, e, nilai };
  });
  const ringkas = el('div', 'kapasitas-ringkas');
  kartu.append(judul, daftarArea, ringkas);
  elemen.append(kartu);

  const baris: BarisBangunan[] = [];
  for (const g of GRUP_BANGUN) {
    elemen.append(el('div', 'judul-bagian', g.judul));
    for (const id of g.bangunan) {
      const b = buatBarisBangunan(id, g.warna, kirim);
      baris.push(b);
      elemen.append(b.elemen);
    }
  }
  // Pangkalan bus: petak dari perluasan (tidak dibeli satu-satu).
  elemen.append(el('div', 'judul-bagian', TEKS.grupPangkalan));
  const pangkalan = baris3(IKON_PANGKALAN, NAMA_AREA.pangkalan, 'bangun');
  pangkalan.elemen.style.setProperty('--warna', WARNA_AREA.pangkalan);
  setTeks(pangkalan.keterangan, TEKS.petakBusKet);
  pangkalan.tombol.hidden = true;
  elemen.append(pangkalan.elemen);

  elemen.append(el('div', 'judul-bagian', TEKS.grupModern));
  const modern = TEKNOLOGI_IDS.map((id: TeknologiId) => {
    const r = baris3(IKON_MODERN, NAMA_TEKNOLOGI[id], 'modern');
    r.tombolKecil.textContent = TEKS.pasang;
    r.tombol.addEventListener('click', () => kirim({ jenis: 'beliTeknologi', teknologi: id }));
    elemen.append(r.elemen);
    return { id, ...r };
  });
  const catatan = el('div', 'harga-catatan');
  elemen.append(catatan);
  return {
    elemen,
    perbarui(m) {
      const bg = m.bangun;
      for (const a of area) {
        const x = bg.area.find((y) => y.id === a.id)!;
        setTeks(a.nilai, arus(x.kapasitas));
        a.e.classList.toggle('lambat', x.bottleneck);
      }
      const dilayani = bg.area.every((x) => !x.bottleneck);
      setTeks(ringkas, dilayani ? TEKS.kapasitasPasar : `${TEKS.kapasitasRingkas(arus(bg.arusPuncak), arus(bg.permintaanPuncak))}`);
      for (const b of baris) b.perbarui(m);
      const kapPangkalan = bg.area.find((x) => x.id === 'pangkalan')!.kapasitas;
      setHidden(pangkalan.level, true);
      setTeks(pangkalan.keterangan, `${TEKS.petakBus(bg.petakBus, arus(kapPangkalan))} · ${TEKS.petakBusKet}`);
      for (const b of modern) {
        const t = bg.teknologi.find((x) => x.id === b.id)!;
        b.elemen.style.setProperty('--warna', keHexCss(WARNA_TAHAP[t.tahap]));
        setTeks(
          b.keterangan,
          t.syaratKurang
            ? TEKS.butuh(NAMA_TEKNOLOGI[t.syaratKurang])
            : `${TEKS.kapasitasPersen(persen(t.multKapasitas - 1), NAMA_TAHAP[t.tahap])} · ${TEKS.perawatanPerHari(formatUang(t.perawatan))}`,
        );
        setHidden(b.level, !t.dimiliki);
        setTeks(b.level, '✓');
        setHidden(b.tombol, t.dimiliki);
        setTeks(b.tombolBesar, formatUang(t.biaya));
        setDisabled(b.tombol, !t.bisa);
        b.elemen.classList.toggle('belum', !t.dimiliki);
        b.elemen.classList.toggle('terkunci', t.syaratKurang !== null);
      }
      setTeks(catatan, `${TEKS.perawatanTotal(formatUang(bg.perawatanHarian))}. ${TEKS.bangunanCatatan(persen(EKONOMI.tycoon.bongkar))}`);
    },
  };
}

// ---------------------------------------------------------------------------
// Petugas

export function buatTabPetugas(kirim: Kirim): IsiTab {
  const elemen = el('div', 'isi-tab daftar-item');
  const ringkasan = el('div', 'jurusan-ringkasan');
  elemen.append(ringkasan);
  const baris = PETUGAS_IDS.map((id: PetugasId) => {
    const manajer = id === 'manajerOperasional' || id === 'manajerKemitraan';
    const r = baris3(manajer ? IKON_MANAJER : IKON_PETUGAS, NAMA_PETUGAS[id].nama, 'petugas');
    r.elemen.dataset['petugas'] = id;
    if (manajer) r.elemen.classList.add('manajer');
    setTeks(r.keterangan, NAMA_PETUGAS[id].deskripsi);
    const gaji = el('div', 'item-keterangan petugas-gaji');
    r.keterangan.after(gaji);
    const p = pengatur(
      TEKS.berhentikan(NAMA_PETUGAS[id].nama),
      TEKS.rekrut(NAMA_PETUGAS[id].nama),
      () => kirim({ jenis: 'berhentikan', petugas: id }),
      () => kirim({ jenis: 'rekrut', petugas: id }),
    );
    r.tombol.replaceWith(p.elemen);
    elemen.append(r.elemen);
    return { id, ...r, gaji, p };
  });
  elemen.append(el('div', 'harga-catatan', TEKS.petugasCatatan));
  return {
    elemen,
    perbarui(m) {
      const t = m.petugas;
      setTeks(ringkasan, TEKS.petugasRingkas(t.jumlah, formatUang(t.gajiHarian)));
      for (const b of baris) {
        const x = t.daftar.find((y) => y.id === b.id)!;
        setTeks(b.level, `${x.jumlah}/${x.maks}`);
        const perlu = x.perlu !== null && x.perlu > 0 && x.jumlah < Math.min(x.perlu, x.maks) ? ` · ${TEKS.petugasPerlu(Math.min(x.perlu, x.maks))}` : '';
        setTeks(b.gaji, `${TEKS.petugasGaji(formatUang(x.gaji))}${perlu}`);
        b.gaji.classList.toggle('kurang', perlu !== '');
        setTeks(b.p.nilai, String(x.jumlah));
        setDisabled(b.p.turun, !x.bisaBerhentikan);
        setDisabled(b.p.naik, !x.bisaRekrut);
        b.elemen.classList.toggle('belum', x.jumlah === 0);
        b.elemen.classList.toggle('terkunci', x.maks === 0);
      }
    },
  };
}

// ---------------------------------------------------------------------------
// Mitra PO

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

/** Baris kartu PO: judul + keterangan di kiri; tombolnya ditambahkan pemanggil di kanan. */
function barisPo(): { readonly elemen: HTMLElement; readonly judul: HTMLElement; readonly ket: HTMLElement } {
  const elemen = el('div', 'po-baris');
  const info = el('div', 'item-info');
  const judul = el('div', 'po-judul');
  const ket = el('div', 'po-ket');
  info.append(judul, ket);
  elemen.append(info);
  return { elemen, judul, ket };
}

interface KartuPo {
  readonly elemen: HTMLElement;
  perbarui(p: ModelPoTerdaftar, mi: ModelMitra): void;
}

/** Satu jurusan PO: nama, harga tiket Ekonomi (ditetapkan PO) atau syarat bukanya. */
function buatBarisJurusan(): { readonly elemen: HTMLElement; perbarui(j: ModelPoTerdaftar['jurusan'][number]): void } {
  const elemen = el('div', 'po-jurusan');
  const info = el('div', 'item-info');
  const nama = el('span', 'item-nama');
  const ket = el('div', 'item-keterangan');
  info.append(nama, ket);
  const harga = el('span', 'harga-nilai');
  elemen.append(info, harga);
  return {
    elemen,
    perbarui(j) {
      elemen.dataset['jurusan'] = String(j.jurusan);
      elemen.classList.toggle('antarpulau', j.feri !== null);
      setTeks(nama, j.nama);
      const status = j.aktif ? '' : j.kurangKelas !== null ? TEKS.poSyaratTerminal(namaKelas(j.kurangKelas)) : TEKS.poJurusanLevel(j.levelBuka);
      const teks = [j.feri ? TEKS.lewatFeri(j.feri) : '', status].filter(Boolean).join(' · ');
      setTeks(ket, teks);
      setHidden(ket, teks === '');
      setTeks(harga, formatUang(j.harga));
      setHidden(harga, !j.aktif);
      elemen.classList.toggle('terkunci', !j.aktif);
    },
  };
}

/** Kartu mitra PO terdaftar: level & XP, jendela loket, kepuasan mitra, kelas bus, harga tiap jurusan, kontrak. */
function buatKartuPo(id: PoId, kirim: Kirim): KartuPo {
  const elemen = el('article', 'kartu-po');
  elemen.dataset['po'] = id;
  const kepala = el('div', 'po-kepala');
  const ikon = el('div', 'item-ikon');
  ikon.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true">${ikonLivery(LIVERY_PO[id])}</svg>`;
  const info = el('div', 'item-info');
  const atas = el('div', 'item-atas');
  const level = el('span', 'item-level');
  atas.append(el('span', 'item-nama', NAMA_PO[id].nama), level);
  const ket = el('div', 'item-keterangan');
  info.append(atas, ket);
  kepala.append(ikon, info);
  // XP menuju level berikutnya (satuan bus).
  const xp = el('div', 'po-xp');
  const bar = el('div', 'bar');
  const barIsi = el('div', 'bar-isi');
  bar.append(barIsi);
  const xpAngka = el('span', 'po-angka');
  xp.append(bar, xpAngka);
  // Jendela loket: dari jendela kosong (gratis) atau dibangun.
  const jendela = barisPo();
  const tombolJendela = tombolBeli();
  tombolJendela.kecil.textContent = TEKS.tambahJendela;
  let kosong = false;
  tombolJendela.tombol.addEventListener('click', () => kirim(kosong ? { jenis: 'isiJendelaKosong', po: id } : { jenis: 'bangun', bangunan: 'jendela', po: id }));
  jendela.elemen.append(tombolJendela.tombol);
  const mitra = el('div', 'po-teks po-mitra');
  const kelas = el('div', 'po-teks');
  const daftarJurusan = el('div', 'po-harga');
  const barisJurusan: ReturnType<typeof buatBarisJurusan>[] = [];
  const kontrak = barisPo();
  const tombolPerpanjang = tombolBeli();
  tombolPerpanjang.kecil.textContent = TEKS.perpanjang;
  tombolPerpanjang.besar.textContent = TEKS.gratis;
  tombolPerpanjang.tombol.addEventListener('click', () => kirim({ jenis: 'perpanjangPo', po: id }));
  // Putus kontrak lewat dua ketukan: ketukan pertama menampilkan akibatnya.
  const putus = tombolYakin('tombol tombol-putus', TEKS.putusYakin, () => kirim({ jenis: 'putusPo', po: id }));
  putus.aturTeks(TEKS.putus);
  kontrak.elemen.append(tombolPerpanjang.tombol, putus.tombol);
  elemen.append(kepala, xp, jendela.elemen, mitra, kelas, el('div', 'po-subjudul', TEKS.poHargaJudul), daftarJurusan, kontrak.elemen);
  return {
    elemen,
    perbarui(p, mi) {
      setTeks(level, TEKS.level(p.level));
      setTeks(ket, `${TEKS.poTingkatAsal(NAMA_TINGKAT_PO[p.tingkat], NAMA_PO[id].asal)} · ${TEKS.poReputasi(Math.round(p.reputasi))}`);
      setStyle(barIsi, 'width', `${(p.rasioXp * 100).toFixed(1)}%`);
      setTeks(xpAngka, TEKS.poXp(formatAngka(Math.floor(Math.max(0, p.xpDalamLevel))), formatAngka(Math.ceil(p.xpLevel)), p.level + 1));
      setTeks(jendela.judul, TEKS.poJendela(p.loket));
      setTeks(jendela.ket, `${TEKS.poJendelaKet(arus(p.kapasitasLoket), arus(p.permintaanPuncak))} · ${TEKS.poBagian(persen(p.bagian), arus(p.arus))}`);
      kosong = p.bisaIsiKosong;
      setHidden(tombolJendela.tombol, !kosong && p.biayaJendela === null);
      setTeks(tombolJendela.besar, kosong ? TEKS.gratis : formatUang(p.biayaJendela ?? 0));
      setDisabled(tombolJendela.tombol, !kosong && !p.bisaTambahJendela);
      setTeks(mitra, TEKS.poKepuasanMitra(persen(p.kepuasanMitra)));
      mitra.classList.toggle('kurang', p.kepuasanMitra < mi.minimalMitra);
      const b = p.kelasBerikut;
      const berikut = !b
        ? ''
        : p.level < b.level
          ? ` · ${TEKS.poKelasBerikut(NAMA_KELAS_BUS[b.kelas].nama, b.level)}`
          : b.kurangKelas !== null
            ? ` · ${TEKS.poKelasButuhTerminal(NAMA_KELAS_BUS[b.kelas].nama, namaKelas(b.kurangKelas))}`
            : '';
      setTeks(kelas, `${TEKS.poKelas(p.kelas.map((k) => NAMA_KELAS_BUS[k].nama).join(', '))}${berikut}`);
      p.jurusan.forEach((j, i) => {
        let r = barisJurusan[i];
        if (!r) {
          r = buatBarisJurusan();
          barisJurusan[i] = r;
          daftarJurusan.append(r.elemen);
        }
        r.perbarui(j);
      });
      setTeks(kontrak.judul, TEKS.poKontrak(formatAngka(Math.max(0, p.kontrakHari), { desimalKecil: 1 })));
      kontrak.elemen.classList.toggle('hampir', p.kontrakHari <= 1);
      const ketKontrak = putus.menunggu()
        ? TEKS.putusCatatan(mi.kontrak.penaltiPutus, mi.kontrak.jedaHari)
        : p.kurangPerpanjang === 'mitra'
          ? TEKS.poMenolakMitra(persen(mi.minimalMitra))
          : p.kurangPerpanjang === 'kepuasan' && p.kepuasanMin !== null
            ? TEKS.poMenolak(persen(p.kepuasanMin))
            : p.kurangPerpanjang === 'penuh'
              ? TEKS.poKontrakPenuh(mi.kontrak.hariMaks)
              : '';
      setTeks(kontrak.ket, ketKontrak);
      setHidden(kontrak.ket, ketKontrak === '');
      setHidden(tombolPerpanjang.tombol, p.kurangPerpanjang === 'penuh');
      setDisabled(tombolPerpanjang.tombol, p.kurangPerpanjang !== null);
      setHidden(putus.tombol, !p.bisaPutus);
    },
  };
}

/** Status PO yang belum terdaftar: syarat yang kurang, atau catatan riwayat. */
function statusTersedia(p: ModelPoTersedia): string {
  const k = p.kurang;
  if (!k) return p.levelRiwayat !== null ? TEKS.poRiwayat(p.levelRiwayat) : '';
  switch (k.jenis) {
    case 'slot':
      return TEKS.poSlotPenuh;
    case 'jendela':
      return TEKS.poJendelaPenuh;
    case 'mitra':
      return TEKS.poMenolakBergabung(persen(k.perkiraan));
    case 'jeda':
      return TEKS.poJeda(formatAngka(Math.max(0.1, p.jedaHari ?? 0), { desimalKecil: 1 }));
    case 'kepuasan':
      return TEKS.poSyaratKepuasan(persen(k.min));
    case 'kelas':
      return p.hadiah ? TEKS.poHadiahKelas(namaKelas(k.kelas)) : TEKS.poSyaratTerminal(namaKelas(k.kelas));
    case 'event':
      return p.event ? TEKS.poSyaratEvent(NAMA_EVENT[p.event].nama) : '';
    case 'terdaftar':
      return '';
  }
}

interface BarisTersedia {
  readonly elemen: HTMLElement;
  perbarui(p: ModelPoTersedia): void;
}

function buatBarisTersedia(id: PoId, kirim: Kirim): BarisTersedia {
  const r = baris3(ikonLivery(LIVERY_PO[id]), NAMA_PO[id].nama, 'po');
  r.elemen.dataset['po'] = id;
  const status = el('div', 'item-keterangan po-status');
  r.keterangan.after(status);
  r.tombolKecil.textContent = TEKS.daftar;
  r.tombol.addEventListener('click', () => kirim({ jenis: 'daftarPo', po: id }));
  return {
    elemen: r.elemen,
    perbarui(p) {
      setTeks(r.level, NAMA_TINGKAT_PO[p.tingkat]);
      setTeks(r.keterangan, `${NAMA_PO[id].asal} · ${TEKS.poJurusanDaftar(p.jurusan.join(', '))}`);
      const teks = statusTersedia(p);
      setTeks(status, teks);
      setHidden(status, teks === '');
      // Kelas terminal & event: masih jauh, jadi tanpa tombol.
      const terkunci = p.kurang?.jenis === 'kelas' || p.kurang?.jenis === 'event';
      setHidden(r.tombol, terkunci);
      setTeks(r.tombolBesar, p.biaya <= 0 ? TEKS.gratis : formatUang(p.biaya));
      setDisabled(r.tombol, !p.bisa);
      r.elemen.classList.toggle('belum', !p.bisa);
      r.elemen.classList.toggle('terkunci', terkunci);
    },
  };
}

/** Susun ulang anak `wadah` hanya bila urutannya berubah (menghindari reflow tiap pembaruan). */
function susunUrut(wadah: HTMLElement, elemen: readonly HTMLElement[]): void {
  const sama = elemen.length === wadah.children.length && elemen.every((e, i) => wadah.children[i] === e);
  if (!sama) wadah.replaceChildren(...elemen);
}

export function buatTabPo(kirim: Kirim): IsiTab {
  const elemen = el('div', 'isi-tab daftar-item');
  const ringkasan = el('div', 'jurusan-ringkasan');
  // Jendela kosong (milik terminal, tidak disewa PO): disewakan gratis ke PO yang antreannya paling panjang.
  const kosong = baris3(IKON_LOKET, '', 'loket-kosong');
  kosong.tombolKecil.textContent = TEKS.sewakan;
  kosong.tombolBesar.textContent = TEKS.gratis;
  setTeks(kosong.keterangan, TEKS.jendelaKosongKet);
  kosong.tombol.addEventListener('click', () => kirim({ jenis: 'isiJendelaKosong' }));
  const daftarTerdaftar = el('div', 'po-daftar');
  const daftarTersedia = el('div', 'po-daftar');
  elemen.append(ringkasan, kosong.elemen, daftarTerdaftar, el('div', 'judul-bagian', TEKS.judulPoTersedia), daftarTersedia, el('div', 'harga-catatan', TEKS.poCatatan));
  const kartu = new Map<PoId, KartuPo>();
  const tersedia = new Map<PoId, BarisTersedia>();
  return {
    elemen,
    perbarui(m) {
      const mi = m.mitra;
      const slot = mi.slotBerikut ? ` · ${TEKS.poSlotBerikut(mi.slotBerikut.slot, mi.slotBerikut.level)}` : '';
      setTeks(ringkasan, `${TEKS.poRingkas(mi.terdaftar.length, mi.slot)}${slot}`);
      setHidden(kosong.elemen, mi.jendelaKosong === 0);
      setTeks(kosong.nama, TEKS.jendelaKosongJudul(mi.jendelaKosong));
      // Kartu dibuat saat PO bergabung dan dibuang saat PO keluar.
      for (const p of mi.terdaftar) {
        let k = kartu.get(p.id);
        if (!k) {
          k = buatKartuPo(p.id, kirim);
          kartu.set(p.id, k);
        }
        k.perbarui(p, mi);
      }
      for (const id of [...kartu.keys()]) if (!mi.terdaftar.some((p) => p.id === id)) kartu.delete(id);
      susunUrut(daftarTerdaftar, mi.terdaftar.map((p) => kartu.get(p.id)!.elemen));
      for (const p of mi.tersedia) {
        let b = tersedia.get(p.id);
        if (!b) {
          b = buatBarisTersedia(p.id, kirim);
          tersedia.set(p.id, b);
        }
        b.perbarui(p);
      }
      susunUrut(daftarTersedia, mi.tersedia.map((p) => tersedia.get(p.id)!.elemen));
    },
  };
}

// ---------------------------------------------------------------------------
// Terminal: level & kelas, perluasan, tarif, laporan keuangan, kelas bus

export interface OpsiTabTerminal {
  /** Membuka popup nama terminal (lihat popup-nama.ts). */
  readonly ubahNama?: () => void;
}

/** Kartu ber-bilah: judul, baris utama, keterangan, bilah & angka di kiri, tombol di kanan. */
function kartuBilah(kelas: string): {
  readonly elemen: HTMLElement;
  readonly kiri: HTMLElement;
  readonly judul: HTMLElement;
  readonly tugas: HTMLElement;
  readonly ket: HTMLElement;
  readonly bar: HTMLElement;
  readonly isi: HTMLElement;
  readonly angka: HTMLElement;
} {
  const elemen = el('div', `target-kartu ${kelas}`);
  const kiri = el('div', 'target-kiri');
  const judul = el('div', 'target-judul kelas-judul');
  const tugas = el('div', 'target-tugas');
  const ket = el('div', 'kelas-berikut');
  const bar = el('div', 'bar');
  const isi = el('div', 'bar-isi');
  bar.append(isi);
  const angka = el('div', 'target-angka');
  kiri.append(judul, tugas, ket, bar, angka);
  elemen.append(kiri);
  return { elemen, kiri, judul, tugas, ket, bar, isi, angka };
}

/** Nilai tarif untuk dibaca: persen atau Rupiah. */
function teksTarif(id: TarifId, nilai: number): string {
  return NAMA_TARIF[id].satuan === 'persen' ? `${formatAngka(nilai, { desimalKecil: 0 })}%` : formatUang(nilai);
}

function buatBarisTarif(id: TarifId, kirim: Kirim): { readonly elemen: HTMLElement; perbarui(t: ModelTarif): void } {
  const elemen = el('div', 'item item-tarif');
  elemen.dataset['tarif'] = id;
  const ikon = el('div', 'item-ikon');
  ikon.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true">${IKON_TARIF}</svg>`;
  const info = el('div', 'item-info');
  const atas = el('div', 'item-atas');
  const per = el('span', 'tarif-per', TEKS.tarifPer(NAMA_TARIF[id].per));
  atas.append(el('span', 'item-nama', NAMA_TARIF[id].nama), per);
  const ket = el('div', 'item-keterangan', NAMA_TARIF[id].deskripsi);
  const saran = el('button', 'harga-saran', TEKS.tarifSaran);
  saran.type = 'button';
  saran.addEventListener('click', () => kirim({ jenis: 'saranTarif', tarif: id }));
  const bawah = el('div', 'tarif-bawah');
  const bawaan = el('span', 'tarif-bawaan');
  bawah.append(saran, bawaan);
  info.append(atas, ket, bawah);
  let sekarang: ModelTarif | null = null;
  const p = pengatur(
    TEKS.tarifTurun(NAMA_TARIF[id].nama),
    TEKS.tarifNaik(NAMA_TARIF[id].nama),
    () => sekarang && kirim({ jenis: 'aturTarif', tarif: id, nilai: sekarang.nilai - sekarang.langkah }),
    () => sekarang && kirim({ jenis: 'aturTarif', tarif: id, nilai: sekarang.nilai + sekarang.langkah }),
  );
  elemen.append(ikon, info, p.elemen);
  return {
    elemen,
    perbarui(t) {
      sekarang = t;
      setTeks(p.nilai, teksTarif(id, t.nilai));
      p.nilai.classList.toggle('murah', t.nilai < t.bawaan);
      p.nilai.classList.toggle('mahal', t.nilai > t.bawaan);
      setDisabled(p.turun, !t.bisaTurun);
      setDisabled(p.naik, !t.bisaNaik);
      setTeks(bawaan, TEKS.tarifBawaan(teksTarif(id, t.bawaan)));
    },
  };
}

const KUNCI_PENDAPATAN = Object.keys(NAMA_PENDAPATAN) as (keyof RincianPendapatan)[];
const KUNCI_BIAYA = Object.keys(NAMA_BIAYA) as (keyof RincianBiaya)[];

/** Laporan keuangan: pendapatan per sumber & biaya per pos, hari ini & kemarin. */
function buatKartuKeuangan(): { readonly elemen: HTMLElement; perbarui(m: ModelTampilan): void } {
  const elemen = el('div', 'target-kartu kartu-kolom keuangan-kartu');
  const judul = el('div', 'target-judul', TEKS.keuanganJudul);
  const tabel = el('div', 'keuangan-tabel');
  const sel = (kelas: string, teks = ''): HTMLElement => {
    const e = el('span', kelas, teks);
    tabel.append(e);
    return e;
  };
  sel('keu-label');
  const kepalaHariIni = sel('keu-kepala');
  const kepalaKemarin = sel('keu-kepala');
  const baris = (label: string, kelas = ''): { readonly a: HTMLElement; readonly b: HTMLElement } => {
    sel(`keu-label ${kelas}`, label);
    return { a: sel(`keu-nilai ${kelas}`), b: sel(`keu-nilai ${kelas}`) };
  };
  const pendapatan = KUNCI_PENDAPATAN.map((k) => ({ k, ...baris(NAMA_PENDAPATAN[k]) }));
  const totalPendapatan = baris(TEKS.keuanganPendapatan, 'keu-total');
  const biaya = KUNCI_BIAYA.map((k) => ({ k, ...baris(NAMA_BIAYA[k]) }));
  const totalBiaya = baris(TEKS.keuanganBiaya, 'keu-total');
  const laba = baris(TEKS.keuanganLaba, 'keu-laba');
  const penumpang = baris('', 'keu-kecil');
  const rata = el('div', 'kelas-berikut');
  elemen.append(judul, tabel, rata);
  const isi = (e: HTMLElement, v: number | null, bertanda = false): void => setTeks(e, v === null ? TEKS.rekorBelum : bertanda ? formatUangBertanda(v) : formatUang(Math.floor(v)));
  return {
    elemen,
    perbarui(m) {
      const k = m.terminal.keuangan;
      setTeks(judul, `${TEKS.keuanganJudul} · ${TEKS.keuanganKas(formatUang(Math.floor(k.kas)))}`);
      const h: ModelBuku = k.hariIni;
      const y: ModelBuku | null = k.kemarin;
      setTeks(kepalaHariIni, TEKS.keuanganHariIni(h.hari));
      setTeks(kepalaKemarin, y ? TEKS.keuanganKemarin(y.hari) : TEKS.rekorBelum);
      for (const r of pendapatan) {
        isi(r.a, h.pendapatan[r.k]);
        isi(r.b, y ? y.pendapatan[r.k] : null);
      }
      isi(totalPendapatan.a, h.totalPendapatan);
      isi(totalPendapatan.b, y?.totalPendapatan ?? null);
      for (const r of biaya) {
        isi(r.a, h.biaya[r.k]);
        isi(r.b, y ? y.biaya[r.k] : null);
      }
      isi(totalBiaya.a, h.totalBiaya);
      isi(totalBiaya.b, y?.totalBiaya ?? null);
      isi(laba.a, h.laba, true);
      isi(laba.b, y?.laba ?? null, true);
      laba.a.classList.toggle('rugi', h.laba < 0);
      laba.b.classList.toggle('rugi', (y?.laba ?? 0) < 0);
      setTeks(penumpang.a, TEKS.keuanganPenumpang(formatAngka(Math.floor(h.penumpang))));
      setTeks(penumpang.b, y ? TEKS.keuanganPenumpang(formatAngka(Math.floor(y.penumpang))) : '');
      setTeks(rata, TEKS.keuanganRata(formatUangBertanda(k.rataRata.laba)));
    },
  };
}

export function buatTabTerminal(kirim: Kirim, o: OpsiTabTerminal = {}): IsiTab {
  const elemen = el('div', 'isi-tab daftar-item');
  // Level & kelas terminal; nama terminal diubah lewat tombol ✎ di samping judul.
  const level = kartuBilah('kelas-kartu terminal-kartu');
  const tombolNama = el('button', 'tombol-nama');
  tombolNama.type = 'button';
  tombolNama.title = TEKS.namaTombol;
  tombolNama.setAttribute('aria-label', TEKS.namaTombol);
  tombolNama.innerHTML = IKON_PENSIL;
  tombolNama.addEventListener('click', () => o.ubahNama?.());
  setHidden(tombolNama, !o.ubahNama);
  const barisJudul = el('div', 'kelas-judul-baris');
  level.judul.replaceWith(barisJudul);
  barisJudul.append(level.judul, tombolNama);
  // Perluasan: tahap berikutnya & tombol bangun, atau proyek yang sedang berjalan.
  const perluasan = kartuBilah('perluasan-kartu');
  perluasan.judul.textContent = TEKS.perluasanJudul;
  const catatanPerluasan = el('div', 'kelas-berikut', TEKS.perluasanCatatan);
  perluasan.kiri.append(catatanPerluasan);
  const tombolPerluasan = tombolBeli();
  tombolPerluasan.kecil.textContent = TEKS.bangun;
  tombolPerluasan.tombol.addEventListener('click', () => kirim({ jenis: 'mulaiPerluasan' }));
  const kananPerluasan = el('div', 'target-tombol');
  kananPerluasan.append(tombolPerluasan.tombol);
  perluasan.elemen.append(kananPerluasan);
  const keuangan = buatKartuKeuangan();
  const tarif = TARIF_IDS.map((id) => ({ id, ...buatBarisTarif(id, kirim) }));
  // Kelas bus yang dioperasikan PO terdaftar.
  const barisKelas = KELAS_BUS_IDS.map((id) => {
    const r = baris3(IKON_KELAS_BUS[id], NAMA_KELAS_BUS[id].nama, 'kelas-bus');
    r.elemen.dataset['kelasBus'] = id;
    r.tombol.hidden = true;
    return { id, ...r };
  });
  elemen.append(
    level.elemen,
    keuangan.elemen,
    el('div', 'judul-bagian', TEKS.tarifJudul),
    ...tarif.map((t) => t.elemen),
    el('div', 'harga-catatan', TEKS.tarifCatatan),
    perluasan.elemen,
    el('div', 'judul-bagian', TEKS.judulKelasBus),
    ...barisKelas.map((b) => b.elemen),
    el('div', 'harga-catatan', `${TEKS.terminalCatatan} ${TEKS.kelasBusCatatan}`),
  );
  return {
    elemen,
    perbarui(m) {
      const t = m.terminal;
      setTeks(level.judul, TEKS.kelasJudul(namaKelas(t.kelas), t.nama));
      setTeks(level.tugas, TEKS.level(t.level));
      setTeks(level.ket, `${TEKS.terminalKelasBerikut(namaKelas(t.kelas + 1), t.levelKelasBerikut)} · ${TEKS.terminalSlot(t.slot)}`);
      setStyle(level.isi, 'width', `${(t.rasio * 100).toFixed(1)}%`);
      setTeks(level.angka, TEKS.terminalXp(formatAngka(Math.floor(t.xp)), formatAngka(Math.ceil(t.xpBerikut))));
      keuangan.perbarui(m);
      for (const r of tarif) r.perbarui(t.tarif.find((x) => x.id === r.id)!);

      const p = t.perluasan;
      const tahap = p.proyek?.tahap ?? p.berikut?.tahap ?? null;
      const nama = tahap !== null ? NAMA_PERLUASAN[tahap - 1] : undefined;
      setTeks(perluasan.tugas, tahap !== null && nama ? TEKS.perluasanTahap(tahap, p.jumlah, nama.nama) : TEKS.perluasanSelesai);
      const efek = p.proyek
        ? TEKS.perluasanProyek(formatDurasi(p.proyek.sisaDetik))
        : p.berikut
          ? [nama?.deskripsi ?? '', TEKS.perluasanOperasional(formatUang(p.berikut.operasional)), p.berikut.levelKurang ? TEKS.perluasanSyarat(p.berikut.level) : ''].filter(Boolean).join(' · ')
          : '';
      setTeks(perluasan.ket, efek);
      setHidden(perluasan.ket, efek === '');
      setHidden(perluasan.bar, p.proyek === null);
      setStyle(perluasan.isi, 'width', `${((p.proyek?.rasio ?? 0) * 100).toFixed(1)}%`);
      setHidden(perluasan.angka, true);
      setHidden(kananPerluasan, p.berikut === null);
      if (p.berikut) {
        setTeks(tombolPerluasan.besar, formatUang(p.berikut.biaya));
        setDisabled(tombolPerluasan.tombol, !p.berikut.bisa);
      }
      perluasan.elemen.classList.toggle('siap', p.berikut?.bisa === true);

      for (const b of barisKelas) {
        const k = t.kelasBus.find((x) => x.id === b.id)!;
        const syarat = k.beroperasi
          ? TEKS.kelasBusBeroperasi
          : `${TEKS.kelasBusSyarat(k.tingkatMin === 'lokal' ? null : NAMA_TINGKAT_PO[k.tingkatMin], k.levelPo)}${k.kelasTerminal > t.kelas ? ` · ${TEKS.poSyaratTerminal(namaKelas(k.kelasTerminal))}` : ''}`;
        setTeks(b.keterangan, `${NAMA_KELAS_BUS[b.id].deskripsi} · ${syarat}`);
        setTeks(b.level, '✓');
        setHidden(b.level, !k.beroperasi);
        b.elemen.classList.toggle('belum', !k.beroperasi);
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
    case 'laba':
      return TEKS.tantanganLaba(formatUang(t.target));
    case 'bangun':
      return TEKS.tantanganBangun(t.target);
    case 'kepuasan':
      return TEKS.tantanganKepuasan(persen(m.kepuasanMin), Math.round(t.target / 60));
  }
}

/** Kemajuan "x / target" dalam satuan tantangannya. */
function angkaTantangan(t: ModelTantangan): string {
  const ada = Math.min(t.progres, t.target);
  switch (t.jenis) {
    case 'laba':
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
  const nilai = [TEKS.rekorPenumpang, TEKS.rekorLaba, TEKS.rekorArus].map((label) => {
    const v = el('span', 'rekor-nilai');
    daftar.append(el('span', 'rekor-label', label), v);
    return v;
  });
  elemen.append(judul, hariIni, daftar);
  return {
    elemen,
    perbarui(m) {
      const r = m.rekor;
      setTeks(hariIni, TEKS.rekorHariIni(formatAngka(Math.floor(r.penumpangHariIni)), formatUangBertanda(r.labaHariIni)));
      const [p, rp, a] = nilai as [HTMLElement, HTMLElement, HTMLElement];
      setTeks(p, r.penumpangHarian > 0 ? formatAngka(Math.floor(r.penumpangHarian)) : TEKS.rekorBelum);
      setTeks(rp, r.labaHarian > 0 ? formatUang(Math.floor(r.labaHarian)) : TEKS.rekorBelum);
      setTeks(a, `${arus(r.arusTertinggi)} ${TEKS.satuanArus}`);
    },
  };
}

// ---------------------------------------------------------------------------
// Target harian & penghargaan

export interface OpsiTabTarget {
  /** Iklan berhadiah untuk klaim 2× (tanpa ini tombolnya tidak ada). */
  readonly iklan?: IklanMenu;
  /** Kartu papan peringkat (ui/peringkat.ts), di bawah tantangan mingguan. */
  readonly kartuPeringkat?: { readonly elemen: HTMLElement; perbarui(m: ModelTampilan): void };
}

export function buatTabTarget(kirim: Kirim, o: OpsiTabTarget = {}): IsiTab {
  const { iklan, kartuPeringkat } = o;
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
  // Event musiman: sisa waktu, pengali pasar, tahap target & klaim hadiahnya.
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
  elemen.append(kartuEvent, kartu, kartuTantangan.elemen, ...(kartuPeringkat ? [kartuPeringkat.elemen] : []), kartuRekor.elemen, judulPenghargaan);
  const baris = PENCAPAIAN_IDS.map((id: PencapaianId) => {
    const r = baris3(IKON_PIALA, NAMA_PENCAPAIAN[id].nama, 'penghargaan');
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
      const t = m.target;
      setTeks(judul, TEKS.targetHari(t.hari));
      setTeks(tugas, t.jenis === 'laba' ? TEKS.targetLaba(formatUang(t.target)) : TEKS.targetPenumpang(formatAngka(t.target)));
      setStyle(barIsi, 'width', `${(t.rasio * 100).toFixed(1)}%`);
      setTeks(angka, t.jenis === 'laba' ? `${formatUang(Math.floor(t.progres))} / ${formatUang(t.target)}` : `${formatAngka(Math.floor(t.progres))} / ${formatAngka(t.target)}`);
      setTeks(targetKecil, t.diklaim ? '' : TEKS.klaim);
      setTeks(targetBesar, t.diklaim ? TEKS.diklaim : `+${formatUang(t.hadiah)}`);
      setDisabled(tombolTarget, !t.selesai || t.diklaim);
      const bisaIklan = iklan?.siap() ?? false;
      setHidden(gandaTarget.tombol, !bisaIklan || !t.selesai || t.diklaim);
      setTeks(gandaTarget.besar, `+${formatUang(t.hadiah * 2)}`);
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
        setTeks(b.ganda.besar, `+${formatUang(m.hadiahPencapaian * 2)}`);
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
