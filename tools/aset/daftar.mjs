/**
 * Daftar potongan dari assets/master.jpg (koordinat piksel di gambar master).
 *
 * - petak(x, y, w, h): sprite di atas petak abu-biru (panel kanan). Kotak petak
 *   dari deteksi otomatis; tepinya dipangkas 3 px supaya garis petak ikut hilang.
 * - lepas(x, y, w, h): sprite langsung di atas latar slate (panel kiri) atau
 *   latar terang (UI). Kotaknya diperlebar 3 px supaya ada latar di tepi.
 * - tekstur(x, y, w, h): potongan persegi tanpa hapus latar (dinding, etalase).
 *
 * Opsi:
 *   atlas     masuk atlas game (public/aset/atlas.png). Default true; adegan 3D
 *             kini hanya memakai sisi bus (gedung terminal prosedural), sisanya false
 *             (tetap dipotong ke assets/potongan/).
 *   bayangan  tambahkan bayangan elips di kaki (hanya di atlas).
 *   hadap     arah hadap sprite orang: kanan | kiri | depan | belakang.
 */

const petak = (x, y, w, h) => ({ kotak: [x + 3, y + 3, w - 6, h - 6], hapusLatar: true });
const lepas = (x, y, w, h) => ({ kotak: [x - 3, y - 3, w + 6, h + 6], hapusLatar: true });
const tekstur = (x, y, w, h) => ({ kotak: [x, y, w, h], hapusLatar: false });

const aset = (nama, sumber, opsi = {}) => ({ nama, ...sumber, atlas: true, bayangan: false, ...opsi });

