import { db } from "./firebase.js";
import { exigirUsuarioAprovado } from "./acesso.js";

import {
  collection,
  addDoc,
  getDocs,
  deleteDoc,
  doc
} from "https://www.gstatic.com/firebasejs/12.10.0/firebase-firestore.js";

const formColheita = document.getElementById("gerenciamento-colheita-form");
const selectMoita = document.getElementById("moita-colheita");
const listaColheitas = document.getElementById("lista-colheitas");

let usuarioAtual = null;

function formatarNumero(valor, casas = 2) {
  return Number(valor || 0).toLocaleString("pt-BR", {
    minimumFractionDigits: casas,
    maximumFractionDigits: casas
  });
}

function formatarDataBR(data) {
  if (!data) return "-";

  const partes = data.split("-");
  if (partes.length !== 3) return data;

  return `${partes[2]}/${partes[1]}/${partes[0]}`;
}

async function carregarMoitas(user) {
  try {
    selectMoita.innerHTML = '<option value="">Sem moita específica</option>';

    const snapshot = await getDocs(
      collection(db, "usuarios", user.uid, "moitas")
    );

    snapshot.forEach((documento) => {
      const moita = documento.data();

      const option = document.createElement("option");
      option.value = documento.id;
      option.textContent = moita.nome;

      selectMoita.appendChild(option);
    });

  } catch (erro) {
    console.error("Erro ao carregar moitas:", erro);
    alert("Erro ao carregar moitas");
  }
}

function criarCardColheita(colheita, id) {
  const div = document.createElement("div");
  div.classList.add("card-colheita");

  div.innerHTML = `
    <p><strong>Moita:</strong> ${colheita.moitaNome || "Sem moita específica"}</p>
    <p><strong>Data:</strong> ${formatarDataBR(colheita.data)}</p>
    <p><strong>Quantidade:</strong> ${formatarNumero(colheita.quantidade)} kg</p>
    <button class="btn-excluir-colheita" data-id="${id}">Excluir</button>
  `;

  return div;
}

async function listarColheitas(user) {
  try {
    listaColheitas.innerHTML = "";

    const snapshot = await getDocs(
      collection(db, "usuarios", user.uid, "colheitas")
    );

    if (snapshot.empty) {
      listaColheitas.innerHTML = "<p>Nenhuma colheita registrada.</p>";
      return;
    }

    const colheitas = [];

    snapshot.forEach((documento) => {
      colheitas.push({
        id: documento.id,
        ...documento.data()
      });
    });

    colheitas.sort((a, b) => new Date(b.data) - new Date(a.data));

    colheitas.forEach((colheita) => {
      const card = criarCardColheita(colheita, colheita.id);
      listaColheitas.appendChild(card);
    });

    adicionarEventosExcluir();

  } catch (erro) {
    console.error("Erro ao listar colheitas:", erro);
    listaColheitas.innerHTML = "<p>Erro ao carregar colheitas.</p>";
  }
}

function adicionarEventosExcluir() {
  const botoes = document.querySelectorAll(".btn-excluir-colheita");

  botoes.forEach((botao) => {
    botao.addEventListener("click", async () => {
      const id = botao.getAttribute("data-id");

      const confirmar = confirm("Tem certeza que deseja excluir esta colheita?");
      if (!confirmar) return;

      try {
        await deleteDoc(doc(db, "usuarios", usuarioAtual.uid, "colheitas", id));

        alert("Colheita excluída com sucesso!");
        await listarColheitas(usuarioAtual);

      } catch (erro) {
        console.error("Erro ao excluir colheita:", erro);
        alert("Erro ao excluir colheita");
      }
    });
  });
}

(async function iniciarColheita() {
  const resultado = await exigirUsuarioAprovado();
  if (!resultado) return;

  usuarioAtual = resultado.user;

  await carregarMoitas(usuarioAtual);
  await listarColheitas(usuarioAtual);
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

    await listarColheitas(usuarioAtual);

  } catch (erro) {
    console.error("Erro ao registrar colheita:", erro);
    alert("Erro ao registrar colheita");
  }
});