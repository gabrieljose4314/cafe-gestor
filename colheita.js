import { db } from "./firebase.js";
import { exigirUsuarioAprovado } from "./acesso.js";

import {
  collection,
  addDoc,
  getDocs
} from "https://www.gstatic.com/firebasejs/12.10.0/firebase-firestore.js";

const formColheita = document.getElementById("gerenciamento-colheita-form");
const selectMoita = document.getElementById("moita-colheita");

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

(async function iniciarColheita() {
  const resultado = await exigirUsuarioAprovado();
  if (!resultado) return;

  usuarioAtual = resultado.user;
  await carregarMoitas(usuarioAtual);
})();

formColheita.addEventListener("submit", async (e) => {
  e.preventDefault();

  if (!usuarioAtual) {
    alert("Usuário não autenticado");
    return;
  }

  const moitaId = selectMoita.value;
  const moitaNome = moitaId
    ? selectMoita.options[selectMoita.selectedIndex].text
    : null;

  const data = document.getElementById("data-colheita").value;
  const quantidade = document.getElementById("quantidade-colhida").value;

  try {
    await addDoc(
      collection(db, "usuarios", usuarioAtual.uid, "colheitas"),
      {
        moitaId: moitaId || null,
        moitaNome: moitaNome || null,
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