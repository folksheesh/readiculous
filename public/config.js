// Import dari CDN modular
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyAgVHlTuzoAE8UG-QCSTEx4vPkdK7DwZVA",
    authDomain: "folksy-67e76.firebaseapp.com",
    projectId: "folksy-67e76",
    storageBucket: "folksy-67e76.appspot.com", // typo fixed: firebasestorage**.app** → **.appspot.com**
    messagingSenderId: "931699818506",
    appId: "1:931699818506:web:31048a7094d0a112f2dff3",
    measurementId: "G-YBTC8D22MM"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// Supaya bisa diakses dari file lain
window.auth = auth;
window.db = db;