import { auth, db } from "./firebase.js";
import {
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.10.0/firebase-auth.js";
import {
  doc,
  getDoc
} from "https://www.gstatic.com/firebasejs/12.10.0/firebase-firestore.js";

export function aguardarUsuario() {
  return new Promise((resolve) => {
    onAuthStateChanged(auth, (user) => resolve(user));
  });
}

export async function buscarDadosAcesso(user) {
  const ref = doc(db, "usuarios", user.uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  return snap.data();
}

export async function exigirUsuarioAprovado() {
  const user = await aguardarUsuario();

  if (!user) {
    window.location.href = "login.html";
    return null;
  }

  const dados = await buscarDadosAcesso(user);

  if (!dados) {
    window.location.href = "login.html";
    return null;
  }

  if (dados.acesso?.bloqueado) {
    window.location.href = "bloqueado.html";
    return null;
  }

  if (dados.acesso?.admin === true) {
    return { user, dados };
  }

  if (dados.acesso?.aprovado !== true) {
    window.location.href = "aguardando.html";
    return null;
  }

  return { user, dados };
}

export async function exigirAdmin() {
  const user = await aguardarUsuario();

  if (!user) {
    window.location.href = "login.html";
    return null;
  }

  const dados = await buscarDadosAcesso(user);

  if (!dados) {
    window.location.href = "login.html";
    return null;
  }

  if (dados.acesso?.bloqueado) {
    window.location.href = "bloqueado.html";
    return null;
  }

  if (dados.acesso?.admin !== true) {
    window.location.href = "index.html";
    return null;
  }

  return { user, dados };
}