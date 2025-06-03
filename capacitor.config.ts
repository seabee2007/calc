import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.concrete.calculator',
  appName: 'Concrete Calculator',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
    iosScheme: 'capacitor'
  },
  plugins: {
    Filesystem: {
      directory: 'Documents'
    },
    Share: {
      // Share plugin configuration
    }
  },
  ios: {
    contentInset: 'always'
  }
};

export default config;
