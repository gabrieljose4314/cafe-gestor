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

const formCompanheiro = document.getElementById("cadastro-companheiro-form");
const formTrabalho = document.getElementById("registro-trabalho-form");

const selectMoita = document.getElementById("moita-trabalho");

const listaCompanheiros = document.getElementById("lista-companheiros");
const listaPendentes = document.getElementById("lista-pendentes");
const listaPagos = document.getElementById("lista-pagos");

const totalPendenteEl = document.getElementById("total-pendente");
const totalPagoEl = document.getElementById("total-pago");

const inputPesquisa = document.getElementById("pesquisa-companheiro");

let usuarioAtual = null;
let todosOsTrabalhos = [];
let todosOsCompanheiros = [];

function formatarMoeda(valor) {
  return Number(valor || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL"
  });
}

function obterDataHoje() {
  const hoje = new Date();
  const ano = hoje.getFullYear();
  const mes = String(hoje.getMonth() + 1).padStart(2, "0");
  const dia = String(hoje.getDate()).padStart(2, "0");
  return `${ano}-${mes}-${dia}`;
}

function formatarDataBR(data) {
  if (!data) return "-";
  const partes = data.split("-");
  if (partes.length !== 3) return data;
  return `${partes[2]}/${partes[1]}/${partes[0]}`;
}

async function lancarDespesaDePagamento(trabalho, dataPagamento) {
  const despesaRef = await addDoc(
    collection(db, "usuarios", usuarioAtual.uid, "despesas"),
    {
      categoria: "Mão de Obra",
      descricao: `Pagamento para ${trabalho.companheiroNome} - ${trabalho.servico}`,
      valor: Number(trabalho.valor) || 0,
      data: dataPagamento,
      moitaId: trabalho.moitaId || null,
      moitaNome: trabalho.moitaNome || null,
      criadoEm: new Date()
    }
  );
  return despesaRef.id;
}

function criarCardTrabalho(trabalho, trabalhoId) {
  const valor = Number(trabalho.valor) || 0;
  const estaPago = trabalho.statusPagamento === "pago";

  const div = document.createElement("div");
  div.innerHTML = `
    <p><strong>Companheiro:</strong> ${trabalho.companheiroNome}</p>
    <p><strong>Telefone:</strong> ${trabalho.companheiroTelefone || "-"}</p>
    <p><strong>Moita:</strong> ${trabalho.moitaNome || "Sem moita específica"}</p>
    <p><strong>Data do trabalho:</strong> ${formatarDataBR(trabalho.data)}</p>
    <p><strong>Serviço:</strong> ${trabalho.servico}</p>
    <p><strong>Valor:</strong> ${formatarMoeda(valor)}</p>
    <p><strong>Status:</strong> ${estaPago ? "Pago" : "Pendente"}</p>
    <p><strong>Data do pagamento:</strong> ${formatarDataBR(trabalho.dataPagamento)}</p>
    <p><strong>Observação:</strong> ${trabalho.observacao || "-"}</p>
    ${
      !estaPago
        ? `<button data-id="${trabalhoId}" class="btn-marcar-pago">Marcar como pago</button>`
        : `<button data-id="${trabalhoId}" class="btn-voltar-pendente">Voltar para pendente</button>`
    }
    <button data-id="${trabalhoId}" class="btn-excluir-trabalho">Excluir</button>
  `;
  return div;
}

// ── Lista de companheiros dentro de <details> (oculta por padrão) ─────────────
function renderizarListaCompanheiros() {
  listaCompanheiros.innerHTML = "";

  if (todosOsCompanheiros.length === 0) {
    listaCompanheiros.innerHTML = "<p>Nenhum companheiro cadastrado.</p>";
    return;
  }

  const details = document.createElement("details");
  const summary = document.createElement("summary");
  summary.textContent = `Ver companheiros cadastrados (${todosOsCompanheiros.length})`;
  details.appendChild(summary);

  todosOsCompanheiros.forEach((companheiro) => {
    const div = document.createElement("div");
    div.innerHTML = `
      <p><strong>Nome:</strong> ${companheiro.nome}</p>
      <p><strong>Telefone:</strong> ${companheiro.telefone || "-"}</p>
      <p><strong>Observação:</strong> ${companheiro.observacao || "-"}</p>
      <button data-id="${companheiro.id}" class="btn-excluir-companheiro">Excluir companheiro</button>
    `;
    details.appendChild(div);
  });

  listaCompanheiros.appendChild(details);
  adicionarEventosBotoesExcluirCompanheiro();
}

