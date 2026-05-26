import { db } from "./firebase.js";
import { exigirUsuarioAprovado } from "./acesso.js";

import {
  collection,
  getDocs
} from "https://www.gstatic.com/firebasejs/12.10.0/firebase-firestore.js";

const listaHistorico = document.getElementById("lista-historico");
const inputPesquisa  = document.getElementById("pesquisa-historico");
const filtroAno      = document.getElementById("filtro-ano");
const filtroMes      = document.getElementById("filtro-mes");
const filtroTipo     = document.getElementById("filtro-tipo");

let historicoCompleto = [];

// ── Formatação ────────────────────────────────────────────────────────────────
function formatarMoeda(valor) {
  return Number(valor || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL"
  });
}

function formatarNumero(valor, casas = 2) {
  return Number(valor || 0).toLocaleString("pt-BR", {
    minimumFractionDigits: casas,
    maximumFractionDigits: casas
  });
}

function formatarDataBR(data) {
  if (!data) return "-";
  const partes = data.split("-");
  if (partes.length !== 3) return data;
  return `${partes[2]}/${partes[1]}/${partes[0]}`;
}

function nomeMes(numeroMes) {
  const meses = {
    "01": "Janeiro",  "02": "Fevereiro", "03": "Março",
    "04": "Abril",    "05": "Maio",      "06": "Junho",
    "07": "Julho",    "08": "Agosto",    "09": "Setembro",
    "10": "Outubro",  "11": "Novembro",  "12": "Dezembro"
  };
  return meses[numeroMes] || numeroMes;
}

// ── Renderização ──────────────────────────────────────────────────────────────
function preencherAnos() {
  const anos = [...new Set(
    historicoCompleto
      .map(item => item.data?.split("-")[0])
      .filter(Boolean)
  )].sort((a, b) => b - a);

  filtroAno.innerHTML = '<option value="">Todos</option>';
  anos.forEach((ano) => {
    const option = document.createElement("option");
    option.value = ano;
    option.textContent = ano;
    filtroAno.appendChild(option);
  });
}

function criarCard(item) {
  const div = document.createElement("div");
  div.classList.add("card-historico");

  const detalhePrincipal = item.tipo === "Colheita"
    ? `<p><strong>Quantidade:</strong> ${formatarNumero(item.quantidade)} kg</p>`
    : `<p><strong>Valor:</strong> ${formatarMoeda(item.valor)}</p>`;

  div.innerHTML = `
    <p><strong>Tipo:</strong> ${item.tipo}</p>
    <p><strong>Data:</strong> ${formatarDataBR(item.data)}</p>
    <p><strong>Descrição:</strong> ${item.descricao || "-"}</p>
    <p><strong>Moita:</strong> ${item.moitaNome || "Sem moita específica"}</p>
    ${item.categoria ? `<p><strong>Categoria:</strong> ${item.categoria}</p>` : ""}
    ${item.status    ? `<p><strong>Status:</strong> ${item.status}</p>`       : ""}
    ${detalhePrincipal}
  `;

  return div;
}

function agruparHistorico(lista) {
  const grupos = {};
  lista.forEach((item) => {
    if (!item.data) return;
    const [ano, mes] = item.data.split("-");
    if (!grupos[ano])      grupos[ano]      = {};
    if (!grupos[ano][mes]) grupos[ano][mes] = [];
    grupos[ano][mes].push(item);
  });
  return grupos;
}

