// Fase 0 — Correção definitiva de codificação (Plano Mestre, seção 11).
// Substitui strings corrompidas (U+FFFD) por suas formas corretas em português.
// Afeta apenas os arquivos-fonte ativos listados abaixo; preserva CRLF; salva UTF-8 sem BOM.
import fs from "node:fs";

const files = [
  "server/db.ts",
  "server/huggingface.test.ts",
  "server/imobai.test.ts",
  "server/import-properties.ts",
  "server/routers.ts",
  "drizzle/schema.ts",
];

// Ordem importa: tokens mais longos antes dos menores para evitar dupla substituição.
const fixes = [
  ["S\uFFFD Paulo", "São Paulo"],
  ["aprova\uFFFD\uFFFD", "aprovação"],
  ["aquisi\uFFFD\uFFFD", "aquisição"],
  ["avalia\uFFFD\uFFFD", "avaliação"],
  ["compara\uFFFD\uFFFD", "comparação"],
  ["conserva\uFFFD\uFFFD", "conservação"],
  ["demonstra\uFFFD\uFFFD", "demonstração"],
  ["descri\uFFFD\uFFFD", "descrição"],
  ["documenta\uFFFD\uFFFD", "documentação"],
  ["extra\uFFFD\uFFFD", "extração"],
  ["ilumina\uFFFD\uFFFD", "iluminação"],
  ["importa\uFFFD\uFFFD", "importação"],
  ["informa\uFFFD\uFFFDes", "informações"],
  ["informa\uFFFD\uFFFDo", "informação"],
  ["inten\uFFFD\uFFFD", "intenção"],
  ["limita\uFFFD\uFFFD", "limitação"],
  ["localiza\uFFFD\uFFFD", "localização"],
  ["loca\uFFFD\uFFFD", "locação"],
  ["men\uFFFD\uFFFDes", "menções"],
  ["negocia\uFFFD\uFFFD", "negociação"],
  ["Negocia\uFFFD\uFFFD", "Negociação"],
  ["situa\uFFFD\uFFFD", "situação"],
  ["esta\uFFFD\uFFFDes", "estações"],
  ["op\uFFFD\uFFFDes", "opções"],
  ["Condom\uFFFDnio", "Condomínio"],
  ["condom\uFFFDnio", "condomínio"],
  ["Conhe\uFFFDe", "Conheça"],
  ["C\uFFFDdigos", "Códigos"],
  ["DISPON\uFFFDFEIS", "DISPONÍVEIS"],
  ["D\uFFFDvida", "Dúvida"],
  ["Espa\uFFFD", "Espaço"],
  ["Im\uFFFDveis", "Imóveis"],
  ["Im\uFFFDvel", "Imóvel"],
  ["Mant\uFFFDm", "Mantém"],
  ["N\uFFFD ", "Não "],
  ["Portf\uFFFDlio", "Portfólio"],
  ["Pre\uFFFDe", "Preço"],
  ["Pr\uFFFDximo", "Próximo"],
  ["Sa\uFFFDde", "Saúde"],
  ["S\uFFFD ", "São "],
  ["Uberl\uFFFDndia", "Uberlândia"],
  ["VOC\uFFFD", "VOCÊ"],
  ["Voc\uFFFD", "Você"],
  ["al\uFFFDm", "além"],
  ["an\uFFFDncio", "anúncio"],
  ["ap\uFFFD", "apê"],
  ["at\uFFFD", "até"],
  ["banc\uFFFDrio", "bancário"],
  ["benef\uFFFDcios", "benefícios"],
  ["cat\uFFFDlogo", "catálogo"],
  ["coment\uFFFDrios", "comentários"],
  ["compat\uFFFDveis", "compatíveis"],
  ["compat\uFFFDvel", "compatível"],
  ["conex\uFFFD", "conexão"],
  ["confi\uFFFDveis", "confiáveis"],
  ["confort\uFFFDvel", "confortável"],
  ["c\uFFFDdigo", "código"],
  ["desnecess\uFFFDrio", "desnecessário"],
  ["dispon\uFFFDvel", "disponível"],
  ["indispon\uFFFDvel", "indisponível"],
  ["dist\uFFFDncia", "distância"],
  ["dormit\uFFFDrio", "dormitório"],
  ["dormit\uFFFDrios", "dormitórios"],
  ["d\uFFFD", "dê"],
  ["endere\uFFFD", "endereço"],
  ["escrit\uFFFDrios", "escritórios"],
  ["espa\uFFFD", "espaço"],
  ["espec\uFFFDfico", "específico"],
  ["estat\uFFFDstica", "estatística"],
  ["est\uFFFD", "está"],
  ["expl\uFFFDcita", "explícita"],
  ["expl\uFFFDcito", "explícito"],
  ["fa\uFFFDe", "faça"],
  ["gen\uFFFDrica", "genérica"],
  ["gest\uFFFD", "gestão"],
  ["hist\uFFFDrias", "histórias"],
  ["imobili\uFFFDria", "imobiliária"],
  ["imobili\uFFFDrio", "imobiliário"],
  ["im\uFFFDveis", "imóveis"],
  ["im\uFFFDvel", "imóvel"],
  ["inv\uFFFDlida", "inválida"],
  ["inv\uFFFDlidos", "inválidos"],
  ["inv\uFFFDlido", "inválido"],
  ["jarg\uFFFD", "jargão"],
  ["jur\uFFFDdico", "jurídico"],
  ["j\uFFFD", "já"],
  ["monet\uFFFDrios", "monetários"],
  ["munic\uFFFDpio", "município"],
  ["milh\uFFFDes", "milhões"],
  ["milh\uFFFDo", "milhão"],
  ["m\uFFFDdia", "média"],
  ["m\uFFFDdio", "médio"],
  ["m\uFFFDnimo", "mínimo"],
  ["m\uFFFDtricas", "métricas"],
  ["m\uFFFDximo", "máximo"],
  ["m\uFFFD", "m²"],
  ["n\uFFFDmeros", "números"],
  ["n\uFFFDmero", "número"],
  ["n\uFFFD ", "não "],
  ["n\uFFFDo", "não"],
  ["ofere\uFFFDe", "ofereça"],
  ["par\uFFFDgrafos", "parágrafos"],
  ["permiss\uFFFD", "permissão"],
  ["portf\uFFFDlio", "portfólio"],
  ["portugu\uFFFDs", "português"],
  ["poss\uFFFDvel", "possível"],
  ["pre\uFFFDe", "preço"],
  ["propriet\uFFFDrios", "proprietários"],
  ["propriet\uFFFDrio", "proprietário"],
  ["prop\uFFFDsito", "propósito"],
  ["pr\uFFFDdio", "prédio"],
  ["pr\uFFFDprio", "próprio"],
  ["pr\uFFFDticas", "práticas"],
  ["pr\uFFFDxima", "próxima"],
  ["pr\uFFFDximo", "próximo"],
  ["qu\uFFFD", "quê"],
  ["refer\uFFFDncia", "referência"],
  ["ref\uFFFDgio", "refúgio"],
  ["regi\uFFFD", "região"],
  ["rob\uFFFDtico", "robótico"],
  ["seguran\uFFFD", "segurança"],
  ["servi\uFFFDos", "serviços"],
  ["terra\uFFFD", "terraço"],
  ["tr\uFFFDs", "três"],
  ["t\uFFFDcnico", "técnico"],
  ["t\uFFFDerrea", "térrea"],
  ["t\uFFFDerrea", "térrea"],
  ["t\uFFFDarrea", "térrea"],
  ["usu\uFFFDrio", "usuário"],
  ["vari\uFFFDveis", "variáveis"],
  ["vers\uFFFD", "versão"],
  ["vizinhan\uFFFD", "vizinhança"],
  ["voc\uFFFD", "você"],
  ["v\uFFFDlidos", "válidos"],
  ["v\uFFFDlido", "válido"],
  ["s\uFFFDo", "são"],
  ["s\uFFFD", "só"],
  ["\uFFFDNICA", "ÚNICA"],
  ["\uFFFDnica", "única"],
  ["\uFFFDnico", "único"],
  ["\uFFFDarea", "área"],
  ["\uFFFDrea", "área"],
  ["\uFFFDies", "ões"],
  ["\uFFFDes", "ões"],
  ["\uFFFDo", "ão"],
  ["\uFFFD", "—"],
];