// ── Carrega companheiros e monta checkboxes pra seleção múltipla ──────────────
async function carregarCompanheiros(user) {
  try {
    todosOsCompanheiros = [];

    const container = document.getElementById("companheiros-checkboxes");
    if (container) container.innerHTML = "";

    const snapshot = await getDocs(
      collection(db, "usuarios", user.uid, "companheiros")
    );

    snapshot.forEach((documento) => {
      const companheiro = { id: documento.id, ...documento.data() };
      todosOsCompanheiros.push(companheiro);

      if (container) {
        const label = document.createElement("label");
        label.style.cssText = "display:flex;align-items:center;gap:8px;margin-bottom:8px;cursor:pointer;font-size:1rem;color:#2f2f2f;";
        label.innerHTML = `
          <input type="checkbox" class="checkbox-companheiro" value="${companheiro.id}"
            data-nome="${companheiro.nome}"
            data-telefone="${companheiro.telefone || ""}">
          ${companheiro.nome}${companheiro.telefone ? ` — ${companheiro.telefone}` : ""}
        `;
        container.appendChild(label);
      }
    });

    renderizarListaCompanheiros();
  } catch (erro) {
    console.error("Erro ao carregar companheiros:", erro);
  }
}

async function carregarMoitas(user) {
  try {
    selectMoita.innerHTML = '<option value="">Sem moita específica</option>';

    const snapshot = await getDocs(
      collection(db, "usuarios", user.uid, "moitas")
    );

    snapshot.forEach((documento) => {
      const moita = documento.data();
      const option = document.createElement("option");
      option.value = documento.id;
      option.textContent = moita.nome;
      selectMoita.appendChild(option);
    });
  } catch (erro) {
    console.error("Erro ao carregar moitas:", erro);
  }
}

async function buscarTrabalhos(user) {
  try {
    const snapshot = await getDocs(
      collection(db, "usuarios", user.uid, "trabalhosCompanheiros")
    );
    todosOsTrabalhos = [];
    snapshot.forEach((documento) => {
      todosOsTrabalhos.push({ id: documento.id, ...documento.data() });
    });
    renderizarTrabalhos();
  } catch (erro) {
    console.error("Erro ao buscar trabalhos:", erro);
  }
}

function ordenarPendentes(lista) {
  return lista.sort((a, b) => new Date(b.data || "1900-01-01") - new Date(a.data || "1900-01-01"));
}

function ordenarPagos(lista) {
  return lista.sort((a, b) => new Date(b.dataPagamento || "1900-01-01") - new Date(a.dataPagamento || "1900-01-01"));
}

function renderizarTrabalhos() {
  listaPendentes.innerHTML = "";
  listaPagos.innerHTML = "";

  let totalPendente = 0;
  let totalPago = 0;

  const termoPesquisa = inputPesquisa.value.trim().toLowerCase();

  const trabalhosFiltrados = todosOsTrabalhos.filter((trabalho) => {
    const nome = (trabalho.companheiroNome || "").toLowerCase();
    return nome.includes(termoPesquisa);
  });

  const pendentes = ordenarPendentes(trabalhosFiltrados.filter(t => t.statusPagamento === "pendente"));
  const pagos = ordenarPagos(trabalhosFiltrados.filter(t => t.statusPagamento === "pago"));

  if (pendentes.length === 0) {
    listaPendentes.innerHTML = "<p>Nenhum pagamento pendente encontrado.</p>";
  } else {
    pendentes.forEach((trabalho) => {
      totalPendente += Number(trabalho.valor) || 0;
      listaPendentes.appendChild(criarCardTrabalho(trabalho, trabalho.id));
    });
  }

  if (pagos.length === 0) {
    listaPagos.innerHTML = "<p>Nenhum pagamento realizado encontrado.</p>";
  } else {
    const details = document.createElement("details");
    const summary = document.createElement("summary");

    pagos.forEach((trabalho) => {
      totalPago += Number(trabalho.valor) || 0;
      details.appendChild(criarCardTrabalho(trabalho, trabalho.id));
    });

    summary.textContent = `Ver pagamentos realizados (${pagos.length})`;
    details.insertBefore(summary, details.firstChild);
    listaPagos.appendChild(details);
  }

  totalPendenteEl.textContent = formatarMoeda(totalPendente);
  totalPagoEl.textContent = formatarMoeda(totalPago);

  adicionarEventosBotoesPagamento();
  adicionarEventosBotoesVoltarPendente();
  adicionarEventosBotoesExcluirTrabalho();
}

