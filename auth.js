import { auth, db } from "./firebase.js";

import {
  GoogleAuthProvider,
  signInWithPopup,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.10.0/firebase-auth.js";

import {
  doc,
  getDoc,
  setDoc
} from "https://www.gstatic.com/firebasejs/12.10.0/firebase-firestore.js";

const provider = new GoogleAuthProvider();
const btnLogin = document.getElementById("login-btn");

async function fazerLoginComGoogle() {
  try {
    await signInWithPopup(auth, provider);
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

if (btnLogin) {
  btnLogin.addEventListener("click", fazerLoginComGoogle);
}

onAuthStateChanged(auth, async (user) => {
  if (!user) return;

  try {
    const acesso = await criarUsuarioSeNaoExistir(user);

    // 1. bloqueado sempre perde prioridade
    if (acesso.bloqueado) {
      window.location.href = "bloqueado.html";
      return;
    }

    // 2. admin sempre entra no admin, mesmo se aprovado estiver false
    if (acesso.admin === true) {
      window.location.href = "admin.html";
      return;
    }

    // 3. usuário comum aprovado entra no painel
    if (acesso.aprovado === true) {
      window.location.href = "index.html";
      return;
    }

    // 4. se não for admin e não estiver aprovado
    window.location.href = "aguardando.html";

  } catch (error) {
    console.error("Erro ao verificar acesso:", error);
    alert("Erro ao acessar sua conta.");
  }
});