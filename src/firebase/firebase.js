// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyCytcVO7rD00sEx8UDS4s0eBx6yHdgLwAg",
  authDomain: "elnaseem-crm.firebaseapp.com",
  projectId: "elnaseem-crm",
  storageBucket: "elnaseem-crm.firebasestorage.app",
  messagingSenderId: "789942919090",
  appId: "1:789942919090:web:756250bbb4152c0b3e8eab",
  measurementId: "G-MN31PDTLRV"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
export default app;