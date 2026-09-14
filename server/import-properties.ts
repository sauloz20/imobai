import "dotenv/config";
import { readFileSync } from "node:fs";
import { getDb } from "./db";
import { imoveis } from "../drizzle/schema";

const csvPath = "imoveis.csv";

const allowedTypes = new Set([
  "Apartamento",
  "Casa",
  "Sobrado",
  "Terreno",
  "Cobertura",
]);

function parseNumber(value: string | undefined): number | null {
  if (!value || !value.trim()) return null;

  const normalized = value
    .trim()
    .replace(/\./g, "")
    .replace(",", ".");

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseBoolean(value: string | undefined): boolean {
  return ["true", "1", "sim", "yes", "s"].includes(
    (value ?? "").trim().toLowerCase(),
  );
}

function normalizeType(value: string): string {
  const normalized = value.trim();

  if (normalized.toLowerCase() === "kitnet") {
    return "Apartamento";
  }

  return normalized;
}

const csv = readFileSync(csvPath, "utf8").replace(/^\uFEFF/, "");
const rows = csv
  .split(/\r?\n/)
  .filter(line => line.trim().length > 0);

if (rows.length < 2) {
  throw new Error("O arquivo imoveis.csv não possui imóveis para importar.");
}

const headers = rows[0].split(",").map(header => header.trim());

const records = rows.slice(1).map((line, index) => {
  const values = line.split(",");
  const record: Record<string, string> = {};

  headers.forEach((header, position) => {
    record[header] = (values[position] ?? "").trim();
  });

  const lineNumber = index + 2;
  const tipo = normalizeType(record.tipo);

  if (!record.codigo) {
    throw new Error(`Linha ${lineNumber}: codigo não informado.`);
  }

  if (!allowedTypes.has(tipo)) {
    throw new Error(
      `Linha ${lineNumber}: tipo inválido "${record.tipo}".`,
    );
  }

  if (!record.bairro) {
    throw new Error(`Linha ${lineNumber}: bairro não informado.`);
  }

  if (!record.cidade) {
    throw new Error(`Linha ${lineNumber}: cidade não informada.`);
  }

  const areaM2 = parseNumber(record.areaM2);
  if (areaM2 === null || areaM2 <= 0) {
    throw new Error(`Linha ${lineNumber}: areaM2 inválida.`);
  }

  const valorVenda = parseNumber(record.valorVenda);
  const valorAluguel = parseNumber(record.valorAluguel);

  if (valorVenda === null && valorAluguel === null) {
    throw new Error(
      `Linha ${lineNumber}: informe valorVenda ou valorAluguel.`,
    );
  }

  return {
    codigo: record.codigo,
    tipo: tipo as "Apartamento" | "Casa" | "Sobrado" | "Terreno" | "Cobertura",
    tituloAnuncio: record.tituloAnuncio || null,
    cidade: record.cidade,
    bairro: record.bairro,
    areaM2: String(areaM2),
    quartos: Number(record.quartos || 0),
    banheiros: Number(record.banheiros || 0),
    vagas: Number(record.vagas || 0),
    aceitaPets: parseBoolean(record.aceitaPets),
    varanda: parseBoolean(record.varanda),
    ensolarado: parseBoolean(record.ensolarado),
    valorVenda: valorVenda === null ? null : String(valorVenda),
    valorAluguel: valorAluguel === null ? null : String(valorAluguel),
    descricaoTecnica: record.descricaoTecnica || null,
    status: "Disponivel" as const,
    ownerId: null,
  };
});

const codes = records.map(record => record.codigo);
const duplicateCodes = codes.filter(
  (code, index) => codes.indexOf(code) !== index,
);

if (duplicateCodes.length > 0) {
  throw new Error(
    `Códigos duplicados no CSV: ${Array.from(new Set(duplicateCodes)).join(", ")}`,
  );
}

console.log(`Registros válidos no CSV: ${records.length}`);
console.log("Tipos encontrados:", [
  ...Array.from(new Set(records.map(record => record.tipo))),
].join(", "));

async function main() {
  const db = await getDb();

if (!db) {
  throw new Error(
    "Não foi possível conectar ao banco. Verifique as variáveis do .env.",
  );
}

const inserted = await db
  .insert(imoveis)
  .values(records)
  .onConflictDoNothing({
    target: imoveis.codigo,
  })
  .returning({
    id: imoveis.id,
    codigo: imoveis.codigo,
  });

console.log(`Imóveis inseridos agora: ${inserted.length}`);

if (inserted.length < records.length) {
  console.log(
    `Registros ignorados por código já existente: ${records.length - inserted.length}`,
  );
}

console.log("Códigos inseridos:");
for (const property of inserted) {
  console.log(`- ${property.codigo} (id ${property.id})`);
}
}

main().catch((error) => {
  console.error("Falha na importaçãoo:", error);
  process.exitCode = 1;
});

