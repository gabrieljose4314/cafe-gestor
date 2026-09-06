import { db } from "./firebase.js";
import { exigirUsuarioAprovado, ativarTopbarDesktop } from "./acesso.js";
import {
  collection,
  addDoc,
  getDocs,
  deleteDoc,
  doc,
  updateDoc
} from "https://www.gstatic.com/firebasejs/12.10.0/firebase-firestore.js";

const formCompra = document.getElementById("gerenciamento-compras-form");
const listaCompras = document.getElementById("lista-compras");
const botaoSalvarCompra = document.getElementById("btn-salvar-compra");
const tituloModalCompra = document.getElementById("titulo-modal-compra");

// Elementos do layout desktop novo — checagem defensiva, mesmo padrão
// já usado nas outras páginas migradas.
const formCompraDesktop = document.getElementById("form-compra-desktop");
const tituloFormCompraDesktop = document.getElementById("titulo-form-compra-desktop");
const botaoSalvarCompraDesktop = document.getElementById("btn-salvar-compra-desktop");
const botaoCancelarCompraDesktop = document.getElementById("btn-cancelar-compra-desktop");
const tabelaComprasCorpo = document.getElementById("tabela-compras-corpo");
const totalComprasDesktopEl = document.getElementById("total-compras-desktop");
const valorTotalComprasDesktopEl = document.getElementById("valor-total-compras-desktop");
const pesquisaCompraDesktop = document.getElementById("pesquisa-compra-desktop");

let usuarioAtual = null;
let compraEmEdicaoId = null;
let todasAsCompras = [];

// ── Modal ─────────────────────────────────────────────────────────────────────
window.abrirModal  = id => document.getElementById(id).classList.add("aberto");
window.fecharModal = id => document.getElementById(id).classList.remove("aberto");

window.fecharModalCompra = function() {
  window.fecharModal("modal-compra");
  limparFormulario();
};

document.querySelectorAll(".modal-overlay").forEach(m => {
  m.addEventListener("click", e => {
    if (e.target === m) {
      if (m.id === "modal-compra") {
        window.fecharModalCompra();
      } else {
        window.fecharModal(m.id);
      }
    }
  });
});

// ── Utilitários ───────────────────────────────────────────────────────────────
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

// ── Busca ─────────────────────────────────────────────────────────────────────
window.filtrarCompras = function() {
  const termo = document.getElementById("pesquisa-compra").value.trim().toLowerCase();
  document.querySelectorAll("#lista-compras .card-compra").forEach(card => {
    const texto = card.getAttribute("data-busca") || "";
    card.style.display = texto.includes(termo) ? "block" : "none";
  });
};

if (pesquisaCompraDesktop) {
  pesquisaCompraDesktop.addEventListener("input", () => {
    const termo = pesquisaCompraDesktop.value.trim().toLowerCase();
    document.querySelectorAll("#tabela-compras-corpo tr[data-busca]").forEach((linha) => {
      const texto = linha.getAttribute("data-busca") || "";
      linha.classList.toggle("linha-oculta", !texto.includes(termo));
    });
  });
}

// ── Cadastro / edição de compra ─────────────────────────────────────────────────
// Editar aqui SÓ atualiza o registro da compra em si — o lote de Estoque
// gerado automaticamente na criação não é tocado, igual já acontece hoje
// com a exclusão (o alerta de exclusão já avisa isso).
function limparFormulario() {
  formCompra.reset();
  compraEmEdicaoId = null;
  if (botaoSalvarCompra) botaoSalvarCompra.textContent = "Registrar Compra";
  if (tituloModalCompra) tituloModalCompra.textContent = "🛒 Registrar Compra";
  limparFormularioDesktop();
}
function preencherFormulario(compra) {
  document.getElementById("fornecedor-compra").value = compra.fornecedor || "";
  document.getElementById("data-compra").value = compra.data || "";
  document.getElementById("quantidade-comprada").value = compra.quantidadeSacas || "";
  document.getElementById("preco-unitario-compra").value = compra.precoUnitario || "";
  document.getElementById("anotacoes-compra").value = compra.anotacoes || "";
}

