import { db } from "./firebase.js";
import { exigirUsuarioAprovado } from "./acesso.js";
import {
  collection,
  addDoc,
  getDocs,
  deleteDoc,
  doc
} from "https://www.gstatic.com/firebasejs/12.10.0/firebase-firestore.js";

const formColheita = document.getElementById("gerenciamento-colheita-form");
const selectMoita = document.getElementById("moita-colheita");
const listaColheitas = document.getElementById("lista-colheitas");

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
window.filtrarColheitas = function() {
  const termo = document.getElementById("pesquisa-colheita").value.trim().toLowerCase();
  document.querySelectorAll("#lista-colheitas .card-colheita").forEach(card => {
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
function criarCardColheita(colheita, id) {
  const div = document.createElement("div");
  div.classList.add("card-colheita");
  div.setAttribute("data-nome", (colheita.moitaNome || "").toLowerCase());
  div.innerHTML = `
    <p><strong>Moita:</strong> ${colheita.moitaNome || "Sem moita específica"}</p>
    <p><strong>Data:</strong> ${formatarDataBR(colheita.data)}</p>
    <p><strong>Quantidade:</strong> ${formatarNumero(colheita.quantidade)} kg</p>
    <button class="btn-excluir btn-excluir-colheita" data-id="${id}">Excluir</button>
  `;
  return div;
}

// ── Listagem ──────────────────────────────────────────────────────────────────
async function listarColheitas(user) {
  try {
    listaColheitas.innerHTML = "";
    const snapshot = await getDocs(collection(db, "usuarios", user.uid, "colheitas"));
    if (snapshot.empty) {
      listaColheitas.innerHTML = "<p>Nenhuma colheita registrada.</p>";
      return;
    }
    const colheitas = [];
    snapshot.forEach((documento) => {
      colheitas.push({ id: documento.id, ...documento.data() });
    });
    colheitas.sort((a, b) => new Date(b.data) - new Date(a.data));
    colheitas.forEach((colheita) => {
      listaColheitas.appendChild(criarCardColheita(colheita, colheita.id));
    });
    adicionarEventosExcluir();
  } catch (erro) {
    console.error("Erro ao listar colheitas:", erro);
    listaColheitas.innerHTML = "<p>Erro ao carregar colheitas.</p>";
  }
}
function adicionarEventosExcluir() {
  document.querySelectorAll(".btn-excluir-colheita").forEach((botao) => {
    botao.addEventListener("click", async () => {
      const id = botao.getAttribute("data-id");
      if (!confirm("Tem certeza que deseja excluir esta colheita?")) return;
      try {
        await deleteDoc(doc(db, "usuarios", usuarioAtual.uid, "colheitas", id));
        alert("Colheita excluída com sucesso!");
        await listarColheitas(usuarioAtual);
      } catch (erro) {
        console.error("Erro ao excluir colheita:", erro);
        alert("Erro ao excluir colheita");
      }
    });
  });
}

// ── Início ────────────────────────────────────────────────────────────────────
(async function iniciarColheita() {
  const resultado = await exigirUsuarioAprovado();
  if (!resultado) return;
  usuarioAtual = resultado.user;
  await carregarMoitas(usuarioAtual);
  await listarColheitas(usuarioAtual);
})();

// ── Formulário ────────────────────────────────────────────────────────────────
formColheita.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!usuarioAtual) {
    alert("Usuário não autenticado");
    return;
  }
  const moitaId = selectMoita.value;
  const moitaNome = moitaId ? selectMoita.options[selectMoita.selectedIndex].text : null;
  const data = document.getElementById("data-colheita").value;
  const quantidade = document.getElementById("quantidade-colhida").value;
  try {
    await addDoc(collection(db, "usuarios", usuarioAtual.uid, "colheitas"), {
      moitaId: moitaId || null,
      moitaNome: moitaNome || null,
      data: data,
      quantidade: Number(quantidade),
      criadoEm: new Date()
    });
    alert("Colheita registrada com sucesso!");
    formColheita.reset();
    fecharModal("modal-colheita");
    await listarColheitas(usuarioAtual);
  } catch (erro) {
    console.error("Erro ao registrar colheita:", erro);
    alert("Erro ao registrar colheita");
  }
});