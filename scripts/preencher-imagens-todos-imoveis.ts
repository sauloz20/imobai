import "dotenv/config";
import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { eq, inArray } from "drizzle-orm";

import { storagePut } from "../server/storage";
import { getDb } from "../server/db";
import { imoveis, imovelFotos } from "../drizzle/schema";

const ROOT = path.resolve("imoveis-fotos");
const TARGET_PHOTOS = 5;
const OWNER_FALLBACK = 4;

const CATEGORIES = [
  {
    ordem: 0,
    categoria: "fachada",
    arquivo: "01-fachada.webp",
  },
  {
    ordem: 1,
    categoria: "sala",
    arquivo: "02-sala.webp",
  },
  {
    ordem: 2,
    categoria: "cozinha",
    arquivo: "03-cozinha.webp",
  },
  {
    ordem: 3,
    categoria: "quarto",
    arquivo: "04-quarto.webp",
  },
  {
    ordem: 4,
    categoria: "banheiro",
    arquivo: "05-banheiro.webp",
  },
] as const;

type Property = {
  id: number;
  codigo: string;
  tituloAnuncio: string | null;
  tipo: string | null;
  bairro: string | null;
  cidade: string | null;
  ownerId: number | null;
};

type ExistingPhoto = {
  id: number;
  imovelId: number;
  fileKey: string;
  url: string;
  ordem: number;
};

type ManifestPhoto = {
  ordem?: number | null;
  categoria?: string;
  busca?: string;
  pexelsId?: number | string | null;
  pexels_id?: number | string | null;
  pexelsUrl?: string | null;
  url_imagem?: string | null;
  arquivo?: string | null;
  databasePhotoId?: number | null;
  storageKey?: string | null;
  storageUrl?: string | null;
  largura?: number | null;
  altura?: number | null;
  tamanhoBytes?: number | null;
};

type Manifest = {
  generatedAt?: string;
  imovel_id?: string;
  property?: {
    id?: number;
    codigo?: string;
    tituloAnuncio?: string | null;
    tipo?: string | null;
    bairro?: string | null;
    cidade?: string | null;
  };
  imagens?: ManifestPhoto[];
  photos?: ManifestPhoto[];
};

type PexelsPhoto = {
  id: number;
  width: number;
  height: number;
  photographer?: string;
  photographer_url?: string;
  src?: {
    original?: string;
    large2x?: string;
    large?: string;
    medium?: string;
  };
  url?: string;
};

type PexelsResponse = {
  photos?: PexelsPhoto[];
};

type SelectedPhoto = {
  pexelsId: number;
  pexelsUrl: string;
  sourceUrl: string;
  photographer: string;
};

function normalizePexelsId(value: unknown): number | null {
  const raw = String(value ?? "").trim();

  if (!raw) {
    return null;
  }

  const parsed = Number(raw);

  if (!Number.isInteger(parsed) || parsed <= 0) {
    return null;
  }

  return parsed;
}

function getManifestPexelsId(photo: ManifestPhoto): number | null {
  return normalizePexelsId(
    photo.pexelsId ??
      photo.pexels_id ??
      null,
  );
}

function getManifestPhotos(manifest: Manifest): ManifestPhoto[] {
  if (Array.isArray(manifest.photos)) {
    return manifest.photos;
  }

  if (Array.isArray(manifest.imagens)) {
    return manifest.imagens;
  }

  return [];
}

async function readManifest(
  manifestPath: string,
): Promise<Manifest | null> {
  try {
    const content = await fs.readFile(manifestPath, "utf8");
    return JSON.parse(content) as Manifest;
  } catch (error) {
    console.warn(
      `⚠️ Não foi possível ler o manifest: ${manifestPath}`,
    );

    console.warn(
      error instanceof Error ? error.message : error,
    );

    return null;
  }
}

