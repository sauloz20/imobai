import { z } from "zod";
import { COOKIE_NAME } from "@shared/const";
import { TRPCError } from "@trpc/server";
import { getSessionCookieOptions } from "./_core/cookies";
import { type InvokeResult } from "./_core/llm";
import { invokeAgentLLM } from "./_core/huggingface";
import { systemRouter } from "./_core/systemRouter";
import { storagePut } from "./storage";
import { nanoid } from "nanoid";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import {
  createAiMessage,
  createConversation,
  createLocalSession,
  createLocalUser,
  createMessage,
  createPropertyForUser,
  addPropertyPhotos,
  deletePropertyForUser,
  updatePropertyForUser,
  deleteLocalSession,
  findSimilarProperties,
  getConversation,
  getDashboardData,
  getOrCreateAiChat,
  listAiMessages,
  listConversations,
  listMessages,
  listProperties,
  listPropertiesForUser,
  LOCAL_SESSION_COOKIE,
  saveSearch,
  verifyLocalCredentials,
  updateUserProfile,
} from "./db";

const agentSystemPrompt = `Você — o ImobAI Agent, um assistente especialista no mercado imobiliário brasileiro integrado a um sistema de gestáo.
Você opera em três modos: PARSER_BUSCA, GERADOR_ANUNCIO e SUGESTAO_PRECO.
Sempre responda com JSON válido, sem markdown, sem comentários e sem inventar informações que não estejam na entrada.`;

const searchSchema = {
  type: "object",
  properties: {
    finalidade: { type: ["string", "null"], enum: ["compra", "aluguel", null] },
    tipo: { type: ["string", "null"] },
    quartos: { type: ["integer", "null"] },
    vagas: { type: ["integer", "null"] },
    aceita_pets: { type: ["boolean", "null"] },
    varanda: { type: ["boolean", "null"] },
    ensolarado: { type: ["boolean", "null"] },
    cidade: { type: ["string", "null"] },
    bairro: { type: ["string", "null"] },
    valor_min: { type: ["number", "null"] },
    valor_max: { type: ["number", "null"] },
    diferenciais: { type: "array", items: { type: "string" } },
  },
  required: ["finalidade", "tipo", "quartos", "vagas", "aceita_pets", "varanda", "ensolarado", "cidade", "bairro", "valor_min", "valor_max", "diferenciais"],
  additionalProperties: false,
};

// Cidades conhecidas para extração de "finalidade"/"cidade" no modo fallback (sem LLM).
// Mantém curta de propósito: cobre a base de demonstração (São Paulo) e as cidades
// mais citadas em exemplos de busca, incluindo Montes Claros.
const KNOWN_CITIES = [
  "Montes Claros",
  "São Paulo",
  "Belo Horizonte",
  "Rio de Janeiro",
  "Curitiba",
  "Uberlândia",
  "Contagem",
  "Betim",
];

function detectFinalidade(normalized: string): "compra" | "aluguel" | null {
  const rentSignals = ["alugar", "aluguel", "locação", "locacao", "locar", "arrendar"];
  const buySignals = ["comprar", "compra", "adquirir", "aquisição", "aquisicao", "financiar", "financiamento"];
  if (rentSignals.some(signal => normalized.includes(signal))) return "aluguel";
  if (buySignals.some(signal => normalized.includes(signal))) return "compra";
  return null;
}

function detectCidade(normalized: string): string | null {
  return KNOWN_CITIES.find(city => normalized.includes(city.toLowerCase())) ?? null;
}

function textFromResponse(response: InvokeResult) {
  const message = response.choices?.[0]?.message as
    | {
        content?: string | Array<{ type?: string; text?: string }>;
        reasoning_content?: string | null;
        reasoning?: string | null;
      }
    | undefined;

  const content = message?.content;
  const fromContent = Array.isArray(content)
    ? content.map(part => (part?.type === "text" ? part.text ?? "" : "")).join("")
    : typeof content === "string"
      ? content
      : "";

  if (fromContent.trim()) return fromContent;

  // O Qwen3 (roteador da Hugging Face) pode devolver o campo de raciocínio
  // (reasoning) com o "content" vazio. Nesse caso usamos o raciocínio como
  // texto — melhor do que devolver uma string vazia e cair no fallback.
  const reasoning = message?.reasoning_content ?? message?.reasoning;
  return typeof reasoning === "string" ? reasoning.trim() : "";
}

// Extrai todas as menções de valores monetários da frase, na ordem em que aparecem,
// já convertidas para número (aceita "mil", "milhão/milhões" e "R$ 1.234,56").
function extractAllMoneyValues(text: string): number[] {
  const pattern = /(?:R\$\s*)?(\d+(?:[.,]\d+)?)\s*(\bmi\b|milh(?:ão|oes|ões)|mil)?/gi;
  const values: number[] = [];
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(text)) !== null) {
    const [, rawNumber, unit] = match;
    if (!rawNumber) continue;
    const number = Number(rawNumber.replace(",", "."));
    if (Number.isNaN(number)) continue;
    // Ignora números soltos que claramente não são valores (ex.: "2 quartos"), a menos
    // que estejam prefixados por "R$" ou tenham uma unidade de milhar/milhão explícita.
    const hasCurrencyPrefix = text.slice(Math.max(0, match.index - 3), match.index).includes("R$");
    if (!unit && !hasCurrencyPrefix) continue;
    const normalizedUnit = unit?.toLowerCase();
    const multiplier = normalizedUnit === "mil" ? 1_000 : normalizedUnit?.startsWith("mi") ? 1_000_000 : 1;
    values.push(Math.round(number * multiplier));
  }
  return values;
}

// Interpreta faixas de preão: "entre 250 e 300 mil", "a partir de R$ 200 mil",
// "até R$ 300 mil" ou um valor único (tratado como teto, como antes).
function parseMoneyRange(text: string): { valorMin: number | null; valorMax: number | null } {
  const normalized = text.toLowerCase();
  const values = extractAllMoneyValues(text);
  if (values.length === 0) return { valorMin: null, valorMax: null };

  if (/\bentre\b/.test(normalized) && values.length >= 2) {
    const [a, b] = values;
    return { valorMin: Math.min(a, b), valorMax: Math.max(a, b) };
  }

  const isFloor = /(a partir de|acima de|mínimo de|minimo de|no mínimo|no minimo)/.test(normalized);
  if (isFloor) return { valorMin: values[0], valorMax: null };

  return { valorMin: null, valorMax: values[0] };
}

