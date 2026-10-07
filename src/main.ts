import './ui/gaya.css';
import { bacaAkunAktif, hapusDataAkun, keluarAkun, masukAkun, SlotAkun } from './app/akun';
import { PencatatAnalitik, pesanGalat } from './app/analitik';
import type { TempatIklan } from './app/iklan';
import { LayananPeringkat } from './app/layanan-peringkat';
import { SesiGame, slotLokal, type Logger } from './app/sesi';
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
import { isEventId } from './sim/fitur';
import { bisaAktifkanBoost, bisaKlaimBonusOffline, hadiahBusEmas, semuaOtomatis, type LaporanOffline } from './sim/state';
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
import { TEKS } from './ui/teks';

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
  sesi.pengendali.pantauAksi((aksi, lama, baru) => analitik.catatAksi(aksi, lama, baru));
  // Mitra PO yang bergabung (bersama jurusan atau lewat kontrak).
  let jumlahPo = sesi.pengendali.state.armada.po.length;
  sesi.pengendali.berlangganan((s) => {
    const po = s.armada.po;
    for (const id of po.slice(jumlahPo)) analitik.catat('po_bergabung', { po: id, cara: EKONOMI.po.syarat[id].jenis });
    jumlahPo = po.length;
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
  // Iklan berhadiah (platform/iklan.ts): suara game dibisukan selama iklan diputar.
  const bisuSelamaIklan = { sebelum: (): void => {}, sesudah: (): void => {} };
  const iklan = buatPenyediaIklan({ akar: ui, sebelum: () => bisuSelamaIklan.sebelum(), sesudah: () => bisuSelamaIklan.sesudah() });
  const tontonIklan = async (tempat: TempatIklan): Promise<boolean> => {
    const hasil = await iklan.tonton(tempat).catch(() => 'gagal' as const);
    analitik.catat('iklan_hadiah', { tempat, hasil });
    return hasil === 'ditonton';
  };
  // Papan peringkat mingguan (hanya web, seperti akun): tamu hanya melihat, pemain login bisa ikut.
  const apiPeringkat = buatApiPeringkat(() => (uidAktif === null ? Promise.resolve(null) : tokenAkun(uidAktif)));
  const peringkat = bisaLogin
    ? new LayananPeringkat({ api: apiPeringkat, uid: uidAktif, ambilState: () => sesi.pengendali.state, kirimAksi: (a) => sesi.pengendali.kirim(a) })
    : null;
  if (peringkat) sesi.pengendali.berlangganan((s) => peringkat.periksa(s));
  // Menu akun dipasang di bawah; tombol "Masuk untuk ikut" di papan peringkat memanggilnya lewat ini.
  let bukaAkun: () => void = () => {};
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
  });
  // Tutorial terpandu untuk pemain baru; statusnya disimpan per perangkat.
  const KUNCI_TUTORIAL = 'terminal-bus-tycoon/tutorial';
  const statusTutorial = await penyimpanan.baca(KUNCI_TUTORIAL).catch(() => null);
  pasangTutorial({
    akar: ui,
    area: overlay.area,
    pengendali: sesi.pengendali,
    status: STATUS_TUTORIAL.find((st) => st === statusTutorial) ?? null,
    simpan: (st) => void penyimpanan.tulis(KUNCI_TUTORIAL, st).catch(() => undefined),
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
      tonton: async () => {
        if (!(await tontonIklan('boost'))) return false;
        kirim({ jenis: 'aktifkanBoost' });
        overlay.notif(TEKS.notifBoost(formatDurasi(sesi.pengendali.state.hadiah.boostDetik)));
        return true;
      },
    });
  };
  const bukaBusEmas = (): void => {
    kirim({ jenis: 'tahanBusEmas' });
    const hadiah = hadiahBusEmas(sesi.pengendali.state);
    void tampilkanPopupHadiah(ui, {
      kelas: 'hadiah-bus-emas',
      ikon: IKON_BUS_EMAS,
      judul: TEKS.busEmasJudul,
      teks: TEKS.busEmasTeks(EKONOMI.hadiah.busEmasMenit),
      hadiah: `+${formatUang(hadiah)}`,
      tombol: TEKS.busEmasTonton,
      bisa: true,
      tonton: async () => {
        if (!(await tontonIklan('busEmas'))) return false;
        const sebelum = sesi.pengendali.state.uang;
        kirim({ jenis: 'klaimBusEmas' });
        overlay.notif(TEKS.notifBusEmas(formatUang(sesi.pengendali.state.uang.sub(sebelum))));
        return true;
      },
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
  let terminal: Terminal3D | null = null;
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
    const s = sesi.pengendali.state;
    // Bonus 2× lewat iklan: hanya kalau ada penghasilan offline yang belum digandakan.
    const ganda =
      iklan.siap() && bisaKlaimBonusOffline(s)
        ? async (): Promise<boolean> => {
            if (!(await tontonIklan('offline2x'))) return false;
            kirim({ jenis: 'klaimBonusOffline' });
            return true;
          }
        : undefined;
    void tampilkanPopupOffline(ui, l, semuaOtomatis(s), ganda);
  };
  tampilkanLaporan(laporan);
  saatSaveDiganti = (l) => {
    overlay.notif(TEKS.notifSaveDiganti);
    tampilkanLaporan(l);
  };

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
    if (terminal) {
      terminal.perbarui(dt, kecepatan);
      tombolKamera?.perbarui(terminal.arahUtara);
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
