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

const formVenda = document.getElementById("gerenciamento-vendas-form");
const selectMoita = document.getElementById("moita-vendas");
const listaVendas = document.getElementById("lista-vendas");
const botaoSalvarVenda = document.getElementById("btn-salvar-venda");
const tituloModalVenda = document.getElementById("titulo-modal-venda");

// Elementos do layout desktop novo (protótipo) — todos podem não existir
// se esse arquivo um dia for reaproveitado numa página que não migrou pro
// layout novo, por isso tudo aqui é tratado com checagem defensiva.
const formVendaDesktop = document.getElementById("form-venda-desktop");
const selectMoitaDesktop = document.getElementById("moita-vendas-desktop");
const tituloFormVendaDesktop = document.getElementById("titulo-form-venda-desktop");
const botaoSalvarVendaDesktop = document.getElementById("btn-salvar-venda-desktop");
const botaoCancelarVendaDesktop = document.getElementById("btn-cancelar-venda-desktop");
const tabelaVendasCorpo = document.getElementById("tabela-vendas-corpo");
const totalVendasDesktopEl = document.getElementById("total-vendas-desktop");
const valorTotalVendasDesktopEl = document.getElementById("valor-total-vendas-desktop");
const pesquisaVendaDesktop = document.getElementById("pesquisa-venda-desktop");

let usuarioAtual = null;
let vendaEmEdicaoId = null;
let todasAsVendas = [];

// ── Modal ─────────────────────────────────────────────────────────────────────
window.abrirModal  = id => document.getElementById(id).classList.add("aberto");
window.fecharModal = id => document.getElementById(id).classList.remove("aberto");

window.fecharModalVenda = function() {
  window.fecharModal("modal-venda");
  limparFormulario();
};