export function fallbackSearch(text: string) {
  const normalized = text.toLowerCase();
  const tipo = normalized.includes("cobertura")
    ? "Cobertura"
    : normalized.includes("casa")
      ? "Casa"
      : normalized.includes("sobrado")
        ? "Sobrado"
        : normalized.includes("terreno")
          ? "Terreno"
          : normalized.includes("apartamento") || normalized.includes("apê") || normalized.includes("ape")
            ? "Apartamento"
            : null;
  const bedroomMatch = normalized.match(/(\d+)\s*(?:quarto|quartos|dorm|dormitório|dormitórios)/);
  const parkingMatch = normalized.match(/(\d+)\s*(?:vaga|vagas)/);
  const hasUnquantifiedGarage = /\bgaragem\b/.test(normalized) && !parkingMatch;
  const knownNeighborhoods = ["Pinheiros", "Vila Madalena", "Moema", "Alto de Pinheiros", "Itaim Bibi", "Saúde", "Perdizes", "Jardins"];
  const bairro = knownNeighborhoods.find(item => normalized.includes(item.toLowerCase())) ?? null;
  const diferenciais = [
    normalized.includes("pet") || normalized.includes("cachorro") || normalized.includes("gato") ? "aceita pets" : null,
    normalized.includes("varanda") || normalized.includes("terraçoo") || normalized.includes("terraco") ? "varanda" : null,
    normalized.includes("ensolarad") || normalized.includes("luz natural") ? "ensolarado" : null,
    normalized.includes("quintal") || normalized.includes("jardim") ? "quintal ou jardim" : null,
  ].filter(Boolean) as string[];
  const { valorMin, valorMax } = parseMoneyRange(text);
  return {
    finalidade: detectFinalidade(normalized),
    tipo,
    quartos: bedroomMatch ? Number(bedroomMatch[1]) : null,
    vagas: parkingMatch ? Number(parkingMatch[1]) : hasUnquantifiedGarage ? 1 : null,
    aceita_pets: diferenciais.includes("aceita pets") ? true : null,
    varanda: diferenciais.includes("varanda") ? true : null,
    ensolarado: diferenciais.includes("ensolarado") ? true : null,
    cidade: detectCidade(normalized),
    bairro,
    valor_min: valorMin,
    valor_max: valorMax,
    diferenciais,
  };
}

function fallbackAd(input: { tipo: string; quartos: number; bairro: string; diferenciais: string[]; preco: number }) {
  const differenceText = input.diferenciais.length ? ` com ${input.diferenciais.join(", ")}` : "";
  return {
    titulo_comercial: `${input.tipo} de ${input.quartos} quartos${input.bairro ? ` em ${input.bairro}` : ""}`,
    descricao_persuasiva: `Uma oportunidade para viver bem${input.bairro ? ` em ${input.bairro}` : ""}. Este ${input.tipo.toLowerCase()} combina uma planta confortável${differenceText} e está pronto para receber novas histórias. Agende uma visita e descubra todos os detalhes.`,
    hashtags: ["#ImovelDosSonhos", `#${input.bairro.replace(/\s/g, "")}`, "#VivaBem"],
  };
}

function normalizeSearchResult(result: Record<string, any>) {
  const types: Record<string, string> = {
    apartamento: "Apartamento",
    casa: "Casa",
    sobrado: "Sobrado",
    terreno: "Terreno",
    cobertura: "Cobertura",
  };
  const tipo = typeof result.tipo === "string" ? types[result.tipo.toLowerCase()] ?? result.tipo : result.tipo ?? null;
  const bairro = typeof result.bairro === "string" && result.bairro.trim() ? result.bairro.trim() : null;
  const cidade = typeof result.cidade === "string" && result.cidade.trim() ? result.cidade.trim() : null;
  const finalidade = result.finalidade === "compra" || result.finalidade === "aluguel" ? result.finalidade : null;
  return {
    finalidade,
    tipo,
    quartos: typeof result.quartos === "number" ? result.quartos : null,
    vagas: typeof result.vagas === "number" ? result.vagas : null,
    aceita_pets: typeof result.aceita_pets === "boolean" ? result.aceita_pets : null,
    varanda: typeof result.varanda === "boolean" ? result.varanda : null,
    ensolarado: typeof result.ensolarado === "boolean" ? result.ensolarado : null,
    cidade,
    bairro,
    valor_min: typeof result.valor_min === "number" ? result.valor_min : null,
    valor_max: typeof result.valor_max === "number" ? result.valor_max : null,
    diferenciais: Array.isArray(result.diferenciais) ? result.diferenciais : [],
  };
}

function publicUser(user: any) {
  const { passwordHash: _passwordHash, ...safe } = user;
  return safe;
}

function localCookieOptions(req: any) {
  return { ...getSessionCookieOptions(req), maxAge: 1000 * 60 * 60 * 24 * 30 };
}

