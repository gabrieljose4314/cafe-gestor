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

const provider = new GoogleAuthProvider();
const btnLogin = document.getElementById("login-btn");

async function fazerLoginComGoogle() {
  try {
    await signInWithPopup(auth, provider);
  } catch (error) {
    console.error("Erro no login:", error);
    alert("Erro ao entrar com Google. Tente novamente.");
  }
}

async function criarUsuarioSeNaoExistir(user) {
  const uid = user.uid;
  const userRef = doc(db, "usuarios", uid);
  const userSnap = await getDoc(userRef);

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
}

if (btnLogin) {
  btnLogin.addEventListener("click", fazerLoginComGoogle);
}

onAuthStateChanged(auth, async (user) => {
  if (!user) return;

  try {
    await criarUsuarioSeNaoExistir(user);
    window.location.href = "index.html";
  } catch (error) {
    console.error("Erro ao verificar/criar usuário:", error);
    alert("Erro ao acessar sua conta.");
  }
});