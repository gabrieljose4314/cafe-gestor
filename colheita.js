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

const formColheita = document.getElementById("gerenciamento-colheita-form");
const selectMoita = document.getElementById("moita-colheita");
const listaColheitas = document.getElementById("lista-colheitas");
const botaoSalvarColheita = document.getElementById("btn-salvar-colheita");
const tituloModalColheita = document.getElementById("titulo-modal-colheita");

// Elementos do layout desktop novo — checagem defensiva, mesmo padrão
// já usado em vendas.js e despesas.js.
const formColheitaDesktop = document.getElementById("form-colheita-desktop");
const selectMoitaDesktop = document.getElementById("moita-colheita-desktop");
const tituloFormColheitaDesktop = document.getElementById("titulo-form-colheita-desktop");
const botaoSalvarColheitaDesktop = document.getElementById("btn-salvar-colheita-desktop");
const botaoCancelarColheitaDesktop = document.getElementById("btn-cancelar-colheita-desktop");
const tabelaColheitasCorpo = document.getElementById("tabela-colheitas-corpo");
const totalColheitasDesktopEl = document.getElementById("total-colheitas-desktop");
const totalKgColheitasDesktopEl = document.getElementById("total-kg-colheitas-desktop");
const pesquisaColheitaDesktop = document.getElementById("pesquisa-colheita-desktop");

let usuarioAtual = null;
let colheitaEmEdicaoId = null;
let todasAsColheitas = [];

// ── Modal ─────────────────────────────────────────────────────────────────────
window.abrirModal  = id => document.getElementById(id).classList.add("aberto");
window.fecharModal = id => document.getElementById(id).classList.remove("aberto");

window.fecharModalColheita = function() {
  window.fecharModal("modal-colheita");
  limparFormulario();
};

