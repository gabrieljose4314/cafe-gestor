import { db } from "./firebase.js";
import { exigirUsuarioAprovado } from "./acesso.js";

import {
  collection,
  addDoc,
  getDocs,
  doc,
  updateDoc,
  deleteDoc
} from "https://www.gstatic.com/firebasejs/12.10.0/firebase-firestore.js";

const formCompanheiro = document.getElementById("cadastro-companheiro-form");
const formTrabalho = document.getElementById("registro-trabalho-form");

const selectCompanheiro = document.getElementById("companheiro-trabalho");
const selectMoita = document.getElementById("moita-trabalho");

const listaCompanheiros = document.getElementById("lista-companheiros");
const listaPendentes = document.getElementById("lista-pendentes");
const listaPagos = document.getElementById("lista-pagos");

const totalPendenteEl = document.getElementById("total-pendente");
const totalPagoEl = document.getElementById("total-pago");

const inputPesquisa = document.getElementById("pesquisa-companheiro");

let usuarioAtual = null;
let todosOsTrabalhos = [];
let todosOsCompanheiros = [];

function formatarMoeda(valor) {
  return Number(valor || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL"
  });
}

function obterDataHoje() {
  const hoje = new Date();
  const ano = hoje.getFullYear();
  const mes = String(hoje.getMonth() + 1).padStart(2, "0");
  const dia = String(hoje.getDate()).padStart(2, "0");
  return `${ano}-${mes}-${dia}`;
}

function formatarDataBR(data) {
  if (!data) return "-";

  const partes = data.split("-");
  if (partes.length !== 3) return data;

  return `${partes[2]}/${partes[1]}/${partes[0]}`;
}

async function lancarDespesaDePagamento(trabalho, dataPagamento) {
  const despesaRef = await addDoc(
    collection(db, "usuarios", usuarioAtual.uid, "despesas"),
    {
      categoria: "Mão de Obra",
      descricao: `Pagamento para ${trabalho.companheiroNome} - ${trabalho.servico}`,
      valor: Number(trabalho.valor) || 0,
      data: dataPagamento,
      moitaId: trabalho.moitaId || null,
      moitaNome: trabalho.moitaNome || null,
      criadoEm: new Date()
    }
  );

  return despesaRef.id;
}

function criarCardTrabalho(trabalho, trabalhoId) {
  const valor = Number(trabalho.valor) || 0;
  const estaPago = trabalho.statusPagamento === "pago";

  const div = document.createElement("div");
  div.innerHTML = `
    <p><strong>Companheiro:</strong> ${trabalho.companheiroNome}</p>
    <p><strong>Telefone:</strong> ${trabalho.companheiroTelefone || "-"}</p>
    <p><strong>Moita:</strong> ${trabalho.moitaNome || "Sem moita específica"}</p>
    <p><strong>Data do trabalho:</strong> ${formatarDataBR(trabalho.data)}</p>
    <p><strong>Serviço:</strong> ${trabalho.servico}</p>
    <p><strong>Valor:</strong> ${formatarMoeda(valor)}</p>
    <p><strong>Status:</strong> ${estaPago ? "Pago" : "Pendente"}</p>
    <p><strong>Data do pagamento:</strong> ${formatarDataBR(trabalho.dataPagamento)}</p>
    <p><strong>Observação:</strong> ${trabalho.observacao || "-"}</p>
    ${
      !estaPago
        ? `<button data-id="${trabalhoId}" class="btn-marcar-pago">Marcar como pago</button>`
        : `<button data-id="${trabalhoId}" class="btn-voltar-pendente">Voltar para pendente</button>`
    }
    <button data-id="${trabalhoId}" class="btn-excluir-trabalho">Excluir</button>
  `;

  return div;
}

function renderizarListaCompanheiros() {
  listaCompanheiros.innerHTML = "";

  if (todosOsCompanheiros.length === 0) {
    listaCompanheiros.innerHTML = "<p>Nenhum companheiro cadastrado.</p>";
    return;
  }

  todosOsCompanheiros.forEach((companheiro) => {
    const div = document.createElement("div");
    div.innerHTML = `
      <p><strong>Nome:</strong> ${companheiro.nome}</p>
      <p><strong>Telefone:</strong> ${companheiro.telefone || "-"}</p>
      <p><strong>Observação:</strong> ${companheiro.observacao || "-"}</p>
      <button data-id="${companheiro.id}" class="btn-excluir-companheiro">Excluir companheiro</button>
    `;

    listaCompanheiros.appendChild(div);
  });

  adicionarEventosBotoesExcluirCompanheiro();
}

