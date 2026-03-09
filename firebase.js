// IMPORTS
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.10.0/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/12.10.0/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/12.10.0/firebase-auth.js";


// CONFIGURAÇÃO
const firebaseConfig = {
  apiKey: "AIzaSyDhK-B5mhxuEOh5m654Qd7DeoAc5dqJEJk",
  authDomain: "cafe-gestor-19d68.firebaseapp.com",
  projectId: "cafe-gestor-19d68",
  storageBucket: "cafe-gestor-19d68.firebasestorage.app",
  messagingSenderId: "15559335163",
  appId: "1:15559335163:web:d739a049a7a4b8bd47a45e"
};


// INICIALIZAR
const app = initializeApp(firebaseConfig);

// EXPORTAR PARA OUTROS ARQUIVOS
export const db = getFirestore(app);
export const auth = getAuth(app);