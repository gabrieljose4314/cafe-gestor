import { auth, db } from "./firebase.js";

import {
  signOut,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.10.0/firebase-auth.js";

import {
  doc,
  getDoc
} from "https://www.gstatic.com/firebasejs/12.10.0/firebase-firestore.js";

const botaoLogout = document.getElementById("logout-btn");

botaoLogout.addEventListener("click", async () => {
  await signOut(auth);
  window.location.href = "login.html";
});

// ── Verifica a cada 2 segundos se a conta foi aprovada ───────────────────────
onAuthStateChanged(auth, (user) => {
  if (!user) {
    window.location.href = "login.html";
    return;
  }

  const intervalo = setInterval(async () => {
    try {
      const snap = await getDoc(doc(db, "usuarios", user.uid));
      if (!snap.exists()) return;

      const acesso = snap.data().acesso || {};

      if (acesso.aprovado) {
        clearInterval(intervalo);
        window.location.href = "index.html";
      }

    } catch (erro) {
      console.error("Erro ao verificar aprovação:", erro);
    }
  }, 2000);
});