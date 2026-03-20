import { db } from "./firebase.js";
import { exigirUsuarioAprovado } from "./acesso.js";

import {
  collection,
  addDoc,
  getDocs,
  deleteDoc,
  doc
} from "https://www.gstatic.com/firebasejs/12.10.0/firebase-firestore.js";

const formDespesa = document.getElementById("gerenciamento-despesas-form");
const selectMoita = document.getElementById("moita-despesa");
const listaDespesas = document.getElementById("lista-despesas");

let usuarioAtual = null;

function formatarMoeda(valor) {
  return Number(valor || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL"
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
    if (!selectMoita) {
      console.error("Select de moita não encontrado.");
      return;
    }

    selectMoita.innerHTML = '<option value="">Sem moita específica</option>';

    const snapshot = await getDocs(
      collection(db, "usuarios", user.uid, "moitas")
    );

    snapshot.forEach((documento) => {
      const moita = documento.data();

      const option = document.createElement("option");
      option.value = documento.id;
      option.textContent = moita.nome || "Moita sem nome";

      selectMoita.appendChild(option);
    });

  } catch (erro) {
    console.error("Erro ao carregar moitas:", erro);
    alert("Erro ao carregar moitas");
  }
}

function criarCardDespesa(despesa, id) {
  const div = document.createElement("div");
  div.classList.add("card-despesa");

  div.innerHTML = `
    <p><strong>Moita:</strong> ${despesa.moitaNome || "Sem moita específica"}</p>
    <p><strong>Categoria:</strong> ${despesa.categoria || "-"}</p>
    <p><strong>Descrição:</strong> ${despesa.descricao || "-"}</p>
    <p><strong>Valor:</strong> ${formatarMoeda(despesa.valor)}</p>
    <p><strong>Data:</strong> ${formatarDataBR(despesa.data)}</p>
    <button class="btn-excluir-despesa" data-id="${id}">Excluir</button>
  `;

  return div;
}

async function listarDespesas(user) {
  try {
    listaDespesas.innerHTML = "";

    const snapshot = await getDocs(
      collection(db, "usuarios", user.uid, "despesas")
    );

    if (snapshot.empty) {
      listaDespesas.innerHTML = "<p>Nenhuma despesa registrada.</p>";
      return;
    }

    const despesas = [];

    snapshot.forEach((documento) => {
      despesas.push({
        id: documento.id,
        ...documento.data()
      });
    });

    despesas.sort((a, b) => new Date(b.data) - new Date(a.data));

    despesas.forEach((despesa) => {
      const card = criarCardDespesa(despesa, despesa.id);
      listaDespesas.appendChild(card);
    });

    adicionarEventosExcluir();

  } catch (erro) {
    console.error("Erro ao listar despesas:", erro);
    listaDespesas.innerHTML = "<p>Erro ao carregar despesas.</p>";
  }
}

function adicionarEventosExcluir() {
  const botoes = document.querySelectorAll(".btn-excluir-despesa");

  botoes.forEach((botao) => {
    botao.addEventListener("click", async () => {
      const id = botao.getAttribute("data-id");

      const confirmar = confirm("Tem certeza que deseja excluir esta despesa?");
      if (!confirmar) return;

      try {
        await deleteDoc(doc(db, "usuarios", usuarioAtual.uid, "despesas", id));

        alert("Despesa excluída com sucesso!");
        await listarDespesas(usuarioAtual);

      } catch (erro) {
        console.error("Erro ao excluir despesa:", erro);
        alert("Erro ao excluir despesa");
      }
    });
  });
}

(async function iniciarDespesas() {
  const resultado = await exigirUsuarioAprovado();
  if (!resultado) return;

  usuarioAtual = resultado.user;
  await carregarMoitas(usuarioAtual);
  await listarDespesas(usuarioAtual);
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

  const moitaId = selectMoita?.value || "";
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

    await listarDespesas(usuarioAtual);

  } catch (erro) {
    console.error("Erro ao cadastrar despesa:", erro);
    alert("Erro ao cadastrar despesa");
  }
});