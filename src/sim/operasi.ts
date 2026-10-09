/**
 * Operasi terminal (murni): kapasitas tiap area dari bangunan &
 * petugas, pasar penumpang mutlak per jurusan yang dibagi ke PO, arus yang
 * dibatasi jendela loket tiap PO dan area bersama (peron, keberangkatan,
 * pangkalan), kepuasan penumpang, dan kepuasan mitra PO.
 *
 * Kepuasan dihitung dari keadaan jam sibuk pada daya tarik 1 (bukan arus
 * sekarang), supaya tidak naik-turun mengikuti jam dan tidak berputar balik
 * lewat permintaan. Satuan arus: penumpang per jam terminal.
 * Rancangan: bagian 4 & 7 documents/13-rancangan-tycoon.md.
 */
import { EKONOMI, type KonfigEkonomi } from '../config/economy.config';
import { petakBus, type JumlahBangunan } from './bangunan';
import { TEKNOLOGI_IDS, type KelasBusId, type PetugasId, type PoId, type TeknologiId } from './fitur';
import { faktorReputasi, jurusanAktif, kelasAktif, nilaiJurusan, nilaiTiketPo } from './mitra';
import { hitungPetugas } from './petugas';
import type { TahapId } from './tahap';
import { faktorLayanan, skorHargaPenumpang, skorTarifMitra, type NilaiTarif } from './tarif';

/** PO terdaftar sebagaimana dibutuhkan hitungan operasi. */
export interface PoOperasi {
  readonly id: PoId;
  readonly level: number;
  /** Jendela loket yang disewa PO ini. */
  readonly loket: number;
  /** 0–100. */
  readonly reputasi: number;
}

/** Keadaan terminal yang menentukan operasinya. */
export interface KeadaanOperasi {
  readonly bangunan: JumlahBangunan;
  /** Petugas, urut rekrut (lihat sim/petugas.ts). */
  readonly petugas: readonly PetugasId[];
  readonly tarif: NilaiTarif;
  readonly teknologi: Readonly<Record<TeknologiId, boolean>>;
  readonly po: readonly PoOperasi[];
  readonly kelasTerminal: number;
  readonly perluasan: number;
}

/** Saat ini: ritme jam (0–1, sudah dilandaikan), pengali pasar dari event musiman. */
export interface KondisiOperasi {
  readonly ritme: number;
  readonly event: number;
}

export interface KapasitasArea {
  readonly peron: number;
  readonly loket: number;
  readonly keberangkatan: number;
  readonly pangkalan: number;
}
export type AreaId = keyof KapasitasArea;
/** Urutan area: alur penumpang (peron, loket, keberangkatan) lalu pangkalan bus. */
export const AREA_IDS: readonly AreaId[] = ['peron', 'loket', 'keberangkatan', 'pangkalan'];

export interface KepuasanTycoon {
  /** 0–1: rata-rata berbobot komponen. */
  readonly nilai: number;
  readonly kelancaran: number;
  readonly kenyamanan: number;
  readonly kebersihan: number;
  readonly keamanan: number;
  readonly fasilitas: number;
  readonly harga: number;
}

/** Satu segmen (PO × jurusan × kelas bus) yang sedang dilayani. */
export interface SegmenOperasi {
  readonly po: PoId;
  readonly jurusan: number;
  readonly kelas: KelasBusId;
  /** Penumpang per jam sekarang. */
  readonly arus: number;
  /** Harga tiket normal (Rp), ditetapkan PO. */
  readonly harga: number;
}

export interface PoHasilOperasi {
  readonly id: PoId;
  /** Kapasitas jendela loket PO ini. */
  readonly kapasitasLoket: number;
  /** Permintaan jam sibuk pada daya tarik 1. */
  readonly permintaanPuncak: number;
  /** Permintaan & arus sekarang. */
  readonly permintaan: number;
  readonly arus: number;
  /** 0–1 (lihat KonfigTycoon.mitra). */
  readonly kepuasanMitra: number;
}

