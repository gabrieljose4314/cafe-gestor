import { auth, db } from "./firebase.js";

import {
  collection,
  addDoc
} from "https://www.gstatic.com/firebasejs/12.10.0/firebase-firestore.js";

import {
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.10.0/firebase-auth.js";


const form = document.getElementById("cadastro-moita-form");

onAuthStateChanged(auth, (user) => {

  if (!user) {
    window.location.href = "login.html";
    return;
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const nome = document.getElementById("nome-moita").value;
    const area = document.getElementById("area-moita").value;
    const pes = document.getElementById("quantidade-de-pes").value;
    const tipo = document.getElementById("tipo-de-cafe").value;

    try {

      await addDoc(
        collection(db, "usuarios", user.uid, "moitas"),
        {
          nome: nome,
          area: Number(area),
          pes: Number(pes),
          tipo: tipo,
          dataCriacao: new Date()
        }
      );

      alert("Moita cadastrada com sucesso!");

      form.reset();

    } catch (erro) {

      console.error("Erro ao cadastrar:", erro);
      alert("Erro ao cadastrar moita");

    }

  });

});