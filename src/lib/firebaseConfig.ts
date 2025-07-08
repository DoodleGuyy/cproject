// firebaseConfig.ts

import { initializeApp, getApps } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { getDatabase } from "firebase/database";

// !! Aggiungi il databaseURL dal pannello Realtime Database Firebase !!
const firebaseConfig = {
  apiKey: "AIzaSyAbds7L1ZB48v1Qo5jELoHaAriuI7LodRE",
  authDomain: "cproject-abd3a.firebaseapp.com",
  projectId: "cproject-abd3a",
  storageBucket: "cproject-abd3a.appspot.com",
  messagingSenderId: "545636130845",
  appId: "1:545636130845:web:3debf58192270abd9926f4",
  measurementId: "G-SVRX6V36V7",
  databaseURL: "https://cproject-abd3a-default-rtdb.europe-west1.firebasedatabase.app", // <--- AGGIUNGI QUESTO!
};

// Inizializzazione sicura (Next.js/SSR compatibile)
const app = !getApps().length ? initializeApp(firebaseConfig) : getApps()[0];

// Esportazioni standard
const db = getFirestore(app);
const auth = getAuth(app);
const realtimeDb = getDatabase(app); // <--- RTDB sempre sull'istanza giusta

export { db, auth, realtimeDb };