async function loadGlobalPexelsIds(): Promise<Set<number>> {
  const used = new Set<number>();

  try {
    await fs.mkdir(ROOT, { recursive: true });

    const entries = await fs.readdir(ROOT, {
      withFileTypes: true,
    });

    const manifestPaths: string[] = [];

    for (const entry of entries) {
      if (!entry.isDirectory()) {
        continue;
      }

      const manifestPath = path.join(
        ROOT,
        entry.name,
        "manifest.json",
      );

      try {
        await fs.access(manifestPath);
        manifestPaths.push(manifestPath);
      } catch {
        // Pasta sem manifest: ignorar.
      }
    }

    console.log(
      `📚 Manifests encontrados: ${manifestPaths.length}`,
    );

    for (const manifestPath of manifestPaths) {
      const manifest = await readManifest(manifestPath);

      if (!manifest) {
        continue;
      }

      for (const photo of getManifestPhotos(manifest)) {
        const pexelsId = getManifestPexelsId(photo);

        if (pexelsId !== null) {
          used.add(pexelsId);
        }
      }
    }
  } catch (error) {
    console.warn(
      "⚠️ Não foi possível carregar todos os manifests.",
    );

    console.warn(
      error instanceof Error ? error.message : error,
    );
  }

  return used;
}

function buildQueries(
  property: Property,
  categoria: string,
): string[] {
  const tipo = property.tipo?.trim() || "home";
  const bairro = property.bairro?.trim() || "";
  const cidade = property.cidade?.trim() || "";

  const base = `${tipo} ${cidade}`.trim();

  const categoryQueries: Record<string, string[]> = {
    fachada: [
      `${base} exterior house`,
      `modern ${tipo} exterior`,
      `residential house facade`,
      `beautiful home exterior`,
    ],

    sala: [
      `${base} living room`,
      `modern ${tipo} living room interior`,
      `modern residential living room`,
      `bright elegant living room`,
    ],

    cozinha: [
      `${base} kitchen interior`,
      `modern ${tipo} kitchen`,
      `modern residential kitchen`,
      `contemporary kitchen interior`,
    ],

    quarto: [
      `${base} bedroom`,
      `modern ${tipo} bedroom`,
      `modern residential bedroom`,
      `comfortable bedroom interior`,
    ],

    banheiro: [
      `${base} bathroom`,
      `modern ${tipo} bathroom`,
      `modern residential bathroom`,
      `contemporary bathroom interior`,
    ],
  };

  const specific = categoryQueries[categoria] ?? [
    `${base} ${categoria}`,
    `modern ${categoria} interior`,
  ];

  if (bairro) {
    specific.unshift(
      `${tipo} ${bairro} ${categoria}`,
    );
  }

  return Array.from(
    new Set(
      specific
        .map((query) => query.replace(/\s+/g, " ").trim())
        .filter(Boolean),
    ),
  );
}

async function searchPexels(
  query: string,
  page: number,
): Promise<PexelsPhoto[]> {
  const apiKey = process.env.PEXELS_API_KEY?.trim();

  if (!apiKey) {
    throw new Error(
      "PEXELS_API_KEY não configurada no .env",
    );
  }

  const url = new URL(
    "https://api.pexels.com/v1/search",
  );

  url.searchParams.set("query", query);
  url.searchParams.set("per_page", "80");
  url.searchParams.set("page", String(page));
  url.searchParams.set("orientation", "landscape");

  const response = await fetch(url, {
    headers: {
      Authorization: apiKey,
    },
  });

  if (!response.ok) {
    const body = await response.text();

    throw new Error(
      `Pexels HTTP ${response.status}: ${body.slice(0, 300)}`,
    );
  }

  const data = (await response.json()) as PexelsResponse;

  return Array.isArray(data.photos)
    ? data.photos
    : [];
}

async function selectUniquePexelsPhoto(
  property: Property,
  categoria: string,
  usedPexelsIds: Set<number>,
  propertyPexelsIds: Set<number>,
): Promise<SelectedPhoto> {
  const queries = buildQueries(
    property,
    categoria,
  );

  const maxPagesPerQuery = 3;

  for (const query of queries) {
    for (
      let page = 1;
      page <= maxPagesPerQuery;
      page++
    ) {
      console.log(
        `  🔎 Pexels: "${query}" — página ${page}`,
      );

      let photos: PexelsPhoto[];

      try {
        photos = await searchPexels(
          query,
          page,
        );
      } catch (error) {
        console.warn(
          `  ⚠️ Falha na busca: ${
            error instanceof Error
              ? error.message
              : error
          }`,
        );

        continue;
      }

      for (const photo of photos) {
        const pexelsId = normalizePexelsId(
          photo.id,
        );

        if (pexelsId === null) {
          continue;
        }

        // REGRA PRINCIPAL:
        // nunca reutilizar um Pexels ID que já esteja
        // no conjunto global dos manifests.
        if (usedPexelsIds.has(pexelsId)) {
          continue;
        }

        // Segurança adicional:
        // nunca repetir duas imagens dentro do mesmo imóvel.
        if (propertyPexelsIds.has(pexelsId)) {
          continue;
        }

        const sourceUrl =
          photo.src?.large2x ||
          photo.src?.large ||
          photo.src?.medium ||
          photo.src?.original;

        if (!sourceUrl) {
          continue;
        }

        return {
          pexelsId,
          pexelsUrl:
            photo.url ||
            `https://www.pexels.com/photo/${pexelsId}/`,
          sourceUrl,
          photographer:
            photo.photographer || "Pexels",
        };
      }
    }
  }

  throw new Error(
    `Nenhuma imagem Pexels única encontrada para "${property.codigo}" / ${categoria}.`,
  );
}

