import { auth, db } from "./firebase.js";

import {
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.10.0/firebase-auth.js";

import {
  doc,
  getDoc,
  setDoc
} from "https://www.gstatic.com/firebasejs/12.10.0/firebase-firestore.js";

const provider = new GoogleAuthProvider();

// Força sempre abrir a tela de seleção de conta do Google
provider.setCustomParameters({
  prompt: "select_account"
});

const btnLogin = document.getElementById("login-btn");

const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

// PWA instalado (modo "standalone") quebra o signInWithPopup: a popup abre,
// mas o resultado não volta pra página que a abriu. iOS usa navigator.standalone,
// os demais usam a media query display-mode.
const isStandalonePWA =
  window.matchMedia("(display-mode: standalone)").matches ||
  window.navigator.standalone === true;

const precisaDeRedirect = isMobile || isStandalonePWA;

async function fazerLoginComGoogle() {
  try {
    if (precisaDeRedirect) {
      await signInWithRedirect(auth, provider);
    } else {
      await signInWithPopup(auth, provider);
    }
  } catch (error) {
    console.error("Erro no login:", error);
    alert("Erro ao entrar com Google. Tente novamente.");
  }
}

async function criarUsuarioSeNaoExistir(user) {
  const uid = user.uid;
  const userRef = doc(db, "usuarios", uid);
  const userSnap = await getDoc(userRef);

  if (!userSnap.exists()) {
    await setDoc(userRef, {
      dados: {
        nome: user.displayName,
        email: user.email,
        foto: user.photoURL,
        criado_em: new Date()
      },
      acesso: {
        aprovado: false,
        admin: false,
        bloqueado: false
      }
    });

    return {
      aprovado: false,
      admin: false,
      bloqueado: false
    };
  }

  const dadosUsuario = userSnap.data();

  return dadosUsuario.acesso || {
    aprovado: false,
    admin: false,
    bloqueado: false
  };
}

async function redirecionarUsuario(acesso) {
  if (acesso.bloqueado) {
    window.location.href = "bloqueado.html";
    return;
  }
  if (acesso.admin === true) {
    window.location.href = "admin.html";
    return;
  }
  if (acesso.aprovado === true) {
    window.location.href = "index.html";
    return;
  }
  window.location.href = "aguardando.html";
}

if (btnLogin) {
  btnLogin.addEventListener("click", fazerLoginComGoogle);
}

// Captura o resultado do redirect (mobile ou PWA instalado)
if (precisaDeRedirect) {
  getRedirectResult(auth)
    .then(async (result) => {
      if (!result) return;
      const acesso = await criarUsuarioSeNaoExistir(result.user);
      await redirecionarUsuario(acesso);
    })
    .catch((error) => {
      console.error("Erro no redirect:", error);
    });
}

onAuthStateChanged(auth, async (user) => {
  if (!user) return;

  try {
    const acesso = await criarUsuarioSeNaoExistir(user);
    await redirecionarUsuario(acesso);
  } catch (error) {
    console.error("Erro ao verificar acesso:", error);
    alert("Erro ao acessar sua conta.");
  }
});