import { auth, db } from "./firebase.js";

import {
  collection,
  addDoc,
  getDocs
} from "https://www.gstatic.com/firebasejs/12.10.0/firebase-firestore.js";

import {
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.10.0/firebase-auth.js";

const formVenda = document.getElementById("gerenciamento-vendas-form");
const selectMoita = document.getElementById("moita-vendas");

let usuarioAtual = null;

async function carregarMoitas(user) {
  try {
    selectMoita.innerHTML = '<option value="">Sem moita específica</option>';

    const snapshot = await getDocs(
      collection(db, "usuarios", user.uid, "moitas")
    );

    snapshot.forEach((doc) => {
      const moita = doc.data();

      const option = document.createElement("option");
      option.value = doc.id;
      option.textContent = moita.nome;

      selectMoita.appendChild(option);
    });

  } catch (erro) {
    console.error("Erro ao carregar moitas:", erro);
    alert("Erro ao carregar moitas");
  }
}

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = "login.html";
    return;
  }

  usuarioAtual = user;
  await carregarMoitas(user);
});

formVenda.addEventListener("submit", async (e) => {
  e.preventDefault();

  if (!usuarioAtual) {
    alert("Usuário não autenticado");
    return;
  }

  const moitaId = selectMoita.value;
  const moitaNome = moitaId
    ? selectMoita.options[selectMoita.selectedIndex].text
    : null;

  const data = document.getElementById("data-venda").value;
  const quantidade = document.getElementById("quantidade-vendida").value;
  const preco = document.getElementById("preco-unitario").value;

  const valorTotal = Number(quantidade) * Number(preco);

  try {
    await addDoc(
      collection(db, "usuarios", usuarioAtual.uid, "vendas"),
      {
        moitaId: moitaId || null,
        moitaNome: moitaNome || null,
        data: data,
        quantidade: Number(quantidade),
        precoUnitario: Number(preco),
        valorTotal: valorTotal,
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