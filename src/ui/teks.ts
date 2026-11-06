/** Semua teks yang tampil ke pemain. */
import type { KodeGalatPeringkat } from '../app/peringkat';
import type { TingkatPo } from '../config/economy.config';
import { BINGKAI_EMAS, type SlotHiasan, type TemaMusimId } from '../config/musim.config';
import type { Izin } from '../sim/bangunan';
import { slotHiasan, temaHiasan, type HadiahMusim, type JenisLencana, type NilaiRapor } from '../sim/musim';
import type { BangunanId, EventId, GedungLantaiId, KelasBusId, PencapaianId, PetugasId, PoId, TarifId, TeknologiId } from '../sim/fitur';
import type { RincianBiaya, RincianPendapatan } from '../sim/keuangan';
import type { AreaId } from '../sim/operasi';
import type { TahapId } from '../sim/tahap';
import type { PaketHadiah } from '../sim/state';
import type { TingkatKeramaian } from '../sim/waktu';
import { formatAngka, formatUang, formatUangBertanda } from './format';
import type { ModelBangunan, ModelLantai, ModelTugas } from './model';

export const NAMA_TAHAP: Readonly<Record<TahapId, string>> = {
  peron: 'Peron',
  loket: 'Loket',
  keberangkatan: 'Keberangkatan',
};

/** Area yang membatasi arus penumpang (tab Bangun, popup kepuasan). */
export const NAMA_AREA: Readonly<Record<AreaId, string>> = {
  ...NAMA_TAHAP,
  pangkalan: 'Pangkalan bus',
};

/** Nama hari, indeks 0 = Senin (lihat sim/waktu.ts). */
export const NAMA_HARI: readonly string[] = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'];

/** Bangunan di slot denah (tab Bangun): nama & efeknya. */
export const NAMA_BANGUNAN: Readonly<Record<BangunanId, { readonly nama: string; readonly deskripsi: string }>> = {
  jalur: { nama: 'Jalur bus', deskripsi: 'Satu halte kedatangan & satu gerbang keberangkatan: kapasitas Peron & Keberangkatan' },
  jendela: { nama: 'Jendela loket', deskripsi: 'Disewa satu PO: kapasitas Loket & sewa harian' },
  kursi: { nama: 'Blok kursi', deskripsi: '60 kursi ruang tunggu: kenyamanan' },
  kios: { nama: 'Kios', deskripsi: 'Disewakan per hari: fasilitas & sewa kios' },
  toko: { nama: 'Minimarket & apotek', deskripsi: 'Toko di aula, disewakan per hari' },
  toilet: { nama: 'Toilet & musholla', deskripsi: 'Gratis untuk penumpang: fasilitas & kebersihan' },
  lahanParkir: { nama: 'Lahan parkir kendaraan', deskripsi: 'Pengantar & penjemput membayar parkir' },
  posRetribusi: { nama: 'Pos retribusi', deskripsi: 'Tiap bus yang berangkat membayar retribusi' },
};

/** Peran petugas (tab Petugas): nama & efeknya. */
export const NAMA_PETUGAS: Readonly<Record<PetugasId, { readonly nama: string; readonly deskripsi: string }>> = {
  peron: { nama: 'Petugas peron', deskripsi: '+25% kapasitas satu halte kedatangan' },
  gerbang: { nama: 'Petugas gerbang', deskripsi: '+25% kapasitas satu gerbang keberangkatan' },
  kebersihan: { nama: 'Petugas kebersihan', deskripsi: 'Kebersihan: satu orang per 150 penumpang per jam' },
  satpam: { nama: 'Satpam', deskripsi: 'Keamanan: satu orang per jalur' },
  juruParkir: { nama: 'Juru parkir', deskripsi: 'Tanpa juru parkir, separuh pengantar tidak membayar' },
  petugasToilet: { nama: 'Petugas toilet', deskripsi: 'Tanpa petugas, toilet cepat kotor' },
  petugasRetribusi: { nama: 'Petugas retribusi', deskripsi: 'Tanpa petugas, separuh bus lolos retribusi' },
  manajerOperasional: { nama: 'Manajer Operasional', deskripsi: 'Terminal tetap berjalan saat game ditutup (maks. 8 jam)' },
  manajerKemitraan: { nama: 'Manajer Kemitraan', deskripsi: 'Menyewakan jendela kosong & memperpanjang kontrak PO otomatis' },
};

/** Tarif terminal (tab Terminal): nama, cara menampilkan nilainya, dan efek bila dinaikkan. */
export const NAMA_TARIF: Readonly<Record<TarifId, { readonly nama: string; readonly satuan: 'persen' | 'rupiah'; readonly per: string; readonly deskripsi: string }>> = {
  sewaLoket: { nama: 'Sewa jendela loket', satuan: 'rupiah', per: 'hari', deskripsi: 'Lebih tinggi: kepuasan mitra PO turun' },
  retribusiBus: { nama: 'Retribusi bus', satuan: 'rupiah', per: 'bus', deskripsi: 'Butuh pos retribusi. Lebih tinggi: kepuasan mitra PO turun' },
  parkir: { nama: 'Parkir kendaraan', satuan: 'rupiah', per: 'kendaraan', deskripsi: 'Butuh lahan parkir. Lebih tinggi: pengantar yang parkir berkurang' },
  sewaKios: { nama: 'Sewa kios & toko', satuan: 'rupiah', per: 'hari', deskripsi: 'Lebih tinggi dari keramaiannya: sebagian kosong' },
};

/** Sumber pendapatan & pos biaya (laporan keuangan). */
export const NAMA_PENDAPATAN: Readonly<Record<keyof RincianPendapatan, string>> = {
  kontrak: 'Kontrak PO',
  sewaLoket: 'Sewa jendela loket',
  retribusi: 'Retribusi bus',
  parkir: 'Parkir kendaraan',
  sewaKios: 'Sewa kios & toko',
};
export const NAMA_BIAYA: Readonly<Record<keyof RincianBiaya, string>> = {
  gaji: 'Gaji petugas',
  perawatan: 'Perawatan',
  listrik: 'Listrik',
  gedung: 'Operasional gedung',
  kompensasi: 'Kompensasi putus kontrak',
};

/** Mitra PO (semua nama fiktif) dan kota asalnya. */
export const NAMA_PO: Readonly<Record<PoId, { readonly nama: string; readonly asal: string }>> = {
  lumpiaKilat: { nama: 'PO Lumpia Kilat', asal: 'Semarang' },
  bakpiaRasa: { nama: 'PO Bakpia Rasa', asal: 'Yogyakarta' },
  wayangLestari: { nama: 'PO Wayang Lestari', asal: 'Solo' },
  arekEkspres: { nama: 'PO Arek Ekspres', asal: 'Surabaya' },
  apelBatu: { nama: 'PO Apel Batu', asal: 'Malang' },
  kecakLaju: { nama: 'PO Kecak Laju', asal: 'Denpasar' },
  sigerSakti: { nama: 'PO Siger Sakti', asal: 'Lampung' },
  rinjaniIndah: { nama: 'PO Rinjani Indah', asal: 'Mataram' },
  rumahGadang: { nama: 'PO Rumah Gadang', asal: 'Padang' },
  danauToba: { nama: 'PO Danau Toba', asal: 'Medan' },
  kopiGayo: { nama: 'PO Kopi Gayo', asal: 'Banda Aceh' },
  ondelOndel: { nama: 'PO Ondel-Ondel', asal: 'Jakarta' },
  peuyeumKilat: { nama: 'PO Peuyeum Kilat', asal: 'Bandung' },
  teloletJaya: { nama: 'PO Telolet Jaya', asal: 'Jepara' },
  sultanGarasi: { nama: 'PO Sultan Garasi', asal: 'Jakarta' },
  juaraKelas: { nama: 'PO Juara Kelas', asal: 'Bogor' },
  juaraUmum: { nama: 'PO Juara Umum', asal: 'Medan' },
  mudikCeria: { nama: 'PO Mudik Ceria', asal: 'Cirebon' },
  merahPutih: { nama: 'PO Merah Putih', asal: 'Jakarta' },
  kembangApi: { nama: 'PO Kembang Api', asal: 'Makassar' },
};

/** Tingkat mitra PO (lihat EKONOMI.mitra.tingkat). */
export const NAMA_TINGKAT_PO: Readonly<Record<TingkatPo, string>> = {
  lokal: 'Lokal',
  regional: 'Regional',
  nasional: 'Nasional',
  premium: 'Premium',
};

/**
 * Tahap perluasan terminal, urut EKONOMI.mitra.perluasan (slot barunya di EKONOMI.tycoon.bangunan).
 * "Sayap 2 lantai" memakai spasi tak terputus supaya namanya tidak terpotong di toast & popup 360 px (playtest P-1).
 */
export const NAMA_PERLUASAN: readonly { readonly nama: string; readonly deskripsi: string }[] = [
  { nama: 'Aula loket diperluas', deskripsi: 'Slot jendela loket +2' },
  { nama: 'Pangkalan diperluas', deskripsi: 'Petak bus +10, jendela loket +2, lahan parkir kedua' },
  {
    nama: 'Sayap\u00a02\u00a0lantai',
    deskripsi: 'Loket, ruang tunggu & food court: jendela +4, petak bus +10, kursi, toko, toilet; sesudahnya naik level menambah slot jendela & jalur, dan membuka Tambah lantai',
  },
  { nama: 'Gedung parkir bus', deskripsi: 'Gedung Antarpulau: jalur +1, petak bus +10, aula loket kedua' },
  { nama: 'Terminal Terpadu', deskripsi: 'Dek parkir ketiga & lantai 3: jalur +1, petak bus +20, jendela +4' },
];

/**
 * Gedung yang bisa ditambah lantai (documents/18): nama (spasi tak terputus supaya tidak terpotong di toast 360 px),
 * isi satu lantai di kartu, dan isi pendek untuk toast (tanpa keterangan dalam kurung).
 */
export const NAMA_GEDUNG_LANTAI: Readonly<Record<GedungLantaiId, { readonly nama: string; readonly isi: string; readonly isiPendek: string }>> = {
  parkir: { nama: 'Gedung parkir', isi: '+2 lahan parkir (120 kendaraan/jam)', isiPendek: '+2 lahan parkir' },
  ruangTunggu: { nama: 'Ruang tunggu', isi: '+4 blok kursi (240 kursi) & 1 kios', isiPendek: '+4 blok kursi & 1 kios' },
  // documents/18 bagian 7: lantai 2 = selasar penghubung tanpa toilet; +1 toilet ada di lantai dasar (owner, Telegram 274).
  sayapBarat: { nama: 'Gedung toilet', isi: 'Selasar penghubung, +1 toilet di lantai dasar', isiPendek: 'selasar & +1 toilet' },
  aula: { nama: 'Aula loket', isi: 'Mezanin: +2 blok kursi & 2 toko', isiPendek: '+2 blok kursi & 2 toko' },
};

