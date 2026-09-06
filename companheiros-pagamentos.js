import { db } from "./firebase.js";
import { exigirUsuarioAprovado, ativarTopbarDesktop } from "./acesso.js";
import {
  collection, getDocs, doc, updateDoc, deleteDoc
} from "https://www.gstatic.com/firebasejs/12.10.0/firebase-firestore.js";
import { fmt, fmtBR, hoje, lancarDespesa, verificarPlanoCompleto } from "./companheiros-shared.js";

let usuarioAtual     = null;
let todosOsTrabalhos = [];

// ── Carregamento Firebase ─────────────────────────────────────────────────────
async function buscarTrabalhos() {
  todosOsTrabalhos = [];
  const snap = await getDocs(collection(db, "usuarios", usuarioAtual.uid, "trabalhosCompanheiros"));
  snap.forEach(d => todosOsTrabalhos.push({ id: d.id, ...d.data() }));
  renderizarTrabalhos();
}

// ── Trabalhos (pendentes / pagos com busca independente) ──────────────────────
function renderizarTrabalhos() {
  const pesquisaPendentes = (document.getElementById("pesquisa-pendentes")?.value || "").trim().toLowerCase();
  const pesquisaPagos     = (document.getElementById("pesquisa-pagos")?.value || "").trim().toLowerCase();

  const pendentes = todosOsTrabalhos
    .filter(t => t.statusPagamento === "pendente" && (t.companheiroNome || "").toLowerCase().includes(pesquisaPendentes))
    .sort((a, b) => new Date(b.data) - new Date(a.data));
  const pagos = todosOsTrabalhos
    .filter(t => t.statusPagamento === "pago" && (t.companheiroNome || "").toLowerCase().includes(pesquisaPagos))
    .sort((a, b) => new Date(b.dataPagamento || "1900-01-01") - new Date(a.dataPagamento || "1900-01-01"));

  let totalPendente = 0, totalPago = 0;
  const lp = document.getElementById("lista-pendentes");
  lp.innerHTML = pendentes.length === 0 ? "<p>Nenhum pagamento pendente.</p>" : "";
  pendentes.forEach(t => { totalPendente += Number(t.valor) || 0; lp.appendChild(criarCard(t)); });

  const lpg = document.getElementById("lista-pagos");
  lpg.innerHTML = pagos.length === 0 ? "<p>Nenhum pagamento realizado.</p>" : "";
  pagos.forEach(t => { totalPago += Number(t.valor) || 0; lpg.appendChild(criarCard(t)); });

  document.getElementById("total-pendente").textContent = fmt(totalPendente);
  document.getElementById("total-pago").textContent     = fmt(totalPago);
  adicionarEventosBotoes();
}
window.renderizarTrabalhos = renderizarTrabalhos;

function criarCard(t) {
  const estaPago = t.statusPagamento === "pago";
  const div = document.createElement("div");
  div.className = "card-item";
  div.innerHTML = `
    <p><strong>Companheiro:</strong> ${t.companheiroNome}</p>
    <p><strong>Chave Pix:</strong> ${t.companheiroTelefone || "-"}</p>
    <p><strong>Moita:</strong> ${t.moitaNome || "Sem moita específica"}</p>
    <p><strong>Data:</strong> ${fmtBR(t.data)}</p>
    <p><strong>Serviço:</strong> ${t.servico}</p>
    <p><strong>Tipo:</strong> ${t.tipoPagamento === "producao" ? "Produção" : "Diária"}</p>
    <p><strong>Valor:</strong> ${fmt(t.valor)}</p>
    <p><strong>Status:</strong> ${estaPago ? "✅ Pago" : "⏳ Pendente"}</p>
    ${estaPago ? `<p><strong>Data pagamento:</strong> ${fmtBR(t.dataPagamento)}</p>` : ""}
    ${!estaPago
      ? `<button data-id="${t.id}" class="btn-marcar-pago">Marcar como pago</button>`
      : `<button data-id="${t.id}" class="btn-voltar-pendente">Voltar para pendente</button>`}
    <button data-id="${t.id}" class="btn-excluir btn-excluir-trabalho">Excluir</button>`;
  return div;
}
function adicionarEventosBotoes() {
  document.querySelectorAll(".btn-marcar-pago").forEach(btn => {
    btn.addEventListener("click", async () => {
      const id = btn.getAttribute("data-id");
      const t  = todosOsTrabalhos.find(t => t.id === id);
      if (!t) return;
      if (t.lancadoComoDespesa || t.despesaId) { alert("Já lançado nas despesas."); return; }
      const dataPag = hoje();
      const despesaId = await lancarDespesa(db, usuarioAtual.uid, t, dataPag);
      await updateDoc(doc(db, "usuarios", usuarioAtual.uid, "trabalhosCompanheiros", id), {
        statusPagamento: "pago", dataPagamento: dataPag, lancadoComoDespesa: true, despesaId
      });
      await buscarTrabalhos();
    });
  });
  document.querySelectorAll(".btn-voltar-pendente").forEach(btn => {
    btn.addEventListener("click", async () => {
      if (!confirm("Voltar para pendente?")) return;
      const id = btn.getAttribute("data-id");
      const t  = todosOsTrabalhos.find(t => t.id === id);
      if (t?.despesaId) await deleteDoc(doc(db, "usuarios", usuarioAtual.uid, "despesas", t.despesaId));
      await updateDoc(doc(db, "usuarios", usuarioAtual.uid, "trabalhosCompanheiros", id), {
        statusPagamento: "pendente", dataPagamento: null, lancadoComoDespesa: false, despesaId: null
      });
      await buscarTrabalhos();
    });
  });
  document.querySelectorAll(".btn-excluir-trabalho").forEach(btn => {
    btn.addEventListener("click", async () => {
      if (!confirm("Excluir este registro?")) return;
      const id = btn.getAttribute("data-id");
      const t  = todosOsTrabalhos.find(t => t.id === id);
      if (t?.despesaId) await deleteDoc(doc(db, "usuarios", usuarioAtual.uid, "despesas", t.despesaId));
      await deleteDoc(doc(db, "usuarios", usuarioAtual.uid, "trabalhosCompanheiros", id));
      await buscarTrabalhos();
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
  } catch (erro) {
    console.error("Erro:", erro);
    window.location.href = "index.html";
  }
})();
