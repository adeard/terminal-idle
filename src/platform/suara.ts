/**
 * Mesin suara Web Audio. Semua bunyi disintesis (derau + osilator), tanpa file
 * audio, jadi ukuran APK tidak bertambah:
 *   - lapisan latar yang kekerasannya diatur tiap frame: riuh orang, mesin
 *     diesel langsam, lalu lintas, semprotan cuci, jangkrik malam, hujan;
 *   - bunyi sesaat: rem angin, deru bus berangkat, klakson, bel pengumuman.
 * Pengumuman diucapkan dengan speechSynthesis bila perangkat punya suara
 * bahasa Indonesia; kalau tidak (mis. sebagian WebView Android), hanya bel.
 *
 * Aturan autoplay browser/WebView: AudioContext baru dibuat setelah sentuhan
 * atau tombol pertama. Pilihan nyala/mati disimpan lewat Penyimpanan.
 */
import type { Penyimpanan } from '../app/sesi';
import type { Bunyi, LapisanSuara, PenerimaSuara } from '../game/suara';

const KUNCI_PILIHAN = 'terminal-bus-tycoon/suara';
const VOLUME = 1;
/** Kekerasan maksimum tiap lapisan latar (gain). */
const MAKS_LAPISAN: Readonly<Record<keyof LapisanSuara, number>> = {
  riuh: 0.3,
  mesin: 0.34,
  lalin: 0.16,
  semprot: 0.12,
  jangkrik: 0.05,
  hujan: 0.24,
};
/** Konstanta waktu perubahan kekerasan lapisan (detik): halus, tanpa klik. */
const TAU_LAPISAN = 0.35;
/** Bunyi sesaat per jenis per frame paling banyak sekian (mis. banyak bus berhenti bersamaan). */
const MAKS_BUNYI_PER_JENIS = 2;
/**
 * Melodi klakson telolet: [frekuensi Hz, lama detik] per nada, nada terakhir
 * ditahan ("te-lo-leeet"). Jumlahnya = JUMLAH_MELODI_TELOLET (game/telolet.ts).
 */
const MELODI_TELOLET: readonly (readonly (readonly [number, number])[])[] = [
  [
    [659, 0.13],
    [523, 0.13],
    [784, 0.55],
  ],
  [
    [523, 0.1],
    [659, 0.1],
    [784, 0.1],
    [1047, 0.5],
  ],
  [
    [784, 0.12],
    [659, 0.12],
    [784, 0.12],
    [523, 0.5],
  ],
  [
    [587, 0.11],
    [740, 0.11],
    [880, 0.11],
    [740, 0.11],
    [880, 0.5],
  ],
];

type Lapisan = keyof LapisanSuara;

export class MesinSuara implements PenerimaSuara {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private derau: AudioBuffer | null = null;
  private readonly lapisan = new Map<Lapisan, GainNode>();
  private suaraIndonesia: SpeechSynthesisVoice | null = null;
  private nyala_ = true;
  private dijeda = false;
  private gagal = false;

  private constructor(private readonly penyimpanan: Penyimpanan) {}

  /** Baca pilihan tersimpan lalu pasang pemicu: suara mulai setelah interaksi pertama. */
  static async buat(penyimpanan: Penyimpanan): Promise<MesinSuara> {
    const m = new MesinSuara(penyimpanan);
    try {
      m.nyala_ = (await penyimpanan.baca(KUNCI_PILIHAN)) !== '0';
    } catch {
      // Pilihan tidak terbaca: pakai bawaan (nyala).
    }
    const pemicu = (): void => {
      window.removeEventListener('pointerdown', pemicu, true);
      window.removeEventListener('keydown', pemicu, true);
      if (m.nyala_) m.bangun();
    };
    window.addEventListener('pointerdown', pemicu, true);
    window.addEventListener('keydown', pemicu, true);
    m.muatSuaraBicara();
    return m;
  }

  get nyala(): boolean {
    return this.nyala_;
  }

  /** Dipanggil dari tombol (interaksi pengguna), jadi AudioContext boleh dimulai di sini. */
  aturNyala(nyala: boolean): void {
    this.nyala_ = nyala;
    void this.penyimpanan.tulis(KUNCI_PILIHAN, nyala ? '1' : '0').catch(() => undefined);
    if (nyala) this.bangun();
    if (this.ctx && this.master) this.master.gain.setTargetAtTime(nyala ? VOLUME : 0, this.ctx.currentTime, 0.08);
    if (!nyala) this.hentikanBicara();
  }