export interface HasilOperasi {
  readonly kapasitas: KapasitasArea;
  /** Yang membatasi arus jam sibuk: area, atau null bila permintaan (pasar) yang membatasi. */
  readonly bottleneck: AreaId | null;
  /** Permintaan & arus jam sibuk pada daya tarik 1: dasar kepuasan, keramaian, & sewa kios. */
  readonly permintaanPuncak: number;
  readonly arusPuncak: number;
  readonly kepuasan: KepuasanTycoon;
  /** Permintaan & arus sekarang (ritme jam, kepuasan, event). */
  readonly permintaan: number;
  readonly arus: number;
  readonly segmen: readonly SegmenOperasi[];
  readonly po: readonly PoHasilOperasi[];
}

const jepit01 = (x: number): number => Math.min(1, Math.max(0, x));

/** Pengali kapasitas modernisasi yang terpasang untuk satu area. */
export function multTeknologi(teknologi: Readonly<Record<TeknologiId, boolean>>, tahap: TahapId, cfg: KonfigEkonomi = EKONOMI): number {
  let m = 1;
  for (const id of TEKNOLOGI_IDS) if (teknologi[id] && cfg.teknologi[id].tahap === tahap) m *= cfg.teknologi[id].multKapasitas;
  return m;
}

/** Kapasitas area bersama & jendela loket tiap PO (urut k.po). */
export function hitungKapasitas(k: KeadaanOperasi, cfg: KonfigEkonomi = EKONOMI): { readonly area: KapasitasArea; readonly loketPo: readonly number[] } {
  const kap = cfg.tycoon.kapasitas;
  const n = hitungPetugas(k.petugas);
  const halte = Math.max(0, k.bangunan.jalur);
  const loketPo = k.po.map((p) => kap.jendela * Math.max(0, p.loket) * multTeknologi(k.teknologi, 'loket', cfg));
  return {
    area: {
      peron: kap.halte * (halte + kap.bonusPetugas * Math.min(n.peron, halte)) * multTeknologi(k.teknologi, 'peron', cfg),
      loket: loketPo.reduce((a, b) => a + b, 0),
      keberangkatan: kap.gerbang * (halte + kap.bonusPetugas * Math.min(n.gerbang, halte)) * multTeknologi(k.teknologi, 'keberangkatan', cfg),
      pangkalan: (petakBus(k.perluasan, cfg) * kap.penumpangPerBus) / kap.jamParkirBus,
    },
    loketPo,
  };
}

interface SegmenDasar {
  readonly po: number;
  readonly jurusan: number;
  readonly kelas: KelasBusId;
  /** Permintaan jam sibuk pada daya tarik 1. */
  readonly puncak: number;
  readonly harga: number;
}

/**
 * Permintaan jam sibuk tiap segmen pada daya tarik 1. Pasar tiap jurusan dibagi
 * ke PO yang melayaninya menurut reputasi (persaingan); makin banyak PO di satu
 * jurusan, pasarnya membesar tapi makin jenuh (kejenuhan, seperti 0.2.0). Lalu
 * tiap PO membaginya ke kelas busnya menurut peminat kelas, dan biaya layanan
 * terminal mengurangi peminat menurut elastisitas.
 */
