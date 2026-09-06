import { db } from "./firebase.js";
import { exigirUsuarioAprovado, ativarTopbarDesktop } from "./acesso.js";
import {
  collection, addDoc, getDocs, doc, updateDoc
} from "https://www.gstatic.com/firebasejs/12.10.0/firebase-firestore.js";
import { fmt, hoje, lancarDespesa, verificarPlanoCompleto } from "./companheiros-shared.js";

let usuarioAtual  = null;
let todasAsTurmas = [];

// Guarda as quantidades já digitadas na etapa de produção, pra não perder o
// que a pessoa já preencheu se ela mudar a seleção de companheiros depois.
const quantidadesProducaoDigitadas = new Map();

// ── Tipo de pagamento ─────────────────────────────────────────────────────────
window.alternarTipo = function () {
  const tipo = document.getElementById("tipo-pagamento").value;
  document.getElementById("campos-diaria").style.display   = tipo === "diaria"   ? "flex" : "none";
  document.getElementById("campos-producao").style.display = tipo === "producao" ? "flex" : "none";
  if (tipo === "producao") atualizarCamposProducao();
  verificarFormulario();
};

// ── Verificar formulário ──────────────────────────────────────────────────────
window.verificarFormulario = function () {
  const data         = document.getElementById("data-trabalho").value;
  const servico      = document.getElementById("servico-trabalho").value.trim();
  const selecionados = [...document.querySelectorAll(".cb-avulso:checked")];
  const completo = data && servico && selecionados.length > 0;
  const btn = document.getElementById("btn-registrar");
  btn.classList.toggle("habilitado", completo);
  btn.classList.toggle("desabilitado", !completo);
};

// ── Seleção de companheiros / turma (inline, sem modal) ───────────────────────
window.filtrarPorTurma = function () {
  const turmaId = document.getElementById("select-turma").value;
  document.querySelectorAll(".cb-avulso").forEach(cb => cb.checked = false);
  if (turmaId) {
    const turma = todasAsTurmas.find(t => t.id === turmaId);
    if (turma) turma.membros.forEach(m => {
      const cb = document.querySelector(`.cb-avulso[value="${m.id}"]`);
      if (cb) cb.checked = true;
    });
  }
  aoMudarSelecao();
};
window.filtrarPorNome = function () {
  const termo = document.getElementById("pesquisa-selecao").value.trim().toLowerCase();
  document.querySelectorAll("#companheiros-checkboxes .checkbox-item").forEach(label => {
    const nome = label.querySelector("input").getAttribute("data-nome").toLowerCase();
    label.style.display = nome.includes(termo) ? "block" : "none";
  });
};
function atualizarResumoSelecionados() {
  const marcados = [...document.querySelectorAll(".cb-avulso:checked")];
  document.getElementById("resumo-selecionados").textContent = marcados.length === 0
    ? "Nenhum selecionado."
    : `✅ ${marcados.length} selecionado(s): ${marcados.map(cb => cb.getAttribute("data-nome")).join(", ")}`;
}
function aoMudarSelecao() {
  atualizarResumoSelecionados();
  verificarFormulario();
  if (document.getElementById("tipo-pagamento").value === "producao") atualizarCamposProducao();
}

// ── Campos de produção (inline, reage à seleção) ──────────────────────────────
function atualizarCamposProducao() {
  const selecionados = [...document.querySelectorAll(".cb-avulso:checked")];
  const lista = document.getElementById("lista-producao-companheiros");
  // Guarda o que já tava digitado antes de redesenhar.
  lista.querySelectorAll(".input-qtd-producao").forEach(input => {
    quantidadesProducaoDigitadas.set(input.getAttribute("data-id"), input.value);
  });
  lista.innerHTML = "";
  selecionados.forEach(cb => {
    const id = cb.value;
    const div = document.createElement("div");
    div.className = "producao-item";
    div.innerHTML = `
      <div class="producao-item-linha">
        <strong class="producao-item-nome">${cb.getAttribute("data-nome")}</strong>
        <input type="number" step="0.01" placeholder="Qtd" data-id="${id}" data-nome="${cb.getAttribute("data-nome")}"
          value="${quantidadesProducaoDigitadas.get(id) || ""}"
          class="input-qtd-producao" oninput="calcularProducaoTotal()">
        <span class="valor-individual" data-id="${id}">R$ 0,00</span>
      </div>`;
    lista.appendChild(div);
  });
  calcularProducaoTotal();
}

