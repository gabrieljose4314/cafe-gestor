import { db } from "./firebase.js";
import { exigirUsuarioAprovado } from "./acesso.js";

import {
  collection,
  getDocs
} from "https://www.gstatic.com/firebasejs/12.10.0/firebase-firestore.js";

const listaHistorico = document.getElementById("lista-historico");
const inputPesquisa = document.getElementById("pesquisa-historico");
const filtroAno = document.getElementById("filtro-ano");
const filtroMes = document.getElementById("filtro-mes");

let historicoCompleto = [];

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

function preencherAnos() {
  const anos = [...new Set(historicoCompleto.map(item => item.data?.split("-")[0]).filter(Boolean))];
  anos.sort((a, b) => b - a);

  filtroAno.innerHTML = '<option value="">Todos</option>';

  anos.forEach((ano) => {
    const option = document.createElement("option");
    option.value = ano;
    option.textContent = ano;
    filtroAno.appendChild(option);
  });
}

function ordenarHistorico(lista) {
  return lista.sort((a, b) => new Date(b.data) - new Date(a.data));
}

function criarCard(item) {
  const div = document.createElement("div");

  let detalheValor = "";
  if (item.tipo === "Colheita") {
    detalheValor = `<p><strong>Quantidade:</strong> ${item.quantidade} kg</p>`;
  } else {
    detalheValor = `<p><strong>Valor:</strong> ${formatarMoeda(item.valor)}</p>`;
  }

  div.innerHTML = `
    <p><strong>Tipo:</strong> ${item.tipo}</p>
    <p><strong>Data:</strong> ${formatarDataBR(item.data)}</p>
    <p><strong>Descrição:</strong> ${item.descricao || "-"}</p>
    <p><strong>Moita:</strong> ${item.moitaNome || "Sem moita específica"}</p>
    ${item.categoria ? `<p><strong>Categoria:</strong> ${item.categoria}</p>` : ""}
    ${item.status ? `<p><strong>Status:</strong> ${item.status}</p>` : ""}
    ${detalheValor}
  `;

  return div;
}

function renderizarHistorico() {
  listaHistorico.innerHTML = "";

  const termo = inputPesquisa.value.trim().toLowerCase();
  const anoSelecionado = filtroAno.value;
  const mesSelecionado = filtroMes.value;

  const filtrado = historicoCompleto.filter((item) => {
    const textoBase = `
      ${item.tipo || ""}
      ${item.descricao || ""}
      ${item.moitaNome || ""}
      ${item.categoria || ""}
      ${item.status || ""}
    `.toLowerCase();

    const anoItem = item.data?.split("-")[0] || "";
    const mesItem = item.data?.split("-")[1] || "";

    const batePesquisa = textoBase.includes(termo);
    const bateAno = !anoSelecionado || anoSelecionado === anoItem;
    const bateMes = !mesSelecionado || mesSelecionado === mesItem;

    return batePesquisa && bateAno && bateMes;
  });

  const ordenado = ordenarHistorico(filtrado);

  if (ordenado.length === 0) {
    listaHistorico.innerHTML = "<p>Nenhuma movimentação encontrada.</p>";
    return;
  }

  ordenado.forEach((item) => {
    const card = criarCard(item);
    listaHistorico.appendChild(card);
  });
}

async function carregarHistorico(user) {
  historicoCompleto = [];

  const despesasSnapshot = await getDocs(
    collection(db, "usuarios", user.uid, "despesas")
  );

  despesasSnapshot.forEach((doc) => {
    const despesa = doc.data();
    historicoCompleto.push({
      tipo: "Despesa",
      data: despesa.data,
      descricao: despesa.descricao || "Despesa registrada",
      valor: despesa.valor,
      moitaNome: despesa.moitaNome || null,
      categoria: despesa.categoria || null
    });
  });

  const vendasSnapshot = await getDocs(
    collection(db, "usuarios", user.uid, "vendas")
  );

  vendasSnapshot.forEach((doc) => {
    const venda = doc.data();
    historicoCompleto.push({
      tipo: "Venda",
      data: venda.data,
      descricao: "Venda registrada",
      valor: venda.valorTotal,
      moitaNome: venda.moitaNome || null
    });
  });

  const colheitasSnapshot = await getDocs(
    collection(db, "usuarios", user.uid, "colheitas")
  );

  colheitasSnapshot.forEach((doc) => {
    const colheita = doc.data();
    historicoCompleto.push({
      tipo: "Colheita",
      data: colheita.data,
      descricao: "Colheita registrada",
      quantidade: colheita.quantidade,
      moitaNome: colheita.moitaNome || null
    });
  });

  const trabalhosSnapshot = await getDocs(
    collection(db, "usuarios", user.uid, "trabalhosCompanheiros")
  );

  trabalhosSnapshot.forEach((doc) => {
    const trabalho = doc.data();
    historicoCompleto.push({
      tipo: "Trabalho",
      data: trabalho.data,
      descricao: `${trabalho.companheiroNome} - ${trabalho.servico}`,
      valor: trabalho.valor,
      moitaNome: trabalho.moitaNome || null,
      status: trabalho.statusPagamento
    });
  });

  preencherAnos();
  renderizarHistorico();
}

(async function iniciarHistorico() {
  const resultado = await exigirUsuarioAprovado();
  if (!resultado) return;

  await carregarHistorico(resultado.user);
})();

inputPesquisa.addEventListener("input", renderizarHistorico);
filtroAno.addEventListener("change", renderizarHistorico);
filtroMes.addEventListener("change", renderizarHistorico);