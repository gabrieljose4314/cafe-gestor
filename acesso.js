import { auth, db } from "./firebase.js";
import {
  onAuthStateChanged,
  signOut
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

// Preenche o nome/avatar da topbar do layout desktop novo (sidebar fixa)
// e liga o botão "Sair" dela. Feito pra ser chamado em toda página que
// tiver esse layout : recebe o nome já pronto (resultado.dados?.dados?.nome)
// e não faz nada se os elementos não existirem na página (páginas que
// ainda não migraram pro layout novo simplesmente ignoram).
export function ativarTopbarDesktop(nome) {
  const elNome = document.getElementById("nomeUsuarioDesktop");
  if (elNome) elNome.textContent = nome || "";

  const elAvatar = document.getElementById("avatarUsuarioDesktop");
  if (elAvatar) {
    elAvatar.textContent = (nome || "U").trim().charAt(0).toUpperCase() || "U";
  }

  const botaoLogoutDesktop = document.getElementById("logout-desktop");
  if (botaoLogoutDesktop && !botaoLogoutDesktop.dataset.logoutLigado) {
    botaoLogoutDesktop.dataset.logoutLigado = "1";
    botaoLogoutDesktop.addEventListener("click", async () => {
      await signOut(auth);
      window.location.href = "login.html";
    });
  }

  // Mesma coisa, só que pro drawer mobile (agora que o celular também usa a
  // sidebar nova, ele tem seu próprio avatar/nome/botão Sair : sufixo
  // "-mobile" pra não colidir com os ids "-desktop" acima).
  const elNomeMobile = document.getElementById("nomeUsuarioMobile");
  if (elNomeMobile) elNomeMobile.textContent = nome || "";

  const elAvatarMobile = document.getElementById("avatarUsuarioMobile");
  if (elAvatarMobile) {
    elAvatarMobile.textContent = (nome || "U").trim().charAt(0).toUpperCase() || "U";
  }

  const botaoLogoutMobile = document.getElementById("logout-mobile");
  if (botaoLogoutMobile && !botaoLogoutMobile.dataset.logoutLigado) {
    botaoLogoutMobile.dataset.logoutLigado = "1";
    botaoLogoutMobile.addEventListener("click", async () => {
      await signOut(auth);
      window.location.href = "login.html";
    });
  }
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