/** Efek singkat tiap tahap perluasan (baris tujuan & notifikasi perluasan terbuka), urut NAMA_PERLUASAN. */
export const EFEK_PERLUASAN: readonly string[] = ['slot jendela loket +2', 'petak bus +10, jendela +2', 'lantai 2, jendela +4, izin level', 'jalur +1, petak bus +10', 'jalur +1, jendela +4'];

/** Event musiman: nama lengkap, nama singkat (HUD), dan ikon notifikasi. */
export const NAMA_EVENT: Readonly<Record<EventId, { readonly nama: string; readonly singkat: string; readonly ikon: string }>> = {
  mudikLebaran: { nama: 'Mudik Lebaran', singkat: 'Mudik', ikon: '🌙' },
  hutRi: { nama: 'HUT Kemerdekaan RI', singkat: 'HUT RI', ikon: '🎉' },
  nataru: { nama: 'Libur Natal & Tahun Baru', singkat: 'Nataru', ikon: '🎆' },
};

/** Sisa waktu event: "5 hari", "7 jam", "12 menit". */
export function sisaWaktuEvent(ms: number): string {
  const menit = Math.max(1, Math.floor(ms / 60_000));
  if (menit >= 1440) return `${Math.floor(menit / 1440)} hari`;
  if (menit >= 60) return `${Math.floor(menit / 60)} jam`;
  return `${menit} menit`;
}

const BULAN_SINGKAT: readonly string[] = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

/** Rentang minggu Senin–Minggu dari kuncinya ("2026-09-21" → "21–27 Sep", lintas bulan "29 Des – 4 Jan"). */
export function rentangMinggu(kunci: string): string {
  const [t, b, h] = kunci.split('-').map(Number) as [number, number, number];
  const awal = new Date(Date.UTC(t, b - 1, h));
  const akhir = new Date(Date.UTC(t, b - 1, h + 6));
  const bAwal = BULAN_SINGKAT[awal.getUTCMonth()]!;
  const bAkhir = BULAN_SINGKAT[akhir.getUTCMonth()]!;
  return bAwal === bAkhir ? `${awal.getUTCDate()}–${akhir.getUTCDate()} ${bAkhir}` : `${awal.getUTCDate()} ${bAwal} – ${akhir.getUTCDate()} ${bAkhir}`;
}

/** Pesan galat papan peringkat untuk pemain (lihat KODE_GALAT_PERINGKAT). */
export const GALAT_PERINGKAT: Readonly<Record<KodeGalatPeringkat, string>> = {
  token: 'Sesi login berakhir. Masuk lagi lewat menu akun supaya skormu terkirim.',
  dilarang: 'Akun ini diblokir dari papan peringkat.',
  'terlalu-sering': 'Skor belum terkirim. Dicoba lagi otomatis.',
  'minggu-lain': 'Tanggal & jam perangkatmu tidak sesuai, jadi skor tidak bisa dikirim. Periksa pengaturan jam.',
  'nama-kosong': 'Beri nama terminalmu dulu supaya tampil di papan.',
  'nama-ditolak': 'Nama terminalmu tidak bisa tampil di papan. Ganti namanya dulu.',
  'skor-tidak-wajar': 'Skormu ditolak server karena naik terlalu cepat.',
  'data-salah': 'Skor belum terkirim. Perbarui game ke versi terbaru.',
  server: 'Papan peringkat sedang gangguan. Skor dicoba kirim lagi otomatis.',
  jaringan: 'Tidak ada koneksi. Skor dicoba kirim lagi otomatis.',
};

/** Nama kelas terminal: 0 = Tipe C, 1 = Tipe B, 2 = Tipe A, lalu Terpadu dengan bintang. */
export function namaKelas(kelas: number): string {
  if (kelas <= 0) return 'Tipe C';
  if (kelas === 1) return 'Tipe B';
  if (kelas === 2) return 'Tipe A';
  return `Terpadu ★${kelas - 2}`;
}

/** Izin level jadi teks: "slot jendela loket +1 & slot PO ke-7" (yang ada saja; kosong bila tidak ada). */
export function teksIzin(izin: Izin): string {
  return [izin.jendela > 0 ? TEKS.izinJendela(izin.jendela) : '', izin.jalur > 0 ? TEKS.izinJalur(izin.jalur) : '', izin.slotPo > 0 ? TEKS.izinSlotPo(izin.slotPo) : '']
    .filter(Boolean)
    .join(' & ');
}

/** Bagian level armada dalam teks (playtest P-2): 1 → "1", 0,5 → "½", 0,25 → "¼", lainnya "{persen}%" ("+75% level"). */
export function teksBagianLevel(bagian: number): string {
  if (Number.isInteger(bagian)) return String(bagian);
  if (bagian === 0.5) return '½';
  if (bagian === 0.25) return '¼';
  return `${Math.round(bagian * 100)}%`;
}

/** Isi paket hadiah sebelum diklaim (documents/15 bagian 4.4): "+Rp 3 jt · 🚌 PO Wayang Lestari +½ level · 🏗️ −6 mnt". */
export function teksPaket(p: PaketHadiah): string {
  const a = p.armada;
  return [
    `+${formatUang(p.uang)}`,
    a ? TEKS.hadiahArmada(NAMA_PO[a.po].nama, teksBagianLevel(a.bagian)) : '',
    p.percepatDetik > 0 ? TEKS.hadiahPercepat(Math.round(p.percepatDetik / 60)) : '',
  ]
    .filter(Boolean)
    .join(' · ');
}

/** Label tombol 2× target harian (playtest P-1): "2× semua" bila paketnya juga berisi armada atau percepat. */
export function labelGandaTarget(p: PaketHadiah): string {
  return p.armada !== null || p.percepatDetik > 0 ? TEKS.klaimGandaPaket : TEKS.klaimGanda;
}

/** Status PO yang terhalang slot jendela (playtest P-4): dari mana slot jendela berikutnya datang (lantai tidak menambah jendela). */
export function teksJendelaPenuh(s: ModelBangunan['slotBerikut']): string {
  if (s === null || s.jenis === 'lantai') return TEKS.poJendelaPenuh;
  return s.jenis === 'level' ? TEKS.poJendelaPenuhLevel(s.level) : TEKS.poJendelaPenuhPerluasan(s.tahap);
}

/** Toast slot PO baru saat slot jendela penuh (playtest P-4): penuh sampai level izin atau perluasan berikutnya. */
export function teksSlotTanpaJendela(slot: number, s: ModelBangunan['slotBerikut']): string {
  if (s === null || s.jenis === 'lantai') return TEKS.notifSlotTanpaJendela(slot);
  return TEKS.notifSlotTanpaJendelaSampai(slot, s.jenis === 'level' ? `Lv ${s.level}` : `Perluasan ${s.tahap}`);
}

/** Isi & efek kartu lantai: isi satu lantai, lalu pratinjau (paling banyak 2 bagian). */
export function teksIsiLantai(x: ModelLantai): string {
  const efek = x.pratinjau.map((p) =>
    p.jenis === 'parkir'
      ? TEKS.pratinjauParkir(formatUangBertanda(p.selisih))
      : TEKS.pratinjauKomponen(p.komponen === 'kenyamanan' ? TEKS.kepuasanKenyamanan : p.komponen === 'fasilitas' ? TEKS.kepuasanFasilitas : TEKS.kepuasanKebersihan, p.dari, p.ke),
  );
  return [NAMA_GEDUNG_LANTAI[x.gedung].isi, ...efek].join(' · ');
}

/** Baris status kartu lantai menurut keadaannya (rancangan 4.4). */
export function teksStatusLantai(x: ModelLantai): string {
  switch (x.keadaan) {
    case 'terkunci':
      return TEKS.lantaiTerkunci(x.berikut?.level ?? 0);
    case 'selesai':
      return TEKS.lantaiSelesaiBerikut(1 + x.lantai, x.berikut?.lantai ?? 0, x.berikut?.level ?? 0);
    case 'maks':
      return TEKS.lantaiSelesai(1 + x.lantai);
    case 'terjangkau':
    case 'kurang': {
      const p = x.petugas;
      return [
        TEKS.biayaLantai(formatUang(x.operasional)),
        p ? TEKS.petugasLantai(p.jumlah, NAMA_PETUGAS[p.id].nama.toLowerCase(), formatUang(p.gaji)) : '',
        x.peringatanKas ? TEKS.lantaiPeringatanKas(formatUang(x.sisaKas)) : '',
      ]
        .filter(Boolean)
        .join(' · ');
    }
  }
}

/** Status unit yang slotnya penuh (tab Bangun): sumber slot berikutnya, termasuk lantai (documents/18, AC-GP-05). */
export function teksSlotPenuh(s: ModelBangunan['slotBerikut']): string {
  if (s === null) return TEKS.slotPenuh;
  switch (s.jenis) {
    case 'level':
      return TEKS.slotPenuhLevel(s.level);
    case 'perluasan':
      return TEKS.slotPenuhPerluasan(s.tahap);
    case 'lantai': {
      const nama = NAMA_GEDUNG_LANTAI[s.gedung].nama;
      return s.terbuka ? TEKS.slotPenuhLantai(nama) : TEKS.slotPenuhLantaiLevel(s.lantai, nama, s.level);
    }
  }
}

export const NAMA_TEKNOLOGI: Readonly<Record<TeknologiId, string>> = {
  rambuHalte: 'Marka & rambu halte',
  pengaturBus: 'Sistem pengatur bus',
  mesinTiket: 'Mesin tiket mandiri',
  eTiket: 'Tiket online (e-tiket)',
  jadwalDigital: 'Papan jadwal digital',
  gateOtomatis: 'Gate e-boarding otomatis',
};

/** Nama pendek modernisasi untuk baris tujuan (satu baris di portrait). */
export const NAMA_PENDEK_TEKNOLOGI: Readonly<Record<TeknologiId, string>> = {
  rambuHalte: 'marka & rambu',
  pengaturBus: 'pengatur bus',
  mesinTiket: 'mesin tiket',
  eTiket: 'e-tiket',
  jadwalDigital: 'papan jadwal digital',
  gateOtomatis: 'gate e-boarding',
};

/** Kelas bus yang dioperasikan mitra PO (tab PO & tab Terminal). */
export const NAMA_KELAS_BUS: Readonly<Record<KelasBusId, { readonly nama: string; readonly deskripsi: string }>> = {
  ekonomi: { nama: 'Ekonomi', deskripsi: 'Bus kota tanpa AC, tarif paling murah' },
  patas: { nama: 'Patas AC', deskripsi: 'Cepat terbatas berpendingin udara' },
  eksekutif: { nama: 'Eksekutif', deskripsi: 'High deck, kursi lega, kaca gelap' },
  sleeper: { nama: 'Sleeper', deskripsi: 'Kabin tidur untuk perjalanan malam' },
  tingkat: { nama: 'Double Decker', deskripsi: 'Bus tingkat dua dek' },
};

