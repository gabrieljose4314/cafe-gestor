import { db } from "./firebase.js";
import { exigirUsuarioAprovado } from "./acesso.js";
import {
  collection, addDoc, getDocs,
  doc, updateDoc, deleteDoc
} from "https://www.gstatic.com/firebasejs/12.10.0/firebase-firestore.js";

let usuarioAtual        = null;
let todosOsCompanheiros = [];
let todasAsTurmas       = [];
let todosOsTrabalhos    = [];

// ── Utilitários ───────────────────────────────────────────────────────────────
const fmt = v => Number(v||0).toLocaleString("pt-BR",{style:"currency",currency:"BRL"});
const hoje = () => { const d=new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`; };
const fmtBR = d => { if(!d) return "-"; const p=d.split("-"); return p.length!==3?d:`${p[2]}/${p[1]}/${p[0]}`; };

// ── Modal ─────────────────────────────────────────────────────────────────────
window.abrirModal  = id => document.getElementById(id).classList.add("aberto");
window.fecharModal = id => document.getElementById(id).classList.remove("aberto");
document.querySelectorAll(".modal-overlay").forEach(m => {
  m.addEventListener("click", e => {
    if (e.target === m) {
      m.classList.remove("aberto");
      if (m.id === "modal-selecao") atualizarResumo();
    }
  });
});

// ── Abas ver ──────────────────────────────────────────────────────────────────
window.trocarAbaVer = function(aba) {
  const isComp = aba === "companheiros";
  document.getElementById("painel-ver-companheiros").style.display = isComp ? "block" : "none";
  document.getElementById("painel-ver-turmas").style.display       = isComp ? "none"  : "block";
  document.querySelectorAll("#modal-ver .aba-btn").forEach((btn,i) => {
    btn.className = "aba-btn " + ((isComp?i===0:i===1) ? "ativa" : "inativa");
  });
};

// ── Tipo de pagamento ─────────────────────────────────────────────────────────
window.alternarTipo = function() {
  const tipo = document.getElementById("tipo-pagamento").value;
  document.getElementById("campos-diaria").style.display    = tipo === "diaria"   ? "block" : "none";
  document.getElementById("btn-registrar").style.display    = tipo === "diaria"   ? "inline-block" : "none";
  document.getElementById("btn-prosseguir").style.display   = tipo === "producao" ? "inline-block" : "none";
  verificarFormulario();
};

// ── Verificar formulário ──────────────────────────────────────────────────────
window.verificarFormulario = function() {
  const tipo       = document.getElementById("tipo-pagamento").value;
  const data       = document.getElementById("data-trabalho").value;
  const servico    = document.getElementById("servico-trabalho").value.trim();
  const selecionados = [...document.querySelectorAll(".cb-avulso:checked")];
  const valor      = parseFloat(document.getElementById("valor-trabalho").value);
  let completo = data && servico && selecionados.length > 0;
  if (tipo === "diaria") completo = completo && valor > 0;
  const btnId = tipo === "diaria" ? "btn-registrar" : "btn-prosseguir";
  const btn = document.getElementById(btnId);
  btn.classList.toggle("habilitado", completo);
  btn.classList.toggle("desabilitado", !completo);
};

// ── Filtrar por turma ─────────────────────────────────────────────────────────
window.filtrarPorTurma = function() {
  const turmaId = document.getElementById("select-turma").value;
  document.querySelectorAll(".cb-avulso").forEach(cb => cb.checked = false);
  if (turmaId) {
    const turma = todasAsTurmas.find(t => t.id === turmaId);
    if (turma) turma.membros.forEach(m => {
      const cb = document.querySelector(`.cb-avulso[value="${m.id}"]`);
      if (cb) cb.checked = true;
    });
  }
  atualizarResumoPresentes();
};
function atualizarResumoPresentes() {
  const marcados = [...document.querySelectorAll(".cb-avulso:checked")];
  document.getElementById("resumo-presentes").textContent = marcados.length === 0
    ? "" : `✅ ${marcados.length} selecionado(s): ${marcados.map(cb=>cb.getAttribute("data-nome")).join(", ")}`;
}
window.filtrarPorNome = function() {
  const termo = document.getElementById("pesquisa-selecao").value.trim().toLowerCase();
  document.querySelectorAll("#companheiros-checkboxes .checkbox-item").forEach(label => {
    const nome = label.querySelector("input").getAttribute("data-nome").toLowerCase();
    label.style.display = nome.includes(termo) ? "block" : "none";
  });
};
window.confirmarSelecao = function() {
  fecharModal("modal-selecao");
  atualizarResumo();
  verificarFormulario();
};
function atualizarResumo() {
  const marcados = [...document.querySelectorAll(".cb-avulso:checked")];
  document.getElementById("resumo-selecionados").textContent = marcados.length === 0
    ? "Nenhum selecionado."
    : `✅ ${marcados.length} selecionado(s): ${marcados.map(cb=>cb.getAttribute("data-nome")).join(", ")}`;
}

// ── Abrir etapa produção ──────────────────────────────────────────────────────
window.abrirEtapaProducao = function() {
  const data       = document.getElementById("data-trabalho").value;
  const servico    = document.getElementById("servico-trabalho").value.trim();
  const selecionados = [...document.querySelectorAll(".cb-avulso:checked")];
  const msgEl      = document.getElementById("msg-validacao");
  const mostrarErro = msg => {
    msgEl.textContent = `⚠️ ${msg}`;
    msgEl.style.display = "block";
    setTimeout(() => msgEl.style.display = "none", 3000);
  };
  if (!data)                 return mostrarErro("Preencha a data.");
  if (!servico)              return mostrarErro("Preencha o serviço realizado.");
  if (!selecionados.length)  return mostrarErro("Selecione pelo menos um companheiro.");
  msgEl.style.display = "none";
  const lista = document.getElementById("lista-producao-companheiros");
  lista.innerHTML = "";
  selecionados.forEach(cb => {
    const div = document.createElement("div");
    div.className = "producao-item";
    div.innerHTML = `
      <div class="producao-item-linha">
        <strong class="producao-item-nome">${cb.getAttribute("data-nome")}</strong>
        <input type="number" step="0.01" placeholder="Qtd" data-id="${cb.value}" data-nome="${cb.getAttribute("data-nome")}"
          class="input-qtd-producao" oninput="calcularProducao()">
        <span class="valor-individual" data-id="${cb.value}">R$ 0,00</span>
      </div>`;
    lista.appendChild(div);
  });
  document.getElementById("valor-producao").value = "";
  document.getElementById("total-producao-box").style.display = "none";
  document.getElementById("total-producao-geral").textContent = "R$ 0,00";
  fecharModal("modal-trabalho");
  abrirModal("modal-producao");
};

// ── Calcular produção ─────────────────────────────────────────────────────────
window.calcularProducao = function() {
  const valorUnit = parseFloat(document.getElementById("valor-producao").value) || 0;
  let totalGeral = 0;
  document.querySelectorAll(".input-qtd-producao").forEach(input => {
    const qtd   = parseFloat(input.value) || 0;
    const total = qtd * valorUnit;
    totalGeral += total;
    const span = document.querySelector(`.valor-individual[data-id="${input.getAttribute("data-id")}"]`);
    if (span) span.textContent = fmt(total);
  });
  const box = document.getElementById("total-producao-box");
  box.style.display = totalGeral > 0 ? "block" : "none";
  document.getElementById("total-producao-geral").textContent = fmt(totalGeral);
};

// ── Registrar produção ────────────────────────────────────────────────────────
window.registrarProducao = async function() {
  const valorUnit = parseFloat(document.getElementById("valor-producao").value);
  if (!valorUnit) { alert("Digite o valor da produção."); return; }
  const inputs = [...document.querySelectorAll(".input-qtd-producao")];
  if (inputs.some(i => !parseFloat(i.value))) {
    alert("Preencha a quantidade de todos os companheiros."); return;
  }
  const data    = document.getElementById("data-trabalho").value;
  const servico = document.getElementById("servico-trabalho").value.trim();
  const status  = document.getElementById("status-producao").value;
  const moitaId = document.getElementById("moita-trabalho").value;
  const moitaNome = moitaId ? document.getElementById("moita-trabalho").options[document.getElementById("moita-trabalho").selectedIndex].text : null;
  const dataPagamento = status === "pago" ? hoje() : null;
  for (const input of inputs) {
    const qtd   = parseFloat(input.value);
    const valor = qtd * valorUnit;
    const trabalhoBase = {
      companheiroId: input.getAttribute("data-id"),
      companheiroNome: input.getAttribute("data-nome"),
      moitaId: moitaId || null, moitaNome: moitaNome || null,
      data, servico, valor, tipoPagamento: "producao",
      statusPagamento: status, dataPagamento,
      quantidade: qtd, valorUnit,
      lancadoComoDespesa: false, despesaId: null, criadoEm: new Date()
    };
    const ref = await addDoc(collection(db, "usuarios", usuarioAtual.uid, "trabalhosCompanheiros"), trabalhoBase);
    if (status === "pago") {
      const despesaId = await lancarDespesa(trabalhoBase, dataPagamento);
      await updateDoc(doc(db, "usuarios", usuarioAtual.uid, "trabalhosCompanheiros", ref.id), { lancadoComoDespesa: true, despesaId });
    }
  }
  alert(`Produção registrada para ${inputs.length} companheiro(s)!`);
  document.getElementById("registro-trabalho-form").reset();
  document.querySelectorAll(".cb-avulso").forEach(cb => cb.checked = false);
  document.getElementById("resumo-selecionados").textContent = "Nenhum selecionado.";
  document.getElementById("select-turma").value = "";
  fecharModal("modal-producao");
  await buscarTrabalhos(usuarioAtual);
};

// ── Lançar despesa ────────────────────────────────────────────────────────────
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

// ── Carregamento Firebase ─────────────────────────────────────────────────────
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
  const sel = document.getElementById("moita-trabalho");
  sel.innerHTML = '<option value="">Sem moita específica</option>';
  const snap = await getDocs(collection(db, "usuarios", user.uid, "moitas"));
  snap.forEach(d => {
    const opt = document.createElement("option");
    opt.value = d.id; opt.textContent = d.data().nome;
    sel.appendChild(opt);
  });
}
async function buscarTrabalhos(user) {
  todosOsTrabalhos = [];
  const snap = await getDocs(collection(db, "usuarios", user.uid, "trabalhosCompanheiros"));
  snap.forEach(d => todosOsTrabalhos.push({ id: d.id, ...d.data() }));
  renderizarTrabalhos();
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
      await carregarCompanheiros(usuarioAtual);
    });
  });
}
function renderizarCheckboxesTurma() {
  const c = document.getElementById("checkboxes-turma");
  c.innerHTML = todosOsCompanheiros.length === 0 ? "<p class='sem-itens'>Nenhum companheiro cadastrado.</p>" : "";
  todosOsCompanheiros.forEach(comp => {
    const label = document.createElement("label");
    label.className = "checkbox-item";
    label.innerHTML = `<input type="checkbox" class="cb-turma" value="${comp.id}" data-nome="${comp.nome}"> ${comp.nome}`;
    c.appendChild(label);
  });
}
function renderizarCheckboxesAvulso() {
  const c = document.getElementById("companheiros-checkboxes");
  c.innerHTML = "";
  todosOsCompanheiros.forEach(comp => {
    const label = document.createElement("label");
    label.className = "checkbox-item";
    label.innerHTML = `<input type="checkbox" class="cb-avulso" value="${comp.id}" data-nome="${comp.nome}" data-pix="${comp.pix||""}"> ${comp.nome}`;
    c.appendChild(label);
    label.querySelector("input").addEventListener("change", () => { atualizarResumoPresentes(); verificarFormulario(); });
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
      <div class="tags">${t.membros.map(m=>`<span class="tag">${m.nome}</span>`).join("")}</div>
      <button data-id="${t.id}" class="btn-excluir btn-excluir-turma">Excluir turma</button>`;
    lista.appendChild(div);
  });
  document.querySelectorAll(".btn-excluir-turma").forEach(btn => {
    btn.addEventListener("click", async () => {
      if (!confirm("Excluir esta turma?")) return;
      await deleteDoc(doc(db, "usuarios", usuarioAtual.uid, "turmas", btn.getAttribute("data-id")));
      await carregarTurmas(usuarioAtual);
    });
  });
}
function atualizarSelectTurmas() {
  const sel = document.getElementById("select-turma");
  sel.innerHTML = '<option value="">Nenhuma (mostrar todos)</option>';
  todasAsTurmas.forEach(t => {
    const opt = document.createElement("option");
    opt.value = t.id; opt.textContent = t.nome;
    sel.appendChild(opt);
  });
}

