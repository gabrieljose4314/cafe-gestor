// auth.js

import { auth, db } from "./firebase.js";

import {
  GoogleAuthProvider,
  signInWithPopup,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.10.0/firebase-auth.js";

import {
  doc,
  getDoc,
  setDoc
} from "https://www.gstatic.com/firebasejs/12.10.0/firebase-firestore.js";


// PROVEDOR GOOGLE
const provider = new GoogleAuthProvider();


// BOTÃO LOGIN GOOGLE
const btnLogin = document.getElementById("login-btn");

if (btnLogin) {
  btnLogin.addEventListener("click", async () => {
    try {
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.error("Erro no login:", error);
    }
  });
}


// VERIFICAR ESTADO DE LOGIN
onAuthStateChanged(auth, async (user) => {

  if (user) {

    const uid = user.uid;

    const userRef = doc(db, "usuarios", uid);

    const userSnap = await getDoc(userRef);

    // SE USUÁRIO NÃO EXISTE NO BANCO
    if (!userSnap.exists()) {

      await setDoc(userRef, {
        dados: {
        nome: user.displayName,
        email: user.email,
        foto: user.photoURL,
        criado_em: new Date()
        }
      });

      console.log("Usuário criado no Firestore");

    } else {

      console.log("Usuário já existe");

    }

    // REDIRECIONAR PARA DASHBOARD
    window.location.href = "index.html";

  }

});