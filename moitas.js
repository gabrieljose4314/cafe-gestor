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

const form = document.getElementById("cadastro-moita-form");
const listaMoitas = document.getElementById("lista-moitas");
const listaProducao = document.getElementById("lista-producao");
const botaoSalvar = document.getElementById("btn-salvar-moita");
const tituloModal = document.getElementById("titulo-modal-moita");

// Elementos do layout desktop novo — checagem defensiva. O Relatório de
// Produção continua em modal (não migrou), só o cadastro+listagem simples
// ganhou o layout sem modal.
const formMoitaDesktop = document.getElementById("form-moita-desktop");
const botaoSalvarDesktop = document.getElementById("btn-salvar-moita-desktop");
const botaoCancelarMoitaDesktop = document.getElementById("btn-cancelar-moita-desktop");
const tabelaMoitasCorpo = document.getElementById("tabela-moitas-corpo");
const totalMoitasDesktopEl = document.getElementById("total-moitas-desktop");
const areaTotalMoitasDesktopEl = document.getElementById("area-total-moitas-desktop");
const pesquisaMoitaDesktop = document.getElementById("pesquisa-moita-desktop");

let usuarioAtual = null;
let moitaEmEdicaoId = null;
let todasAsMoitas = [];
let relatorioCarregado = false;

// ── Modal ─────────────────────────────────────────────────────────────────────
window.abrirModal  = id => document.getElementById(id).classList.add("aberto");
window.fecharModal = id => document.getElementById(id).classList.remove("aberto");

window.fecharModalMoita = function() {
  window.fecharModal("modal-moita");
  limparFormulario();
};