function adicionarEventosBotoesPagamento() {
  document.querySelectorAll(".btn-marcar-pago").forEach((botao) => {
    botao.addEventListener("click", async () => {
      const trabalhoId = botao.getAttribute("data-id");
      try {
        const trabalho = todosOsTrabalhos.find(item => item.id === trabalhoId);
        if (!trabalho) { alert("Trabalho não encontrado."); return; }
        if (trabalho.lancadoComoDespesa || trabalho.despesaId) {
          alert("Este pagamento já foi lançado nas despesas."); return;
        }
        const dataPagamento = obterDataHoje();
        const despesaId = await lancarDespesaDePagamento(trabalho, dataPagamento);
        await updateDoc(doc(db, "usuarios", usuarioAtual.uid, "trabalhosCompanheiros", trabalhoId), {
          statusPagamento: "pago", dataPagamento, lancadoComoDespesa: true, despesaId
        });
        alert("Pagamento marcado como pago e lançado nas despesas!");
        await buscarTrabalhos(usuarioAtual);
      } catch (erro) {
        console.error("Erro ao atualizar pagamento:", erro);
        alert("Erro ao atualizar pagamento");
      }
    });
  });
}

function adicionarEventosBotoesVoltarPendente() {
  document.querySelectorAll(".btn-voltar-pendente").forEach((botao) => {
    botao.addEventListener("click", async () => {
      const trabalhoId = botao.getAttribute("data-id");
      if (!confirm("Tem certeza que deseja voltar este pagamento para pendente?")) return;
      try {
        const trabalho = todosOsTrabalhos.find(item => item.id === trabalhoId);
        if (!trabalho) { alert("Trabalho não encontrado."); return; }
        if (trabalho.despesaId) {
          await deleteDoc(doc(db, "usuarios", usuarioAtual.uid, "despesas", trabalho.despesaId));
        }
        await updateDoc(doc(db, "usuarios", usuarioAtual.uid, "trabalhosCompanheiros", trabalhoId), {
          statusPagamento: "pendente", dataPagamento: null, lancadoComoDespesa: false, despesaId: null
        });
        alert("Pagamento voltou para pendente com sucesso!");
        await buscarTrabalhos(usuarioAtual);
      } catch (erro) {
        console.error("Erro ao voltar pagamento para pendente:", erro);
        alert("Erro ao voltar pagamento para pendente");
      }
    });
  });
}

function adicionarEventosBotoesExcluirTrabalho() {
  document.querySelectorAll(".btn-excluir-trabalho").forEach((botao) => {
    botao.addEventListener("click", async () => {
      const trabalhoId = botao.getAttribute("data-id");
      if (!confirm("Tem certeza que deseja excluir este registro?")) return;
      try {
        const trabalho = todosOsTrabalhos.find(item => item.id === trabalhoId);
        if (trabalho?.despesaId) {
          await deleteDoc(doc(db, "usuarios", usuarioAtual.uid, "despesas", trabalho.despesaId));
        }
        await deleteDoc(doc(db, "usuarios", usuarioAtual.uid, "trabalhosCompanheiros", trabalhoId));
        alert("Registro excluído com sucesso!");
        await buscarTrabalhos(usuarioAtual);
      } catch (erro) {
        console.error("Erro ao excluir registro:", erro);
        alert("Erro ao excluir registro");
      }
    });
  });
}

function adicionarEventosBotoesExcluirCompanheiro() {
  document.querySelectorAll(".btn-excluir-companheiro").forEach((botao) => {
    botao.addEventListener("click", async () => {
      const companheiroId = botao.getAttribute("data-id");
      const temTrabalho = todosOsTrabalhos.some(t => t.companheiroId === companheiroId);
      if (temTrabalho) {
        alert("Não é possível excluir este companheiro porque ele possui trabalhos cadastrados.");
        return;
      }
      if (!confirm("Tem certeza que deseja excluir este companheiro?")) return;
      try {
        await deleteDoc(doc(db, "usuarios", usuarioAtual.uid, "companheiros", companheiroId));
        alert("Companheiro excluído com sucesso!");
        await carregarCompanheiros(usuarioAtual);
      } catch (erro) {
        console.error("Erro ao excluir companheiro:", erro);
        alert("Erro ao excluir companheiro");
      }
    });
  });
}

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

    await carregarCompanheiros(usuarioAtual);
    await carregarMoitas(usuarioAtual);
    await buscarTrabalhos(usuarioAtual);

  } catch (erro) {
    console.error("Erro ao iniciar página de companheiros:", erro);
    window.location.href = "index.html";
  }
})();

