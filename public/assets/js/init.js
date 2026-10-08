import { initializeApp } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-analytics.js";

const firebaseConfig = {
    apiKey: "AIzaSyAos0hb9MOTT1JZDAdZe_nJ8h0u2yrXGkI",
    authDomain: "lifemadefunny-1b2a3.firebaseapp.com",
    projectId: "lifemadefunny-1b2a3",
    storageBucket: "lifemadefunny-1b2a3.firebasestorage.app",
    messagingSenderId: "210369324826",
    appId: "1:210369324826:web:17e01464e453cd7bb06ea3",
    measurementId: "G-XW0SRKPV6N"
};

const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);