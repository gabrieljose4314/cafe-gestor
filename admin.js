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

const listaUsuarios = document.getElementById("lista-usuarios");
const botaoLogout = document.getElementById("logout-admin");

function criarCardUsuario(id, usuario) {
  const nome = usuario.dados?.nome || "Sem nome";
  const email = usuario.dados?.email || "Sem email";
  const acesso = usuario.acesso || {};

  const statusAprovado = acesso.aprovado ? "Aprovado" : "Pendente";
  const statusBloqueado = acesso.bloqueado ? "Bloqueado" : "Ativo";
  const statusAdmin = acesso.admin ? "Sim" : "Não";

  const div = document.createElement("div");

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
  listaUsuarios.innerHTML = "";

  const snapshot = await getDocs(collection(db, "usuarios"));

  if (snapshot.empty) {
    listaUsuarios.innerHTML = "<p>Nenhum usuário encontrado.</p>";
    return;
  }

  snapshot.forEach((documento) => {
    const usuario = documento.data();
    const card = criarCardUsuario(documento.id, usuario);
    listaUsuarios.appendChild(card);
  });

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