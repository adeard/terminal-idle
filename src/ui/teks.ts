/** Semua teks yang tampil ke pemain. */
import type { KodeGalatPeringkat } from '../app/peringkat';
import type { TingkatPo } from '../config/economy.config';
import type { EventId, FasilitasId, KelasBusId, PencapaianId, PoId, TeknologiId } from '../sim/fitur';
import type { TahapId } from '../sim/tahap';
import type { TingkatKeramaian } from '../sim/waktu';

export const NAMA_TAHAP: Readonly<Record<TahapId, string>> = {
  peron: 'Peron',
  loket: 'Loket',
  keberangkatan: 'Keberangkatan',
};

/** Nama hari, indeks 0 = Senin (lihat sim/waktu.ts). */
export const NAMA_HARI: readonly string[] = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'];

export const NAMA_FASILITAS: Readonly<Record<FasilitasId, { readonly nama: string; readonly deskripsi: string }>> = {
  kios: { nama: 'Kios & Minimarket', deskripsi: 'Sewa dibayar tiap hari, dari belanja penumpang' },
  parkir: { nama: 'Parkir Kendaraan', deskripsi: 'Parkir kendaraan pengantar & penjemput' },
  toilet: { nama: 'Toilet & Musholla', deskripsi: 'Penumpang betah, belanja di kios naik' },
  retribusi: { nama: 'Parkir Bus Jurusan', deskripsi: 'Dibayar tiap bus yang parkir di pulau jurusannya' },
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

/** Tahap perluasan terminal, urut EKONOMI.mitra.perluasan (lihat bagian 8 documents/12-rancangan-ekonomi-po.md). */
export const NAMA_PERLUASAN: readonly { readonly nama: string; readonly deskripsi: string }[] = [
  { nama: 'Aula loket diperluas', deskripsi: 'Jendela loket tambahan & antrean lebih panjang' },
  { nama: 'Pangkalan diperluas', deskripsi: 'Petak pangkalan, jendela loket, dan parkir mobil tambahan' },
  { nama: 'Lantai 2 gedung utama', deskripsi: 'Food court & ruang tunggu di lantai atas' },
  { nama: 'Gedung parkir bus', deskripsi: 'Parkir bus bertingkat & aula loket kedua' },
  { nama: 'Terminal Terpadu', deskripsi: 'Dek parkir ketiga, lantai 3, dan jembatan ke kota' },
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
  pengaturBus: 'Petugas pengatur bus',
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
  kepalaPertama: { nama: 'Manajemen Profesional', deskripsi: 'Rekrut Kepala pertama' },
  fasilitasPertama: { nama: 'Terminal Nyaman', deskripsi: 'Bangun fasilitas pertama' },
  semuaOtomatis: { nama: 'Berjalan Sendiri', deskripsi: 'Ketiga tahap punya Kepala' },
  targetPertama: { nama: 'Tepat Sasaran', deskripsi: 'Selesaikan target harian' },
  level25: { nama: 'Terminal Megah', deskripsi: 'Peron & Keberangkatan Lv 25, dan 25 loket' },
  penumpang100rb: { nama: 'Seratus Ribu Perjalanan', deskripsi: 'Berangkatkan 100.000 penumpang' },
  sepekan: { nama: 'Sepekan Beroperasi', deskripsi: 'Beroperasi 7 hari terminal' },
  fasilitasLengkap: { nama: 'Fasilitas Lengkap', deskripsi: 'Semua fasilitas Lv 10' },
  jalurLengkap: { nama: 'Lima Jalur', deskripsi: 'Semua jalur bus beroperasi' },
  jurusanSemua: { nama: 'Penghubung Jawa–Bali', deskripsi: 'Layani semua jurusan Jawa–Bali sekaligus' },
  antarpulau: { nama: 'Menyeberang Pulau', deskripsi: 'Layani rute antarpulau pertama' },
  kelasB: { nama: 'Naik Kelas', deskripsi: 'Terminal naik ke Tipe B' },
  modernLengkap: { nama: 'Terminal Modern', deskripsi: 'Pasang semua modernisasi' },
  level100: { nama: 'Terminal Raksasa', deskripsi: 'Peron & Keberangkatan Lv 100, dan 100 loket' },
  kelasA: { nama: 'Terminal Tipe A', deskripsi: 'Terminal naik ke Tipe A' },
  armadaLengkap: { nama: 'Armada Lengkap', deskripsi: 'Kelima kelas bus beroperasi, sampai Double Decker' },
  penumpang10jt: { nama: 'Sepuluh Juta Perjalanan', deskripsi: 'Berangkatkan 10 juta penumpang' },
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
  satuanArus: 'pnp/dtk',
  hudHariIni: (rp: string, tiket: string) => `Hari ini ${rp} · ${tiket} tiket`,
  hudHariIniRingkas: (rp: string) => `Hari ini ${rp}`,
  arus: 'Arus',
  upgrade: 'Upgrade',
  rekrutKepala: 'Rekrut Kepala',
  adaKepala: 'Ada Kepala',
  palingLambat: 'PALING LAMBAT',
  milestoneMenuju: (level: number, pengali: number) => `Lv ${level}: kapasitas ×${pengali}`,
  milestoneSelesai: 'Semua milestone tercapai',
  panelLoketUntuk: (po: string) => `→ ${po}`,
  panelLoketKosong: (n: number) => `${n} loket kosong: isi di tab PO`,
  panelJatahPenuh: 'Jatah loket semua PO penuh',
  petunjukKepala: 'Rekrut Kepala di ketiga tahap supaya terminal tetap jalan saat kamu pergi.',
  // Tutorial terpandu (ui/tutorial.ts).
  tutorialSambutanJudul: 'Selamat datang, Kepala Terminal!',
  tutorialSambutan:
    'Penumpang turun di Peron, membeli tiket di Loket, lalu naik bus di Keberangkatan. Tahap yang paling lambat menentukan pendapatanmu.',
  tutorialMulai: 'Mulai',
  tutorialLewati: 'Lewati',
  tutorialOke: 'Oke',
  tutorialNomor: (ke: number, dari: number) => `Langkah ${ke}/${dari}`,
  tutorialUpgradeJudul: 'Percepat tahap paling lambat',
  tutorialUpgrade: (tahap: string) => `Terminalmu sudah berjalan dan uang masuk sendiri. Upgrade ${tahap} (bertanda PALING LAMBAT) supaya lebih banyak penumpang terlayani.`,
  tutorialKepalaJudul: 'Rekrut Kepala',
  tutorialKepala: (tahap: string) => `Rekrut Kepala ${tahap}. Dengan Kepala di ketiga tahap, terminal tetap berjalan saat game ditutup.`,
  tutorialFasilitasJudul: 'Bangun fasilitas',
  tutorialFasilitas: 'Buka tab Fasilitas, lalu bangun Kios & Minimarket: penumpang berbelanja dan sewanya dibayar tiap hari.',
  tutorialJalurJudul: 'Bangun Jalur 2',
  tutorialJalur: 'Terminalmu baru punya satu jalur, jadi bus mengantre di jalan raya. Di tab Fasilitas, bangun Jalur 2: Peron & Keberangkatan jadi lebih cepat.',
  tutorialUang: (uang: string, biaya: string) => `Uang ${uang} / ${biaya}`,
  tutorialUangCukup: 'Uang cukup! Ketuk tombol yang berkedip.',
  // Tantangan mingguan & rekor (tab Target).
  tantanganJudul: (sisa: string) => `🎯 Tantangan minggu ini · berakhir dalam ${sisa}`,
  tantanganBerakhir: '🎯 Tantangan minggu ini · sudah berakhir',
  tantanganPenumpang: (n: string) => `Berangkatkan ${n} penumpang`,
  tantanganPendapatan: (rp: string) => `Kumpulkan ${rp} dari operasi terminal`,
  tantanganUpgrade: (n: number) => `Lakukan ${n} upgrade tahap`,
  tantanganKepuasan: (persen: number, menit: number) => `Jaga kepuasan ≥ ${persen}% selama ${menit} menit main`,
  tantanganFasilitas: (n: number) => `Naikkan level fasilitas ${n} kali`,
  tantanganMenit: (ada: number, target: number) => `${ada} / ${target} menit`,
  tantanganCatatan: 'Tantangan baru tiap Senin (WIB). Hadiah yang lupa diklaim dikirim otomatis minggu berikutnya.',
  notifTantangan: '🎯 Tantangan mingguan selesai! Klaim di tab Target',
  rekorJudul: '🏅 Rekor terminal',
  rekorHariIni: (p: string, rp: string) => `Hari ini: ${p} penumpang · ${rp}`,
  rekorPenumpang: 'Penumpang terbanyak sehari',
  rekorPendapatan: 'Pendapatan terbanyak sehari',
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
  kepuasanBonus: (persen: number, mulai: number, maks: number) =>
    persen > 0 ? `Bonus semua pendapatan +${persen}% (paling besar +${maks}% di kepuasan 100%)` : `Bonus pendapatan mulai di kepuasan ${mulai}%, sampai +${maks}% di 100%`,
  kepuasanPenumpang: (tambahan: number, terisi: number) =>
    `Penumpang yang datang +${tambahan}% berkat kepuasan · kapasitas terminal terisi ${terisi}% sekarang`,
  kepuasanKelancaran: 'Kelancaran antartahap',
  kepuasanFasilitas: 'Kios & Toilet',
  kepuasanJalur: 'Jalur bus',
  kepuasanSaranKelancaran: (tahap: string) => `Ada tahap yang tertinggal jauh. Upgrade ${tahap} (paling lambat).`,
  kepuasanSaranFasilitas: (ada: number, perlu: number) => `Level Kios + Toilet ${ada} dari ${perlu} yang dibutuhkan arus sekarang.`,
  kepuasanSaranJalur: (ada: number, perlu: number) => `${ada} dari ${perlu} jalur yang dibutuhkan: bus antre di jalan raya. Bangun jalur di tab Fasilitas.`,
  kepuasanBaik: 'Sudah baik.',
  kepuasanCatatan:
    'Tambahan penumpang paling terasa di luar jam sibuk; malam hari terminal tetap berangsur sepi. Terminal yang makin ramai butuh lebih banyak jalur & fasilitas. Kepuasan juga mengangkat reputasi semua PO, dan PO premium hanya mau bergabung & memperpanjang kontrak bila penumpangnya puas.',
  kepuasanTutup: 'Tutup',
  poSyaratKepuasan: (persen: number) => `Butuh kepuasan ${persen}%`,
  poSyaratTerminal: (kelas: string) => `Butuh Terminal ${kelas}`,
  // Jalur bus (tab Fasilitas).
  jalurNama: 'Jalur bus',
  jalurKeterangan: (sekarang: string, berikut: string) => `Peron & Keberangkatan ×${sekarang} · jalur berikutnya ×${berikut}. Tanpa jalur cukup, bus antre di jalan raya.`,
  jalurLengkap: (mult: string) => `Semua jalur beroperasi · Peron & Keberangkatan ×${mult}`,
  bangunJalur: (n: number) => `Bangun Jalur ${n}`,
  notifJalur: (n: number) => `🚧 Jalur ${n} dibuka! Lebih banyak bus bisa singgah sekaligus`,
  // Tab PO: mitra PO terdaftar & PO yang bisa didaftarkan.
  poRingkas: (n: number, slot: number) => `Slot PO terisi ${n}/${slot}`,
  poSlotBerikut: (slot: number, level: number) => `slot ke-${slot} di Terminal Lv ${level}`,
  poNilaiTiket: (dibayar: string, normal: string, terisi: number) => `Tiket rata-rata Rp ${dibayar} (normal Rp ${normal}) · kursi terisi ${terisi}%`,
  poLoketKosong: (n: number) => `${n} loket kosong`,
  poLoketKosongKet: 'Belum disewa PO, jadi belum melayani penumpang',
  isiLoket: 'Isi loket',
  gratis: 'Gratis',
  poTingkatAsal: (tingkat: string, asal: string) => `${tingkat} · ${asal}`,
  poReputasi: (n: number) => `Reputasi ${n}`,
  poXp: (ada: string, perlu: string, level: number) => `${ada} / ${perlu} bus ke Lv ${level}`,
  poLoket: (n: number, jatah: number) => `Loket ${n}/${jatah}`,
  poBagian: (bagian: number, terisi: number) => `${bagian}% penumpang · kursi terisi ${terisi}%`,
  poJatahPenuh: 'Jatah loket penuh: naikkan level PO atau bangun perluasan terminal',
  tambahLoket: '+ Loket',
  poKelas: (daftar: string) => `Kelas ${daftar}`,
  poKelasBerikut: (nama: string, level: number) => `${nama} di Lv ${level}`,
  poKelasButuhTerminal: (nama: string, kelas: string) => `${nama} butuh Terminal ${kelas}`,
  poHargaJudul: 'Harga tiket Ekonomi per jurusan',
  poHargaNormal: (rp: string) => `Normal Rp ${rp}`,
  poJurusanLevel: (level: number) => `Terbuka di PO Lv ${level}`,
  poKontrak: (hari: string) => `Kontrak tersisa ${hari} hari`,
  poKontrakPenuh: (hari: number) => `paling lama ${hari} hari`,
  poMenolak: (persen: number) => `Menolak perpanjang: butuh kepuasan ${persen}%`,
  perpanjang: 'Perpanjang',
  putus: 'Putus',
  putusYakin: 'Yakin putus?',
  putusCatatan: (reputasi: number, hari: number) =>
    `Putus kontrak gratis, tapi loket PO ini jadi kosong, reputasinya −${reputasi}, dan baru bisa didaftarkan lagi ${hari} hari kemudian.`,
  judulPoTersedia: 'Daftarkan PO',
  daftar: 'Daftar',
  poJurusanDaftar: (daftar: string) => `Jurusan ${daftar}`,
  poSlotPenuh: 'Slot PO penuh: naikkan level terminal',
  poJeda: (hari: string) => `Baru bisa didaftarkan lagi dalam ${hari} hari`,
  poRiwayat: (level: number) => `Pernah bergabung, lanjut dari Lv ${level}`,
  poHadiahKelas: (kelas: string) => `Hadiah Terminal ${kelas}`,
  poCatatan:
    'Tiap PO punya loket, jurusan, kelas bus, dan reputasinya sendiri. Bus yang datang & loket baru menaikkan level PO: jatah loket, jurusan, dan kelas busnya bertambah. Kepala Loket mengisi loket kosong dan memperpanjang kontrak otomatis saat tersisa sehari.',
  hargaCatatanPo:
    'Harga kelas lain ikut berlipat sesuai kelasnya. Lebih murah: peminat naik dan reputasi PO membaik. Lebih mahal: untung per tiket naik, tapi peminat turun dan reputasi PO pelan-pelan jatuh. Ketuk saran untuk hasil terbaik sehari.',
  // Tab Terminal: level & kelas, perluasan, Renovasi, kelas bus.
  terminalXp: (ada: string, perlu: string) => `${ada} / ${perlu} penumpang`,
  terminalKelasBerikut: (kelas: string, level: number) => `Naik ke ${kelas} di Lv ${level}`,
  terminalBonus: (persen: number, slot: number) => `Bonus pendapatan +${persen}% dari level · ${slot} slot PO`,
  terminalCatatan: 'Level terminal naik dari penumpang yang diberangkatkan. Kelas terminal ikut level dan tidak pernah turun.',
  perluasanJudul: 'Perluasan terminal',
  perluasanTahap: (tahap: number, jumlah: number, nama: string) => `Tahap ${tahap}/${jumlah}: ${nama}`,
  perluasanEfek: (jatah: number) => `Jatah loket semua PO +${jatah}`,
  perluasanSyarat: (level: number) => `Butuh Terminal Lv ${level}`,
  perluasanProyek: (sisa: string) => `Sedang dibangun · selesai dalam ${sisa}`,
  perluasanSelesai: 'Semua tahap perluasan sudah dibangun',
  perluasanBonus: (jatah: number) => `Perluasan selesai: jatah loket semua PO +${jatah}`,
  perluasanCatatan: 'Pembangunan butuh sehari terminal dan tetap berjalan saat game ditutup. Perluasan permanen, tidak diulang saat Renovasi.',
  renovasiJudul: 'Renovasi',
  renovasiBonus: (persen: number, jumlah: number) => `Bonus pendapatan permanen +${persen}%${jumlah > 0 ? ` · ${jumlah}× renovasi` : ''}`,
  renovasiBerikut: (poin: number, persen: number) => `Renovasi sekarang: +${poin} poin, bonus jadi +${persen}%`,
  renovasiSyarat: (poin: number) => `Renovasi butuh ${poin} poin dari pendapatan sejak renovasi terakhir`,
  renovasi: 'Renovasi',
  renovasiPopupJudul: 'Renovasi terminal?',
  renovasiPopupTeks: 'Kapasitas terminal dibangun ulang dari awal, dengan bonus pendapatan permanen yang lebih besar.',
  renovasiPopupBonus: (sekarang: number, setelah: number) => `Bonus pendapatan: +${sekarang}% → +${setelah}%`,
  renovasiPopupReset: 'Diulang dari awal: uang, level & Kepala ketiga tahap, loket (kembali ke loket bawaan tiap PO), fasilitas, modernisasi.',
  renovasiPopupTetap: 'Tetap: level & kelas terminal, perluasan, jalur bus, mitra PO beserta level, reputasi, harga & kontraknya, poin, penghargaan.',
  renovasiNanti: 'Nanti',
  judulKelasBus: 'Kelas bus',
  kelasBusBeroperasi: 'Beroperasi',
  /** @param tingkat tingkat PO paling rendah; null bila semua tingkat boleh. */
  kelasBusSyarat: (tingkat: string | null, level: number) => (tingkat ? `Butuh PO ${tingkat} ke atas, Lv ${level}` : `Butuh PO Lv ${level}`),
  kelasBusCatatan: 'Kelas bus terbuka seiring level PO, sampai batas tingkat PO-nya. Kelas yang lebih tinggi menaikkan harga tiket dan reputasi PO.',
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
  eventKeterangan: (pengali: string, po: string, poSudah: boolean) => `Pendapatan ×${pengali} selama event · ${poSudah ? `${po} bisa didaftarkan gratis` : `hadiah akhir: ${po}`}`,
  hudEvent: (singkat: string, pengali: string) => `${singkat} ×${pengali}`,
  notifEventMulai: (ikon: string, nama: string, pengali: string) => `${ikon} ${nama} dimulai! Pendapatan ×${pengali}`,
  notifEventTahap: '🎁 Tahap event selesai! Klaim di tab Target',
  // Kartu level & kelas terminal (tab Terminal).
  kelasJudul: (kelas: string, nama = '') => (nama ? `Terminal ${nama} · ${kelas}` : `Terminal ${kelas}`),
  kelasKemajuan: (ada: string, perlu: string) => `${ada} / ${perlu}`,
  poin: (n: number) => `+${n} poin`,
  poinDari: (n: number, min: number) => `${n}/${min} poin`,
  hudKelas: (kelas: string, level: number) => `${kelas} · Lv ${level}`,
  // Notifikasi mitra PO, level terminal, perluasan, Renovasi.
  notifNaikKelas: (kelas: string) => `⭐ Selamat! Terminal naik ke ${kelas}`,
  notifLevelTerminal: (level: number) => `🏢 Terminal naik ke Lv ${level}`,
  notifSlotBaru: (slot: number) => `🅿️ Slot PO ke-${slot} terbuka! Daftarkan PO di tab PO`,
  notifPo: (nama: string) => `🚌 ${nama} bergabung!`,
  notifPoLevel: (nama: string, level: number) => `⬆️ ${nama} naik ke Lv ${level}`,
  notifPoKeluar: (nama: string) => `📄 Kontrak ${nama} habis: PO keluar dan loketnya kosong`,
  notifKontrakHampir: (nama: string) => `📄 Kontrak ${nama} tinggal sehari. Perpanjang di tab PO`,
  notifKelasBus: (nama: string) => `🚌 Bus ${nama} mulai beroperasi!`,
  notifPerluasan: (nama: string) => `🏗️ ${nama} diresmikan!`,
  notifSiapRenovasi: '🔨 Renovasi siap! Lihat tab Terminal',
  notifRenovasi: (persen: number) => `🔨 Renovasi selesai! Bonus pendapatan kini +${persen}%`,
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
    `${nama ? `Terminal ${nama} · ${kelas}` : `Terminal ${kelas}`} · ${jurusan} jurusan · ${arus} pnp/dtk${po > 0 ? ` · ${po} PO` : ''}`,
  fotoAjakan: 'Main gratis di bustation.games',
  fotoTeksBagikan: 'Lihat terminal busku di Bustation! Main gratis di https://bustation.games',
  /** Label di atas bus yang diketuk (klakson telolet). */
  telolet: 'TELOLET!',
  tutorialSelesaiJudul: 'Terminalmu sudah berjalan!',
  tutorialSelesai:
    'Jaga kepuasan penumpang supaya terminal makin ramai, daftarkan mitra PO baru di tab PO, dan kembali besok untuk target harian. Tips: ketuk bus untuk membunyikan klakson telolet!',
  offlineJudul: 'Selama kamu pergi…',
  offlineDurasi: (durasi: string, dibatasi: boolean) =>
    dibatasi ? `Terminal beroperasi ${durasi} (batas maksimal)` : `Terminal beroperasi ${durasi}`,
  offlineCatatan: (persen: number, batas: string) => `Pendapatan offline ${persen}% · maksimal ${batas}`,
  offlineButuhKepala: 'Rekrut Kepala di ketiga tahap supaya terminal tetap jalan saat kamu pergi.',
  offlineAmbil: 'Ambil',
  kecepatan: (k: number) => `Kecepatan waktu ${k}× (tombol ${k})`,
  tabTahap: 'Tahap',
  tabFasilitas: 'Fasilitas',
  tabPo: 'PO',
  tabTerminal: 'Terminal',
  tabModern: 'Modern',
  tabTarget: 'Target',
  bangun: 'Bangun',
  buka: 'Buka',
  pasang: 'Pasang',
  terpasang: '✓ Terpasang',
  diklaim: '✓ Diklaim',
  klaim: 'Klaim',
  butuh: (nama: string) => `Butuh: ${nama}`,
  perPenumpang: (nilai: string) => `+Rp ${nilai}/pnp`,
  perBus: (nilai: string) => `Rp ${nilai}/bus`,
  tambahPerBus: (nilai: string) => `+Rp ${nilai}/bus`,
  sewaKios: (perHari: string, hariIni: string) => `Sewa ±${perHari}/hari · terkumpul ${hariIni}`,
  tambahBelanja: (nilai: string) => `+Rp ${nilai}/pnp`,
  bonusBelanjaKios: (persen: number) => `Belanja kios +${persen}%`,
  notifSewaKios: (hari: string, uang: string) => `🏪 Sewa kios hari ${hari}: +${uang}`,
  kapasitasPersen: (persen: number, tahap: string) => `+${persen}% kapasitas ${tahap}`,
  // Harga tiket per jurusan PO (tab PO).
  hargaSaran: (rp: string) => `Saran ${rp} (ketuk untuk pakai)`,
  hargaSesuaiSaran: '✓ Sesuai saran',
  hargaTurun: (nama: string) => `Turunkan harga tiket ${nama}`,
  hargaNaik: (nama: string) => `Naikkan harga tiket ${nama}`,
  targetUpgrade: (n: string) => `Lakukan ${n} upgrade tahap`,
  targetPenumpang: (n: string) => `Berangkatkan ${n} penumpang`,
  targetHari: (hari: string) => `Target hari ${hari}`,
  penghargaan: 'Penghargaan',
  notifPencapaian: (nama: string) => `🏆 Penghargaan baru: ${nama}`,
  notifTarget: '🎯 Target harian selesai! Klaim di tab Target',
  panelRingkas: 'Ringkas',
  chipTahap: (nama: string, level: number, kapasitas: string, adaKepala: boolean) =>
    `${nama} · Lv ${level} · ${kapasitas} pnp/dtk${adaKepala ? ' · ada Kepala' : ''} (ketuk untuk buka panel)`,
  panelBuka: 'Buka panel',
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
  pilihSaveRenovasi: (poin: string) => `${poin} poin renovasi`,
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
  busEmasTeks: (menit: number) => `Bus istimewa membawa rombongan penumpang. Tonton iklan untuk bonus sebesar ${menit} menit pendapatan.`,
  busEmasTonton: 'Tonton iklan & ambil',
  notifBusEmas: (uang: string) => `🚌 Bus Emas: +${uang}`,
} as const;
