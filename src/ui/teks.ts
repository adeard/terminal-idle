/** Semua teks yang tampil ke pemain. */
import type { KodeGalatPeringkat } from '../app/peringkat';
import type { TingkatPo } from '../config/economy.config';
import type { BangunanId, EventId, KelasBusId, PencapaianId, PetugasId, PoId, TarifId, TeknologiId } from '../sim/fitur';
import type { RincianBiaya, RincianPendapatan } from '../sim/keuangan';
import type { AreaId } from '../sim/operasi';
import type { TahapId } from '../sim/tahap';
import type { TingkatKeramaian } from '../sim/waktu';

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
  toilet: { nama: 'Toilet & musholla', deskripsi: 'Pemakai membayar tarif toilet: fasilitas' },
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
  layanan: { nama: 'Biaya layanan', satuan: 'persen', per: 'harga tiket', deskripsi: 'Lebih tinggi: calon penumpang berkurang' },
  sewaLoket: { nama: 'Sewa jendela loket', satuan: 'rupiah', per: 'hari', deskripsi: 'Lebih tinggi: kepuasan mitra PO turun' },
  retribusiBus: { nama: 'Retribusi bus', satuan: 'rupiah', per: 'bus', deskripsi: 'Butuh pos retribusi. Lebih tinggi: kepuasan mitra PO turun' },
  parkir: { nama: 'Parkir kendaraan', satuan: 'rupiah', per: 'kendaraan', deskripsi: 'Butuh lahan parkir. Lebih tinggi: pengantar yang parkir berkurang' },
  toilet: { nama: 'Toilet', satuan: 'rupiah', per: 'orang', deskripsi: 'Butuh toilet. Lebih tinggi: pemakai berkurang' },
  sewaKios: { nama: 'Sewa kios & toko', satuan: 'rupiah', per: 'hari', deskripsi: 'Lebih tinggi dari keramaiannya: sebagian kosong' },
};

