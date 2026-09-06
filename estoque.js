import { db } from "./firebase.js";
import { exigirUsuarioAprovado, ativarTopbarDesktop } from "./acesso.js";
import {
  collection,
  addDoc,
  getDocs,
  deleteDoc,
  doc,
  updateDoc
} from "https://www.gstatic.com/firebasejs/12.10.0/firebase-firestore.js";

const form = document.getElementById("cadastro-lote-form");
const listaEstoque = document.getElementById("lista-estoque");
const botaoSalvar = document.getElementById("btn-salvar-lote");
const tituloModal = document.getElementById("titulo-modal-lote");

// Elementos do layout desktop novo — checagem defensiva. Diferente das
// outras páginas, Estoque tem edição, então o form desktop também
// precisa alternar entre modo "cadastrar" e "editar" sem modal.
const formLoteDesktop = document.getElementById("form-lote-desktop");
const tituloFormLoteDesktop = document.getElementById("titulo-form-lote-desktop");
const botaoSalvarDesktop = document.getElementById("btn-salvar-lote-desktop");
const botaoCancelarLoteDesktop = document.getElementById("btn-cancelar-lote-desktop");
const tabelaEstoqueCorpo = document.getElementById("tabela-estoque-corpo");
const totalLotesDesktopEl = document.getElementById("total-lotes-desktop");
const totalSacasEstoqueDesktopEl = document.getElementById("total-sacas-estoque-desktop");
const pesquisaLoteDesktop = document.getElementById("pesquisa-lote-desktop");

let usuarioAtual = null;
let loteEmEdicaoId = null;
let todosOsLotes = [];

// ── Modal ─────────────────────────────────────────────────────────────────────
window.abrirModal  = id => document.getElementById(id).classList.add("aberto");
window.fecharModal = id => document.getElementById(id).classList.remove("aberto");

window.fecharModalLote = function() {
  window.fecharModal("modal-lote");
  limparFormulario();
};

document.querySelectorAll(".modal-overlay").forEach(m => {
  m.addEventListener("click", e => {
    if (e.target === m) {
      if (m.id === "modal-lote") {
        window.fecharModalLote();
      } else {
        window.fecharModal(m.id);
      }
    }
  });
});

// ── Utilitários ───────────────────────────────────────────────────────────────
function formatarNumero(valor, casas = 2) {
  return Number(valor || 0).toLocaleString("pt-BR", {
    minimumFractionDigits: casas,
    maximumFractionDigits: casas
  });
}
function limparFormulario() {
  form.reset();
  loteEmEdicaoId = null;
  botaoSalvar.textContent = "Cadastrar Lote";
  tituloModal.textContent = "📦 Cadastrar Lote";
  limparFormularioDesktop();
}
function preencherFormulario(lote) {
  document.getElementById("nome-lote").value = lote.nome || "";
  document.getElementById("quantidade-lote").value = lote.quantidadeSacas || "";
  document.getElementById("anotacoes-lote").value = lote.anotacoes || "";
}

// Layout desktop novo — o form fica sempre visível na tela, então "editar"
// aqui não abre modal: só troca o form pro modo edição no lugar.
function limparFormularioDesktop() {
  if (!formLoteDesktop) return;
  formLoteDesktop.reset();
  if (tituloFormLoteDesktop) tituloFormLoteDesktop.textContent = "Cadastrar Lote";
  if (botaoSalvarDesktop) botaoSalvarDesktop.textContent = "Cadastrar Lote";
  if (botaoCancelarLoteDesktop) botaoCancelarLoteDesktop.classList.add("oculto");
}
function preencherFormularioDesktop(lote) {
  document.getElementById("nome-lote-desktop").value = lote.nome || "";
  document.getElementById("quantidade-lote-desktop").value = lote.quantidadeSacas || "";
  document.getElementById("anotacoes-lote-desktop").value = lote.anotacoes || "";
}
if (botaoCancelarLoteDesktop) {
  botaoCancelarLoteDesktop.addEventListener("click", () => {
    loteEmEdicaoId = null;
    limparFormularioDesktop();
  });
}

function criarCardLote(lote) {
  const div = document.createElement("div");
  div.classList.add("card-lote");
  div.setAttribute("data-nome", (lote.nome || "").toLowerCase());
  div.innerHTML = `
    <p><strong>Lote:</strong> ${lote.nome || "-"}${lote.origem === "compra" ? ' <span class="tag-origem">via compra</span>' : ""}</p>
    <p><strong>Quantidade:</strong> ${formatarNumero(lote.quantidadeSacas || 0)} sacas</p>
    ${lote.anotacoes ? `<p><strong>Anotações:</strong> ${lote.anotacoes}</p>` : ""}
    <button class="btn-editar-lote" data-id="${lote.id}">Editar</button>
    <button class="btn-excluir btn-excluir-lote" data-id="${lote.id}">Excluir</button>
  `;
  return div;
}

