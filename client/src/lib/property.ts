// Regras de dados do Plano Mestre (seÃ§Ã£o 6.2): preÃ§o e imagem nunca podem mentir.
export type PriceModality = "venda" | "aluguel" | "none";

export type PropertyLike = {
  valorVenda?: string | number | null;
  valorAluguel?: string | number | null;
  imagemUrl?: string | null;
  tituloAnuncio?: string | null;
  tipo?: string | null;
  bairro?: string | null;
  cidade?: string | null;
  fotos?: Array<{ url: string | null; ordem?: number | null }> | null;
};

export type DisplayPrice = {
  modality: PriceModality;
  /** Formato longo: R$ 1.180.000 ou R$ 7.400/mÃªs */
  primary: string;
  /** Etiqueta: "venda" | "aluguel/mÃªs" | "sob consulta" */
  label: string;
  /** Valor nulo quando "PreÃ§o sob consulta" */
  value: number | null;
  sale: number | null;
  rent: number | null;
};

const toNumber = (value: unknown): number => {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
};

const mojibakeMap: Record<string, string> = {
  "SÃƒÂ£o": "SÃ£o",
  "sÃƒÂ£o": "SÃ£o",
  "CÃƒÂ¢ndida": "CÃ¢ndida",
  "CÃƒÂ¢mara": "CÃ¢mara",
  "Guilhermina": "Guilhermina",
  "Ãƒâ€°": "Ã‰",
  "ÃƒÂ§": "Ã§",
  "ÃƒÂ£": "Ã£",
  "ÃƒÂ¡": "Ã¡",
  "ÃƒÂ©": "Ã©",
  "ÃƒÂ³": "Ã³",
  "ÃƒÂº": "Ãº",
};

export function normalizePropertyText(value: unknown): string {
  let text = String(value ?? "").trim();
  Object.entries(mojibakeMap).forEach(([broken, fixed]) => {
    text = text.replaceAll(broken, fixed);
  });
  return text.replace(/\s+/g, " ").trim();
}

export function formatPropertyPlace(value: unknown): string {
  const text = normalizePropertyText(value);
  return text
    .split(" ")
    .map(word => word ? word.charAt(0).toUpperCase() + word.slice(1) : word)
    .join(" ");
}

export function formatBRL(value: number, compact = false): string {
  if (compact && value >= 1_000_000) {
    return `R$ ${(value / 1_000_000).toFixed(2).replace(".", ",")} mi`;
  }
  return value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  });
}

/**
 * Regra do Plano Mestre (6.2): venda â†’ aluguel/mÃªs â†’ "PreÃ§o sob consulta".
 * `preferred` ajusta a exibiÃ§Ã£o ao contexto: num catÃ¡logo filtrado para aluguel,
 * um imÃ³vel com ambos os preÃ§os mostra o valor mensal, nÃ£o o de venda.
 */
export function getPropertyPrice(property: PropertyLike, preferred?: PriceModality): DisplayPrice {
  const sale = toNumber(property.valorVenda);
  const rent = toNumber(property.valorAluguel);
  if (preferred === "aluguel" && rent > 0) {
    return { modality: "aluguel", primary: `${formatBRL(rent)}/mÃªs`, label: "aluguel/mÃªs", value: rent, sale, rent };
  }
  if (preferred === "venda" && sale > 0) {
    return { modality: "venda", primary: formatBRL(sale), label: "venda", value: sale, sale, rent };
  }
  if (sale > 0) {
    return {
      modality: "venda",
      primary: formatBRL(sale),
      label: "venda",
      value: sale,
      sale,
      rent,
    };
  }
  if (rent > 0) {
    return {
      modality: "aluguel",
      primary: `${formatBRL(rent)}/mÃªs`,
      label: "aluguel/mÃªs",
      value: rent,
      sale,
      rent,
    };
  }
  return {
    modality: "none",
    primary: "PreÃ§o sob consulta",
    label: "sob consulta",
    value: null,
    sale,
    rent,
  };
}

/** URL de imagem utilizÃ¡vel ou null â€” nunca uma URL que sabemos quebrada. */
export function getPropertyImage(property: PropertyLike): string | null {
  const direct = String(property.imagemUrl ?? "").trim();
  if (direct) return direct;
  const photo = property.fotos?.find(photo => String(photo.url ?? "").trim());
  return photo ? String(photo.url).trim() : null;
}

export function getPropertyTitle(property: PropertyLike): string {
  return (
    normalizePropertyText(property.tituloAnuncio) ||
    `${formatPropertyPlace(property.tipo ?? "ImÃ³vel")} em ${formatPropertyPlace(property.bairro ?? "â€”")}`.trim()
  );
}

export function getPropertyLocation(property: PropertyLike): string {
  return [property.bairro, property.cidade].filter(Boolean).map(formatPropertyPlace).join(", ");
}

export const SEARCH_SUGGESTIONS = [] as const;

/** Diferenciais estruturados exibidos como chips acessÃ­veis no card. */
export function getPropertyAmenities(property: {
  aceitaPets?: boolean | null;
  varanda?: boolean | null;
  ensolarado?: boolean | null;
  fotos?: unknown[] | null;
}): Array<{ key: string; label: string }> {
  const items: Array<{ key: string; label: string }> = [];
  if (property.aceitaPets) items.push({ key: "pets", label: "Aceita pets" });
  if (property.varanda) items.push({ key: "varanda", label: "Varanda" });
  if (property.ensolarado) items.push({ key: "sol", label: "Ensolarado" });
  if (property.fotos?.length) items.push({ key: "fotos", label: `${property.fotos.length} fotos` });
  return items;
}