document.querySelectorAll(".modal-overlay").forEach(m => {
  m.addEventListener("click", e => {
    if (e.target === m) {
      if (m.id === "modal-moita") {
        window.fecharModalMoita();
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
function formatarMoeda(valor) {
  return Number(valor || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL"
  });
}
function textoNormalizado(texto) {
  return String(texto || "").trim().toLowerCase();
}
function pertenceAMoita(registro, moita) {
  const nomeMoita = textoNormalizado(moita.nome);
  return (
    registro.moitaId === moita.id ||
    textoNormalizado(registro.moitaNome) === nomeMoita ||
    textoNormalizado(registro.moita) === nomeMoita
  );
}

// ── Cadastro / edição de moita ─────────────────────────────────────────────────
function limparFormulario() {
  form.reset();
  moitaEmEdicaoId = null;
  botaoSalvar.textContent = "Cadastrar Moita";
  tituloModal.textContent = "🌱 Cadastrar Moita";
  limparFormularioDesktop();
}
function preencherFormulario(moita) {
  document.getElementById("nome-moita").value = moita.nome || "";
  document.getElementById("area-moita").value = moita.area || "";
  document.getElementById("quantidade-de-pes").value = moita.pes || "";
  document.getElementById("tipo-de-cafe").value = moita.tipo || "";
}

// Layout desktop novo — form sempre visível na tela, "editar" só troca
// o modo do form no lugar (sem abrir modal).
function limparFormularioDesktop() {
  if (!formMoitaDesktop) return;
  formMoitaDesktop.reset();
  if (botaoSalvarDesktop) botaoSalvarDesktop.textContent = "Cadastrar Moita";
  if (botaoCancelarMoitaDesktop) botaoCancelarMoitaDesktop.classList.add("oculto");
}
function preencherFormularioDesktop(moita) {
  document.getElementById("nome-moita-desktop").value = moita.nome || "";
  document.getElementById("area-moita-desktop").value = moita.area || "";
  document.getElementById("quantidade-de-pes-desktop").value = moita.pes || "";
  document.getElementById("tipo-de-cafe-desktop").value = moita.tipo || "";
}
if (botaoCancelarMoitaDesktop) {
  botaoCancelarMoitaDesktop.addEventListener("click", () => {
    moitaEmEdicaoId = null;
    limparFormularioDesktop();
  });
}

function criarCardMoita(moita) {
  const div = document.createElement("div");
  div.classList.add("card-moita");
  div.setAttribute("data-nome", (moita.nome || "").toLowerCase());
  div.innerHTML = `
    <p><strong>Nome:</strong> ${moita.nome}</p>
    <p><strong>Área:</strong> ${formatarNumero(moita.area)} ha</p>
    <p><strong>Quantidade de pés:</strong> ${formatarNumero(moita.pes, 0)}</p>
    <p><strong>Tipo de café:</strong> ${moita.tipo || "-"}</p>
    <button class="btn-editar-moita" data-id="${moita.id}">Editar</button>
    <button class="btn-excluir btn-excluir-moita" data-id="${moita.id}">Excluir</button>
  `;
  return div;
}

// ── Busca: Ver Moitas Cadastradas ──────────────────────────────────────────────
window.filtrarMoitas = function() {
  const termo = document.getElementById("pesquisa-moita").value.trim().toLowerCase();
  document.querySelectorAll("#lista-moitas .card-moita").forEach(card => {
    const nome = card.getAttribute("data-nome") || "";
    card.style.display = nome.includes(termo) ? "block" : "none";
  });
};

if (pesquisaMoitaDesktop) {
  pesquisaMoitaDesktop.addEventListener("input", () => {
    const termo = pesquisaMoitaDesktop.value.trim().toLowerCase();
    document.querySelectorAll("#tabela-moitas-corpo tr[data-nome]").forEach((linha) => {
      const nome = linha.getAttribute("data-nome") || "";
      linha.classList.toggle("linha-oculta", !nome.includes(termo));
    });
  });
}

// ── Busca: Relatório de Produção ───────────────────────────────────────────────
window.filtrarRelatorio = function() {
  const termo = document.getElementById("pesquisa-relatorio").value.trim().toLowerCase();
  document.querySelectorAll("#lista-producao .card-producao").forEach(card => {
    const nome = card.getAttribute("data-nome") || "";
    card.style.display = nome.includes(termo) ? "block" : "none";
  });
};

// ── Linha da tabela (desktop) ────────────────────────────────────────────────
function criarLinhaMoita(moita) {
  const tr = document.createElement("tr");
  tr.setAttribute("data-nome", (moita.nome || "").toLowerCase());
  tr.innerHTML = `
    <td>${moita.nome}</td>
    <td>${formatarNumero(moita.area)} ha</td>
    <td>${formatarNumero(moita.pes, 0)}</td>
    <td>${moita.tipo || "-"}</td>
    <td>
      <button class="btn-excluir-tabela btn-editar-moita-desktop" data-id="${moita.id}">Editar</button>
      <button class="btn-excluir-tabela btn-excluir-moita" data-id="${moita.id}">Excluir</button>
    </td>
  `;
  return tr;
}

// ── Listagem: Moitas cadastradas (CRUD) ────────────────────────────────────────
async function listarMoitas(user) {
  try {
    listaMoitas.innerHTML = "";
    if (tabelaMoitasCorpo) tabelaMoitasCorpo.innerHTML = "";
    todasAsMoitas = [];

    const snapshot = await getDocs(collection(db, "usuarios", user.uid, "moitas"));

    if (snapshot.empty) {
      listaMoitas.innerHTML = "<p>Nenhuma moita cadastrada.</p>";
      if (tabelaMoitasCorpo) {
        tabelaMoitasCorpo.innerHTML = '<tr class="tabela-vazio"><td colspan="5">Nenhuma moita cadastrada.</td></tr>';
      }
      if (totalMoitasDesktopEl) totalMoitasDesktopEl.textContent = "0";
      if (areaTotalMoitasDesktopEl) areaTotalMoitasDesktopEl.textContent = "0 ha";
      return;
    }

    snapshot.forEach((documento) => {
      todasAsMoitas.push({ id: documento.id, ...documento.data() });
    });
    todasAsMoitas.sort((a, b) => a.nome.localeCompare(b.nome));

    let areaTotalGeral = 0;

    todasAsMoitas.forEach((moita) => {
      listaMoitas.appendChild(criarCardMoita(moita));
      if (tabelaMoitasCorpo) tabelaMoitasCorpo.appendChild(criarLinhaMoita(moita));
      areaTotalGeral += Number(moita.area) || 0;
    });

    if (totalMoitasDesktopEl) totalMoitasDesktopEl.textContent = todasAsMoitas.length;
    if (areaTotalMoitasDesktopEl) areaTotalMoitasDesktopEl.textContent = `${formatarNumero(areaTotalGeral)} ha`;

    adicionarEventosEditar();
    adicionarEventosEditarDesktop();
    adicionarEventosExcluir();
  } catch (erro) {
    console.error("Erro ao listar moitas:", erro);
    listaMoitas.innerHTML = "<p>Erro ao carregar moitas.</p>";
    if (tabelaMoitasCorpo) {
      tabelaMoitasCorpo.innerHTML = '<tr class="tabela-vazio"><td colspan="5">Erro ao carregar moitas.</td></tr>';
    }
  }
}
function adicionarEventosEditar() {
  document.querySelectorAll(".btn-editar-moita").forEach((botao) => {
    botao.addEventListener("click", () => {
      const id = botao.getAttribute("data-id");
      const moita = todasAsMoitas.find((item) => item.id === id);
      if (!moita) return;
      moitaEmEdicaoId = id;
      preencherFormulario(moita);
      botaoSalvar.textContent = "Atualizar Moita";
      tituloModal.textContent = "✏️ Editar Moita";
      window.fecharModal("modal-ver-moitas");
      window.abrirModal("modal-moita");
    });
  });
}
function adicionarEventosEditarDesktop() {
  document.querySelectorAll(".btn-editar-moita-desktop").forEach((botao) => {
    botao.addEventListener("click", () => {
      const id = botao.getAttribute("data-id");
      const moita = todasAsMoitas.find((item) => item.id === id);
      if (!moita || !formMoitaDesktop) return;
      moitaEmEdicaoId = id;
      preencherFormularioDesktop(moita);
      if (botaoSalvarDesktop) botaoSalvarDesktop.textContent = "Atualizar Moita";
      if (botaoCancelarMoitaDesktop) botaoCancelarMoitaDesktop.classList.remove("oculto");
      formMoitaDesktop.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  });
}
function adicionarEventosExcluir() {
  document.querySelectorAll(".btn-excluir-moita").forEach((botao) => {
    botao.addEventListener("click", async () => {
      const id = botao.getAttribute("data-id");
      if (!confirm("Tem certeza que deseja excluir esta moita?")) return;
      try {
        await deleteDoc(doc(db, "usuarios", usuarioAtual.uid, "moitas", id));
        alert("Moita excluída com sucesso!");
        if (moitaEmEdicaoId === id) limparFormulario();
        await listarMoitas(usuarioAtual);
        relatorioCarregado = false;
      } catch (erro) {
        console.error("Erro ao excluir moita:", erro);
        alert("Erro ao excluir moita");
      }
    });
  });
}

// ── Relatório de produção ──────────────────────────────────────────────────────
function criarCardRelatorio(dados) {
  const div = document.createElement("div");
  div.classList.add("card-producao");
  div.setAttribute("data-nome", (dados.nome || "").toLowerCase());
  div.innerHTML = `
    <p><strong>Moita:</strong> ${dados.nome}</p>
    <p><strong>Área:</strong> ${formatarNumero(dados.area)} ha</p>
    <p><strong>Quantidade de pés:</strong> ${formatarNumero(dados.pes, 0)}</p>
    <hr>
    <h4>Produção</h4>
    <p><strong>Total colhido:</strong> ${formatarNumero(dados.totalColhido)} kg</p>
    <p><strong>Total colhido em sacas:</strong> ${formatarNumero(dados.totalSacas)} sacas</p>
    <p><strong>Produção por hectare:</strong> ${formatarNumero(dados.producaoPorHectare)} kg/ha</p>
    <p><strong>Produção por pé:</strong> ${formatarNumero(dados.producaoPorPe, 3)} kg/pé</p>
    <p><strong>Produção por 1000 pés:</strong> ${formatarNumero(dados.producaoPorMilPes)} kg</p>
    <hr>
    <h4>Financeiro</h4>
    <p><strong>Total gasto:</strong> ${formatarMoeda(dados.totalGasto)}</p>
    <p><strong>Total ganho:</strong> ${formatarMoeda(dados.totalGanho)}</p>
    <p><strong>Lucro:</strong> ${formatarMoeda(dados.lucro)}</p>
    <p><strong>Custo por saca:</strong> ${formatarMoeda(dados.custoPorSaca)}</p>
  `;
  return div;
}
async function carregarRelatorioProducao(user) {
  try {
    listaProducao.innerHTML = "<p>Carregando relatório...</p>";
    const moitasSnapshot    = await getDocs(collection(db, "usuarios", user.uid, "moitas"));
    const colheitasSnapshot = await getDocs(collection(db, "usuarios", user.uid, "colheitas"));
    const despesasSnapshot  = await getDocs(collection(db, "usuarios", user.uid, "despesas"));
    const vendasSnapshot    = await getDocs(collection(db, "usuarios", user.uid, "vendas"));

    const moitas = [];
    const colheitas = [];
    const despesas = [];
    const vendas = [];
    moitasSnapshot.forEach((d) => moitas.push({ id: d.id, ...d.data() }));
    colheitasSnapshot.forEach((d) => colheitas.push(d.data()));
    despesasSnapshot.forEach((d) => despesas.push(d.data()));
    vendasSnapshot.forEach((d) => vendas.push(d.data()));

    if (moitas.length === 0) {
      listaProducao.innerHTML = "<p>Nenhuma moita cadastrada.</p>";
      return;
    }

    const relatorio = moitas.map((moita) => {
      const colheitasDaMoita = colheitas.filter((c) => pertenceAMoita(c, moita));
      const despesasDaMoita  = despesas.filter((d) => pertenceAMoita(d, moita));
      const vendasDaMoita    = vendas.filter((v) => pertenceAMoita(v, moita));

      const totalColhido = colheitasDaMoita.reduce((s, c) => s + (Number(c.quantidade) || 0), 0);
      const totalGasto   = despesasDaMoita.reduce((s, d) => s + (Number(d.valor) || 0), 0);
      const totalGanho   = vendasDaMoita.reduce((s, v) => s + (Number(v.valorTotal) || 0), 0);

      const area = Number(moita.area) || 0;
      const pes  = Number(moita.pes) || 0;
      const totalSacas          = totalColhido > 0 ? totalColhido / 60 : 0;
      const producaoPorHectare  = area > 0 ? totalColhido / area : 0;
      const producaoPorPe       = pes > 0 ? totalColhido / pes : 0;
      const producaoPorMilPes   = pes > 0 ? (totalColhido / pes) * 1000 : 0;
      const lucro               = totalGanho - totalGasto;
      const custoPorSaca        = totalSacas > 0 && totalGasto > 0 ? totalGasto / totalSacas : 0;

      return {
        nome: moita.nome || "Sem nome",
        area, pes, totalColhido, totalSacas,
        producaoPorHectare, producaoPorPe, producaoPorMilPes,
        totalGasto, totalGanho, lucro, custoPorSaca
      };
    });

    relatorio.sort((a, b) => b.lucro - a.lucro);
    listaProducao.innerHTML = "";
    relatorio.forEach((item) => listaProducao.appendChild(criarCardRelatorio(item)));
  } catch (erro) {
    console.error("Erro ao carregar relatório de produção:", erro);
    listaProducao.innerHTML = "<p>Erro ao carregar relatório.</p>";
  }
}
window.abrirModalRelatorio = async function() {
  window.abrirModal("modal-relatorio");
  if (!relatorioCarregado) {
    await carregarRelatorioProducao(usuarioAtual);
    relatorioCarregado = true;
  }
};

// ── Início ────────────────────────────────────────────────────────────────────
(async function iniciar() {
  const resultado = await exigirUsuarioAprovado();
  if (!resultado) return;
  ativarTopbarDesktop(resultado.dados?.dados?.nome);
  const infoUsuario = resultado.dados;
  if (infoUsuario && infoUsuario.acesso && infoUsuario.acesso.plano === "basico") {
    const elHistorico = document.getElementById("historico") || document.getElementById("historico-moitas");
    const elCompanheiros = document.getElementById("companheiros") || document.getElementById("lista-companheiros");
    if (elHistorico) elHistorico.style.setProperty("display", "none", "important");
    if (elCompanheiros) elCompanheiros.style.setProperty("display", "none", "important");
  }
  usuarioAtual = resultado.user;
  await listarMoitas(usuarioAtual);
})();

// ── Formulário ────────────────────────────────────────────────────────────────
form.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!usuarioAtual) {
    alert("Usuário não autenticado");
    return;
  }
  const nome = document.getElementById("nome-moita").value;
  const area = document.getElementById("area-moita").value;
  const pes  = document.getElementById("quantidade-de-pes").value;
  const tipo = document.getElementById("tipo-de-cafe").value;
  try {
    if (moitaEmEdicaoId) {
      await updateDoc(doc(db, "usuarios", usuarioAtual.uid, "moitas", moitaEmEdicaoId), {
        nome, area: Number(area), pes: Number(pes), tipo
      });
      alert("Moita atualizada com sucesso!");
    } else {
      await addDoc(collection(db, "usuarios", usuarioAtual.uid, "moitas"), {
        nome, area: Number(area), pes: Number(pes), tipo, dataCriacao: new Date()
      });
      alert("Moita cadastrada com sucesso!");
    }
    window.fecharModalMoita();
    await listarMoitas(usuarioAtual);
    relatorioCarregado = false;
  } catch (erro) {
    console.error("Erro ao salvar moita:", erro);
    alert("Erro ao salvar moita");
  }
});

// Formulário do layout desktop novo — mesma lógica de cadastro/edição,
// sem modal.
if (formMoitaDesktop) {
  formMoitaDesktop.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!usuarioAtual) {
      alert("Usuário não autenticado");
      return;
    }
    const nome = document.getElementById("nome-moita-desktop").value;
    const area = document.getElementById("area-moita-desktop").value;
    const pes  = document.getElementById("quantidade-de-pes-desktop").value;
    const tipo = document.getElementById("tipo-de-cafe-desktop").value;
    try {
      if (moitaEmEdicaoId) {
        await updateDoc(doc(db, "usuarios", usuarioAtual.uid, "moitas", moitaEmEdicaoId), {
          nome, area: Number(area), pes: Number(pes), tipo
        });
        alert("Moita atualizada com sucesso!");
      } else {
        await addDoc(collection(db, "usuarios", usuarioAtual.uid, "moitas"), {
          nome, area: Number(area), pes: Number(pes), tipo, dataCriacao: new Date()
        });
        alert("Moita cadastrada com sucesso!");
      }
      moitaEmEdicaoId = null;
      limparFormularioDesktop();
      await listarMoitas(usuarioAtual);
      relatorioCarregado = false;
    } catch (erro) {
      console.error("Erro ao salvar moita:", erro);
      alert("Erro ao salvar moita");
    }
  });
}