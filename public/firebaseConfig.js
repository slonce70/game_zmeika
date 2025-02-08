import { initializeApp } from "firebase/app";
import { getDatabase } from "firebase/database";
import { getAnalytics } from "firebase/analytics";

const firebaseConfig = {
  apiKey: "AIzaSyBrAEG6Da5e_8Zmetlo_hT8B47RrCdcg0E",
  authDomain: "game-zmeika.firebaseapp.com",
  databaseURL: "https://game-zmeika-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "game-zmeika",
  storageBucket: "game-zmeika.firebasestorage.app",
  messagingSenderId: "501669425656",
  appId: "1:501669425656:web:95fd75d725d3519b76a60d",
  measurementId: "G-92RT9TCGW0"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const db = getDatabase(app);

export { db }; 