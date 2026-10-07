/**
 * Aksi pemain sebagai data. UI mengirim aksi, sim yang menerapkannya.
 * Bentuk data ini memudahkan replay/analitik nanti tanpa mengubah UI.
 */
import { EKONOMI, type KonfigEkonomi } from '../config/economy.config';
import type { FasilitasId, PencapaianId, PoId, TeknologiId } from './fitur';
import {
  aktifkanBoost,
  aturHargaPo,
  aturIkutPeringkat,
  aturNamaTerminal,
  bangunFasilitas,
  bangunLoket,
  beliTeknologi,
  beliUpgrade,
  bukaJalur,
  daftarPo,
  isiLoketKosong,
  klaimBonusOffline,
  klaimBusEmas,
  klaimEvent,
  klaimPencapaian,
  klaimTantangan,
  klaimTarget,
  lepasBusEmas,
  mulaiPerluasan,
  perpanjangPo,
  putusPo,
  rekrutKepala,
  renovasi,
  tahanBusEmas,
  type GameState,
} from './state';
import type { TahapId } from './tahap';

export type Aksi =
  /** Upgrade tahap. Loket: bangun satu loket untuk PO yang paling menguntungkan. */
  | { readonly jenis: 'upgrade'; readonly tahap: TahapId }
  /** Rekrut Kepala tahap (Kepala Loket = Kepala Kemitraan). */
  | { readonly jenis: 'rekrutKepala'; readonly tahap: TahapId }
  | { readonly jenis: 'bangunFasilitas'; readonly fasilitas: FasilitasId }
  /** Bangun jalur bus berikutnya (halte kedatangan & jalur keberangkatan). Permanen. */
  | { readonly jenis: 'bukaJalur' }
  | { readonly jenis: 'beliTeknologi'; readonly teknologi: TeknologiId }
  /** Bangun satu loket untuk PO tertentu (tanpa `po`: yang paling menguntungkan). */
  | { readonly jenis: 'bangunLoket'; readonly po?: PoId }
  /** Isi loket kosong (gratis) ke PO tertentu atau ke PO yang paling menguntungkan. */
  | { readonly jenis: 'isiLoketKosong'; readonly po?: PoId }
  /** Daftarkan mitra PO ke slot terminal. */
  | { readonly jenis: 'daftarPo'; readonly po: PoId }
  /** Putus kontrak PO (gratis; masa jeda sebelum bisa didaftarkan lagi). */
  | { readonly jenis: 'putusPo'; readonly po: PoId }
  | { readonly jenis: 'perpanjangPo'; readonly po: PoId }
  /** Atur harga tiket PO untuk salah satu jurusannya (indeks EKONOMI.jurusan), persen harga normal (dirapikan sim). */
  | { readonly jenis: 'aturHargaPo'; readonly po: PoId; readonly jurusan: number; readonly persen: number }
  /** Mulai proyek tahap perluasan terminal berikutnya. */
  | { readonly jenis: 'mulaiPerluasan' }
  /** Renovasi: kapasitas dibangun ulang dengan bonus pendapatan permanen. */
  | { readonly jenis: 'renovasi' }
  /** Klaim hadiah tahap event musiman berikutnya. */
  | { readonly jenis: 'klaimEvent' }
  /** Klaim hadiah tantangan mingguan ke-`indeks`. */
  | { readonly jenis: 'klaimTantangan'; readonly indeks: number }
  /** `ganda`: hadiah 2× setelah menonton iklan berhadiah. */
  | { readonly jenis: 'klaimTarget'; readonly ganda?: boolean }
  | { readonly jenis: 'klaimPencapaian'; readonly pencapaian: PencapaianId; readonly ganda?: boolean }
  // Hadiah iklan berhadiah (UI hanya mengirimnya setelah iklan selesai ditonton).
  | { readonly jenis: 'aktifkanBoost' }
  /** Bus Emas diketuk (menunggu selama pemain memutuskan), ditolak, atau diklaim. */
  | { readonly jenis: 'tahanBusEmas' }
  | { readonly jenis: 'lepasBusEmas' }
  | { readonly jenis: 'klaimBusEmas' }
  | { readonly jenis: 'klaimBonusOffline' }
  /** Ganti nama terminal (profil pemain). */
  | { readonly jenis: 'aturNamaTerminal'; readonly nama: string }
  /** Ikut/keluar papan peringkat (lihat app/peringkat.ts; keluar dikirim setelah server menghapus skornya). */
  | { readonly jenis: 'aturIkutPeringkat'; readonly ikut: boolean };

/** Mengembalikan state yang sama persis kalau aksi tidak berlaku (mis. uang kurang). */
export function terapkanAksi(state: GameState, aksi: Aksi, cfg: KonfigEkonomi = EKONOMI): GameState {
  switch (aksi.jenis) {
    case 'upgrade':
      return beliUpgrade(state, aksi.tahap, cfg);
    case 'rekrutKepala':
      return rekrutKepala(state, aksi.tahap, cfg);
    case 'bangunFasilitas':
      return bangunFasilitas(state, aksi.fasilitas, cfg);
    case 'bukaJalur':
      return bukaJalur(state, cfg);
    case 'beliTeknologi':
      return beliTeknologi(state, aksi.teknologi, cfg);
    case 'bangunLoket':
      return bangunLoket(state, aksi.po ?? null, cfg);
    case 'isiLoketKosong':
      return isiLoketKosong(state, aksi.po ?? null, cfg);
    case 'daftarPo':
      return daftarPo(state, aksi.po, cfg);
    case 'putusPo':
      return putusPo(state, aksi.po, cfg);
    case 'perpanjangPo':
      return perpanjangPo(state, aksi.po, cfg);
    case 'aturHargaPo':
      return aturHargaPo(state, aksi.po, aksi.jurusan, aksi.persen, cfg);
    case 'mulaiPerluasan':
      return mulaiPerluasan(state, cfg);
    case 'renovasi':
      return renovasi(state, cfg);
    case 'klaimEvent':
      return klaimEvent(state, cfg);
    case 'klaimTantangan':
      return klaimTantangan(state, aksi.indeks, cfg);
    case 'klaimTarget':
      return klaimTarget(state, cfg, aksi.ganda);
    case 'klaimPencapaian':
      return klaimPencapaian(state, aksi.pencapaian, cfg, aksi.ganda);
    case 'aktifkanBoost':
      return aktifkanBoost(state, cfg);
    case 'tahanBusEmas':
      return tahanBusEmas(state);
    case 'lepasBusEmas':
      return lepasBusEmas(state, cfg);
    case 'klaimBusEmas':
      return klaimBusEmas(state, cfg);
    case 'klaimBonusOffline':
      return klaimBonusOffline(state);
    case 'aturNamaTerminal':
      return aturNamaTerminal(state, aksi.nama);
    case 'aturIkutPeringkat':
      return aturIkutPeringkat(state, aksi.ikut);
  }
}
