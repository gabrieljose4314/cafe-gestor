import { auth, db } from "./firebase.js";

import {
  collection,
  addDoc
} from "https://www.gstatic.com/firebasejs/12.10.0/firebase-firestore.js";

import {
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.10.0/firebase-auth.js";


const formDespesa = document.getElementById("gerenciamento-despesas-form");

onAuthStateChanged(auth, (user) => {

  if (!user) {
    window.location.href = "login.html";
    return;
  }

  formDespesa.addEventListener("submit", async (e) => {

    e.preventDefault();

    const categoria = document.querySelector('input[name="categoria-despesa"]:checked').value;

    const descricao = document.getElementById("descricao-despesa").value;

    const valor = document.getElementById("valor-despesa").value;

    const data = document.getElementById("data-despesa").value;

    try {

      await addDoc(
        collection(db, "usuarios", user.uid, "despesas"),
        {
          categoria: categoria,
          descricao: descricao,
          valor: Number(valor),
          data: data,
          criadoEm: new Date()
        }
      );

      alert("Despesa cadastrada com sucesso!");

      formDespesa.reset();

    } catch (erro) {

      console.error("Erro ao cadastrar despesa:", erro);
      alert("Erro ao cadastrar despesa");

    }

  });

});