// ── Busca ─────────────────────────────────────────────────────────────────────
window.filtrarEstoque = function() {
  const termo = document.getElementById("pesquisa-lote").value.trim().toLowerCase();
  document.querySelectorAll("#lista-estoque .card-lote").forEach(card => {
    const nome = card.getAttribute("data-nome") || "";
    card.style.display = nome.includes(termo) ? "block" : "none";
  });
};

if (pesquisaLoteDesktop) {
  pesquisaLoteDesktop.addEventListener("input", () => {
    const termo = pesquisaLoteDesktop.value.trim().toLowerCase();
    document.querySelectorAll("#tabela-estoque-corpo tr[data-nome]").forEach((linha) => {
      const nome = linha.getAttribute("data-nome") || "";
      linha.classList.toggle("linha-oculta", !nome.includes(termo));
    });
  });
}

// ── Linha da tabela (desktop) ────────────────────────────────────────────────
function criarLinhaLote(lote) {
  const tr = document.createElement("tr");
  tr.setAttribute("data-nome", (lote.nome || "").toLowerCase());
  tr.innerHTML = `
    <td>${lote.nome || "-"}</td>
    <td>${formatarNumero(lote.quantidadeSacas || 0)} sacas</td>
    <td>${lote.origem === "compra" ? "Via compra" : "Manual"}</td>
    <td>${lote.anotacoes || "-"}</td>
    <td>
      <button class="btn-excluir-tabela btn-editar-lote-desktop" data-id="${lote.id}">Editar</button>
      <button class="btn-excluir-tabela btn-excluir-lote" data-id="${lote.id}">Excluir</button>
    </td>
  `;
  return tr;
}

