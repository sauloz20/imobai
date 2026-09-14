import { describe, expect, it } from "vitest";
import { getDashboardData, listProperties } from "./db";
import { fallbackSearch } from "./routers";

describe("ImobAI natural language intent parsing", () => {
  it("interprets a purchase search with city, bedrooms, garage and max price", () => {
    const result = fallbackSearch(
      "Quero comprar um apartamento de até R$ 300 mil, com 2 quartos e garagem em Montes Claros."
    );
    expect(result.finalidade).toBe("compra");
    expect(result.tipo).toBe("Apartamento");
    expect(result.cidade).toBe("Montes Claros");
    expect(result.quartos).toBe(2);
    expect(result.vagas).toBeGreaterThanOrEqual(1);
    expect(result.valor_max).toBe(300_000);
  });

  it("interprets a rental search distinctly from a purchase search", () => {
    const result = fallbackSearch("Procuro uma casa para alugar em Belo Horizonte com 3 quartos");
    expect(result.finalidade).toBe("aluguel");
    expect(result.tipo).toBe("Casa");
    expect(result.cidade).toBe("Belo Horizonte");
    expect(result.quartos).toBe(3);
  });

  it("interprets a price range described with 'entre X e Y'", () => {
    const result = fallbackSearch("Apartamento entre 250 mil e 300 mil em Montes Claros");
    expect(result.valor_min).toBe(250_000);
    expect(result.valor_max).toBe(300_000);
  });

  it("interprets a price floor described with 'a partir de'", () => {
    const result = fallbackSearch("Casa a partir de R$ 500 mil em São Paulo");
    expect(result.valor_min).toBe(500_000);
    expect(result.valor_max).toBeNull();
  });
});

describe("ImobAI property intelligence", () => {
  it("returns compatible demo properties when the catalog has no rows", async () => {
    const result = await listProperties({ bairro: "Pinheiros", quartos: 3, aceitaPets: true });
    expect(result.length).toBeGreaterThan(0);
    expect(result.every(property => property.bairro === "Pinheiros")).toBe(true);
    expect(result.every(property => property.quartos >= 3)).toBe(true);
    expect(result.every(property => property.aceitaPets)).toBe(true);
  });

  it("builds market metrics for the dashboard", async () => {
    const result = await getDashboardData();
    expect(result.totalActive).toBeGreaterThanOrEqual(0);
    expect(result.avgPrice).toBeGreaterThanOrEqual(0);
    expect(Array.isArray(result.neighborhoods)).toBe(true);
    expect(Array.isArray(result.featured)).toBe(true);
  });
});
