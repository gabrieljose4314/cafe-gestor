import { db } from "./firebase.js";
import { exigirUsuarioAprovado } from "./acesso.js";

import {
  collection,
  addDoc,
  getDocs
} from "https://www.gstatic.com/firebasejs/12.10.0/firebase-firestore.js";

const formDespesa = document.getElementById("gerenciamento-despesas-form");
const selectMoita = document.getElementById("moita-despesa");

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

(async function iniciarDespesas() {
  const resultado = await exigirUsuarioAprovado();
  if (!resultado) return;

  usuarioAtual = resultado.user;
  await carregarMoitas(usuarioAtual);
})();

formDespesa.addEventListener("submit", async (e) => {
  e.preventDefault();

  if (!usuarioAtual) {
    alert("Usuário não autenticado");
    return;
  }

  const categoriaSelecionada = document.querySelector('input[name="categoria-despesa"]:checked');

  if (!categoriaSelecionada) {
    alert("Selecione uma categoria");
    return;
  }

  const moitaId = selectMoita.value;
  const moitaNome = moitaId
    ? selectMoita.options[selectMoita.selectedIndex].text
    : null;

  const categoria = categoriaSelecionada.value;
  const descricao = document.getElementById("descricao-despesa").value;
  const valor = document.getElementById("valor-despesa").value;
  const data = document.getElementById("data-despesa").value;

  try {
    await addDoc(
      collection(db, "usuarios", usuarioAtual.uid, "despesas"),
      {
        moitaId: moitaId || null,
        moitaNome: moitaNome || null,
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