import { auth, db } from "./firebase.js";

import {
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/12.10.0/firebase-auth.js";


// verificar usuário logado
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/12.10.0/firebase-firestore.js";

onAuthStateChanged(auth, async (user) => {

  if (user) {

    const userRef = doc(db, "usuarios", user.uid);
    const snap = await getDoc(userRef);

    const dados = snap.data().dados;

    document.getElementById("nomeUsuario").textContent =
      "Bem-vindo, " + dados.nome;

  } else {

    window.location.href = "login.html";

  }

});


// botão logout
const botaoLogout = document.getElementById("logout");

botaoLogout.addEventListener("click", async () => {

  await signOut(auth);

  window.location.href = "login.html";

});