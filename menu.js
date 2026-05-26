import { exigirUsuarioAprovado } from "./acesso.js";

(async function controlarMenu() {
  const resultado = await exigirUsuarioAprovado();
  if (!resultado) return;

  const plano = resultado.dados?.acesso?.plano || "basico";

  if (plano !== "completo") {
    const paginasBloqueadas = ["companheiros.html",, "historico.html"];

    paginasBloqueadas.forEach(pagina => {
      const link = document.querySelector(`a[href="${pagina}"]`);
      if (link) {
        const item = link.closest("li");
        if (item) item.style.setProperty("display", "none", "important");
      }
    });
  }
})();