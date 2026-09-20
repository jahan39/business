// Firebase Configuration for The Sugar Atelier
const firebaseConfig = {
  apiKey: "AIzaSyBeZp1ob52qfRvxVbwxjlIPe3D2JO3o9U8",
  authDomain: "sugar-atelier-46ffa.firebaseapp.com",
  projectId: "sugar-atelier-46ffa",
  storageBucket: "sugar-atelier-46ffa.firebasestorage.app",
  messagingSenderId: "557791484329",
  appId: "1:557791484329:web:6113b4c68c2b8e5d1eccb8"
};

// Initialize Firebase
let db = null;
let auth = null;
try {
  if (typeof firebase !== "undefined") {
    if (!firebase.apps.length) {
      firebase.initializeApp(firebaseConfig);
    }
    db = firebase.firestore();
    window.db = db;
    if (typeof firebase.auth === "function") {
      auth = firebase.auth();
      window.auth = auth;
    }
  }
} catch (err) {
  console.warn("Firebase initialization notice:", err);
}
