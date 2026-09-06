import { db } from "./firebase.js";
import { exigirUsuarioAprovado, ativarTopbarDesktop } from "./acesso.js";

// LINKS ARRUMADOS: Importando o collection, getDocs, doc e getDoc da mesma biblioteca oficial
import {
  collection,
  getDocs,
  doc,
  getDoc
} from "https://www.gstatic.com/firebasejs/12.10.0/firebase-firestore.js";

const botaoDetalhes = document.getElementById("toggle-detalhes-despesas");
const detalhesDespesas = document.getElementById("detalhes-despesas");

function formatarMoeda(valor) {
  return Number(valor || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL"
  });
}

function formatarKg(valor) {
  return `${Number(valor || 0).toLocaleString("pt-BR")} kg`;
}

function formatarSacas(valor) {
  return `${Number(valor || 0).toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })} sacas`;
}

async function carregarDadosUsuario(dados) {
  const nome = dados.dados.nome || "";

  // Preenche a topbar (desktop) e o drawer (celular) : função compartilhada
  // em acesso.js, usada em todas as páginas do site.
  ativarTopbarDesktop(nome);
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
  const totalColheitaSacas = totalColheita / 60;

  document.getElementById("ganho-bruto").textContent = formatarMoeda(ganhoBruto);
  document.getElementById("gasto-bruto").textContent = formatarMoeda(gastoBruto);
  document.getElementById("lucro-total").textContent = formatarMoeda(lucro);
  document.getElementById("total-colheita").textContent = formatarKg(totalColheita);

  const elTotalColheitaSacas = document.getElementById("total-colheita-sacas");
  if (elTotalColheitaSacas) {
    elTotalColheitaSacas.textContent = formatarSacas(totalColheitaSacas);
  }

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
    // 1. FAZ A LEITURA DO FIREBASE
    const resultado = await exigirUsuarioAprovado();
    if (!resultado) return;

    // Acessa o objeto que você mostrou no print do console
    const infoUsuario = resultado.dados; 
    
    // OPERADOR LÓGICO: Se o plano for igual a 'basico', esconde o que é avançado
    if (infoUsuario && infoUsuario.acesso && infoUsuario.acesso.plano === "basico") {
      
      esconderAbasRestritas();
    } else {
    }

    await carregarDadosUsuario(resultado.dados);
    await carregarResumoFinanceiro(resultado.user);
  } catch (erro) {
    console.error("Erro ao carregar painel:", erro);
  }
})();

// Função que remove o que não pertence ao plano básico
function esconderAbasRestritas() {
  // Histórico é exclusivo do plano completo : esconde o link direto na
  // sidebar/drawer (ele agora é um <a> solto, sem <li> ao redor).
  const linkHistorico = document.querySelector('.sidebar-nav > a[href="historico.html"]');
  if (linkHistorico) linkHistorico.style.setProperty("display", "none", "important");

  // Sidebar desktop: o item "Companheiros/Turmas" agora é um botão que abre
  // um submenu (não é mais um <a href="companheiros.html"> direto).
  const itemExpansivel = document.querySelector(".sidebar-item-expansivel");
  if (itemExpansivel) itemExpansivel.style.setProperty("display", "none", "important");
}

// ── Sidebar desktop: item expansível "Companheiros/Turmas" ─────────────────
window.alternarSubmenuSidebar = function (btn) {
  const item = btn.closest(".sidebar-item-expansivel");
  if (item) item.classList.toggle("aberto");
};
document.querySelectorAll(".sidebar-submenu a").forEach(a => {
  const href = a.getAttribute("href");
  if (href && location.pathname.endsWith(href)) {
    a.classList.add("ativo");
    const item = a.closest(".sidebar-item-expansivel");
    if (item) item.classList.add("aberto", "ativo");
  }
});

// ── Drawer mobile : a mesma sidebar agora serve pras duas telas ────────────
window.alternarMenuMobile = function () {
  document.querySelector(".sidebar-desktop")?.classList.toggle("aberta");
  document.querySelector(".overlay-menu-mobile")?.classList.toggle("visivel");
};

window.fecharMenuMobile = function () {
  document.querySelector(".sidebar-desktop")?.classList.remove("aberta");
  document.querySelector(".overlay-menu-mobile")?.classList.remove("visivel");
};

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
