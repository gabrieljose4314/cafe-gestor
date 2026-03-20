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
const filtroTipo = document.getElementById("filtro-tipo");

let historicoCompleto = [];

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
    "01": "Janeiro",
    "02": "Fevereiro",
    "03": "Março",
    "04": "Abril",
    "05": "Maio",
    "06": "Junho",
    "07": "Julho",
    "08": "Agosto",
    "09": "Setembro",
    "10": "Outubro",
    "11": "Novembro",
    "12": "Dezembro"
  };

  return meses[numeroMes] || numeroMes;
}

function preencherAnos() {
  const anos = [...new Set(
    historicoCompleto
      .map(item => item.data?.split("-")[0])
      .filter(Boolean)
  )];

  anos.sort((a, b) => b - a);

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

  let detalhePrincipal = "";

  if (item.tipo === "Colheita") {
    detalhePrincipal = `<p><strong>Quantidade:</strong> ${formatarNumero(item.quantidade)} kg</p>`;
  } else {
    detalhePrincipal = `<p><strong>Valor:</strong> ${formatarMoeda(item.valor)}</p>`;
  }

  div.innerHTML = `
    <p><strong>Tipo:</strong> ${item.tipo}</p>
    <p><strong>Data:</strong> ${formatarDataBR(item.data)}</p>
    <p><strong>Descrição:</strong> ${item.descricao || "-"}</p>
    <p><strong>Moita:</strong> ${item.moitaNome || "Sem moita específica"}</p>
    ${item.categoria ? `<p><strong>Categoria:</strong> ${item.categoria}</p>` : ""}
    ${item.status ? `<p><strong>Status:</strong> ${item.status}</p>` : ""}
    ${detalhePrincipal}
  `;

  return div;
}

function agruparHistorico(lista) {
  const grupos = {};

  lista.forEach((item) => {
    if (!item.data) return;

    const [ano, mes] = item.data.split("-");

    if (!grupos[ano]) {
      grupos[ano] = {};
    }

    if (!grupos[ano][mes]) {
      grupos[ano][mes] = [];
    }

    grupos[ano][mes].push(item);
  });

  return grupos;
}

function renderizarHistorico() {
  listaHistorico.innerHTML = "";

  const termo = inputPesquisa.value.trim().toLowerCase();
  const anoSelecionado = filtroAno.value;
  const mesSelecionado = filtroMes.value;
  const tipoSelecionado = filtroTipo.value;

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
    const bateTipo = !tipoSelecionado || tipoSelecionado === item.tipo;

    return batePesquisa && bateAno && bateMes && bateTipo;
  });

  if (filtrado.length === 0) {
    listaHistorico.innerHTML = "<p>Nenhuma movimentação encontrada.</p>";
    return;
  }

  const ordenado = filtrado.sort((a, b) => new Date(b.data) - new Date(a.data));
  const grupos = agruparHistorico(ordenado);

  const anosOrdenados = Object.keys(grupos).sort((a, b) => b - a);

  anosOrdenados.forEach((ano) => {
    const blocoAno = document.createElement("div");
    blocoAno.classList.add("bloco-ano");

    const tituloAno = document.createElement("h3");
    tituloAno.textContent = ano;
    blocoAno.appendChild(tituloAno);

    const mesesOrdenados = Object.keys(grupos[ano]).sort((a, b) => b.localeCompare(a));

    mesesOrdenados.forEach((mes) => {
      const blocoMes = document.createElement("div");
      blocoMes.classList.add("bloco-mes");

      const tituloMes = document.createElement("h4");
      tituloMes.textContent = nomeMes(mes);
      blocoMes.appendChild(tituloMes);

      grupos[ano][mes].forEach((item) => {
        const card = criarCard(item);
        blocoMes.appendChild(card);
      });

      blocoAno.appendChild(blocoMes);
    });

    listaHistorico.appendChild(blocoAno);
  });
}

async function carregarHistorico(user) {
  historicoCompleto = [];

  const despesasSnapshot = await getDocs(
    collection(db, "usuarios", user.uid, "despesas")
  );

  despesasSnapshot.forEach((documento) => {
    const despesa = documento.data();

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

  vendasSnapshot.forEach((documento) => {
    const venda = documento.data();

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

  colheitasSnapshot.forEach((documento) => {
    const colheita = documento.data();

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

  trabalhosSnapshot.forEach((documento) => {
    const trabalho = documento.data();

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
filtroTipo.addEventListener("change", renderizarHistorico);