async function generatePropertyCopy(input: {
  tipo: string;
  bairro: string;
  cidade: string;
  quartos: number;
  banheiros: number;
  vagas: number;
  areaM2: number;
  valorVenda?: number;
  valorAluguel?: number;
  descricaoTecnica?: string;
  diferenciais: string[];
}) {
  const fallback = {
    titulo_comercial: `${input.tipo} com ${input.quartos} quartos em ${input.bairro}`,
    descricao_persuasiva: `Conheça este ${input.tipo.toLowerCase()} em ${input.bairro}, ${input.cidade}, com ${input.areaM2} m², ${input.quartos} quartos, ${input.banheiros} banheiros e ${input.vagas} vagas. ${input.descricaoTecnica || "Uma oportunidade para viver com praticidade, conforto e boa localização."} Agende uma visita para conhecer todos os detalhes.`,
    destaques: input.diferenciais,
    cta: "Agende uma visita e converse com o anunciante.",
    hashtags: [`#${input.tipo.replace(/\s/g, "")}`, `#${input.bairro.replace(/\s/g, "")}`, "#ImoveisSP"],
  };
  try {
    const response = await invokeAgentLLM({
      model: "Qwen/Qwen3.8-27B",
      messages: [
        { role: "system", content: `Você — um redator imobiliário brasileiro de alta conversãoo. Gere textos claros, elegantes e confiáveis para um anúncio. Use apenas os fatos fornecidos; nunca invente metragem, vista, reformas, condomínio, distância, documentação, segurançaa ou amenidades. Destaque benefícios sem promessas absolutas. A descrição deve ter 2 ou 3 parágrafos curtos, incluir os dados objetivos, contexto do bairro somente quando fornecido, diferenciais informados e uma chamada para visita. Escreva em português do Brasil, sem markdown.` },
        { role: "user", content: JSON.stringify(input) },
      ],
      responseFormat: {
        type: "json_schema",
        json_schema: {
          name: "imobai_property_copy",
          strict: true,
          schema: {
            type: "object",
            properties: {
              titulo_comercial: { type: "string" },
              descricao_persuasiva: { type: "string" },
              destaques: { type: "array", items: { type: "string" } },
              cta: { type: "string" },
              hashtags: { type: "array", items: { type: "string" } },
            },
            required: ["titulo_comercial", "descricao_persuasiva", "destaques", "cta", "hashtags"],
            additionalProperties: false,
          },
        },
      },
      maxTokens: 700,
    });
    return { ...fallback, ...JSON.parse(textFromResponse(response)), source: "qwen" as const };
  } catch (error) {
    console.warn("[ImobAI] Property copy fallback:", error instanceof Error ? error.message : error);
    return { ...fallback, source: "fallback" as const };
  }
}

function pluralize(value: number, singular: string, plural: string) {
  return `${value} ${value === 1 ? singular : plural}`;
}
function summarizePropertyForAi(property: {
  codigo?: string;
  tituloAnuncio?: string | null;
  tipo: string;
  bairro: string;
  cidade: string;
  areaM2: string | number;
  quartos: number;
  banheiros: number;
  vagas: number;
  valorVenda?: string | number | null;
  valorAluguel?: string | number | null;
  aceitaPets?: boolean;
  varanda?: boolean;
  ensolarado?: boolean;
  descricaoIa?: string | null;
  descricaoTecnica?: string | null;
  fotos?: unknown[];
}) {
  const diferenciais = [
    property.aceitaPets ? "aceita pets" : null,
    property.varanda ? "varanda" : null,
    property.ensolarado ? "ensolarado" : null,
  ].filter(Boolean);
  return JSON.stringify({
    codigo: property.codigo,
    titulo: property.tituloAnuncio,
    tipo: property.tipo,
    bairro: property.bairro,
    cidade: property.cidade,
    area_m2: property.areaM2,
    quartos: property.quartos,
    banheiros: property.banheiros,
    vagas: property.vagas,
    venda: property.valorVenda ?? null,
    aluguel: property.valorAluguel ?? null,
    diferenciais,
    descricao: (property.descricaoIa || property.descricaoTecnica || "").slice(0, 240),
    fotos: property.fotos?.length ?? 0,
  });
}

function buildConciergeSystemPrompt(context: {
  catalogContext: string;
  portfolioContext: string;
  marketContext: string;
  contextoBuscaAtual: string;
}) {
  return `Você — o ImobAI Concierge, o consultor imobiliário digital de um portal brasileiro. Você atende, na mesma conversa, compradores, locatérios, proprietários e corretores sobre apartamentos, casas, sobrados, coberturas e terrenos.

QUEM VOCÊ —
- Objetivo, caloroso e direto ao ponto — como um corretor experiente que respeita o tempo do cliente.
- Especialista em interpretar a intenção por três da pergunta (comprar, alugar, comparar, negociar, agendar visita, entender um bairro) e responder exatamente para essa intenção.
- Nunca robótico: varie a abertura das respostas, evite repetir a mesma frase de efeito em toda mensagem.

FONTES DE DADOS DISPONÍVEIS (é a ÚNICA verdade que você pode usar — nunca invente nada além disso)
1. Filtro de busca ativo na conversa (o que a pessoa já disse que procura):
${context.contextoBuscaAtual}
2. Imóveis do catélogo compatéveis com esse filtro (até 6, formato JSON por linha — "codigo" identifica o imóvel):
${context.catalogContext}
3. Portfólio privado do usuário logado (imóveis que ELE mesmo cadastrou como anunciante, não como comprador):
${context.portfolioContext}
4. Indicadores de mercado do portal:
${context.marketContext}

REGRAS DE OURO
- Toda vez que você mencionar um imóvel específico, cite o código dele (ex.: "o IMB-2048"). Nunca descreva um imóvel que não esteja em uma das listas acima.
- Se a pergunta pedir algo que os dados acima não cobrem (endereçoo exato, documentação, situação de condomínio, reformas, vista, segurançaa do prédio, motivo da venda, margem de negociação do proprietário), diga claramente que essa informação não está disponível aqui e oriente a confirmar diretamente com o anunciante ou na visita.
- Preço sugerido ou faixa de mercado — sempre uma referência estatéstica, nunca uma avaliação formal — deixe isso explícito quando falar de valores.
- Nunca dê parecer jurídico, financeiro (ex.: aprovação de financiamento) ou de engenharia estrutural; nesses casos, recomende falar com o profissional habilitado (advogado, correspondente bancário, engenheiro/perito), sem se recusar a ajudar com o que está ao seu alcance.
- Se o catélogo não tiver nenhum imóvel compatével com o que a pessoa quer (ex.: cidade sem cobertura no portal), diga isso com honestidade e sugira o próximo passo (ajustar o filtro, cadastrar um alerta, ou ampliar bairro/cidade) em vez de inventar opções.

COMO RESPONDER PARA CADA TIPO DE PERGUNTA
- Comparar imóveis: monte uma comparação objetiva (preão, m², quartos, vagas, diferenciais) usando só os imóveis do catélogo/portfólio acima, e termine indicando qual se encaixa melhor no que a pessoa pediu e por quê.
- Preço / "vale a pena esse valor?": use o m² médio do bairro nos indicadores de mercado quando disponível; se não houver dado do bairro pedido, diga isso e use a média geral como referência aproximada.
- Preparar visita: dê uma lista curta de perguntas práticas para levar (estado de conservação, valor do condomínio, contas inclusas, documentação, tempo até estações/serviços, regras do condomínio).
- Negociação: sugira uma mensagem ou script de abordagem respeitoso, sem prometer desconto ou resultado.
- Dúvida sobre bairro/cidade sem dado no portal: seja honesto sobre a limitação e ofereça ajudar com o que está disponível.
- Pergunta fora do escopo imobiliário: recuse com gentileza e redirecione para o que você pode fazer aqui.

PRIORIDADE DA MENSAGEM ATUAL
- O pedido mais recente do usuário tem prioridade sobre filtros anteriores quando houver conflito.
- Os filtros estruturados enviados pelo sistema já foram extraídos da mensagem atual; use-os como fonte principal para entender orçamento, tipo, quartos, vagas e características.
- Nunca diga apenas "com os filtros atuais" quando a pessoa acabou de informar um novo critério. Explique quais critérios foram considerados.
- Quando houver até três opções compatíveis, recomende uma principal e explique objetivamente por qu?.
- Quando houver muitas opções, priorize o melhor equilíbrio entre adequação ao pedido, preço, ?rea, quartos e diferenciais realmente informados.
- Se o usuário informar apenas um orçamento, não presuma bairro específico além do filtro jé ativo; informe se a busca permaneceu limitada ao bairro atual.
CONTEXTO E HISTÓRICO DA BUSCA
- O pedido mais recente do usuário tem prioridade sobre filtros anteriores quando houver conflito.
- Só mencione orçamento, cidade, bairro ou outro critério quando ele estiver na mensagem atual ou tiver sido explicitamente mantido no histórico.
- Quando utilizar um critério anterior, diga claramente: "mantendo o critério informado anteriormente".
- Nunca apresente um orçamento antigo como se tivesse sido informado na mensagem atual.
- Para uma mensagem como "casa de três quartos", priorize o tipo e a quantidade de quartos sem mencionar orçamento antigo, salvo se ele ainda estiver explicitamente ativo.
- Se o usuário não informar orçamento na mensagem atual, não diga que o imóvel está "dentro do seu teto" sem explicar que esse limite veio de uma mensagem anterior.
- Quando houver imóveis compatíveis, recomende uma opção principal e explique objetivamente o motivo.
- Se os imóveis forem muito semelhantes, diga que os dados disponíveis não permitem escolher uma opção vencedora.
- Use sempre a forma correta de singular e plural: "1 vaga", "2 vagas", "1 banheiro", "2 banheiros", "1 quarto", "3 quartos".
- Nunca use expressões como "cabem com folga no seu teto", "cabem confortavelmente no seu teto" ou similares.
- Quando o imóvel estiver abaixo do limite informado, escreva apenas: "está dentro do orçamento de R$ X" ou informe diretamente o preço.
- Seja objetivo e não trate um imóvel barato como necessariamente melhor.
FORMATO DA RESPOSTA
- Comece respondendo diretamente — pergunta em 1-2 frases.
- Use bullets ou passos curtos apenas quando isso realmente ajudar a organizar a informação (ex.: comparação, checklist de visita); não force listas em respostas simples.
- Escreva em português do Brasil, sem jargãoo técnico desnecessário, em parágrafos curtos.
- Termine com uma próxima ação concreta (ex.: "quer que eu monte as perguntas para a visita ao IMB-2048?") ou, se faltar contexto essencial, faça no máximo UMA pergunta objetiva.`;
}

