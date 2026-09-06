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

const formDespesa = document.getElementById("gerenciamento-despesas-form");
const selectMoita = document.getElementById("moita-despesa");
const listaDespesas = document.getElementById("lista-despesas");
const botaoSalvarDespesa = document.getElementById("btn-salvar-despesa");
const tituloModalDespesa = document.getElementById("titulo-modal-despesa");

// Elementos do layout desktop novo — todos tratados com checagem
// defensiva, igual ao padrão já usado em vendas.js.
const formDespesaDesktop = document.getElementById("form-despesa-desktop");
const selectMoitaDesktop = document.getElementById("moita-despesa-desktop");
const tituloFormDespesaDesktop = document.getElementById("titulo-form-despesa-desktop");
const botaoSalvarDespesaDesktop = document.getElementById("btn-salvar-despesa-desktop");
const botaoCancelarDespesaDesktop = document.getElementById("btn-cancelar-despesa-desktop");
const tabelaDespesasCorpo = document.getElementById("tabela-despesas-corpo");
const totalDespesasDesktopEl = document.getElementById("total-despesas-desktop");
const valorTotalDespesasDesktopEl = document.getElementById("valor-total-despesas-desktop");
const pesquisaDespesaDesktop = document.getElementById("pesquisa-despesa-desktop");

let usuarioAtual = null;
let despesaEmEdicaoId = null;
let todasAsDespesas = [];

// ── Modal ─────────────────────────────────────────────────────────────────────
window.abrirModal  = id => document.getElementById(id).classList.add("aberto");
window.fecharModal = id => document.getElementById(id).classList.remove("aberto");

window.fecharModalDespesa = function() {
  window.fecharModal("modal-despesa");
  limparFormulario();
};

