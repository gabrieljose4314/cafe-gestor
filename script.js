import { auth, db } from "./firebase.js";

import {
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/12.10.0/firebase-auth.js";

import {
  doc,
  getDoc,
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

async function carregarDadosUsuario(user) {
  const userRef = doc(db, "usuarios", user.uid);
  const snap = await getDoc(userRef);

  if (snap.exists()) {
    const dados = snap.data().dados;

    document.getElementById("nomeUsuario").textContent =
      "Bem-vindo, " + dados.nome;
  }
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

  // VENDAS
  const vendasSnapshot = await getDocs(
    collection(db, "usuarios", user.uid, "vendas")
  );

  vendasSnapshot.forEach((doc) => {
    const venda = doc.data();
    ganhoBruto += Number(venda.valorTotal) || 0;
  });

  // DESPESAS
  const despesasSnapshot = await getDocs(
    collection(db, "usuarios", user.uid, "despesas")
  );

  despesasSnapshot.forEach((doc) => {
    const despesa = doc.data();
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

  // COLHEITAS
  const colheitasSnapshot = await getDocs(
    collection(db, "usuarios", user.uid, "colheitas")
  );

  colheitasSnapshot.forEach((doc) => {
    const colheita = doc.data();
    totalColheita += Number(colheita.quantidade) || 0;
  });

  // COMPANHEIROS PENDENTES
  const trabalhosSnapshot = await getDocs(
    collection(db, "usuarios", user.uid, "trabalhosCompanheiros")
  );

  trabalhosSnapshot.forEach((doc) => {
    const trabalho = doc.data();

    if (trabalho.statusPagamento === "pendente") {
      pendenteCompanheiros += Number(trabalho.valor) || 0;
    }
  });

  // MOITAS
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

  document.getElementById("gasto-fertilizante").textContent = formatarMoeda(gastoFertilizante);
  document.getElementById("gasto-defensivo").textContent = formatarMoeda(gastoDefensivo);
  document.getElementById("gasto-herbicidas").textContent = formatarMoeda(gastoHerbicidas);
  document.getElementById("gasto-mao-de-obra").textContent = formatarMoeda(gastoMaoDeObra);
  document.getElementById("gasto-outros").textContent = formatarMoeda(gastoOutros);
}

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = "login.html";
    return;
  }

  try {
    await carregarDadosUsuario(user);
    await carregarResumoFinanceiro(user);
  } catch (erro) {
    console.error("Erro ao carregar painel:", erro);
  }
});

botaoLogout.addEventListener("click", async () => {
  await signOut(auth);
  window.location.href = "login.html";
});

botaoDetalhes.addEventListener("click", () => {
  detalhesDespesas.classList.toggle("oculto");

  if (detalhesDespesas.classList.contains("oculto")) {
    botaoDetalhes.textContent = "Detalhes";
  } else {
    botaoDetalhes.textContent = "Ocultar";
  }
});