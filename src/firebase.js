import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyDbGd7qUUDgLo3HsrbsCbK8GySajQeKFu0",
  authDomain: "tote-calculator.firebaseapp.com",
  projectId: "tote-calculator",
  storageBucket: "tote-calculator.firebasestorage.app",
  messagingSenderId: "256755403923",
  appId: "1:256755403923:web:1931c6e83190d77eaa1166",
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
