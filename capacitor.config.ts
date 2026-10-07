import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  // appId tidak bisa diganti setelah terbit di Play Store. Sebelum rilis pertama, sesuaikan
  // dengan domain bustation.games (mis. 'games.bustation.app'): ubah juga namespace &
  // applicationId di android/app/build.gradle, package MainActivity.java, dan strings.xml.
  appId: 'id.terminalbus.tycoon',
  // Nama di bawah ikon HP (pendek supaya tidak terpotong).
  appName: 'Bustation',
  webDir: 'dist',
  backgroundColor: '#1a2129',
  android: {
    // Android 15+ memaksa edge-to-edge; 'auto' memberi margin supaya
    // konten tidak tertutup status bar / gesture bar.
    adjustMarginsForEdgeToEdge: 'auto',
  },
};

export default config;
