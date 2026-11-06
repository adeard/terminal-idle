import './ui/gaya.css';
import { bacaAkunAktif, hapusDataAkun, keluarAkun, masukAkun, SlotAkun } from './app/akun';
import { PencatatAnalitik, pesanGalat } from './app/analitik';
import { hadiahSetelahIklan, tontonBerhadiah, type TempatIklan } from './app/iklan';
import { LayananPeringkat } from './app/layanan-peringkat';
import { AntreanPerayaan, perluPeresmianSusulan } from './app/peresmian-bentuk';
import { SesiGame, slotLokal, type Logger } from './app/sesi';
import { manajerUntung } from './app/tujuan';
import { STATUS_TUTORIAL } from './app/tutorial';
import { EKONOMI } from './config/economy.config';
import { buatAnalitik } from './platform/analitik';
import { bagikanBerkas, bisaBagikanBerkas, bisaFoto, unduhBerkas } from './platform/berbagi';
import { buatPenyediaIklan } from './platform/iklan';
import { pasangTombolFoto } from './ui/foto';
import { pasangTombolSinema, type PengaturanSinema } from './ui/sinema';
import { formatDurasi, formatUang } from './ui/format';
import { pasangPenandaBusEmas, pasangTombolBoost } from './ui/hadiah';
import { IKON_BOOST, IKON_BUS_EMAS, tampilkanPopupHadiah } from './ui/popup-hadiah';
import type { OpsiSinema, Terminal3D } from './game/terminal3d';
import { awanAkun, bisaLogin, firebaseTermuat, muatFirebase, tokenAkun } from './platform/akun';
import { buatApiPeringkat } from './platform/peringkat';
import { buatPenyimpanan } from './platform/penyimpanan';
import { PILIHAN_KECEPATAN, WAKTU } from './config/waktu.config';
import type { InfoRilis } from './app/pembaruan';
import { pasangPembaruan } from './platform/pembaruan';
import { pasangSiklusHidup } from './platform/siklus-hidup';
import { MesinSuara } from './platform/suara';
import type { Aksi } from './sim/aksi';
import { isEventId, type LantaiDilihat } from './sim/fitur';
import { bisaBukaMusim, bukaMusim, musimDariId } from './sim/musim';
import { buatModel } from './ui/model';
import { notifArmada, notifikasiMusim } from './ui/notifikasi';
import { tampilkanPopupRapor, tampilkanPopupSambutanMusim } from './ui/popup-musim';
import { bisaAktifkanBoost, bisaKlaimBonusOffline, levelTerminal, paketHadiah, type LaporanOffline } from './sim/state';
import { pasangBingkai } from './ui/bingkai';
import { pasangOverlay } from './ui/overlay';
import { tampilkanPopupAkun } from './ui/popup-akun';
import { tampilkanPopupOffline } from './ui/popup-offline';
import { pasangTombolPembaruan, tampilkanPopupPembaruan } from './ui/popup-pembaruan';
import { PilihanDibatalkan, tanyaPilihanSave } from './ui/popup-pilih-save';
import { pasangTombolAkun } from './ui/tombol-akun';
import { pasangTombolKamera, type TombolKamera } from './ui/tombol-kamera';
import { pasangTombolSuara } from './ui/tombol-suara';
import { pasangTutorial } from './ui/tutorial';
import { NAMA_PO, TEKS, teksBagianLevel } from './ui/teks';

function ambil(id: string): HTMLElement {
  const e = document.getElementById(id);
  if (!e) throw new Error(`Elemen #${id} tidak ditemukan`);
  return e;
}

/** Teks galat menu akun; null = tidak perlu ditampilkan (pemain sendiri yang membatalkan). */
function pesanGalatAkun(e: unknown, bawaan: string): string | null {
  if (e instanceof PilihanDibatalkan) return null;
  const kode = firebaseTermuat()?.kodeGalat(e) ?? null;
  if (kode === 'auth/popup-closed-by-user' || kode === 'auth/cancelled-popup-request') return null;
  if (kode === 'auth/popup-blocked') return TEKS.akunPopupDiblokir;
  console.error('[akun]', e);
  return bawaan;
}

