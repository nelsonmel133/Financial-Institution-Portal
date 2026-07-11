/**
 * src/lib/firebase.js
 *
 * Firebase app initialization for the fintech-web frontend.
 *
 * Auth is used to identify who is signing in to the console; the
 * fintech_api backend continues to issue its own tenant-scoped JWTs
 * (see src/lib/api.js). After a successful Firebase sign-in, the
 * user's Firebase ID token can be exchanged for / attached to backend
 * requests if you wire up a corresponding endpoint server-side.
 *
 * All values are read from NEXT_PUBLIC_FIREBASE_* env vars so no
 * secrets are hard-coded. Copy .env.local.example to .env.local and
 * fill in the values from your Firebase project settings
 * (Project settings → General → Your apps → SDK setup and config).
 */

import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// Avoid re-initializing the app on Next.js fast-refresh / multiple imports.
const firebaseApp = getApps().length ? getApp() : initializeApp(firebaseConfig);

export const auth = getAuth(firebaseApp);
export default firebaseApp;
