import { db } from "./firebase.js";
import { exigirUsuarioAprovado, ativarTopbarDesktop } from "./acesso.js";
import {
  collection, addDoc, getDocs, doc, deleteDoc
} from "https://www.gstatic.com/firebasejs/12.10.0/firebase-firestore.js";
import { verificarPlanoCompleto } from "./companheiros-shared.js";

let usuarioAtual        = null;
let todosOsCompanheiros = [];
let todasAsTurmas       = [];

// ── Modal (só usado no celular) ───────────────────────────────────────────────
window.abrirModal  = id => document.getElementById(id).classList.add("aberto");
window.fecharModal = id => document.getElementById(id).classList.remove("aberto");
document.querySelectorAll(".modal-overlay").forEach(m => {
  m.addEventListener("click", e => { if (e.target === m) m.classList.remove("aberto"); });
});

// ── Busca (desktop) ────────────────────────────────────────────────────────────
const pesquisaDesktop = document.getElementById("pesquisa-turma-desktop");
if (pesquisaDesktop) {
  pesquisaDesktop.addEventListener("input", () => {
    const termo = pesquisaDesktop.value.trim().toLowerCase();
    document.querySelectorAll("#tabela-turmas-corpo tr[data-nome]").forEach(linha => {
      const nome = linha.getAttribute("data-nome") || "";
      linha.classList.toggle("linha-oculta", !nome.includes(termo));
    });
  });
}

// ── Carregamento Firebase ─────────────────────────────────────────────────────
async function carregarCompanheiros() {
  todosOsCompanheiros = [];
  const snap = await getDocs(collection(db, "usuarios", usuarioAtual.uid, "companheiros"));
  snap.forEach(d => todosOsCompanheiros.push({ id: d.id, ...d.data() }));
  renderizarCheckboxesTurma();
}
async function carregarTurmas() {
  todasAsTurmas = [];
  const snap = await getDocs(collection(db, "usuarios", usuarioAtual.uid, "turmas"));
  snap.forEach(d => todasAsTurmas.push({ id: d.id, ...d.data() }));
  todasAsTurmas.sort((a, b) => (a.nome || "").localeCompare(b.nome || ""));
  renderizarTurmas();
}

// ── Checkboxes de companheiros (celular + desktop) ────────────────────────────
function renderizarCheckboxesTurma() {
  [document.getElementById("checkboxes-turma"), document.getElementById("checkboxes-turma-desktop")].forEach(c => {
    if (!c) return;
    c.innerHTML = todosOsCompanheiros.length === 0
      ? "<p class='sem-itens'>Nenhum companheiro cadastrado. Cadastre um companheiro antes de criar uma turma.</p>"
      : "";
    todosOsCompanheiros.forEach(comp => {
      const label = document.createElement("label");
      label.className = "checkbox-item";
      label.innerHTML = `<input type="checkbox" class="cb-turma" value="${comp.id}" data-nome="${comp.nome}"> ${comp.nome}`;
      c.appendChild(label);
    });
  });
}

// ── Renderização de turmas (celular = cards, desktop = tabela) ───────────────
function renderizarTurmas() {
  const listaMobile   = document.getElementById("lista-turmas");
  const tabelaDesktop = document.getElementById("tabela-turmas-corpo");
  const totalDesktop  = document.getElementById("total-turmas-desktop");

  listaMobile.innerHTML = todasAsTurmas.length === 0 ? "<p>Nenhuma turma cadastrada.</p>" : "";
  if (tabelaDesktop) {
    tabelaDesktop.innerHTML = todasAsTurmas.length === 0
      ? '<tr class="tabela-vazio"><td colspan="3">Nenhuma turma cadastrada.</td></tr>' : "";
  }
  if (totalDesktop) totalDesktop.textContent = todasAsTurmas.length;

  todasAsTurmas.forEach(t => {
    const div = document.createElement("div");
    div.className = "card-item";
    div.innerHTML = `
      <p><strong>${t.nome}</strong>: ${t.membros.length} membro(s)</p>
      <div class="tags">${t.membros.map(m => `<span class="tag">${m.nome}</span>`).join("")}</div>
      <button data-id="${t.id}" class="btn-excluir btn-excluir-turma">Excluir turma</button>`;
    listaMobile.appendChild(div);

    if (tabelaDesktop) {
      const tr = document.createElement("tr");
      tr.setAttribute("data-nome", (t.nome || "").toLowerCase());
      tr.innerHTML = `
        <td>${t.nome}</td>
        <td>${t.membros.map(m => m.nome).join(", ")}</td>
        <td><button data-id="${t.id}" class="btn-excluir-tabela btn-excluir-turma">Excluir</button></td>`;
      tabelaDesktop.appendChild(tr);
    }
  });

  document.querySelectorAll(".btn-excluir-turma").forEach(btn => {
    btn.addEventListener("click", async () => {
      if (!confirm("Excluir esta turma?")) return;
      await deleteDoc(doc(db, "usuarios", usuarioAtual.uid, "turmas", btn.getAttribute("data-id")));
      await carregarTurmas();
    });
  });
}

// ── Formulários (celular + desktop) ───────────────────────────────────────────
async function criarTurma(nome, selecionados) {
  const membros = selecionados.map(cb => ({ id: cb.value, nome: cb.getAttribute("data-nome") }));
  await addDoc(collection(db, "usuarios", usuarioAtual.uid, "turmas"), { nome, membros, criadoEm: new Date() });
  await carregarTurmas();
}

document.getElementById("criar-turma-form").addEventListener("submit", async e => {
  e.preventDefault();
  const nome = document.getElementById("nome-turma").value.trim();
  const selecionados = [...document.querySelectorAll("#checkboxes-turma .cb-turma:checked")];
  if (!selecionados.length) { alert("Selecione pelo menos um companheiro."); return; }
  await criarTurma(nome, selecionados);
  alert("Turma criada!");
  e.target.reset();
  document.querySelectorAll("#checkboxes-turma .cb-turma").forEach(cb => cb.checked = false);
  window.fecharModal("modal-turma");
});

const formDesktop = document.getElementById("criar-turma-form-desktop");
if (formDesktop) {
  formDesktop.addEventListener("submit", async e => {
    e.preventDefault();
    const nome = document.getElementById("nome-turma-desktop").value.trim();
    const selecionados = [...document.querySelectorAll("#checkboxes-turma-desktop .cb-turma:checked")];
    if (!selecionados.length) { alert("Selecione pelo menos um companheiro."); return; }
    await criarTurma(nome, selecionados);
    alert("Turma criada!");
    e.target.reset();
    document.querySelectorAll("#checkboxes-turma-desktop .cb-turma").forEach(cb => cb.checked = false);
  });
}

// ── Início ────────────────────────────────────────────────────────────────────
(async function iniciar() {
  try {
    const resultado = await exigirUsuarioAprovado();
    if (!resultado) return;
    ativarTopbarDesktop(resultado.dados?.dados?.nome);
    if (!verificarPlanoCompleto(resultado)) return;
    usuarioAtual = resultado.user;
    await carregarCompanheiros();
    await carregarTurmas();
  } catch (erro) {
    console.error("Erro:", erro);
    window.location.href = "index.html";
  }
})();
