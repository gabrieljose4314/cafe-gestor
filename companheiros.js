import { db } from "./firebase.js";
import { exigirUsuarioAprovado } from "./acesso.js";

import {
  collection,
  addDoc,
  getDocs,
  doc,
  updateDoc,
  deleteDoc
} from "https://www.gstatic.com/firebasejs/12.10.0/firebase-firestore.js";

// ── Elementos ─────────────────────────────────────────────────────────────────
const formCompanheiro  = document.getElementById("cadastro-companheiro-form");
const formTurma        = document.getElementById("criar-turma-form");
const formTrabalho     = document.getElementById("registro-trabalho-form");
const selectMoita      = document.getElementById("moita-trabalho");
const selectTurma      = document.getElementById("select-turma");
const listaCompanheiros = document.getElementById("lista-companheiros");
const listaTurmas      = document.getElementById("lista-turmas");
const listaPendentes   = document.getElementById("lista-pendentes");
const listaPagos       = document.getElementById("lista-pagos");
const totalPendenteEl  = document.getElementById("total-pendente");
const totalPagoEl      = document.getElementById("total-pago");
const inputPesquisa    = document.getElementById("pesquisa-companheiro");
const modal            = document.getElementById("modal-companheiros");
const btnAbrirModal    = document.getElementById("btn-abrir-modal");
const btnConfirmar     = document.getElementById("btn-confirmar-companheiros");
const resumoSelecionados = document.getElementById("resumo-selecionados");

let usuarioAtual          = null;
let todosOsCompanheiros   = [];
let todasAsTurmas         = [];
let todosOsTrabalhos      = [];

