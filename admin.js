import { auth, db } from "./firebase.js";
import { exigirAdmin } from "./acesso.js";

import {
  signOut
} from "https://www.gstatic.com/firebasejs/12.10.0/firebase-auth.js";

import {
  collection,
  getDocs,
  doc,
  updateDoc
} from "https://www.gstatic.com/firebasejs/12.10.0/firebase-firestore.js";

const listaPendentes = document.getElementById("lista-pendentes-admin");
const listaAprovados = document.getElementById("lista-aprovados-admin");
const listaBloqueados = document.getElementById("lista-bloqueados-admin");
const botaoLogout = document.getElementById("logout-admin");

function criarCardUsuario(id, usuario) {
  const nome = usuario.dados?.nome || "Sem nome";
  const email = usuario.dados?.email || "Sem email";
  const acesso = usuario.acesso || {};

  const statusAprovado = acesso.aprovado ? "Aprovado" : "Pendente";
  const statusBloqueado = acesso.bloqueado ? "Bloqueado" : "Ativo";
  const statusAdmin = acesso.admin ? "Sim" : "Não";

  const div = document.createElement("div");
  div.classList.add("card-admin-usuario");

  div.innerHTML = `
    <p><strong>Nome:</strong> ${nome}</p>
    <p><strong>Email:</strong> ${email}</p>
    <p><strong>Aprovado:</strong> ${statusAprovado}</p>
    <p><strong>Bloqueado:</strong> ${statusBloqueado}</p>
    <p><strong>Admin:</strong> ${statusAdmin}</p>
    <button class="btn-aprovar" data-id="${id}">Aprovar</button>
    <button class="btn-bloquear" data-id="${id}">Bloquear</button>
    <button class="btn-desbloquear" data-id="${id}">Desbloquear</button>
  `;

  return div;
}

async function carregarUsuarios() {
  listaPendentes.innerHTML = "";
  listaAprovados.innerHTML = "";
  listaBloqueados.innerHTML = "";

  const snapshot = await getDocs(collection(db, "usuarios"));

  if (snapshot.empty) {
    listaPendentes.innerHTML = "<p>Nenhum usuário encontrado.</p>";
    listaAprovados.innerHTML = "<p>Nenhum usuário encontrado.</p>";
    listaBloqueados.innerHTML = "<p>Nenhum usuário encontrado.</p>";
    return;
  }

  let temPendentes = false;
  let temAprovados = false;
  let temBloqueados = false;

  snapshot.forEach((documento) => {
    const usuario = documento.data();
    const acesso = usuario.acesso || {};
    const card = criarCardUsuario(documento.id, usuario);

    if (acesso.bloqueado) {
      listaBloqueados.appendChild(card);
      temBloqueados = true;
    } else if (acesso.aprovado) {
      listaAprovados.appendChild(card);
      temAprovados = true;
    } else {
      listaPendentes.appendChild(card);
      temPendentes = true;
    }
  });

  if (!temPendentes) {
    listaPendentes.innerHTML = "<p>Nenhuma solicitação pendente.</p>";
  }

  if (!temAprovados) {
    listaAprovados.innerHTML = "<p>Nenhum usuário aprovado.</p>";
  }

  if (!temBloqueados) {
    listaBloqueados.innerHTML = "<p>Nenhum usuário bloqueado.</p>";
  }

  adicionarEventos();
}

function adicionarEventos() {
  const botoesAprovar = document.querySelectorAll(".btn-aprovar");
  const botoesBloquear = document.querySelectorAll(".btn-bloquear");
  const botoesDesbloquear = document.querySelectorAll(".btn-desbloquear");

  botoesAprovar.forEach((botao) => {
    botao.addEventListener("click", async () => {
      const userId = botao.getAttribute("data-id");

      await updateDoc(doc(db, "usuarios", userId), {
        "acesso.aprovado": true,
        "acesso.bloqueado": false
      });

      alert("Usuário aprovado com sucesso!");
      await carregarUsuarios();
    });
  });

  botoesBloquear.forEach((botao) => {
    botao.addEventListener("click", async () => {
      const userId = botao.getAttribute("data-id");

      await updateDoc(doc(db, "usuarios", userId), {
        "acesso.bloqueado": true
      });

      alert("Usuário bloqueado com sucesso!");
      await carregarUsuarios();
    });
  });

  botoesDesbloquear.forEach((botao) => {
    botao.addEventListener("click", async () => {
      const userId = botao.getAttribute("data-id");

      await updateDoc(doc(db, "usuarios", userId), {
        "acesso.bloqueado": false
      });

      alert("Usuário desbloqueado com sucesso!");
      await carregarUsuarios();
    });
  });
}

if (botaoLogout) {
  botaoLogout.addEventListener("click", async () => {
    await signOut(auth);
    window.location.href = "login.html";
  });
}

(async function iniciarAdmin() {
  const resultado = await exigirAdmin();
  if (!resultado) return;

  await carregarUsuarios();
})();