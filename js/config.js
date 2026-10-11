// Firebase web config. These values are NOT secrets — they only identify the
// project. Security comes from Firestore/Storage rules and Cloud Functions.
// Replace with the values from Firebase console → Project settings → Your apps.
export const firebaseConfig = {
  apiKey: 'REPLACE_WITH_API_KEY',
  authDomain: 'demo-charazatydanya.firebaseapp.com',
  projectId: 'demo-charazatydanya',
  storageBucket: 'demo-charazatydanya.appspot.com',
  appId: 'REPLACE_WITH_APP_ID',
};

// Must match functions/config.js
export const REGION = 'europe-west1';

// Firebase JS SDK version used by the admin dashboard (loaded from gstatic CDN).
export const SDK_VERSION = '12.19.0';

export const USE_EMULATORS = ['localhost', '127.0.0.1'].includes(location.hostname);
export const EMULATOR_HOST = location.hostname;