// ── Trabalhos (pendentes / pagos com busca independente) ──────────────────────
function renderizarTrabalhos() {
  const pesquisaPendentes = (document.getElementById("pesquisa-pendentes")?.value || "").trim().toLowerCase();
  const pesquisaPagos     = (document.getElementById("pesquisa-pagos")?.value || "").trim().toLowerCase();

  const pendentes = todosOsTrabalhos
    .filter(t => t.statusPagamento === "pendente" && (t.companheiroNome||"").toLowerCase().includes(pesquisaPendentes))
    .sort((a,b) => new Date(b.data)-new Date(a.data));
  const pagos = todosOsTrabalhos
    .filter(t => t.statusPagamento === "pago" && (t.companheiroNome||"").toLowerCase().includes(pesquisaPagos))
    .sort((a,b) => new Date(b.dataPagamento||"1900-01-01")-new Date(a.dataPagamento||"1900-01-01"));

  let totalPendente = 0, totalPago = 0;
  const lp = document.getElementById("lista-pendentes");
  lp.innerHTML = pendentes.length === 0 ? "<p>Nenhum pagamento pendente.</p>" : "";
  pendentes.forEach(t => { totalPendente += Number(t.valor)||0; lp.appendChild(criarCard(t)); });

  const lpg = document.getElementById("lista-pagos");
  lpg.innerHTML = pagos.length === 0 ? "<p>Nenhum pagamento realizado.</p>" : "";
  pagos.forEach(t => { totalPago += Number(t.valor)||0; lpg.appendChild(criarCard(t)); });

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
      const despesaId = await lancarDespesa(t, dataPag);
      await updateDoc(doc(db, "usuarios", usuarioAtual.uid, "trabalhosCompanheiros", id), {
        statusPagamento: "pago", dataPagamento: dataPag, lancadoComoDespesa: true, despesaId
      });
      await buscarTrabalhos(usuarioAtual);
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
      await buscarTrabalhos(usuarioAtual);
    });
  });
  document.querySelectorAll(".btn-excluir-trabalho").forEach(btn => {
    btn.addEventListener("click", async () => {
      if (!confirm("Excluir este registro?")) return;
      const id = btn.getAttribute("data-id");
      const t  = todosOsTrabalhos.find(t => t.id === id);
      if (t?.despesaId) await deleteDoc(doc(db, "usuarios", usuarioAtual.uid, "despesas", t.despesaId));
      await deleteDoc(doc(db, "usuarios", usuarioAtual.uid, "trabalhosCompanheiros", id));
      await buscarTrabalhos(usuarioAtual);
    });
  });
}

