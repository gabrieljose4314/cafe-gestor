import { db } from "./firebase.js";
import { exigirUsuarioAprovado } from "./acesso.js";

import {
  collection,
  addDoc,
  getDocs,
  deleteDoc,
  doc,
  updateDoc
} from "https://www.gstatic.com/firebasejs/12.10.0/firebase-firestore.js";

const form = document.getElementById("cadastro-moita-form");
const listaMoitas = document.getElementById("lista-moitas");
const botaoSalvar = document.getElementById("btn-salvar-moita");

let usuarioAtual = null;
let moitaEmEdicaoId = null;
let todasAsMoitas = [];

function formatarNumero(valor, casas = 2) {
  return Number(valor || 0).toLocaleString("pt-BR", {
    minimumFractionDigits: casas,
    maximumFractionDigits: casas
  });
}

function limparFormulario() {
  form.reset();
  moitaEmEdicaoId = null;
  botaoSalvar.textContent = "Cadastrar Moita";
}

function preencherFormulario(moita) {
  document.getElementById("nome-moita").value = moita.nome || "";
  document.getElementById("area-moita").value = moita.area || "";
  document.getElementById("quantidade-de-pes").value = moita.pes || "";
  document.getElementById("tipo-de-cafe").value = moita.tipo || "";
}

function criarCardMoita(moita) {
  const div = document.createElement("div");
  div.classList.add("card-moita");

  div.innerHTML = `
    <p><strong>Nome:</strong> ${moita.nome}</p>
    <p><strong>Área:</strong> ${formatarNumero(moita.area)} ha</p>
    <p><strong>Quantidade de pés:</strong> ${formatarNumero(moita.pes, 0)}</p>
    <p><strong>Tipo de café:</strong> ${moita.tipo || "-"}</p>
    <button class="btn-editar-moita" data-id="${moita.id}">Editar</button>
    <button class="btn-excluir-moita" data-id="${moita.id}">Excluir</button>
  `;

  return div;
}

async function listarMoitas(user) {
  try {
    listaMoitas.innerHTML = "";
    todasAsMoitas = [];

    const snapshot = await getDocs(
      collection(db, "usuarios", user.uid, "moitas")
    );

    if (snapshot.empty) {
      listaMoitas.innerHTML = "<p>Nenhuma moita cadastrada.</p>";
      return;
    }

    snapshot.forEach((documento) => {
      todasAsMoitas.push({
        id: documento.id,
        ...documento.data()
      });
    });

    todasAsMoitas.sort((a, b) => a.nome.localeCompare(b.nome));

    todasAsMoitas.forEach((moita) => {
      const card = criarCardMoita(moita);
      listaMoitas.appendChild(card);
    });

    adicionarEventosEditar();
    adicionarEventosExcluir();

  } catch (erro) {
    console.error("Erro ao listar moitas:", erro);
    listaMoitas.innerHTML = "<p>Erro ao carregar moitas.</p>";
  }
}

function adicionarEventosEditar() {
  const botoes = document.querySelectorAll(".btn-editar-moita");

  botoes.forEach((botao) => {
    botao.addEventListener("click", () => {
      const id = botao.getAttribute("data-id");
      const moita = todasAsMoitas.find((item) => item.id === id);

      if (!moita) return;

      moitaEmEdicaoId = id;
      preencherFormulario(moita);
      botaoSalvar.textContent = "Atualizar Moita";

      window.scrollTo({
        top: 0,
        behavior: "smooth"
      });
    });
  });
}

function adicionarEventosExcluir() {
  const botoes = document.querySelectorAll(".btn-excluir-moita");

  botoes.forEach((botao) => {
    botao.addEventListener("click", async () => {
      const id = botao.getAttribute("data-id");

      const confirmar = confirm("Tem certeza que deseja excluir esta moita?");
      if (!confirmar) return;

      try {
        await deleteDoc(doc(db, "usuarios", usuarioAtual.uid, "moitas", id));

        alert("Moita excluída com sucesso!");

        if (moitaEmEdicaoId === id) {
          limparFormulario();
        }

        await listarMoitas(usuarioAtual);

      } catch (erro) {
        console.error("Erro ao excluir moita:", erro);
        alert("Erro ao excluir moita");
      }
    });
  });
}

(async function iniciarCadastro() {
  const resultado = await exigirUsuarioAprovado();
  if (!resultado) return;

  usuarioAtual = resultado.user;
  await listarMoitas(usuarioAtual);
})();

form.addEventListener("submit", async (e) => {
  e.preventDefault();

  if (!usuarioAtual) {
    alert("Usuário não autenticado");
    return;
  }

  const nome = document.getElementById("nome-moita").value;
  const area = document.getElementById("area-moita").value;
  const pes = document.getElementById("quantidade-de-pes").value;
  const tipo = document.getElementById("tipo-de-cafe").value;

  try {
    if (moitaEmEdicaoId) {
      await updateDoc(
        doc(db, "usuarios", usuarioAtual.uid, "moitas", moitaEmEdicaoId),
        {
          nome: nome,
          area: Number(area),
          pes: Number(pes),
          tipo: tipo
        }
      );

      alert("Moita atualizada com sucesso!");
    } else {
      await addDoc(
        collection(db, "usuarios", usuarioAtual.uid, "moitas"),
        {
          nome: nome,
          area: Number(area),
          pes: Number(pes),
          tipo: tipo,
          dataCriacao: new Date()
        }
      );

      alert("Moita cadastrada com sucesso!");
    }

    limparFormulario();
    await listarMoitas(usuarioAtual);

  } catch (erro) {
    console.error("Erro ao salvar moita:", erro);
    alert("Erro ao salvar moita");
  }
});