export const NAMA_PENCAPAIAN: Readonly<Record<PencapaianId, { readonly nama: string; readonly deskripsi: string }>> = {
  petugasPertama: { nama: 'Tim Pertama', deskripsi: 'Rekrut petugas pertama' },
  fasilitasPertama: { nama: 'Terminal Nyaman', deskripsi: 'Bangun fasilitas pertama' },
  targetPertama: { nama: 'Tepat Sasaran', deskripsi: 'Selesaikan target harian' },
  manajerOperasional: { nama: 'Berjalan Sendiri', deskripsi: 'Rekrut Manajer Operasional' },
  sepekan: { nama: 'Sepekan Beroperasi', deskripsi: 'Beroperasi 7 hari terminal' },
  jalurLima: { nama: 'Lima Jalur', deskripsi: 'Bangun 5 jalur bus' },
  jurusanSemua: { nama: 'Penghubung Jawa–Bali', deskripsi: 'Layani semua jurusan Jawa–Bali sekaligus' },
  kelasB: { nama: 'Naik Kelas', deskripsi: 'Terminal naik ke Tipe B' },
  tanpaRugi: { nama: 'Selalu Untung', deskripsi: '7 hari terminal berturut-turut tanpa rugi' },
  penumpang100rb: { nama: 'Seratus Ribu Perjalanan', deskripsi: 'Berangkatkan 100.000 penumpang' },
  antarpulau: { nama: 'Menyeberang Pulau', deskripsi: 'Layani rute antarpulau pertama' },
  fasilitasLengkap: { nama: 'Fasilitas Lengkap', deskripsi: '3 kios, minimarket & apotek, toilet, parkir, dan pos retribusi' },
  modernLengkap: { nama: 'Terminal Modern', deskripsi: 'Pasang semua modernisasi' },
  kasMiliar: { nama: 'Kas Miliaran', deskripsi: 'Kas terminal mencapai Rp 1 M' },
  kelasA: { nama: 'Terminal Tipe A', deskripsi: 'Terminal naik ke Tipe A' },
  armadaLengkap: { nama: 'Armada Lengkap', deskripsi: 'Kelima kelas bus beroperasi, sampai Double Decker' },
  loketPenuh: { nama: 'Aula Penuh', deskripsi: '20 jendela loket disewa PO' },
  terpadu: { nama: 'Terminal Terpadu', deskripsi: 'Terminal naik ke Terpadu' },
  penumpangSejuta: { nama: 'Sejuta Perjalanan', deskripsi: 'Berangkatkan 1 juta penumpang' },
  lintasNusantara: { nama: 'Lintas Nusantara', deskripsi: 'Layani semua rute sampai Banda Aceh sekaligus' },
};

/** Label keramaian di bawah jam HUD. */
export const LABEL_KERAMAIAN: Readonly<Record<TingkatKeramaian, string>> = {
  sibuk: 'Jam sibuk',
  ramai: 'Ramai',
  sedang: 'Sedang',
  sepi: 'Sepi',
};