// Layout desktop novo — form sempre visível na tela, "editar" só troca
// o modo do form no lugar (sem abrir modal).
function limparFormularioDesktop() {
  if (!formCompraDesktop) return;
  formCompraDesktop.reset();
  if (tituloFormCompraDesktop) tituloFormCompraDesktop.textContent = "Registrar Compra";
  if (botaoSalvarCompraDesktop) botaoSalvarCompraDesktop.textContent = "Registrar Compra";
  if (botaoCancelarCompraDesktop) botaoCancelarCompraDesktop.classList.add("oculto");
}
function preencherFormularioDesktop(compra) {
  document.getElementById("fornecedor-compra-desktop").value = compra.fornecedor || "";
  document.getElementById("data-compra-desktop").value = compra.data || "";
  document.getElementById("quantidade-comprada-desktop").value = compra.quantidadeSacas || "";
  document.getElementById("preco-unitario-compra-desktop").value = compra.precoUnitario || "";
  document.getElementById("anotacoes-compra-desktop").value = compra.anotacoes || "";
}
if (botaoCancelarCompraDesktop) {
  botaoCancelarCompraDesktop.addEventListener("click", () => {
    compraEmEdicaoId = null;
    limparFormularioDesktop();
  });
}

// ── Cards ─────────────────────────────────────────────────────────────────────
function criarCardCompra(compra, id) {
  const div = document.createElement("div");
  div.classList.add("card-compra");
  div.setAttribute("data-busca", (compra.fornecedor || "").toLowerCase());
  div.innerHTML = `
    <p><strong>Fornecedor:</strong> ${compra.fornecedor || "-"}</p>
    <p><strong>Data:</strong> ${formatarDataBR(compra.data)}</p>
    <p><strong>Quantidade:</strong> ${formatarNumero(compra.quantidadeSacas || 0)} sacas</p>
    <p><strong>Preço por saca:</strong> ${formatarMoeda(compra.precoUnitario)}</p>
    <p><strong>Valor total:</strong> ${formatarMoeda(compra.valorTotal)}</p>
    ${compra.anotacoes ? `<p><strong>Anotações:</strong> ${compra.anotacoes}</p>` : ""}
    <button class="btn-editar-compra" data-id="${id}">Editar</button>
    <button class="btn-excluir btn-excluir-compra" data-id="${id}">Excluir</button>
  `;
  return div;
}

// ── Linha da tabela (desktop) ────────────────────────────────────────────────
function criarLinhaCompra(compra, id) {
  const tr = document.createElement("tr");
  tr.setAttribute("data-busca", (compra.fornecedor || "").toLowerCase());
  tr.innerHTML = `
    <td>${formatarDataBR(compra.data)}</td>
    <td>${compra.fornecedor || "-"}</td>
    <td>${formatarNumero(compra.quantidadeSacas || 0)} sacas</td>
    <td>${formatarMoeda(compra.precoUnitario)}</td>
    <td>${formatarMoeda(compra.valorTotal)}</td>
    <td>
      <button class="btn-excluir-tabela btn-editar-compra-desktop" data-id="${id}">Editar</button>
      <button class="btn-excluir-tabela btn-excluir-compra" data-id="${id}">Excluir</button>
    </td>
  `;
  return tr;
}

