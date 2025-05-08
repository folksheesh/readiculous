// Import dari CDN modular
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyAHH9sA6Aw02jFEj67RcL6ekFg7rdh_n_c",
    authDomain: "readiculous-9e59d.firebaseapp.com",
    projectId: "readiculous-9e59d",
    storageBucket: "readiculous-9e59d.firebasestorage.app",
    messagingSenderId: "137985364885",
    appId: "1:137985364885:web:e7175c5cc162dacd501c9c",
    measurementId: "G-7LYGQNZZFM"
  };
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// Supaya bisa diakses dari file lain
window.auth = auth;
window.db = db;