export const TEKS = {
  siang: 'Siang',
  malam: 'Malam',
  hujan: 'Hujan',
  judul: 'Bustation: Idle Bus',
  level: (n: number) => `Lv ${n}`,
  satuanArus: 'pnp/jam',
  /** Pil laba HUD: laba rata-rata per hari terminal (lihat ModelHud.labaHarian). */
  hudLaba: (laba: string) => `Laba ${laba}/hari`,
  hudLabaJudul: 'Laba rata-rata sehari dengan tarif sekarang, termasuk kontrak PO yang dirata-rata. Ketuk untuk laporan keuangan.',
  hudDiTerminal: (n: string) => `Di terminal ${n} pnp`,
  // Baris tujuan berikutnya di HUD (app/tujuan.ts, ui/baris-tujuan.ts; documents/14 bagian 3.4, ≤ 60 karakter).
  tujuanKasPerpanjang: (po: string) => `⚠️ Kas menipis: perpanjang kontrak ${po}`,
  tujuanKasSewakan: '⚠️ Kas menipis: sewakan jendela loket yang kosong',
  tujuanKasDaftar: (po: string, nilai: string) => `⚠️ Kas menipis: daftarkan ${po} (+${nilai})`,
  tujuanKasPetugas: '⚠️ Kas menipis: kurangi petugas sampai kontrak berikutnya',
  tujuanKontrakHampir: (po: string) => `📄 Kontrak ${po} tinggal sehari: perpanjang`,
  tujuanMenolakKepuasan: (po: string, persen: number) => `📄 ${po} menolak perpanjang: butuh kepuasan ${persen}%`,
  tujuanMenolakMitra: (po: string) => `📄 ${po} menolak perpanjang: turunkan sewa loket`,
  tujuanPerpanjang: (po: string, nilai: string) => `📄 Perpanjang kontrak ${po}: +${nilai}`,
  tujuanSewakan: (n: number) => `🎫 ${n} jendela loket kosong: sewakan ke PO, gratis`,
  tujuanDaftarPo: (po: string, nilai: string) => `🚌 Daftarkan ${po}: +${nilai} di muka`,
  tujuanPerluasan: (tahap: number, efek: string) => `🏗️ Bangun Perluasan ${tahap}: ${efek}`,
  tujuanAreaRekrut: (area: string, petugas: string) => `🚦 ${area} paling lambat: rekrut petugas ${petugas}`,
  tujuanAreaJendela: (biaya: string) => `🚦 Loket paling lambat: bangun jendela loket · ${biaya}`,
  tujuanAreaModern: (area: string, nama: string) => `🚦 ${area} paling lambat: pasang ${nama}`,
  tujuanAreaJalur: (area: string, nomor: number, biaya: string) => `🚦 ${area} paling lambat: bangun Jalur ${nomor} · ${biaya}`,
  tujuanKebersihan: (wajah: string) => `${wajah} Kebersihan kurang: rekrut petugas kebersihan`,
  tujuanToilet: (wajah: string) => `${wajah} Toilet kotor: rekrut petugas toilet`,
  tujuanKeamanan: (wajah: string) => `${wajah} Keamanan kurang: rekrut satpam`,
  tujuanKursi: (wajah: string, biaya: string) => `${wajah} Kursi kurang: bangun blok kursi · ${biaya}`,
  tujuanFasilitas: (wajah: string, nama: string, biaya: string) => `${wajah} Belum ada ${nama}: bangun · ${biaya}`,
  tujuanLantaiKenyamanan: (persen: number, nama: string) => `🪑 Kenyamanan ${persen}%: tambah lantai ${nama}`,
  tujuanLantaiFasilitas: (persen: number, nama: string) => `🚻 Fasilitas ${persen}%: tambah lantai ${nama}`,
  tujuanManajer: '🌙 Rekrut Manajer Operasional: terminal jalan saat kamu pergi',
  tujuanProyek: (tahap: number, durasi: string) => `🏗️ Perluasan ${tahap} jadi dalam ${durasi}, walau game ditutup`,
  tujuanMenabung: (tahap: number, uang: string) => `🏗️ Perluasan ${tahap}: kumpulkan ${uang} lagi`,
  /** Kas sudah ≥ biaya perluasan: yang dikumpulkan hanya cadangan kas (tombol Bangun di kartu sudah aktif). */
  tujuanMenabungCadangan: (tahap: number, uang: string) => `🏗️ Perluasan ${tahap}: kumpulkan ${uang} lagi untuk cadangan`,
  tujuanNaikLevel: (tahap: number, level: number, kini: number) => `⬆️ Perluasan ${tahap} terbuka di Lv ${level} · kini Lv ${kini}`,
  tujuanKelas: (kelas: string, level: number, kini: number) => `⭐ Naik ke ${kelas} di Lv ${level} · kini Lv ${kini}`,
  tujuanIzin: (level: number, izin: string, kini: number) => `⬆️ Lv ${level}: ${izin} · kini Lv ${kini}`,
  // Toast kepuasan turun (app/kepuasan-turun.ts; documents/14 bagian 4.2).
  notifKepuasanTurun: (wajah: string, dari: number, ke: number, sebab: string) => `${wajah} Kepuasan turun ${dari}% → ${ke}%: ${sebab}. Ketuk untuk rincian`,
  sebabAntreanDi: (area: string) => `antrean di ${area}`,
  sebabAntrean: 'antrean panjang',
  sebabKenyamanan: 'kursi kurang',
  sebabKebersihan: 'petugas kebersihan kurang',
  sebabKeamanan: 'satpam kurang',
  sebabFasilitas: 'fasilitas kurang',
  sebabHarga: 'tarif parkir terlalu mahal',
  // Tutorial terpandu (ui/tutorial.ts).
  tutorialSambutanJudul: 'Selamat datang, Kepala Terminal!',
  tutorialSambutan: 'Penumpang turun di Peron, beli tiket di Loket, lalu naik bus di Keberangkatan. Kembangkan terminalmu supaya laba terus tumbuh.',
  tutorialMulai: 'Mulai',
  tutorialLewati: 'Lewati',
  tutorialOke: 'Oke',
  tutorialNomor: (ke: number, dari: number) => `Langkah ${ke}/${dari}`,
  tutorialJendelaJudul: 'Bangun jendela loket',
  tutorialJendela: (po: string) => `Penumpang menumpuk di Loket (lantainya berkedip merah). Bangun jendela loket baru untuk ${po}.`,
  tutorialPoJudul: 'Daftarkan PO kedua',
  tutorialPo: (po: string) => `PO membawa jurusan & busnya sendiri, dan membayar kontraknya di muka. Daftarkan ${po} di tab PO.`,
  tutorialKontrak: (nilai: string) => `PO ini membayar kontrak ${nilai} di muka. Ketuk tombol yang berkedip.`,
  tutorialPetugasJudul: 'Rekrut petugas peron',
  tutorialPetugas: 'Penumpang PO baru menumpuk di Peron. Rekrut petugas peron di tab Petugas: halte melayani 25% lebih banyak.',
  tutorialJalurJudul: 'Bangun Jalur 2',
  tutorialJalur: 'Bus mengantre di jalan raya karena baru ada satu jalur. Bangun Jalur 2 di tab Bangun.',
  tutorialUang: (kas: string, biaya: string) => `Kas ${kas} / ${biaya}`,
  tutorialUangCukup: 'Kas cukup! Ketuk tombol yang berkedip.',
  tutorialGaji: 'Rekrut tanpa biaya: gajinya dibayar tiap hari. Ketuk tombol yang berkedip.',
  // Tantangan mingguan & rekor (tab Target).
  tantanganJudul: (sisa: string) => `🎯 Tantangan minggu ini · berakhir dalam ${sisa}`,
  tantanganBerakhir: '🎯 Tantangan minggu ini · sudah berakhir',
  tantanganPenumpang: (n: string) => `Berangkatkan ${n} penumpang`,
  tantanganLaba: (rp: string) => `Kumpulkan laba bersih ${rp}`,
  tantanganBangun: (n: number) => `Bangun ${n} unit atau modernisasi`,
  tantanganKepuasan: (persen: number, menit: number) => `Jaga kepuasan ≥ ${persen}% selama ${menit} menit main`,
  tantanganMenit: (ada: number, target: number) => `${ada} / ${target} menit`,
  tantanganKepuasanKini: (persen: number) => `kini ${persen}% ›`,
  tantanganKepuasanBuka: 'Buka rincian kepuasan penumpang',
  tantanganCatatan: 'Tantangan baru tiap Senin (WIB). Laba dihitung seperti Laba/hari: kontrak PO dirata-rata. 🚌 Armada selalu untuk PO berlevel terendah.',
  notifTantangan: '🎯 Tantangan mingguan selesai! Klaim di tab Target',
  rekorJudul: '🏅 Rekor terminal',
  rekorHariIni: (p: string, rp: string) => `Hari ini: ${p} penumpang · laba ${rp}`,
  rekorPenumpang: 'Penumpang terbanyak sehari',
  rekorLaba: 'Laba terbanyak sehari',
  rekorArus: 'Arus tertinggi',
  rekorBelum: '—',
  notifRekor: (p: string) => `🏅 Rekor baru: ${p} penumpang dalam sehari!`,
  // Papan peringkat mingguan (kartu tab Target & ui/peringkat.ts).
  peringkatJudul: (sisa: string) => `🏆 Papan peringkat minggu ini · berakhir dalam ${sisa}`,
  peringkatJudulPopup: '🏆 Papan peringkat',
  peringkatPenumpang: (n: string) => `Penumpangmu minggu ini: ${n}`,
  peringkatPosisi: (no: string, jumlah: string) => `Peringkatmu #${no} dari ${jumlah} terminal`,
  peringkatLuar: (batas: string, jumlah: string) => `Di luar ${batas} besar dari ${jumlah} terminal`,
  peringkatAjak: 'Adu jumlah penumpang mingguan dengan terminal pemain lain. Papan dimulai lagi tiap Senin.',
  peringkatLihat: 'Lihat papan',
  peringkatMingguIni: 'Minggu ini',
  peringkatMingguLalu: 'Minggu lalu',
  peringkatInfo: (sisa: string, jumlah: string) => `Berakhir dalam ${sisa} · ${jumlah} terminal ikut`,
  peringkatInfoLalu: (rentang: string, jumlah: string) => `Hasil akhir ${rentang} · ${jumlah} terminal`,
  peringkatNama: (nama: string) => `Terminal ${nama}`,
  peringkatLuarDaftar: (batas: string) => `${batas}+`,
  peringkatKosong: 'Belum ada terminal di papan minggu ini. Jadilah yang pertama!',
  peringkatKosongLalu: 'Tidak ada terminal di papan minggu itu.',
  peringkatMemuat: 'Memuat papan…',
  peringkatGagal: 'Papan peringkat tidak bisa dimuat. Periksa koneksi lalu coba lagi.',
  peringkatCobaLagi: 'Coba lagi',
  peringkatTamu: 'Masuk dengan Google untuk ikut. Tanpa masuk pun kamu tetap bisa melihat papan.',
  peringkatMasuk: 'Masuk untuk ikut',
  peringkatPersetujuan: 'Nama terminal, tipe terminal, dan jumlah penumpangmu minggu ini akan tampil untuk semua pemain. Nama & email akun Google tidak pernah ditampilkan. Kamu bisa keluar kapan saja.',
  peringkatIkut: 'Ikut papan peringkat',
  peringkatMengirim: 'Mengirim skor…',
  peringkatIkutTeks: 'Skormu dikirim otomatis tiap beberapa menit selama bermain. Penumpang saat game ditutup tidak dihitung.',
  peringkatKeluar: 'Keluar dari papan peringkat',
  peringkatKeluarYakin: 'Skormu akan dihapus dari papan. Kamu bisa ikut lagi kapan saja.',
  peringkatKeluarYa: 'Ya, keluar',
  peringkatKeluarGagal: 'Gagal keluar dari papan. Periksa koneksi lalu coba lagi.',
  peringkatBatal: 'Batal',
  peringkatGantiNama: 'Ganti nama',
  peringkatTutup: 'Tutup',
  // Nama terminal (ui/popup-nama.ts).
  namaTombol: 'Ubah nama terminal',
  namaJudul: 'Nama terminalmu',
  namaTeks: 'Tampil di papan gapura terminal, tab Terminal, dan foto yang kamu bagikan. Kosongkan untuk memakai nama bawaan.',
  namaContoh: 'mis. Sukamaju',
  namaPratinjau: (nama: string, kelas: string) => (nama ? `TERMINAL ${nama.toUpperCase()} · ${kelas.toUpperCase()}` : `TERMINAL ${kelas.toUpperCase()}`),
  namaSimpan: 'Simpan',
  namaBatal: 'Batal',
  notifNama: (nama: string) => `🏷️ Selamat datang di Terminal ${nama}!`,
  // Kepuasan penumpang (pil HUD & popup).
  kepuasanHud: (wajah: string, persen: number) => `${wajah} ${persen}%`,
  kepuasanTombol: 'Kepuasan penumpang',
  kepuasanJudul: (persen: number) => `Kepuasan penumpang ${persen}%`,
  kepuasanTantangan: (ambang: number, ada: number, target: number) => `🎯 Tantangan: ≥ ${ambang}% · ${ada}/${target} menit main`,
  kepuasanPenumpang: (tambahan: number) => `Calon penumpang +${tambahan}% berkat kepuasan (dibanding kepuasan 0%)`,
  kepuasanKelancaran: 'Kelancaran',
  kepuasanKenyamanan: 'Kenyamanan',
  kepuasanKebersihan: 'Kebersihan',
  kepuasanKeamanan: 'Keamanan',
  kepuasanFasilitas: 'Fasilitas',
  kepuasanHarga: 'Harga',
  kepuasanSaranKelancaran: (area: string) => `Antrean panjang di ${area} saat jam sibuk: tambah kapasitasnya di tab Bangun.`,
  kepuasanSaranKenyamanan: (ada: number, perlu: number) => `Blok kursi ${ada} dari ${perlu} yang dibutuhkan penumpang yang menunggu.`,
  kepuasanSaranJadwal: 'Kursi sudah cukup. Papan jadwal digital (modernisasi) membuat penumpang lebih nyaman.',
  kepuasanSaranKebersihan: (ada: number, perlu: number) => `Petugas kebersihan ${ada} dari ${perlu} yang dibutuhkan; toilet butuh petugasnya.`,
  kepuasanSaranKeamanan: (ada: number, perlu: number) => `Satpam ${ada} dari ${perlu} (satu per jalur).`,
  kepuasanSaranFasilitas: (daftar: string) => `Belum ada: ${daftar}. Fasilitas yang ada juga perlu cukup untuk keramaiannya.`,
  kepuasanSaranFasilitasCukup: 'Tambah toilet, kios & toko, atau lahan parkir sesuai keramaian.',
  kepuasanSaranHarga: 'Turunkan tarif parkir di tab Terminal. Penumpang sendiri tidak membayar terminal.',
  kepuasanBaik: 'Sudah baik.',
  kepuasanCatatan:
    'Kepuasan dinilai dari jam sibuk. Makin puas, makin banyak calon penumpang datang dan reputasi semua PO naik. PO premium hanya mau bergabung & memperpanjang kontrak bila penumpangnya puas.',
  kepuasanTutup: 'Tutup',
  poSyaratKepuasan: (persen: number) => `Butuh kepuasan ${persen}%`,
  poSyaratTerminal: (kelas: string) => `Butuh Terminal ${kelas}`,
  // Tab Bangun.
  kapasitasJudul: 'Kapasitas jam sibuk (pnp/jam)',
  kapasitasRingkas: (arus: string, permintaan: string) => `Arus ${arus} dari ${permintaan} calon penumpang per jam`,
  kapasitasPasar: 'Semua calon penumpang terlayani: tambah jurusan lewat PO baru, naik kelas, atau jaga kepuasan supaya pasar membesar.',
  grupPeron: 'Peron & keberangkatan',
  grupLoket: 'Loket',
  grupRuangTunggu: 'Ruang tunggu & toko',
  grupFasilitas: 'Fasilitas',
  grupPangkalan: 'Pangkalan bus',
  grupModern: 'Modernisasi',
  bangunanJumlah: (jumlah: number, slot: number) => `${jumlah}/${slot}`,
  slotPenuh: 'Slot penuh',
  slotPenuhPerluasan: (tahap: number) => `Slot penuh: bertambah di Perluasan ${tahap}`,
  slotPenuhLevel: (level: number) => `Slot penuh: +1 di Lv ${level}`,
  perawatanPerHari: (rp: string) => `Perawatan ${rp}/hari`,
  bongkar: (rp: string) => `Bongkar · +${rp}`,
  bongkarYakin: 'Yakin bongkar?',
  bangunanCatatan: (persen: number) =>
    `Bongkar mengembalikan ${persen}% harga unit; jalur permanen, dan hanya jendela loket kosong yang bisa dibongkar. Perawatan dibayar tiap hari selama unit berdiri.`,
  jendelaKosong: (n: number) => `${n} jendela kosong`,
  petakBus: (petak: number, kapasitas: string) => `${petak} petak parkir bus · ${kapasitas} pnp/jam`,
  petakBusKet: 'Bus parkir, dicuci, & menunggu jadwal. Bertambah lewat perluasan terminal.',
  perawatanTotal: (rp: string) => `Perawatan semua unit ${rp}/hari`,
  // Tambah lantai (documents/18; rancangan docs/design/20261105-tambah-lantai bagian 4.5). Persen tanpa spasi seperti teks game lain.
  judulLantai: (n: number, nama: string) => `Lantai ${n} · ${nama}`,
  petugasLantai: (n: number, peran: string, gaji: string) => `Ikut direkrut: ${n} ${peran} (${gaji}/hari)`,
  pratinjauKomponen: (komponen: string, dari: number, ke: number) => `${komponen} ${dari} → ${ke}%`,
  pratinjauParkir: (rp: string) => `Parkir ${rp}/hari`,
  biayaLantai: (rp: string) => `Operasional ${rp}/hari`,
  tombolLantai: 'Tambah lantai',
  /** Tombol lantai redup: baris kecil di atas kekurangan kas ("Kurang / Rp 120 jt"). */
  lantaiKurang: 'Kurang',
  lantaiTerkunci: (level: number) => `🔒 Terbuka di Lv ${level}`,
  lantaiSelesai: (n: number) => `✓ ${n} lantai`,
  lantaiSelesaiBerikut: (n: number, berikut: number, level: number) => `✓ ${n} lantai · lantai ${berikut} di Lv ${level}`,
  /** Seperti kartu perluasan: sisa kas sesudah membeli kurang dari biaya operasi sehari. */
  /** Kas sesudah membeli di bawah cadangan B (aturan aman baris tujuan; temuan playtest T-1). */
  lantaiPeringatanKas: (rp: string) => `⚠️ Kas tinggal ${rp} sesudahnya`,
  /** Ketukan pertama saat kas tidak aman: tombol menunggu ketukan kedua (pola tombol Bongkar). */
  lantaiKonfirmasi: (rp: string) => `⚠️ Kas tinggal ${rp}: gaji bisa tak terbayar, petugas berhenti. Ketuk lagi untuk membeli.`,
  lantaiKetukLagi: 'Ketuk lagi',
  slotPenuhLantai: (nama: string) => `Slot penuh: tambah lantai ${nama}`,
  slotPenuhLantaiLevel: (n: number, nama: string, level: number) => `Slot penuh: lantai ${n} ${nama} di Lv ${level}`,
  lihatLantai: '👁 Lihat',
  lihatLantaiLabel: (nama: string) => `Lihat lantai ${nama}`,
  chipLantai: (n: number, nama: string) => `Lantai ${n} · ${nama}`,
  chipLantaiTurun: 'Lantai di bawahnya',
  chipLantaiNaik: 'Lantai di atasnya',
  chipLantaiKeluar: 'Keluar dari tampilan lantai',
  // Tab Petugas.
  petugasRingkas: (n: number, gaji: string) => `${n} petugas · gaji ${gaji}/hari`,
  petugasGaji: (rp: string) => `Gaji ${rp}/hari`,
  petugasPerlu: (n: number) => `dibutuhkan ±${n}`,
  petugasCatatan:
    'Rekrut & berhentikan tanpa biaya sekali bayar; gajinya dibayar tiap hari dari kas. Bila kas habis, petugas yang terakhir direkrut berhenti lebih dulu. Petugas jendela loket adalah pegawai PO.',
  rekrut: (nama: string) => `Rekrut ${nama}`,
  berhentikan: (nama: string) => `Berhentikan ${nama}`,
  // Tab PO: mitra PO terdaftar & PO yang bisa didaftarkan.
  poRingkas: (n: number, slot: number) => `Slot PO terisi ${n}/${slot}`,
  poSlotBerikut: (slot: number, level: number) => `slot ke-${slot} di Terminal Lv ${level}`,
  jendelaKosongJudul: (n: number) => `${n} jendela loket kosong`,
  jendelaKosongKet: 'Tidak disewa PO: tidak melayani penumpang, tetap dirawat',
  sewakan: 'Sewakan',
  gratis: 'Gratis',
  poTingkatAsal: (tingkat: string, asal: string) => `${tingkat} · ${asal}`,
  poReputasi: (n: number) => `Reputasi ${n}`,
  poXp: (ada: string, perlu: string, level: number) => `${ada} / ${perlu} bus ke Lv ${level}`,
  poJendela: (n: number) => `Jendela loket ${n}`,
  poJendelaKet: (kapasitas: string, permintaan: string) => `Kapasitas ${kapasitas} pnp/jam · peminat jam sibuk ${permintaan}`,
  tambahJendela: '+ Jendela',
  poKepuasanMitra: (persen: number) => `Kepuasan mitra ${persen}%`,
  poBagian: (persen: number, arus: string) => `${persen}% penumpang · ${arus} pnp/jam`,
  poKelas: (daftar: string) => `Kelas ${daftar}`,
  poKelasBerikut: (nama: string, level: number) => `${nama} di Lv ${level}`,
  poKelasButuhTerminal: (nama: string, kelas: string) => `${nama} butuh Terminal ${kelas}`,
  poHargaJudul: 'Harga tiket Ekonomi (ditetapkan PO)',
  poJurusanLevel: (level: number) => `Terbuka di PO Lv ${level}`,
  poKontrak: (hari: string) => `Kontrak tersisa ${hari} hari`,
  poTawaranBelum: (hari: number, tawaran: number) => `PO menawarkan perpanjangan ${tawaran} hari saat sisa kontrak ≤ ${hari} hari`,
  poPerpanjangHari: (hari: number) => `Perpanjang ${hari} hari`,
  kontrakHari: (hari: number) => `Kontrak ${hari} hari`,
  uangMasuk: (nilai: string) => `+${nilai}`,
  poMenolak: (persen: number) => `Menolak perpanjang: butuh kepuasan penumpang ${persen}%`,
  poMenolakMitra: (persen: number) => `Menolak perpanjang: kepuasan mitra di bawah ${persen}%. Turunkan sewa loket atau retribusi`,
  perpanjang: 'Perpanjang',
  putus: 'Putus',
  putusYakin: 'Yakin putus?',
  putusCatatan: (kembali: string, reputasi: number, hari: number) =>
    `Putus kontrak: sisa nilai kontraknya (${kembali}) dikembalikan ke PO, jendela loketnya jadi kosong, reputasinya −${reputasi}, dan baru mau didaftarkan lagi ${hari} hari kemudian.`,
  putusKurangKas: (kembali: string) => `Kas belum cukup untuk mengembalikan sisa nilai kontrak (${kembali}).`,
  judulPoTersedia: 'Daftarkan PO',
  poJurusanDaftar: (daftar: string) => `Jurusan ${daftar}`,
  poSlotPenuh: 'Slot PO penuh: naikkan level terminal',
  // Slot jendela penuh (playtest P-4): sasaran dari ModelBangunan.slotBerikut jendela (teksJendelaPenuh).
  poJendelaPenuh: 'Jendela penuh',
  poJendelaPenuhLevel: (level: number) => `Jendela penuh · +1 di Lv ${level}`,
  poJendelaPenuhPerluasan: (tahap: number) => `Jendela penuh · Perluasan ${tahap}`,
  poMenolakBergabung: (persen: number) => `Menolak bergabung (kepuasan mitra ±${persen}%): turunkan sewa loket atau retribusi`,
  poJeda: (hari: string) => `Baru bisa didaftarkan lagi dalam ${hari} hari`,
  poRiwayat: (level: number) => `Pernah bergabung, lanjut dari Lv ${level}`,
  poHadiahKelas: (kelas: string) => `Hadiah Terminal ${kelas}`,
  poCatatan:
    'Tiap PO punya jendela loket, jurusan, kelas bus, dan reputasinya sendiri, dan menjual tiketnya sendiri (uang tiket untuk PO). Terminal menerima kontrak PO (dibayar di muka saat bergabung & tiap perpanjangan; panjangnya ditawarkan PO, nilainya naik dengan tingkat & level PO serta kelas terminal), sewa jendela, dan retribusi bus. Jumlah PO dibatasi slot yang bertambah seiring level terminal. Bus yang berangkat menaikkan level PO: jurusan & kelas busnya bertambah. Manajer Kemitraan menyewakan jendela kosong dan memperpanjang kontrak otomatis. Hadiah armada (target, tantangan, Bus Emas) menaikkan level PO berlevel terendah.',
  // Tab Terminal: level & kelas, perluasan, tarif, laporan keuangan, kelas bus.
  terminalXp: (ada: string, perlu: string) => `${ada} / ${perlu} penumpang`,
  terminalKelasBerikut: (kelas: string, level: number) => `Naik ke ${kelas} di Lv ${level}`,
  terminalSlot: (slot: number) => `${slot} slot PO`,
  // Izin level (documents/15 bagian 3.5): slot tambahan dari naik level.
  izinJendela: (n: number) => `slot jendela loket +${n}`,
  izinJalur: (n: number) => `slot jalur +${n}`,
  izinSlotPo: (ke: number) => `slot PO ke-${ke}`,
  izinBerikut: (level: number, izin: string) => `Lv ${level} ${izin}`,
  terminalIzinBerikut: (daftar: string) => `Izin berikutnya: ${daftar}`,
  offlineIzin: (daftar: string) => `🎫 Izin baru: ${daftar}`,
  offlineIzinJendela: (n: number) => `jendela +${n}`,
  offlineIzinJalur: (n: number) => `jalur +${n}`,
  terminalCatatan: 'Level terminal naik dari penumpang yang diberangkatkan. Kelas terminal ikut level dan tidak pernah turun; terminal yang lebih besar menarik lebih banyak penumpang, tapi gaji & perawatannya ikut naik.',
  perluasanJudul: 'Perluasan terminal',
  perluasanTahap: (tahap: number, jumlah: number, nama: string) => `Tahap ${tahap}/${jumlah}: ${nama}`,
  perluasanOperasional: (rp: string) => `operasional gedung ${rp}/hari`,
  perluasanSyarat: (level: number) => `Butuh Terminal Lv ${level}`,
  perluasanProyek: (sisa: string) => `Sedang dibangun · selesai dalam ${sisa}`,
  percepatTombol: (menit: number) => `▶ Percepat ${menit} menit`,
  percepatCatatan: 'iklan · maks. 2× per proyek',
  perluasanSelesai: 'Semua tahap perluasan sudah dibangun',
  perluasanCatatan: 'Pembangunan butuh sehari terminal dan tetap berjalan saat game ditutup. Tiap tahap menambah slot bangunan.',
  tarifJudul: 'Tarif terminal',
  tarifSaran: 'Saran',
  tarifTurun: (nama: string) => `Turunkan ${nama}`,
  tarifNaik: (nama: string) => `Naikkan ${nama}`,
  tarifPer: (per: string) => `per ${per}`,
  tarifBawaan: (nilai: string) => `bawaan ${nilai}`,
  popTiket: (n: number) => `+${n} tiket`,
  tarifCatatan:
    'Penumpang tidak membayar terminal: tiket dibeli dari PO, toilet & musholla gratis. Tarif lebih tinggi menambah pendapatan, tapi menurunkan pengantar yang parkir, okupansi kios, atau kepuasan mitra PO. Saran = tarif yang paling menguntungkan sehari, dengan mitra PO tetap mau memperpanjang kontrak.',
  keuanganJudul: 'Laporan keuangan',
  keuanganHariIni: (hari: string) => `Hari ini · ${hari}`,
  keuanganKemarin: (hari: string) => `Kemarin · ${hari}`,
  keuanganPendapatan: 'Pendapatan',
  keuanganBiaya: 'Biaya',
  keuanganLaba: 'Laba bersih',
  keuanganPenumpang: (n: string) => `${n} penumpang`,
  keuanganRata: (laba: string) => `Rata-rata sehari dengan tarif sekarang: laba ${laba}`,
  keuanganKas: (kas: string) => `Kas ${kas}`,
  judulKelasBus: 'Kelas bus',
  kelasBusBeroperasi: 'Beroperasi',
  /** @param tingkat tingkat PO paling rendah; null bila semua tingkat boleh. */
  kelasBusSyarat: (tingkat: string | null, level: number) => (tingkat ? `Butuh PO ${tingkat} ke atas, Lv ${level}` : `Butuh PO Lv ${level}`),
  kelasBusCatatan: 'Kelas bus terbuka seiring level PO, sampai batas tingkat PO-nya. Kelas yang lebih tinggi menaikkan harga tiket PO serta reputasinya.',
  // Mode sinema (ui/sinema.ts).
  sinemaTombol: 'Mode sinema: rekam video timelapse',
  sinemaJudul: 'Mode sinema',
  sinemaTeks: 'Semua tampilan disembunyikan, kamera berputar pelan, dan waktu dipercepat. Rekam dengan perekam layar HP untuk TikTok atau Reels.',
  sinemaWaktu: 'Waktu',
  sinemaCuaca: 'Cuaca',
  sinemaPilihanWaktu: { cepat: '1 hari ≈ 1 menit', sedang: '1 hari ≈ 3 menit', asli: 'Asli' },
  sinemaPilihanCuaca: { jadwal: 'Sesuai jadwal', cerah: 'Cerah', hujan: 'Hujan' },
  sinemaMulai: 'Mulai',
  sinemaBatal: 'Batal',
  sinemaCatatan: 'Ketuk layar untuk keluar. Terminal tetap berjalan & menghasilkan uang seperti biasa.',
  sinemaPetunjuk: 'Ketuk layar untuk keluar',
  sinemaSitus: 'bustation.games',
  // Rute antarpulau (tab PO).
  lewatFeri: (feri: string) => `⛴ ${feri}`,
  notifAntarpulau: (kota: string, po: string) => `⛴ Rute antarpulau ${kota} dibuka oleh ${po}!`,
  poSyaratEvent: (event: string) => `Hadiah akhir event ${event}`,
  // Event musiman (kartu di tab Target).
  eventJudul: (nama: string, tahun: string) => `${nama}${tahun ? ` ${tahun}` : ''}`,
  eventSisa: (waktu: string) => `berakhir dalam ${waktu}`,
  eventBerakhir: 'sudah berakhir',
  eventTugas: (target: string, tahap: number, jumlah: number) => `Berangkatkan ${target} penumpang (tahap ${tahap}/${jumlah})`,
  eventTuntas: 'Semua tahap selesai. Sampai jumpa di event berikutnya!',
  eventKeterangan: (pengali: string, po: string, poSudah: boolean) => `Calon penumpang ×${pengali} selama event · ${poSudah ? `${po} bisa didaftarkan gratis` : `hadiah akhir: ${po}`}`,
  hudEvent: (singkat: string, pengali: string) => `${singkat} ×${pengali}`,
  notifEventMulai: (ikon: string, nama: string, pengali: string) => `${ikon} ${nama} dimulai! Calon penumpang ×${pengali}`,
  notifEventTahap: '🎁 Tahap event selesai! Klaim di tab Target',
  // Kartu level & kelas terminal (tab Terminal).
  kelasJudul: (kelas: string, nama = '') => (nama ? `Terminal ${nama} · ${kelas}` : `Terminal ${kelas}`),
  hudKelas: (kelas: string, level: number) => `${kelas} · Lv ${level}`,
  // Notifikasi mitra PO, level terminal, perluasan, kas.
  notifNaikKelas: (kelas: string) => `⭐ Selamat! Terminal naik ke ${kelas}`,
  notifLevelTerminal: (level: number) => `🏢 Terminal naik ke Lv ${level}`,
  notifLevelTerminalIzin: (level: number, izin: string) => `🏢 Terminal naik ke Lv ${level}: ${izin}`,
  /** Lantai terbuka saat naik level: satu toast gabungan dengan naik level (rancangan 4.4). */
  notifLantaiTerbukaLevel: (level: number, n: number, nama: string) => `🏢 Lv ${level}: lantai ${n} ${nama} bisa dibangun`,
  /** Lantai terbuka tetapi kas belum aman untuk membelinya (aturan aman baris tujuan; temuan playtest T-1): tanpa ajakan. */
  notifLantaiTerbukaTabung: (level: number, n: number, nama: string) => `🏢 Lv ${level}: lantai ${n} ${nama} terbuka · kumpulkan kas dulu`,
  notifLantaiDibeli: (nama: string, n: number, isi: string) => `🏢 ${nama} kini ${n} lantai: ${isi}`,
  notifSlotBaru: (slot: number) => `🅿️ Slot PO ke-${slot} terbuka! Daftarkan PO di tab PO`,
  /** Slot jendela penuh (playtest P-4, teksSlotTanpaJendela); `sampai`: "Lv 18" atau "Perluasan 3". */
  notifSlotTanpaJendela: (slot: number) => `🅿️ Slot PO ke-${slot} terbuka: jendela loket penuh`,
  notifSlotTanpaJendelaSampai: (slot: number, sampai: string) => `🅿️ Slot PO ke-${slot} terbuka: jendela loket penuh sampai ${sampai}`,
  notifPo: (nama: string) => `🚌 ${nama} bergabung & membayar kontraknya!`,
  /** `baru`: kelas bus & jurusan yang terbuka di level ini (kosong = tidak ada). */
  notifPoLevel: (nama: string, level: number, baru = '') => `⬆️ ${nama} naik ke Lv ${level}${baru ? `: ${baru}` : ''}`,
  notifArmada: (nama: string, dari: number, ke: number, level: number) => `🚌 Armada baru ${nama}: ${dari}% → ${ke}% menuju Lv ${level}`,
  poBaruKelas: (nama: string) => `kelas ${nama}`,
  poBaruJurusan: (nama: string) => `jurusan ${nama}`,
  notifPoKeluar: (nama: string) => `📄 Kontrak ${nama} habis: PO keluar dan jendela loketnya kosong`,
  notifKontrakHampir: (nama: string) => `📄 Kontrak ${nama} tinggal sehari. Terima tawaran perpanjangannya di tab PO`,
  notifKelasBus: (nama: string) => `🚌 Bus ${nama} mulai beroperasi!`,
  notifPerluasan: (tahap: number, nama: string) => `🏗️ Perluasan ${tahap} selesai: ${nama}!`,
  /** Peresmian susulan untuk pemain lama (documents/16 bagian 7, playtest P-1); nama gedung = NAMA_PERLUASAN[2]. */
  notifPeresmianBentuk: '🎉 Perluasan 3 kini punya gedung: Sayap\u00a02\u00a0lantai!',
  notifPerluasanTerbuka: (tahap: number, efek: string) => `🏗️ Perluasan ${tahap} terbuka: ${efek}. Bangun di tab Terminal`,
  notifPerluasanMulai: (tahap: number) => `🏗️ Perluasan ${tahap} dimulai! Selesai dalam sehari terminal, juga saat game ditutup`,
  notifJalur: (n: number) => `🚧 Jalur ${n} dibuka! Lebih banyak bus bisa singgah sekaligus`,
  notifKasMenipis: '⚠️ Kas menipis: operasi terminal merugi. Kurangi petugas atau ubah tarif',
  notifPetugasBerhenti: '⚠️ Kas habis: seorang petugas berhenti karena gajinya tak terbayar',
  // Foto terminal.
  fotoTombol: 'Foto terminal',
  fotoJudul: 'Foto terminal',
  fotoAlt: 'Foto terminal busmu',
  fotoBagikan: 'Bagikan',
  fotoSimpan: 'Simpan gambar',
  fotoTutup: 'Tutup',
  fotoTersimpan: 'Gambar disimpan ke folder unduhan.',
  fotoGagalBagikan: 'Gagal membagikan. Coba simpan gambarnya.',
  fotoKeterangan: (kelas: string, jurusan: number, arus: string, po: number, nama = '') =>
    `${nama ? `Terminal ${nama} · ${kelas}` : `Terminal ${kelas}`} · ${jurusan} jurusan · ${arus} pnp/jam${po > 0 ? ` · ${po} PO` : ''}`,
  fotoAjakan: 'Main gratis di bustation.games',
  fotoTeksBagikan: 'Lihat terminal busku di Bustation! Main gratis di https://bustation.games',
  /** Label di atas bus yang diketuk (klakson telolet). */
  telolet: 'TELOLET!',
  tutorialSelesaiJudul: 'Terminalmu sudah berjalan!',
  tutorialSelesai: 'Baris di bawah kas selalu menunjukkan langkah berikutnya. Ketuk untuk menuju ke sana. Tips: ketuk bus untuk klakson telolet!',
  offlineJudul: 'Selama kamu pergi…',
  offlineDurasi: (durasi: string, dibatasi: boolean) => (dibatasi ? `Terminal beroperasi ${durasi} (batas maksimal)` : `Terminal beroperasi ${durasi}`),
  /** Tanpa Manajer Operasional terminal tutup, jadi yang dilaporkan lamanya pemain pergi. */
  offlinePergi: (durasi: string, dibatasi: boolean) => (dibatasi ? `Kamu pergi ${durasi} (batas maksimal)` : `Kamu pergi ${durasi}`),
  /** Menyebut gedungnya (NAMA_PERLUASAN, playtest P-2); `nama` kosong = tanpa nama. */
  offlineProyekSelesai: (tahap: number, nama: string) => `🏗️ Perluasan ${tahap} selesai selama kamu pergi${nama ? `: ${nama}` : ''}!`,
  offlineProyekSisa: (tahap: number, durasi: string) => `🏗️ Perluasan ${tahap} tetap dibangun · selesai dalam ${durasi}`,
  offlineRincian: (pendapatan: string, biaya: string) => `Pendapatan ${pendapatan} · biaya ${biaya}`,
  offlineCatatan: (persen: number, batas: string) => `Manajer Operasional menjalankan terminal: pendapatan ${persen}%, biaya penuh · maksimal ${batas}`,
  offlineTutup: 'Terminal tutup selama kamu pergi. Rekrut Manajer Operasional di tab Petugas supaya terminal tetap berjalan.',
  /** Tanpa Manajer, dan Manajer belum untung saat pemain pergi: tidak menyarankannya. */
  offlineTutupBelumUntung: 'Terminal tutup selama kamu pergi: tanpa pendapatan, tanpa biaya.',
  offlineBerhenti: (n: number) => `${n} petugas berhenti karena kas habis`,
  offlineAmbil: 'Ambil',
  /** Tombol popup offline saat tidak ada laba untuk diambil (laba ≤ 0 atau terminal tutup). */
  offlineOke: 'Oke',
  kecepatan: (k: number) => `Kecepatan waktu ${k}× (tombol ${k})`,
  tabBangun: 'Bangun',
  tabPetugas: 'Petugas',
  tabPo: 'PO',
  tabTerminal: 'Terminal',
  tabTarget: 'Target',
  bangun: 'Bangun',
  pasang: 'Pasang',
  diklaim: '✓ Diklaim',
  klaim: 'Klaim',
  butuh: (nama: string) => `Butuh: ${nama}`,
  kapasitasPersen: (persen: number, tahap: string) => `+${persen}% kapasitas ${tahap}`,
  targetPenumpang: (n: string) => `Berangkatkan ${n} penumpang`,
  targetLaba: (rp: string) => `Raih laba bersih ${rp} hari ini`,
  targetHari: (hari: string) => `Target hari ${hari}`,
  // Paket hadiah (documents/15 bagian 4.4): PO sasaran armada ditulis sebelum diklaim.
  /** `level`: dari teksBagianLevel ("1", "½", "¼", "75%"). */
  hadiahArmada: (po: string, level: string) => `🚌 ${po} +${level} level`,
  hadiahPercepat: (menit: number) => `🏗️ −${menit} mnt`,
  targetHadiah: (paket: string) => `Hadiah: ${paket}`,
  tantanganHadiah: (paket: string) => `Hadiah tiap tantangan: ${paket}`,
  penghargaan: 'Penghargaan',
  notifPencapaian: (nama: string) => `🏆 Penghargaan baru: ${nama}`,
  notifTarget: '🎯 Target harian selesai! Klaim di tab Target',
  panelRingkas: 'Ringkas',
  panelBuka: 'Buka panel',
  panelPenuh: 'Layar penuh',
  panelKecilkan: 'Kecilkan panel',
  putarKiri: 'Putar kiri (Q)',
  putarKanan: 'Putar kanan (E)',
  arahAwal: 'Kompas: ketuk untuk kembali ke arah awal',
  suaraNyala: 'Suara nyala (ketuk untuk mematikan)',
  suaraMati: 'Suara mati (ketuk untuk menyalakan)',
  grafisGagal: 'Grafis 3D tidak didukung di perangkat ini. Game tetap berjalan.',
  pembaruanJudul: 'Versi baru tersedia',
  pembaruanJudulWajib: 'Pembaruan diperlukan',
  pembaruanYangBaru: 'Yang baru:',
  pembaruanCatatan: 'Progres kamu disimpan dulu, lalu game dimuat ulang beberapa detik.',
  pembaruanCatatanWajib: 'Versi ini sudah tidak didukung. Progres kamu disimpan dulu, lalu game dimuat ulang.',
  pembaruanPerbarui: 'Perbarui sekarang',
  pembaruanMemperbarui: 'Memperbarui…',
  pembaruanNanti: 'Nanti',
  pembaruanTombol: 'Versi baru tersedia: ketuk untuk memperbarui',
  akunTombol: 'Akun & simpan di cloud',
  akunJudulTamu: 'Simpan progres di cloud',
  akunPenjelasanTamu: 'Masuk dengan Google supaya progres aman dan bisa dilanjutkan di perangkat lain.',
  akunMasuk: 'Masuk dengan Google',
  akunMasukLagi: 'Masuk lagi',
  akunMemuat: 'Memuat…',
  akunMemproses: 'Memproses…',
  akunJudul: 'Akun',
  akunTersinkron: 'Progres tersimpan di cloud.',
  akunMenyinkronkan: 'Menyimpan ke cloud…',
  akunBelumTersinkron: 'Sebagian progres belum tersimpan di cloud. Dicoba lagi otomatis saat ada internet.',
  akunSesiBerakhir: 'Sesi login berakhir. Masuk lagi supaya progres kembali tersimpan di cloud.',
  akunKeluar: 'Keluar',
  akunHapus: 'Hapus akun',
  akunPrivasi: 'Kebijakan Privasi',
  akunSetujuPrivasi: 'Dengan masuk, kamu menyetujui ',
  akunTutup: 'Tutup',
  akunBatal: 'Batal',
  akunJudulKeluar: 'Keluar dari akun?',
  akunTeksKeluar: 'Progres tetap tersimpan di akun. Di perangkat ini kamu mulai sebagai tamu baru sampai masuk lagi.',
  akunYaKeluar: 'Ya, keluar',
  akunJudulHapus: 'Hapus akun?',
  akunTeksHapus: 'Progres di cloud dan di perangkat ini dihapus permanen, lalu kamu mulai dari awal. Untuk konfirmasi, pilih akun Google-mu sekali lagi.',
  akunYaHapus: 'Hapus permanen',
  akunGagalMuat: 'Layanan akun tidak bisa dimuat. Periksa koneksi internet lalu coba lagi.',
  akunGagalMasuk: 'Gagal masuk. Periksa koneksi internet lalu coba lagi.',
  akunPopupDiblokir: 'Jendela login diblokir browser. Izinkan pop-up untuk situs ini lalu coba lagi.',
  akunGagalKeluar: 'Gagal keluar. Coba lagi.',
  akunGagalHapus: 'Gagal menghapus akun. Periksa koneksi internet lalu coba lagi.',
  akunMuatUlang: 'Game dimuat ulang…',
  pilihSaveJudul: 'Pilih progres',
  pilihSaveTeksMasuk: 'Perangkat ini dan akun Google-mu punya progres berbeda. Mau lanjut yang mana?',
  pilihSaveTeksSinkron: 'Akun ini dimainkan di perangkat lain, sementara progres di sini belum tersimpan ke cloud. Mau lanjut yang mana?',
  pilihSaveLokal: 'Perangkat ini',
  pilihSaveAkun: 'Akun Google',
  pilihSaveLain: 'Perangkat lain',
  pilihSavePendapatan: (uang: string) => `Total pendapatan ${uang}`,
  pilihSaveTerminal: (kelas: string, level: string) => `Terminal ${kelas} · Lv ${level}`,
  pilihSaveTerakhir: (durasi: string) => `Terakhir main ${durasi} lalu`,
  pilihSaveBaruSaja: 'Terakhir main barusan',
  pilihSavePakai: 'Lanjutkan ini',
  pilihSaveCatatan: 'Progres yang tidak dipilih akan diganti.',
  notifSaveDiganti: 'Progres dari perangkat lain dimuat',
  iklanContohLabel: 'IKLAN CONTOH',
  iklanContohIsi: 'Di sini nanti iklan sungguhan diputar. Tunggu sampai selesai untuk mendapat hadiah.',
  iklanTunggu: (detik: number) => `Hadiah dalam ${detik} dtk…`,
  iklanAmbil: 'Ambil hadiah',
  iklanLewati: 'Lewati (tanpa hadiah)',
  iklanTanpaHadiah: 'Iklan dilewati, jadi tidak ada hadiah. Coba lagi kapan saja.',
  iklanGagal: 'Iklan belum tersedia. Coba lagi nanti.',
  hadiahNanti: 'Nanti',
  klaimGanda: '2×',
  /** Tombol 2× target bila paketnya berisi armada/percepat (labelGandaTarget): seluruh paket digandakan. */
  klaimGandaPaket: '2× semua',
  offlineAmbilGanda: (uang: string) => `Ambil 2× · ${uang}`,
  offlineBoost: (durasi: string) => `Termasuk boost 2× selama ${durasi}`,
  boostHud: ' ⚡2×',
  boostTombol: 'Boost pendapatan 2× (tonton iklan)',
  boostTombolAktif: (sisa: string) => `Boost pendapatan 2× aktif, sisa ${sisa}`,
  boostJudul: 'Boost Pendapatan',
  boostTeks: (menit: number, jamMaks: number) => `Pendapatan 2× selama ${menit} menit waktu main. Bisa ditumpuk sampai ${jamMaks} jam, dan tetap berjalan saat game ditutup.`,
  boostHadiah: (menit: number) => `+${menit} menit`,
  boostSisa: (durasi: string) => `Boost aktif, sisa ${durasi}`,
  boostTonton: 'Tonton iklan',
  boostPenuh: (jam: number) => `Boost sudah penuh (${jam} jam)`,
  notifBoost: (durasi: string) => `⚡ Boost 2× aktif · sisa ${durasi}`,
  busEmasPenanda: 'Bus Emas!',
  busEmasJudul: 'Bus Emas tiba!',
  /** `level`: dari teksBagianLevel ("¼"). */
  busEmasTeks: (uang: string, po: string, level: string) => `Bus istimewa membawa rombongan. Tonton iklan untuk ${uang} dan armada baru ${po} (+${level} level).`,
  busEmasTeksUang: (uang: string) => `Bus istimewa membawa rombongan. Tonton iklan untuk ${uang}.`,
  busEmasTonton: 'Tonton iklan & ambil',
  notifBusEmas: (uang: string) => `🚌 Bus Emas: +${uang}`,
  // Musim Terminal (documents/17 bagian 8): ≤ 40 karakter per baris di kartu, ≤ 60 di baris tujuan.
  musimKepala: (ikon: string, nama: string, tingkat: number, sisa: number) => `${ikon} ${nama} · tingkat ${tingkat} · sisa ${sisa} hari`,
  musimBilah: (poin: string, batas: string) => `${poin}/${batas} poin`,
  musimPoin: (poin: string) => `${poin} poin`,
  musimBerikut: (tingkat: number, hadiah: string) => `Berikutnya: tingkat ${tingkat} · ${hadiah}`,
  musimIstimewa: (nama: string) => `Rapor ${nama}: Istimewa! Tugas tetap menambah nilai rapor.`,
  musimTugasHariIni: (selesai: number, jumlah: number) => `Tugas hari ini ${selesai}/${jumlah}`,
  musimTugasKemarin: 'Tugas kemarin · berakhir 24.00',
  musimSemuaSelesai: 'Tugas baru besok 00.00 WIB',
  musimGanti: 'Ganti',
  musimGantiTiket: 'Ganti · 1 tiket',
  musimGantiJudul: (cara: string) => `Ganti tugas ini (${cara})`,
  musimGantiGratis: 'gratis hari ini',
  musimGantiPakaiTiket: (n: number) => `pakai 1 dari ${n} tiket`,
  musimTuas: 'Buka tempat mengerjakannya',
  musimTiket: (n: number) => `Tiket ganti tugas: ${n}`,
  musimCatatan: 'Tugas berlaku 2 hari. Tugas +10 poin, tantangan mingguan +40. Tugas hanya maju saat kamu bermain.',
  musimHiasanJudul: 'Hiasan terminal',
  musimHiasanBaris: (slot: string, varian: string) => `${slot}: ${varian}`,
  musimPakai: 'Pakai',
  musimLepas: 'Lepas',
  musimSurat: (n: number) => `Surat Armada (${n})`,
  musimSuratKet: 'PO pilihanmu mendapat armada baru (+½ level)',
  musimSuratPakai: 'Pakai',
  musimSuratJudul: 'Surat Armada',
  musimSuratPilih: 'Pilih PO yang mendapat armada baru (+½ level)',
  // Satu baris di popup untuk level dua digit (GP-1): nama PO tanpa awalan "PO".
  musimSuratBaris: (po: string, level: number, sesudah: string) => `${po} · Lv ${level} → ${sesudah}`,
  musimSuratMenuju: (persen: number, level: number) => `${persen}% ke Lv ${level}`,
  musimSuratLevel: (level: number) => `Lv ${level}`,
  musimSuratBatal: 'Nanti',
  notifSurat: (po: string) => `✉️ Surat Armada dipakai: armada baru untuk ${po}`,
  notifTugasSelesai: '📋 Tugas selesai · +10 poin Rapor',
  notifRaporNaik: (tingkat: number, hadiah: string) => `🎓 Rapor naik ke tingkat ${tingkat}: ${hadiah}`,
  notifRaporNaikPolos: (tingkat: number) => `🎓 Rapor naik ke tingkat ${tingkat}`,
  hiasanTerpasang: (nama: string) => `${nama} terpasang`,
  notifMusimSelesai: (ikon: string, nama: string) => `${ikon} ${nama} selesai`,
  tujuanTugas: (tugas: string, angka: string) => `📋 Tugas: ${tugas} · ${angka}`,
  sambutanMusimJudul: (ikon: string) => `${ikon} Musim Terminal dimulai!`,
  sambutanMusimIsi: (nama: string) => `Tiap hari ada 3 tugas singkat. Selesaikan untuk menaikkan Rapor ${nama} dan membuka hiasan terminal. Gratis, tanpa iklan. Tugas berlaku 2 hari.`,
  sambutanMusimLihat: 'Lihat tugas',
  sambutanMusimNanti: 'Nanti',
  raporJudul: (nama: string) => `🎓 Rapor ${nama}`,
  // Nilai (besar) dan tingkat (kecil) dua baris; terminal dan penumpang main aktif dua baris (P-12).
  raporTingkat: (tingkat: number, maks: number) => `tingkat ${tingkat} dari ${maks}`,
  raporTugas: (tugas: number, tantangan: number) => `Tugas selesai ${tugas} · tantangan ${tantangan}`,
  raporTerminal: (lvAwal: number, lvAkhir: number) => `Terminal: Lv ${lvAwal} → Lv ${lvAkhir}`,
  raporPenumpang: (penumpang: string) => `Penumpang saat kamu bermain: ${penumpang}`,
  raporHiasan: (daftar: string) => `Hiasan baru: ${daftar}`,
  raporMusimBaru: (ikon: string, nama: string) => `${ikon} ${nama} dimulai hari ini.`,
  raporOke: 'Oke',
  fotoMusim: (musim: string, lencana: string) => `${musim} · ${lencana}`,
} as const;