// ── Listagem (CRUD) ──────────────────────────────────────────────────────────────
async function listarEstoque(user) {
  try {
    listaEstoque.innerHTML = "";
    if (tabelaEstoqueCorpo) tabelaEstoqueCorpo.innerHTML = "";
    todosOsLotes = [];

    const snapshot = await getDocs(collection(db, "usuarios", user.uid, "estoque"));

    if (snapshot.empty) {
      listaEstoque.innerHTML = "<p>Nenhum lote cadastrado.</p>";
      if (tabelaEstoqueCorpo) {
        tabelaEstoqueCorpo.innerHTML = '<tr class="tabela-vazio"><td colspan="5">Nenhum lote cadastrado.</td></tr>';
      }
      if (totalLotesDesktopEl) totalLotesDesktopEl.textContent = "0";
      if (totalSacasEstoqueDesktopEl) totalSacasEstoqueDesktopEl.textContent = "0";
      return;
    }

    snapshot.forEach((documento) => {
      todosOsLotes.push({ id: documento.id, ...documento.data() });
    });
    todosOsLotes.sort((a, b) => (a.nome || "").localeCompare(b.nome || ""));

    let totalSacasGeral = 0;

    todosOsLotes.forEach((lote) => {
      listaEstoque.appendChild(criarCardLote(lote));
      if (tabelaEstoqueCorpo) tabelaEstoqueCorpo.appendChild(criarLinhaLote(lote));
      totalSacasGeral += Number(lote.quantidadeSacas) || 0;
    });

    if (totalLotesDesktopEl) totalLotesDesktopEl.textContent = todosOsLotes.length;
    if (totalSacasEstoqueDesktopEl) totalSacasEstoqueDesktopEl.textContent = formatarNumero(totalSacasGeral);

    adicionarEventosEditar();
    adicionarEventosEditarDesktop();
    adicionarEventosExcluir();
  } catch (erro) {
    console.error("Erro ao listar estoque:", erro);
    listaEstoque.innerHTML = "<p>Erro ao carregar estoque.</p>";
    if (tabelaEstoqueCorpo) {
      tabelaEstoqueCorpo.innerHTML = '<tr class="tabela-vazio"><td colspan="5">Erro ao carregar estoque.</td></tr>';
    }
  }
}
function adicionarEventosEditar() {
  document.querySelectorAll(".btn-editar-lote").forEach((botao) => {
    botao.addEventListener("click", () => {
      const id = botao.getAttribute("data-id");
      const lote = todosOsLotes.find((item) => item.id === id);
      if (!lote) return;
      loteEmEdicaoId = id;
      preencherFormulario(lote);
      botaoSalvar.textContent = "Atualizar Lote";
      tituloModal.textContent = "✏️ Editar Lote";
      window.fecharModal("modal-ver-estoque");
      window.abrirModal("modal-lote");
    });
  });
}
function adicionarEventosEditarDesktop() {
  document.querySelectorAll(".btn-editar-lote-desktop").forEach((botao) => {
    botao.addEventListener("click", () => {
      const id = botao.getAttribute("data-id");
      const lote = todosOsLotes.find((item) => item.id === id);
      if (!lote || !formLoteDesktop) return;
      loteEmEdicaoId = id;
      preencherFormularioDesktop(lote);
      if (tituloFormLoteDesktop) tituloFormLoteDesktop.textContent = "Editar Lote";
      if (botaoSalvarDesktop) botaoSalvarDesktop.textContent = "Atualizar Lote";
      if (botaoCancelarLoteDesktop) botaoCancelarLoteDesktop.classList.remove("oculto");
      formLoteDesktop.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  });
}
function adicionarEventosExcluir() {
  document.querySelectorAll(".btn-excluir-lote").forEach((botao) => {
    botao.addEventListener("click", async () => {
      const id = botao.getAttribute("data-id");
      if (!confirm("Tem certeza que deseja excluir este lote do estoque?")) return;
      try {
        await deleteDoc(doc(db, "usuarios", usuarioAtual.uid, "estoque", id));
        alert("Lote excluído com sucesso!");
        if (loteEmEdicaoId === id) limparFormulario();
        await listarEstoque(usuarioAtual);
      } catch (erro) {
        console.error("Erro ao excluir lote:", erro);
        alert("Erro ao excluir lote");
      }
    });
  });
}

// ── Início ────────────────────────────────────────────────────────────────────
(async function iniciarEstoque() {
  const resultado = await exigirUsuarioAprovado();
  if (!resultado) return;
  ativarTopbarDesktop(resultado.dados?.dados?.nome);
  usuarioAtual = resultado.user;
  await listarEstoque(usuarioAtual);
})();

// ── Formulário ────────────────────────────────────────────────────────────────
form.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!usuarioAtual) {
    alert("Usuário não autenticado");
    return;
  }
  const nome = document.getElementById("nome-lote").value.trim();
  const quantidadeSacas = Number(document.getElementById("quantidade-lote").value);
  const anotacoes = document.getElementById("anotacoes-lote").value.trim();

  try {
    if (loteEmEdicaoId) {
      await updateDoc(doc(db, "usuarios", usuarioAtual.uid, "estoque", loteEmEdicaoId), {
        nome, quantidadeSacas, anotacoes: anotacoes || null
      });
      alert("Lote atualizado com sucesso!");
    } else {
      await addDoc(collection(db, "usuarios", usuarioAtual.uid, "estoque"), {
        nome, quantidadeSacas, anotacoes: anotacoes || null, origem: "manual", criadoEm: new Date()
      });
      alert("Lote cadastrado com sucesso!");
    }
    window.fecharModalLote();
    await listarEstoque(usuarioAtual);
  } catch (erro) {
    console.error("Erro ao salvar lote:", erro);
    alert("Erro ao salvar lote");
  }
});

// Formulário do layout desktop novo — mesma lógica de cadastro/edição,
// sem modal (o "Editar" da tabela só troca o modo do form nesta mesma tela).
if (formLoteDesktop) {
  formLoteDesktop.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!usuarioAtual) {
      alert("Usuário não autenticado");
      return;
    }
    const nome = document.getElementById("nome-lote-desktop").value.trim();
    const quantidadeSacas = Number(document.getElementById("quantidade-lote-desktop").value);
    const anotacoes = document.getElementById("anotacoes-lote-desktop").value.trim();

    try {
      if (loteEmEdicaoId) {
        await updateDoc(doc(db, "usuarios", usuarioAtual.uid, "estoque", loteEmEdicaoId), {
          nome, quantidadeSacas, anotacoes: anotacoes || null
        });
        alert("Lote atualizado com sucesso!");
      } else {
        await addDoc(collection(db, "usuarios", usuarioAtual.uid, "estoque"), {
          nome, quantidadeSacas, anotacoes: anotacoes || null, origem: "manual", criadoEm: new Date()
        });
        alert("Lote cadastrado com sucesso!");
      }
      loteEmEdicaoId = null;
      limparFormularioDesktop();
      await listarEstoque(usuarioAtual);
    } catch (erro) {
      console.error("Erro ao salvar lote:", erro);
      alert("Erro ao salvar lote");
    }
  });
}