  jeda(): void {
    this.dijeda = true;
    this.hentikanBicara();
    void this.ctx?.suspend().catch(() => undefined);
  }

  lanjut(): void {
    this.dijeda = false;
    if (this.nyala_) void this.ctx?.resume().catch(() => undefined);
  }

  perbarui(lapisan: LapisanSuara, bunyi: readonly Bunyi[]): void {
    const ctx = this.ctx;
    if (!ctx || !this.nyala_ || this.dijeda || ctx.state !== 'running') return;
    const t = ctx.currentTime;
    for (const [nama, gain] of this.lapisan) gain.gain.setTargetAtTime(lapisan[nama] * MAKS_LAPISAN[nama], t, TAU_LAPISAN);
    const hitung = new Map<string, number>();
    for (const b of bunyi) {
      const n = hitung.get(b.jenis) ?? 0;
      if (n >= MAKS_BUNYI_PER_JENIS) continue;
      hitung.set(b.jenis, n + 1);
      if (b.jenis === 'pengumuman') this.umumkan(b.teks ?? '');
      else if (b.keras > 0.02) this.bunyikan(b);
    }
  }

  // -------------------------------------------------------------------------
  // Grafik audio

  private bangun(): void {
    if (this.gagal) return;
    if (this.ctx) {
      if (!this.dijeda) void this.ctx.resume().catch(() => undefined);
      return;
    }
    try {
      const Kelas = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Kelas) throw new Error('Web Audio tidak tersedia');
      const ctx = new Kelas();
      this.ctx = ctx;
      // Kompresor menjaga banyak bunyi bersamaan tidak pecah (clipping).
      const kompresor = ctx.createDynamicsCompressor();
      kompresor.threshold.value = -14;
      kompresor.ratio.value = 4;
      kompresor.connect(ctx.destination);
      this.master = ctx.createGain();
      this.master.gain.value = this.nyala_ ? VOLUME : 0;
      this.master.connect(kompresor);
      this.derau = bufferDerau(ctx, 4);
      this.bangunLapisan(ctx, this.master);
      void ctx.resume().catch(() => undefined);
    } catch (e) {
      this.gagal = true;
      console.warn('[suara] Web Audio tidak bisa dimulai', e);
    }
  }

  private bangunLapisan(ctx: AudioContext, keluar: AudioNode): void {
    const lapisan = (nama: Lapisan): GainNode => {
      const g = ctx.createGain();
      g.gain.value = 0;
      g.connect(keluar);
      this.lapisan.set(nama, g);
      return g;
    };
    const derau = (): AudioBufferSourceNode => {
      const s = ctx.createBufferSource();
      s.buffer = this.derau;
      s.loop = true;
      s.start(0, Math.random() * 3.5);
      return s;
    };
    const filter = (jenis: BiquadFilterType, frek: number, q = 0.707): BiquadFilterNode => {
      const f = ctx.createBiquadFilter();
      f.type = jenis;
      f.frequency.value = frek;
      f.Q.value = q;
      return f;
    };
    /** Modulasi amplitudo: gain = dasar + Σ sinus (frekuensi, kedalaman). */
    const modulasi = (dasar: number, lfo: readonly (readonly [number, number])[]): GainNode => {
      const g = ctx.createGain();
      g.gain.value = dasar;
      for (const [frek, dalam] of lfo) {
        const o = ctx.createOscillator();
        o.frequency.value = frek;
        const d = ctx.createGain();
        d.gain.value = dalam;
        o.connect(d).connect(g.gain);
        o.start();
      }
      return g;
    };
    const rantai = (...node: AudioNode[]): void => {
      for (let i = 1; i < node.length; i++) node[i - 1]!.connect(node[i]!);
    };

    // Riuh: tiga "suara" derau berformant dengan tempo suku kata berbeda → celoteh orang banyak.
    const riuh = lapisan('riuh');
    const lpRiuh = filter('lowpass', 2600);
    lpRiuh.connect(riuh);
    for (const [frek, q, lfo] of [
      [480, 1.1, [[3.1, 0.22], [5.3, 0.16]]],
      [950, 1.4, [[4.2, 0.24], [2.3, 0.14]]],
      [1750, 1.8, [[5.7, 0.2], [3.7, 0.15]]],
    ] as const) {
      rantai(derau(), filter('bandpass', frek, q), modulasi(0.55, lfo), lpRiuh);
    }

    // Mesin diesel langsam: dengung gigi gergaji rendah + "dug-dug" letupan silinder.
    const mesin = lapisan('mesin');
    const lpMesin = filter('lowpass', 280, 1.3);
    const dug = modulasi(0.7, [[11.5, 0.3]]);
    rantai(lpMesin, dug, mesin);
    for (const [frek, jenis, keras] of [
      [34, 'sawtooth', 0.5],
      [51.3, 'sawtooth', 0.3],
      [17, 'square', 0.25],
    ] as const) {
      const o = ctx.createOscillator();
      o.type = jenis;
      o.frequency.value = frek;
      const g = ctx.createGain();
      g.gain.value = keras;
      rantai(o, g, lpMesin);
      o.start();
    }
    rantai(derau(), filter('lowpass', 160), modulasi(0.25, []), mesin);

    // Lalu lintas: gemuruh ban & mesin di kejauhan, naik-turun pelan seperti kendaraan lewat.
    const lalin = lapisan('lalin');
    rantai(derau(), filter('lowpass', 480), modulasi(0.8, [[0.13, 0.3], [0.31, 0.2]]), lalin);
    rantai(derau(), filter('bandpass', 1100, 0.6), modulasi(0.18, [[0.19, 0.1]]), lalin);

    // Semprotan air cuci bus.
    const semprot = lapisan('semprot');
    rantai(derau(), filter('highpass', 1500), filter('bandpass', 3600, 0.6), modulasi(0.85, [[7.3, 0.15], [0.9, 0.1]]), semprot);

    // Jangkrik malam (buffer yang sudah disintesis, diputar berulang).
    const jangkrik = lapisan('jangkrik');
    const sj = ctx.createBufferSource();
    sj.buffer = bufferJangkrik(ctx);
    sj.loop = true;
    sj.connect(jangkrik);
    sj.start();

    // Hujan: desis lebar + gemeretak tetes di atap.
    const hujan = lapisan('hujan');
    rantai(derau(), filter('highpass', 350), filter('lowpass', 7000), modulasi(0.7, [[0.23, 0.12]]), hujan);
    rantai(derau(), filter('bandpass', 2400, 2.5), modulasi(0.35, [[13, 0.2], [17.5, 0.15]]), hujan);
  }

  // -------------------------------------------------------------------------
  // Bunyi sesaat

  private bunyikan(b: Bunyi): void {
    const ctx = this.ctx!;
    const t = ctx.currentTime + 0.01 + (b.tunda ?? 0);
    const pan = ctx.createStereoPanner();
    pan.pan.value = Math.max(-1, Math.min(1, b.pan)) * 0.8;
    pan.connect(this.master!);
    const selubung = (puncak: number, serang: number, tahan: number, lepas: number, mulai = t): GainNode => {
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, mulai);
      g.gain.exponentialRampToValueAtTime(puncak, mulai + serang);
      g.gain.setValueAtTime(puncak, mulai + serang + tahan);
      g.gain.exponentialRampToValueAtTime(0.0001, mulai + serang + tahan + lepas);
      g.connect(pan);
      return g;
    };
    const sumberDerau = (mulai: number, lama: number): AudioBufferSourceNode => {
      const s = ctx.createBufferSource();
      s.buffer = this.derau;
      s.start(mulai, Math.random() * 3, lama);
      return s;
    };
    const osc = (jenis: OscillatorType, frek: number, mulai: number, lama: number): OscillatorNode => {
      const o = ctx.createOscillator();
      o.type = jenis;
      o.frequency.value = frek;
      o.start(mulai);
      o.stop(mulai + lama);
      return o;
    };
    const filter = (jenis: BiquadFilterType, frek: number, q = 0.707): BiquadFilterNode => {
      const f = ctx.createBiquadFilter();
      f.type = jenis;
      f.frequency.value = frek;
      f.Q.value = q;
      return f;
    };

    switch (b.jenis) {
      case 'rem': {
        // Rem angin "pssst": desis tinggi yang cepat meluruh.
        const g = selubung(0.32 * b.keras, 0.012, 0.05, 0.85);
        sumberDerau(t, 1).connect(filter('highpass', 2200)).connect(filter('bandpass', 5200, 0.9)).connect(g);
        break;
      }
      case 'deru': {
        // Bus berangkat: putaran mesin naik lalu turun saat pindah gigi.
        const g = selubung(0.3 * b.keras, 0.25, 1.6, 1.4);
        const lp = filter('lowpass', 320, 1.2);
        lp.frequency.setValueAtTime(320, t);
        lp.frequency.linearRampToValueAtTime(700, t + 1.6);
        lp.frequency.linearRampToValueAtTime(420, t + 3);
        lp.connect(g);
        for (const kali of [1, 1.5]) {
          const o = osc('sawtooth', 33 * kali, t, 3.4);
          o.frequency.setValueAtTime(33 * kali, t);
          o.frequency.linearRampToValueAtTime(60 * kali, t + 1.7);
          o.frequency.linearRampToValueAtTime(46 * kali, t + 2.2);
          o.frequency.linearRampToValueAtTime(52 * kali, t + 3.2);
          o.connect(lp);
        }
        break;
      }
      case 'klakson': {
        // Bus: klakson terompet rendah (dua nada). Kendaraan kecil: lebih nyaring & pendek.
        const kecil = b.kecil === true;
        const nada = kecil ? [415, 523] : [311, 370];
        const lama = kecil ? 0.22 : 0.42;
        const tekan = b.ganda ? [0, lama * 0.55 + 0.1] : [0];
        for (const dt of tekan) {
          const panjang = b.ganda ? lama * 0.55 : lama;
          const g = selubung((kecil ? 0.14 : 0.2) * b.keras, 0.015, panjang, 0.06, t + dt);
          const f = filter(kecil ? 'bandpass' : 'lowpass', kecil ? 1500 : 2300, kecil ? 0.8 : 0.707);
          f.connect(g);
          for (const frek of nada) osc(kecil ? 'square' : 'sawtooth', frek, t + dt, panjang + 0.1).connect(f);
        }
        break;
      }
      case 'telolet': {
        // Beberapa terompet angin memainkan melodi pendek. Tiap nada diawali sedikit di
        // bawah nadanya lalu naik ke tempat (khas terompet angin), dua lapis sedikit sumbang
        // + satu oktaf di bawah supaya terdengar tebal & nyaring.
        const melodi = MELODI_TELOLET[(b.melodi ?? 0) % MELODI_TELOLET.length]!;
        let mulai = t;
        for (const [frek, lama] of melodi) {
          const g = selubung(0.2 * b.keras, 0.018, lama, 0.07, mulai);
          const lp = filter('lowpass', 3000, 0.9);
          lp.connect(g);
          for (const [kali, sen, jenis, keras] of [
            [1, -7, 'sawtooth', 0.5],
            [1, 7, 'sawtooth', 0.5],
            [0.5, 0, 'square', 0.18],
          ] as const) {
            const o = osc(jenis, frek * kali, mulai, lama + 0.12);
            o.detune.setValueAtTime(sen - 70, mulai);
            o.detune.linearRampToValueAtTime(sen, mulai + 0.035);
            const gk = ctx.createGain();
            gk.gain.value = keras;
            o.connect(gk).connect(lp);
          }
          mulai += lama + 0.035;
        }
        break;
      }
      case 'guntur': {
        // Gemuruh: derau rendah bergulung-gulung lalu meluruh; sambaran dekat diawali ledakan tajam.
        const tunda = b.tunda ?? 2;
        const lama = 3.2 + tunda * 0.7;
        const n = 96;
        const kurva = new Float32Array(n);
        for (let i = 0; i < n; i++) {
          const u = i / (n - 1);
          const selubungU = u < 0.03 ? u / 0.03 : Math.exp(-(u - 0.03) * 3.4);
          kurva[i] = 0.0001 + 0.55 * b.keras * selubungU * (0.55 + 0.45 * Math.random());
        }
        kurva[n - 1] = 0.0001;
        const g = ctx.createGain();
        g.gain.value = 0.0001;
        g.gain.setValueCurveAtTime(kurva, t, lama);
        g.connect(pan);
        sumberDerau(t, lama).connect(filter('lowpass', Math.max(90, 240 - tunda * 35), 0.9)).connect(g);
        if (tunda < 1.6) {
          const ledak = selubung(0.3 * b.keras, 0.004, 0.04, 0.5);
          sumberDerau(t, 0.6).connect(filter('highpass', 900)).connect(ledak);
        }
        break;
      }
      case 'pengumuman':
        break;
    }
  }

  /** Bel "ting-tung" pengeras suara lalu (bila ada suara bahasa Indonesia) pengumumannya. */
  private umumkan(teks: string): void {
    const bicara = typeof speechSynthesis !== 'undefined' ? speechSynthesis : null;
    if (bicara && (bicara.speaking || bicara.pending)) return;
    const ctx = this.ctx!;
    const t = ctx.currentTime + 0.02;
    // Gema aula: tunda berumpan balik yang diredam.
    const gema = ctx.createDelay(1);
    gema.delayTime.value = 0.19;
    const umpan = ctx.createGain();
    umpan.gain.value = 0.32;
    const redam = ctx.createBiquadFilter();
    redam.type = 'lowpass';
    redam.frequency.value = 2400;
    gema.connect(redam).connect(umpan).connect(gema);
    umpan.connect(this.master!);
    const keluar = ctx.createGain();
    keluar.gain.value = 0.16;
    keluar.connect(this.master!);
    keluar.connect(gema);
    // Empat nada naik (G4 C5 E5 G5), bunyi lonceng: nada dasar + parsial 2,76×.
    [392, 523.25, 659.25, 783.99].forEach((frek, i) => {
      const mulai = t + i * 0.34;
      for (const [kali, keras, luruh] of [
        [1, 1, 1.3],
        [2.76, 0.18, 0.35],
      ] as const) {
        const o = ctx.createOscillator();
        o.type = 'sine';
        o.frequency.value = frek * kali;
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.0001, mulai);
        g.gain.exponentialRampToValueAtTime(keras, mulai + 0.01);
        g.gain.exponentialRampToValueAtTime(0.0001, mulai + luruh);
        o.connect(g).connect(keluar);
        o.start(mulai);
        o.stop(mulai + luruh + 0.05);
      }
    });
    // Gema dilepas setelah bel selesai (umpan balik diputus supaya node bisa dibuang).
    setTimeout(() => umpan.disconnect(), 4000);

    if (!bicara || !this.suaraIndonesia || !teks) return;
    const ucap = new SpeechSynthesisUtterance(teks);
    ucap.voice = this.suaraIndonesia;
    ucap.lang = this.suaraIndonesia.lang;
    ucap.rate = 0.95;
    ucap.volume = 0.9;
    setTimeout(() => {
      if (this.nyala_ && !this.dijeda) bicara.speak(ucap);
    }, 1500);
  }

  private muatSuaraBicara(): void {
    if (typeof speechSynthesis === 'undefined') return;
    const pilih = (): void => {
      const semua = speechSynthesis.getVoices();
      const indo = semua.filter((v) => v.lang.replace('_', '-').toLowerCase().startsWith('id'));
      // Suara lokal (offline) didahulukan.
      this.suaraIndonesia = indo.find((v) => v.localService) ?? indo[0] ?? null;
    };
    pilih();
    speechSynthesis.addEventListener?.('voiceschanged', pilih);
  }

  private hentikanBicara(): void {
    if (typeof speechSynthesis !== 'undefined') speechSynthesis.cancel();
  }
}