function segmenDasar(k: KeadaanOperasi, cfg: KonfigEkonomi): SegmenDasar[] {
  const t = cfg.tycoon;
  const pengaliKelas = t.pasar.pengaliKelas[Math.min(t.pasar.pengaliKelas.length - 1, Math.max(0, k.kelasTerminal))] ?? 1;
  const info = k.po.map((p) => {
    const ada = p.loket > 0;
    const kelas = ada ? kelasAktif(p.id, p.level, k.kelasTerminal, cfg) : [];
    return {
      p,
      jurusan: ada && kelas.length > 0 ? jurusanAktif(p.id, p.level, k.kelasTerminal, cfg) : [],
      kelas,
      daya: faktorReputasi(p.reputasi, cfg),
      peminatKelas: kelas.reduce((a, kb) => a + cfg.kelasBus[kb].peminat, 0),
    };
  });
  const perJurusan = new Map<number, { n: number; daya: number }>();
  for (const x of info) {
    for (const j of x.jurusan) {
      const e = perJurusan.get(j) ?? { n: 0, daya: 0 };
      e.n += 1;
      e.daya += x.daya;
      perJurusan.set(j, e);
    }
  }
  const hasil: SegmenDasar[] = [];
  info.forEach((x, i) => {
    for (const j of x.jurusan) {
      const cj = cfg.jurusan[j]!;
      const e = perJurusan.get(j)!;
      const persaingan = Math.pow(x.daya / (e.daya / e.n), cfg.mitra.persaingan.gamma);
      const kejenuhan = 1 / (1 + (cfg.mitra.persaingan.kejenuhan / cj.peminat) * (e.n - 1));
      const pasarPo = t.pasar.perPeminat * cj.peminat * pengaliKelas * persaingan * kejenuhan;
      for (const kb of x.kelas) {
        const ck = cfg.kelasBus[kb];
        const elastisitas = (cj.elastisitas + ck.elastisitas) / 2;
        hasil.push({
          po: i,
          jurusan: j,
          kelas: kb,
          puncak: pasarPo * (ck.peminat / x.peminatKelas) * faktorLayanan(k.tarif.layanan, elastisitas, cfg),
          harga: t.hargaTiketDasar * nilaiJurusan(j, cfg) * cfg.mitra.kelas[kb].nilai * nilaiTiketPo(x.p.level, cfg),
        });
      }
    }
  });
  return hasil;
}

/**
 * Arus tiap PO dari permintaannya: dibatasi jendela loket PO itu, lalu
 * bersama-sama oleh peron, keberangkatan, & pangkalan (dipotong sebanding).
 */
function alirkan(permintaanPo: readonly number[], loketPo: readonly number[], area: KapasitasArea): { readonly arusPo: number[]; readonly potong: number; readonly batas: AreaId | null } {
  const dilayani = permintaanPo.map((d, i) => Math.min(d, loketPo[i] ?? 0));
  const total = dilayani.reduce((a, b) => a + b, 0);
  let potong = 1;
  let batas: AreaId | null = permintaanPo.some((d, i) => d > (loketPo[i] ?? 0) + 1e-9) ? 'loket' : null;
  for (const a of ['peron', 'keberangkatan', 'pangkalan'] as const) {
    if (total > 0 && area[a] / total < potong) {
      potong = area[a] / total;
      batas = a;
    }
  }
  return { arusPo: dilayani.map((x) => x * potong), potong, batas };
}

function hitungKepuasan(k: KeadaanOperasi, permintaanPuncak: number, arusPuncak: number, cfg: KonfigEkonomi): KepuasanTycoon {
  const kp = cfg.tycoon.kepuasan;
  const t = cfg.tycoon;
  const n = hitungPetugas(k.petugas);
  const b = k.bangunan;
  const arus = Math.max(0, arusPuncak);
  const kelancaran = permintaanPuncak > 0 ? jepit01((arus / permintaanPuncak - kp.rasioNol) / (kp.rasioLancar - kp.rasioNol)) : 1;
  const kenyamanan = jepit01((b.kursi * kp.kursiPerBlok) / Math.max(1, arus * kp.jamTunggu)) * (k.teknologi.jadwalDigital ? 1 : 0.9);
  // Toilet tanpa petugasnya cepat kotor.
  const toiletTerurus = b.toilet > 0 && n.petugasToilet < b.toilet ? 0.85 : 1;
  const kebersihan = jepit01(n.kebersihan / Math.max(1, arus / kp.arusPerPetugasKebersihan)) * toiletTerurus;
  const keamanan = b.jalur > 0 ? jepit01(n.satpam / b.jalur) : 0;
  const fasilitas =
    (jepit01((b.toilet * t.pemakaiToilet.perUnit) / Math.max(1, arus * t.pemakaiToilet.bagian)) +
      jepit01((b.kios + b.toko) / Math.max(1, arus / kp.arusPerKios)) +
      jepit01((b.lahanParkir * t.pengantar.perUnit) / Math.max(1, arus * t.pengantar.bagian))) /
    3;
  const harga = skorHargaPenumpang(k.tarif, { parkir: b.lahanParkir > 0, toilet: b.toilet > 0 }, cfg);
  const w = kp.bobot;
  const nilai =
    (w.kelancaran * kelancaran + w.kenyamanan * kenyamanan + w.kebersihan * kebersihan + w.keamanan * keamanan + w.fasilitas * fasilitas + w.harga * harga) /
    (w.kelancaran + w.kenyamanan + w.kebersihan + w.keamanan + w.fasilitas + w.harga);
  return { nilai, kelancaran, kenyamanan, kebersihan, keamanan, fasilitas, harga };
}