function renderizarHistorico() {
  listaHistorico.innerHTML = "";

  const termo          = inputPesquisa.value.trim().toLowerCase();
  const anoSelecionado = filtroAno.value;
  const mesSelecionado = filtroMes.value;
  const tipoSelecionado = filtroTipo.value;

  const filtrado = historicoCompleto.filter((item) => {
    const textoBase = `
      ${item.tipo || ""} ${item.descricao || ""}
      ${item.moitaNome || ""} ${item.categoria || ""} ${item.status || ""}
    `.toLowerCase();

    const anoItem = item.data?.split("-")[0] || "";
    const mesItem = item.data?.split("-")[1] || "";

    return (
      textoBase.includes(termo) &&
      (!anoSelecionado  || anoSelecionado  === anoItem) &&
      (!mesSelecionado  || mesSelecionado  === mesItem) &&
      (!tipoSelecionado || tipoSelecionado === item.tipo)
    );
  });

  if (filtrado.length === 0) {
    listaHistorico.innerHTML = "<p>Nenhuma movimentação encontrada.</p>";
    return;
  }

  const ordenado = filtrado.sort((a, b) => new Date(b.data) - new Date(a.data));
  const grupos   = agruparHistorico(ordenado);
  const anosOrdenados = Object.keys(grupos).sort((a, b) => b - a);

  anosOrdenados.forEach((ano) => {
    const blocoAno   = document.createElement("div");
    blocoAno.classList.add("bloco-ano");

    const tituloAno  = document.createElement("h3");
    tituloAno.textContent = ano;
    blocoAno.appendChild(tituloAno);

    const mesesOrdenados = Object.keys(grupos[ano]).sort((a, b) => b.localeCompare(a));

    mesesOrdenados.forEach((mes) => {
      const blocoMes  = document.createElement("div");
      blocoMes.classList.add("bloco-mes");

      const tituloMes = document.createElement("h4");
      tituloMes.textContent = nomeMes(mes);
      blocoMes.appendChild(tituloMes);

      grupos[ano][mes].forEach((item) => blocoMes.appendChild(criarCard(item)));
      blocoAno.appendChild(blocoMes);
    });

    listaHistorico.appendChild(blocoAno);
  });
}

// ── Carregamento de dados ─────────────────────────────────────────────────────
async function carregarHistorico(user) {
  historicoCompleto = [];

  const [despesasSnap, vendasSnap, colheitasSnap, trabalhosSnap] = await Promise.all([
    getDocs(collection(db, "usuarios", user.uid, "despesas")),
    getDocs(collection(db, "usuarios", user.uid, "vendas")),
    getDocs(collection(db, "usuarios", user.uid, "colheitas")),
    getDocs(collection(db, "usuarios", user.uid, "trabalhosCompanheiros"))
  ]);

  despesasSnap.forEach((doc) => {
    const d = doc.data();
    historicoCompleto.push({
      tipo: "Despesa", data: d.data,
      descricao: d.descricao || "Despesa registrada",
      valor: d.valor, moitaNome: d.moitaNome || null, categoria: d.categoria || null
    });
  });

  vendasSnap.forEach((doc) => {
    const d = doc.data();
    historicoCompleto.push({
      tipo: "Venda", data: d.data,
      descricao: "Venda registrada",
      valor: d.valorTotal, moitaNome: d.moitaNome || null
    });
  });

  colheitasSnap.forEach((doc) => {
    const d = doc.data();
    historicoCompleto.push({
      tipo: "Colheita", data: d.data,
      descricao: "Colheita registrada",
      quantidade: d.quantidade, moitaNome: d.moitaNome || null
    });
  });

  trabalhosSnap.forEach((doc) => {
    const d = doc.data();
    historicoCompleto.push({
      tipo: "Trabalho", data: d.data,
      descricao: `${d.companheiroNome} - ${d.servico}`,
      valor: d.valor, moitaNome: d.moitaNome || null, status: d.statusPagamento
    });
  });

  preencherAnos();
  renderizarHistorico();
}

// ── Início ────────────────────────────────────────────────────────────────────
(async function iniciarHistorico() {
  try {
    const resultado = await exigirUsuarioAprovado();
    if (!resultado) return;

    // Bloqueia acesso direto via URL se for plano básico
    const plano = resultado.dados?.acesso?.plano || "basico";
    if (plano !== "completo") {
      alert("Seu plano não tem acesso a esta página.\nFaça upgrade para o plano Completo!");
      window.location.href = "index.html";
      return;
    }

    await carregarHistorico(resultado.user);

  } catch (erro) {
    console.error("Erro ao carregar histórico:", erro);
    window.location.href = "index.html";
  }
})();

// ── Filtros ───────────────────────────────────────────────────────────────────
inputPesquisa.addEventListener("input",  renderizarHistorico);
filtroAno.addEventListener("change",     renderizarHistorico);
filtroMes.addEventListener("change",     renderizarHistorico);
filtroTipo.addEventListener("change",    renderizarHistorico);