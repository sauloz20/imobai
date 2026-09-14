// Teste direto da camada de dados (Fase 7 — caso de teste "modalidade").
import { listProperties } from "../server/db";

async function main() {
  const aluguel = await listProperties({ finalidade: "aluguel", limit: 500 });
  console.log("finalidade=aluguel =>", aluguel.length, "imoveis");
  console.log("  todos com valorAluguel > 0?", aluguel.every(p => Number(p.valorAluguel) > 0));

  const compra = await listProperties({ finalidade: "compra", limit: 500 });
  console.log("finalidade=compra =>", compra.length, "imoveis");
  console.log("  todos com valorVenda > 0?", compra.every(p => Number(p.valorVenda) > 0));

  const aluguel2q = await listProperties({ finalidade: "aluguel", quartos: 2, limit: 500 });
  console.log("aluguel + 2+ quartos =>", aluguel2q.length, "imoveis:", aluguel2q.map(p => p.codigo).join(", "));

  const casaAte500 = await listProperties({ finalidade: "compra", tipo: "Casa", valorMax: 500000, limit: 500 });
  console.log("casa ate 500mil =>", casaAte500.length, "imoveis:", casaAte500.map(p => `${p.codigo}(R$${Number(p.valorVenda).toFixed(0)})`).join(", "));
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error("ERRO:", error.message);
    process.exit(1);
  });