async function downloadAndConvert(
  sourceUrl: string,
): Promise<{
  buffer: Buffer;
  width: number;
  height: number;
}> {
  const response = await fetch(sourceUrl);

  if (!response.ok) {
    throw new Error(
      `Falha ao baixar imagem: HTTP ${response.status}`,
    );
  }

  const arrayBuffer =
    await response.arrayBuffer();

  const input = Buffer.from(arrayBuffer);

  const result = await sharp(input)
    .rotate()
    .resize({
      width: 1600,
      withoutEnlargement: true,
      fit: "inside",
    })
    .webp({
      quality: 82,
      effort: 5,
    })
    .toBuffer({
      resolveWithObject: true,
    });

  return {
    buffer: result.data,
    width: result.info.width,
    height: result.info.height,
  };
}

async function writeManifest(
  property: Property,
  photos: ManifestPhoto[],
): Promise<void> {
  const folder = path.join(
    ROOT,
    property.codigo,
  );

  await fs.mkdir(folder, {
    recursive: true,
  });

  const manifest: Manifest = {
    generatedAt:
      new Date().toISOString(),

    property: {
      id: property.id,
      codigo: property.codigo,
      tituloAnuncio:
        property.tituloAnuncio,
      tipo: property.tipo,
      bairro: property.bairro,
      cidade: property.cidade,
    },

    photos: photos
      .sort(
        (a, b) =>
          Number(a.ordem ?? 0) -
          Number(b.ordem ?? 0),
      )
      .map((photo) => ({
        ...photo,
        ordem: Number(photo.ordem ?? 0),
      })),
  };

  const manifestPath = path.join(
    folder,
    "manifest.json",
  );

  await fs.writeFile(
    manifestPath,
    JSON.stringify(
      manifest,
      null,
      2,
    ),
    "utf8",
  );
}