// ── Listagem ──────────────────────────────────────────────────────────────────
async function listarCompras(user) {
  try {
    listaCompras.innerHTML = "";
    if (tabelaComprasCorpo) tabelaComprasCorpo.innerHTML = "";
    todasAsCompras = [];

    const snapshot = await getDocs(collection(db, "usuarios", user.uid, "compras"));

    if (snapshot.empty) {
      listaCompras.innerHTML = "<p>Nenhuma compra registrada.</p>";
      if (tabelaComprasCorpo) {
        tabelaComprasCorpo.innerHTML = '<tr class="tabela-vazio"><td colspan="6">Nenhuma compra registrada.</td></tr>';
      }
      if (totalComprasDesktopEl) totalComprasDesktopEl.textContent = "0";
      if (valorTotalComprasDesktopEl) valorTotalComprasDesktopEl.textContent = formatarMoeda(0);
      return;
    }

    snapshot.forEach((documento) => {
      todasAsCompras.push({ id: documento.id, ...documento.data() });
    });
    todasAsCompras.sort((a, b) => new Date(b.data) - new Date(a.data));

    let valorTotalGeral = 0;

    todasAsCompras.forEach((compra) => {
      listaCompras.appendChild(criarCardCompra(compra, compra.id));
      if (tabelaComprasCorpo) tabelaComprasCorpo.appendChild(criarLinhaCompra(compra, compra.id));
      valorTotalGeral += Number(compra.valorTotal) || 0;
    });

    if (totalComprasDesktopEl) totalComprasDesktopEl.textContent = todasAsCompras.length;
    if (valorTotalComprasDesktopEl) valorTotalComprasDesktopEl.textContent = formatarMoeda(valorTotalGeral);

    adicionarEventosEditar();
    adicionarEventosEditarDesktop();
    adicionarEventosExcluir();
  } catch (erro) {
    console.error("Erro ao listar compras:", erro);
    listaCompras.innerHTML = "<p>Erro ao carregar compras.</p>";
    if (tabelaComprasCorpo) {
      tabelaComprasCorpo.innerHTML = '<tr class="tabela-vazio"><td colspan="6">Erro ao carregar compras.</td></tr>';
    }
  }
}
function adicionarEventosEditar() {
  document.querySelectorAll(".btn-editar-compra").forEach((botao) => {
    botao.addEventListener("click", () => {
      const id = botao.getAttribute("data-id");
      const compra = todasAsCompras.find((item) => item.id === id);
      if (!compra) return;
      compraEmEdicaoId = id;
      preencherFormulario(compra);
      if (botaoSalvarCompra) botaoSalvarCompra.textContent = "Atualizar Compra";
      if (tituloModalCompra) tituloModalCompra.textContent = "✏️ Editar Compra";
      window.fecharModal("modal-ver-compras");
      window.abrirModal("modal-compra");
    });
  });
}
function adicionarEventosEditarDesktop() {
  document.querySelectorAll(".btn-editar-compra-desktop").forEach((botao) => {
    botao.addEventListener("click", () => {
      const id = botao.getAttribute("data-id");
      const compra = todasAsCompras.find((item) => item.id === id);
      if (!compra || !formCompraDesktop) return;
      compraEmEdicaoId = id;
      preencherFormularioDesktop(compra);
      if (tituloFormCompraDesktop) tituloFormCompraDesktop.textContent = "Editar Compra";
      if (botaoSalvarCompraDesktop) botaoSalvarCompraDesktop.textContent = "Atualizar Compra";
      if (botaoCancelarCompraDesktop) botaoCancelarCompraDesktop.classList.remove("oculto");
      formCompraDesktop.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  });
}
function adicionarEventosExcluir() {
  document.querySelectorAll(".btn-excluir-compra").forEach((botao) => {
    botao.addEventListener("click", async () => {
      const id = botao.getAttribute("data-id");
      if (!confirm("Tem certeza que deseja excluir esta compra? O lote de estoque gerado por ela NÃO será excluído automaticamente.")) return;
      try {
        await deleteDoc(doc(db, "usuarios", usuarioAtual.uid, "compras", id));
        alert("Compra excluída com sucesso!");
        if (compraEmEdicaoId === id) limparFormulario();
        await listarCompras(usuarioAtual);
      } catch (erro) {
        console.error("Erro ao excluir compra:", erro);
        alert("Erro ao excluir compra");
      }
    });
  });
}

// ── Início ────────────────────────────────────────────────────────────────────
(async function iniciarCompras() {
  const resultado = await exigirUsuarioAprovado();
  if (!resultado) return;
  ativarTopbarDesktop(resultado.dados?.dados?.nome);
  usuarioAtual = resultado.user;
  await listarCompras(usuarioAtual);
})();

// ── Formulário ────────────────────────────────────────────────────────────────
formCompra.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!usuarioAtual) {
    alert("Usuário não autenticado");
    return;
  }
  const fornecedor = document.getElementById("fornecedor-compra").value.trim();
  const data = document.getElementById("data-compra").value;
  const quantidadeSacas = Number(document.getElementById("quantidade-comprada").value);
  const precoPorSaca = Number(document.getElementById("preco-unitario-compra").value);
  const anotacoes = document.getElementById("anotacoes-compra").value.trim();
  const quantidadeKg = quantidadeSacas * 60;
  const valorTotal = quantidadeSacas * precoPorSaca;

  try {
    if (compraEmEdicaoId) {
      // Editar só atualiza o registro da compra — o lote de Estoque
      // gerado quando ela foi criada não é recriado nem tocado.
      await updateDoc(doc(db, "usuarios", usuarioAtual.uid, "compras", compraEmEdicaoId), {
        fornecedor,
        data,
        quantidadeSacas,
        quantidadeKg,
        precoUnitario: precoPorSaca,
        unidadePreco: "saca",
        valorTotal,
        anotacoes: anotacoes || null
      });
      alert("Compra atualizada com sucesso!");
    } else {
      // 1. Registra a compra
      const refCompra = await addDoc(collection(db, "usuarios", usuarioAtual.uid, "compras"), {
        fornecedor,
        data,
        quantidadeSacas,
        quantidadeKg,
        precoUnitario: precoPorSaca,
        unidadePreco: "saca",
        valorTotal,
        anotacoes: anotacoes || null,
        criadoEm: new Date()
      });

      // 2. Gera automaticamente o lote correspondente no Estoque — compra
      //    NÃO é um cadastro manual de lote, ela mesma já vira estoque.
      await addDoc(collection(db, "usuarios", usuarioAtual.uid, "estoque"), {
        nome: `Compra de ${fornecedor} (${formatarDataBR(data)})`,
        quantidadeSacas,
        anotacoes: anotacoes || null,
        origem: "compra",
        compraId: refCompra.id,
        criadoEm: new Date()
      });

      alert("Compra registrada com sucesso! Lote adicionado ao estoque.");
    }
    window.fecharModalCompra();
    await listarCompras(usuarioAtual);
  } catch (erro) {
    console.error("Erro ao salvar compra:", erro);
    alert("Erro ao salvar compra");
  }
});