document.querySelectorAll(".modal-overlay").forEach(m => {
  m.addEventListener("click", e => {
    if (e.target === m) {
      if (m.id === "modal-despesa") {
        window.fecharModalDespesa();
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
function formatarDataBR(data) {
  if (!data) return "-";
  const partes = data.split("-");
  if (partes.length !== 3) return data;
  return `${partes[2]}/${partes[1]}/${partes[0]}`;
}

// ── Busca ─────────────────────────────────────────────────────────────────────
window.filtrarDespesas = function() {
  const termo = document.getElementById("pesquisa-despesa").value.trim().toLowerCase();
  document.querySelectorAll("#lista-despesas .card-despesa").forEach(card => {
    const texto = card.getAttribute("data-busca") || "";
    card.style.display = texto.includes(termo) ? "block" : "none";
  });
};

if (pesquisaDespesaDesktop) {
  pesquisaDespesaDesktop.addEventListener("input", () => {
    const termo = pesquisaDespesaDesktop.value.trim().toLowerCase();
    document.querySelectorAll("#tabela-despesas-corpo tr[data-busca]").forEach((linha) => {
      const texto = linha.getAttribute("data-busca") || "";
      linha.classList.toggle("linha-oculta", !texto.includes(termo));
    });
  });
}

// ── Carregar moitas no select ───────────────────────────────────────────────────
async function carregarMoitas(user) {
  try {
    if (!selectMoita) {
      console.error("Select de moita não encontrado.");
      return;
    }
    const opcaoPadrao = '<option value="">Sem moita específica</option>';
    selectMoita.innerHTML = opcaoPadrao;
    if (selectMoitaDesktop) selectMoitaDesktop.innerHTML = opcaoPadrao;

    const snapshot = await getDocs(collection(db, "usuarios", user.uid, "moitas"));
    snapshot.forEach((documento) => {
      const moita = documento.data();
      const option = document.createElement("option");
      option.value = documento.id;
      option.textContent = moita.nome || "Moita sem nome";
      selectMoita.appendChild(option);

      if (selectMoitaDesktop) {
        const optionDesktop = document.createElement("option");
        optionDesktop.value = documento.id;
        optionDesktop.textContent = moita.nome || "Moita sem nome";
        selectMoitaDesktop.appendChild(optionDesktop);
      }
    });
  } catch (erro) {
    console.error("Erro ao carregar moitas:", erro);
    alert("Erro ao carregar moitas");
  }
}

// ── Cadastro / edição de despesa ────────────────────────────────────────────────
function limparFormulario() {
  formDespesa.reset();
  despesaEmEdicaoId = null;
  if (botaoSalvarDespesa) botaoSalvarDespesa.textContent = "Cadastrar Despesa";
  if (tituloModalDespesa) tituloModalDespesa.textContent = "💸 Cadastrar Despesa";
  limparFormularioDesktop();
}
function preencherFormulario(despesa) {
  if (selectMoita) selectMoita.value = despesa.moitaId || "";
  const radio = document.querySelector(`input[name="categoria-despesa"][value="${despesa.categoria}"]`);
  if (radio) radio.checked = true;
  document.getElementById("descricao-despesa").value = despesa.descricao || "";
  document.getElementById("valor-despesa").value = despesa.valor || "";
  document.getElementById("data-despesa").value = despesa.data || "";
}

// Layout desktop novo — form sempre visível na tela, "editar" só troca
// o modo do form no lugar (sem abrir modal).
function limparFormularioDesktop() {
  if (!formDespesaDesktop) return;
  formDespesaDesktop.reset();
  if (tituloFormDespesaDesktop) tituloFormDespesaDesktop.textContent = "Cadastrar Despesa";
  if (botaoSalvarDespesaDesktop) botaoSalvarDespesaDesktop.textContent = "Cadastrar Despesa";
  if (botaoCancelarDespesaDesktop) botaoCancelarDespesaDesktop.classList.add("oculto");
}
function preencherFormularioDesktop(despesa) {
  if (selectMoitaDesktop) selectMoitaDesktop.value = despesa.moitaId || "";
  const categoriaSelect = document.getElementById("categoria-despesa-desktop");
  if (categoriaSelect) categoriaSelect.value = despesa.categoria || "";
  document.getElementById("descricao-despesa-desktop").value = despesa.descricao || "";
  document.getElementById("valor-despesa-desktop").value = despesa.valor || "";
  document.getElementById("data-despesa-desktop").value = despesa.data || "";
}
if (botaoCancelarDespesaDesktop) {
  botaoCancelarDespesaDesktop.addEventListener("click", () => {
    despesaEmEdicaoId = null;
    limparFormularioDesktop();
  });
}

// ── Cards ─────────────────────────────────────────────────────────────────────
function criarCardDespesa(despesa, id) {
  const div = document.createElement("div");
  div.classList.add("card-despesa");
  const textoBusca = [despesa.categoria, despesa.moitaNome, despesa.descricao]
    .filter(Boolean).join(" ").toLowerCase();
  div.setAttribute("data-busca", textoBusca);
  div.innerHTML = `
    <p><strong>Moita:</strong> ${despesa.moitaNome || "Sem moita específica"}</p>
    <p><strong>Categoria:</strong> ${despesa.categoria || "-"}</p>
    <p><strong>Descrição:</strong> ${despesa.descricao || "-"}</p>
    <p><strong>Valor:</strong> ${formatarMoeda(despesa.valor)}</p>
    <p><strong>Data:</strong> ${formatarDataBR(despesa.data)}</p>
    <button class="btn-editar-despesa" data-id="${id}">Editar</button>
    <button class="btn-excluir btn-excluir-despesa" data-id="${id}">Excluir</button>
  `;
  return div;
}

// ── Linha da tabela (desktop) ────────────────────────────────────────────────
function criarLinhaDespesa(despesa, id) {
  const tr = document.createElement("tr");
  const textoBusca = [despesa.categoria, despesa.moitaNome, despesa.descricao]
    .filter(Boolean).join(" ").toLowerCase();
  tr.setAttribute("data-busca", textoBusca);
  tr.innerHTML = `
    <td>${formatarDataBR(despesa.data)}</td>
    <td>${despesa.categoria || "-"}</td>
    <td>${despesa.moitaNome || "Sem moita específica"}</td>
    <td>${despesa.descricao || "-"}</td>
    <td>${formatarMoeda(despesa.valor)}</td>
    <td>
      <button class="btn-excluir-tabela btn-editar-despesa-desktop" data-id="${id}">Editar</button>
      <button class="btn-excluir-tabela btn-excluir-despesa" data-id="${id}">Excluir</button>
    </td>
  `;
  return tr;
}

// ── Listagem ──────────────────────────────────────────────────────────────────
async function listarDespesas(user) {
  try {
    listaDespesas.innerHTML = "";
    if (tabelaDespesasCorpo) tabelaDespesasCorpo.innerHTML = "";
    todasAsDespesas = [];

    const snapshot = await getDocs(collection(db, "usuarios", user.uid, "despesas"));

    if (snapshot.empty) {
      listaDespesas.innerHTML = "<p>Nenhuma despesa registrada.</p>";
      if (tabelaDespesasCorpo) {
        tabelaDespesasCorpo.innerHTML = '<tr class="tabela-vazio"><td colspan="6">Nenhuma despesa registrada.</td></tr>';
      }
      if (totalDespesasDesktopEl) totalDespesasDesktopEl.textContent = "0";
      if (valorTotalDespesasDesktopEl) valorTotalDespesasDesktopEl.textContent = formatarMoeda(0);
      return;
    }

    snapshot.forEach((documento) => {
      todasAsDespesas.push({ id: documento.id, ...documento.data() });
    });
    todasAsDespesas.sort((a, b) => new Date(b.data) - new Date(a.data));

    let valorTotalGeral = 0;

    todasAsDespesas.forEach((despesa) => {
      listaDespesas.appendChild(criarCardDespesa(despesa, despesa.id));
      if (tabelaDespesasCorpo) tabelaDespesasCorpo.appendChild(criarLinhaDespesa(despesa, despesa.id));
      valorTotalGeral += Number(despesa.valor) || 0;
    });

    if (totalDespesasDesktopEl) totalDespesasDesktopEl.textContent = todasAsDespesas.length;
    if (valorTotalDespesasDesktopEl) valorTotalDespesasDesktopEl.textContent = formatarMoeda(valorTotalGeral);

    adicionarEventosEditar();
    adicionarEventosEditarDesktop();
    adicionarEventosExcluir();
  } catch (erro) {
    console.error("Erro ao listar despesas:", erro);
    listaDespesas.innerHTML = "<p>Erro ao carregar despesas.</p>";
    if (tabelaDespesasCorpo) {
      tabelaDespesasCorpo.innerHTML = '<tr class="tabela-vazio"><td colspan="6">Erro ao carregar despesas.</td></tr>';
    }
  }
}
function adicionarEventosEditar() {
  document.querySelectorAll(".btn-editar-despesa").forEach((botao) => {
    botao.addEventListener("click", () => {
      const id = botao.getAttribute("data-id");
      const despesa = todasAsDespesas.find((item) => item.id === id);
      if (!despesa) return;
      despesaEmEdicaoId = id;
      preencherFormulario(despesa);
      if (botaoSalvarDespesa) botaoSalvarDespesa.textContent = "Atualizar Despesa";
      if (tituloModalDespesa) tituloModalDespesa.textContent = "✏️ Editar Despesa";
      window.fecharModal("modal-ver-despesas");
      window.abrirModal("modal-despesa");
    });
  });
}
function adicionarEventosEditarDesktop() {
  document.querySelectorAll(".btn-editar-despesa-desktop").forEach((botao) => {
    botao.addEventListener("click", () => {
      const id = botao.getAttribute("data-id");
      const despesa = todasAsDespesas.find((item) => item.id === id);
      if (!despesa || !formDespesaDesktop) return;
      despesaEmEdicaoId = id;
      preencherFormularioDesktop(despesa);
      if (tituloFormDespesaDesktop) tituloFormDespesaDesktop.textContent = "Editar Despesa";
      if (botaoSalvarDespesaDesktop) botaoSalvarDespesaDesktop.textContent = "Atualizar Despesa";
      if (botaoCancelarDespesaDesktop) botaoCancelarDespesaDesktop.classList.remove("oculto");
      formDespesaDesktop.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  });
}
function adicionarEventosExcluir() {
  document.querySelectorAll(".btn-excluir-despesa").forEach((botao) => {
    botao.addEventListener("click", async () => {
      const id = botao.getAttribute("data-id");
      if (!confirm("Tem certeza que deseja excluir esta despesa?")) return;
      try {
        await deleteDoc(doc(db, "usuarios", usuarioAtual.uid, "despesas", id));
        alert("Despesa excluída com sucesso!");
        if (despesaEmEdicaoId === id) limparFormulario();
        await listarDespesas(usuarioAtual);
      } catch (erro) {
        console.error("Erro ao excluir despesa:", erro);
        alert("Erro ao excluir despesa");
      }
    });
  });
}

// ── Início ────────────────────────────────────────────────────────────────────
(async function iniciarDespesas() {
  const resultado = await exigirUsuarioAprovado();
  if (!resultado) return;
  ativarTopbarDesktop(resultado.dados?.dados?.nome);
  usuarioAtual = resultado.user;
  await carregarMoitas(usuarioAtual);
  await listarDespesas(usuarioAtual);
})();

// ── Formulário ────────────────────────────────────────────────────────────────
formDespesa.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!usuarioAtual) {
    alert("Usuário não autenticado");
    return;
  }
  const categoriaSelecionada = document.querySelector('input[name="categoria-despesa"]:checked');
  if (!categoriaSelecionada) {
    alert("Selecione uma categoria");
    return;
  }
  const moitaId = selectMoita?.value || "";
  const moitaNome = moitaId ? selectMoita.options[selectMoita.selectedIndex].text : null;
  const categoria = categoriaSelecionada.value;
  const descricao = document.getElementById("descricao-despesa").value;
  const valor = document.getElementById("valor-despesa").value;
  const data = document.getElementById("data-despesa").value;
  try {
    if (despesaEmEdicaoId) {
      await updateDoc(doc(db, "usuarios", usuarioAtual.uid, "despesas", despesaEmEdicaoId), {
        moitaId: moitaId || null,
        moitaNome: moitaNome || null,
        categoria: categoria,
        descricao: descricao,
        valor: Number(valor),
        data: data
      });
      alert("Despesa atualizada com sucesso!");
    } else {
      await addDoc(collection(db, "usuarios", usuarioAtual.uid, "despesas"), {
        moitaId: moitaId || null,
        moitaNome: moitaNome || null,
        categoria: categoria,
        descricao: descricao,
        valor: Number(valor),
        data: data,
        criadoEm: new Date()
      });
      alert("Despesa cadastrada com sucesso!");
    }
    window.fecharModalDespesa();
    await listarDespesas(usuarioAtual);
  } catch (erro) {
    console.error("Erro ao salvar despesa:", erro);
    alert("Erro ao salvar despesa");
  }
});

// Formulário do layout desktop novo — mesma lógica de cadastro do form
// mobile, só que sem modal e com um <select> de categoria no lugar dos
// radio buttons (por isso não reaproveita a leitura de input:checked).
if (formDespesaDesktop) {
  formDespesaDesktop.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!usuarioAtual) {
      alert("Usuário não autenticado");
      return;
    }
    const categoriaSelect = document.getElementById("categoria-despesa-desktop");
    const categoria = categoriaSelect ? categoriaSelect.value : "";
    if (!categoria) {
      alert("Selecione uma categoria");
      return;
    }
    const moitaId = selectMoitaDesktop?.value || "";
    const moitaNome = moitaId ? selectMoitaDesktop.options[selectMoitaDesktop.selectedIndex].text : null;
    const descricao = document.getElementById("descricao-despesa-desktop").value;
    const valor = document.getElementById("valor-despesa-desktop").value;
    const data = document.getElementById("data-despesa-desktop").value;
    try {
      if (despesaEmEdicaoId) {
        await updateDoc(doc(db, "usuarios", usuarioAtual.uid, "despesas", despesaEmEdicaoId), {
          moitaId: moitaId || null,
          moitaNome: moitaNome || null,
          categoria: categoria,
          descricao: descricao,
          valor: Number(valor),
          data: data
        });
        alert("Despesa atualizada com sucesso!");
      } else {
        await addDoc(collection(db, "usuarios", usuarioAtual.uid, "despesas"), {
          moitaId: moitaId || null,
          moitaNome: moitaNome || null,
          categoria: categoria,
          descricao: descricao,
          valor: Number(valor),
          data: data,
          criadoEm: new Date()
        });
        alert("Despesa cadastrada com sucesso!");
      }
      despesaEmEdicaoId = null;
      limparFormularioDesktop();
      await listarDespesas(usuarioAtual);
    } catch (erro) {
      console.error("Erro ao salvar despesa:", erro);
      alert("Erro ao salvar despesa");
    }
  });
}