import { initializeApp, getApps } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth"; // 👈 aggiungi questo

const firebaseConfig = {
  apiKey: "AIzaSyAbds7L1ZB48v1Qo5jELoHaAriuI7LodRE",
  authDomain: "cproject-abd3a.firebaseapp.com",
  projectId: "cproject-abd3a",
  storageBucket: "cproject-abd3a.firebasestorage.app",
  messagingSenderId: "545636130845",
  appId: "1:545636130845:web:3debf58192270abd9926f4",
  measurementId: "G-SVRX6V36V7",
};

const app = !getApps().length ? initializeApp(firebaseConfig) : getApps()[0];
const db = getFirestore(app);
const auth = getAuth(app); // 👈 aggiungi questo

export { db, auth }; // 👈 esporta anche auth