async function carregarCompanheiros(user) {
  try {
    selectCompanheiro.innerHTML = '<option value="">Selecione um companheiro</option>';
    todosOsCompanheiros = [];

    const snapshot = await getDocs(
      collection(db, "usuarios", user.uid, "companheiros")
    );

    snapshot.forEach((documento) => {
      const companheiro = {
        id: documento.id,
        ...documento.data()
      };

      todosOsCompanheiros.push(companheiro);

      const option = document.createElement("option");
      option.value = documento.id;
      option.textContent = companheiro.nome;

      selectCompanheiro.appendChild(option);
    });

    renderizarListaCompanheiros();
  } catch (erro) {
    console.error("Erro ao carregar companheiros:", erro);
  }
}

async function carregarMoitas(user) {
  try {
    selectMoita.innerHTML = '<option value="">Sem moita específica</option>';

    const snapshot = await getDocs(
      collection(db, "usuarios", user.uid, "moitas")
    );

    snapshot.forEach((documento) => {
      const moita = documento.data();

      const option = document.createElement("option");
      option.value = documento.id;
      option.textContent = moita.nome;

      selectMoita.appendChild(option);
    });
  } catch (erro) {
    console.error("Erro ao carregar moitas:", erro);
  }
}

async function buscarTrabalhos(user) {
  try {
    const snapshot = await getDocs(
      collection(db, "usuarios", user.uid, "trabalhosCompanheiros")
    );

    todosOsTrabalhos = [];

    snapshot.forEach((documento) => {
      todosOsTrabalhos.push({
        id: documento.id,
        ...documento.data()
      });
    });

    renderizarTrabalhos();
  } catch (erro) {
    console.error("Erro ao buscar trabalhos:", erro);
  }
}

function ordenarPendentes(lista) {
  return lista.sort((a, b) => {
    const dataA = new Date(a.data || "1900-01-01");
    const dataB = new Date(b.data || "1900-01-01");
    return dataB - dataA;
  });
}

function ordenarPagos(lista) {
  return lista.sort((a, b) => {
    const dataA = new Date(a.dataPagamento || "1900-01-01");
    const dataB = new Date(b.dataPagamento || "1900-01-01");
    return dataB - dataA;
  });
}

function renderizarTrabalhos() {
  listaPendentes.innerHTML = "";
  listaPagos.innerHTML = "";

  let totalPendente = 0;
  let totalPago = 0;

  const termoPesquisa = inputPesquisa.value.trim().toLowerCase();

  const trabalhosFiltrados = todosOsTrabalhos.filter((trabalho) => {
    const nome = (trabalho.companheiroNome || "").toLowerCase();
    return nome.includes(termoPesquisa);
  });

  const pendentes = ordenarPendentes(
    trabalhosFiltrados.filter((trabalho) => trabalho.statusPagamento === "pendente")
  );

  const pagos = ordenarPagos(
    trabalhosFiltrados.filter((trabalho) => trabalho.statusPagamento === "pago")
  );

  if (pendentes.length === 0) {
    listaPendentes.innerHTML = "<p>Nenhum pagamento pendente encontrado.</p>";
  } else {
    pendentes.forEach((trabalho) => {
      totalPendente += Number(trabalho.valor) || 0;
      const card = criarCardTrabalho(trabalho, trabalho.id);
      listaPendentes.appendChild(card);
    });
  }

  if (pagos.length === 0) {
    listaPagos.innerHTML = "<p>Nenhum pagamento realizado encontrado.</p>";
  } else {
    pagos.forEach((trabalho) => {
      totalPago += Number(trabalho.valor) || 0;
      const card = criarCardTrabalho(trabalho, trabalho.id);
      listaPagos.appendChild(card);
    });
  }

  totalPendenteEl.textContent = formatarMoeda(totalPendente);
  totalPagoEl.textContent = formatarMoeda(totalPago);

  adicionarEventosBotoesPagamento();
  adicionarEventosBotoesVoltarPendente();
  adicionarEventosBotoesExcluirTrabalho();
}