// ---------------------------------------------------------------------------
// Musim Terminal (documents/17)

/** Tema musim: nama (tanpa tahun) & ikon (bagian 3.1). */
export const NAMA_TEMA_MUSIM: Readonly<Record<TemaMusimId, { readonly nama: string; readonly ikon: string }>> = {
  hujan: { nama: 'Musim Hujan', ikon: '🌧️' },
  imlek: { nama: 'Musim Imlek', ikon: '🧧' },
  mudik: { nama: 'Musim Mudik', ikon: '🕌' },
};

/** Nama musim dengan tahun awalnya: rapor, lencana, foto ("Musim Hujan 2026"). */
export function namaMusimTahun(tema: TemaMusimId, tahun: number): string {
  return `${NAMA_TEMA_MUSIM[tema].nama} ${tahun}`;
}

export const NAMA_SLOT_HIASAN: Readonly<Record<SlotHiasan, string>> = {
  spanduk: 'Spanduk gapura',
  seragam: 'Seragam petugas',
  papan: 'Papan gapura',
  bingkai: 'Bingkai foto',
};

/** Nama pendek slot untuk daftar "Hiasan baru: spanduk, seragam, papan gapura". */
const NAMA_PENDEK_SLOT: Readonly<Record<SlotHiasan, string>> = { spanduk: 'spanduk', seragam: 'seragam', papan: 'papan gapura', bingkai: 'bingkai foto' };

