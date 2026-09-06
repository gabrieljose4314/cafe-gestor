import { db } from "./firebase.js";
import { exigirUsuarioAprovado, ativarTopbarDesktop } from "./acesso.js";
import {
  collection, getDocs, doc, deleteDoc
} from "https://www.gstatic.com/firebasejs/12.10.0/firebase-firestore.js";
import { verificarPlanoCompleto } from "./companheiros-shared.js";

let usuarioAtual        = null;
let todosOsCompanheiros = [];
let todasAsTurmas       = [];
let todosOsTrabalhos    = [];

// ── Abas ──────────────────────────────────────────────────────────────────────
window.trocarAbaVer = function (aba) {
  const isComp = aba === "companheiros";
  document.getElementById("painel-ver-companheiros").style.display = isComp ? "block" : "none";
  document.getElementById("painel-ver-turmas").style.display       = isComp ? "none"  : "block";
  document.querySelectorAll(".abas .aba-btn").forEach((btn, i) => {
    btn.className = "aba-btn " + ((isComp ? i === 0 : i === 1) ? "ativa" : "inativa");
  });
};

// ── Carregamento Firebase ─────────────────────────────────────────────────────
async function carregarCompanheiros() {
  todosOsCompanheiros = [];
  const snap = await getDocs(collection(db, "usuarios", usuarioAtual.uid, "companheiros"));
  snap.forEach(d => todosOsCompanheiros.push({ id: d.id, ...d.data() }));
  renderizarCompanheiros();
}
async function carregarTurmas() {
  todasAsTurmas = [];
  const snap = await getDocs(collection(db, "usuarios", usuarioAtual.uid, "turmas"));
  snap.forEach(d => todasAsTurmas.push({ id: d.id, ...d.data() }));
  renderizarTurmas();
}
async function buscarTrabalhos() {
  todosOsTrabalhos = [];
  const snap = await getDocs(collection(db, "usuarios", usuarioAtual.uid, "trabalhosCompanheiros"));
  snap.forEach(d => todosOsTrabalhos.push({ id: d.id, ...d.data() }));
}

// ── Renderizações ─────────────────────────────────────────────────────────────
function renderizarCompanheiros() {
  const lista = document.getElementById("lista-companheiros");
  lista.innerHTML = todosOsCompanheiros.length === 0 ? "<p>Nenhum companheiro cadastrado.</p>" : "";
  todosOsCompanheiros.forEach(c => {
    const div = document.createElement("div");
    div.className = "card-item";
    div.innerHTML = `
      <p><strong>Nome:</strong> ${c.nome}</p>
      <p><strong>Chave Pix:</strong> ${c.pix || "-"}</p>
      <button data-id="${c.id}" class="btn-excluir btn-excluir-companheiro">Excluir</button>`;
    lista.appendChild(div);
  });
  document.querySelectorAll(".btn-excluir-companheiro").forEach(btn => {
    btn.addEventListener("click", async () => {
      const id = btn.getAttribute("data-id");
      if (todosOsTrabalhos.some(t => t.companheiroId === id)) {
        alert("Não é possível excluir — companheiro possui trabalhos cadastrados."); return;
      }
      if (!confirm("Excluir este companheiro?")) return;
      await deleteDoc(doc(db, "usuarios", usuarioAtual.uid, "companheiros", id));
      await carregarCompanheiros();
    });
  });
}
function renderizarTurmas() {
  const lista = document.getElementById("lista-turmas");
  lista.innerHTML = todasAsTurmas.length === 0 ? "<p>Nenhuma turma cadastrada.</p>" : "";
  todasAsTurmas.forEach(t => {
    const div = document.createElement("div");
    div.className = "card-item";
    div.innerHTML = `
      <p><strong>${t.nome}</strong> — ${t.membros.length} membro(s)</p>
      <div class="tags">${t.membros.map(m => `<span class="tag">${m.nome}</span>`).join("")}</div>
      <button data-id="${t.id}" class="btn-excluir btn-excluir-turma">Excluir turma</button>`;
    lista.appendChild(div);
  });
  document.querySelectorAll(".btn-excluir-turma").forEach(btn => {
    btn.addEventListener("click", async () => {
      if (!confirm("Excluir esta turma?")) return;
      await deleteDoc(doc(db, "usuarios", usuarioAtual.uid, "turmas", btn.getAttribute("data-id")));
      await carregarTurmas();
    });
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
    await buscarTrabalhos();
    await Promise.all([carregarCompanheiros(), carregarTurmas()]);
  } catch (erro) {
    console.error("Erro:", erro);
    window.location.href = "index.html";
  }
})();
