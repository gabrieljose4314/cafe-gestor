import { auth, db } from "./firebase.js";

import {
  collection,
  addDoc,
  getDocs
} from "https://www.gstatic.com/firebasejs/12.10.0/firebase-firestore.js";

import {
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.10.0/firebase-auth.js";


const formColheita = document.getElementById("gerenciamento-colheita-form");


async function carregarMoitas(user) {

  const select = document.getElementById("moita-colheita");

  const snapshot = await getDocs(
    collection(db, "usuarios", user.uid, "moitas")
  );

  snapshot.forEach((doc) => {

    const moita = doc.data();

    const option = document.createElement("option");

    option.value = moita.nome;
    option.textContent = moita.nome;

    select.appendChild(option);

  });

}


onAuthStateChanged(auth, (user) => {

  if (!user) {
    window.location.href = "login.html";
    return;
  }

  // 🔥 CARREGA AS MOITAS NO SELECT
  carregarMoitas(user);


  formColheita.addEventListener("submit", async (e) => {

    e.preventDefault();

    const moita = document.getElementById("moita-colheita").value;
    const data = document.getElementById("data-colheita").value;
    const quantidade = document.getElementById("quantidade-colhida").value;

    try {

      await addDoc(
        collection(db, "usuarios", user.uid, "colheitas"),
        {
          moita: moita,
          data: data,
          quantidade: Number(quantidade),
          criadoEm: new Date()
        }
      );

      alert("Colheita registrada com sucesso!");

      formColheita.reset();

    } catch (erro) {

      console.error("Erro ao registrar colheita:", erro);
      alert("Erro ao registrar colheita");

    }

  });

});