/** Nama hiasan dari tabel bagian 4.1; tema lain memakai nama slot + tema. */
const NAMA_HIASAN_KHUSUS: Readonly<Record<string, string>> = {
  'spanduk-hujan': 'Spanduk gapura Musim Hujan',
  'seragam-hujan': 'Seragam jas hujan',
  'papan-hujan': 'Papan gapura biru hujan',
  'bingkai-hujan': 'Bingkai foto Musim Hujan',
  [BINGKAI_EMAS]: 'Bingkai foto emas',
};

export function namaHiasan(item: string): string {
  const khusus = NAMA_HIASAN_KHUSUS[item];
  if (khusus) return khusus;
  const slot = slotHiasan(item);
  const tema = temaHiasan(item);
  return slot && tema ? `${NAMA_SLOT_HIASAN[slot]} ${NAMA_TEMA_MUSIM[tema].nama}` : item;
}

/** Varian hiasan di baris "Spanduk gapura: Musim Hujan" (tema, atau "Emas"). */
export function varianHiasan(item: string): string {
  const tema = temaHiasan(item);
  return tema ? NAMA_TEMA_MUSIM[tema].nama : item === BINGKAI_EMAS ? 'Emas' : item;
}

/** "spanduk, seragam, papan gapura" (rapor). */
export function daftarHiasanPendek(items: readonly string[]): string {
  return items.map((i) => (i === BINGKAI_EMAS ? 'bingkai foto emas' : NAMA_PENDEK_SLOT[slotHiasan(i) ?? 'bingkai'])).join(', ');
}

