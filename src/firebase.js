// Import the functions you need from the SDKs you need

import { getAuth } from "firebase/auth";

import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyCTYqudUARQUQRuQQph51O48geszCFfmF0",
  authDomain: "mabstocks-2f76c.firebaseapp.com",
  projectId: "mabstocks-2f76c",
  storageBucket: "mabstocks-2f76c.firebasestorage.app",
  messagingSenderId: "265498947612",
  appId: "1:265498947612:web:bdfe9d6378a08a8b896fd9",
  measurementId: "G-E6YCDMDG6N"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
export const db = getFirestore(app);
export const auth = getAuth(app);