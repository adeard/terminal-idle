import { describe, expect, it } from 'vitest';
import { EKONOMI } from '../src/config/economy.config';
import { bangunanAwal } from '../src/sim/bangunan';
import { TEKNOLOGI_IDS, type TeknologiId } from '../src/sim/fitur';
import { keuanganPerJam, majukanKas } from '../src/sim/keuangan';
import { hitungOperasi, type KeadaanOperasi } from '../src/sim/operasi';
import { tarifBawaan } from '../src/sim/tarif';

const T = EKONOMI.tycoon;
const SIBUK = { ritme: 1, event: 1 } as const;
const tanpaTeknologi = Object.fromEntries(TEKNOLOGI_IDS.map((id) => [id, false])) as Record<TeknologiId, boolean>;

function terminal(ubah: Partial<KeadaanOperasi> = {}): KeadaanOperasi {
  return {
    bangunan: { ...bangunanAwal(), jalur: 2, jendela: 3 },
    petugas: [],
    tarif: tarifBawaan(),
    teknologi: tanpaTeknologi,
    po: [{ id: 'ondelOndel', level: 1, loket: 3, reputasi: 50 }],
    kelasTerminal: 0,
    perluasan: 0,
    ...ubah,
  };
}

const keu = (k: KeadaanOperasi, malam = false) => keuanganPerJam(k, hitungOperasi(k, SIBUK), malam);

describe('keuangan tycoon', () => {
  it('biaya layanan = tarif % × harga tiket (ditetapkan PO) × penumpang; sewa jendela per hari', () => {
    const k = terminal();
    const op = hitungOperasi(k, SIBUK);
    const r = keuanganPerJam(k, op, false);
    // Ondel-Ondel Lv 1: Jakarta Ekonomi = harga dasar.
    expect(r.pendapatan.layanan).toBeCloseTo(op.arus * T.hargaTiketDasar * (T.tarif.layanan.bawaan / 100), 4);
    expect(r.pendapatan.sewaLoket).toBeCloseTo((3 * T.tarif.sewaLoket.bawaan) / 24, 6);
    expect(r.pendapatan.parkir + r.pendapatan.toilet + r.pendapatan.retribusi + r.pendapatan.sewaKios).toBe(0);
  });

  it('fasilitas berbayar butuh bangunannya; tanpa juru parkir / petugas retribusi hanya separuh', () => {
    const b = { ...bangunanAwal(), jalur: 2, jendela: 3, lahanParkir: 1, posRetribusi: 1, toilet: 1 };
    const tanpa = keu(terminal({ bangunan: b }));
    const dengan = keu(terminal({ bangunan: b, petugas: ['juruParkir', 'petugasRetribusi'] }));
    expect(tanpa.pendapatan.parkir).toBeGreaterThan(0);
    expect(dengan.pendapatan.parkir).toBeCloseTo(2 * tanpa.pendapatan.parkir, 6);
    expect(dengan.pendapatan.retribusi).toBeCloseTo(2 * tanpa.pendapatan.retribusi, 6);
    expect(tanpa.pendapatan.toilet).toBeGreaterThan(0);
    // Parkir dibatasi kapasitas lahannya.
    const ramai = keu(terminal({ bangunan: { ...b, jalur: 5, jendela: 4 }, petugas: ['juruParkir'], po: [{ id: 'ondelOndel', level: 1, loket: 4, reputasi: 100 }], kelasTerminal: 3 }));
    expect(ramai.pendapatan.parkir).toBeLessThanOrEqual(T.pengantar.perUnit * T.tarif.parkir.bawaan + 1e-6);
  });

  it('biaya: gaji, perawatan, listrik (malam lebih mahal), gedung perluasan; gaji & perawatan ikut kelas terminal', () => {
    const k = terminal({ petugas: ['peron', 'satpam'] });
    const siang = keu(k);
    const malam = keu(k, true);
    expect(siang.biaya.gaji).toBeCloseTo((T.gaji.peron + T.gaji.satpam) / 24, 6);
    expect(malam.biaya.listrik).toBeCloseTo(siang.biaya.listrik * T.listrik.pengaliMalam, 6);
    expect(siang.biaya.gedung).toBe(0);
    expect(keu({ ...k, perluasan: 1 }).biaya.gedung).toBeCloseTo(T.perluasan[0]!.operasional / 24, 6);
    const tipeB = keu({ ...k, kelasTerminal: 1 });
    expect(tipeB.biaya.gaji).toBeCloseTo(siang.biaya.gaji * T.pengaliBiayaKelas[1]!, 6);
    expect(siang.laba).toBeCloseTo(siang.totalPendapatan - siang.totalBiaya, 6);
  });

  it('membangun jauh melebihi permintaan menurunkan laba (perawatan tanpa penumpang tambahan)', () => {
    const pas = keu(terminal());
    const lebih = keu(terminal({ perluasan: 1, bangunan: { ...bangunanAwal(), jalur: 4, jendela: 6, kursi: 4 }, po: [{ id: 'ondelOndel', level: 1, loket: 6, reputasi: 50 }] }));
    expect(lebih.totalPendapatan).toBeLessThan(pas.totalPendapatan * 1.2);
    expect(lebih.laba).toBeLessThan(pas.laba);
  });

  it('kas tidak pernah minus: gaji tertunggak membuat petugas berhenti tiap jam terminal', () => {
    expect(majukanKas(1_000, 500, 2, 0)).toEqual({ kas: 2_000, tunggakanJam: 0, berhenti: 0 });
    expect(majukanKas(1_000, -400, 2, 0)).toEqual({ kas: 200, tunggakanJam: 0, berhenti: 0 });
    // Kas habis setelah 0,5 jam, lalu 2 jam tertunggak: dua petugas berhenti.
    expect(majukanKas(100, -200, 2.5, 0)).toEqual({ kas: 0, tunggakanJam: 0, berhenti: 2 });
    const sebagian = majukanKas(0, -100, 0.6, 0.5);
    expect(sebagian.kas).toBe(0);
    expect(sebagian.berhenti).toBe(1);
    expect(sebagian.tunggakanJam).toBeCloseTo(0.1, 10);
    // Laba kembali positif: tunggakan dihapus.
    expect(majukanKas(0, 300, 1, 0.7)).toEqual({ kas: 300, tunggakanJam: 0, berhenti: 0 });
    expect(majukanKas(50, -10, 0, 0.3)).toEqual({ kas: 50, tunggakanJam: 0.3, berhenti: 0 });
  });
});