window.calcularProducaoTotal = function () {
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

// ── Carregamento Firebase ─────────────────────────────────────────────────────
async function carregarCompanheiros() {
  const snap = await getDocs(collection(db, "usuarios", usuarioAtual.uid, "companheiros"));
  const companheiros = [];
  snap.forEach(d => companheiros.push({ id: d.id, ...d.data() }));
  companheiros.sort((a, b) => (a.nome || "").localeCompare(b.nome || ""));
  const c = document.getElementById("companheiros-checkboxes");
  c.innerHTML = companheiros.length === 0 ? "<p class='sem-itens'>Nenhum companheiro cadastrado.</p>" : "";
  companheiros.forEach(comp => {
    const label = document.createElement("label");
    label.className = "checkbox-item";
    label.innerHTML = `<input type="checkbox" class="cb-avulso" value="${comp.id}" data-nome="${comp.nome}" data-pix="${comp.pix || ""}"> ${comp.nome}`;
    c.appendChild(label);
    label.querySelector("input").addEventListener("change", aoMudarSelecao);
  });
}
async function carregarTurmas() {
  todasAsTurmas = [];
  const snap = await getDocs(collection(db, "usuarios", usuarioAtual.uid, "turmas"));
  snap.forEach(d => todasAsTurmas.push({ id: d.id, ...d.data() }));
  const sel = document.getElementById("select-turma");
  sel.innerHTML = '<option value="">Nenhuma (mostrar todos)</option>';
  todasAsTurmas.forEach(t => {
    const opt = document.createElement("option");
    opt.value = t.id; opt.textContent = t.nome;
    sel.appendChild(opt);
  });
}
async function carregarMoitas() {
  const sel = document.getElementById("moita-trabalho");
  sel.innerHTML = '<option value="">Sem moita específica</option>';
  const snap = await getDocs(collection(db, "usuarios", usuarioAtual.uid, "moitas"));
  snap.forEach(d => {
    const opt = document.createElement("option");
    opt.value = d.id; opt.textContent = d.data().nome;
    sel.appendChild(opt);
  });
}

// ── Registro (diária ou produção, um único botão) ─────────────────────────────
async function registrarDiaria(selecionados) {
  const data      = document.getElementById("data-trabalho").value;
  const servico   = document.getElementById("servico-trabalho").value.trim();
  const moitaId   = document.getElementById("moita-trabalho").value;
  const moitaNome = moitaId ? document.getElementById("moita-trabalho").options[document.getElementById("moita-trabalho").selectedIndex].text : null;
  const status    = document.getElementById("status-pagamento").value;
  const dataPagamento = status === "pago" ? hoje() : null;
  const valor     = parseFloat(document.getElementById("valor-trabalho").value);
  if (!valor) { alert("Digite o valor."); return false; }
  for (const cb of selecionados) {
    const trabalhoBase = {
      companheiroId: cb.value, companheiroNome: cb.getAttribute("data-nome"),
      companheiroTelefone: cb.getAttribute("data-pix") || null,
      moitaId: moitaId || null, moitaNome: moitaNome || null,
      data, servico, valor, tipoPagamento: "diaria",
      statusPagamento: status, dataPagamento,
      lancadoComoDespesa: false, despesaId: null, criadoEm: new Date()
    };
    const ref = await addDoc(collection(db, "usuarios", usuarioAtual.uid, "trabalhosCompanheiros"), trabalhoBase);
    if (status === "pago") {
      const despesaId = await lancarDespesa(db, usuarioAtual.uid, trabalhoBase, dataPagamento);
      await updateDoc(doc(db, "usuarios", usuarioAtual.uid, "trabalhosCompanheiros", ref.id), { lancadoComoDespesa: true, despesaId });
    }
  }
  alert(`Trabalho registrado para ${selecionados.length} companheiro(s)!`);
  return true;
}

async function registrarProducao() {
  const valorUnit = parseFloat(document.getElementById("valor-producao").value);
  if (!valorUnit) { alert("Digite o valor da produção."); return false; }
  const inputs = [...document.querySelectorAll(".input-qtd-producao")];
  if (!inputs.length || inputs.some(i => !parseFloat(i.value))) {
    alert("Preencha a quantidade de todos os companheiros."); return false;
  }
  const data      = document.getElementById("data-trabalho").value;
  const servico   = document.getElementById("servico-trabalho").value.trim();
  const status    = document.getElementById("status-producao").value;
  const moitaId   = document.getElementById("moita-trabalho").value;
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
      const despesaId = await lancarDespesa(db, usuarioAtual.uid, trabalhoBase, dataPagamento);
      await updateDoc(doc(db, "usuarios", usuarioAtual.uid, "trabalhosCompanheiros", ref.id), { lancadoComoDespesa: true, despesaId });
    }
  }
  alert(`Produção registrada para ${inputs.length} companheiro(s)!`);
  return true;
}

document.getElementById("registro-trabalho-form").addEventListener("submit", async e => {
  e.preventDefault();
  const selecionados = [...document.querySelectorAll(".cb-avulso:checked")];
  if (!selecionados.length) { alert("Selecione pelo menos um companheiro."); return; }
  const tipo = document.getElementById("tipo-pagamento").value;
  const ok = tipo === "diaria" ? await registrarDiaria(selecionados) : await registrarProducao();
  if (!ok) return;

  e.target.reset();
  quantidadesProducaoDigitadas.clear();
  document.querySelectorAll(".cb-avulso").forEach(cb => cb.checked = false);
  document.getElementById("lista-producao-companheiros").innerHTML = "";
  document.getElementById("total-producao-box").style.display = "none";
  document.getElementById("select-turma").value = "";
  atualizarResumoSelecionados();
  document.getElementById("campos-diaria").style.display   = "flex";
  document.getElementById("campos-producao").style.display = "none";
  verificarFormulario();
});

// ── Início ────────────────────────────────────────────────────────────────────
(async function iniciar() {
  try {
    const resultado = await exigirUsuarioAprovado();
    if (!resultado) return;
    ativarTopbarDesktop(resultado.dados?.dados?.nome);
    if (!verificarPlanoCompleto(resultado)) return;
    usuarioAtual = resultado.user;
    await Promise.all([carregarCompanheiros(), carregarTurmas(), carregarMoitas()]);
  } catch (erro) {
    console.error("Erro:", erro);
    window.location.href = "index.html";
  }
})();