async function main() {
  console.log("");
  console.log(
    "============================================================",
  );
  console.log(
    " PREENCHIMENTO AUTOMÁTICO DE IMAGENS — IMOB-AI",
  );
  console.log(
    "============================================================",
  );
  console.log("");

  const db = await getDb();

  /*
   * ============================================================
   * 1. CARREGAR TODOS OS MANIFESTS
   * ============================================================
   */

  const usedPexelsIds =
    await loadGlobalPexelsIds();

  console.log(
    `🔒 Pexels IDs globais já utilizados: ${usedPexelsIds.size}`,
  );

  console.log("");

  /*
   * ============================================================
   * 2. CARREGAR TODOS OS IMÓVEIS
   * ============================================================
   */

  const properties =
    (await db
      .select({
        id: imoveis.id,
        codigo: imoveis.codigo,
        tituloAnuncio:
          imoveis.tituloAnuncio,
        tipo: imoveis.tipo,
        bairro: imoveis.bairro,
        cidade: imoveis.cidade,
        ownerId: imoveis.ownerId,
      })
      .from(imoveis)
      .orderBy(imoveis.id)) as Property[];

  if (!properties.length) {
    console.log(
      "Nenhum imóvel encontrado.",
    );

    return;
  }

  const propertyIds =
    properties.map(
      (property) => property.id,
    );

  /*
   * ============================================================
   * 3. CARREGAR FOTOS EXISTENTES DO BANCO
   * ============================================================
   */

  const existingPhotos =
    propertyIds.length > 0
      ? ((await db
          .select({
            id: imovelFotos.id,
            imovelId:
              imovelFotos.imovelId,
            fileKey:
              imovelFotos.fileKey,
            url: imovelFotos.url,
            ordem:
              imovelFotos.ordem,
          })
          .from(imovelFotos)
          .where(
            inArray(
              imovelFotos.imovelId,
              propertyIds,
            ),
          )) as ExistingPhoto[])
      : [];

  const photosByProperty =
    new Map<number, ExistingPhoto[]>();

  for (const photo of existingPhotos) {
    const list =
      photosByProperty.get(
        photo.imovelId,
      ) ?? [];

    list.push(photo);

    photosByProperty.set(
      photo.imovelId,
      list,
    );
  }

  /*
   * ============================================================
   * 4. PROCESSAR CADA IMÓVEL
   * ============================================================
   */

  const summary = {
    completed: 0,
    skipped: 0,
    partial: 0,
    errors: 0,
    photosAdded: 0,
  };

  for (
    const property of properties
  ) {
    console.log("");
    console.log(
      "------------------------------------------------------------",
    );
    console.log(
      `${property.codigo} — ${
        property.tituloAnuncio ??
        "(sem título)"
      }`,
    );
    console.log(
      `${property.tipo ?? "Imóvel"} | ${
        property.bairro ??
        "(sem bairro)"
      } | ${
        property.cidade ??
        "(sem cidade)"
      }`,
    );
    console.log(
      "------------------------------------------------------------",
    );

    const existing =
      (
        photosByProperty.get(
          property.id,
        ) ?? []
      ).sort(
        (a, b) =>
          Number(a.ordem ?? 0) -
          Number(b.ordem ?? 0),
      );

    if (
      existing.length >=
      TARGET_PHOTOS
    ) {
      console.log(
        `⏭️ Já possui ${existing.length}/${TARGET_PHOTOS} fotos. Pulando.`,
      );

      summary.skipped++;

      continue;
    }

    const propertyPexelsIds =
      new Set<number>();

    /*
     * Tentar recuperar IDs Pexels desse imóvel
     * a partir do manifest existente.
     */
    const manifestPath =
      path.join(
        ROOT,
        property.codigo,
        "manifest.json",
      );

    const existingManifest =
      await readManifest(
        manifestPath,
      );

    const manifestPhotos =
      existingManifest
        ? getManifestPhotos(
            existingManifest,
          )
        : [];

    for (const photo of manifestPhotos) {
      const pexelsId =
        getManifestPexelsId(photo);

      if (pexelsId !== null) {
        propertyPexelsIds.add(
          pexelsId,
        );
      }
    }

    /*
     * Reservar também os IDs desse imóvel
     * no conjunto global.
     */
    for (const id of propertyPexelsIds) {
      usedPexelsIds.add(id);
    }

    const manifestByOrder =
      new Map<number, ManifestPhoto>();

    for (const photo of manifestPhotos) {
      const ordem =
        Number(photo.ordem);

      if (
        Number.isInteger(ordem) &&
        ordem >= 0
      ) {
        manifestByOrder.set(
          ordem,
          photo,
        );
      }
    }

    let addedForProperty = 0;

    for (
      const category of CATEGORIES
    ) {
      if (
        existing.some(
          (photo) =>
            Number(photo.ordem) ===
            category.ordem,
        )
      ) {
        continue;
      }

      console.log("");
      console.log(
        `📸 [${category.ordem + 1}/${TARGET_PHOTOS}] ${category.categoria}`,
      );

      try {
        /*
         * ========================================================
         * BUSCAR ID PEXELS GLOBALMENTE ÚNICO
         * ========================================================
         */

        const selected =
          await selectUniquePexelsPhoto(
            property,
            category.categoria,
            usedPexelsIds,
            propertyPexelsIds,
          );

        console.log(
          `  ✓ Pexels ID selecionado: ${selected.pexelsId}`,
        );

        /*
         * ========================================================
         * BAIXAR + COMPRIMIR
         * ========================================================
         */

        const converted =
          await downloadAndConvert(
            selected.sourceUrl,
          );

        console.log(
          `  ✓ WebP: ${converted.width}x${converted.height}`,
        );

        /*
         * ========================================================
         * UPLOAD
         * ========================================================
         */

        const resultado =
          await storagePut(
            `${property.codigo}/${category.arquivo}`,
            converted.buffer,
            "image/webp",
          );

        console.log(
          `  ✓ Upload: ${resultado.key}`,
        );

        /*
         * ========================================================
         * BANCO DE DADOS
         * ========================================================
         */

        const ownerId =
          property.ownerId ??
          OWNER_FALLBACK;

        const [
          inserted,
        ] = await db
          .insert(imovelFotos)
          .values({
            ownerId,
            imovelId:
              property.id,
            fileKey:
              resultado.key,
            url:
              resultado.url,
            ordem:
              category.ordem,
          })
          .returning();

        if (!inserted) {
          throw new Error(
            "A foto foi enviada ao Storage, mas não foi registrada no banco.",
          );
        }

        console.log(
          `  ✓ Banco: foto ID ${inserted.id}`,
        );

        /*
         * ========================================================
         * RESERVAR O PEXELS ID
         *
         * Só fazemos isso depois que a imagem foi realmente
         * enviada e registrada.
         * ========================================================
         */

        usedPexelsIds.add(
          selected.pexelsId,
        );

        propertyPexelsIds.add(
          selected.pexelsId,
        );

        /*
         * ========================================================
         * ATUALIZAR IMAGEM PRINCIPAL
         * ========================================================
         */

        if (
          category.ordem === 0
        ) {
          await db
            .update(imoveis)
            .set({
              imagemUrl:
                resultado.url,
            })
            .where(
              eq(
                imoveis.id,
                property.id,
              ),
            );

          console.log(
            "  ✓ imagemUrl principal atualizada.",
          );
        }

        /*
         * ========================================================
         * MANIFEST
         * ========================================================
         */

        manifestByOrder.set(
          category.ordem,
          {
            ordem:
              category.ordem,
            categoria:
              category.categoria,
            busca:
              buildQueries(
                property,
                category.categoria,
              )[0],
            pexelsId:
              selected.pexelsId,
            pexelsUrl:
              selected.pexelsUrl,
            arquivo:
              category.arquivo,
            databasePhotoId:
              inserted.id,
            storageKey:
              resultado.key,
            storageUrl:
              resultado.url,
            largura:
              converted.width,
            altura:
              converted.height,
            tamanhoBytes:
              converted.buffer.length,
          },
        );

        await writeManifest(
          property,
          Array.from(
            manifestByOrder.values(),
          ),
        );

        console.log(
          "  ✓ Manifest atualizado.",
        );

        addedForProperty++;
        summary.photosAdded++;
      } catch (error) {
        console.error(
          `  ❌ Falha em ${category.categoria}:`,
        );

        console.error(
          `     ${
            error instanceof Error
              ? error.message
              : error
          }`,
        );
      }
    }

    const totalAfter =
      existing.length +
      addedForProperty;

    if (
      totalAfter >= TARGET_PHOTOS
    ) {
      summary.completed++;

      console.log("");
      console.log(
        `✅ ${property.codigo}: ${totalAfter}/${TARGET_PHOTOS}`,
      );
    } else if (
      addedForProperty > 0
    ) {
      summary.partial++;

      console.log("");
      console.log(
        `⚠️ ${property.codigo}: ${totalAfter}/${TARGET_PHOTOS}`,
      );
    } else {
      summary.errors++;

      console.log("");
      console.log(
        `❌ ${property.codigo}: nenhuma imagem adicionada.`,
      );
    }
  }

  /*
   * ============================================================
   * RESUMO
   * ============================================================
   */

  console.log("");
  console.log(
    "============================================================",
  );
  console.log(
    " RESUMO FINAL",
  );
  console.log(
    "============================================================",
  );
  console.log("");

  console.log(
    `📚 Manifests consultados: conjunto global carregado`,
  );

  console.log(
    `🔒 Pexels IDs únicos protegidos: ${usedPexelsIds.size}`,
  );

  console.log(
    `🖼️ Fotos adicionadas nesta execução: ${summary.photosAdded}`,
  );

  console.log(
    `✅ Concluídos: ${summary.completed}`,
  );

  console.log(
    `⏭️ Pulados: ${summary.skipped}`,
  );

  console.log(
    `⚠️ Parciais: ${summary.partial}`,
  );

  console.log(
    `❌ Erros: ${summary.errors}`,
  );

  console.log("");
}

main().catch((error) => {
  console.error("");
  console.error(
    "============================================================",
  );
  console.error(
    " ERRO FATAL NO PREENCHIMENTO",
  );
  console.error(
    "============================================================",
  );
  console.error("");

  console.error(
    error instanceof Error
      ? error.message
      : error,
  );

  console.error("");

  process.exit(1);
});