function adicionarEventosBotoesPagamento() {
  const botoes = document.querySelectorAll(".btn-marcar-pago");

  botoes.forEach((botao) => {
    botao.addEventListener("click", async () => {
      const trabalhoId = botao.getAttribute("data-id");

      try {
        const trabalho = todosOsTrabalhos.find((item) => item.id === trabalhoId);

        if (!trabalho) {
          alert("Trabalho não encontrado.");
          return;
        }

        if (trabalho.lancadoComoDespesa || trabalho.despesaId) {
          alert("Este pagamento já foi lançado nas despesas.");
          return;
        }

        const dataPagamento = obterDataHoje();
        const despesaId = await lancarDespesaDePagamento(trabalho, dataPagamento);

        const ref = doc(db, "usuarios", usuarioAtual.uid, "trabalhosCompanheiros", trabalhoId);

        await updateDoc(ref, {
          statusPagamento: "pago",
          dataPagamento: dataPagamento,
          lancadoComoDespesa: true,
          despesaId: despesaId
        });

        alert("Pagamento marcado como pago e lançado nas despesas!");
        await buscarTrabalhos(usuarioAtual);

      } catch (erro) {
        console.error("Erro ao atualizar pagamento:", erro);
        alert("Erro ao atualizar pagamento");
      }
    });
  });
}

function adicionarEventosBotoesVoltarPendente() {
  const botoes = document.querySelectorAll(".btn-voltar-pendente");

  botoes.forEach((botao) => {
    botao.addEventListener("click", async () => {
      const trabalhoId = botao.getAttribute("data-id");

      const confirmar = confirm("Tem certeza que deseja voltar este pagamento para pendente?");
      if (!confirmar) return;

      try {
        const trabalho = todosOsTrabalhos.find((item) => item.id === trabalhoId);

        if (!trabalho) {
          alert("Trabalho não encontrado.");
          return;
        }

        if (trabalho.despesaId) {
          const despesaRef = doc(db, "usuarios", usuarioAtual.uid, "despesas", trabalho.despesaId);
          await deleteDoc(despesaRef);
        }

        const ref = doc(db, "usuarios", usuarioAtual.uid, "trabalhosCompanheiros", trabalhoId);

        await updateDoc(ref, {
          statusPagamento: "pendente",
          dataPagamento: null,
          lancadoComoDespesa: false,
          despesaId: null
        });

        alert("Pagamento voltou para pendente com sucesso!");
        await buscarTrabalhos(usuarioAtual);

      } catch (erro) {
        console.error("Erro ao voltar pagamento para pendente:", erro);
        alert("Erro ao voltar pagamento para pendente");
      }
    });
  });
}

function adicionarEventosBotoesExcluirTrabalho() {
  const botoes = document.querySelectorAll(".btn-excluir-trabalho");

  botoes.forEach((botao) => {
    botao.addEventListener("click", async () => {
      const trabalhoId = botao.getAttribute("data-id");

      const confirmar = confirm("Tem certeza que deseja excluir este registro?");
      if (!confirmar) return;

      try {
        const trabalho = todosOsTrabalhos.find((item) => item.id === trabalhoId);

        if (trabalho?.despesaId) {
          const despesaRef = doc(db, "usuarios", usuarioAtual.uid, "despesas", trabalho.despesaId);
          await deleteDoc(despesaRef);
        }

        const ref = doc(db, "usuarios", usuarioAtual.uid, "trabalhosCompanheiros", trabalhoId);
        await deleteDoc(ref);

        alert("Registro excluído com sucesso!");
        await buscarTrabalhos(usuarioAtual);

      } catch (erro) {
        console.error("Erro ao excluir registro:", erro);
        alert("Erro ao excluir registro");
      }
    });
  });
}

