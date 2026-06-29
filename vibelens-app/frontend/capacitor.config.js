const config = {
  appId: 'com.vibelens.ai',
  appName: 'VibeLens AI',
  webDir: 'www',
  bundledWebRuntime: false,
  server: {
    // androidScheme 'https' avoids mixed-content issues with Firebase Auth
    // and fetches to your backend over HTTPS.
    androidScheme: 'https'
  },
  ios: {
    contentInset: 'automatic'
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 1200,
      backgroundColor: '#080810',
      androidSplashResourceName: 'splash',
      showSpinner: false
    },
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#080810'
    }
  }
};

module.exports = config;
