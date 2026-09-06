import { exigirUsuarioAprovado } from "./acesso.js";

// ── Sidebar desktop: item expansível "Companheiros/Turmas" ─────────────────
// Roda imediatamente (não espera autenticação) pra já abrir/destacar o
// submenu certo quando a página carregada for uma das 4 de Companheiros.
window.alternarSubmenuSidebar = function (btn) {
  const item = btn.closest(".sidebar-item-expansivel");
  if (item) item.classList.toggle("aberto");
};

document.querySelectorAll(".sidebar-submenu a").forEach(a => {
  const href = a.getAttribute("href");
  if (href && location.pathname.endsWith(href)) {
    a.classList.add("ativo");
    const item = a.closest(".sidebar-item-expansivel");
    if (item) item.classList.add("aberto", "ativo");
  }
});

// ── Drawer mobile : a mesma sidebar agora serve pras duas telas ────────────
// No celular ela começa fora da tela (ver style.css) e o hamburguer do
// topbar-mobile chama alternarMenuMobile() pra abrir/fechar. Também roda
// imediatamente, sem esperar autenticação, pro menu já funcionar assim que
// a página carrega.
window.alternarMenuMobile = function () {
  document.querySelector(".sidebar-desktop")?.classList.toggle("aberta");
  document.querySelector(".overlay-menu-mobile")?.classList.toggle("visivel");
};

window.fecharMenuMobile = function () {
  document.querySelector(".sidebar-desktop")?.classList.remove("aberta");
  document.querySelector(".overlay-menu-mobile")?.classList.remove("visivel");
};

(async function controlarMenu() {
  const resultado = await exigirUsuarioAprovado();
  if (!resultado) return;

  const plano = resultado.dados?.acesso?.plano || "basico";

  if (plano !== "completo") {
    // Histórico é exclusivo do plano completo : esconde o link direto na
    // sidebar/drawer (ele agora é um <a> solto, sem <li> ao redor).
    const linkHistorico = document.querySelector('.sidebar-nav > a[href="historico.html"]');
    if (linkHistorico) linkHistorico.style.setProperty("display", "none", "important");

    // Companheiros/Turmas: o link virou o botão que abre o submenu (não tem
    // href), então esconde o item expansível inteiro.
    const itemExpansivel = document.querySelector(".sidebar-item-expansivel");
    if (itemExpansivel) itemExpansivel.style.setProperty("display", "none", "important");
  }
})();