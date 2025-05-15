// Initialize Firebase with the provided configuration
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.7.3/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/11.7.3/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/11.7.3/firebase-firestore.js";
import { getDatabase } from "https://www.gstatic.com/firebasejs/11.7.3/firebase-database.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/11.7.3/firebase-storage.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/11.7.3/firebase-analytics.js";

// Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyBuam09wq5ko9CXP6IRzLOIN7788ff8H2o",
  authDomain: "kathashu-76fe0.firebaseapp.com",
  databaseURL: "https://kathashu-76fe0-default-rtdb.firebaseio.com",
  projectId: "kathashu-76fe0",
  storageBucket: "kathashu-76fe0.firebasestorage.app",
  messagingSenderId: "533712426442",
  appId: "1:533712426442:web:b4c61d5606df082aaa2b33",
  measurementId: "G-79SWGZFRK4"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const rtdb = getDatabase(app);
const storage = getStorage(app);
const analytics = getAnalytics(app);

export { app, auth, db, rtdb, storage, analytics };
