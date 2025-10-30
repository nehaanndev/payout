import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import {
  getAuth,
  GoogleAuthProvider,
  OAuthProvider,
  FacebookAuthProvider,
  signInWithPopup,
  User,
  signOut,
  onAuthStateChanged,
} from "firebase/auth";


// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyA1foQ0TgePhDo4pSsBVUC4rgjAamfqX-0",
  authDomain: "payout-n.firebaseapp.com",
  projectId: "payout-n",
  storageBucket: "payout-n.firebasestorage.app",
  messagingSenderId: "197852096416",
  appId: "1:197852096416:web:75ec0b05a7f1f468a4a6c5"
};

// Initialize Firebase
// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
const provider = new GoogleAuthProvider();
const microsoftProvider = new OAuthProvider("microsoft.com");
// Optionally force account picker every time for clarity.
microsoftProvider.setCustomParameters({
  prompt: "select_account",
});

const facebookProvider = new FacebookAuthProvider();
facebookProvider.setCustomParameters({
  display: "popup",
});

export {
  db,
  auth,
  provider,
  microsoftProvider,
  facebookProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
};
export type { User };
