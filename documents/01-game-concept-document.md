# 01 · Game Concept Document (GCD)

| | |
|---|---|
| Judul | **Bustation: Idle Bus** (nama lama: Terminal Bus Tycoon) |
| Genre | Idle / incremental tycoon, manajemen terminal bus |
| Platform | Web PWA di [bustation.games](https://bustation.games) (rilis). Android lewat Capacitor (APK siap dibangun, belum terbit di Play Store) |
| Bahasa | Indonesia |
| Model bisnis | Gratis. Pendapatan dari iklan berhadiah yang dipilih pemain sendiri; tidak ada pembelian dalam aplikasi |
| Status | Versi `0.1.0` sudah tayang di web. Dokumen per 6 Oktober 2026 |

## 1. High concept

> Bangun terminal bus tipe C kecil menjadi Terminal Terpadu yang melayani rute sampai Banda Aceh. Kamu mengatur alur penumpang dari peron, loket, sampai keberangkatan, menjaga penumpang tetap puas, dan menentukan harga tiket. Semua itu berlangsung di maket 3D yang hidup: bus telolet, antrean loket, dan suasana mudik.

## 2. Fantasi pemain

Pemain adalah **Kepala Terminal**. Fantasi intinya:

- **Melihat terminal tumbuh.** Terminal sepi dengan satu jalur dan bus yang antre di jalan raya berkembang menjadi terminal megah dengan lima jalur, delapan jendela loket, bus sleeper & double decker, dan papan nama berbintang.
- **Menjadi otak operasional.** Pemain menemukan tahap yang macet (antrean menumpuk tepat di depan bottleneck), memperbaikinya, lalu melihat arus penumpang langsung lebih lancar.
- **Merasakan terminal Indonesia yang akrab.** Klakson telolet dan anak-anak "OM TELOLET OM", pengumuman "Bus jurusan Surabaya sudah siap di jalur 2", ojek di mulut gang, musholla, mudik Lebaran, dan PO berlivery khas daerah.
- **Pulang dan mendapati uang sudah terkumpul.** Terminal tetap beroperasi saat game ditutup, asalkan ketiga tahap punya Kepala.

## 3. Pilar desain

1. **Bottleneck yang terlihat.** Angka ekonomi dan keramaian 3D saling mencerminkan: tahap paling lambat ditandai, dan antrean orang menumpuk tepat di depannya. Keputusan pemain selalu punya umpan balik visual.
2. **Santai tapi bermakna.** Terminal berjalan sendiri sejak detik pertama, tanpa perlu diketuk. Setiap keputusan (upgrade, fasilitas, harga, jalur) mengubah arus atau pendapatan secara jelas, dan tidak ada hukuman karena berhenti bermain.
3. **Lokal dan hangat.** Budaya terminal Indonesia menjadi isi, bukan sekadar hiasan: jurusan nyata, rute antarpulau dengan kapal feri, event Mudik/HUT RI/Nataru, dan PO fiktif yang terasa nyata.
4. **Adil dan transparan.** Tidak ada iklan paksa, tidak ada fitur yang dikunci di balik iklan, dan hadiah tidak bisa dicurangi lewat celah ekonomi (mis. harga tiket tidak bisa menggelembungkan hadiah).
5. **Ringan di HP murah.** Grafis 3D menurunkan kualitas otomatis, suara disintesis tanpa file audio, dan game tetap bisa dimainkan lewat panel bila WebGL tidak tersedia.

## 4. Target pemain

> Bagian ini asumsi tim. Validasi dengan data GA4 (corong tutorial, retensi, ringkasan sesi).

| Segmen | Deskripsi | Yang dicari |
|---|---|---|
| Utama | Pemain kasual Indonesia 18–40 tahun, bermain di HP Android kelas menengah ke bawah, sesi pendek 3–15 menit beberapa kali sehari | Kemajuan yang terasa tanpa harus fokus terus; boleh ditinggal |
| Kedua | Penggemar bus & "bismania" (komunitas telolet, livery PO, mudik) | Detail otentik: bus, livery, klakson, papan jadwal |
| Ketiga | Penggemar idle/tycoon yang suka optimasi angka | Bottleneck, harga tiket, prestige, papan peringkat mingguan |

Perilaku yang didukung: buka sebentar untuk mengambil penghasilan offline, beli upgrade, cek target harian, lalu tutup. Atau biarkan game terbuka dengan kecepatan 2×/3× sambil menikmati adegan.

## 5. Platform & perangkat

- **Web PWA**: bisa dipasang ke layar utama dan dimainkan offline. Portrait dan landscape didukung (overlay di-scale mengisi layar penuh).
- **Android**: kode yang sama dibungkus Capacitor 7. Login Google dan iklan di APK belum aktif (butuh plugin native).
- **Kontrol**: sentuh (drag geser kamera, cubit zoom, pelintir dua jari memutar) dan mouse/keyboard (roda zoom, klik kanan memutar, Q/E, tombol 1/2/3 untuk kecepatan).
- **Kebutuhan teknis**: browser dengan WebGL2 untuk adegan 3D. Tanpa WebGL2, game tetap jalan lewat panel.

## 6. Setting & tema

- **Lokasi**: terminal bus fiktif di kota Indonesia. Terminal bertipe C di awal, lalu naik ke Tipe B, Tipe A, dan Terminal Terpadu ★1, ★2, dst.
- **Rute**: dimulai Jakarta & Bandung, lalu Semarang sampai Denpasar (Jawa–Bali). Setelah itu delapan rute antarpulau lewat penyeberangan Merak–Bakauheni, Padangbai–Lembar, dan Kayangan–Pototano, sampai Banda Aceh.
- **Waktu**: jam terminal 24 jam (1 hari terminal = 24 menit nyata), hari Senin–Minggu, siang–malam, dan hujan 1–3 hari per pekan. Ritme keramaian mengikuti jam sibuk pagi/sore dan pola akhir pekan.
- **Event nyata**: Mudik Lebaran, HUT RI, dan Libur Natal & Tahun Baru mengikuti tanggal kalender WIB.

## 7. Gaya visual & audio

- **Visual**: adegan 3D bergaya foto maket. Kamera sempit dengan elevasi 42°, tilt-shift, bayangan lembut, pantulan langit, bloom lampu malam, dan orang serta bus 3D low-poly yang bergerak natural. Overlay UI bertema gelap dengan warna per tahap.
- **Audio**: semua bunyi disintesis Web Audio, tanpa file audio:
  - riuh orang, mesin diesel, lalu lintas, hujan, jangkrik;
  - rem angin dan klakson telolet;
  - bel "ting-tung" dan pengumuman berbahasa Indonesia lewat `speechSynthesis` bila tersedia.

## 8. Pembeda (USP)

1. Terminal bus Indonesia yang hidup dan **terlihat** dalam 3D: keramaian dekoratif mencerminkan ekonomi secara langsung, termasuk antrean di bottleneck, jendela loket per jurusan, bus dicuci di pangkalan, dan pengantar yang melambai.
2. Isi lokal yang kaya: telolet, mudik, rute antarpulau dengan kapal feri, PO berlivery, musholla dan jadwal sholat, ojek dan ojol.
3. Kedalaman manajemen di atas idle klasik: kepuasan penumpang memengaruhi jumlah penumpang, harga tiket per jurusan & kelas dengan saran otomatis, dan ritme siang–malam.
4. Fitur berbagi: foto terminal dengan bingkai bermerek, dan mode sinema untuk merekam video promosi (TikTok/Reels).

## 9. Model bisnis

- **Iklan berhadiah opsional** (Google H5 Games Ads di web; AdMob direncanakan untuk APK):
  - boost pendapatan 2× (+30 menit per iklan, ditumpuk sampai 4 jam);
  - Bus Emas (bonus 10 menit pendapatan);
  - ambil 2× penghasilan offline;
  - klaim 2× target harian & penghargaan.
- **Status**: integrasi selesai tetapi **nonaktif** sampai ID penerbit AdSense diisi dan H5 Games Ads disetujui.
- **Tidak ada**: iklan paksa, mata uang premium, pembelian dalam aplikasi, atau fitur yang hanya bisa dibuka lewat iklan.

## 10. Referensi genre

Mekanik idle-tycoon klasik (upgrade berbiaya eksponensial, manajer/Kepala yang menjalankan bisnis saat offline, prestige dengan pengali permanen) dipadukan dengan simulasi visual kerumunan bergaya maket. Pembanding genre umum adalah idle tycoon bertema bisnis transportasi dan pengelolaan fasilitas.

## 11. Risiko utama

| Risiko | Mitigasi saat ini |
|---|---|
| Grafis 3D berat di HP murah | Kualitas adaptif lima tingkat; mode tanpa bayangan & post-processing; adegan dimuat terpisah setelah UI siap |
| Retensi idle game rendah setelah hari-hari awal | Target harian, tantangan mingguan, event musiman, papan peringkat mingguan, rekor, naik kelas |
| Pendapatan iklan belum ada | Integrasi H5 Games Ads siap; tinggal persetujuan AdSense. Distribusi tambahan (portal web, Play Store) di Phase 2 |
| Kecurangan papan peringkat | Validasi server (skor tidak pernah turun, batas kenaikan wajar, rate limit, daftar larangan). Peringkat tidak memberi hadiah gameplay |
| Kehilangan progres | Save lokal + autosave tiap 10 detik; cloud save Firestore dengan deteksi konflik; cadangan save korup |
