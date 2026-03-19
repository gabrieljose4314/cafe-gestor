import { auth, db } from "./firebase.js";
import { exigirUsuarioAprovado } from "./acesso.js";

import {
  signOut
} from "https://www.gstatic.com/firebasejs/12.10.0/firebase-auth.js";

import {
  collection,
  getDocs
} from "https://www.gstatic.com/firebasejs/12.10.0/firebase-firestore.js";

const botaoLogout = document.getElementById("logout");
const botaoDetalhes = document.getElementById("toggle-detalhes-despesas");
const detalhesDespesas = document.getElementById("detalhes-despesas");

function formatarMoeda(valor) {
  return valor.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL"
  });
}

function formatarKg(valor) {
  return `${valor.toLocaleString("pt-BR")} kg`;
}

async function carregarDadosUsuario(dados) {
  document.getElementById("nomeUsuario").textContent =
    "Bem-vindo, " + dados.dados.nome;
}

async function carregarResumoFinanceiro(user) {
  let ganhoBruto = 0;
  let gastoBruto = 0;
  let totalColheita = 0;
  let pendenteCompanheiros = 0;
  let totalMoitas = 0;

  let gastoFertilizante = 0;
  let gastoDefensivo = 0;
  let gastoHerbicidas = 0;
  let gastoMaoDeObra = 0;
  let gastoOutros = 0;

  const vendasSnapshot = await getDocs(
    collection(db, "usuarios", user.uid, "vendas")
  );

  vendasSnapshot.forEach((docItem) => {
    const venda = docItem.data();
    ganhoBruto += Number(venda.valorTotal) || 0;
  });

  const despesasSnapshot = await getDocs(
    collection(db, "usuarios", user.uid, "despesas")
  );

  despesasSnapshot.forEach((docItem) => {
    const despesa = docItem.data();
    const valor = Number(despesa.valor) || 0;
    const categoria = despesa.categoria || "";

    gastoBruto += valor;

    if (categoria === "Fertilizante") {
      gastoFertilizante += valor;
    } else if (categoria === "Defensivo") {
      gastoDefensivo += valor;
    } else if (categoria === "Herbicidas") {
      gastoHerbicidas += valor;
    } else if (categoria === "Mão de Obra") {
      gastoMaoDeObra += valor;
    } else {
      gastoOutros += valor;
    }
  });

  const colheitasSnapshot = await getDocs(
    collection(db, "usuarios", user.uid, "colheitas")
  );

  colheitasSnapshot.forEach((docItem) => {
    const colheita = docItem.data();
    totalColheita += Number(colheita.quantidade) || 0;
  });

  const trabalhosSnapshot = await getDocs(
    collection(db, "usuarios", user.uid, "trabalhosCompanheiros")
  );

  trabalhosSnapshot.forEach((docItem) => {
    const trabalho = docItem.data();

    if (trabalho.statusPagamento === "pendente") {
      pendenteCompanheiros += Number(trabalho.valor) || 0;
    }
  });

  const moitasSnapshot = await getDocs(
    collection(db, "usuarios", user.uid, "moitas")
  );

  totalMoitas = moitasSnapshot.size;

  const lucro = ganhoBruto - gastoBruto;

  document.getElementById("ganho-bruto").textContent = formatarMoeda(ganhoBruto);
  document.getElementById("gasto-bruto").textContent = formatarMoeda(gastoBruto);
  document.getElementById("lucro-total").textContent = formatarMoeda(lucro);
  document.getElementById("total-colheita").textContent = formatarKg(totalColheita);
  document.getElementById("pendente-companheiros").textContent = formatarMoeda(pendenteCompanheiros);
  document.getElementById("total-moitas").textContent = totalMoitas;

  const elFertilizante = document.getElementById("gasto-fertilizante");
  const elDefensivo = document.getElementById("gasto-defensivo");
  const elHerbicidas = document.getElementById("gasto-herbicidas");
  const elMaoDeObra = document.getElementById("gasto-mao-de-obra");
  const elOutros = document.getElementById("gasto-outros");

  if (elFertilizante) elFertilizante.textContent = formatarMoeda(gastoFertilizante);
  if (elDefensivo) elDefensivo.textContent = formatarMoeda(gastoDefensivo);
  if (elHerbicidas) elHerbicidas.textContent = formatarMoeda(gastoHerbicidas);
  if (elMaoDeObra) elMaoDeObra.textContent = formatarMoeda(gastoMaoDeObra);
  if (elOutros) elOutros.textContent = formatarMoeda(gastoOutros);
}

(async function iniciarPainel() {
  try {
    const resultado = await exigirUsuarioAprovado();
    if (!resultado) return;

    await carregarDadosUsuario(resultado.dados);
    await carregarResumoFinanceiro(resultado.user);
  } catch (erro) {
    console.error("Erro ao carregar painel:", erro);
  }
})();

if (botaoLogout) {
  botaoLogout.addEventListener("click", async () => {
    await signOut(auth);
    window.location.href = "login.html";
  });
}

if (botaoDetalhes && detalhesDespesas) {
  botaoDetalhes.addEventListener("click", () => {
    detalhesDespesas.classList.toggle("oculto");

    if (detalhesDespesas.classList.contains("oculto")) {
      botaoDetalhes.textContent = "Detalhes";
    } else {
      botaoDetalhes.textContent = "Ocultar";
    }
  });
}