/** Pengali permintaan dari kepuasan (0–1). */
export function dayaTarikTycoon(kepuasan: number, cfg: KonfigEkonomi = EKONOMI): number {
  return cfg.tycoon.pasar.dayaTarikDasar + cfg.tycoon.pasar.dayaTarikPerKepuasan * jepit01(kepuasan);
}

/** Retribusi bus dipungut: ada pos retribusi (tanpa petugasnya hanya separuh, lihat keuangan.ts). */
export function retribusiDipungut(k: Pick<KeadaanOperasi, 'bangunan'>): boolean {
  return k.bangunan.posRetribusi > 0;
}

export function hitungOperasi(k: KeadaanOperasi, kondisi: KondisiOperasi, cfg: KonfigEkonomi = EKONOMI): HasilOperasi {
  const { area, loketPo } = hitungKapasitas(k, cfg);
  const dasar = segmenDasar(k, cfg);
  const puncakPo = k.po.map(() => 0);
  for (const s of dasar) puncakPo[s.po]! += s.puncak;
  const permintaanPuncak = puncakPo.reduce((a, b) => a + b, 0);
  const jamSibuk = alirkan(puncakPo, loketPo, area);
  const arusPuncak = jamSibuk.arusPo.reduce((a, b) => a + b, 0);
  const kepuasan = hitungKepuasan(k, permintaanPuncak, arusPuncak, cfg);

  // Sekarang: permintaan ikut daya tarik kepuasan, ritme jam, & event; kapasitas tetap.
  const pengali = dayaTarikTycoon(kepuasan.nilai, cfg) * Math.max(0, kondisi.ritme) * Math.max(0, kondisi.event);
  const permintaanPo = puncakPo.map((d) => d * pengali);
  const kini = alirkan(permintaanPo, loketPo, area);
  const segmen: SegmenOperasi[] = dasar.map((s) => {
    const d = permintaanPo[s.po]!;
    const bagian = d > 0 ? kini.arusPo[s.po]! / d : 0;
    return { po: k.po[s.po]!.id, jurusan: s.jurusan, kelas: s.kelas, arus: s.puncak * pengali * bagian, harga: s.harga };
  });

  const m = cfg.tycoon.mitra;
  const skorTarif = skorTarifMitra(k.tarif, retribusiDipungut(k), cfg);
  const po: PoHasilOperasi[] = k.po.map((p, i) => {
    const kap = loketPo[i]!;
    const d = puncakPo[i]!;
    // Bus penuh (permintaan mengisi jendela) & jendela cukup (antrean pendek) saling tarik: paling puas saat seimbang.
    const penuh = kap > 0 ? jepit01(d / kap) : 0;
    const jendela = d > 0 ? jepit01(kap / d) : 1;
    const kepuasanMitra = (m.bobot.tarif * skorTarif + m.bobot.penuh * penuh + m.bobot.jendela * jendela + m.bobot.kepuasan * kepuasan.nilai) / (m.bobot.tarif + m.bobot.penuh + m.bobot.jendela + m.bobot.kepuasan);
    return { id: p.id, kapasitasLoket: kap, permintaanPuncak: d, permintaan: permintaanPo[i]!, arus: kini.arusPo[i]!, kepuasanMitra };
  });

  return {
    kapasitas: area,
    bottleneck: jamSibuk.batas,
    permintaanPuncak,
    arusPuncak,
    kepuasan,
    permintaan: permintaanPo.reduce((a, b) => a + b, 0),
    arus: kini.arusPo.reduce((a, b) => a + b, 0),
    segmen,
    po,
  };
}
