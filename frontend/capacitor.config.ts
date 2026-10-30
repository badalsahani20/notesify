import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'in.notesify.app',
  appName: 'Notesify',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
    hostname: 'app.notesify.in',
    cleartext: false,
  },
  plugins: {
    Keyboard: {
      resize: 'none',
      resizeOnFullScreen: false,
    },
    StatusBar: {
      overlaysWebView: false,
      style: 'DARK',
      backgroundColor: '#09090b',
    },
  },
};

export default config;