export const DAFTAR_ASET = [
  // ------------------------------------------------------------ Bus (tampak samping, depan di kanan)
  aset('bus/hijau-1', petak(326, 46, 174, 77)),
  aset('bus/biru-1', petak(514, 46, 178, 77)),
  aset('bus/oranye-1', petak(706, 46, 180, 77)),
  aset('bus/kuning-1', petak(900, 46, 178, 77)),
  aset('bus/hijau-2', petak(326, 129, 174, 77)),
  aset('bus/biru-2', petak(514, 129, 178, 77)),
  aset('bus/oranye-2', petak(706, 129, 180, 77)),
  aset('bus/kuning-2', petak(900, 129, 178, 77)),
  aset('bus/van-putih', petak(1109, 56, 103, 67)),
  aset('bus/minibus-kuning', petak(1099, 130, 122, 76)),
  aset('bus/tingkat-oranye', petak(1228, 107, 159, 99)),

  // Bus isometrik di panel kiri: hijau & biru saling menumpuk, perspektifnya
  // tidak sama dengan proyeksi game, jadi hanya dipotong (tidak dipakai).
  aset('bus-iso/hijau-biru', lepas(15, 335, 232, 131), { atlas: false }),
  aset('bus-iso/oranye', lepas(58, 453, 139, 117), { atlas: false }),

  // ------------------------------------------------------------ Gedung
  aset('gedung/atap-limas-1', petak(325, 251, 176, 58), { atlas: false }),
  aset('gedung/atap-limas-2', petak(325, 315, 176, 72), { atlas: false }),
  aset('gedung/dinding-bata-atas', tekstur(515, 254, 95, 53), { atlas: false }),
  aset('gedung/dinding-bata', tekstur(515, 317, 95, 67), { atlas: false }),
  aset('gedung/panel-gelap-1', tekstur(624, 254, 92, 52), { atlas: false }),
  aset('gedung/panel-gelap-2', tekstur(727, 254, 92, 52), { atlas: false }),
  aset('gedung/panel-gelap-3', tekstur(830, 254, 82, 52), { atlas: false }),
  aset('gedung/panel-gelap-4', tekstur(923, 254, 61, 52), { atlas: false }),
  aset('gedung/dinding-jendela-1', tekstur(624, 317, 92, 67), { atlas: false }),
  aset('gedung/dinding-jendela-2', tekstur(727, 317, 92, 67), { atlas: false }),
  aset('gedung/dinding-jendela-3', tekstur(830, 317, 82, 67), { atlas: false }),
  aset('gedung/dinding-pintu', tekstur(923, 317, 61, 67), { atlas: false }),
  aset('gedung/pintu-kaca', tekstur(999, 333, 27, 52), { atlas: false }),
  aset('gedung/pintu-polos', tekstur(1039, 333, 28, 51), { atlas: false }),
  aset('gedung/pintu-keluar', tekstur(1078, 333, 28, 52), { atlas: false }),
  aset('gedung/pintu-terbuka', petak(1116, 315, 34, 72), { atlas: false }),
  aset('gedung/etalase-1', tekstur(1162, 316, 68, 67), { atlas: false }),
  aset('gedung/etalase-2', tekstur(1243, 316, 72, 67), { atlas: false }),
  aset('gedung/papan-nama', petak(996, 251, 319, 57), { atlas: false }),
  aset('gedung/menara-jam', petak(1323, 251, 64, 137), { atlas: false, bayangan: true }),

  // ------------------------------------------------------------ Prop jalan (panel kanan)
  aset('prop/bangku-1', petak(325, 431, 71, 66), { atlas: false, bayangan: true }),
  aset('prop/tong-sampah', petak(401, 431, 68, 66), { atlas: false, bayangan: true }),
  aset('prop/tong-hijau', petak(473, 431, 67, 66), { atlas: false, bayangan: true }),
  aset('prop/papan-kosong', petak(545, 431, 100, 67), { atlas: false, bayangan: true }),
  aset('prop/gerbang-papan', petak(651, 431, 79, 66), { atlas: false }),
  aset('prop/papan-info-1', petak(735, 431, 86, 66), { atlas: false }),
  aset('prop/mesin-tiket-1', petak(829, 431, 50, 66), { atlas: false, bayangan: true }),
  aset('prop/mesin-tiket-2', petak(889, 431, 65, 66), { atlas: false, bayangan: true }),
  aset('prop/pagar-1', petak(959, 431, 78, 66), { atlas: false }),
  aset('prop/pagar-2', petak(1043, 431, 78, 66), { atlas: false }),
  aset('prop/meteran-parkir', petak(1138, 431, 52, 63), { atlas: false, bayangan: true }),
  aset('prop/lampu-taman', petak(1206, 431, 51, 132), { atlas: false, bayangan: true }),
  aset('prop/lampu-jalan-1', petak(1262, 431, 51, 132), { atlas: false, bayangan: true }),
  aset('prop/lampu-jalan-2', petak(1331, 431, 56, 132), { atlas: false, bayangan: true }),
  aset('prop/rambu-halte', petak(1138, 497, 52, 67), { atlas: false, bayangan: true }),
  aset('prop/bangku-2', petak(325, 499, 71, 64), { atlas: false, bayangan: true }),
  aset('prop/bangku-3', petak(401, 499, 68, 65), { atlas: false, bayangan: true }),
  aset('prop/kardus', petak(473, 499, 67, 64), { atlas: false, bayangan: true }),
  aset('prop/papan-info-2', petak(545, 499, 100, 64), { atlas: false }),
  aset('prop/pembatas-1', petak(651, 499, 79, 64), { atlas: false }),
  aset('prop/pembatas-2', petak(735, 499, 86, 64), { atlas: false }),
  aset('prop/mesin-tiket-3', petak(829, 499, 50, 64), { atlas: false, bayangan: true }),
  aset('prop/tong-besi', petak(889, 499, 65, 64), { atlas: false, bayangan: true }),
  aset('prop/pagar-3', petak(959, 499, 78, 65), { atlas: false }),
  aset('prop/pagar-4', petak(1043, 499, 78, 65), { atlas: false }),

  // Prop isometrik (panel kiri)
  aset('prop/bangku-iso-1', lepas(22, 54, 64, 62), { atlas: false, bayangan: true }),
  aset('prop/bangku-panjang', lepas(182, 59, 102, 46), { atlas: false, bayangan: true }),
  aset('prop/tong-iso-1', lepas(100, 65, 28, 42), { atlas: false, bayangan: true }),
  aset('prop/tong-hijau-iso', lepas(143, 69, 25, 37), { atlas: false, bayangan: true }),
  aset('prop/rambu-bay', lepas(21, 119, 36, 80), { atlas: false }),
  aset('prop/gerbang-bay', lepas(77, 121, 87, 73), { atlas: false }),
  aset('prop/papan-info-iso', lepas(197, 120, 37, 75), { atlas: false, bayangan: true }),
  aset('prop/bangku-iso-2', lepas(23, 203, 64, 62), { atlas: false, bayangan: true }),
  aset('prop/bangku-iso-3', lepas(120, 199, 62, 62), { atlas: false, bayangan: true }),
  aset('prop/tong-iso-2', lepas(202, 210, 29, 46), { atlas: false, bayangan: true }),
  aset('prop/kardus-iso', lepas(253, 226, 25, 21), { atlas: false, bayangan: true }),
  aset('prop/bangku-iso-4', lepas(23, 271, 64, 62), { atlas: false, bayangan: true }),
  aset('prop/tong-iso-3', lepas(187, 280, 28, 41), { atlas: false, bayangan: true }),
  aset('prop/gerbang-kecil', lepas(237, 278, 43, 56), { atlas: false }),
  aset('prop/tong-iso-4', lepas(212, 502, 27, 42), { atlas: false, bayangan: true }),
  aset('prop/mesin-tiket-iso', lepas(257, 504, 28, 53), { atlas: false, bayangan: true }),

  // ------------------------------------------------------------ Orang
  aset('orang/jaket-merah', petak(324, 610, 46, 70), { atlas: false, bayangan: true, hadap: 'kanan' }),
  aset('orang/jaket-hijau', petak(374, 610, 51, 70), { atlas: false, bayangan: true, hadap: 'kanan' }),
  aset('orang/topi', petak(431, 610, 51, 71), { atlas: false, bayangan: true, hadap: 'kanan' }),
  aset('orang/koper', petak(487, 610, 51, 70), { atlas: false, bayangan: true, hadap: 'belakang' }),
  aset('orang/jaket-hijau-2', petak(542, 610, 52, 70), { atlas: false, bayangan: true, hadap: 'kanan' }),
  aset('orang/rok-ungu', petak(599, 610, 47, 70), { atlas: false, bayangan: true, hadap: 'depan' }),
  aset('orang/kaos-biru', petak(651, 610, 48, 70), { atlas: false, bayangan: true, hadap: 'depan' }),
  aset('orang/kursi-roda', petak(704, 610, 53, 71), { atlas: false, bayangan: true, hadap: 'depan' }),
  aset('orang/satpam', petak(762, 610, 45, 70), { atlas: false, bayangan: true, hadap: 'depan' }),
  aset('orang/jaket-merah-2', petak(324, 685, 46, 70), { atlas: false, bayangan: true, hadap: 'kanan' }),
  aset('orang/jaket-hijau-3', petak(374, 685, 51, 70), { atlas: false, bayangan: true, hadap: 'kanan' }),
  aset('orang/topi-2', petak(431, 685, 51, 70), { atlas: false, bayangan: true, hadap: 'kanan' }),
  aset('orang/baju-ungu', petak(486, 685, 52, 70), { atlas: false, bayangan: true, hadap: 'belakang' }),
  aset('orang/jaket-hijau-4', petak(542, 685, 52, 70), { atlas: false, bayangan: true, hadap: 'kanan' }),
  aset('orang/kuncir', petak(599, 685, 47, 70), { atlas: false, bayangan: true, hadap: 'depan' }),
  aset('orang/kaos-biru-2', petak(651, 685, 48, 70), { atlas: false, bayangan: true, hadap: 'depan' }),
  aset('orang/anak', petak(704, 685, 53, 70), { atlas: false, bayangan: true, hadap: 'depan' }),
  aset('orang/polisi', petak(762, 685, 45, 70), { atlas: false, bayangan: true, hadap: 'depan' }),
  aset('orang/tas-merah', lepas(256, 143, 26, 52), { atlas: false, bayangan: true, hadap: 'depan' }),
  aset('orang/duduk-bangku', lepas(108, 269, 52, 60), { atlas: false, bayangan: true, hadap: 'depan' }),
  aset('orang/jalan-1', lepas(24, 580, 30, 70), { atlas: false, bayangan: true, hadap: 'depan' }),
  aset('orang/jalan-2', lepas(104, 580, 36, 70), { atlas: false, bayangan: true, hadap: 'kanan' }),
  aset('orang/jalan-3', lepas(170, 580, 35, 70), { atlas: false, bayangan: true, hadap: 'kanan' }),
  aset('orang/jalan-4', lepas(244, 583, 32, 67), { atlas: false, bayangan: true, hadap: 'depan' }),
  aset('orang/bapak-1', lepas(20, 667, 30, 77), { atlas: false, bayangan: true, hadap: 'depan' }),
  aset('orang/bapak-2', lepas(59, 668, 31, 76), { atlas: false, bayangan: true, hadap: 'depan' }),
  aset('orang/kursi-roda-2', lepas(101, 669, 51, 76), { atlas: false, bayangan: true, hadap: 'depan' }),
  aset('orang/jalan-5', lepas(171, 666, 38, 74), { atlas: false, bayangan: true, hadap: 'kanan' }),
  aset('orang/anak-2', lepas(251, 687, 25, 56), { atlas: false, bayangan: true, hadap: 'depan' }),
  aset('orang/anjing', lepas(231, 715, 20, 27), { atlas: false, bayangan: true, hadap: 'kanan' }),

  // ------------------------------------------------------------ Kendaraan kecil
  aset('kendaraan/golf-putih-1', petak(823, 610, 84, 70), { atlas: false, bayangan: true }),
  aset('kendaraan/golf-biru', petak(910, 610, 85, 70), { atlas: false, bayangan: true }),
  aset('kendaraan/golf-putih-2', petak(823, 685, 84, 70), { atlas: false, bayangan: true }),
  aset('kendaraan/golf-putih-3', petak(910, 685, 85, 70), { atlas: false, bayangan: true }),

  // ------------------------------------------------------------ UI (teks bahasa Inggris tertanam tidak dipakai)
  aset('ui/hud-atas', lepas(949, 3, 456, 40), { atlas: false }),
  aset('ui/hud-bar', lepas(1039, 607, 349, 36), { atlas: false }),
  aset('ui/panel-ikon', lepas(1039, 648, 219, 69), { atlas: false }),
  aset('ui/ikon-alat', { kotak: [1061, 663, 43, 36], hapusLatar: true }, { atlas: false }),
  aset('ui/ikon-gir', { kotak: [1127, 663, 42, 36], hapusLatar: true }, { atlas: false }),
  aset('ui/ikon-kalender', { kotak: [1193, 663, 43, 36], hapusLatar: true }, { atlas: false }),
  aset('ui/bar-gelap', lepas(1266, 648, 123, 31), { atlas: false }),
  aset('ui/bar-biru', lepas(1265, 682, 123, 31), { atlas: false }),
  aset('ui/bar-biru-2', lepas(1266, 716, 122, 40), { atlas: false }),
  aset('ui/bar-terang', tekstur(1040, 723, 217, 32), { atlas: false }),
];
