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

const agentSystemPrompt = `VocÃª â€” o ImobAI Agent, um assistente especialista no mercado imobiliÃ¡rio brasileiro integrado a um sistema de gestÃ¡o.
VocÃª opera em trÃªs modos: PARSER_BUSCA, GERADOR_ANUNCIO e SUGESTAO_PRECO.
Sempre responda com JSON vÃ¡lido, sem markdown, sem comentÃ¡rios e sem inventar informaÃ§Ãµes que nÃ£o estejam na entrada.`;

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

// Cidades conhecidas para extraÃ§Ã£o de "finalidade"/"cidade" no modo fallback (sem LLM).
// MantÃ©m curta de propÃ³sito: cobre a base de demonstraÃ§Ã£o (SÃ£o Paulo) e as cidades
// mais citadas em exemplos de busca, incluindo Montes Claros.
const KNOWN_CITIES = [
  "Montes Claros",
  "SÃ£o Paulo",
  "Belo Horizonte",
  "Rio de Janeiro",
  "Curitiba",
  "UberlÃ¢ndia",
  "Contagem",
  "Betim",
];

function detectFinalidade(normalized: string): "compra" | "aluguel" | null {
  const rentSignals = ["alugar", "aluguel", "locaÃ§Ã£o", "locacao", "locar", "arrendar"];
  const buySignals = ["comprar", "compra", "adquirir", "aquisiÃ§Ã£o", "aquisicao", "financiar", "financiamento"];
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

  // O Qwen3 (roteador da Hugging Face) pode devolver o campo de raciocÃ­nio
  // (reasoning) com o "content" vazio. Nesse caso usamos o raciocÃ­nio como
  // texto â€” melhor do que devolver uma string vazia e cair no fallback.
  const reasoning = message?.reasoning_content ?? message?.reasoning;
  return typeof reasoning === "string" ? reasoning.trim() : "";
}

// Extrai todas as menÃ§Ãµes de valores monetÃ¡rios da frase, na ordem em que aparecem,
// jÃ¡ convertidas para nÃºmero (aceita "mil", "milhÃ£o/milhÃµes" e "R$ 1.234,56").
function extractAllMoneyValues(text: string): number[] {
  const pattern = /(?:R\$\s*)?(\d+(?:[.,]\d+)?)\s*(\bmi\b|milh(?:Ã£o|oes|Ãµes)|mil)?/gi;
  const values: number[] = [];
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(text)) !== null) {
    const [, rawNumber, unit] = match;
    if (!rawNumber) continue;
    const number = Number(rawNumber.replace(",", "."));
    if (Number.isNaN(number)) continue;
    // Ignora nÃºmeros soltos que claramente nÃ£o sÃ£o valores (ex.: "2 quartos"), a menos
    // que estejam prefixados por "R$" ou tenham uma unidade de milhar/milhÃ£o explÃ­cita.
    const hasCurrencyPrefix = text.slice(Math.max(0, match.index - 3), match.index).includes("R$");
    if (!unit && !hasCurrencyPrefix) continue;
    const normalizedUnit = unit?.toLowerCase();
    const multiplier = normalizedUnit === "mil" ? 1_000 : normalizedUnit?.startsWith("mi") ? 1_000_000 : 1;
    values.push(Math.round(number * multiplier));
  }
  return values;
}