document.querySelectorAll(".modal-overlay").forEach(m => {
  m.addEventListener("click", e => {
    if (e.target === m) {
      if (m.id === "modal-colheita") {
        window.fecharModalColheita();
      } else {
        window.fecharModal(m.id);
      }
    }
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

if (pesquisaColheitaDesktop) {
  pesquisaColheitaDesktop.addEventListener("input", () => {
    const termo = pesquisaColheitaDesktop.value.trim().toLowerCase();
    document.querySelectorAll("#tabela-colheitas-corpo tr[data-nome]").forEach((linha) => {
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

// ── Cadastro / edição de colheita ───────────────────────────────────────────────
function limparFormulario() {
  formColheita.reset();
  colheitaEmEdicaoId = null;
  if (botaoSalvarColheita) botaoSalvarColheita.textContent = "Registrar Colheita";
  if (tituloModalColheita) tituloModalColheita.textContent = "🌾 Registrar Colheita";
  limparFormularioDesktop();
}
function preencherFormulario(colheita) {
  if (selectMoita) selectMoita.value = colheita.moitaId || "";
  document.getElementById("data-colheita").value = colheita.data || "";
  document.getElementById("quantidade-colhida").value = colheita.quantidade || "";
}

// Layout desktop novo — form sempre visível na tela, "editar" só troca
// o modo do form no lugar (sem abrir modal).
function limparFormularioDesktop() {
  if (!formColheitaDesktop) return;
  formColheitaDesktop.reset();
  if (tituloFormColheitaDesktop) tituloFormColheitaDesktop.textContent = "Registrar Colheita";
  if (botaoSalvarColheitaDesktop) botaoSalvarColheitaDesktop.textContent = "Registrar Colheita";
  if (botaoCancelarColheitaDesktop) botaoCancelarColheitaDesktop.classList.add("oculto");
}
function preencherFormularioDesktop(colheita) {
  if (selectMoitaDesktop) selectMoitaDesktop.value = colheita.moitaId || "";
  document.getElementById("data-colheita-desktop").value = colheita.data || "";
  document.getElementById("quantidade-colhida-desktop").value = colheita.quantidade || "";
}
if (botaoCancelarColheitaDesktop) {
  botaoCancelarColheitaDesktop.addEventListener("click", () => {
    colheitaEmEdicaoId = null;
    limparFormularioDesktop();
  });
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
    <button class="btn-editar-colheita" data-id="${id}">Editar</button>
    <button class="btn-excluir btn-excluir-colheita" data-id="${id}">Excluir</button>
  `;
  return div;
}

// ── Linha da tabela (desktop) ────────────────────────────────────────────────
function criarLinhaColheita(colheita, id) {
  const tr = document.createElement("tr");
  tr.setAttribute("data-nome", (colheita.moitaNome || "").toLowerCase());
  tr.innerHTML = `
    <td>${formatarDataBR(colheita.data)}</td>
    <td>${colheita.moitaNome || "Sem moita específica"}</td>
    <td>${formatarNumero(colheita.quantidade)} kg</td>
    <td>
      <button class="btn-excluir-tabela btn-editar-colheita-desktop" data-id="${id}">Editar</button>
      <button class="btn-excluir-tabela btn-excluir-colheita" data-id="${id}">Excluir</button>
    </td>
  `;
  return tr;
}

// ── Listagem ──────────────────────────────────────────────────────────────────
async function listarColheitas(user) {
  try {
    listaColheitas.innerHTML = "";
    if (tabelaColheitasCorpo) tabelaColheitasCorpo.innerHTML = "";
    todasAsColheitas = [];

    const snapshot = await getDocs(collection(db, "usuarios", user.uid, "colheitas"));

    if (snapshot.empty) {
      listaColheitas.innerHTML = "<p>Nenhuma colheita registrada.</p>";
      if (tabelaColheitasCorpo) {
        tabelaColheitasCorpo.innerHTML = '<tr class="tabela-vazio"><td colspan="4">Nenhuma colheita registrada.</td></tr>';
      }
      if (totalColheitasDesktopEl) totalColheitasDesktopEl.textContent = "0";
      if (totalKgColheitasDesktopEl) totalKgColheitasDesktopEl.textContent = "0 kg";
      return;
    }

    snapshot.forEach((documento) => {
      todasAsColheitas.push({ id: documento.id, ...documento.data() });
    });
    todasAsColheitas.sort((a, b) => new Date(b.data) - new Date(a.data));

    let totalKgGeral = 0;

    todasAsColheitas.forEach((colheita) => {
      listaColheitas.appendChild(criarCardColheita(colheita, colheita.id));
      if (tabelaColheitasCorpo) tabelaColheitasCorpo.appendChild(criarLinhaColheita(colheita, colheita.id));
      totalKgGeral += Number(colheita.quantidade) || 0;
    });

    if (totalColheitasDesktopEl) totalColheitasDesktopEl.textContent = todasAsColheitas.length;
    if (totalKgColheitasDesktopEl) totalKgColheitasDesktopEl.textContent = `${formatarNumero(totalKgGeral)} kg`;

    adicionarEventosEditar();
    adicionarEventosEditarDesktop();
    adicionarEventosExcluir();
  } catch (erro) {
    console.error("Erro ao listar colheitas:", erro);
    listaColheitas.innerHTML = "<p>Erro ao carregar colheitas.</p>";
    if (tabelaColheitasCorpo) {
      tabelaColheitasCorpo.innerHTML = '<tr class="tabela-vazio"><td colspan="4">Erro ao carregar colheitas.</td></tr>';
    }
  }
}
function adicionarEventosEditar() {
  document.querySelectorAll(".btn-editar-colheita").forEach((botao) => {
    botao.addEventListener("click", () => {
      const id = botao.getAttribute("data-id");
      const colheita = todasAsColheitas.find((item) => item.id === id);
      if (!colheita) return;
      colheitaEmEdicaoId = id;
      preencherFormulario(colheita);
      if (botaoSalvarColheita) botaoSalvarColheita.textContent = "Atualizar Colheita";
      if (tituloModalColheita) tituloModalColheita.textContent = "✏️ Editar Colheita";
      window.fecharModal("modal-ver-colheitas");
      window.abrirModal("modal-colheita");
    });
  });
}
function adicionarEventosEditarDesktop() {
  document.querySelectorAll(".btn-editar-colheita-desktop").forEach((botao) => {
    botao.addEventListener("click", () => {
      const id = botao.getAttribute("data-id");
      const colheita = todasAsColheitas.find((item) => item.id === id);
      if (!colheita || !formColheitaDesktop) return;
      colheitaEmEdicaoId = id;
      preencherFormularioDesktop(colheita);
      if (tituloFormColheitaDesktop) tituloFormColheitaDesktop.textContent = "Editar Colheita";
      if (botaoSalvarColheitaDesktop) botaoSalvarColheitaDesktop.textContent = "Atualizar Colheita";
      if (botaoCancelarColheitaDesktop) botaoCancelarColheitaDesktop.classList.remove("oculto");
      formColheitaDesktop.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  });
}
function adicionarEventosExcluir() {
  document.querySelectorAll(".btn-excluir-colheita").forEach((botao) => {
    botao.addEventListener("click", async () => {
      const id = botao.getAttribute("data-id");
      if (!confirm("Tem certeza que deseja excluir esta colheita?")) return;
      try {
        await deleteDoc(doc(db, "usuarios", usuarioAtual.uid, "colheitas", id));
        alert("Colheita excluída com sucesso!");
        if (colheitaEmEdicaoId === id) limparFormulario();
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
  ativarTopbarDesktop(resultado.dados?.dados?.nome);
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
    if (colheitaEmEdicaoId) {
      await updateDoc(doc(db, "usuarios", usuarioAtual.uid, "colheitas", colheitaEmEdicaoId), {
        moitaId: moitaId || null,
        moitaNome: moitaNome || null,
        data: data,
        quantidade: Number(quantidade)
      });
      alert("Colheita atualizada com sucesso!");
    } else {
      await addDoc(collection(db, "usuarios", usuarioAtual.uid, "colheitas"), {
        moitaId: moitaId || null,
        moitaNome: moitaNome || null,
        data: data,
        quantidade: Number(quantidade),
        criadoEm: new Date()
      });
      alert("Colheita registrada com sucesso!");
    }
    window.fecharModalColheita();
    await listarColheitas(usuarioAtual);
  } catch (erro) {
    console.error("Erro ao salvar colheita:", erro);
    alert("Erro ao salvar colheita");
  }
});

// Formulário do layout desktop novo — mesma lógica de cadastro, sem modal.
if (formColheitaDesktop) {
  formColheitaDesktop.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!usuarioAtual) {
      alert("Usuário não autenticado");
      return;
    }
    const moitaId = selectMoitaDesktop.value;
    const moitaNome = moitaId ? selectMoitaDesktop.options[selectMoitaDesktop.selectedIndex].text : null;
    const data = document.getElementById("data-colheita-desktop").value;
    const quantidade = document.getElementById("quantidade-colhida-desktop").value;
    try {
      if (colheitaEmEdicaoId) {
        await updateDoc(doc(db, "usuarios", usuarioAtual.uid, "colheitas", colheitaEmEdicaoId), {
          moitaId: moitaId || null,
          moitaNome: moitaNome || null,
          data: data,
          quantidade: Number(quantidade)
        });
        alert("Colheita atualizada com sucesso!");
      } else {
        await addDoc(collection(db, "usuarios", usuarioAtual.uid, "colheitas"), {
          moitaId: moitaId || null,
          moitaNome: moitaNome || null,
          data: data,
          quantidade: Number(quantidade),
          criadoEm: new Date()
        });
        alert("Colheita registrada com sucesso!");
      }
      colheitaEmEdicaoId = null;
      limparFormularioDesktop();
      await listarColheitas(usuarioAtual);
    } catch (erro) {
      console.error("Erro ao salvar colheita:", erro);
      alert("Erro ao salvar colheita");
    }
  });
}