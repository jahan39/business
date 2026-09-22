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
    if (typeof firebase.firestore === "function") {
      try {
        db = firebase.firestore();
        window.db = db;
      } catch (fsErr) {
        console.warn("Firestore initialization notice:", fsErr);
      }
    }
    if (typeof firebase.auth === "function") {
      try {
        auth = firebase.auth();
        window.auth = auth;
      } catch (authErr) {
        console.warn("Auth initialization notice:", authErr);
      }
    }
  }
} catch (err) {
  console.warn("Firebase initialization notice:", err);
}