// Interpreta faixas de preÃ§o: "entre 250 e 300 mil", "a partir de R$ 200 mil",
// "atÃ© R$ 300 mil" ou um valor Ãºnico (tratado como teto, como antes).
function parseMoneyRange(text: string): { valorMin: number | null; valorMax: number | null } {
  const normalized = text.toLowerCase();
  const values = extractAllMoneyValues(text);
  if (values.length === 0) return { valorMin: null, valorMax: null };

  if (/\bentre\b/.test(normalized) && values.length >= 2) {
    const [a, b] = values;
    return { valorMin: Math.min(a, b), valorMax: Math.max(a, b) };
  }

  const isFloor = /(a partir de|acima de|mÃ­nimo de|minimo de|no mÃ­nimo|no minimo)/.test(normalized);
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
          : normalized.includes("apartamento") || normalized.includes("apÃª") || normalized.includes("ape")
            ? "Apartamento"
            : null;
  const bedroomMatch = normalized.match(/(\d+)\s*(?:quarto|quartos|dorm|dormitÃ³rio|dormitÃ³rios)/);
  const parkingMatch = normalized.match(/(\d+)\s*(?:vaga|vagas)/);
  const hasUnquantifiedGarage = /\bgaragem\b/.test(normalized) && !parkingMatch;
  const knownNeighborhoods = ["Pinheiros", "Vila Madalena", "Moema", "Alto de Pinheiros", "Itaim Bibi", "SaÃºde", "Perdizes", "Jardins"];
  const bairro = knownNeighborhoods.find(item => normalized.includes(item.toLowerCase())) ?? null;
  const diferenciais = [
    normalized.includes("pet") || normalized.includes("cachorro") || normalized.includes("gato") ? "aceita pets" : null,
    normalized.includes("varanda") || normalized.includes("terraÃ§oo") || normalized.includes("terraco") ? "varanda" : null,
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
    descricao_persuasiva: `Uma oportunidade para viver bem${input.bairro ? ` em ${input.bairro}` : ""}. Este ${input.tipo.toLowerCase()} combina uma planta confortÃ¡vel${differenceText} e estÃ¡ pronto para receber novas histÃ³rias. Agende uma visita e descubra todos os detalhes.`,
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
    descricao_persuasiva: `ConheÃ§a este ${input.tipo.toLowerCase()} em ${input.bairro}, ${input.cidade}, com ${input.areaM2} mÂ², ${input.quartos} quartos, ${input.banheiros} banheiros e ${input.vagas} vagas. ${input.descricaoTecnica || "Uma oportunidade para viver com praticidade, conforto e boa localizaÃ§Ã£o."} Agende uma visita para conhecer todos os detalhes.`,
    destaques: input.diferenciais,
    cta: "Agende uma visita e converse com o anunciante.",
    hashtags: [`#${input.tipo.replace(/\s/g, "")}`, `#${input.bairro.replace(/\s/g, "")}`, "#ImoveisSP"],
  };
  try {
    const response = await invokeAgentLLM({
      model: "Qwen/Qwen3.8-27B",
      messages: [
        { role: "system", content: `VocÃª â€” um redator imobiliÃ¡rio brasileiro de alta conversÃ£o. Gere textos claros, elegantes e confiÃ¡veis para um anÃºncio. Use apenas os fatos fornecidos; nunca invente metragem, vista, reformas, condomÃ­nio, distÃ¢ncia, documentaÃ§Ã£o, seguranÃ§aa ou amenidades. Destaque benefÃ­cios sem promessas absolutas. A descriÃ§Ã£o deve ter 2 ou 3 parÃ¡grafos curtos, incluir os dados objetivos, contexto do bairro somente quando fornecido, diferenciais informados e uma chamada para visita. Escreva em portuguÃªs do Brasil, sem markdown.` },
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
  similarCatalogContext: string;
  portfolioContext: string;
  marketContext: string;
  contextoBuscaAtual: string;
}) {
  return `VocÃª â€” o ImobAI Concierge, o consultor imobiliÃ¡rio digital de um portal brasileiro. VocÃª atende, na mesma conversa, compradores, locatÃ©rios, proprietÃ¡rios e corretores sobre apartamentos, casas, sobrados, coberturas e terrenos.

QUEM VOCÃŠ â€”
- Objetivo, caloroso e direto ao ponto â€” como um corretor experiente que respeita o tempo do cliente.
- Especialista em interpretar a intenÃ§Ã£o por trÃªs da pergunta (comprar, alugar, comparar, negociar, agendar visita, entender um bairro) e responder exatamente para essa intenÃ§Ã£o.
- Nunca robÃ³tico: varie a abertura das respostas, evite repetir a mesma frase de efeito em toda mensagem.

FONTES DE DADOS DISPONÃVEIS (Ã© a ÃšNICA verdade que vocÃª pode usar â€” nunca invente nada alÃ©m disso)
1. Filtro de busca ativo na conversa (o que a pessoa jÃ¡ disse que procura):
${context.contextoBuscaAtual}
2. ImÃ³veis do catÃ¡logo compatÃ©veis com esse filtro (atÃ© 6, formato JSON por linha â€” "codigo" identifica o imÃ³vel):
${context.catalogContext}
2A. ALTERNATIVAS SEMELHANTES â€” somente quando nÃ£o existe correspondÃªncia exata (mÃ¡ximo 2):
${context.similarCatalogContext}
IMPORTANTE: estas alternativas NÃƒO atendem necessariamente a todos os critÃ©rios originais. Ao mencionÃ¡-las, explique objetivamente o que Ã© diferente. Nunca apresente uma alternativa semelhante como correspondÃªncia exata.
3. PortfÃ³lio privado do usuÃ¡rio logado (imÃ³veis que ELE mesmo cadastrou como anunciante, nÃ£o como comprador):
${context.portfolioContext}
4. Indicadores de mercado do portal:
${context.marketContext}

REGRAS DE OURO
- Toda vez que vocÃª mencionar um imÃ³vel especÃ­fico, cite o cÃ³digo dele (ex.: "o IMB-2048"). Nunca descreva um imÃ³vel que nÃ£o esteja em uma das listas acima.
- Se a pergunta pedir algo que os dados acima nÃ£o cobrem (endereÃ§o exato, documentaÃ§Ã£o, situaÃ§Ã£o de condomÃ­nio, reformas, vista, seguranÃ§aa do prÃ©dio, motivo da venda, margem de negociaÃ§Ã£o do proprietÃ¡rio), diga claramente que essa informaÃ§Ã£o nÃ£o estÃ¡ disponÃ­vel aqui e oriente a confirmar diretamente com o anunciante ou na visita.
- PreÃ§o sugerido ou faixa de mercado â€” sempre uma referÃªncia estatÃ­stica, nunca uma avaliaÃ§Ã£o formal â€” deixe isso explÃ­cito quando falar de valores.
- Nunca dÃª parecer jurÃ­dico, financeiro (ex.: aprovaÃ§Ã£o de financiamento) ou de engenharia estrutural; nesses casos, recomende falar com o profissional habilitado (advogado, correspondente bancÃ¡rio, engenheiro/perito), sem se recusar a ajudar com o que estÃ¡ ao seu alcance.
- Se o catÃ¡logo nÃ£o tiver nenhum imÃ³vel compatÃ­vel com o que a pessoa quer (ex.: cidade sem cobertura no portal), diga isso com honestidade e sugira o prÃ³ximo passo (ajustar o filtro, cadastrar um alerta, ou ampliar bairro/cidade) em vez de inventar opÃ§Ãµes.

COMO RESPONDER PARA CADA TIPO DE PERGUNTA
- Comparar imÃ³veis: monte uma comparaÃ§Ã£o objetiva (preÃ§o, mÂ², quartos, vagas, diferenciais) usando sÃ³ os imÃ³veis do catÃ¡logo/portfÃ³lio acima, e termine indicando qual se encaixa melhor no que a pessoa pediu e por quÃª.
- PreÃ§o / "vale a pena esse valor?": use o mÂ² mÃ©dio do bairro nos indicadores de mercado quando disponÃ­vel; se nÃ£o houver dado do bairro pedido, diga isso e use a mÃ©dia geral como referÃªncia aproximada.
- Preparar visita: dÃª uma lista curta de perguntas prÃ¡ticas para levar (estado de conservaÃ§Ã£o, valor do condomÃ­nio, contas inclusas, documentaÃ§Ã£o, tempo atÃ© estaÃ§Ãµes/serviÃ§os, regras do condomÃ­nio).
- NegociaÃ§Ã£o: sugira uma mensagem ou script de abordagem respeitoso, sem prometer desconto ou resultado.
- DÃºvida sobre bairro/cidade sem dado no portal: seja honesto sobre a limitaÃ§Ã£o e ofereÃ§a ajudar com o que estÃ¡ disponÃ­vel.
- Pergunta fora do escopo imobiliÃ¡rio: recuse com gentileza e redirecione para o que vocÃª pode fazer aqui.

PRIORIDADE DA MENSAGEM ATUAL
- O pedido mais recente do usuÃ¡rio tem prioridade sobre filtros anteriores quando houver conflito.
- Os filtros estruturados enviados pelo sistema jÃ¡ foram extraÃ­dos da mensagem atual; use-os como fonte principal para entender orÃ§amento, tipo, quartos, vagas e caracterÃ­sticas.
- Nunca diga apenas "com os filtros atuais" quando a pessoa acabou de informar um novo critÃ©rio. Explique quais critÃ©rios foram considerados.
- Quando houver atÃ© trÃªs opÃ§Ãµes compatÃ­veis, recomende uma principal e explique objetivamente por qu?.
- Quando houver muitas opÃ§Ãµes, priorize o melhor equilÃ­brio entre adequaÃ§Ã£o ao pedido, preÃ§o, ?rea, quartos e diferenciais realmente informados.
- Se o usuÃ¡rio informar apenas um orÃ§amento, nÃ£o presuma bairro especÃ­fico alÃ©m do filtro jÃ¡ ativo; informe se a busca permaneceu limitada ao bairro atual.
CONTEXTO E HISTÃ“RICO DA BUSCA
- O pedido mais recente do usuÃ¡rio tem prioridade sobre filtros anteriores quando houver conflito.
- SÃ³ mencione orÃ§amento, cidade, bairro ou outro critÃ©rio quando ele estiver na mensagem atual ou tiver sido explicitamente mantido no histÃ³rico.
- Quando utilizar um critÃ©rio anterior, diga claramente: "mantendo o critÃ©rio informado anteriormente".
- Nunca apresente um orÃ§amento antigo como se tivesse sido informado na mensagem atual.
- Para uma mensagem como "casa de trÃªs quartos", priorize o tipo e a quantidade de quartos sem mencionar orÃ§amento antigo, salvo se ele ainda estiver explicitamente ativo.
- Se o usuÃ¡rio nÃ£o informar orÃ§amento na mensagem atual, nÃ£o diga que o imÃ³vel estÃ¡ "dentro do seu teto" sem explicar que esse limite veio de uma mensagem anterior.
- Quando houver imÃ³veis compatÃ­veis, recomende uma opÃ§Ã£o principal e explique objetivamente o motivo.
- Se os imÃ³veis forem muito semelhantes, diga que os dados disponÃ­veis nÃ£o permitem escolher uma opÃ§Ã£o vencedora.
- Use sempre a forma correta de singular e plural: "1 vaga", "2 vagas", "1 banheiro", "2 banheiros", "1 quarto", "3 quartos".
- Nunca use expressÃµes como "cabem com folga no seu teto", "cabem confortavelmente no seu teto" ou similares.
- Quando o imÃ³vel estiver abaixo do limite informado, escreva apenas: "estÃ¡ dentro do orÃ§amento de R$ X" ou informe diretamente o preÃ§o.
- Seja objetivo e nÃ£o trate um imÃ³vel barato como necessariamente melhor.
FORMATO DA RESPOSTA
- Comece respondendo diretamente â€” pergunta em 1-2 frases.
- Use bullets ou passos curtos apenas quando isso realmente ajudar a organizar a informaÃ§Ã£o (ex.: comparaÃ§Ã£o, checklist de visita); nÃ£o force listas em respostas simples.
- Escreva em portuguÃªs do Brasil, sem jargÃ£o tÃ©cnico desnecessÃ¡rio, em parÃ¡grafos curtos.
- Termine com uma prÃ³xima aÃ§Ã£o concreta (ex.: "quer que eu monte as perguntas para a visita ao IMB-2048?") ou, se faltar contexto essencial, faÃ§a no mÃ¡ximo UMA pergunta objetiva.`;
}

// Respostas de contingÃªncia quando a LLM estÃ¡ indisponÃ­vel. Em vez de uma Ãºnica
// mensagem genÃ©rica, usamos palavras-chave da pergunta para escolher a resposta mais
// relevante e jÃ¡ embutimos dados reais do catÃ¡logo/mercado para nÃ£o soar robÃ³tico.

type ConciergeProperty = Awaited<ReturnType<typeof listProperties>>[number];

async function findConciergeSimilarProperties(
  searchContext: NonNullable<Parameters<typeof listProperties>[0]>,
): Promise<ConciergeProperty[]> {
  const requestedPrice = Number(searchContext.valorMax ?? 0);
  const requestedBedrooms = Number(searchContext.quartos ?? 0);

  const baseFilters = {
    finalidade: searchContext.finalidade,
    tipo: searchContext.tipo,
    cidade: searchContext.cidade,
  };

  const candidates: ConciergeProperty[] = [];

  // 1.Âª tentativa:
  // mantÃ©m cidade, tipo, finalidade e quantidade mÃ­nima de quartos,
  // flexibilizando o orÃ§amento em atÃ© 10%.
  if (requestedPrice > 0) {
    const firstPass = await listProperties({
      ...baseFilters,
      quartos: searchContext.quartos,
      valorMax: Math.round(requestedPrice * 1.1),
    });

    candidates.push(...firstPass);
  }

  // 2.Âª tentativa:
  // mantÃ©m cidade, tipo e finalidade, flexibilizando quartos,
  // mas limita o preÃ§o a no mÃ¡ximo 20% acima do teto informado.
  if (candidates.length < 2 && requestedPrice > 0) {
    const secondPass = await listProperties({
      ...baseFilters,
      valorMax: Math.round(requestedPrice * 1.2),
    });

    candidates.push(...secondPass);
  }

  // Se o cliente nÃ£o informou preÃ§o, podemos procurar na cidade/tipo
  // normalmente, pois nÃ£o existe um teto financeiro para respeitar.
  if (candidates.length < 2 && requestedPrice <= 0) {
    const fallbackPass = await listProperties({
      ...baseFilters,
    });

    candidates.push(...fallbackPass);
  }

  const unique = Array.from(
    new Map(candidates.map(property => [property.id, property])).values(),
  );

  if (!unique.length) return [];

  const scored = unique.map(property => {
    const price = Number(
      searchContext.finalidade === "aluguel"
        ? property.valorAluguel ?? 0
        : property.valorVenda ?? 0,
    );

    const bedrooms = Number(property.quartos ?? 0);

    let score = 0;

    if (
      searchContext.tipo &&
      property.tipo?.toLowerCase() ===
        searchContext.tipo.toLowerCase()
    ) {
      score += 40;
    }

    if (
      searchContext.cidade &&
      property.cidade?.toLowerCase() ===
        searchContext.cidade.toLowerCase()
    ) {
      score += 35;
    }

    if (
      searchContext.bairro &&
      property.bairro?.toLowerCase() ===
        searchContext.bairro.toLowerCase()
    ) {
      score += 15;
    }

    if (requestedBedrooms > 0) {
      const bedroomDifference = Math.abs(
        bedrooms - requestedBedrooms,
      );

      score += Math.max(
        0,
        25 - bedroomDifference * 15,
      );
    }

    if (requestedPrice > 0 && price > 0) {
      const percentage =
        Math.abs(price - requestedPrice) / requestedPrice;

      score += Math.max(
        0,
        30 - percentage * 100,
      );

      if (price > requestedPrice) {
        score -= Math.min(
          20,
          ((price - requestedPrice) / requestedPrice) * 100,
        );
      }
    }

    if (
      searchContext.vagas &&
      property.vagas !== undefined &&
      property.vagas >= searchContext.vagas
    ) {
      score += 8;
    }

    if (searchContext.varanda && property.varanda) {
      score += 5;
    }

    if (searchContext.aceitaPets && property.aceitaPets) {
      score += 5;
    }

    if (searchContext.ensolarado && property.ensolarado) {
      score += 5;
    }

    return { property, score };
  });

  scored.sort((a, b) => b.score - a.score);

  return scored
    .slice(0, 2)
    .map(item => item.property);
}

function buildNonSearchFallback(
  text: string,
  intent: ConciergeIntent,
  market: {
    avgPrice: number;
    totalActive: number;
    neighborhoods: Array<{ bairro: string; priceM2: number }>;
  },
) {
  const normalized = text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();

  if (intent === "mercado") {
    const bairroMatch = normalized.match(/(?:no|na|em)\s+([a-z0-9À-ÿ ]+)/i);
    const bairro = bairroMatch?.[1]?.trim();

    if (bairro) {
      const found = market.neighborhoods.find(
        item => item.bairro.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "") === bairro,
      );

      if (found) {
        return `No catálogo atual do ImobAI, o preço médio por m² em ${found.bairro} está em aproximadamente R$ ${Math.round(found.priceM2).toLocaleString("pt-BR")}/m². Esse valor é uma referência do catálogo disponível e não representa necessariamente o preço de todos os imóveis do bairro.`;
      }
    }

    return `No catálogo atual do ImobAI, há ${market.totalActive} imóveis ativos e o preço médio geral é de aproximadamente R$ ${Math.round(market.avgPrice).toLocaleString("pt-BR")}. Esses números são referências do catálogo disponível e podem não representar todo o mercado imobiliário da região.`;
  }

  if (intent === "opiniao" || intent === "informacao") {
    const bairroMatch = normalized.match(/(?:morar|bairro|regiao|em|no|na)\s+(?:no|na|em)?\s*([a-z0-9À-ÿ ]+)/i);
    const bairro = bairroMatch?.[1]?.trim();

    if (bairro) {
      const found = market.neighborhoods.find(
        item => item.bairro.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").includes(bairro),
      );

      if (found) {
        return `Sobre morar em ${found.bairro}, o catálogo atual do ImobAI indica um preço médio de aproximadamente R$ ${Math.round(found.priceM2).toLocaleString("pt-BR")}/m². Para avaliar se o bairro combina com você, também vale considerar acesso, comércio, transporte, segurança e o tipo de imóvel que procura. O ImobAI não possui dados suficientes no momento para afirmar esses outros aspectos com segurança.`;
      }
    }

    return "Posso ajudar a avaliar um bairro ou uma região, mas preciso separar opinião de dados objetivos. No momento, o ImobAI possui principalmente dados de imóveis e referências de mercado; se você me disser o bairro ou a região, posso usar esses dados sem inventar características que não estejam disponíveis.";
  }

  if (intent === "comparacao") {
    return "Posso comparar os imóveis ou bairros que você indicar. Para uma comparação objetiva, vou considerar apenas os dados disponíveis no ImobAI, como preço, área, quartos, banheiros, vagas e outras características cadastradas.";
  }

  if (intent === "imovel_especifico") {
    return "Posso consultar um imóvel específico pelo código IMB. Para manter a resposta confiável, vou usar somente os dados cadastrados para aquele imóvel e não preencher informações que não estejam disponíveis.";
  }

  return "Posso ajudar com informações sobre imóveis, bairros e mercado imobiliário usando os dados disponíveis no ImobAI. Se quiser, me diga o que você gostaria de saber."; 
}

function pickFallbackAnswer(
  text: string,
  intent: ConciergeIntent,
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
    similarMatches: Array<{
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
      property.areaM2 !== undefined ? `${property.areaM2} mÂ²` : null,
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
        ? `${formatMoney(property.valorAluguel)}/mÃªs`
        : "preÃ§o nÃ£o informado");

    return `**${property.codigo}** â€” ${property.tituloAnuncio || property.tipo || "ImÃ³vel"} | ${details.join(", ")} | ${price}${features.length ? ` | ${features.join(", ")}` : ""}`;
  };

  if (intent !== "busca_imovel") {
    return "";
  }

  if (/(visita|visitar|conhecer|agendar)/.test(normalized)) {
    return "Para preparar a visita, recomendo confirmar o estado de conservaÃ§Ã£o, reformas recentes, documentaÃ§Ã£o, valor do condomÃ­nio, contas incluÃ­das e condiÃ§Ãµes de negociaÃ§Ã£o. Quer que eu prepare uma lista especÃ­fica para um dos imÃ³veis?";
  }

  if (/(negocia|desconto|abaixar o preco|proposta)/.test(normalized)) {
    return "Para negociar, apresente uma proposta objetiva com o valor que vocÃª pretende pagar e os motivos da oferta. O portal nÃ£o informa uma margem de desconto garantida, entÃ£o a condiÃ§Ã£o precisa ser confirmada diretamente com o anunciante.";
  }

  if (
    properties.length === 0 &&
    context.similarMatches.length > 0
  ) {
    const similar = context.similarMatches.slice(0, 2);

    const requestedPriceMatch = normalized.match(
      /(?:ate|maximo|teto de)\s+r?\$?\s*([\d.,]+)/i,
    );

    let requestedPrice: number | null = null;

    if (requestedPriceMatch) {
      const raw = requestedPriceMatch[1]
        .replace(/\./g, "")
        .replace(",", ".");

      const parsed = Number(raw);

      if (Number.isFinite(parsed)) {
        requestedPrice = parsed;
      }
    }

    const requestedBedroomsMatch = normalized.match(
      /(\d+)\s*(?:quartos?|dormitorios?)/i,
    );

    const requestedBedrooms = requestedBedroomsMatch
      ? Number(requestedBedroomsMatch[1])
      : null;

    const explainDifference = (
      property: typeof similar[number],
    ) => {
      const differences: string[] = [];

      if (
        requestedBedrooms !== null &&
        property.quartos !== undefined &&
        Number(property.quartos) !== requestedBedrooms
      ) {
        differences.push(
          `${property.quartos} ${
            property.quartos === 1 ? "quarto" : "quartos"
          }`,
        );
      }

      const propertyPrice = Number(
        property.valorVenda ??
        property.valorAluguel ??
        0,
      );

      if (
        requestedPrice !== null &&
        propertyPrice > 0 &&
        propertyPrice !== requestedPrice
      ) {
        if (propertyPrice > requestedPrice) {
          differences.push(
            `${formatMoney(propertyPrice)} acima do orÃ§amento`,
          );
        } else {
          differences.push(
            `preÃ§o de ${formatMoney(propertyPrice)}`,
          );
        }
      }

      return differences.length
        ? differences.join(" e ")
        : "outros critÃ©rios prÃ³ximos ao pedido";
    };

    const list = similar
      .map(
        property =>
          `${describeProperty(property)} â€” diferenÃ§a principal: ${explainDifference(property)}.`,
      )
      .join("\n");

    return `NÃ£o encontrei um imÃ³vel que atenda exatamente aos critÃ©rios. Separei ${similar.length === 1 ? "1 opÃ§Ã£o semelhante" : "2 opÃ§Ãµes semelhantes"} do catÃ¡logo:\n\n${list}\n\nAs opÃ§Ãµes acima sÃ£o imÃ³veis reais do catÃ¡logo, mas nÃ£o correspondem exatamente a todos os critÃ©rios informados.`;
  }

  if (properties.length > 0) {
    const intro = normalized.includes("ate") || normalized.includes("maximo")
      ? "Encontrei estas opÃ§Ãµes dentro dos critÃ©rios informados:"
      : "Encontrei estas opÃ§Ãµes que correspondem ao seu pedido:";

    const list = properties
      .slice(0, 3)
      .map(describeProperty)
      .join("\n");

    const first = properties[0];
    const recommendation =
      properties.length === 1
        ? `Eu comeÃ§aria pela ${first.codigo}, pois Ã© a Ãºnica opÃ§Ã£o encontrada com esses critÃ©rios.`
        : "Os dados disponÃ­veis nÃ£o sÃ£o suficientes para escolher uma Ãºnica opÃ§Ã£o; vale comparar conservaÃ§Ã£o, documentaÃ§Ã£o e condiÃ§Ãµes da visita.";

    return `${intro}\n\n${list}\n\n${recommendation} Quer que eu compare essas opÃ§Ãµes ou amplie a busca para outros bairros?`;
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
    : "os critÃ©rios informados";

  return `NÃ£o encontrei imÃ³veis no catÃ¡logo que atendam a ${criteriaText}${context.catalogMatches.length === 0 ? " dentro da regiÃ£o atualmente selecionada" : ""}. Posso ampliar a busca para outros bairros ou remover algum critÃ©rio, como varanda, nÃºmero de quartos ou tipo do imÃ³vel. O que vocÃª prefere?`;
}
export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => (opts.ctx.user ? publicUser(opts.ctx.user) : null)),
    register: publicProcedure
      .input(z.object({
        name: z.string().trim().min(2, "Informe seu nome completo (mÃ­nimo de 2 caracteres)"),
        email: z.string().trim().email("Informe um email vÃ¡lido"),
        password: z.string().min(8, "A senha deve ter pelo menos 8 caracteres"),
      }))
      .mutation(async ({ input, ctx }) => {
        try {
          const user = await createLocalUser(input);
          const token = await createLocalSession(user.id);
          ctx.res.cookie(LOCAL_SESSION_COOKIE, token, localCookieOptions(ctx.req));
          return publicUser(user);
        } catch (error) {
          throw new TRPCError({ code: "BAD_REQUEST", message: error instanceof Error ? error.message : "NÃ£o foi possÃ­vel criar a conta" });
        }
      }),
    login: publicProcedure
      .input(z.object({ email: z.string().trim().email("Informe um email vÃ¡lido"), password: z.string().min(8, "A senha deve ter pelo menos 8 caracteres") }))
      .mutation(async ({ input, ctx }) => {
        const user = await verifyLocalCredentials(input.email, input.password);
        if (!user) throw new TRPCError({ code: "UNAUTHORIZED", message: "Email ou senha invÃ¡lidos" });
        const token = await createLocalSession(user.id);
        ctx.res.cookie(LOCAL_SESSION_COOKIE, token, localCookieOptions(ctx.req));
        return publicUser(user);
      }),
    updateProfile: protectedProcedure
      .input(z.object({
        name: z.string().trim().min(2, "Informe seu nome completo (mÃ­nimo de 2 caracteres)").optional(),
        email: z.string().trim().email("Informe um email vÃ¡lido").optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        try {
          return publicUser(await updateUserProfile(ctx.user.id, input));
        } catch (error) {
          throw new TRPCError({ code: "BAD_REQUEST", message: error instanceof Error ? error.message : "NÃ£o foi possÃ­vel atualizar o perfil" });
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
        cidade: z.string().default("SÃ£o Paulo"),
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
          throw new TRPCError({ code: "NOT_FOUND", message: error instanceof Error ? error.message : "NÃ£o foi possÃ­vel atualizar o imÃ³vel" });
        }
      }),
    remove: protectedProcedure
      .input(z.object({ imovelId: z.number().int().positive() }))
      .mutation(async ({ input, ctx }) => {
        try {
          return await deletePropertyForUser(ctx.user.id, input.imovelId);
        } catch (error) {
          throw new TRPCError({ code: "NOT_FOUND", message: error instanceof Error ? error.message : "NÃ£o foi possÃ­vel excluir o imÃ³vel" });
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
            { role: "system", content: `${agentSystemPrompt}\nModo atual: PARSER_BUSCA. Extraia finalidade (compra ou aluguel), tipo, quartos, vagas, aceita_pets, varanda, ensolarado, cidade, bairro, valor_min, valor_max e diferenciais de uma frase de busca. "cidade" â€” o municÃ­pio (ex.: Montes Claros, SÃ£o Paulo); "bairro" â€” o bairro/regiÃ£oo dentro da cidade, quando informado. "valor_min" e "valor_max" descrevem uma faixa de preÃ§o quando a pessoa disser algo como "entre X e Y"; se for apenas um teto ("atÃ© X"), preencha sÃ³ valor_max; se for um piso ("a partir de X"), preencha sÃ³ valor_min.` },
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
          justificativa: `A referÃªncia considera ${similar.length || 1} imÃ³vel(is) de ${input.bairro}, mÃ©dia de R$ ${Math.round(avgM2).toLocaleString("pt-BR")}/mÂ² e um ajuste de ${(premium * 100).toFixed(1)}% pelos diferenciais informados.`,
          faixa_recomendada: `R$ ${Math.round(suggestedSale * 0.95).toLocaleString("pt-BR")} â€” R$ ${Math.round(suggestedSale * 1.05).toLocaleString("pt-BR")}`,
          media_m2: Math.round(avgM2),
          similares: similar.length,
        };
        try {
          const response = await invokeAgentLLM({
            model: "Qwen/Qwen3.8-27B",
            messages: [
              { role: "system", content: `${agentSystemPrompt}\nModo atual: SUGESTAO_PRECO. Use a mÃ©dia por mÂ² dos imÃ³veis similares e explique os ajustes de maneira transparente.` },
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
          throw new TRPCError({ code: "BAD_REQUEST", message: "VocÃª nÃ£o pode iniciar uma conversa consigo mesmo" });
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

        const intent = classifyConciergeIntent(input.text);

        const shouldSearchCatalog = intent === "busca_imovel";

        const searchContext = shouldSearchCatalog
          ? mergeNaturalPropertyContext(
              input.contexto,
              input.text,
            )
          : {};

        const [portfolio, catalogMatches, market] = await Promise.all([
          shouldSearchCatalog
            ? listPropertiesForUser(ctx.user.id)
            : Promise.resolve([]),
          shouldSearchCatalog
            ? listProperties(searchContext)
            : Promise.resolve([]),
          getDashboardData(),
        ]);

        const similarMatches =
          shouldSearchCatalog && catalogMatches.length === 0
            ? await findConciergeSimilarProperties(searchContext)
            : [];

        const portfolioContext = portfolio.length
          ? portfolio
              .slice(0, 10)
              .map(property => summarizePropertyForAi(property))
              .join("\n")
          : "Nenhum imÃ³vel prÃ³prio cadastrado ainda.";

        const similarCatalogContext = similarMatches.length
          ? similarMatches
              .slice(0, 2)
              .map(property => summarizePropertyForAi(property))
              .join("\n")
          : "Nenhuma alternativa semelhante encontrada.";

        const catalogContext = catalogMatches.length
          ? catalogMatches
              .slice(0, 6)
              .map(property => summarizePropertyForAi(property))
              .join("\n")
          : "Nenhum imÃ³vel do catÃ¡logo bate com os filtros atuais da conversa.";

        const marketContext = [
          `imoveis_ativos: ${market.totalActive}`,
          `preco_medio_geral: R$ ${Math.round(market.avgPrice).toLocaleString("pt-BR")}`,
          `preco_medio_m2_por_bairro: ${market.neighborhoods
            .slice(0, 5)
            .map(item => `${item.bairro} R$ ${Math.round(item.priceM2).toLocaleString("pt-BR")}/mÂ²`)
            .join(", ") || "sem dados"}`,
        ].join("\n");

        const contextoBuscaAtual = Object.keys(searchContext).length
          ? JSON.stringify(searchContext)
          : "Nenhum filtro de busca ativo nesta conversa.";

        const messages = [
          {
            role: "system" as const,
            content: buildConciergeSystemPrompt({
              catalogContext,
              similarCatalogContext,
              portfolioContext,
              marketContext,
              contextoBuscaAtual,
            }),
          },
          ...history.slice(-20).map(message => ({ role: message.role as "user" | "assistant", content: message.conteudo })),
        ];

        let answer =
          intent === "busca_imovel"
            ? pickFallbackAnswer(input.text, intent, {
                catalogMatches,
                similarMatches,
                market,
              })
            : buildNonSearchFallback(input.text, intent, market);
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

    // 1.000 ou 1.000.000 representam milhares no padrÃ£o brasileiro.
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

type ConciergeIntent =
  | "busca_imovel"
  | "opiniao"
  | "informacao"
  | "imovel_especifico"
  | "mercado"
  | "comparacao";

function classifyConciergeIntent(text: string): ConciergeIntent {
  const normalized = text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();

  // 1. Imóvel específico pelo código.
  if (/\bimb-[a-z0-9]+\b/i.test(normalized)) {
    return "imovel_especifico";
  }

  // 2. Mercado imobiliário / estatísticas.
  if (
    /\b(preco medio|valor medio|media de preco|media dos precos|preco por m2|valor por m2|metro quadrado|mercado imobiliario|mercado de imoveis|valorizacao|valorizacao imobiliaria)\b/i.test(
      normalized,
    )
  ) {
    return "mercado";
  }

  // 3. Opinião / avaliação subjetiva.
  if (
    /\b(o que voce acha|o que acha|na sua opiniao|qual sua opiniao|qual a sua opiniao|voce acha|acha que|vale a pena|e bom|e ruim|seria bom|seria ruim|recomenda|recomendaria|melhor para morar|bom para morar|ruim para morar|melhor bairro|qual bairro e melhor)\b/i.test(
      normalized,
    )
  ) {
    return "opiniao";
  }

  // 4. Comparação explícita.
  if (
    /\b(compare|comparar|comparacao|comparando|qual e melhor|qual dos dois|entre .* e .*|diferen(c|ç)a entre)\b/i.test(
      normalized,
    )
  ) {
    return "comparacao";
  }

  // 5. Busca explícita de imóvel.
  if (
    /\b(quero|procuro|procurando|busco|buscar|encontrar|encontre|tem|tenho interesse|gostaria de|preciso de|me mostre|mostre|encontre|disponivel|disponiveis)\b/i.test(
      normalized,
    ) &&
    /\b(apartamento|apartamentos|apto|aptos|ape|casa|casas|sobrado|sobrados|terreno|terrenos|lote|lotes|cobertura|coberturas|imovel|imoveis)\b/i.test(
      normalized,
    )
  ) {
    return "busca_imovel";
  }

  // 6. Verbos claros de compra/aluguel também caracterizam busca.
  if (
    /\b(comprar|compra|compraria|alugar|aluguel|alugaria|vender|venda|locar|locacao)\b/i.test(
      normalized,
    ) &&
    /\b(imovel|imoveis|apartamento|casa|sobrado|terreno|lote|cobertura)\b/i.test(
      normalized,
    )
  ) {
    return "busca_imovel";
  }

  // 7. Perguntas sobre características de bairros/localidades.
  if (
    /\b(como e|como sao|como eh|caracteristicas|perfil|localizacao|regiao|bairro|morar em|morar no|morar na)\b/i.test(
      normalized,
    ) &&
    !/\b(quero|procuro|busco|comprar|alugar|me mostre|encontre|tem apartamento|tem casa)\b/i.test(
      normalized,
    )
  ) {
    return "informacao";
  }

  // 8. Perguntas informativas genéricas.
  if (
    /^(como|qual|quais|onde|quando|por que|porque|o que|me fale|fale sobre)\b/i.test(
      normalized,
    )
  ) {
    return "informacao";
  }

  // 9. Se houver características objetivas de imóvel, tratar como busca.
  if (
    /\b\d+\s*(quartos?|dormitorios?|vagas?|garagens?)\b/i.test(normalized) ||
    /\b(varanda|sacada|terraco|pet|pets|animais|ensolarado|ensolarada)\b/i.test(
      normalized,
    ) ||
    /\br\$\s*[\d.,]+\b/i.test(normalized)
  ) {
    return "busca_imovel";
  }

  // Por segurança, perguntas ambíguas não devem disparar busca automática.
  return "informacao";
}
function extractNaturalPropertyFilters(text: string) {
  const normalized = text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

  const result: {
    tipo?: string;
    quartos?: number;
    quartosExatos?: boolean;
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

    const minimumBedrooms = /\b(pelo menos|no minimo|a partir de)\s+(?:de\s+)?(?:\d+|um|dois|tres|quatro|cinco|seis)\s*(?:quartos?|dormitorios?)/.test(normalized);

    result.quartosExatos = !minimumBedrooms;
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
    /(?:ate|atÃ©|no maximo de?|mÃ¡ximo de?|por no maximo|por no mÃ¡ximo|menos de|menor que)\s*(?:r\$\s*)?([\d.,]+\s*(?:milhao|milhÃµes?|mil|mi|k)?)/i,
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
    /(?:a partir de|acima de|mais de|maior que|minimo de|mÃ­nimo de)\s*(?:r\$\s*)?([\d.,]+\s*(?:milhao|milhÃµes?|mil|mi|k)?)/i,
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













