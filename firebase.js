
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.5.0/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/12.5.0/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/12.5.0/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyAfVlOzQSaBfnZGNMhGGSFLlf9CIcqliKg",
  authDomain: "queue-management-6441d.firebaseapp.com",
  projectId: "queue-management-6441d",
  storageBucket: "queue-management-6441d.firebasestorage.app",
  messagingSenderId: "778676893103",
  appId: "1:778676893103:web:0e64f2575290104c4eeb5a",
  measurementId: "G-HVEV89MNBT"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

export { app, db, auth };