async function mulai(): Promise<void> {
  // Server dev: ?tanggal=2026-12-02 (10.00 WIB) atau ?tanggal=2026-12-02T23:59 (WIB) menggeser jam dinding seluruh
  // game, untuk mencoba Musim Terminal sebelum Musim 1 (30 November 2026). Tidak ada di build produksi.
  if (import.meta.env.DEV) geserJamDev(new URLSearchParams(location.search).get('tanggal'));
  const akar = ambil('akar');
  const wadahAdegan = ambil('adegan');
  const wadahLabel = ambil('label-dunia');
  const ui = ambil('ui');

  const penyimpanan = buatPenyimpanan();
  const logSave: Logger = (pesan, detail) => console.error(`[save] ${pesan}`, detail);
  // Skala overlay dipasang sebelum save dimuat, supaya dialog "Pilih progres"
  // (bisa muncul saat pemain yang login memuat save) tampil benar.
  const lepasBingkaiAwal = pasangBingkai({ induk: akar, overlay: ui, adegan: wadahAdegan, saatUkur: () => {} });

  // Pemain yang login memakai save akun (lokal + cloud); tamu memakai save lokal saja.
  const uidAktif = bisaLogin ? await bacaAkunAktif(penyimpanan).catch(() => null) : null;
  const slotAkun =
    uidAktif === null
      ? null
      : new SlotAkun({ uid: uidAktif, penyimpanan, awan: awanAkun(uidAktif), tanya: (p) => tanyaPilihanSave(ui, p), logGalat: logSave });
  let saatSaveDiganti: (l: LaporanOffline) => void = () => {};
  // Server dev: ?event=mudikLebaran|hutRi|nataru memaksa event musiman (hanya untuk mencoba tampilannya).
  const eventUji = import.meta.env.DEV ? new URLSearchParams(location.search).get('event') : null;
  const { sesi, status, laporan } = await SesiGame.mulai({
    slot: slotAkun ?? slotLokal(penyimpanan),
    eventUji: isEventId(eventUji) ? eventUji : null,
    logGalat: logSave,
    saatSaveDiganti: (l) => saatSaveDiganti(l),
  });
  lepasBingkaiAwal();
  console.info(`[save] status muat: ${status}${uidAktif === null ? ' (tamu)' : ' (akun)'}`);

  // Analitik (GA4; mati sampai ID diisi di config/analitik.config.ts).
  const analitik = new PencatatAnalitik(buatAnalitik());
  // Error yang lolos (skrip & promise) dilaporkan ringkas supaya bug di perangkat pemain terlihat.
  window.addEventListener('error', (e) => analitik.catatGalat(e.message || pesanGalat(e.error), e.filename, e.lineno));
  window.addEventListener('unhandledrejection', (e) => analitik.catatGalat(pesanGalat(e.reason)));
  // Ringkasan tiap sesi main (dikirim saat game dijeda / ditutup).
  let awalSesi = { state: sesi.pengendali.state, waktu: performance.now() };
  analitik.catat('mulai_game', { save: status, akun: uidAktif !== null ? 'login' : 'tamu' });
  // Mitra PO didaftarkan & diputus lewat aksi (daftar_po, putus_po); yang keluar karena kontrak habis lewat state.
  sesi.pengendali.pantauAksi((aksi, lama, baru) => analitik.catatAksi(aksi, lama, baru));
  let poTerdaftar = new Set(sesi.pengendali.state.mitra.terdaftar.map((p) => p.id));
  sesi.pengendali.berlangganan((s) => {
    const sekarang = new Set(s.mitra.terdaftar.map((p) => p.id));
    // Diputus pemain = sedang masa jeda; selain itu kontraknya habis.
    for (const id of poTerdaftar) if (!sekarang.has(id) && (s.mitra.jedaSampai[id] ?? 0) <= s.statistik.waktuMainDetik) analitik.catat('po_keluar', { po: id });
    poTerdaftar = sekarang;
  });

  // Pilihan panel ringkas disimpan per perangkat.
  const KUNCI_PANEL = 'terminal-bus-tycoon/panel';
  const panelRingkas = (await penyimpanan.baca(KUNCI_PANEL).catch(() => null)) === 'ringkas';
  // Kecepatan waktu (1×/2×/3×), disimpan per perangkat.
  const KUNCI_KECEPATAN = 'terminal-bus-tycoon/kecepatan';
  const kecepatanTersimpan = Number(await penyimpanan.baca(KUNCI_KECEPATAN).catch(() => null));
  let kecepatan = PILIHAN_KECEPATAN.includes(kecepatanTersimpan) ? kecepatanTersimpan : 1;
  const ubahKecepatan = (k: number): void => {
    kecepatan = k;
    void penyimpanan.tulis(KUNCI_KECEPATAN, String(k)).catch(() => undefined);
  };
  // Peresmian susulan Sayap 2 Lantai, sekali per perangkat (documents/16 bagian 7). Tahap < 3 ditandai
  // sekarang: nanti pemain ini mendapat peresmian biasa, jadi jangan dua kali. Tahap ≥ 3 ditandai saat tayang.
  const KUNCI_PERESMIAN = 'terminal-bus-tycoon/peresmian-bentuk';
  const tulisTandaPeresmian = (): void => void penyimpanan.tulis(KUNCI_PERESMIAN, '1').catch(() => undefined);
  const tandaPeresmian = (await penyimpanan.baca(KUNCI_PERESMIAN).catch(() => null)) !== null;
  const perluSusulan = perluPeresmianSusulan(sesi.pengendali.state.perkembangan.perluasan, tandaPeresmian);
  if (!tandaPeresmian && !perluSusulan) tulisTandaPeresmian();
  const perayaan = new AntreanPerayaan(!perluSusulan);
  // Iklan berhadiah (platform/iklan.ts): suara game dibisukan selama iklan diputar.
  const bisuSelamaIklan = { sebelum: (): void => {}, sesudah: (): void => {} };
  const iklan = buatPenyediaIklan({ akar: ui, sebelum: () => bisuSelamaIklan.sebelum(), sesudah: () => bisuSelamaIklan.sesudah() });
  const tontonIklan = (tempat: TempatIklan): Promise<boolean> => tontonBerhadiah(iklan, tempat, (hasil) => analitik.catat('iklan_hadiah', { tempat, hasil }));
  // Papan peringkat mingguan (hanya web, seperti akun): tamu hanya melihat, pemain login bisa ikut.
  const apiPeringkat = buatApiPeringkat(() => (uidAktif === null ? Promise.resolve(null) : tokenAkun(uidAktif)));
  const peringkat = bisaLogin
    ? new LayananPeringkat({ api: apiPeringkat, uid: uidAktif, ambilState: () => sesi.pengendali.state, kirimAksi: (a) => sesi.pengendali.kirim(a) })
    : null;
  if (peringkat) sesi.pengendali.berlangganan((s) => peringkat.periksa(s));
  // Menu akun dipasang di bawah; tombol "Masuk untuk ikut" di papan peringkat memanggilnya lewat ini.
  let bukaAkun: () => void = () => {};
  // Mode lihat per lantai (documents/18): UI memegang lantai yang dilihat, adegan hanya menerimanya.
  let lantaiDilihat: LantaiDilihat | null = null;
  let terminal: Terminal3D | null = null;
  const overlay = pasangOverlay(ui, sesi.pengendali, {
    iklan: { siap: () => iklan.siap(), tonton: tontonIklan },
    ...(peringkat
      ? {
          peringkat: {
            layanan: peringkat,
            bukaAkun: () => bukaAkun(),
            saatBuka: () => analitik.catat('peringkat_buka', { akun: uidAktif !== null ? 'login' : 'tamu', ikut: sesi.pengendali.state.profil.ikutPeringkat }),
          },
        }
      : {}),
    ringkas: panelRingkas,
    saatUbahRingkas: (r) => void penyimpanan.tulis(KUNCI_PANEL, r ? 'ringkas' : 'penuh').catch(() => undefined),
    kecepatan,
    saatUbahKecepatan: ubahKecepatan,
    analitik,
    saatLantaiDilihat: (v) => {
      lantaiDilihat = v;
      terminal?.aturLantaiDilihat(v);
    },
  });
  // Tutorial terpandu untuk pemain baru; statusnya disimpan per perangkat.
  const KUNCI_TUTORIAL = 'terminal-bus-tycoon/tutorial';
  const statusTutorial = await penyimpanan.baca(KUNCI_TUTORIAL).catch(() => null);
  // Musim Terminal terbuka sesudah tutorial selesai atau dilewati (documents/17 bagian 7.1); pemain lama ditandai selesai.
  let tutorialTamat = statusTutorial === 'selesai' || statusTutorial === 'dilewati';
  pasangTutorial({
    akar: ui,
    area: overlay.area,
    pengendali: sesi.pengendali,
    status: STATUS_TUTORIAL.find((st) => st === statusTutorial) ?? null,
    simpan: (st) => {
      tutorialTamat = st !== 'aktif';
      void penyimpanan.tulis(KUNCI_TUTORIAL, st).catch(() => undefined);
    },
    analitik,
  });
  // Pintasan keyboard: 1, 2, 3.
  window.addEventListener('keydown', (e) => {
    if (e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
    const k = Number(e.key);
    if (!PILIHAN_KECEPATAN.includes(k)) return;
    ubahKecepatan(k);
    overlay.aturKecepatan(k);
  });
  // Suara disintesis; baru berbunyi setelah sentuhan pertama (aturan autoplay).
  const suara = await MesinSuara.buat(penyimpanan);
  pasangTombolSuara(overlay.kontrol, suara);
  bisuSelamaIklan.sebelum = () => suara.jeda();
  bisuSelamaIklan.sesudah = () => suara.lanjut();

  // Hadiah iklan: boost pendapatan (tombol ⚡) dan Bus Emas (penanda di adegan).
  const kirim = (aksi: Aksi): boolean => sesi.pengendali.kirim(aksi);
  const bukaBoost = (): void => {
    const s = sesi.pengendali.state;
    const h = EKONOMI.hadiah;
    const bisa = bisaAktifkanBoost(s);
    void tampilkanPopupHadiah(ui, {
      kelas: 'hadiah-boost',
      ikon: IKON_BOOST,
      judul: TEKS.boostJudul,
      teks: TEKS.boostTeks(h.boostPerIklanDetik / 60, h.boostMaksDetik / 3600),
      hadiah: TEKS.boostHadiah(h.boostPerIklanDetik / 60),
      catatan: s.hadiah.boostDetik > 0 ? TEKS.boostSisa(formatDurasi(s.hadiah.boostDetik)) : '',
      tombol: bisa ? TEKS.boostTonton : TEKS.boostPenuh(h.boostMaksDetik / 3600),
      bisa,
      tonton: () =>
        hadiahSetelahIklan(
          () => tontonIklan('boost'),
          () => {
            kirim({ jenis: 'aktifkanBoost' });
            overlay.notif(TEKS.notifBoost(formatDurasi(sesi.pengendali.state.hadiah.boostDetik)));
          },
        ),
    });
  };
  const bukaBusEmas = (): void => {
    kirim({ jenis: 'tahanBusEmas' });
    // Paket Bus Emas: uang & armada untuk PO yang tertulis di popup (documents/15 bagian 4.4).
    const paket = paketHadiah(sesi.pengendali.state, 'busEmas');
    const armada = paket.armada;
    void tampilkanPopupHadiah(ui, {
      kelas: 'hadiah-bus-emas',
      ikon: IKON_BUS_EMAS,
      judul: TEKS.busEmasJudul,
      teks: armada ? TEKS.busEmasTeks(formatUang(paket.uang), NAMA_PO[armada.po].nama, teksBagianLevel(armada.bagian)) : TEKS.busEmasTeksUang(formatUang(paket.uang)),
      hadiah: `+${formatUang(paket.uang)}`,
      tombol: TEKS.busEmasTonton,
      bisa: true,
      tonton: () =>
        hadiahSetelahIklan(
          () => tontonIklan('busEmas'),
          () => {
            const sebelum = sesi.pengendali.state.kas;
            kirim({ jenis: 'klaimBusEmas' });
            overlay.notif(TEKS.notifBusEmas(formatUang(sesi.pengendali.state.kas - sebelum)));
          },
        ),
    }).then((diterima) => diterima || kirim({ jenis: 'lepasBusEmas' }));
  };
  const tombolBoost = pasangTombolBoost(overlay.kontrol, () => iklan.siap(), bukaBoost);
  const penandaBusEmas = pasangPenandaBusEmas(overlay.area, sesi.pengendali, () => iklan.siap(), bukaBusEmas);
  sesi.pengendali.berlangganan((s) => {
    tombolBoost.perbarui(s);
    penandaBusEmas.perbarui(s);
  });

  // Akun & cloud save. Semua aksi yang mengganti slot save diakhiri muat ulang halaman.
  const bukaMenuAkun = (): void =>
    tampilkanPopupAkun(ui, {
      masuk: uidAktif !== null,
      siapkan: async () => {
        const p = await (await muatFirebase()).penggunaSekarang();
        return p !== null && p.uid === uidAktif ? p : null;
      },
      sinkronkan: async () => {
        await sesi.simpan('penting');
        return slotAkun?.tersinkron ?? false;
      },
      masukGoogle: async () => {
        const fb = firebaseTermuat();
        if (!fb) throw new Error('Layanan akun belum termuat');
        const pengguna = await fb.masukGoogle();
        // Masuk lagi setelah sesi login berakhir: cukup muat ulang, sinkron jalan lagi.
        if (pengguna.uid === uidAktif) return location.reload();
        try {
          if (uidAktif !== null) {
            // Masuk lagi dengan akun lain: tinggalkan akun lama dulu (save-nya tetap di perangkat).
            await sesi.hentikan();
            await keluarAkun(penyimpanan);
          }
          await masukAkun({
            uid: pengguna.uid,
            penyimpanan,
            awan: fb.buatAwan(pengguna.uid),
            tanya: (p) => tanyaPilihanSave(ui, p),
            logGalat: logSave,
            hentikanTamu: () => sesi.hentikan(),
          });
          analitik.catat('login', { method: 'Google' });
        } catch (e) {
          await fb.keluarGoogle().catch(() => undefined);
          throw e;
        }
        location.reload();
      },
      keluar: async () => {
        await sesi.hentikan(); // termasuk unggahan terakhir
        await keluarAkun(penyimpanan);
        await muatFirebase()
          .then((fb) => fb.keluarGoogle())
          .catch((e: unknown) => console.warn('[akun] gagal keluar dari Google', e));
        location.reload();
      },
      hapus: async () => {
        const fb = firebaseTermuat();
        if (!fb || uidAktif === null) throw new Error('Layanan akun belum termuat');
        await fb.konfirmasiUlang();
        await sesi.hentikan();
        await hapusDataAkun({ uid: uidAktif, penyimpanan, awan: fb.buatAwan(uidAktif), hapusPeringkat: () => apiPeringkat.keluar() });
        await fb.hapusPengguna();
        location.reload();
      },
      pesanGalat: pesanGalatAkun,
      // Aksi yang gagal setelah sesi dihentikan: muat ulang supaya game jalan lagi.
      saatTutup: () => {
        if (sesi.sudahDihentikan) location.reload();
      },
    });
  bukaAkun = bukaMenuAkun;
  if (bisaLogin) pasangTombolAkun(overlay.kontrol, uidAktif !== null, bukaMenuAkun);

  // Adegan 3D dimuat di latar; UI & simulasi sudah jalan sebelum grafis siap.
  let tombolKamera: TombolKamera | null = null;
  let ukuran = { lebar: 1, tinggi: 1 };
  pasangBingkai({
    induk: akar,
    overlay: ui,
    adegan: wadahAdegan,
    saatUkur: (lebar, tinggi) => {
      ukuran = { lebar, tinggi };
      terminal?.ukur(lebar, tinggi);
    },
  });
  const mulaiGrafis = performance.now();
  void import('./game/terminal3d')
    .then(({ Terminal3D }) => Terminal3D.buat(wadahAdegan, wadahLabel, sesi.pengendali))
    .then((t) => {
      terminal = t;
      t.ukur(ukuran.lebar, ukuran.tinggi);
      t.pasangSuara(suara);
      t.tampilkanBusEmas = () => iklan.siap();
      tombolKamera = pasangTombolKamera(overlay.kontrol, t);
      if (bisaFoto) {
        pasangTombolFoto(overlay.kontrol, {
          akar: ui,
          pembaca: sesi.pengendali,
          ambil: () => t.ambilFoto(),
          analitik,
          bagikan: (berkas) => bagikanBerkas(berkas, TEKS.judul, TEKS.fotoTeksBagikan),
          bisaBagikan: bisaBagikanBerkas,
          unduh: unduhBerkas,
        });
      }
      pasangTombolSinema(overlay.kontrol, {
        akar,
        ui,
        jam: () => t.jamTampil,
        analitik,
        mulai: (p) => t.aturSinema(opsiSinema(p)),
        selesai: () => t.aturSinema(null),
      });
      t.saatTelolet = () => analitik.catat('telolet');
      t.saatKetukArea = (area) => overlay.bukaArea(area);
      // Mode lantai: yang sudah dibuka sebelum adegan siap ikut diteruskan; kamera digeser jauh = keluar.
      t.aturLantaiDilihat(lantaiDilihat);
      t.saatLantaiDilepas = () => overlay.keluarLantai();
      analitik.catat('adegan_siap', { detik: Math.round((performance.now() - mulaiGrafis) / 100) / 10 });
    })
    .catch((e: unknown) => {
      console.error('[grafis] adegan 3D gagal dimuat', e);
      analitik.catat('adegan_gagal');
      analitik.catatGalat(pesanGalat(e));
      const pesan = document.createElement('div');
      pesan.className = 'pesan-grafis';
      pesan.textContent = TEKS.grafisGagal;
      wadahAdegan.append(pesan);
    });

  const tampilkanLaporan = (l: LaporanOffline | null): void => {
    if (!sesi.perluPopup(l)) return;
    if (l.proyek?.selesai) perayaan.catatProyekOffline(l.proyek.tahap, terminal !== null);
    const s = sesi.pengendali.state;
    // Bonus 2× lewat iklan: hanya kalau ada penghasilan offline yang belum digandakan.
    const ganda =
      iklan.siap() && bisaKlaimBonusOffline(s)
        ? (): Promise<boolean> =>
            hadiahSetelahIklan(
              () => tontonIklan('offline2x'),
              () => kirim({ jenis: 'klaimBonusOffline' }),
            )
        : undefined;
    // Tanpa Manajer: catatan popup menyarankannya hanya bila ia sudah untung (syarat baris tujuan).
    void tampilkanPopupOffline(ui, l, ganda, l.tutup && manajerUntung(s), s.perkembangan.perluasan);
  };
  tampilkanLaporan(laporan);
  saatSaveDiganti = (l) => {
    overlay.notif(TEKS.notifSaveDiganti);
    tampilkanLaporan(l);
  };

  // Musim Terminal (documents/17): dibuka di Lv 6 sesudah tutorial; popup rapor (musim berganti) lalu sambutan
  // tampil sesudah popup lain (offline, pembaruan) dan gelembung tutorial tertutup, masing-masing sekali.
  let popupMusim = false;
  // Sambutan menunggu saat tenang (playtest P-7): tidak selama ada toast dan tidak dalam DETIK_TENANG_SAMBUTAN detik
  // main sesudah naik level di sesi ini (Lv 6 juga membuka Perluasan 2 dan slot PO). Naik level sesi lalu tidak
  // dihitung, jadi paling lambat sambutan tampil di awal sesi berikutnya. Musim sendiri tetap terbuka di Lv 6.
  const DETIK_TENANG_SAMBUTAN = 90;
  let levelLalu = levelTerminal(sesi.pengendali.state);
  let naikLevelMain = Number.NEGATIVE_INFINITY;
  const bukaKartuMusim = (): void => {
    if (ui.classList.contains('panel-ringkas')) ui.querySelector<HTMLElement>('.tombol-ringkas')?.click();
    ui.querySelector<HTMLElement>('.tab[data-tab="target"]')?.click();
    ui.querySelector('.musim-kartu')?.scrollIntoView({ block: 'start' });
  };
  const periksaMusim = (): void => {
    if (sesi.sedangDijeda || sesi.sudahDihentikan) return;
    const sekarang = Date.now();
    if (tutorialTamat && bisaBukaMusim(sesi.pengendali.state, sekarang)) sesi.pengendali.ubah((s) => bukaMusim(s, sekarang));
    const st = sesi.pengendali.state;
    const lv = levelTerminal(st);
    if (lv !== levelLalu) {
      levelLalu = lv;
      naikLevelMain = st.statistik.waktuMainDetik;
    }
    if (popupMusim || ui.querySelector('.popup-latar, .tutorial')) return;
    const m = st.musim;
    const mu = m.id !== null ? musimDariId(m.id) : null;
    if (m.rapor) {
      popupMusim = true;
      void tampilkanPopupRapor(ui, m.rapor, mu).then(() => {
        kirim({ jenis: 'tutupRapor' });
        popupMusim = false;
      });
    } else if (mu && !m.sambutan && overlay.notifSepi() && st.statistik.waktuMainDetik - naikLevelMain >= DETIK_TENANG_SAMBUTAN) {
      popupMusim = true;
      void tampilkanPopupSambutanMusim(ui, mu.tema).then((pilihan) => {
        kirim({ jenis: 'tutupSambutanMusim' });
        popupMusim = false;
        if (pilihan === 'lihat') bukaKartuMusim();
      });
    }
  };
  window.setInterval(periksaMusim, 1000);
  // Toast & analitik musim dari perubahan state (tugas selesai, Rapor naik, musim berganti, musim terbuka).
  let stateLalu = sesi.pengendali.state;
  sesi.pengendali.berlangganan((s) => {
    if (s.musim !== stateLalu.musim) {
      analitik.catatMusim(stateLalu, s);
      for (const teks of notifikasiMusim(stateLalu.musim, s.musim)) overlay.notif(teks);
    }
    stateLalu = s;
  });
  // Surat Armada: kemajuan level PO pilihan pemain (toast armada yang sama dengan hadiah berpaket).
  sesi.pengendali.pantauAksi((aksi, lama, baru) => {
    if (aksi.jenis !== 'pakaiSuratArmada') return;
    const teks = notifArmada(buatModel(lama), buatModel(baru));
    if (teks) overlay.notif(teks);
  });

  // Versi baru (web/PWA): tawarkan lewat popup; "Nanti" menyisakan tombol kecil di pojok adegan.
  let popupPembaruanTerbuka = false;
  let tombolPembaruan: { hapus(): void } | null = null;
  const tawarkanPembaruan = async (info: InfoRilis | null, aktifkan: () => Promise<void>): Promise<void> => {
    if (popupPembaruanTerbuka) return;
    popupPembaruanTerbuka = true;
    tombolPembaruan?.hapus();
    tombolPembaruan = null;
    const pilihan = await tampilkanPopupPembaruan(ui, {
      versiSekarang: __VERSI_APP__,
      info,
      perbarui: async () => {
        await sesi.simpan('penting').catch(() => undefined);
        // Cadangan bila service worker tidak mengambil alih (mis. sudah aktif di tab lain).
        setTimeout(() => location.reload(), 8000);
        await aktifkan();
      },
    });
    popupPembaruanTerbuka = false;
    if (pilihan === 'nanti') tombolPembaruan = pasangTombolPembaruan(overlay.kontrol, () => void tawarkanPembaruan(info, aktifkan));
  };
  void pasangPembaruan({ saatTersedia: (info, aktifkan) => void tawarkanPembaruan(info, aktifkan) }).catch((e: unknown) =>
    console.warn('[pembaruan] gagal dipasang', e),
  );

  // Perayaan tayang saat adegan siap & terlihat: tanpa popup di depannya, dan untuk susulan juga tanpa tutorial.
  // Bila adegan gagal dimuat, tanda tidak ditulis dan peresmian dicoba lagi saat game dibuka berikutnya.
  const perayaanTerhalang = (susulan: boolean): boolean => ui.querySelector(susulan ? '.popup-latar, .tutorial' : '.popup-latar') !== null;
  const tayangkanPerayaan = (t: Terminal3D, dt: number): void => {
    const p = perayaan.ambil(dt, sesi.pengendali.state.perkembangan.perluasan, perayaanTerhalang);
    if (!p) return;
    if (p.kembangApi !== null) t.rayakanPerluasan(p.kembangApi);
    if (p.susulan) {
      tulisTandaPeresmian();
      overlay.notif(TEKS.notifPeresmianBentuk);
    }
  };

  // Satu loop untuk simulasi (fixed timestep + autosave di detak()) dan render.
  // Berhenti total saat pause supaya waktu background hanya dihitung lewat
  // logika offline dan baterai tidak terkuras.
  let berjalan = true;
  let terakhir = performance.now();
  const langkah = (sekarang: number): void => {
    if (!berjalan) return;
    const dt = (sekarang - terakhir) / 1000;
    terakhir = sekarang;
    sesi.detak(dt, kecepatan);
    // Panel layar penuh menutupi adegan: tidak perlu digambar (hemat baterai); ekonomi tetap berjalan.
    if (terminal && !overlay.panelPenuh()) {
      terminal.perbarui(perayaan.tahanAdegan ? 0 : dt, kecepatan);
      tombolKamera?.perbarui(terminal.arahUtara);
      tayangkanPerayaan(terminal, dt);
    }
    requestAnimationFrame(langkah);
  };
  requestAnimationFrame(langkah);

  await pasangSiklusHidup({
    saatPause: () => {
      if (berjalan) analitik.catatRingkasanSesi(awalSesi.state, sesi.pengendali.state, (performance.now() - awalSesi.waktu) / 1000);
      // Skor papan peringkat terakhir dikirim sebelum game ke latar (bisa jadi tab ditutup).
      peringkat?.periksa(sesi.pengendali.state, true);
      berjalan = false;
      suara.jeda();
      void sesi.jeda();
    },
    saatResume: () => {
      void sesi.lanjut().then((l) => {
        if (sesi.sedangDijeda) return; // sudah pause lagi sebelum resume selesai
        tampilkanLaporan(l);
        berjalan = true;
        awalSesi = { state: sesi.pengendali.state, waktu: performance.now() };
        suara.lanjut();
        terakhir = performance.now();
        requestAnimationFrame(langkah);
      });
    },
  });
}

/** Dev saja (?tanggal=…): jam dinding (Date.now) digeser ke tanggal itu, WIB; tanpa jam: 10.00 WIB. */
function geserJamDev(tanggal: string | null): void {
  if (!tanggal) return;
  const ms = Date.parse(tanggal.includes('T') ? `${tanggal}:00+07:00` : `${tanggal}T10:00:00+07:00`);
  if (!Number.isFinite(ms)) return;
  const geser = ms - Date.now();
  const asli = Date.now.bind(Date);
  Date.now = () => asli() + geser;
  console.info(`[dev] jam dinding digeser ke ${new Date(ms).toISOString()}`);
}

/** Pilihan mode sinema → tampilan adegan: satu hari tampilan ≈ 1 atau 3 menit, kerumunan ikut dipercepat. */
function opsiSinema(p: PengaturanSinema): OpsiSinema {
  const sehari = 24 * WAKTU.detikPerJam;
  const detikPerDetik = p.waktu === 'cepat' ? sehari / 60 : p.waktu === 'sedang' ? sehari / 180 : 0;
  const kecepatanDunia = p.waktu === 'cepat' ? 4 : p.waktu === 'sedang' ? 2 : 0;
  return { detikPerDetik, kecepatanDunia, cuaca: p.cuaca };
}

void mulai().catch((e: unknown) => {
  console.error('Gagal memulai game', e);
});