// ── Cadastro de companheiro ───────────────────────────────────────────────────
formCompanheiro.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!usuarioAtual) return;

  const nome = document.getElementById("nome-companheiro").value;
  const telefone = document.getElementById("telefone-companheiro").value;
  const observacao = document.getElementById("observacao-companheiro").value;

  try {
    await addDoc(collection(db, "usuarios", usuarioAtual.uid, "companheiros"), {
      nome, telefone: telefone || null, observacao: observacao || null, criadoEm: new Date()
    });
    alert("Companheiro cadastrado com sucesso!");
    formCompanheiro.reset();
    await carregarCompanheiros(usuarioAtual);
  } catch (erro) {
    console.error("Erro ao cadastrar companheiro:", erro);
    alert("Erro ao cadastrar companheiro");
  }
});

// ── Registro de trabalho com múltiplos companheiros ───────────────────────────
formTrabalho.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!usuarioAtual) return;

  const checkboxesMarcados = document.querySelectorAll(".checkbox-companheiro:checked");

  if (checkboxesMarcados.length === 0) {
    alert("Selecione pelo menos um companheiro.");
    return;
  }

  const moitaId   = selectMoita.value;
  const moitaNome = moitaId ? selectMoita.options[selectMoita.selectedIndex].text : null;
  const data      = document.getElementById("data-trabalho").value;
  const servico   = document.getElementById("servico-trabalho").value;
  const valor     = document.getElementById("valor-trabalho").value;
  const statusPagamento = document.getElementById("status-pagamento").value;
  const observacao      = document.getElementById("observacao-trabalho").value;
  const dataPagamento   = statusPagamento === "pago" ? obterDataHoje() : null;

  try {
    for (const checkbox of checkboxesMarcados) {
      const companheiroId       = checkbox.value;
      const companheiroNome     = checkbox.getAttribute("data-nome");
      const companheiroTelefone = checkbox.getAttribute("data-telefone") || null;

      const trabalhoBase = {
        companheiroId, companheiroNome, companheiroTelefone,
        moitaId: moitaId || null, moitaNome: moitaNome || null,
        data, servico, valor: Number(valor),
        statusPagamento, dataPagamento,
        lancadoComoDespesa: false, despesaId: null,
        observacao: observacao || null, criadoEm: new Date()
      };

      const trabalhoRef = await addDoc(
        collection(db, "usuarios", usuarioAtual.uid, "trabalhosCompanheiros"),
        trabalhoBase
      );

      if (statusPagamento === "pago") {
        const despesaId = await lancarDespesaDePagamento(trabalhoBase, dataPagamento);
        await updateDoc(
          doc(db, "usuarios", usuarioAtual.uid, "trabalhosCompanheiros", trabalhoRef.id),
          { lancadoComoDespesa: true, despesaId }
        );
      }
    }

    alert(`Trabalho registrado para ${checkboxesMarcados.length} companheiro(s) com sucesso!`);
    formTrabalho.reset();
    document.querySelectorAll(".checkbox-companheiro").forEach(cb => cb.checked = false);
    await buscarTrabalhos(usuarioAtual);

  } catch (erro) {
    console.error("Erro ao registrar trabalho:", erro);
    alert("Erro ao registrar trabalho");
  }
});

inputPesquisa.addEventListener("input", () => {
  renderizarTrabalhos();
});

// ── Modal de seleção de companheiros ──────────────────────────────────────────
const modal = document.getElementById("modal-companheiros");
const btnAbrirModal = document.getElementById("btn-abrir-modal-companheiros");
const btnConfirmar = document.getElementById("btn-confirmar-companheiros");
const resumoSelecionados = document.getElementById("resumo-selecionados");

btnAbrirModal.addEventListener("click", () => {
  modal.style.display = "flex";
});

btnConfirmar.addEventListener("click", () => {
  modal.style.display = "none";
  atualizarResumoSelecionados();
});

// Fecha ao clicar fora do card
modal.addEventListener("click", (e) => {
  if (e.target === modal) {
    modal.style.display = "none";
    atualizarResumoSelecionados();
  }
});

function atualizarResumoSelecionados() {
  const marcados = [...document.querySelectorAll(".checkbox-companheiro:checked")];
  if (marcados.length === 0) {
    resumoSelecionados.textContent = "Nenhum companheiro selecionado.";
  } else {
    const nomes = marcados.map(cb => cb.getAttribute("data-nome")).join(", ");
    resumoSelecionados.textContent = `✅ ${marcados.length} selecionado(s): ${nomes}`;
  }
}