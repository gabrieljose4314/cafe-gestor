import { db } from "./firebase.js";
import { exigirUsuarioAprovado } from "./acesso.js";

import {
  collection,
  addDoc
} from "https://www.gstatic.com/firebasejs/12.10.0/firebase-firestore.js";

const form = document.getElementById("cadastro-moita-form");

let usuarioAtual = null;

(async function iniciarCadastro() {
  const resultado = await exigirUsuarioAprovado();
  if (!resultado) return;

  usuarioAtual = resultado.user;
})();

form.addEventListener("submit", async (e) => {
  e.preventDefault();

  if (!usuarioAtual) {
    alert("Usuário não autenticado");
    return;
  }

  const nome = document.getElementById("nome-moita").value;
  const area = document.getElementById("area-moita").value;
  const pes = document.getElementById("quantidade-de-pes").value;
  const tipo = document.getElementById("tipo-de-cafe").value;

  try {
    await addDoc(
      collection(db, "usuarios", usuarioAtual.uid, "moitas"),
      {
        nome: nome,
        area: Number(area),
        pes: Number(pes),
        tipo: tipo,
        dataCriacao: new Date()
      }
    );

    alert("Moita cadastrada com sucesso!");
    form.reset();

  } catch (erro) {
    console.error("Erro ao cadastrar:", erro);
    alert("Erro ao cadastrar moita");
  }
});