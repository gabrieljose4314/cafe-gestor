import { auth, db } from "./firebase.js";

import {
  collection,
  addDoc
} from "https://www.gstatic.com/firebasejs/12.10.0/firebase-firestore.js";

import {
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.10.0/firebase-auth.js";


const formVenda = document.getElementById("gerenciamento-vendas-form");

onAuthStateChanged(auth, (user) => {

  if (!user) {
    window.location.href = "login.html";
    return;
  }

  formVenda.addEventListener("submit", async (e) => {

    e.preventDefault();

    const moita = document.getElementById("moita-venda").value;
    const data = document.getElementById("data-venda").value;
    const quantidade = document.getElementById("quantidade-vendida").value;
    const preco = document.getElementById("preco-unitario").value;

    const valorTotal = quantidade * preco;

    try {

      await addDoc(
        collection(db, "usuarios", user.uid, "vendas"),
        {
          moita: moita,
          data: data,
          quantidade: Number(quantidade),
          precoUnitario: Number(preco),
          valorTotal: Number(valorTotal),
          criadoEm: new Date()
        }
      );

      alert("Venda registrada com sucesso!");

      formVenda.reset();

    } catch (erro) {

      console.error("Erro ao registrar venda:", erro);
      alert("Erro ao registrar venda");

    }

  });

});