// Respostas de contingência quando a LLM está indisponível. Em vez de uma única
// mensagem genérica, usamos palavras-chave da pergunta para escolher a resposta mais
// relevante e já embutimos dados reais do catélogo/mercado para não soar robótico.
function pickFallbackAnswer(
  text: string,
  context: {
    catalogMatches: Array<{
      codigo: string;
      tituloAnuncio: string | null;
      tipo?: string;
      bairro: string;
      cidade: string;
      areaM2?: string | number;
      quartos?: number;
      banheiros?: number;
      vagas?: number;
      valorVenda?: string | number | null;
      valorAluguel?: string | number | null;
      aceitaPets?: boolean;
      varanda?: boolean;
      ensolarado?: boolean;
    }>;
    market: { avgPrice: number };
  },
) {
  const normalized = text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

  const properties = context.catalogMatches.slice(0, 6);

  const formatMoney = (value: string | number | null | undefined) => {
    if (value === null || value === undefined || value === "") return null;
    const number = Number(value);
    if (!Number.isFinite(number)) return String(value);
    return `R$ ${number.toLocaleString("pt-BR")}`;
  };

  const plural = (value: number | undefined, one: string, many: string) => {
    if (value === undefined || value === null) return null;
    return `${value} ${value === 1 ? one : many}`;
  };

  const describeProperty = (property: typeof properties[number]) => {
    const details = [
      property.areaM2 !== undefined ? `${property.areaM2} m²` : null,
      plural(property.quartos, "quarto", "quartos"),
      plural(property.banheiros, "banheiro", "banheiros"),
      plural(property.vagas, "vaga", "vagas"),
    ].filter(Boolean);

    const features = [
      property.varanda ? "varanda" : null,
      property.aceitaPets ? "aceita pets" : null,
      property.ensolarado ? "ensolarado" : null,
    ].filter(Boolean);

    const price =
      formatMoney(property.valorVenda) ||
      (formatMoney(property.valorAluguel)
        ? `${formatMoney(property.valorAluguel)}/mês`
        : "preço não informado");

    return `**${property.codigo}** — ${property.tituloAnuncio || property.tipo || "Imóvel"} | ${details.join(", ")} | ${price}${features.length ? ` | ${features.join(", ")}` : ""}`;
  };

  if (/(visita|visitar|conhecer|agendar)/.test(normalized)) {
    return "Para preparar a visita, recomendo confirmar o estado de conservação, reformas recentes, documentação, valor do condomínio, contas incluídas e condições de negociação. Quer que eu prepare uma lista específica para um dos imóveis?";
  }

  if (/(negocia|desconto|abaixar o preco|proposta)/.test(normalized)) {
    return "Para negociar, apresente uma proposta objetiva com o valor que você pretende pagar e os motivos da oferta. O portal não informa uma margem de desconto garantida, então a condição precisa ser confirmada diretamente com o anunciante.";
  }

  if (properties.length > 0) {
    const intro = normalized.includes("ate") || normalized.includes("maximo")
      ? "Encontrei estas opções dentro dos critérios informados:"
      : "Encontrei estas opções que correspondem ao seu pedido:";

    const list = properties
      .slice(0, 3)
      .map(describeProperty)
      .join("\n");

    const first = properties[0];
    const recommendation =
      properties.length === 1
        ? `Eu começaria pela ${first.codigo}, pois é a única opção encontrada com esses critérios.`
        : "Os dados disponíveis não são suficientes para escolher uma única opção; vale comparar conservação, documentação e condições da visita.";

    return `${intro}\n\n${list}\n\n${recommendation} Quer que eu compare essas opções ou amplie a busca para outros bairros?`;
  }

  const requestedCriteria = [
    /\b(casa|casas)\b/.test(normalized) ? "casas" : null,
    /\b(apartamento|apartamentos|apto)\b/.test(normalized) ? "apartamentos" : null,
    /\b(3|tres)\s*(quartos?|dormitorios?)\b/.test(normalized) ? "3 quartos" : null,
    /\b(varanda|sacada|terraco)\b/.test(normalized) ? "varanda" : null,
    /\b(2|dois)\s*(quartos?|dormitorios?)\b/.test(normalized) ? "2 quartos" : null,
  ].filter(Boolean);

  const criteriaText = requestedCriteria.length
    ? requestedCriteria.join(", ")
    : "os critérios informados";

  return `Não encontrei imóveis no catálogo que atendam a ${criteriaText}${context.catalogMatches.length === 0 ? " dentro da região atualmente selecionada" : ""}. Posso ampliar a busca para outros bairros ou remover algum critério, como varanda, número de quartos ou tipo do imóvel. O que você prefere?`;
}
export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => (opts.ctx.user ? publicUser(opts.ctx.user) : null)),
    register: publicProcedure
      .input(z.object({
        name: z.string().trim().min(2, "Informe seu nome completo (mínimo de 2 caracteres)"),
        email: z.string().trim().email("Informe um email válido"),
        password: z.string().min(8, "A senha deve ter pelo menos 8 caracteres"),
      }))
      .mutation(async ({ input, ctx }) => {
        try {
          const user = await createLocalUser(input);
          const token = await createLocalSession(user.id);
          ctx.res.cookie(LOCAL_SESSION_COOKIE, token, localCookieOptions(ctx.req));
          return publicUser(user);
        } catch (error) {
          throw new TRPCError({ code: "BAD_REQUEST", message: error instanceof Error ? error.message : "Não foi possível criar a conta" });
        }
      }),
    login: publicProcedure
      .input(z.object({ email: z.string().trim().email("Informe um email válido"), password: z.string().min(8, "A senha deve ter pelo menos 8 caracteres") }))
      .mutation(async ({ input, ctx }) => {
        const user = await verifyLocalCredentials(input.email, input.password);
        if (!user) throw new TRPCError({ code: "UNAUTHORIZED", message: "Email ou senha inválidos" });
        const token = await createLocalSession(user.id);
        ctx.res.cookie(LOCAL_SESSION_COOKIE, token, localCookieOptions(ctx.req));
        return publicUser(user);
      }),
    updateProfile: protectedProcedure
      .input(z.object({
        name: z.string().trim().min(2, "Informe seu nome completo (mínimo de 2 caracteres)").optional(),
        email: z.string().trim().email("Informe um email válido").optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        try {
          return publicUser(await updateUserProfile(ctx.user.id, input));
        } catch (error) {
          throw new TRPCError({ code: "BAD_REQUEST", message: error instanceof Error ? error.message : "Não foi possível atualizar o perfil" });
        }
      }),
    logout: publicProcedure.mutation(({ ctx }) => {
      void deleteLocalSession(ctx.req.headers.cookie);
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      if (ctx.req.headers.cookie?.includes(`${LOCAL_SESSION_COOKIE}=`)) {
        ctx.res.clearCookie(LOCAL_SESSION_COOKIE, { ...cookieOptions, maxAge: -1 });
      }
      return { success: true } as const;
    }),
  }),
  dashboard: router({
    summary: publicProcedure.query(() => getDashboardData()),
  }),
  property: router({
    list: publicProcedure
      .input(
        z.object({
          finalidade: z.enum(["compra", "aluguel"]).optional(),
          tipo: z.string().optional(),
          cidade: z.string().optional(),
          bairro: z.string().optional(),
          quartos: z.number().optional(),
          vagas: z.number().optional(),
          valorMin: z.number().optional(),
          valorMax: z.number().optional(),
          aceitaPets: z.boolean().optional(),
          varanda: z.boolean().optional(),
          ensolarado: z.boolean().optional(),
          limit: z.number().int().min(1).max(500).optional(),
          offset: z.number().int().min(0).optional(),
        }).optional(),
      )
      .query(({ input }) => listProperties(input ?? {})),
    mine: protectedProcedure.query(({ ctx }) => listPropertiesForUser(ctx.user.id)),
    create: protectedProcedure
      .input(z.object({
        tipo: z.enum(["Apartamento", "Casa", "Sobrado", "Terreno", "Cobertura"]),
        bairro: z.string().min(2),
        cidade: z.string().default("São Paulo"),
        quartos: z.number().int().min(0).default(0),
        banheiros: z.number().int().min(0).default(0),
        vagas: z.number().int().min(0).default(0),
        areaM2: z.number().positive(),
        aceitaPets: z.boolean().default(false),
        varanda: z.boolean().default(false),
        ensolarado: z.boolean().default(false),
        valorVenda: z.number().positive().optional(),
        valorAluguel: z.number().positive().optional(),
        descricaoTecnica: z.string().optional(),
        tituloAnuncio: z.string().optional(),
        descricaoIa: z.string().optional(),
        imagemUrl: z.string().optional(),
        diferenciais: z.array(z.string()).default([]),
      }))
      .mutation(async ({ input, ctx }) => {
        const copy = await generatePropertyCopy(input);
        return createPropertyForUser(ctx.user.id, {
          tipo: input.tipo,
          bairro: input.bairro,
          cidade: input.cidade,
          quartos: input.quartos,
          banheiros: input.banheiros,
          vagas: input.vagas,
          areaM2: input.areaM2.toFixed(2),
          aceitaPets: input.aceitaPets,
          varanda: input.varanda,
          ensolarado: input.ensolarado,
          valorVenda: input.valorVenda?.toFixed(2),
          valorAluguel: input.valorAluguel?.toFixed(2),
          descricaoTecnica: input.descricaoTecnica,
          descricaoIa: input.descricaoIa || copy.descricao_persuasiva,
          tituloAnuncio: input.tituloAnuncio || copy.titulo_comercial,
          imagemUrl: input.imagemUrl,
          status: "Disponivel",
        });
      }),
    update: protectedProcedure
      .input(z.object({
        imovelId: z.number().int().positive(),
        tipo: z.enum(["Apartamento", "Casa", "Sobrado", "Terreno", "Cobertura"]).optional(),
        bairro: z.string().min(2).optional(),
        cidade: z.string().min(2).optional(),
        quartos: z.number().int().min(0).optional(),
        banheiros: z.number().int().min(0).optional(),
        vagas: z.number().int().min(0).optional(),
        areaM2: z.number().positive().optional(),
        aceitaPets: z.boolean().optional(),
        varanda: z.boolean().optional(),
        ensolarado: z.boolean().optional(),
        valorVenda: z.number().positive().nullable().optional(),
        valorAluguel: z.number().positive().nullable().optional(),
        descricaoTecnica: z.string().optional(),
        tituloAnuncio: z.string().optional(),
        descricaoIa: z.string().optional(),
        diferenciais: z.array(z.string()).optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const { imovelId, ...fields } = input;
        const patch: Record<string, unknown> = {};
        for (const [key, value] of Object.entries(fields)) {
          if (value === undefined) continue;
          if (key === "areaM2" && typeof value === "number") patch[key] = value.toFixed(2);
          else if ((key === "valorVenda" || key === "valorAluguel") && typeof value === "number") patch[key] = value.toFixed(2);
          else patch[key] = value;
        }
        if (!Object.keys(patch).length) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Nada para atualizar" });
        }
        try {
          return await updatePropertyForUser(ctx.user.id, imovelId, patch);
        } catch (error) {
          throw new TRPCError({ code: "NOT_FOUND", message: error instanceof Error ? error.message : "Não foi possível atualizar o imóvel" });
        }
      }),
    remove: protectedProcedure
      .input(z.object({ imovelId: z.number().int().positive() }))
      .mutation(async ({ input, ctx }) => {
        try {
          return await deletePropertyForUser(ctx.user.id, input.imovelId);
        } catch (error) {
          throw new TRPCError({ code: "NOT_FOUND", message: error instanceof Error ? error.message : "Não foi possível excluir o imóvel" });
        }
      }),
    generateCopy: protectedProcedure
      .input(z.object({
        tipo: z.string(), bairro: z.string(), cidade: z.string(), quartos: z.number().int().min(0), banheiros: z.number().int().min(0), vagas: z.number().int().min(0), areaM2: z.number().positive(), valorVenda: z.number().optional(), valorAluguel: z.number().optional(), descricaoTecnica: z.string().optional(), diferenciais: z.array(z.string()).default([]),
      }))
      .mutation(({ input }) => generatePropertyCopy(input)),
    uploadPhotos: protectedProcedure
      .input(z.object({
        imovelId: z.number().int().positive(),
        photos: z.array(z.object({ name: z.string().min(1).max(180), mimeType: z.string().regex(/^image\/(jpeg|png|webp|gif)$/), data: z.string().min(100).max(7_000_000) })).max(20),
      }))
      .mutation(async ({ input, ctx }) => {
        const uploaded = [] as Array<{ fileKey: string; url: string; ordem: number }>;
        for (let index = 0; index < input.photos.length; index += 1) {
          const photo = input.photos[index];
          const safeName = photo.name.replace(/[^a-zA-Z0-9._-]/g, "-");
          const saved = await storagePut(`users/${ctx.user.id}/imoveis/${input.imovelId}/${nanoid(10)}-${safeName}`, Buffer.from(photo.data, "base64"), photo.mimeType);
          uploaded.push({ fileKey: saved.key, url: saved.url, ordem: index });
        }
        return addPropertyPhotos(ctx.user.id, input.imovelId, uploaded);
      }),
  }),
  agent: router({
    parseSearch: publicProcedure.input(z.object({ text: z.string().min(3) })).mutation(async ({ input }) => {
      const fallback = fallbackSearch(input.text);
      try {
        const response = await invokeAgentLLM({
          model: "Qwen/Qwen3.8-27B",
          messages: [
            { role: "system", content: `${agentSystemPrompt}\nModo atual: PARSER_BUSCA. Extraia finalidade (compra ou aluguel), tipo, quartos, vagas, aceita_pets, varanda, ensolarado, cidade, bairro, valor_min, valor_max e diferenciais de uma frase de busca. "cidade" — o município (ex.: Montes Claros, São Paulo); "bairro" — o bairro/regiãoo dentro da cidade, quando informado. "valor_min" e "valor_max" descrevem uma faixa de preão quando a pessoa disser algo como "entre X e Y"; se for apenas um teto ("até X"), preencha só valor_max; se for um piso ("a partir de X"), preencha só valor_min.` },
            { role: "user", content: input.text },
          ],
          responseFormat: { type: "json_schema", json_schema: { name: "imobai_search", strict: true, schema: searchSchema } },
          maxTokens: 300,
        });
        const parsed = normalizeSearchResult(JSON.parse(textFromResponse(response)));
        await saveSearch({ textoBusca: input.text, jsonInterpretado: JSON.stringify(parsed) });
        return { ...parsed, source: "agent" as const };
      } catch {
        await saveSearch({ textoBusca: input.text, jsonInterpretado: JSON.stringify(fallback) });
        return { ...fallback, source: "fallback" as const };
      }
    }),
    generateAd: publicProcedure
      .input(z.object({ tipo: z.string(), quartos: z.number().int().min(0), bairro: z.string(), diferenciais: z.array(z.string()), preco: z.number().min(0) }))
      .mutation(async ({ input }) => {
        const fallback = fallbackAd(input);
        try {
          const response = await invokeAgentLLM({
            model: "Qwen/Qwen3.8-27B",
            messages: [
              { role: "system", content: `${agentSystemPrompt}\nModo atual: GERADOR_ANUNCIO. Crie copy comercial elegante, objetiva e sem promessas indevidas.` },
              { role: "user", content: JSON.stringify(input) },
            ],
            responseFormat: {
              type: "json_schema",
              json_schema: {
                name: "imobai_ad",
                strict: true,
                schema: {
                  type: "object",
                  properties: {
                    titulo_comercial: { type: "string" },
                    descricao_persuasiva: { type: "string" },
                    hashtags: { type: "array", items: { type: "string" } },
                  },
                  required: ["titulo_comercial", "descricao_persuasiva", "hashtags"],
                  additionalProperties: false,
                },
              },
            },
            maxTokens: 400,
          });
          return { ...JSON.parse(textFromResponse(response)), source: "agent" as const };
        } catch {
          return { ...fallback, source: "fallback" as const };
        }
      }),
    suggestPrice: publicProcedure
      .input(z.object({ tipo: z.string(), quartos: z.number().int().min(0), bairro: z.string(), areaM2: z.number().positive(), diferenciais: z.array(z.string()).default([]) }))
      .mutation(async ({ input }) => {
        const similar = await findSimilarProperties(input);
        const values = similar.map(property => Number(property.valorVenda ?? 0) / Number(property.areaM2));
        const avgM2 = values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 11000;
        const premium = input.diferenciais.length * 0.025;
        const suggestedSale = Math.round((avgM2 * input.areaM2 * (1 + premium)) / 10000) * 10000;
        const suggestedRent = Math.round((suggestedSale * 0.0062) / 50) * 50;
        const fallback = {
          preco_sugerido_venda: suggestedSale,
          preco_sugerido_aluguel: suggestedRent,
          justificativa: `A referência considera ${similar.length || 1} imóvel(is) de ${input.bairro}, média de R$ ${Math.round(avgM2).toLocaleString("pt-BR")}/m² e um ajuste de ${(premium * 100).toFixed(1)}% pelos diferenciais informados.`,
          faixa_recomendada: `R$ ${Math.round(suggestedSale * 0.95).toLocaleString("pt-BR")} — R$ ${Math.round(suggestedSale * 1.05).toLocaleString("pt-BR")}`,
          media_m2: Math.round(avgM2),
          similares: similar.length,
        };
        try {
          const response = await invokeAgentLLM({
            model: "Qwen/Qwen3.8-27B",
            messages: [
              { role: "system", content: `${agentSystemPrompt}\nModo atual: SUGESTAO_PRECO. Use a média por m² dos imóveis similares e explique os ajustes de maneira transparente.` },
              { role: "user", content: JSON.stringify({ imovel: input, similares: similar.map(item => ({ bairro: item.bairro, area_m2: item.areaM2, valor_venda: item.valorVenda, tipo: item.tipo })) }) },
            ],
            responseFormat: {
              type: "json_schema",
              json_schema: {
                name: "imobai_price",
                strict: true,
                schema: {
                  type: "object",
                  properties: {
                    preco_sugerido_venda: { type: "number" },
                    preco_sugerido_aluguel: { type: "number" },
                    justificativa: { type: "string" },
                    faixa_recomendada: { type: "string" },
                  },
                  required: ["preco_sugerido_venda", "preco_sugerido_aluguel", "justificativa", "faixa_recomendada"],
                  additionalProperties: false,
                },
              },
            },
            maxTokens: 400,
          });
          return { ...fallback, ...JSON.parse(textFromResponse(response)), source: "agent" as const };
        } catch {
          return { ...fallback, source: "fallback" as const };
        }
      }),
  }),
  conversation: router({
    list: protectedProcedure.query(({ ctx }) => listConversations(ctx.user.id)),
    start: protectedProcedure
      .input(z.object({ imovelId: z.number().int().positive().optional(), proprietarioId: z.number().int().positive() }))
      .mutation(async ({ input, ctx }) => {
        if (input.proprietarioId === ctx.user.id) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Você não pode iniciar uma conversa consigo mesmo" });
        }
        return createConversation({ ...input, compradorId: ctx.user.id });
      }),
    messages: protectedProcedure
      .input(z.object({ conversaId: z.number().int().positive() }))
      .query(({ input, ctx }) => listMessages(ctx.user.id, input.conversaId)),
    send: protectedProcedure
      .input(z.object({ conversaId: z.number().int().positive(), conteudo: z.string().min(1).max(2000) }))
      .mutation(({ input, ctx }) => createMessage(ctx.user.id, input.conversaId, input.conteudo)),
  }),
  aiChat: router({
    history: protectedProcedure.query(({ ctx }) => listAiMessages(ctx.user.id)),
    send: protectedProcedure
      .input(
        z.object({
          text: z.string().min(1).max(4000),
          contexto: z
            .object({
              finalidade: z.enum(["compra", "aluguel"]).optional(),
              tipo: z.string().optional(),
              cidade: z.string().optional(),
              bairro: z.string().optional(),
              quartos: z.number().optional(),
              vagas: z.number().optional(),
              valorMin: z.number().optional(),
              valorMax: z.number().optional(),
              aceitaPets: z.boolean().optional(),
              varanda: z.boolean().optional(),
              ensolarado: z.boolean().optional(),
            })
            .optional(),
        }),
      )
      .mutation(async ({ input, ctx }) => {
        await createAiMessage(ctx.user.id, "user", input.text.trim());
        const history = await listAiMessages(ctx.user.id);

        const searchContext = mergeNaturalPropertyContext(
          input.contexto,
          input.text,
        );
        const [portfolio, catalogMatches, market] = await Promise.all([
          listPropertiesForUser(ctx.user.id),
          listProperties(searchContext),
          getDashboardData(),
        ]);

        const portfolioContext = portfolio.length
          ? portfolio
              .slice(0, 10)
              .map(property => summarizePropertyForAi(property))
              .join("\n")
          : "Nenhum imóvel próprio cadastrado ainda.";

        const catalogContext = catalogMatches.length
          ? catalogMatches
              .slice(0, 6)
              .map(property => summarizePropertyForAi(property))
              .join("\n")
          : "Nenhum imóvel do catélogo bate com os filtros atuais da conversa.";

        const marketContext = [
          `imoveis_ativos: ${market.totalActive}`,
          `preco_medio_geral: R$ ${Math.round(market.avgPrice).toLocaleString("pt-BR")}`,
          `preco_medio_m2_por_bairro: ${market.neighborhoods
            .slice(0, 5)
            .map(item => `${item.bairro} R$ ${Math.round(item.priceM2).toLocaleString("pt-BR")}/m²`)
            .join(", ") || "sem dados"}`,
        ].join("\n");

        const contextoBuscaAtual = Object.keys(searchContext).length
          ? JSON.stringify(searchContext)
          : "Nenhum filtro de busca ativo nesta conversa.";

        const messages = [
          {
            role: "system" as const,
            content: buildConciergeSystemPrompt({ catalogContext, portfolioContext, marketContext, contextoBuscaAtual }),
          },
          ...history.slice(-20).map(message => ({ role: message.role as "user" | "assistant", content: message.conteudo })),
        ];

        let answer = pickFallbackAnswer(input.text, { catalogMatches, market });
        let source: "qwen" | "fallback" = "fallback";
        try {
          const response = await invokeAgentLLM({ model: "Qwen/Qwen3.8-27B", messages, maxTokens: 750 });
          const generated = textFromResponse(response).trim();
          const looksIncomplete =
            generated.length < 80 ||
            /(?:\.\.\.|em Montes$|por R\$\s*[\d.]+$)/i.test(generated);

          if (generated && !looksIncomplete) {
            answer = generated;
            source = "qwen";
          } else if (generated) {
            console.warn("[ImobAI] Resposta curta do Qwen; usando fallback completo.");
          }
        } catch (error) {
          console.warn("[ImobAI] Qwen unavailable, using grounded fallback:", error instanceof Error ? error.message : error);
        }
        const saved = await createAiMessage(ctx.user.id, "assistant", answer);
        return { message: saved, source, model: "Qwen/Qwen3.8-27B" };
      }),
  }),
});