/** Sumber pendapatan & pos biaya (laporan keuangan). */
export const NAMA_PENDAPATAN: Readonly<Record<keyof RincianPendapatan, string>> = {
  layanan: 'Biaya layanan',
  sewaLoket: 'Sewa jendela loket',
  retribusi: 'Retribusi bus',
  parkir: 'Parkir kendaraan',
  toilet: 'Toilet',
  sewaKios: 'Sewa kios & toko',
};
export const NAMA_BIAYA: Readonly<Record<keyof RincianBiaya, string>> = {
  gaji: 'Gaji petugas',
  perawatan: 'Perawatan',
  listrik: 'Listrik',
  gedung: 'Operasional gedung',
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

/** Tahap perluasan terminal, urut EKONOMI.mitra.perluasan (slot barunya di EKONOMI.tycoon.bangunan). */
export const NAMA_PERLUASAN: readonly { readonly nama: string; readonly deskripsi: string }[] = [
  { nama: 'Aula loket diperluas', deskripsi: 'Slot jendela loket +2' },
  { nama: 'Pangkalan diperluas', deskripsi: 'Petak bus +10, jendela loket +2, lahan parkir kedua' },
  { nama: 'Lantai 2 gedung utama', deskripsi: 'Food court & ruang tunggu: jendela +4, kursi, toko, toilet' },
  { nama: 'Gedung parkir bus', deskripsi: 'Gedung Antarpulau: jalur +2, petak bus +20, aula loket kedua' },
  { nama: 'Terminal Terpadu', deskripsi: 'Dek parkir ketiga & lantai 3: jalur +2, petak bus +20, jendela +4' },
];

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

export const NAMA_TEKNOLOGI: Readonly<Record<TeknologiId, string>> = {
  rambuHalte: 'Marka & rambu halte',
  pengaturBus: 'Sistem pengatur bus',
  mesinTiket: 'Mesin tiket mandiri',
  eTiket: 'Tiket online (e-tiket)',
  jadwalDigital: 'Papan jadwal digital',
  gateOtomatis: 'Gate e-boarding otomatis',
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
  loketPenuh: { nama: 'Aula Penuh', deskripsi: 'Semua 20 jendela loket disewa PO' },
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
  hudHariIni: (laba: string, penumpang: string) => `Hari ini ${laba} · ${penumpang} pnp`,
  hudHariIniRingkas: (laba: string) => `Hari ini ${laba}`,
  arus: 'Arus',
  petunjukManajer: 'Rekrut Manajer Operasional supaya terminal tetap jalan saat kamu pergi.',
  petunjukKasMenipis: 'Kas menipis: terminal merugi. Kurangi petugas, ubah tarif, atau bongkar unit yang tidak terpakai.',
  // Tutorial terpandu (ui/tutorial.ts).
  tutorialSambutanJudul: 'Selamat datang, Kepala Terminal!',
  tutorialSambutan:
    'Penumpang turun di Peron, membeli tiket di Loket, lalu naik bus di Keberangkatan. Bangun, rekrut petugas, dan gandeng PO bus supaya laba bersihmu terus tumbuh.',
  tutorialMulai: 'Mulai',
  tutorialLewati: 'Lewati',
  tutorialOke: 'Oke',
  tutorialNomor: (ke: number, dari: number) => `Langkah ${ke}/${dari}`,
  tutorialJendelaJudul: 'Bangun jendela loket',
  tutorialJendela: (po: string) =>
    `Terminalmu sudah berjalan dan uang masuk sendiri. Penumpang menumpuk di Loket, area yang paling lambat (lantainya berkedip merah): di tab Bangun, bangun jendela loket baru untuk ${po}.`,
  tutorialPoJudul: 'Daftarkan PO kedua',
  tutorialPo: (po: string) => `Mitra PO membawa jurusan & busnya sendiri. Di tab PO, daftarkan ${po}: jurusan baru menarik lebih banyak penumpang, dan PO baru langsung menyewa jendela loket.`,
  tutorialPetugasJudul: 'Rekrut petugas peron',
  tutorialPetugas: 'Kini Peron yang paling lambat. Di tab Petugas, rekrut petugas peron: halte kedatangan melayani 25% lebih banyak penumpang. Gajinya dibayar tiap hari dari kas.',
  tutorialJalurJudul: 'Bangun Jalur 2',
  tutorialJalur: 'Terminalmu baru punya satu jalur, jadi bus mengantre di jalan raya. Di tab Bangun, bangun Jalur 2: satu halte kedatangan & satu gerbang keberangkatan lagi.',
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
  tantanganCatatan: 'Tantangan baru tiap Senin (WIB). Hadiah yang lupa diklaim dikirim otomatis minggu berikutnya.',
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
  kepuasanSaranHarga: 'Turunkan biaya layanan, tarif parkir, atau tarif toilet di tab Terminal.',
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
  perawatanPerHari: (rp: string) => `Perawatan ${rp}/hari`,
  bongkar: (rp: string) => `Bongkar · +${rp}`,
  bongkarYakin: 'Yakin bongkar?',
  bangunanCatatan: (persen: number) =>
    `Bongkar mengembalikan ${persen}% harga unit; jalur permanen, dan hanya jendela loket kosong yang bisa dibongkar. Perawatan dibayar tiap hari selama unit berdiri.`,
  jendelaKosong: (n: number) => `${n} jendela kosong`,
  petakBus: (petak: number, kapasitas: string) => `${petak} petak parkir bus · ${kapasitas} pnp/jam`,
  petakBusKet: 'Bus parkir, dicuci, & menunggu jadwal. Bertambah lewat perluasan terminal.',
  perawatanTotal: (rp: string) => `Perawatan semua unit ${rp}/hari`,
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
  poKontrakPenuh: (hari: number) => `paling lama ${hari} hari`,
  poMenolak: (persen: number) => `Menolak perpanjang: butuh kepuasan penumpang ${persen}%`,
  poMenolakMitra: (persen: number) => `Menolak perpanjang: kepuasan mitra di bawah ${persen}%. Turunkan sewa loket atau retribusi`,
  perpanjang: 'Perpanjang',
  putus: 'Putus',
  putusYakin: 'Yakin putus?',
  putusCatatan: (reputasi: number, hari: number) =>
    `Putus kontrak gratis, tapi jendela loket PO ini jadi kosong, reputasinya −${reputasi}, dan baru bisa didaftarkan lagi ${hari} hari kemudian.`,
  judulPoTersedia: 'Daftarkan PO',
  daftar: 'Daftar',
  poJurusanDaftar: (daftar: string) => `Jurusan ${daftar}`,
  poSlotPenuh: 'Slot PO penuh: naikkan level terminal',
  poJendelaPenuh: 'Slot jendela loket penuh: bangun perluasan terminal',
  poMenolakBergabung: (persen: number) => `Menolak bergabung (kepuasan mitra ±${persen}%): turunkan sewa loket atau retribusi`,
  poJeda: (hari: string) => `Baru bisa didaftarkan lagi dalam ${hari} hari`,
  poRiwayat: (level: number) => `Pernah bergabung, lanjut dari Lv ${level}`,
  poHadiahKelas: (kelas: string) => `Hadiah Terminal ${kelas}`,
  poCatatan:
    'Tiap PO punya jendela loket, jurusan, kelas bus, dan reputasinya sendiri, dan menetapkan harga tiketnya sendiri. Terminal memungut biaya layanan, sewa jendela, dan retribusi. Bus yang berangkat menaikkan level PO: jurusan & kelas busnya bertambah. Manajer Kemitraan menyewakan jendela kosong dan memperpanjang kontrak otomatis.',
  // Tab Terminal: level & kelas, perluasan, tarif, laporan keuangan, kelas bus.
  terminalXp: (ada: string, perlu: string) => `${ada} / ${perlu} penumpang`,
  terminalKelasBerikut: (kelas: string, level: number) => `Naik ke ${kelas} di Lv ${level}`,
  terminalSlot: (slot: number) => `${slot} slot PO`,
  terminalCatatan: 'Level terminal naik dari penumpang yang diberangkatkan. Kelas terminal ikut level dan tidak pernah turun; terminal yang lebih besar menarik lebih banyak penumpang, tapi gaji & perawatannya ikut naik.',
  perluasanJudul: 'Perluasan terminal',
  perluasanTahap: (tahap: number, jumlah: number, nama: string) => `Tahap ${tahap}/${jumlah}: ${nama}`,
  perluasanOperasional: (rp: string) => `operasional gedung ${rp}/hari`,
  perluasanSyarat: (level: number) => `Butuh Terminal Lv ${level}`,
  perluasanProyek: (sisa: string) => `Sedang dibangun · selesai dalam ${sisa}`,
  perluasanSelesai: 'Semua tahap perluasan sudah dibangun',
  perluasanCatatan: 'Pembangunan butuh sehari terminal dan tetap berjalan saat game ditutup. Tiap tahap menambah slot bangunan.',
  tarifJudul: 'Tarif terminal',
  tarifSaran: 'Saran',
  tarifTurun: (nama: string) => `Turunkan ${nama}`,
  tarifNaik: (nama: string) => `Naikkan ${nama}`,
  tarifPer: (per: string) => `per ${per}`,
  tarifBawaan: (nilai: string) => `bawaan ${nilai}`,
  layananPerPenumpang: (rupiah: string, hargaTiket: string) => `≈ ${rupiah} per penumpang (tiket rata-rata ${hargaTiket}, ditetapkan PO)`,
  tarifCatatan:
    'Harga tiket ditetapkan PO. Tarif lebih tinggi menambah pendapatan per penumpang, tapi menurunkan permintaan, pemakai parkir & toilet, okupansi kios, atau kepuasan mitra PO. Saran = tarif yang paling menguntungkan sehari, dengan mitra PO tetap mau memperpanjang kontrak.',
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
  kelasBusCatatan: 'Kelas bus terbuka seiring level PO, sampai batas tingkat PO-nya. Kelas yang lebih tinggi menaikkan harga tiket (dan biaya layanan terminal) serta reputasi PO.',
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
  notifSlotBaru: (slot: number) => `🅿️ Slot PO ke-${slot} terbuka! Daftarkan PO di tab PO`,
  notifPo: (nama: string) => `🚌 ${nama} bergabung!`,
  notifPoLevel: (nama: string, level: number) => `⬆️ ${nama} naik ke Lv ${level}`,
  notifPoKeluar: (nama: string) => `📄 Kontrak ${nama} habis: PO keluar dan jendela loketnya kosong`,
  notifKontrakHampir: (nama: string) => `📄 Kontrak ${nama} tinggal sehari. Perpanjang di tab PO`,
  notifKelasBus: (nama: string) => `🚌 Bus ${nama} mulai beroperasi!`,
  notifPerluasan: (nama: string) => `🏗️ ${nama} diresmikan! Slot bangunan bertambah`,
  notifJalur: (n: number) => `🚧 Jalur ${n} dibuka! Lebih banyak bus bisa singgah sekaligus`,
  notifKasMenipis: '⚠️ Kas menipis: terminal merugi. Kurangi petugas atau ubah tarif',
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
  tutorialSelesai:
    'Bangun toilet & kios supaya penumpang betah, rekrut Manajer Operasional supaya terminal tetap jalan saat kamu pergi, dan pantau laba di tab Terminal. Tips: ketuk bus untuk membunyikan klakson telolet!',
  offlineJudul: 'Selama kamu pergi…',
  offlineDurasi: (durasi: string, dibatasi: boolean) => (dibatasi ? `Terminal beroperasi ${durasi} (batas maksimal)` : `Terminal beroperasi ${durasi}`),
  offlineRincian: (pendapatan: string, biaya: string) => `Pendapatan ${pendapatan} · biaya ${biaya}`,
  offlineCatatan: (persen: number, batas: string) => `Manajer Operasional menjalankan terminal: pendapatan ${persen}%, biaya penuh · maksimal ${batas}`,
  offlineTutup: 'Terminal tutup selama kamu pergi. Rekrut Manajer Operasional di tab Petugas supaya terminal tetap berjalan.',
  offlineBerhenti: (n: number) => `${n} petugas berhenti karena kas habis`,
  offlineAmbil: 'Ambil',
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
  busEmasTeks: (menit: number) => `Bus istimewa membawa rombongan penumpang. Tonton iklan untuk bonus sebesar ${menit} menit laba.`,
  busEmasTonton: 'Tonton iklan & ambil',
  notifBusEmas: (uang: string) => `🚌 Bus Emas: +${uang}`,
} as const;
