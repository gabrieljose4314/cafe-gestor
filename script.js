import { auth, db } from "./firebase.js";

import {
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/12.10.0/firebase-auth.js";


// verificar usuário logado
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/12.10.0/firebase-firestore.js";

onAuthStateChanged(auth, async (user) => {

  if (user) {

    const userRef = doc(db, "usuarios", user.uid);
    const snap = await getDoc(userRef);

    const dados = snap.data().dados;

    document.getElementById("nomeUsuario").textContent =
      "Bem-vindo, " + dados.nome;

  } else {

    window.location.href = "login.html";

  }

});


// botão logout
const botaoLogout = document.getElementById("logout");

botaoLogout.addEventListener("click", async () => {

  await signOut(auth);

  window.location.href = "login.html";

});
import {
  collection,
  getDocs
} from "https://www.gstatic.com/firebasejs/12.10.0/firebase-firestore.js";


onAuthStateChanged(auth, async (user) => {

  if (!user) {
    window.location.href = "login.html";
    return;
  }

  let ganhoBruto = 0;
  let gastoBruto = 0;


  // BUSCAR VENDAS
  const vendasSnapshot = await getDocs(
    collection(db, "usuarios", user.uid, "vendas")
  );

  vendasSnapshot.forEach((doc) => {

    const venda = doc.data();

    ganhoBruto += venda.valorTotal;

  });


  // BUSCAR DESPESAS
  const despesasSnapshot = await getDocs(
    collection(db, "usuarios", user.uid, "despesas")
  );

  despesasSnapshot.forEach((doc) => {

    const despesa = doc.data();

    gastoBruto += despesa.valor;

  });


  const lucro = ganhoBruto - gastoBruto;


  // FORMATAÇÃO BRASILEIRA
  document.getElementById("ganho-bruto").textContent =
    ganhoBruto.toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL"
    });

  document.getElementById("gasto-bruto").textContent =
    gastoBruto.toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL"
    });

  document.getElementById("lucro-total").textContent =
    lucro.toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL"
    });

});