export type AppRouter = typeof appRouter;

function parseBrazilianNumber(value: string): number | undefined {
  const normalized = value
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/r\$/g, "");

  const numberMatch = normalized.match(/[\d.,]+/);
  if (!numberMatch) return undefined;

  const raw = numberMatch[0];

  let number: number;

  if (raw.includes(".") && raw.includes(",")) {
    number = Number(raw.replace(/\./g, "").replace(",", "."));
  } else if (raw.includes(",")) {
    number = Number(raw.replace(",", "."));
  } else if (raw.includes(".")) {
    const parts = raw.split(".");

    // 1.000 ou 1.000.000 representam milhares no padrão brasileiro.
    if (parts.slice(1).every(part => part.length === 3)) {
      number = Number(parts.join(""));
    } else {
      number = Number(raw);
    }
  } else {
    number = Number(raw);
  }

  if (!Number.isFinite(number)) return undefined;

  const lower = normalized;

  if (/(bilh|bi\b)/i.test(lower)) return number * 1_000_000_000;
  if (/(milh|mi\b)/i.test(lower)) return number * 1_000_000;
  if (/(mil\b|k\b)/i.test(lower)) return number * 1_000;

  return number;
}

function extractNaturalPropertyFilters(text: string) {
  const normalized = text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

  const result: {
    tipo?: string;
    quartos?: number;
    vagas?: number;
    valorMin?: number;
    valorMax?: number;
    aceitaPets?: boolean;
    varanda?: boolean;
    ensolarado?: boolean;
    finalidade?: "compra" | "aluguel";
  } = {};

  if (/\b(apartamento|apartamentos|apto|aptos)\b/.test(normalized)) {
    result.tipo = "Apartamento";
  } else if (/\b(casa|casas)\b/.test(normalized)) {
    result.tipo = "Casa";
  } else if (/\b(sobrado|sobrados)\b/.test(normalized)) {
    result.tipo = "Sobrado";
  } else if (/\b(terreno|terrenos|lote|lotes)\b/.test(normalized)) {
    result.tipo = "Terreno";
  } else if (/\b(cobertura|coberturas)\b/.test(normalized)) {
    result.tipo = "Cobertura";
  }

  const roomsMatch = normalized.match(
    /(\d+|um|dois|tres|quatro|cinco|seis)\s*(quartos?|dormitorios?)/,
  );

  if (roomsMatch) {
    const words: Record<string, number> = {
      um: 1,
      dois: 2,
      tres: 3,
      quatro: 4,
      cinco: 5,
      seis: 6,
    };

    result.quartos = Number(roomsMatch[1]) || words[roomsMatch[1]];
  }

  const parkingMatch = normalized.match(
    /(\d+)\s*(vagas?|garagens?)/,
  );

  if (parkingMatch) {
    result.vagas = Number(parkingMatch[1]);
  }

  if (/\b(varanda|sacada|terraco)\b/.test(normalized)) {
    result.varanda = true;
  }

  if (/\b(pet|pets|animal|animais)\b/.test(normalized)) {
    result.aceitaPets = true;
  }

  if (/\b(ensolarado|ensolarada|sol|luz natural)\b/.test(normalized)) {
    result.ensolarado = true;
  }

  if (/\b(alug(ar|uel)|locacao|locar)\b/.test(normalized)) {
    result.finalidade = "aluguel";
  } else if (
    /\b(compr(ar|a)|venda|vender|comprar)\b/.test(normalized)
  ) {
    result.finalidade = "compra";
  }

  const maxPatterns = [
    /(?:ate|até|no maximo de?|máximo de?|por no maximo|por no máximo|menos de|menor que)\s*(?:r\$\s*)?([\d.,]+\s*(?:milhao|milhões?|mil|mi|k)?)/i,
  ];

  for (const pattern of maxPatterns) {
    const match = normalized.match(pattern);
    if (match) {
      const value = parseBrazilianNumber(match[1]);
      if (value !== undefined) {
        result.valorMax = value;
        break;
      }
    }
  }

  const minPatterns = [
    /(?:a partir de|acima de|mais de|maior que|minimo de|mínimo de)\s*(?:r\$\s*)?([\d.,]+\s*(?:milhao|milhões?|mil|mi|k)?)/i,
  ];

  for (const pattern of minPatterns) {
    const match = normalized.match(pattern);
    if (match) {
      const value = parseBrazilianNumber(match[1]);
      if (value !== undefined) {
        result.valorMin = value;
        break;
      }
    }
  }

  return result;
}

function mergeNaturalPropertyContext(
  previous: Record<string, unknown> | undefined,
  text: string,
) {
  const extracted = extractNaturalPropertyFilters(text);

  return {
    ...(previous ?? {}),
    ...extracted,
  };
}










