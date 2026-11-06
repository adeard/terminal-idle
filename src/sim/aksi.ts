/**
 * Aksi pemain sebagai data. UI mengirim aksi, sim yang menerapkannya.
 * Bentuk data ini memudahkan replay/analitik nanti tanpa mengubah UI.
 */
import { EKONOMI, type KonfigEkonomi } from '../config/economy.config';
import type { BangunanId, GedungLantaiId, PencapaianId, PetugasId, PoId, TarifId, TeknologiId } from './fitur';
import { gantiTugas, nilaiTugasKelola, pakaiHiasan, pakaiSuratArmada, tutupRapor, tutupSambutanMusim, type SlotHiasan } from './musim';
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
  percepatProyek,
  perpanjangPo,
  putusPo,
  rekrutPetugas,
  tahanBusEmas,
  tambahLantai,
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
  /** Bangun lantai berikutnya gedung ini (sekali ketuk, isinya langsung terpasang; tidak bisa dibongkar). */
  | { readonly jenis: 'tambahLantai'; readonly gedung: GedungLantaiId }
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
  /** Proyek perluasan dipercepat (documents/15 bagian 4.2), hanya bila sisanya cukup panjang. */
  | { readonly jenis: 'percepatProyek' }
  /** Ganti nama terminal (profil pemain). */
  | { readonly jenis: 'aturNamaTerminal'; readonly nama: string }
  /** Ikut/keluar papan peringkat (lihat app/peringkat.ts; keluar dikirim setelah server menghapus skornya). */
  | { readonly jenis: 'aturIkutPeringkat'; readonly ikut: boolean }
  // Musim Terminal (sim/musim.ts, documents/17). Tidak ada yang mengubah kas.
  /** Ganti tugas harian ke-`indeks` (musim.tugas): gratis sekali sehari, lalu dengan tiket. */
  | { readonly jenis: 'gantiTugas'; readonly indeks: number; readonly cara: 'gratis' | 'tiket' }
  /** Pakai hiasan yang dimiliki di slotnya, atau lepas (null). */
  | { readonly jenis: 'pakaiHiasan'; readonly slot: SlotHiasan; readonly item: string | null }
  /** Surat Armada untuk PO terdaftar pilihan pemain (+½ level). */
  | { readonly jenis: 'pakaiSuratArmada'; readonly po: PoId }
  | { readonly jenis: 'tutupRapor' }
  | { readonly jenis: 'tutupSambutanMusim' };

/**
 * Mengembalikan state yang sama persis kalau aksi tidak berlaku (mis. kas kurang). Aksi yang berlaku
 * juga menilai tugas kelola musim (bangun, daftar PO, perbaikan kepuasan; lihat nilaiTugasKelola).
 */
export function terapkanAksi(state: GameState, aksi: Aksi, cfg: KonfigEkonomi = EKONOMI): GameState {
  const baru = terapkan(state, aksi, cfg);
  return baru === state ? baru : nilaiTugasKelola(baru, aksi.jenis, cfg);
}

function terapkan(state: GameState, aksi: Aksi, cfg: KonfigEkonomi): GameState {
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
    case 'tambahLantai':
      return tambahLantai(state, aksi.gedung, cfg);
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
    case 'percepatProyek':
      return percepatProyek(state, cfg);
    case 'aturNamaTerminal':
      return aturNamaTerminal(state, aksi.nama);
    case 'aturIkutPeringkat':
      return aturIkutPeringkat(state, aksi.ikut);
    case 'gantiTugas':
      return gantiTugas(state, aksi.indeks, aksi.cara, cfg);
    case 'pakaiHiasan':
      return pakaiHiasan(state, aksi.slot, aksi.item);
    case 'pakaiSuratArmada':
      return pakaiSuratArmada(state, aksi.po, cfg);
    case 'tutupRapor':
      return tutupRapor(state);
    case 'tutupSambutanMusim':
      return tutupSambutanMusim(state);
  }
}