export const NAMA_LENCANA: Readonly<Record<JenisLencana, string>> = { peserta: 'Peserta', lulus: 'Lulus', istimewa: 'Istimewa' };
export const NAMA_NILAI_RAPOR: Readonly<Record<NilaiRapor, string>> = { cukup: 'Cukup', baik: 'Baik', sangatBaik: 'Sangat Baik', istimewa: 'Istimewa' };

/** "Lencana Lulus Musim Hujan 2026". */
export function namaLencana(jenis: JenisLencana, tema: TemaMusimId, tahun: number): string {
  return `Lencana ${NAMA_LENCANA[jenis]} ${namaMusimTahun(tema, tahun)}`;
}

/** Isi satu hadiah tingkat: "2 tiket ganti tugas", "Seragam jas hujan", "Surat Armada: PO pilihanmu +½ level". */
export function teksHadiahMusim(h: HadiahMusim, tema: TemaMusimId, tahun: number): string {
  switch (h.jenis) {
    case 'lencana':
      return namaLencana(h.lencana, tema, tahun);
    case 'hiasan':
      return namaHiasan(h.item);
    case 'tiket':
      return `${h.jumlah} tiket ganti tugas`;
    case 'surat':
      return 'Surat Armada: PO pilihanmu +½ level';
  }
}

