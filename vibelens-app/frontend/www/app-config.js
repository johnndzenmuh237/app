// ============================================================
// VibeLens AI — Frontend Configuration
// Fill these in before building. Safe to ship in the app — these are all
// PUBLIC identifiers (Firebase web config is meant to be public; the secret
// keys live only in the backend's .env, never here).
// ============================================================
window.VIBELENS_CONFIG = {
  // Your deployed backend's base URL (no trailing slash).
  // During local development this is typically http://localhost:8080
  BACKEND_URL: "https://api.yourdomain.com",

  // Firebase Web SDK config — get this from:
  // Firebase Console -> Project Settings -> General -> "Your apps" -> Web app
  FIREBASE_CONFIG: {
    apiKey: "YOUR_FIREBASE_API_KEY",
    authDomain: "your-project.firebaseapp.com",
    projectId: "your-project-id",
    storageBucket: "your-project.appspot.com",
    messagingSenderId: "000000000000",
    appId: "1:000000000000:web:abcdef1234567890"
  }
};
