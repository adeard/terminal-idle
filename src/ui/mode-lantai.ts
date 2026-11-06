/**
 * Mode lihat per lantai (documents/18, rancangan 6.4): chip di atas adegan "‹ Lantai 2 · Ruang tunggu › ✕".
 * Hanya state UI, tidak disimpan; simulasi tetap berjalan. Masuk lewat "👁 Lihat" (kartu lantai, toast
 * pembelian) di lantai tertinggi yang sudah dibangun. Keluar lewat ✕, tab mana pun, popup apa pun (overlay.ts),
 * atau kamera digeser jauh dari gedung (adegan memanggil `keluar`, lihat main.ts). Aturan murninya di sim/lantai.ts.
 */
import type { PembacaState } from '../app/pengendali';
import type { GedungLantaiId, LantaiDilihat } from '../sim/fitur';
import { geserLantaiDilihat, lantaiDilihatAwal, lantaiTertinggi } from '../sim/lantai';
import { NAMA_GEDUNG_LANTAI, TEKS } from './teks';

export interface ModeLantai {
  /** Lantai yang sedang dilihat (null = tampilan biasa). */
  readonly dilihat: LantaiDilihat | null;
  /** Masuk mode lantai gedung ini di lantai tertingginya (tidak berbuat apa-apa bila belum ada lantai tambahan). */
  lihat(gedung: GedungLantaiId): void;
  keluar(): void;
  /** Dipanggil tiap pembaruan state: lantai yang dilihat tidak ada lagi (save diganti) → keluar. */
  periksa(): void;
}

export interface OpsiModeLantai {
  /** Lantai yang dilihat berubah (masuk, ‹ ›, keluar): diteruskan ke adegan. */
  readonly saatUbah: (v: LantaiDilihat | null) => void;
  /** Masuk lewat "👁 Lihat" (analitik `lantai_lihat`). */
  readonly saatMasuk?: (v: LantaiDilihat) => void;
}

/** Pasang chip mode lantai di area adegan (`akar` mendapat kelas `mode-lantai` selama aktif). */
export function pasangModeLantai(akar: HTMLElement, area: HTMLElement, pembaca: PembacaState, opsi: OpsiModeLantai): ModeLantai {
  const chip = document.createElement('div');
  chip.className = 'chip-lantai';
  chip.setAttribute('role', 'group');
  chip.hidden = true;
  const tombol = (kelas: string, teks: string, label: string): HTMLButtonElement => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = `chip-lantai-tombol ${kelas}`;
    b.textContent = teks;
    b.setAttribute('aria-label', label);
    b.title = label;
    return b;
  };
  const turun = tombol('chip-turun', '‹', TEKS.chipLantaiTurun);
  const naik = tombol('chip-naik', '›', TEKS.chipLantaiNaik);
  const tutup = tombol('chip-tutup', '✕', TEKS.chipLantaiKeluar);
  const label = document.createElement('span');
  label.className = 'chip-lantai-label';
  label.setAttribute('aria-live', 'polite');
  chip.append(turun, label, naik, tutup);
  area.append(chip);

  let dilihat: LantaiDilihat | null = null;
  const atur = (v: LantaiDilihat | null): void => {
    if (v === dilihat || (v && dilihat && v.gedung === dilihat.gedung && v.lantai === dilihat.lantai)) return;
    dilihat = v;
    chip.hidden = v === null;
    akar.classList.toggle('mode-lantai', v !== null);
    if (v) {
      label.textContent = TEKS.chipLantai(v.lantai, NAMA_GEDUNG_LANTAI[v.gedung].nama);
      turun.disabled = v.lantai <= 1;
      naik.disabled = v.lantai >= lantaiTertinggi(pembaca.state.terminal.lantai, v.gedung);
    }
    opsi.saatUbah(v);
  };
  turun.addEventListener('click', () => dilihat && atur(geserLantaiDilihat(dilihat, -1, pembaca.state.terminal.lantai)));
  naik.addEventListener('click', () => dilihat && atur(geserLantaiDilihat(dilihat, 1, pembaca.state.terminal.lantai)));
  tutup.addEventListener('click', () => atur(null));

  return {
    get dilihat() {
      return dilihat;
    },
    lihat(gedung) {
      const v = lantaiDilihatAwal(pembaca.state.terminal.lantai, gedung);
      if (!v) return;
      atur(v);
      opsi.saatMasuk?.(v);
    },
    keluar: () => atur(null),
    periksa() {
      if (!dilihat) return;
      const tertinggi = lantaiTertinggi(pembaca.state.terminal.lantai, dilihat.gedung);
      if (dilihat.lantai > tertinggi || tertinggi <= 1) atur(null);
      else naik.disabled = dilihat.lantai >= tertinggi;
    },
  };
}
