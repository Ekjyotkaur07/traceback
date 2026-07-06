// firebase-init.js
const firebaseConfig = {
  apiKey: "AIzaSyCp0FyDHVtgHT5saCttSPIhx1uGbGMDvMM",
  authDomain: "traceback-18421.firebaseapp.com",
  projectId: "traceback-18421",
  storageBucket: "traceback-18421.firebasestorage.app",
  messagingSenderId: "136908743275",
  appId: "1:136908743275:web:040dd309ecf136f4c3472e"
};

firebase.initializeApp(firebaseConfig);
window.firebaseAuth = firebase.auth();
window.googleProvider = new firebase.auth.GoogleAuthProvider();