document.querySelectorAll(".modal-overlay").forEach(m => {
  m.addEventListener("click", e => {
    if (e.target === m) {
      if (m.id === "modal-venda") {
        window.fecharModalVenda();
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
window.filtrarVendas = function() {
  const termo = document.getElementById("pesquisa-venda").value.trim().toLowerCase();
  document.querySelectorAll("#lista-vendas .card-venda").forEach(card => {
    const nome = card.getAttribute("data-nome") || "";
    card.style.display = nome.includes(termo) ? "block" : "none";
  });
};

if (pesquisaVendaDesktop) {
  pesquisaVendaDesktop.addEventListener("input", () => {
    const termo = pesquisaVendaDesktop.value.trim().toLowerCase();
    document.querySelectorAll("#tabela-vendas-corpo tr[data-nome]").forEach((linha) => {
      const nome = linha.getAttribute("data-nome") || "";
      linha.classList.toggle("linha-oculta", !nome.includes(termo));
    });
  });
}

// ── Carregar moitas no select ───────────────────────────────────────────────────
async function carregarMoitas(user) {
  try {
    const opcaoPadrao = '<option value="">Sem moita específica</option>';
    selectMoita.innerHTML = opcaoPadrao;
    if (selectMoitaDesktop) selectMoitaDesktop.innerHTML = opcaoPadrao;

    const snapshot = await getDocs(collection(db, "usuarios", user.uid, "moitas"));
    snapshot.forEach((documento) => {
      const moita = documento.data();

      const option = document.createElement("option");
      option.value = documento.id;
      option.textContent = moita.nome;
      selectMoita.appendChild(option);

      if (selectMoitaDesktop) {
        const optionDesktop = document.createElement("option");
        optionDesktop.value = documento.id;
        optionDesktop.textContent = moita.nome;
        selectMoitaDesktop.appendChild(optionDesktop);
      }
    });
  } catch (erro) {
    console.error("Erro ao carregar moitas:", erro);
    alert("Erro ao carregar moitas");
  }
}

// ── Cadastro / edição de venda ───────────────────────────────────────────────
function limparFormulario() {
  formVenda.reset();
  vendaEmEdicaoId = null;
  if (botaoSalvarVenda) botaoSalvarVenda.textContent = "Registrar Venda";
  if (tituloModalVenda) tituloModalVenda.textContent = "💰 Registrar Venda";
  limparFormularioDesktop();
}
function preencherFormulario(venda) {
  if (selectMoita) selectMoita.value = venda.moitaId || "";
  document.getElementById("data-venda").value = venda.data || "";
  document.getElementById("quantidade-vendida").value = venda.quantidadeSacas || "";
  document.getElementById("preco-unitario").value = venda.precoUnitario || "";
}

// Layout desktop novo — form sempre visível na tela, "editar" só troca
// o modo do form no lugar (sem abrir modal).
function limparFormularioDesktop() {
  if (!formVendaDesktop) return;
  formVendaDesktop.reset();
  if (tituloFormVendaDesktop) tituloFormVendaDesktop.textContent = "Registrar Venda";
  if (botaoSalvarVendaDesktop) botaoSalvarVendaDesktop.textContent = "Registrar Venda";
  if (botaoCancelarVendaDesktop) botaoCancelarVendaDesktop.classList.add("oculto");
}
function preencherFormularioDesktop(venda) {
  if (selectMoitaDesktop) selectMoitaDesktop.value = venda.moitaId || "";
  document.getElementById("data-venda-desktop").value = venda.data || "";
  document.getElementById("quantidade-vendida-desktop").value = venda.quantidadeSacas || "";
  document.getElementById("preco-unitario-desktop").value = venda.precoUnitario || "";
}
if (botaoCancelarVendaDesktop) {
  botaoCancelarVendaDesktop.addEventListener("click", () => {
    vendaEmEdicaoId = null;
    limparFormularioDesktop();
  });
}

// ── Cards (mobile) ───────────────────────────────────────────────────────────
function criarCardVenda(venda, id) {
  const div = document.createElement("div");
  div.classList.add("card-venda");
  div.setAttribute("data-nome", (venda.moitaNome || "").toLowerCase());
  div.innerHTML = `
    <p><strong>Moita:</strong> ${venda.moitaNome || "Sem moita específica"}</p>
    <p><strong>Data:</strong> ${formatarDataBR(venda.data)}</p>
    <p><strong>Quantidade:</strong> ${formatarNumero(venda.quantidadeSacas || 0)} sacas</p>
    <p><strong>Quantidade em kg:</strong> ${formatarNumero(venda.quantidadeKg || 0)} kg</p>
    <p><strong>Preço por saca:</strong> ${formatarMoeda(venda.precoUnitario)}</p>
    <p><strong>Valor total:</strong> ${formatarMoeda(venda.valorTotal)}</p>
    <button class="btn-editar-venda" data-id="${id}">Editar</button>
    <button class="btn-excluir btn-excluir-venda" data-id="${id}">Excluir</button>
  `;
  return div;
}

// ── Linha da tabela (desktop) ────────────────────────────────────────────────
function criarLinhaVenda(venda, id) {
  const tr = document.createElement("tr");
  tr.setAttribute("data-nome", (venda.moitaNome || "").toLowerCase());
  tr.innerHTML = `
    <td>${formatarDataBR(venda.data)}</td>
    <td>${venda.moitaNome || "Sem moita específica"}</td>
    <td>${formatarNumero(venda.quantidadeSacas || 0)} sacas</td>
    <td>${formatarMoeda(venda.precoUnitario)}</td>
    <td>${formatarMoeda(venda.valorTotal)}</td>
    <td>
      <button class="btn-excluir-tabela btn-editar-venda-desktop" data-id="${id}">Editar</button>
      <button class="btn-excluir-tabela btn-excluir-venda" data-id="${id}">Excluir</button>
    </td>
  `;
  return tr;
}

// ── Listagem ──────────────────────────────────────────────────────────────────
async function listarVendas(user) {
  try {
    listaVendas.innerHTML = "";
    if (tabelaVendasCorpo) tabelaVendasCorpo.innerHTML = "";
    todasAsVendas = [];

    const snapshot = await getDocs(collection(db, "usuarios", user.uid, "vendas"));

    if (snapshot.empty) {
      listaVendas.innerHTML = "<p>Nenhuma venda registrada.</p>";
      if (tabelaVendasCorpo) {
        tabelaVendasCorpo.innerHTML = '<tr class="tabela-vazio"><td colspan="6">Nenhuma venda registrada.</td></tr>';
      }
      if (totalVendasDesktopEl) totalVendasDesktopEl.textContent = "0";
      if (valorTotalVendasDesktopEl) valorTotalVendasDesktopEl.textContent = formatarMoeda(0);
      return;
    }

    snapshot.forEach((documento) => {
      todasAsVendas.push({ id: documento.id, ...documento.data() });
    });
    todasAsVendas.sort((a, b) => new Date(b.data) - new Date(a.data));

    let valorTotalGeral = 0;

    todasAsVendas.forEach((venda) => {
      listaVendas.appendChild(criarCardVenda(venda, venda.id));
      if (tabelaVendasCorpo) tabelaVendasCorpo.appendChild(criarLinhaVenda(venda, venda.id));
      valorTotalGeral += Number(venda.valorTotal) || 0;
    });

    if (totalVendasDesktopEl) totalVendasDesktopEl.textContent = todasAsVendas.length;
    if (valorTotalVendasDesktopEl) valorTotalVendasDesktopEl.textContent = formatarMoeda(valorTotalGeral);

    adicionarEventosEditar();
    adicionarEventosEditarDesktop();
    adicionarEventosExcluir();
  } catch (erro) {
    console.error("Erro ao listar vendas:", erro);
    listaVendas.innerHTML = "<p>Erro ao carregar vendas.</p>";
    if (tabelaVendasCorpo) {
      tabelaVendasCorpo.innerHTML = '<tr class="tabela-vazio"><td colspan="6">Erro ao carregar vendas.</td></tr>';
    }
  }
}
function adicionarEventosEditar() {
  document.querySelectorAll(".btn-editar-venda").forEach((botao) => {
    botao.addEventListener("click", () => {
      const id = botao.getAttribute("data-id");
      const venda = todasAsVendas.find((item) => item.id === id);
      if (!venda) return;
      vendaEmEdicaoId = id;
      preencherFormulario(venda);
      if (botaoSalvarVenda) botaoSalvarVenda.textContent = "Atualizar Venda";
      if (tituloModalVenda) tituloModalVenda.textContent = "✏️ Editar Venda";
      window.fecharModal("modal-ver-vendas");
      window.abrirModal("modal-venda");
    });
  });
}
function adicionarEventosEditarDesktop() {
  document.querySelectorAll(".btn-editar-venda-desktop").forEach((botao) => {
    botao.addEventListener("click", () => {
      const id = botao.getAttribute("data-id");
      const venda = todasAsVendas.find((item) => item.id === id);
      if (!venda || !formVendaDesktop) return;
      vendaEmEdicaoId = id;
      preencherFormularioDesktop(venda);
      if (tituloFormVendaDesktop) tituloFormVendaDesktop.textContent = "Editar Venda";
      if (botaoSalvarVendaDesktop) botaoSalvarVendaDesktop.textContent = "Atualizar Venda";
      if (botaoCancelarVendaDesktop) botaoCancelarVendaDesktop.classList.remove("oculto");
      formVendaDesktop.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  });
}
function adicionarEventosExcluir() {
  document.querySelectorAll(".btn-excluir-venda").forEach((botao) => {
    botao.addEventListener("click", async () => {
      const id = botao.getAttribute("data-id");
      if (!confirm("Tem certeza que deseja excluir esta venda?")) return;
      try {
        await deleteDoc(doc(db, "usuarios", usuarioAtual.uid, "vendas", id));
        alert("Venda excluída com sucesso!");
        if (vendaEmEdicaoId === id) limparFormulario();
        await listarVendas(usuarioAtual);
      } catch (erro) {
        console.error("Erro ao excluir venda:", erro);
        alert("Erro ao excluir venda");
      }
    });
  });
}

// ── Início ────────────────────────────────────────────────────────────────────
(async function iniciarVendas() {
  const resultado = await exigirUsuarioAprovado();
  if (!resultado) return;
  ativarTopbarDesktop(resultado.dados?.dados?.nome);
  usuarioAtual = resultado.user;
  await carregarMoitas(usuarioAtual);
  await listarVendas(usuarioAtual);
})();

// ── Formulário ────────────────────────────────────────────────────────────────
formVenda.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!usuarioAtual) {
    alert("Usuário não autenticado");
    return;
  }
  const moitaId = selectMoita.value;
  const moitaNome = moitaId ? selectMoita.options[selectMoita.selectedIndex].text : null;
  const data = document.getElementById("data-venda").value;
  const quantidadeSacas = Number(document.getElementById("quantidade-vendida").value);
  const precoPorSaca = Number(document.getElementById("preco-unitario").value);
  const quantidadeKg = quantidadeSacas * 60;
  const valorTotal = quantidadeSacas * precoPorSaca;
  try {
    if (vendaEmEdicaoId) {
      await updateDoc(doc(db, "usuarios", usuarioAtual.uid, "vendas", vendaEmEdicaoId), {
        moitaId: moitaId || null,
        moitaNome: moitaNome || null,
        data: data,
        quantidadeSacas: quantidadeSacas,
        quantidadeKg: quantidadeKg,
        precoUnitario: precoPorSaca,
        unidadePreco: "saca",
        valorTotal: valorTotal
      });
      alert("Venda atualizada com sucesso!");
    } else {
      await addDoc(collection(db, "usuarios", usuarioAtual.uid, "vendas"), {
        moitaId: moitaId || null,
        moitaNome: moitaNome || null,
        data: data,
        quantidadeSacas: quantidadeSacas,
        quantidadeKg: quantidadeKg,
        precoUnitario: precoPorSaca,
        unidadePreco: "saca",
        valorTotal: valorTotal,
        criadoEm: new Date()
      });
      alert("Venda registrada com sucesso!");
    }
    window.fecharModalVenda();
    await listarVendas(usuarioAtual);
  } catch (erro) {
    console.error("Erro ao salvar venda:", erro);
    alert("Erro ao salvar venda");
  }
});

// Formulário do layout desktop novo — mesma lógica de cadastro do form
// mobile, só que sem modal (o form já fica sempre visível na tela).
if (formVendaDesktop) {
  formVendaDesktop.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!usuarioAtual) {
      alert("Usuário não autenticado");
      return;
    }
    const moitaId = selectMoitaDesktop.value;
    const moitaNome = moitaId ? selectMoitaDesktop.options[selectMoitaDesktop.selectedIndex].text : null;
    const data = document.getElementById("data-venda-desktop").value;
    const quantidadeSacas = Number(document.getElementById("quantidade-vendida-desktop").value);
    const precoPorSaca = Number(document.getElementById("preco-unitario-desktop").value);
    const quantidadeKg = quantidadeSacas * 60;
    const valorTotal = quantidadeSacas * precoPorSaca;
    try {
      if (vendaEmEdicaoId) {
        await updateDoc(doc(db, "usuarios", usuarioAtual.uid, "vendas", vendaEmEdicaoId), {
          moitaId: moitaId || null,
          moitaNome: moitaNome || null,
          data: data,
          quantidadeSacas: quantidadeSacas,
          quantidadeKg: quantidadeKg,
          precoUnitario: precoPorSaca,
          unidadePreco: "saca",
          valorTotal: valorTotal
        });
        alert("Venda atualizada com sucesso!");
      } else {
        await addDoc(collection(db, "usuarios", usuarioAtual.uid, "vendas"), {
          moitaId: moitaId || null,
          moitaNome: moitaNome || null,
          data: data,
          quantidadeSacas: quantidadeSacas,
          quantidadeKg: quantidadeKg,
          precoUnitario: precoPorSaca,
          unidadePreco: "saca",
          valorTotal: valorTotal,
          criadoEm: new Date()
        });
        alert("Venda registrada com sucesso!");
      }
      vendaEmEdicaoId = null;
      limparFormularioDesktop();
      await listarVendas(usuarioAtual);
    } catch (erro) {
      console.error("Erro ao salvar venda:", erro);
      alert("Erro ao salvar venda");
    }
  });
}