let total = 0;
for (const file of files) {
  const before = fs.readFileSync(file, "utf8");
  let after = before;
  for (const [wrong, right] of fixes) {
    while (after.includes(wrong)) {
      after = after.split(wrong).join(right);
      total += 1;
    }
  }
  if (after !== before) {
    fs.writeFileSync(file, after, "utf8");
    console.log(`[ok] ${file}: ${before.split("\uFFFD").length - 1} -> ${after.split("\uFFFD").length - 1} caracteres corrompidos`);
  } else {
    console.log(`[--] ${file}: sem alteração`);
  }
}
console.log(`Total de substituições: ${total}`);

// Verificação: nenhum U+FFFD pode sobrar (critério de aceite da seção 11).
let remaining = 0;
for (const file of files) {
  const text = fs.readFileSync(file, "utf8");
  const count = text.split("\uFFFD").length - 1;
  if (count > 0) {
    remaining += count;
    text.split("\n").forEach((line, index) => {
      if (line.includes("\uFFFD")) console.log(`  PENDENTE ${file}:${index + 1}: ${line.trim().slice(0, 140)}`);
    });
  }
}
console.log(remaining === 0 ? "Critério de aceite: OK — nenhum caractere corrompido restante." : `PENDÊNCIAS: ${remaining}`);
