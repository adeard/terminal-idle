/**
 * Aksi pemain sebagai data. UI mengirim aksi, sim yang menerapkannya.
 * Bentuk data ini memudahkan replay/analitik nanti tanpa mengubah UI.
 */
import { EKONOMI, type KonfigEkonomi } from '../config/economy.config';
import type { BangunanId, PencapaianId, PetugasId, PoId, TarifId, TeknologiId } from './fitur';
import {
  aktifkanBoost,
  aturIkutPeringkat,
  aturNamaTerminal,
  aturTarif,
  bangun,
  beliTeknologi,
  berhentikanPetugas,
  bongkar,
  daftarPo,
  isiJendelaKosong,
  klaimBonusOffline,
  klaimBusEmas,
  klaimEvent,
  klaimPencapaian,
  klaimTantangan,
  klaimTarget,
  lepasBusEmas,
  mulaiPerluasan,
  pakaiSaranTarif,
  perpanjangPo,
  putusPo,
  rekrutPetugas,
  tahanBusEmas,
  type GameState,
} from './state';

export type Aksi =
  /** Bangun satu unit di slot berikutnya. Jendela loket: disewa `po` (tanpa `po`: PO yang antreannya paling panjang). */
  | { readonly jenis: 'bangun'; readonly bangunan: BangunanId; readonly po?: PoId }
  /** Bongkar satu unit (sebagian biayanya kembali). Jalur permanen; hanya jendela kosong yang bisa dibongkar. */
  | { readonly jenis: 'bongkar'; readonly bangunan: BangunanId }
  /** Rekrut / berhentikan satu petugas peran ini (tanpa biaya sekali bayar; gajinya per hari). */
  | { readonly jenis: 'rekrut'; readonly petugas: PetugasId }
  | { readonly jenis: 'berhentikan'; readonly petugas: PetugasId }
  /** Atur tarif terminal (dirapikan sim ke rentang & langkahnya). */
  | { readonly jenis: 'aturTarif'; readonly tarif: TarifId; readonly nilai: number }
  /** Pakai saran untuk satu tarif (yang paling menguntungkan sehari, mitra PO tetap puas). */
  | { readonly jenis: 'saranTarif'; readonly tarif: TarifId }
  | { readonly jenis: 'beliTeknologi'; readonly teknologi: TeknologiId }
  /** Sewakan jendela kosong (gratis): satu ke `po`, atau semuanya ke PO yang antreannya paling panjang. */
  | { readonly jenis: 'isiJendelaKosong'; readonly po?: PoId }
  /** Daftarkan mitra PO ke slot terminal. */
  | { readonly jenis: 'daftarPo'; readonly po: PoId }
  /** Putus kontrak PO (gratis; masa jeda sebelum bisa didaftarkan lagi). */
  | { readonly jenis: 'putusPo'; readonly po: PoId }
  /** Perpanjang kontrak (gratis, bila PO-nya mau). */
  | { readonly jenis: 'perpanjangPo'; readonly po: PoId }
  /** Mulai proyek tahap perluasan terminal berikutnya. */
  | { readonly jenis: 'mulaiPerluasan' }
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

/** Mengembalikan state yang sama persis kalau aksi tidak berlaku (mis. kas kurang). */
export function terapkanAksi(state: GameState, aksi: Aksi, cfg: KonfigEkonomi = EKONOMI): GameState {
  switch (aksi.jenis) {
    case 'bangun':
      return bangun(state, aksi.bangunan, aksi.po ?? null, cfg);
    case 'bongkar':
      return bongkar(state, aksi.bangunan, cfg);
    case 'rekrut':
      return rekrutPetugas(state, aksi.petugas);
    case 'berhentikan':
      return berhentikanPetugas(state, aksi.petugas);
    case 'aturTarif':
      return aturTarif(state, aksi.tarif, aksi.nilai, cfg);
    case 'saranTarif':
      return pakaiSaranTarif(state, aksi.tarif, cfg);
    case 'beliTeknologi':
      return beliTeknologi(state, aksi.teknologi, cfg);
    case 'isiJendelaKosong':
      return isiJendelaKosong(state, aksi.po ?? null, cfg);
    case 'daftarPo':
      return daftarPo(state, aksi.po, cfg);
    case 'putusPo':
      return putusPo(state, aksi.po, cfg);
    case 'perpanjangPo':
      return perpanjangPo(state, aksi.po, cfg);
    case 'mulaiPerluasan':
      return mulaiPerluasan(state, cfg);
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
