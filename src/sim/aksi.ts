/**
 * Aksi pemain sebagai data. UI mengirim aksi, sim yang menerapkannya.
 * Bentuk data ini memudahkan replay/analitik nanti tanpa mengubah UI.
 */
import { EKONOMI, type KonfigEkonomi } from '../config/economy.config';
import type { FasilitasId, KelasBusId, PencapaianId, PoId, TeknologiId } from './fitur';
import {
  aktifkanBoost,
  aturHargaJurusan,
  aturIkutPeringkat,
  aturNamaTerminal,
  aturTambahanKelas,
  bangunFasilitas,
  beliKelasBus,
  beliTeknologi,
  beliUpgrade,
  bukaJalur,
  bukaJurusan,
  klaimBonusOffline,
  klaimBusEmas,
  klaimEvent,
  klaimPencapaian,
  klaimTantangan,
  klaimTarget,
  kontrakPo,
  lepasBusEmas,
  naikKelas,
  rekrutKepala,
  tahanBusEmas,
  type GameState,
} from './state';
import type { TahapId } from './tahap';

export type Aksi =
  | { readonly jenis: 'upgrade'; readonly tahap: TahapId }
  | { readonly jenis: 'rekrutKepala'; readonly tahap: TahapId }
  | { readonly jenis: 'bangunFasilitas'; readonly fasilitas: FasilitasId }
  | { readonly jenis: 'bukaJurusan' }
  /** Bangun jalur bus berikutnya (halte kedatangan & jalur keberangkatan). */
  | { readonly jenis: 'bukaJalur' }
  | { readonly jenis: 'beliTeknologi'; readonly teknologi: TeknologiId }
  /** Datangkan armada kelas bus berikutnya. */
  | { readonly jenis: 'beliKelasBus'; readonly kelas: KelasBusId }
  /** Atur harga tiket jurusan ke-`indeks` / tambahan harga kelas bus, dalam persen harga normal (dirapikan sim). */
  | { readonly jenis: 'aturHargaJurusan'; readonly indeks: number; readonly persen: number }
  | { readonly jenis: 'aturTambahanKelas'; readonly kelas: KelasBusId; readonly persen: number }
  /** Klaim hadiah tahap event musiman berikutnya. */
  | { readonly jenis: 'klaimEvent' }
  /** Naik kelas terminal (prestige): dibangun ulang dengan bonus pendapatan permanen. */
  | { readonly jenis: 'naikKelas' }
  /** Kontrak mitra PO (PO yang bergabung dengan membayar sekali). */
  | { readonly jenis: 'kontrakPo'; readonly po: PoId }
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
    case 'bukaJurusan':
      return bukaJurusan(state, cfg);
    case 'bukaJalur':
      return bukaJalur(state, cfg);
    case 'beliTeknologi':
      return beliTeknologi(state, aksi.teknologi, cfg);
    case 'beliKelasBus':
      return beliKelasBus(state, aksi.kelas, cfg);
    case 'aturHargaJurusan':
      return aturHargaJurusan(state, aksi.indeks, aksi.persen, cfg);
    case 'aturTambahanKelas':
      return aturTambahanKelas(state, aksi.kelas, aksi.persen, cfg);
    case 'kontrakPo':
      return kontrakPo(state, aksi.po, cfg);
    case 'naikKelas':
      return naikKelas(state, cfg);
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
