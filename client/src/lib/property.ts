// Regras de dados do Plano Mestre (seção 6.2): preço e imagem nunca podem mentir.
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
  /** Formato longo: R$ 1.180.000 ou R$ 7.400/mês */
  primary: string;
  /** Etiqueta: "venda" | "aluguel/mês" | "sob consulta" */
  label: string;
  /** Valor nulo quando "Preço sob consulta" */
  value: number | null;
  sale: number | null;
  rent: number | null;
};

const toNumber = (value: unknown): number => {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
};

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
 * Regra do Plano Mestre (6.2): venda → aluguel/mês → "Preço sob consulta".
 * `preferred` ajusta a exibição ao contexto: num catálogo filtrado para aluguel,
 * um imóvel com ambos os preços mostra o valor mensal, não o de venda.
 */
export function getPropertyPrice(property: PropertyLike, preferred?: PriceModality): DisplayPrice {
  const sale = toNumber(property.valorVenda);
  const rent = toNumber(property.valorAluguel);
  if (preferred === "aluguel" && rent > 0) {
    return { modality: "aluguel", primary: `${formatBRL(rent)}/mês`, label: "aluguel/mês", value: rent, sale, rent };
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
      primary: `${formatBRL(rent)}/mês`,
      label: "aluguel/mês",
      value: rent,
      sale,
      rent,
    };
  }
  return {
    modality: "none",
    primary: "Preço sob consulta",
    label: "sob consulta",
    value: null,
    sale,
    rent,
  };
}

/** URL de imagem utilizável ou null — nunca uma URL que sabemos quebrada. */
export function getPropertyImage(property: PropertyLike): string | null {
  const direct = String(property.imagemUrl ?? "").trim();
  if (direct) return direct;
  const photo = property.fotos?.find(photo => String(photo.url ?? "").trim());
  return photo ? String(photo.url).trim() : null;
}

export function getPropertyTitle(property: PropertyLike): string {
  return (
    String(property.tituloAnuncio ?? "").trim() ||
    `${property.tipo ?? "Imóvel"} em ${property.bairro ?? "—"}`.trim()
  );
}

export function getPropertyLocation(property: PropertyLike): string {
  return [property.bairro, property.cidade].filter(Boolean).join(", ");
}

export const SEARCH_SUGGESTIONS = [
  "Casa até R$ 500 mil",
  "Apartamento com três quartos e varanda",
  "Imóvel para alugar que aceite pets",
  "Casa em Montes Claros perto do comércio",
  "Imóvel ensolarado com duas vagas",
] as const;

/** Diferenciais estruturados exibidos como chips acessíveis no card. */
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
