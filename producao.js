import { db } from "./firebase.js";
import { exigirUsuarioAprovado } from "./acesso.js";

import {
  collection,
  getDocs
} from "https://www.gstatic.com/firebasejs/12.10.0/firebase-firestore.js";

const listaProducao = document.getElementById("lista-producao");

function formatarNumero(valor, casas = 2) {
  return Number(valor || 0).toLocaleString("pt-BR", {
    minimumFractionDigits: casas,
    maximumFractionDigits: casas
  });
}

function formatarMoeda(valor) {
  return Number(valor || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL"
  });
}

function textoNormalizado(texto) {
  return String(texto || "")
    .trim()
    .toLowerCase();
}

function pertenceAMoita(registro, moita) {
  const nomeMoita = textoNormalizado(moita.nome);

  return (
    registro.moitaId === moita.id ||
    textoNormalizado(registro.moitaNome) === nomeMoita ||
    textoNormalizado(registro.moita) === nomeMoita
  );
}

function criarCardMoita(dados) {
  const div = document.createElement("div");

  div.innerHTML = `
    <p><strong>Moita:</strong> ${dados.nome}</p>
    <p><strong>Área:</strong> ${formatarNumero(dados.area)} ha</p>
    <p><strong>Quantidade de pés:</strong> ${formatarNumero(dados.pes, 0)}</p>

    <hr>

    <h4>Produção</h4>
    <p><strong>Total colhido:</strong> ${formatarNumero(dados.totalColhido)} kg</p>
    <p><strong>Total colhido em sacas:</strong> ${formatarNumero(dados.totalSacas)} sacas</p>
    <p><strong>Produção por hectare:</strong> ${formatarNumero(dados.producaoPorHectare)} kg/ha</p>
    <p><strong>Produção por pé:</strong> ${formatarNumero(dados.producaoPorPe, 3)} kg/pé</p>
    <p><strong>Produção por 1000 pés:</strong> ${formatarNumero(dados.producaoPorMilPes)} kg</p>

    <hr>

    <h4>Financeiro</h4>
    <p><strong>Total gasto:</strong> ${formatarMoeda(dados.totalGasto)}</p>
    <p><strong>Total ganho:</strong> ${formatarMoeda(dados.totalGanho)}</p>
    <p><strong>Lucro:</strong> ${formatarMoeda(dados.lucro)}</p>
    <p><strong>Custo por saca:</strong> ${formatarMoeda(dados.custoPorSaca)}</p>
  `;

  return div;
}

async function carregarRelatorioProducao(user) {
  try {
    listaProducao.innerHTML = "";

    const moitasSnapshot = await getDocs(
      collection(db, "usuarios", user.uid, "moitas")
    );

    const colheitasSnapshot = await getDocs(
      collection(db, "usuarios", user.uid, "colheitas")
    );

    const despesasSnapshot = await getDocs(
      collection(db, "usuarios", user.uid, "despesas")
    );

    const vendasSnapshot = await getDocs(
      collection(db, "usuarios", user.uid, "vendas")
    );

    const moitas = [];
    const colheitas = [];
    const despesas = [];
    const vendas = [];

    moitasSnapshot.forEach((documento) => {
      moitas.push({
        id: documento.id,
        ...documento.data()
      });
    });

    colheitasSnapshot.forEach((documento) => {
      colheitas.push(documento.data());
    });

    despesasSnapshot.forEach((documento) => {
      despesas.push(documento.data());
    });

    vendasSnapshot.forEach((documento) => {
      vendas.push(documento.data());
    });

    if (moitas.length === 0) {
      listaProducao.innerHTML = "<p>Nenhuma moita cadastrada.</p>";
      return;
    }

    const relatorio = moitas.map((moita) => {
      const colheitasDaMoita = colheitas.filter((colheita) => pertenceAMoita(colheita, moita));
      const despesasDaMoita = despesas.filter((despesa) => pertenceAMoita(despesa, moita));
      const vendasDaMoita = vendas.filter((venda) => pertenceAMoita(venda, moita));

      const totalColhido = colheitasDaMoita.reduce(
        (soma, colheita) => soma + (Number(colheita.quantidade) || 0),
        0
      );

      const totalGasto = despesasDaMoita.reduce(
        (soma, despesa) => soma + (Number(despesa.valor) || 0),
        0
      );

      const totalGanho = vendasDaMoita.reduce(
        (soma, venda) => soma + (Number(venda.valorTotal) || 0),
        0
      );

      const area = Number(moita.area) || 0;
      const pes = Number(moita.pes) || 0;

      const totalSacas = totalColhido > 0 ? totalColhido / 60 : 0;

      const producaoPorHectare = area > 0 ? totalColhido / area : 0;
      const producaoPorPe = pes > 0 ? totalColhido / pes : 0;
      const producaoPorMilPes = pes > 0 ? (totalColhido / pes) * 1000 : 0;

      const lucro = totalGanho - totalGasto;
      const custoPorSaca = totalSacas > 0 && totalGasto > 0
        ? totalGasto / totalSacas
        : 0;

      return {
        nome: moita.nome || "Sem nome",
        area,
        pes,
        totalColhido,
        totalSacas,
        producaoPorHectare,
        producaoPorPe,
        producaoPorMilPes,
        totalGasto,
        totalGanho,
        lucro,
        custoPorSaca
      };
    });

    relatorio.sort((a, b) => b.lucro - a.lucro);

    relatorio.forEach((item) => {
      const card = criarCardMoita(item);
      listaProducao.appendChild(card);
    });

  } catch (erro) {
    console.error("Erro ao carregar relatório de produção:", erro);
    listaProducao.innerHTML = "<p>Erro ao carregar relatório.</p>";
  }
}

(async function iniciarProducao() {
  const resultado = await exigirUsuarioAprovado();
  if (!resultado) return;

  await carregarRelatorioProducao(resultado.user);
})();