// Formulário do layout desktop novo — mesma lógica de cadastro (incluindo
// a geração automática do lote de Estoque), sem modal.
if (formCompraDesktop) {
  formCompraDesktop.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!usuarioAtual) {
      alert("Usuário não autenticado");
      return;
    }
    const fornecedor = document.getElementById("fornecedor-compra-desktop").value.trim();
    const data = document.getElementById("data-compra-desktop").value;
    const quantidadeSacas = Number(document.getElementById("quantidade-comprada-desktop").value);
    const precoPorSaca = Number(document.getElementById("preco-unitario-compra-desktop").value);
    const anotacoes = document.getElementById("anotacoes-compra-desktop").value.trim();
    const quantidadeKg = quantidadeSacas * 60;
    const valorTotal = quantidadeSacas * precoPorSaca;

    try {
      if (compraEmEdicaoId) {
        await updateDoc(doc(db, "usuarios", usuarioAtual.uid, "compras", compraEmEdicaoId), {
          fornecedor,
          data,
          quantidadeSacas,
          quantidadeKg,
          precoUnitario: precoPorSaca,
          unidadePreco: "saca",
          valorTotal,
          anotacoes: anotacoes || null
        });
        alert("Compra atualizada com sucesso!");
      } else {
        const refCompra = await addDoc(collection(db, "usuarios", usuarioAtual.uid, "compras"), {
          fornecedor,
          data,
          quantidadeSacas,
          quantidadeKg,
          precoUnitario: precoPorSaca,
          unidadePreco: "saca",
          valorTotal,
          anotacoes: anotacoes || null,
          criadoEm: new Date()
        });

        await addDoc(collection(db, "usuarios", usuarioAtual.uid, "estoque"), {
          nome: `Compra de ${fornecedor} (${formatarDataBR(data)})`,
          quantidadeSacas,
          anotacoes: anotacoes || null,
          origem: "compra",
          compraId: refCompra.id,
          criadoEm: new Date()
        });

        alert("Compra registrada com sucesso! Lote adicionado ao estoque.");
      }
      compraEmEdicaoId = null;
      limparFormularioDesktop();
      await listarCompras(usuarioAtual);
    } catch (erro) {
      console.error("Erro ao salvar compra:", erro);
      alert("Erro ao salvar compra");
    }
  });
}
