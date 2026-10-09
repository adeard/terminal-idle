/**
 * Format angka gaya Indonesia: 1.250 · 12,5 rb · 3,4 jt · 1,2 M · 5,6 T,
 * lalu notasi ilmiah (1,23e15) setelah triliun.
 *
 * Angka selalu DIPOTONG (bukan dibulatkan) ke presisi yang ditampilkan.
 * Pemotongan bersifat monoton, jadi kalau uang ≥ biaya maka uang yang
 * tampil juga ≥ biaya yang tampil: tidak pernah terlihat "cukup" padahal kurang.
 */
const SATUAN: ReadonlyArray<{ readonly nilai: number; readonly label: string }> = [
  { nilai: 1e12, label: 'T' },
  { nilai: 1e9, label: 'M' },
  { nilai: 1e6, label: 'jt' },
  { nilai: 1e3, label: 'rb' },
];

/** Mulai dari sini pakai notasi ilmiah. */
const BATAS_ILMIAH = 1e15;
/** Di bawah ini ditulis lengkap dengan pemisah ribuan (1.250, 9.999). */
const BATAS_SINGKATAN = 10_000;
/** Meredam error floating point saat memotong (mis. 0.3 × 10 = 2.9999…). */
const EPS = 1e-9;

export interface OpsiFormat {
  /** Jumlah desimal maksimum untuk angka < 100. 0 = bilangan bulat. Default 1. */
  readonly desimalKecil?: number;
}

export function formatAngka(nilai: number | string, opsi: OpsiFormat = {}): string {
  const x = typeof nilai === 'number' ? nilai : Number(nilai);
  if (!Number.isFinite(x)) return '–';
  if (x < 0) return `-${formatAngka(-x, opsi)}`;
  if (x >= BATAS_ILMIAH) return formatIlmiah(x);

  if (x < 100) return desimalId(potong(x, opsi.desimalKecil ?? 1));
  if (x < BATAS_SINGKATAN) return ribuan(Math.floor(x + EPS));

  for (const s of SATUAN) {
    if (x >= s.nilai) {
      const v = x / s.nilai;
      return `${desimalId(potong(v, v < 100 ? 1 : 0))} ${s.label}`;
    }
  }
  return ribuan(Math.floor(x)); // tidak tercapai: x ≥ 10.000 selalu ≥ 1 rb
}

/** Bilangan bulat lengkap dengan pemisah ribuan (1.012.000), dipotong ke bawah. */
export function formatBulat(nilai: number): string {
  return ribuan(Math.floor(nilai + EPS));
}

/** Uang: bilangan bulat di bawah 100 (tidak ada "Rp 20,4"). */
export function formatUang(nilai: number | string): string {
  return `Rp ${formatAngka(nilai, { desimalKecil: 0 })}`;
}

/** Uang bertanda untuk laba: "+Rp 1,2 jt", "−Rp 300 rb" (nol tanpa tanda). */
export function formatUangBertanda(nilai: number): string {
  if (!(Math.abs(nilai) >= 1)) return formatUang(0);
  return `${nilai > 0 ? '+' : '−'}${formatUang(Math.abs(nilai))}`;
}

/** Durasi dipotong ke bawah: "45 detik", "12 menit", "2 jam", "2 jam 15 menit". */
export function formatDurasi(detik: number): string {
  const total = Math.max(0, Math.floor(detik + EPS));
  if (total < 60) return `${total} detik`;
  const menitTotal = Math.floor(total / 60);
  if (menitTotal < 60) return `${menitTotal} menit`;
  const jam = Math.floor(menitTotal / 60);
  const menit = menitTotal % 60;
  return menit === 0 ? `${jam} jam` : `${jam} jam ${menit} menit`;
}

function formatIlmiah(x: number): string {
  let e = Math.floor(Math.log10(x));
  let m = x / 10 ** e;
  // Pembulatan log10 di dekat pangkat sepuluh: jaga 1 ≤ mantissa < 10.
  if (m >= 10) {
    m /= 10;
    e++;
  } else if (m < 1) {
    m *= 10;
    e--;
  }
  return `${desimalId(potong(m, 2))}e${e}`;
}

function potong(x: number, desimal: number): number {
  const f = 10 ** desimal;
  return Math.floor(x * f + EPS) / f;
}

function desimalId(x: number): string {
  return String(x).replace('.', ',');
}

function ribuan(n: number): string {
  return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}