// ── Formulários ───────────────────────────────────────────────────────────────
document.getElementById("cadastro-companheiro-form").addEventListener("submit", async e => {
  e.preventDefault();
  const nome = document.getElementById("nome-companheiro").value.trim();
  const pix  = document.getElementById("pix-companheiro").value.trim();
  await addDoc(collection(db, "usuarios", usuarioAtual.uid, "companheiros"), { nome, pix: pix||null, criadoEm: new Date() });
  e.target.reset();
  fecharModal("modal-cadastro");
  await carregarCompanheiros(usuarioAtual);
});
document.getElementById("criar-turma-form").addEventListener("submit", async e => {
  e.preventDefault();
  const nome = document.getElementById("nome-turma").value.trim();
  const selecionados = [...document.querySelectorAll(".cb-turma:checked")];
  if (!selecionados.length) { alert("Selecione pelo menos um companheiro."); return; }
  const membros = selecionados.map(cb => ({ id: cb.value, nome: cb.getAttribute("data-nome") }));
  await addDoc(collection(db, "usuarios", usuarioAtual.uid, "turmas"), { nome, membros, criadoEm: new Date() });
  e.target.reset();
  document.querySelectorAll(".cb-turma").forEach(cb => cb.checked = false);
  fecharModal("modal-turma");
  await carregarTurmas(usuarioAtual);
});
document.getElementById("registro-trabalho-form").addEventListener("submit", async e => {
  e.preventDefault();
  const selecionados = [...document.querySelectorAll(".cb-avulso:checked")];
  if (!selecionados.length) { alert("Selecione pelo menos um companheiro."); return; }
  const data    = document.getElementById("data-trabalho").value;
  const servico = document.getElementById("servico-trabalho").value.trim();
  const moitaId = document.getElementById("moita-trabalho").value;
  const moitaNome = moitaId ? document.getElementById("moita-trabalho").options[document.getElementById("moita-trabalho").selectedIndex].text : null;
  const status  = document.getElementById("status-pagamento").value;
  const dataPagamento = status === "pago" ? hoje() : null;
  const valor   = parseFloat(document.getElementById("valor-trabalho").value);
  if (!valor) { alert("Digite o valor."); return; }
  for (const cb of selecionados) {
    const trabalhoBase = {
      companheiroId: cb.value, companheiroNome: cb.getAttribute("data-nome"),
      companheiroTelefone: cb.getAttribute("data-pix") || null,
      moitaId: moitaId||null, moitaNome: moitaNome||null,
      data, servico, valor, tipoPagamento: "diaria",
      statusPagamento: status, dataPagamento,
      lancadoComoDespesa: false, despesaId: null, criadoEm: new Date()
    };
    const ref = await addDoc(collection(db, "usuarios", usuarioAtual.uid, "trabalhosCompanheiros"), trabalhoBase);
    if (status === "pago") {
      const despesaId = await lancarDespesa(trabalhoBase, dataPagamento);
      await updateDoc(doc(db, "usuarios", usuarioAtual.uid, "trabalhosCompanheiros", ref.id), { lancadoComoDespesa: true, despesaId });
    }
  }
  e.target.reset();
  document.querySelectorAll(".cb-avulso").forEach(cb => cb.checked = false);
  document.getElementById("resumo-selecionados").textContent = "Nenhum selecionado.";
  document.getElementById("select-turma").value = "";
  fecharModal("modal-trabalho");
  await buscarTrabalhos(usuarioAtual);
});
document.getElementById("btn-abrir-selecao").addEventListener("click", () => abrirModal("modal-selecao"));

// ── Início ────────────────────────────────────────────────────────────────────
(async function iniciar() {
  try {
    const resultado = await exigirUsuarioAprovado();
    if (!resultado) return;
    const plano = resultado.dados?.acesso?.plano || "basico";
    if (plano !== "completo") {
      alert("Seu plano não tem acesso a esta página.\nFaça upgrade para o plano Completo!");
      window.location.href = "index.html"; return;
    }
    usuarioAtual = resultado.user;
    await Promise.all([carregarCompanheiros(usuarioAtual), carregarTurmas(usuarioAtual), carregarMoitas(usuarioAtual)]);
    await buscarTrabalhos(usuarioAtual);
  } catch (erro) {
    console.error("Erro:", erro);
    window.location.href = "index.html";
  }
})();