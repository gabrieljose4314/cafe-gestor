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

// ── Modal ─────────────────────────────────────────────────────────────────────
window.abrirModal  = id => document.getElementById(id).classList.add("aberto");
window.fecharModal = id => document.getElementById(id).classList.remove("aberto");
document.querySelectorAll(".modal-overlay").forEach(m => {
  m.addEventListener("click", e => {
    if (e.target === m) m.classList.remove("aberto");
  });
});

// ── Utilitários ───────────────────────────────────────────────────────────────
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

// ── Busca ─────────────────────────────────────────────────────────────────────
window.filtrarDespesas = function() {
  const termo = document.getElementById("pesquisa-despesa").value.trim().toLowerCase();
  document.querySelectorAll("#lista-despesas .card-despesa").forEach(card => {
    const texto = card.getAttribute("data-busca") || "";
    card.style.display = texto.includes(termo) ? "block" : "none";
  });
};

// ── Carregar moitas no select ───────────────────────────────────────────────────
async function carregarMoitas(user) {
  try {
    if (!selectMoita) {
      console.error("Select de moita não encontrado.");
      return;
    }
    selectMoita.innerHTML = '<option value="">Sem moita específica</option>';
    const snapshot = await getDocs(collection(db, "usuarios", user.uid, "moitas"));
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

// ── Cards ─────────────────────────────────────────────────────────────────────
function criarCardDespesa(despesa, id) {
  const div = document.createElement("div");
  div.classList.add("card-despesa");
  const textoBusca = [despesa.categoria, despesa.moitaNome, despesa.descricao]
    .filter(Boolean).join(" ").toLowerCase();
  div.setAttribute("data-busca", textoBusca);
  div.innerHTML = `
    <p><strong>Moita:</strong> ${despesa.moitaNome || "Sem moita específica"}</p>
    <p><strong>Categoria:</strong> ${despesa.categoria || "-"}</p>
    <p><strong>Descrição:</strong> ${despesa.descricao || "-"}</p>
    <p><strong>Valor:</strong> ${formatarMoeda(despesa.valor)}</p>
    <p><strong>Data:</strong> ${formatarDataBR(despesa.data)}</p>
    <button class="btn-excluir btn-excluir-despesa" data-id="${id}">Excluir</button>
  `;
  return div;
}

// ── Listagem ──────────────────────────────────────────────────────────────────
async function listarDespesas(user) {
  try {
    listaDespesas.innerHTML = "";
    const snapshot = await getDocs(collection(db, "usuarios", user.uid, "despesas"));
    if (snapshot.empty) {
      listaDespesas.innerHTML = "<p>Nenhuma despesa registrada.</p>";
      return;
    }
    const despesas = [];
    snapshot.forEach((documento) => {
      despesas.push({ id: documento.id, ...documento.data() });
    });
    despesas.sort((a, b) => new Date(b.data) - new Date(a.data));
    despesas.forEach((despesa) => {
      listaDespesas.appendChild(criarCardDespesa(despesa, despesa.id));
    });
    adicionarEventosExcluir();
  } catch (erro) {
    console.error("Erro ao listar despesas:", erro);
    listaDespesas.innerHTML = "<p>Erro ao carregar despesas.</p>";
  }
}
function adicionarEventosExcluir() {
  document.querySelectorAll(".btn-excluir-despesa").forEach((botao) => {
    botao.addEventListener("click", async () => {
      const id = botao.getAttribute("data-id");
      if (!confirm("Tem certeza que deseja excluir esta despesa?")) return;
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

// ── Início ────────────────────────────────────────────────────────────────────
(async function iniciarDespesas() {
  const resultado = await exigirUsuarioAprovado();
  if (!resultado) return;
  usuarioAtual = resultado.user;
  await carregarMoitas(usuarioAtual);
  await listarDespesas(usuarioAtual);
})();

// ── Formulário ────────────────────────────────────────────────────────────────
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
  const moitaNome = moitaId ? selectMoita.options[selectMoita.selectedIndex].text : null;
  const categoria = categoriaSelecionada.value;
  const descricao = document.getElementById("descricao-despesa").value;
  const valor = document.getElementById("valor-despesa").value;
  const data = document.getElementById("data-despesa").value;
  try {
    await addDoc(collection(db, "usuarios", usuarioAtual.uid, "despesas"), {
      moitaId: moitaId || null,
      moitaNome: moitaNome || null,
      categoria: categoria,
      descricao: descricao,
      valor: Number(valor),
      data: data,
      criadoEm: new Date()
    });
    alert("Despesa cadastrada com sucesso!");
    formDespesa.reset();
    fecharModal("modal-despesa");
    await listarDespesas(usuarioAtual);
  } catch (erro) {
    console.error("Erro ao cadastrar despesa:", erro);
    alert("Erro ao cadastrar despesa");
  }
});