/** Isi toast naik tingkat: hiasan "… terpasang", lainnya namanya saja; beberapa hadiah digabung " + ". */
export function teksHadiahNaik(hadiah: readonly HadiahMusim[], tema: TemaMusimId, tahun: number): string {
  return hadiah.map((h) => (h.jenis === 'hiasan' ? TEKS.hiasanTerpasang(namaHiasan(h.item)) : teksHadiahMusim(h, tema, tahun))).join(' + ');
}

const NAMA_KOMPONEN: Readonly<Record<string, string>> = { kebersihan: 'kebersihan', keamanan: 'keamanan', kenyamanan: 'kenyamanan', fasilitas: 'fasilitas' };
const persenBulat = (x: number): number => Math.round(x * 100);

/** Teks kartu satu tugas (bagian 3.2): "Antar 1.200 penumpang ke Semarang". */
export function teksTugas(t: ModelTugas): string {
  const n = formatAngka(t.target);
  switch (t.templat) {
    case 'penumpang':
      return `Berangkatkan ${n} penumpang`;
    case 'laba':
      return `Kumpulkan laba ${formatUang(t.target)}`;
    case 'kota':
      return `Antar ${n} penumpang ke ${t.kota ?? ''}`;
    case 'antarpulau':
      return `Antar ${n} penumpang antarpulau`;
    case 'kelasTinggi':
      return `Antar ${n} penumpang Eksekutif ke atas`;
    case 'poTerendah':
      return `${t.po ? NAMA_PO[t.po].nama : 'PO'}: antar ${n} penumpang`;
    case 'kios':
      return `Kumpulkan sewa kios ${formatUang(t.target)}`;
    case 'parkir':
      return `Kumpulkan uang parkir ${formatUang(t.target)}`;
    case 'kepuasan':
      return `Jaga kepuasan ≥ ${persenBulat(Number(t.param))}% selama ${Math.round(t.target / 60)} menit main`;
    case 'perbaikan':
      return `Naikkan ${NAMA_KOMPONEN[String(t.param)] ?? ''} ke ${persenBulat(t.target)}% (kini ${persenBulat(t.progres)}%)`;
    case 'bangun':
      return 'Bangun 1 unit atau modernisasi';
    case 'daftarPo':
      return 'Daftarkan 1 PO baru';
  }
}

/** Teks pendek untuk baris tujuan (tanpa angka target). */
export function teksTugasPendek(t: ModelTugas): string {
  switch (t.templat) {
    case 'penumpang':
      return 'Berangkatkan penumpang';
    case 'laba':
      return 'Kumpulkan laba';
    case 'kota':
      return `Antar penumpang ke ${t.kota ?? ''}`;
    case 'antarpulau':
      return 'Antar penumpang antarpulau';
    case 'kelasTinggi':
      return 'Antar penumpang Eksekutif+';
    case 'poTerendah':
      return `Penumpang ${t.po ? NAMA_PO[t.po].nama : 'PO'}`;
    case 'kios':
      return 'Kumpulkan sewa kios';
    case 'parkir':
      return 'Kumpulkan uang parkir';
    case 'kepuasan':
      return `Jaga kepuasan ≥ ${persenBulat(Number(t.param))}%`;
    case 'perbaikan':
      return `Naikkan ${NAMA_KOMPONEN[String(t.param)] ?? ''} ke ${persenBulat(t.target)}%`;
    case 'bangun':
      return 'Bangun 1 unit atau modernisasi';
    case 'daftarPo':
      return 'Daftarkan 1 PO baru';
  }
}

/** Kemajuan "210/400" dalam satuan tugasnya. */
export function angkaTugas(t: ModelTugas): string {
  const ada = Math.min(t.progres, t.target);
  switch (t.templat) {
    case 'laba':
    case 'kios':
    case 'parkir':
      return `${formatUang(Math.floor(ada))}/${formatUang(t.target)}`;
    case 'kepuasan':
      return `${Math.floor(ada / 60)}/${Math.round(t.target / 60)} mnt`;
    case 'perbaikan':
      return `${persenBulat(t.progres)}%/${persenBulat(t.target)}%`;
    default:
      return `${formatAngka(Math.floor(ada))}/${formatAngka(t.target)}`;
  }
}

/** Nama kota dari papan bus ("BANDA ACEH") dalam huruf judul ("Banda Aceh") untuk teks tugas. */
export function hurufJudul(teks: string): string {
  return teks.toLowerCase().replace(/(^|[\s-])(\S)/g, (_, a: string, b: string) => a + b.toUpperCase());
}
