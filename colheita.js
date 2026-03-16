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
const selectMoita = document.getElementById("moita-colheita");

let usuarioAtual = null;

async function carregarMoitas(user) {
  try {
    selectMoita.innerHTML = '<option value="">Selecione uma moita</option>';

    const snapshot = await getDocs(
      collection(db, "usuarios", user.uid, "moitas")
    );

    if (snapshot.empty) {
      const option = document.createElement("option");
      option.value = "";
      option.textContent = "Nenhuma moita cadastrada";
      option.disabled = true;
      selectMoita.appendChild(option);
      return;
    }

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

formColheita.addEventListener("submit", async (e) => {
  e.preventDefault();

  if (!usuarioAtual) {
    alert("Usuário não autenticado");
    return;
  }

  const moitaId = selectMoita.value;
  const moitaNome = selectMoita.options[selectMoita.selectedIndex].text;
  const data = document.getElementById("data-colheita").value;
  const quantidade = document.getElementById("quantidade-colhida").value;

  if (!moitaId) {
    alert("Selecione uma moita");
    return;
  }

  try {
    await addDoc(
      collection(db, "usuarios", usuarioAtual.uid, "colheitas"),
      {
        moitaId: moitaId,
        moitaNome: moitaNome,
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