// ── Utilitários ───────────────────────────────────────────────────────────────
function formatarMoeda(valor) {
  return Number(valor || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function obterDataHoje() {
  const hoje = new Date();
  return `${hoje.getFullYear()}-${String(hoje.getMonth()+1).padStart(2,"0")}-${String(hoje.getDate()).padStart(2,"0")}`;
}

function formatarDataBR(data) {
  if (!data) return "-";
  const p = data.split("-");
  return p.length !== 3 ? data : `${p[2]}/${p[1]}/${p[0]}`;
}

// ── Modal ─────────────────────────────────────────────────────────────────────
btnAbrirModal.addEventListener("click", () => { modal.style.display = "flex"; });

btnConfirmar.addEventListener("click", () => {
  modal.style.display = "none";
  atualizarResumoSelecionados();
});

modal.addEventListener("click", (e) => {
  if (e.target === modal) {
    modal.style.display = "none";
    atualizarResumoSelecionados();
  }
});

selectTurma.addEventListener("change", carregarPresenca);

// ── Trocar aba no modal ───────────────────────────────────────────────────────
window.trocarAba = function(aba) {
  const isTurma = aba === "turma";
  document.getElementById("painel-turma").style.display  = isTurma ? "block" : "none";
  document.getElementById("painel-avulso").style.display = isTurma ? "none"  : "block";
  document.getElementById("aba-turma").style.background  = isTurma ? "#2d4a2b" : "#e7dfd1";
  document.getElementById("aba-turma").style.color       = isTurma ? "#fff"    : "#2d4a2b";
  document.getElementById("aba-avulso").style.background = isTurma ? "#e7dfd1" : "#2d4a2b";
  document.getElementById("aba-avulso").style.color      = isTurma ? "#2d4a2b" : "#fff";
};

function atualizarResumoSelecionados() {
  const avulsos  = [...document.querySelectorAll(".cb-avulso:checked")];
  const presentes = [...document.querySelectorAll(".cb-presenca:checked")];
  const todos    = avulsos.length > 0 ? avulsos : presentes;
  resumoSelecionados.textContent = todos.length === 0
    ? "Nenhum selecionado."
    : `✅ ${todos.length} selecionado(s): ${todos.map(cb => cb.getAttribute("data-nome")).join(", ")}`;
}

// ── Tipo de pagamento ─────────────────────────────────────────────────────────
document.getElementById("tipo-pagamento").addEventListener("change", function() {
  const tipo = this.value;
  document.getElementById("campos-diaria").style.display   = tipo === "diaria"   ? "block" : "none";
  document.getElementById("campos-producao").style.display = tipo === "producao" ? "block" : "none";
});

document.getElementById("quantidade-producao").addEventListener("input", atualizarPreviewProducao);
document.getElementById("preco-producao").addEventListener("input", atualizarPreviewProducao);

function atualizarPreviewProducao() {
  const qtd   = parseFloat(document.getElementById("quantidade-producao").value) || 0;
  const preco = parseFloat(document.getElementById("preco-producao").value) || 0;
  const preview = document.getElementById("preview-producao");
  if (qtd > 0 && preco > 0) {
    preview.style.display = "block";
    preview.innerHTML = `<strong>Total a receber:</strong> ${formatarMoeda(qtd * preco)}`;
  } else {
    preview.style.display = "none";
  }
}

// ── Details hints ─────────────────────────────────────────────────────────────
document.getElementById("details-companheiros").addEventListener("toggle", function() {
  document.getElementById("hint-companheiros").textContent = this.open ? " — ocultar" : " — clique para ver";
});
document.getElementById("details-turmas").addEventListener("toggle", function() {
  document.getElementById("hint-turmas").textContent = this.open ? " — ocultar" : " — clique para ver";
});

// ── Carregamento de dados ─────────────────────────────────────────────────────
async function carregarCompanheiros(user) {
  todosOsCompanheiros = [];
  const snap = await getDocs(collection(db, "usuarios", user.uid, "companheiros"));
  snap.forEach(d => todosOsCompanheiros.push({ id: d.id, ...d.data() }));
  renderizarCompanheiros();
  renderizarCheckboxesTurma();
  renderizarCheckboxesAvulso();
}

async function carregarTurmas(user) {
  todasAsTurmas = [];
  const snap = await getDocs(collection(db, "usuarios", user.uid, "turmas"));
  snap.forEach(d => todasAsTurmas.push({ id: d.id, ...d.data() }));
  renderizarTurmas();
  atualizarSelectTurmas();
}

async function carregarMoitas(user) {
  selectMoita.innerHTML = '<option value="">Sem moita específica</option>';
  const snap = await getDocs(collection(db, "usuarios", user.uid, "moitas"));
  snap.forEach(d => {
    const opt = document.createElement("option");
    opt.value = d.id; opt.textContent = d.data().nome;
    selectMoita.appendChild(opt);
  });
}

async function buscarTrabalhos(user) {
  todosOsTrabalhos = [];
  const snap = await getDocs(collection(db, "usuarios", user.uid, "trabalhosCompanheiros"));
  snap.forEach(d => todosOsTrabalhos.push({ id: d.id, ...d.data() }));
  renderizarTrabalhos();
}

// ── Renderização ──────────────────────────────────────────────────────────────
function renderizarCompanheiros() {
  listaCompanheiros.innerHTML = "";
  if (todosOsCompanheiros.length === 0) {
    listaCompanheiros.innerHTML = "<p>Nenhum companheiro cadastrado.</p>"; return;
  }
  todosOsCompanheiros.forEach(c => {
    const div = document.createElement("div");
    div.innerHTML = `
      <p><strong>Nome:</strong> ${c.nome}</p>
      <p><strong>Chave Pix:</strong> ${c.pix || "-"}</p>
      <button data-id="${c.id}" class="btn-excluir-companheiro" style="background:#c1121f;">Excluir</button>
    `;
    listaCompanheiros.appendChild(div);
  });
  adicionarEventosExcluirCompanheiro();
}

function renderizarCheckboxesTurma() {
  const container = document.getElementById("checkboxes-turma");
  container.innerHTML = todosOsCompanheiros.length === 0
    ? "<p style='font-size:0.85rem;color:#888;'>Nenhum companheiro cadastrado.</p>"
    : "";
  todosOsCompanheiros.forEach(c => {
    const label = document.createElement("label");
    label.style.cssText = "display:flex;align-items:center;gap:8px;margin-bottom:8px;cursor:pointer;";
    label.innerHTML = `<input type="checkbox" class="cb-turma" value="${c.id}" data-nome="${c.nome}"> ${c.nome}`;
    container.appendChild(label);
  });
}

function renderizarCheckboxesAvulso() {
  const container = document.getElementById("companheiros-checkboxes");
  container.innerHTML = "";
  todosOsCompanheiros.forEach(c => {
    const label = document.createElement("label");
    label.style.cssText = "display:flex;align-items:center;gap:8px;margin-bottom:8px;cursor:pointer;";
    label.innerHTML = `<input type="checkbox" class="cb-avulso" value="${c.id}" data-nome="${c.nome}" data-pix="${c.pix || ""}"> ${c.nome}`;
    container.appendChild(label);
  });
}

function renderizarTurmas() {
  listaTurmas.innerHTML = "";
  if (todasAsTurmas.length === 0) {
    listaTurmas.innerHTML = "<p>Nenhuma turma cadastrada.</p>"; return;
  }
  todasAsTurmas.forEach(t => {
    const div = document.createElement("div");
    div.innerHTML = `
      <p><strong>${t.nome}</strong> — ${t.membros.length} membro(s)</p>
      <p style="font-size:0.85rem;color:#666;">${t.membros.map(m => m.nome).join(", ")}</p>
      <button data-id="${t.id}" class="btn-excluir-turma" style="background:#c1121f;">Excluir turma</button>
    `;
    listaTurmas.appendChild(div);
  });
  adicionarEventosExcluirTurma();
}

function atualizarSelectTurmas() {
  selectTurma.innerHTML = '<option value="">Selecione uma turma</option>';
  todasAsTurmas.forEach(t => {
    const opt = document.createElement("option");
    opt.value = t.id; opt.textContent = t.nome;
    selectTurma.appendChild(opt);
  });
}

function carregarPresenca() {
  const turmaId = selectTurma.value;
  const container = document.getElementById("presenca-container");
  const lista = document.getElementById("lista-presenca");

  if (!turmaId) { container.style.display = "none"; return; }

  const turma = todasAsTurmas.find(t => t.id === turmaId);
  lista.innerHTML = "";
  turma.membros.forEach(m => {
    const label = document.createElement("label");
    label.style.cssText = "display:flex;align-items:center;gap:8px;margin-bottom:8px;cursor:pointer;";
    label.innerHTML = `<input type="checkbox" class="cb-presenca" value="${m.id}" data-nome="${m.nome}" checked> ${m.nome}`;
    lista.appendChild(label);
  });

  container.style.display = "block";
  atualizarResumoPresenca();
  document.querySelectorAll(".cb-presenca").forEach(cb => cb.addEventListener("change", atualizarResumoPresenca));
}

function atualizarResumoPresenca() {
  const presentes = [...document.querySelectorAll(".cb-presenca:checked")];
  document.getElementById("resumo-presentes").textContent = presentes.length === 0
    ? "Nenhum presente."
    : `✅ ${presentes.length} presente(s): ${presentes.map(cb => cb.getAttribute("data-nome")).join(", ")}`;
}

// ── Renderizar trabalhos ──────────────────────────────────────────────────────
function renderizarTrabalhos() {
  listaPendentes.innerHTML = "";
  listaPagos.innerHTML = "";

  let totalPendente = 0, totalPago = 0;
  const pesquisa = inputPesquisa.value.trim().toLowerCase();

  const filtrados = todosOsTrabalhos.filter(t =>
    (t.companheiroNome || "").toLowerCase().includes(pesquisa)
  );

  const pendentes = filtrados.filter(t => t.statusPagamento === "pendente")
    .sort((a,b) => new Date(b.data) - new Date(a.data));

  const pagos = filtrados.filter(t => t.statusPagamento === "pago")
    .sort((a,b) => new Date(b.dataPagamento||"1900-01-01") - new Date(a.dataPagamento||"1900-01-01"));

  if (pendentes.length === 0) {
    listaPendentes.innerHTML = "<p>Nenhum pagamento pendente encontrado.</p>";
  } else {
    pendentes.forEach(t => {
      totalPendente += Number(t.valor) || 0;
      listaPendentes.appendChild(criarCardTrabalho(t));
    });
  }

  if (pagos.length === 0) {
    listaPagos.innerHTML = "<p>Nenhum pagamento realizado encontrado.</p>";
  } else {
    const details = document.createElement("details");
    const summary = document.createElement("summary");
    summary.textContent = `Ver pagamentos realizados (${pagos.length})`;
    details.appendChild(summary);
    pagos.forEach(t => {
      totalPago += Number(t.valor) || 0;
      details.appendChild(criarCardTrabalho(t));
    });
    listaPagos.appendChild(details);
  }

  totalPendenteEl.textContent = formatarMoeda(totalPendente);
  totalPagoEl.textContent     = formatarMoeda(totalPago);
}

function criarCardTrabalho(trabalho) {
  const estaPago = trabalho.statusPagamento === "pago";
  const div = document.createElement("div");
  div.innerHTML = `
    <p><strong>Companheiro:</strong> ${trabalho.companheiroNome}</p>
    <p><strong>Chave Pix:</strong> ${trabalho.companheiroTelefone || "-"}</p>
    <p><strong>Moita:</strong> ${trabalho.moitaNome || "Sem moita específica"}</p>
    <p><strong>Data:</strong> ${formatarDataBR(trabalho.data)}</p>
    <p><strong>Serviço:</strong> ${trabalho.servico}</p>
    <p><strong>Tipo:</strong> ${trabalho.tipoPagamento === "producao" ? "Produção" : "Diária"}</p>
    <p><strong>Valor:</strong> ${formatarMoeda(trabalho.valor)}</p>
    <p><strong>Status:</strong> ${estaPago ? "Pago" : "Pendente"}</p>
    ${estaPago ? `<p><strong>Data pagamento:</strong> ${formatarDataBR(trabalho.dataPagamento)}</p>` : ""}
    ${!estaPago
      ? `<button data-id="${trabalho.id}" class="btn-marcar-pago">Marcar como pago</button>`
      : `<button data-id="${trabalho.id}" class="btn-voltar-pendente" style="background:#bc6c25;">Voltar para pendente</button>`}
    <button data-id="${trabalho.id}" class="btn-excluir-trabalho" style="background:#c1121f;">Excluir</button>
  `;
  return div;
}

// ── Eventos dos botões ────────────────────────────────────────────────────────
function adicionarEventosBotoes() {
  document.querySelectorAll(".btn-marcar-pago").forEach(btn => {
    btn.addEventListener("click", async () => {
      const id = btn.getAttribute("data-id");
      const trabalho = todosOsTrabalhos.find(t => t.id === id);
      if (!trabalho) return;
      if (trabalho.lancadoComoDespesa || trabalho.despesaId) {
        alert("Este pagamento já foi lançado nas despesas."); return;
      }
      const dataPagamento = obterDataHoje();
      const despesaId = await lancarDespesa(trabalho, dataPagamento);
      await updateDoc(doc(db, "usuarios", usuarioAtual.uid, "trabalhosCompanheiros", id), {
        statusPagamento: "pago", dataPagamento, lancadoComoDespesa: true, despesaId
      });
      alert("Pagamento marcado como pago!");
      await buscarTrabalhos(usuarioAtual);
    });
  });

  document.querySelectorAll(".btn-voltar-pendente").forEach(btn => {
    btn.addEventListener("click", async () => {
      if (!confirm("Voltar para pendente?")) return;
      const id = btn.getAttribute("data-id");
      const trabalho = todosOsTrabalhos.find(t => t.id === id);
      if (trabalho?.despesaId) {
        await deleteDoc(doc(db, "usuarios", usuarioAtual.uid, "despesas", trabalho.despesaId));
      }
      await updateDoc(doc(db, "usuarios", usuarioAtual.uid, "trabalhosCompanheiros", id), {
        statusPagamento: "pendente", dataPagamento: null, lancadoComoDespesa: false, despesaId: null
      });
      alert("Voltou para pendente!");
      await buscarTrabalhos(usuarioAtual);
    });
  });

  document.querySelectorAll(".btn-excluir-trabalho").forEach(btn => {
    btn.addEventListener("click", async () => {
      if (!confirm("Excluir este registro?")) return;
      const id = btn.getAttribute("data-id");
      const trabalho = todosOsTrabalhos.find(t => t.id === id);
      if (trabalho?.despesaId) {
        await deleteDoc(doc(db, "usuarios", usuarioAtual.uid, "despesas", trabalho.despesaId));
      }
      await deleteDoc(doc(db, "usuarios", usuarioAtual.uid, "trabalhosCompanheiros", id));
      alert("Registro excluído!");
      await buscarTrabalhos(usuarioAtual);
    });
  });
}

function renderizarTrabalhos() {
  listaPendentes.innerHTML = "";
  listaPagos.innerHTML = "";

  let totalPendente = 0, totalPago = 0;
  const pesquisa = inputPesquisa.value.trim().toLowerCase();

  const filtrados = todosOsTrabalhos.filter(t =>
    (t.companheiroNome || "").toLowerCase().includes(pesquisa)
  );

  const pendentes = filtrados.filter(t => t.statusPagamento === "pendente")
    .sort((a,b) => new Date(b.data) - new Date(a.data));

  const pagos = filtrados.filter(t => t.statusPagamento === "pago")
    .sort((a,b) => new Date(b.dataPagamento||"1900-01-01") - new Date(a.dataPagamento||"1900-01-01"));

  if (pendentes.length === 0) {
    listaPendentes.innerHTML = "<p>Nenhum pagamento pendente encontrado.</p>";
  } else {
    pendentes.forEach(t => {
      totalPendente += Number(t.valor) || 0;
      listaPendentes.appendChild(criarCardTrabalho(t));
    });
  }

  if (pagos.length === 0) {
    listaPagos.innerHTML = "<p>Nenhum pagamento realizado encontrado.</p>";
  } else {
    const details = document.createElement("details");
    const summary = document.createElement("summary");
    summary.textContent = `Ver pagamentos realizados (${pagos.length})`;
    details.appendChild(summary);
    pagos.forEach(t => {
      totalPago += Number(t.valor) || 0;
      details.appendChild(criarCardTrabalho(t));
    });
    listaPagos.appendChild(details);
  }

  totalPendenteEl.textContent = formatarMoeda(totalPendente);
  totalPagoEl.textContent     = formatarMoeda(totalPago);

  adicionarEventosBotoes();
}

function adicionarEventosExcluirCompanheiro() {
  document.querySelectorAll(".btn-excluir-companheiro").forEach(btn => {
    btn.addEventListener("click", async () => {
      const id = btn.getAttribute("data-id");
      const temTrabalho = todosOsTrabalhos.some(t => t.companheiroId === id);
      if (temTrabalho) { alert("Não é possível excluir — companheiro possui trabalhos cadastrados."); return; }
      if (!confirm("Excluir este companheiro?")) return;
      await deleteDoc(doc(db, "usuarios", usuarioAtual.uid, "companheiros", id));
      alert("Companheiro excluído!");
      await carregarCompanheiros(usuarioAtual);
    });
  });
}

function adicionarEventosExcluirTurma() {
  document.querySelectorAll(".btn-excluir-turma").forEach(btn => {
    btn.addEventListener("click", async () => {
      if (!confirm("Excluir esta turma?")) return;
      const id = btn.getAttribute("data-id");
      await deleteDoc(doc(db, "usuarios", usuarioAtual.uid, "turmas", id));
      alert("Turma excluída!");
      await carregarTurmas(usuarioAtual);
    });
  });
}

// ── Lançar despesa ao pagar ───────────────────────────────────────────────────
async function lancarDespesa(trabalho, dataPagamento) {
  const ref = await addDoc(collection(db, "usuarios", usuarioAtual.uid, "despesas"), {
    categoria: "Mão de Obra",
    descricao: `Pagamento para ${trabalho.companheiroNome} - ${trabalho.servico}`,
    valor: Number(trabalho.valor) || 0,
    data: dataPagamento,
    moitaId: trabalho.moitaId || null,
    moitaNome: trabalho.moitaNome || null,
    criadoEm: new Date()
  });
  return ref.id;
}

// ── Formulários ───────────────────────────────────────────────────────────────
formCompanheiro.addEventListener("submit", async (e) => {
  e.preventDefault();
  const nome = document.getElementById("nome-companheiro").value.trim();
  const pix  = document.getElementById("pix-companheiro").value.trim();
  await addDoc(collection(db, "usuarios", usuarioAtual.uid, "companheiros"), {
    nome, pix: pix || null, criadoEm: new Date()
  });
  alert("Companheiro cadastrado!");
  formCompanheiro.reset();
  await carregarCompanheiros(usuarioAtual);
});

formTurma.addEventListener("submit", async (e) => {
  e.preventDefault();
  const nome = document.getElementById("nome-turma").value.trim();
  const selecionados = [...document.querySelectorAll(".cb-turma:checked")];
  if (selecionados.length === 0) { alert("Selecione pelo menos um companheiro."); return; }

  const membros = selecionados.map(cb => ({ id: cb.value, nome: cb.getAttribute("data-nome") }));
  await addDoc(collection(db, "usuarios", usuarioAtual.uid, "turmas"), {
    nome, membros, criadoEm: new Date()
  });
  alert(`Turma "${nome}" criada!`);
  formTurma.reset();
  document.querySelectorAll(".cb-turma").forEach(cb => cb.checked = false);
  await carregarTurmas(usuarioAtual);
});

formTrabalho.addEventListener("submit", async (e) => {
  e.preventDefault();

  const avulsos  = [...document.querySelectorAll(".cb-avulso:checked")];
  const presentes = [...document.querySelectorAll(".cb-presenca:checked")];
  const selecionados = avulsos.length > 0 ? avulsos : presentes;

  if (selecionados.length === 0) { alert("Selecione pelo menos um companheiro ou turma."); return; }

  const moitaId   = selectMoita.value;
  const moitaNome = moitaId ? selectMoita.options[selectMoita.selectedIndex].text : null;
  const data      = document.getElementById("data-trabalho").value;
  const servico   = document.getElementById("servico-trabalho").value.trim();
  const tipo      = document.getElementById("tipo-pagamento").value;
  const status    = document.getElementById("status-pagamento").value;
  const dataPagamento = status === "pago" ? obterDataHoje() : null;

  let valor = 0;
  if (tipo === "diaria") {
    valor = parseFloat(document.getElementById("valor-trabalho").value);
    if (!valor) { alert("Digite o valor."); return; }
  } else {
    const qtd   = parseFloat(document.getElementById("quantidade-producao").value);
    const preco = parseFloat(document.getElementById("preco-producao").value);
    if (!qtd)   { alert("Digite a quantidade."); return; }
    if (!preco) { alert("Digite o preço por produção."); return; }
    valor = qtd * preco;
  }

  for (const cb of selecionados) {
    const trabalhoBase = {
      companheiroId: cb.value,
      companheiroNome: cb.getAttribute("data-nome"),
      companheiroTelefone: cb.getAttribute("data-pix") || null,
      moitaId: moitaId || null, moitaNome: moitaNome || null,
      data, servico, valor, tipoPagamento: tipo,
      statusPagamento: status, dataPagamento,
      lancadoComoDespesa: false, despesaId: null,
      criadoEm: new Date()
    };

    const ref = await addDoc(
      collection(db, "usuarios", usuarioAtual.uid, "trabalhosCompanheiros"),
      trabalhoBase
    );

    if (status === "pago") {
      const despesaId = await lancarDespesa(trabalhoBase, dataPagamento);
      await updateDoc(doc(db, "usuarios", usuarioAtual.uid, "trabalhosCompanheiros", ref.id), {
        lancadoComoDespesa: true, despesaId
      });
    }
  }

  alert(`Trabalho registrado para ${selecionados.length} companheiro(s)!`);
  formTrabalho.reset();
  document.querySelectorAll(".cb-avulso, .cb-presenca").forEach(cb => cb.checked = false);
  document.getElementById("resumo-selecionados").textContent = "Nenhum selecionado.";
  document.getElementById("presenca-container").style.display = "none";
  document.getElementById("preview-producao").style.display = "none";
  await buscarTrabalhos(usuarioAtual);
});

inputPesquisa.addEventListener("input", renderizarTrabalhos);

// ── Início ────────────────────────────────────────────────────────────────────
(async function iniciarCompanheiros() {
  try {
    const resultado = await exigirUsuarioAprovado();
    if (!resultado) return;

    const plano = resultado.dados?.acesso?.plano || "basico";
    if (plano !== "completo") {
      alert("Seu plano não tem acesso a esta página.\nFaça upgrade para o plano Completo!");
      window.location.href = "index.html";
      return;
    }

    usuarioAtual = resultado.user;

    await Promise.all([
      carregarCompanheiros(usuarioAtual),
      carregarTurmas(usuarioAtual),
      carregarMoitas(usuarioAtual)
    ]);
    await buscarTrabalhos(usuarioAtual);

  } catch (erro) {
    console.error("Erro ao iniciar página de companheiros:", erro);
    window.location.href = "index.html";
  }
})();