function adicionarEventosBotoesExcluirCompanheiro() {
  const botoes = document.querySelectorAll(".btn-excluir-companheiro");

  botoes.forEach((botao) => {
    botao.addEventListener("click", async () => {
      const companheiroId = botao.getAttribute("data-id");

      const companheiroTemTrabalho = todosOsTrabalhos.some(
        (trabalho) => trabalho.companheiroId === companheiroId
      );

      if (companheiroTemTrabalho) {
        alert("Não é possível excluir este companheiro porque ele possui trabalhos cadastrados.");
        return;
      }

      const confirmar = confirm("Tem certeza que deseja excluir este companheiro?");
      if (!confirmar) return;

      try {
        const ref = doc(db, "usuarios", usuarioAtual.uid, "companheiros", companheiroId);

        await deleteDoc(ref);

        alert("Companheiro excluído com sucesso!");
        await carregarCompanheiros(usuarioAtual);

      } catch (erro) {
        console.error("Erro ao excluir companheiro:", erro);
        alert("Erro ao excluir companheiro");
      }
    });
  });
}

(async function iniciarCompanheiros() {
  const resultado = await exigirUsuarioAprovado();
  if (!resultado) return;

  usuarioAtual = resultado.user;

  await carregarCompanheiros(usuarioAtual);
  await carregarMoitas(usuarioAtual);
  await buscarTrabalhos(usuarioAtual);
})();

formCompanheiro.addEventListener("submit", async (e) => {
  e.preventDefault();

  if (!usuarioAtual) return;

  const nome = document.getElementById("nome-companheiro").value;
  const telefone = document.getElementById("telefone-companheiro").value;
  const observacao = document.getElementById("observacao-companheiro").value;

  try {
    await addDoc(
      collection(db, "usuarios", usuarioAtual.uid, "companheiros"),
      {
        nome: nome,
        telefone: telefone || null,
        observacao: observacao || null,
        criadoEm: new Date()
      }
    );

    alert("Companheiro cadastrado com sucesso!");
    formCompanheiro.reset();
    await carregarCompanheiros(usuarioAtual);

  } catch (erro) {
    console.error("Erro ao cadastrar companheiro:", erro);
    alert("Erro ao cadastrar companheiro");
  }
});

formTrabalho.addEventListener("submit", async (e) => {
  e.preventDefault();

  if (!usuarioAtual) return;

  const companheiroId = selectCompanheiro.value;
  const companheiroNome = selectCompanheiro.options[selectCompanheiro.selectedIndex].text;

  const companheiroSelecionado = todosOsCompanheiros.find(
    (companheiro) => companheiro.id === companheiroId
  );

  const companheiroTelefone = companheiroSelecionado?.telefone || null;

  const moitaId = selectMoita.value;
  const moitaNome = moitaId
    ? selectMoita.options[selectMoita.selectedIndex].text
    : null;

  const data = document.getElementById("data-trabalho").value;
  const servico = document.getElementById("servico-trabalho").value;
  const valor = document.getElementById("valor-trabalho").value;
  const statusPagamento = document.getElementById("status-pagamento").value;
  const observacao = document.getElementById("observacao-trabalho").value;

  if (!companheiroId) {
    alert("Selecione um companheiro");
    return;
  }

  try {
    const dataPagamento = statusPagamento === "pago" ? obterDataHoje() : null;

    const trabalhoBase = {
      companheiroId: companheiroId,
      companheiroNome: companheiroNome,
      companheiroTelefone: companheiroTelefone,
      moitaId: moitaId || null,
      moitaNome: moitaNome || null,
      data: data,
      servico: servico,
      valor: Number(valor),
      statusPagamento: statusPagamento,
      dataPagamento: dataPagamento,
      lancadoComoDespesa: false,
      despesaId: null,
      observacao: observacao || null,
      criadoEm: new Date()
    };

    const trabalhoRef = await addDoc(
      collection(db, "usuarios", usuarioAtual.uid, "trabalhosCompanheiros"),
      trabalhoBase
    );

    if (statusPagamento === "pago") {
      const despesaId = await lancarDespesaDePagamento(trabalhoBase, dataPagamento);

      const ref = doc(db, "usuarios", usuarioAtual.uid, "trabalhosCompanheiros", trabalhoRef.id);

      await updateDoc(ref, {
        lancadoComoDespesa: true,
        despesaId: despesaId
      });
    }

    alert("Trabalho registrado com sucesso!");
    formTrabalho.reset();
    await buscarTrabalhos(usuarioAtual);

  } catch (erro) {
    console.error("Erro ao registrar trabalho:", erro);
    alert("Erro ao registrar trabalho");
  }
});

inputPesquisa.addEventListener("input", () => {
  renderizarTrabalhos();
});