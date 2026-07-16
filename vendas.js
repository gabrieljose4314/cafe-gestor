import { db } from "./firebase.js";
import { exigirUsuarioAprovado } from "./acesso.js";
import {
  collection,
  addDoc,
  getDocs,
  deleteDoc,
  doc
} from "https://www.gstatic.com/firebasejs/12.10.0/firebase-firestore.js";

const formVenda = document.getElementById("gerenciamento-vendas-form");
const selectMoita = document.getElementById("moita-vendas");
const listaVendas = document.getElementById("lista-vendas");

let usuarioAtual = null;

// ── Modal ─────────────────────────────────────────────────────────────────────
window.abrirModal  = id => document.getElementById(id).classList.add("aberto");
window.fecharModal = id => document.getElementById(id).classList.remove("aberto");
document.querySelectorAll(".modal-overlay").forEach(m => {
  m.addEventListener("click", e => {
    if (e.target === m) m.classList.remove("aberto");
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

// ── Carregar moitas no select ───────────────────────────────────────────────────
async function carregarMoitas(user) {
  try {
    selectMoita.innerHTML = '<option value="">Sem moita específica</option>';
    const snapshot = await getDocs(collection(db, "usuarios", user.uid, "moitas"));
    snapshot.forEach((documento) => {
      const moita = documento.data();
      const option = document.createElement("option");
      option.value = documento.id;
      option.textContent = moita.nome;
      selectMoita.appendChild(option);
    });
  } catch (erro) {
    console.error("Erro ao carregar moitas:", erro);
    alert("Erro ao carregar moitas");
  }
}

// ── Cards ─────────────────────────────────────────────────────────────────────
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
    <button class="btn-excluir btn-excluir-venda" data-id="${id}">Excluir</button>
  `;
  return div;
}

// ── Listagem ──────────────────────────────────────────────────────────────────
async function listarVendas(user) {
  try {
    listaVendas.innerHTML = "";
    const snapshot = await getDocs(collection(db, "usuarios", user.uid, "vendas"));
    if (snapshot.empty) {
      listaVendas.innerHTML = "<p>Nenhuma venda registrada.</p>";
      return;
    }
    const vendas = [];
    snapshot.forEach((documento) => {
      vendas.push({ id: documento.id, ...documento.data() });
    });
    vendas.sort((a, b) => new Date(b.data) - new Date(a.data));
    vendas.forEach((venda) => {
      listaVendas.appendChild(criarCardVenda(venda, venda.id));
    });
    adicionarEventosExcluir();
  } catch (erro) {
    console.error("Erro ao listar vendas:", erro);
    listaVendas.innerHTML = "<p>Erro ao carregar vendas.</p>";
  }
}
function adicionarEventosExcluir() {
  document.querySelectorAll(".btn-excluir-venda").forEach((botao) => {
    botao.addEventListener("click", async () => {
      const id = botao.getAttribute("data-id");
      if (!confirm("Tem certeza que deseja excluir esta venda?")) return;
      try {
        await deleteDoc(doc(db, "usuarios", usuarioAtual.uid, "vendas", id));
        alert("Venda excluída com sucesso!");
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
    formVenda.reset();
    fecharModal("modal-venda");
    await listarVendas(usuarioAtual);
  } catch (erro) {
    console.error("Erro ao registrar venda:", erro);
    alert("Erro ao registrar venda");
  }
});