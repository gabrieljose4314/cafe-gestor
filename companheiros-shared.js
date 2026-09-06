// ── Utilitários e lógica compartilhada entre as páginas de Companheiros ───────
// (companheiros-cadastro, companheiros-turmas, companheiros-trabalho,
//  companheiros-pagamentos)
import { collection, addDoc } from "https://www.gstatic.com/firebasejs/12.10.0/firebase-firestore.js";

export const fmt = v => Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export const hoje = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

export const fmtBR = d => {
  if (!d) return "-";
  const p = d.split("-");
  return p.length !== 3 ? d : `${p[2]}/${p[1]}/${p[0]}`;
};

// Lança automaticamente uma despesa de "Mão de Obra" quando um trabalho é
// marcado como pago (seja na hora do registro ou depois, no monitoramento).
export async function lancarDespesa(db, uid, trabalho, dataPagamento) {
  const ref = await addDoc(collection(db, "usuarios", uid, "despesas"), {
    categoria: "Mão de Obra",
    descricao: `Pagamento para ${trabalho.companheiroNome} - ${trabalho.servico}`,
    valor: Number(trabalho.valor) || 0,
    data: dataPagamento,
    moitaId: trabalho.moitaId || null,
    moitaNome: trabalho.moitaNome || null,
    criadoEm: new Date()
  });
  return ref.id;
}

// Todas as 5 páginas de Companheiros exigem o plano Completo : mesma
// verificação que existia no companheiros.js original.
export function verificarPlanoCompleto(resultado) {
  const plano = resultado.dados?.acesso?.plano || "basico";
  if (plano !== "completo") {
    alert("Seu plano não tem acesso a esta página.\nFaça upgrade para o plano Completo!");
    window.location.href = "index.html";
    return false;
  }
  return true;
}