// ---------------------------------------------------------------------------
// Buffer sintetis

function bufferDerau(ctx: BaseAudioContext, detik: number): AudioBuffer {
  const b = ctx.createBuffer(1, Math.floor(ctx.sampleRate * detik), ctx.sampleRate);
  const d = b.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  return b;
}

/** Dua jangkrik (nada & tempo berbeda): tiap derik = tiga denyut pendek. */
function bufferJangkrik(ctx: BaseAudioContext): AudioBuffer {
  const sr = ctx.sampleRate;
  const lama = 3.1;
  const b = ctx.createBuffer(1, Math.floor(sr * lama), sr);
  const d = b.getChannelData(0);
  for (const [frek, periode, geser, keras] of [
    [4350, 0.43, 0.05, 0.9],
    [4720, 0.62, 0.21, 0.6],
  ] as const) {
    for (let awal = geser; awal < lama - 0.12; awal += periode * (0.92 + Math.random() * 0.16)) {
      for (let p = 0; p < 3; p++) {
        const t0 = awal + p * 0.028;
        const i0 = Math.floor(t0 * sr);
        const n = Math.floor(0.014 * sr);
        for (let i = 0; i < n && i0 + i < d.length; i++) {
          const jendela = Math.sin((Math.PI * i) / n);
          d[i0 + i]! += keras * jendela * Math.sin((2 * Math.PI * frek * i) / sr);
        }
      }
    }
  }
  return b;
}
