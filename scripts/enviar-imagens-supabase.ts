import "dotenv/config";
import fs from "node:fs/promises";
import path from "node:path";
import { eq } from "drizzle-orm";

import { storagePut } from "../server/storage";
import { getDb } from "../server/db";
import { imoveis, imovelFotos } from "../drizzle/schema";

const IMOVEL_ID = 14;
const OWNER_ID = 4;
const CODIGO = "IMB-012";

const pastaImagens = path.resolve(
  "imoveis-fotos",
  CODIGO
);

const imagens = [
  {
    categoria: "fachada",
    arquivo: "01-fachada.webp",
  },
  {
    categoria: "sala",
    arquivo: "02-sala.webp",
  },
  {
    categoria: "cozinha",
    arquivo: "03-cozinha.webp",
  },
  {
    categoria: "quarto",
    arquivo: "04-quarto.webp",
  },
  {
    categoria: "banheiro",
    arquivo: "05-banheiro.webp",
  },
];

async function main() {
  console.log("");
  console.log("==========================================");
  console.log(" UPLOAD DE IMAGENS — IMOB-AI");
  console.log("==========================================");
  console.log("");

  const db = await getDb();

  const [imovel] = await db
    .select({
      id: imoveis.id,
      codigo: imoveis.codigo,
      tituloAnuncio: imoveis.tituloAnuncio,
      ownerId: imoveis.ownerId,
    })
    .from(imoveis)
    .where(eq(imoveis.id, IMOVEL_ID));

  if (!imovel) {
    throw new Error(`Imóvel ID ${IMOVEL_ID} não encontrado.`);
  }

  if (imovel.codigo !== CODIGO) {
    throw new Error(
      `Incompatibilidade: esperado ${CODIGO}, encontrado ${imovel.codigo}.`
    );
  }

  console.log(`Imóvel: ${CODIGO}`);
  console.log(`ID interno: ${IMOVEL_ID}`);
  console.log(`Título: ${imovel.tituloAnuncio ?? "(sem título)"}`);
  console.log(`Owner do imóvel: ${imovel.ownerId ?? "null"}`);
  console.log(`Owner das fotos: ${OWNER_ID}`);
  console.log(`Bucket: imoveis-fotos`);
  console.log("");

  const existentes = await db
    .select({
      id: imovelFotos.id,
      fileKey: imovelFotos.fileKey,
      url: imovelFotos.url,
      ordem: imovelFotos.ordem,
    })
    .from(imovelFotos)
    .where(eq(imovelFotos.imovelId, IMOVEL_ID));

  if (existentes.length > 0) {
    throw new Error(
      `O imóvel ${CODIGO} já possui ${existentes.length} foto(s) no banco. Upload cancelado para evitar duplicação.`
    );
  }

  console.log("Nenhuma foto existente no banco.");
  console.log("Verificando arquivos locais...");

  for (const imagem of imagens) {
    const caminho = path.join(pastaImagens, imagem.arquivo);

    try {
      await fs.access(caminho);
    } catch {
      throw new Error(`Arquivo não encontrado: ${caminho}`);
    }
  }

  console.log("✓ 5 arquivos encontrados.");
  console.log("");
  console.log("Iniciando upload...");
  console.log("");

  const photos: Array<{
    fileKey: string;
    url: string;
    ordem: number;
  }> = [];

  for (let i = 0; i < imagens.length; i++) {
    const imagem = imagens[i];

    const caminhoLocal = path.join(
      pastaImagens,
      imagem.arquivo
    );

    console.log(`[${i + 1}/${imagens.length}] ${imagem.categoria}`);

    const arquivo = await fs.readFile(caminhoLocal);

    console.log(`  Arquivo: ${imagem.arquivo}`);
    console.log(
      `  Tamanho: ${(arquivo.length / 1024).toFixed(1)} KB`
    );

    const resultado = await storagePut(
      `${CODIGO}/${imagem.arquivo}`,
      arquivo,
      "image/webp"
    );

    console.log("  ✓ Upload concluído");
    console.log(`  Key: ${resultado.key}`);
    console.log(`  URL: ${resultado.url}`);

    photos.push({
      fileKey: resultado.key,
      url: resultado.url,
      ordem: i,
    });

    console.log("");
  }

  console.log("Registrando imagens no banco...");

  const cadastradas = [];

  for (const photo of photos) {
    const [foto] = await db
      .insert(imovelFotos)
      .values({
        ownerId: OWNER_ID,
        imovelId: IMOVEL_ID,
        fileKey: photo.fileKey,
        url: photo.url,
        ordem: photo.ordem,
      })
      .returning();

    cadastradas.push(foto);
  }

  if (cadastradas.length !== photos.length) {
    throw new Error(
      `Esperadas ${photos.length} fotos, mas ${cadastradas.length} foram cadastradas.`
    );
  }

  const primeiraFoto = cadastradas
    .sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0))[0];

  if (!primeiraFoto?.url) {
    throw new Error("Não foi possível determinar a primeira foto.");
  }

  await db
    .update(imoveis)
    .set({
      imagemUrl: primeiraFoto.url,
    })
    .where(eq(imoveis.id, IMOVEL_ID));

  console.log("");
  console.log("==========================================");
  console.log(" UPLOAD CONCLUÍDO");
  console.log("==========================================");
  console.log("");

  console.log(`Fotos cadastradas: ${cadastradas.length}`);
  console.log("");

  cadastradas
    .sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0))
    .forEach((foto, index) => {
      console.log(
        `${index + 1}. ordem=${foto.ordem} | ${foto.fileKey}`
      );
      console.log(`   ${foto.url}`);
    });

  console.log("");
  console.log(`Imóvel: ${CODIGO}`);
  console.log("Supabase Storage: OK");
  console.log("Tabela imovel_fotos: OK");
  console.log("imagemUrl principal: OK");
  console.log("");
}

main().catch((erro) => {
  console.error("");
  console.error("==========================================");
  console.error(" ERRO NO UPLOAD");
  console.error("==========================================");
  console.error("");

  console.error(
    erro instanceof Error ? erro.message : erro
  );

  console.error("");

  process.exit(1);
});
