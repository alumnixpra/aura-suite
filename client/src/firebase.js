import { initializeApp } from 'firebase/app';
import { getAuth, setPersistence, browserLocalPersistence } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: 'AIzaSyDzS2wk9KX0nRu3ZNNi2ynOAcGHCIn9X4U',
  authDomain: 'aura-suite-cee9c.firebaseapp.com',
  projectId: 'aura-suite-cee9c',
  storageBucket: 'aura-suite-cee9c.firebasestorage.app',
  messagingSenderId: '512131640276',
  appId: '1:512131640276:web:184e889bf578cb9a60c441',
};

export const firebaseApp = initializeApp(firebaseConfig);
export const auth = getAuth(firebaseApp);
export const db = getFirestore(firebaseApp);

// Mantiene la sesión activa entre cierres del navegador (no solo de pestaña).
setPersistence(auth, browserLocalPersistence);
