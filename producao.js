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

function criarCardMoita(dados) {
  const div = document.createElement("div");

  div.innerHTML = `
    <p><strong>Moita:</strong> ${dados.nome}</p>
    <p><strong>Área:</strong> ${formatarNumero(dados.area)} ha</p>
    <p><strong>Quantidade de pés:</strong> ${formatarNumero(dados.pes, 0)}</p>
    <p><strong>Total colhido:</strong> ${formatarNumero(dados.totalColhido)} kg</p>
    <p><strong>Produção por hectare:</strong> ${formatarNumero(dados.producaoPorHectare)} kg/ha</p>
    <p><strong>Produção por pé:</strong> ${formatarNumero(dados.producaoPorPe, 3)} kg/pé</p>
    <p><strong>Produção por 1000 pés:</strong> ${formatarNumero(dados.producaoPorMilPes)} kg</p>
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

    const moitas = [];
    const colheitas = [];

    moitasSnapshot.forEach((doc) => {
      moitas.push({
        id: doc.id,
        ...doc.data()
      });
    });

    colheitasSnapshot.forEach((doc) => {
      colheitas.push(doc.data());
    });

    if (moitas.length === 0) {
      listaProducao.innerHTML = "<p>Nenhuma moita cadastrada.</p>";
      return;
    }

    const relatorio = moitas.map((moita) => {
      const totalColhido = colheitas
        .filter((colheita) => colheita.moitaId === moita.id)
        .reduce((soma, colheita) => soma + (Number(colheita.quantidade) || 0), 0);

      const area = Number(moita.area) || 0;
      const pes = Number(moita.pes) || 0;

      const producaoPorHectare = area > 0 ? totalColhido / area : 0;
      const producaoPorPe = pes > 0 ? totalColhido / pes : 0;
      const producaoPorMilPes = pes > 0 ? (totalColhido / pes) * 1000 : 0;

      return {
        nome: moita.nome || "Sem nome",
        area,
        pes,
        totalColhido,
        producaoPorHectare,
        producaoPorPe,
        producaoPorMilPes
      };
    });

    relatorio.sort((a, b) => b.producaoPorHectare - a.producaoPorHectare);

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