/**
 * Firebase client-side configuration for PermitIQ
 * Uses Firebase Web SDK (not admin SDK) for Firestore onSnapshot listeners.
 *
 * PRD §5: "The Vite client must attach onSnapshot listeners to these documents
 * to drive the UI updates instantly without polling."
 */

import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "umhack-493907",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "umhack-493907.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "",
};

let app = null;
let firestoreDb = null;

/**
 * Get the Firebase app instance (lazy init)
 */
export function getFirebaseApp() {
  if (!app) {
    app = initializeApp(firebaseConfig);
  }
  return app;
}

/**
 * Get the Firestore database instance
 */
export function getFirestoreDb() {
  if (!firestoreDb) {
    firestoreDb = getFirestore(getFirebaseApp());
  }
  return firestoreDb;
}
