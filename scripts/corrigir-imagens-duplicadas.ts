import "dotenv/config";
import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import sharp from "sharp";

import { and, asc, eq, inArray } from "drizzle-orm";

import { getDb } from "../server/db";
import { imovelFotos, imoveis } from "../drizzle/schema";
import { storagePut, storageRemove } from "../server/storage";

type PexelsPhoto = {
  id: number;
  width?: number;
  height?: number;
  photographer?: string;
  photographer_url?: string;
  alt?: string | null;
  src?: {
    original?: string;
    large2x?: string;
    large?: string;
    medium?: string;
  };
};

type PexelsSearchResponse = {
  photos?: PexelsPhoto[];
};

type ManifestPhoto = {
  ordem?: number;
  databasePhotoId?: number | null;
  storageKey?: string | null;
  storageUrl?: string | null;
  pexelsId?: number | null;
  pexelsUrl?: string | null;
  arquivo?: string | null;
  categoria?: string | null;
  busca?: string | null;
  width?: number | null;
  height?: number | null;
  tamanho_bytes?: number | null;
  [key: string]: unknown;
};

type LegacyManifestImage = {
  categoria?: string;
  busca?: string;
  pexels_id?: number | null;
  url_imagem?: string | null;
  arquivo?: string | null;
  [key: string]: unknown;
};

type Manifest = {
  property?: {
    id?: number;
    codigo?: string;
    tituloAnuncio?: string;
    tipo?: string;
    bairro?: string;
    cidade?: string;
    [key: string]: unknown;
  };
  photos?: ManifestPhoto[];
  imagens?: LegacyManifestImage[];
  [key: string]: unknown;
};

type DbPhoto = {
  id: number;
  imovelId: number;
  ordem: number;
  fileKey: string;
  url: string;
};

type Property = {
  id: number;
  codigo: string;
  titulo: string;
  tipo: string;
  bairro: string;
  cidade: string;
};

type PhotoInfo = DbPhoto & {
  property: Property;
  pexelsId: number | null;
  manifestPath: string;
};

type Replacement = {
  photo: PhotoInfo;
  oldPexelsId: number;
};

type DownloadedImage = {
  buffer: Buffer;
  width: number;
  height: number;
  bytes: number;
};

const ROOT = process.cwd();
const IMAGES_ROOT = path.join(ROOT, "imoveis-fotos");

const PEXELS_API_KEY = String(
  process.env.PEXELS_API_KEY ?? ""
).trim();

const MAX_PHOTOS = 5;
const IMAGE_WIDTH = 1600;
const IMAGE_QUALITY = 82;

const DELAY_MS = 180;

const CATEGORY_BY_ORDER: Record<number, string> = {
  0: "fachada",
  1: "sala",
  2: "cozinha",
  3: "quarto",
  4: "banheiro",
};

const CATEGORY_QUERIES: Record<string, string[]> = {
  fachada: [
    "modern house exterior",
    "beautiful house exterior",
    "residential house facade",
    "modern residential facade",
    "family house exterior",
    "contemporary home exterior",
  ],
  sala: [
    "modern living room interior",
    "bright living room interior",
    "contemporary living room",
    "cozy modern living room",
    "elegant living room interior",
    "minimal living room interior",
  ],
  cozinha: [
    "modern kitchen interior",
    "contemporary kitchen interior",
    "bright modern kitchen",
    "elegant kitchen interior",
    "modern residential kitchen",
    "minimal kitchen interior",
  ],
  quarto: [
    "modern bedroom interior",
    "bright bedroom interior",
    "contemporary bedroom",
    "cozy modern bedroom",
    "elegant bedroom interior",
    "minimal bedroom interior",
  ],
  banheiro: [
    "modern bathroom interior",
    "contemporary bathroom interior",
    "luxury bathroom interior",
    "bright modern bathroom",
    "minimal bathroom interior",
    "elegant bathroom interior",
  ],
};

const sleep = (ms: number) =>
  new Promise(resolve => setTimeout(resolve, ms));

function normalizeText(value: unknown): string {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\p{L}\p{N}\s-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function safeSegment(value: string): string {
  return normalizeText(value)
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .slice(0, 60);
}

function randomSuffix(): string {
  return crypto.randomBytes(5).toString("hex");
}

function categoryForOrder(ordem: number): string {
  return CATEGORY_BY_ORDER[ordem] ?? "interior";
}

function extensionName(category: string): string {
  return `${String(category).padStart(2, "0")}`;
}

function buildSearchQueries(
  property: Property,
  ordem: number
): string[] {
  const category = categoryForOrder(ordem);

  const type = normalizeText(property.tipo);
  const bairro = normalizeText(property.bairro);
  const cidade = normalizeText(property.cidade);

  const base = CATEGORY_QUERIES[category] ?? [
    "modern home interior",
    "beautiful residential interior",
    "contemporary home interior",
  ];

  const contextual: string[] = [];

  if (type) {
    contextual.push(`${type} ${category}`);
  }

  if (bairro && bairro.toLowerCase() !== "centro") {
    contextual.push(
      `${category} residential ${bairro}`
    );
  }

  if (cidade) {
    contextual.push(
      `${category} residential ${cidade}`
    );
  }

  return [
    ...contextual,
    ...base,
  ];
}

async function readManifest(
  codigo: string
): Promise<{
  manifest: Manifest;
  manifestPath: string;
} | null> {
  const manifestPath = path.join(
    IMAGES_ROOT,
    codigo,
    "manifest.json"
  );

  try {
    const raw = await fs.readFile(
      manifestPath,
      "utf8"
    );

    return {
      manifest: JSON.parse(raw) as Manifest,
      manifestPath,
    };
  } catch {
    return null;
  }
}

function getManifestPexelsId(
  manifest: Manifest,
  dbPhoto: DbPhoto
): number | null {
  if (Array.isArray(manifest.photos)) {
    const item = manifest.photos.find(
      photo =>
        Number(photo.databasePhotoId) === dbPhoto.id ||
        Number(photo.ordem) === dbPhoto.ordem
    );

    if (item?.pexelsId != null) {
      const id = Number(item.pexelsId);
      return Number.isFinite(id) && id > 0
        ? id
        : null;
    }
  }

  if (Array.isArray(manifest.imagens)) {
    const item =
      manifest.imagens[dbPhoto.ordem];

    if (item?.pexels_id != null) {
      const id = Number(item.pexels_id);
      return Number.isFinite(id) && id > 0
        ? id
        : null;
    }
  }

  return null;
}

function updateManifestPhoto(
  manifest: Manifest,
  photo: DbPhoto,
  data: {
    pexelsId: number;
    pexelsUrl: string;
    storageKey: string;
    storageUrl: string;
    arquivo: string;
    categoria: string;
    busca: string;
    width: number;
    height: number;
    bytes: number;
  }
): Manifest {
  if (Array.isArray(manifest.photos)) {
    const index = manifest.photos.findIndex(
      item =>
        Number(item.databasePhotoId) === photo.id ||
        Number(item.ordem) === photo.ordem
    );

    if (index >= 0) {
      manifest.photos[index] = {
        ...manifest.photos[index],
        ordem: photo.ordem,
        databasePhotoId: photo.id,
        storageKey: data.storageKey,
        storageUrl: data.storageUrl,
        pexelsId: data.pexelsId,
        pexelsUrl: data.pexelsUrl,
        arquivo: data.arquivo,
        categoria: data.categoria,
        busca: data.busca,
        width: data.width,
        height: data.height,
        tamanho_bytes: data.bytes,
      };
    }

    return manifest;
  }

  if (Array.isArray(manifest.imagens)) {
    const index = photo.ordem;

    if (manifest.imagens[index]) {
      manifest.imagens[index] = {
        ...manifest.imagens[index],
        categoria: data.categoria,
        busca: data.busca,
        pexels_id: data.pexelsId,
        url_imagem: data.pexelsUrl,
        arquivo: data.arquivo,
      };
    }

    return manifest;
  }

  manifest.photos = [
    {
      ordem: photo.ordem,
      databasePhotoId: photo.id,
      storageKey: data.storageKey,
      storageUrl: data.storageUrl,
      pexelsId: data.pexelsId,
      pexelsUrl: data.pexelsUrl,
      arquivo: data.arquivo,
      categoria: data.categoria,
      busca: data.busca,
      width: data.width,
      height: data.height,
      tamanho_bytes: data.bytes,
    },
  ];

  return manifest;
}

async function writeManifest(
  manifestPath: string,
  manifest: Manifest
): Promise<void> {
  await fs.writeFile(
    manifestPath,
    `${JSON.stringify(manifest, null, 2)}\n`,
    "utf8"
  );
}

async function searchPexels(
  query: string
): Promise<PexelsPhoto[]> {
  const url = new URL(
    "https://api.pexels.com/v1/search"
  );

  url.searchParams.set("query", query);
  url.searchParams.set("per_page", "80");
  url.searchParams.set("orientation", "landscape");

  const response = await fetch(url, {
    headers: {
      Authorization: PEXELS_API_KEY,
    },
  });

  if (!response.ok) {
    const body = await response.text();

    throw new Error(
      `Pexels HTTP ${response.status}: ${body.slice(0, 300)}`
    );
  }

  const data =
    (await response.json()) as PexelsSearchResponse;

  return Array.isArray(data.photos)
    ? data.photos
    : [];
}

async function downloadAndCompress(
  url: string
): Promise<DownloadedImage> {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(
      `Download HTTP ${response.status}`
    );
  }

  const input = Buffer.from(
    await response.arrayBuffer()
  );

  const image = sharp(input).rotate();

  const metadata = await image.metadata();

  const processed = await image
    .resize({
      width: IMAGE_WIDTH,
      withoutEnlargement: true,
      fit: "inside",
    })
    .webp({
      quality: IMAGE_QUALITY,
      effort: 5,
    })
    .toBuffer({
      resolveWithObject: true,
    });

  return {
    buffer: processed.data,
    width: processed.info.width,
    height: processed.info.height,
    bytes: processed.data.length,
  };
}

async function getReplacementCandidate(
  property: Property,
  ordem: number,
  usedPexelsIds: Set<number>,
  propertyUsedIds: Set<number>
): Promise<{
  photo: PexelsPhoto;
  query: string;
} | null> {
  const queries = buildSearchQueries(
    property,
    ordem
  );

  const seenCandidates = new Set<number>();

  for (const query of queries) {
    console.log(
      `      🔎 Pexels: "${query}"`
    );

    let photos: PexelsPhoto[] = [];

    try {
      photos = await searchPexels(query);
    } catch (error) {
      console.warn(
        `      ⚠️ Falha na busca: ${
          error instanceof Error
            ? error.message
            : String(error)
        }`
      );

      continue;
    }

    for (const photo of photos) {
      if (!photo?.id) continue;

      const id = Number(photo.id);

      if (!Number.isFinite(id)) continue;
      if (seenCandidates.has(id)) continue;

      seenCandidates.add(id);

      if (usedPexelsIds.has(id)) continue;
      if (propertyUsedIds.has(id)) continue;

      const imageUrl =
        photo.src?.large2x ??
        photo.src?.large ??
        photo.src?.medium ??
        photo.src?.original;

      if (!imageUrl) continue;

      return {
        photo,
        query,
      };
    }

    await sleep(DELAY_MS);
  }

  return null;
}

async function loadProperties(): Promise<Property[]> {
  const db = await getDb();

  if (!db) {
    throw new Error(
      "Banco de dados indisponível."
    );
  }

  const rows = await db
    .select({
      id: imoveis.id,
      codigo: imoveis.codigo,
      tituloAnuncio: imoveis.tituloAnuncio,
      tipo: imoveis.tipo,
      bairro: imoveis.bairro,
      cidade: imoveis.cidade,
    })
    .from(imoveis)
    .orderBy(asc(imoveis.id));

  return rows.map(row => ({
    id: row.id,
    codigo: row.codigo,
    titulo: row.tituloAnuncio ?? "",
    tipo: row.tipo ?? "",
    bairro: row.bairro ?? "",
    cidade: row.cidade ?? "",
  }));
}

async function loadDbPhotos(
  propertyIds: number[]
): Promise<DbPhoto[]> {
  const db = await getDb();

  if (!db) {
    throw new Error(
      "Banco de dados indisponível."
    );
  }

  if (!propertyIds.length) return [];

  return db
    .select({
      id: imovelFotos.id,
      imovelId: imovelFotos.imovelId,
      ordem: imovelFotos.ordem,
      fileKey: imovelFotos.fileKey,
      url: imovelFotos.url,
    })
    .from(imovelFotos)
    .where(
      inArray(
        imovelFotos.imovelId,
        propertyIds
      )
    )
    .orderBy(
      asc(imovelFotos.imovelId),
      asc(imovelFotos.ordem),
      asc(imovelFotos.id)
    );
}

async function updatePhotoInDatabase(
  photoId: number,
  newFileKey: string,
  newUrl: string
): Promise<void> {
  const db = await getDb();

  if (!db) {
    throw new Error(
      "Banco de dados indisponível."
    );
  }

  await db
    .update(imovelFotos)
    .set({
      fileKey: newFileKey,
      url: newUrl,
    })
    .where(eq(imovelFotos.id, photoId));
}

async function updateMainImageIfNecessary(
  propertyId: number,
  ordem: number,
  newUrl: string
): Promise<void> {
  if (ordem !== 0) return;

  const db = await getDb();

  if (!db) {
    throw new Error(
      "Banco de dados indisponível."
    );
  }

  await db
    .update(imoveis)
    .set({
      imagemUrl: newUrl,
    })
    .where(eq(imoveis.id, propertyId));
}

async function main() {
  console.log("");
  console.log(
    "============================================================"
  );
  console.log(
    "CORREÇÃO SEGURA DE DUPLICATAS DE IMAGENS"
  );
  console.log(
    "============================================================"
  );
  console.log("");

  if (!PEXELS_API_KEY) {
    throw new Error(
      "PEXELS_API_KEY não encontrada no .env."
    );
  }

  const db = await getDb();

  if (!db) {
    throw new Error(
      "Banco de dados indisponível."
    );
  }

  const properties = await loadProperties();

  if (!properties.length) {
    throw new Error(
      "Nenhum imóvel encontrado."
    );
  }

  const propertyById = new Map(
    properties.map(property => [
      property.id,
      property,
    ])
  );

  const dbPhotos = await loadDbPhotos(
    properties.map(property => property.id)
  );

  const photosByProperty = new Map<
    number,
    DbPhoto[]
  >();

  for (const photo of dbPhotos) {
    const list =
      photosByProperty.get(photo.imovelId) ??
      [];

    list.push(photo);
    photosByProperty.set(
      photo.imovelId,
      list
    );
  }

  /*
   * ==========================================================
   * CARREGA TODOS OS PEXELS IDs EXISTENTES
   * ==========================================================
   */

  const allPhotoInfo: PhotoInfo[] = [];

  for (const property of properties) {
    const manifestResult =
      await readManifest(property.codigo);

    if (!manifestResult) {
      console.warn(
        `⚠️ ${property.codigo}: manifest.json não encontrado.`
      );

      continue;
    }

    const propertyPhotos =
      photosByProperty.get(property.id) ?? [];

    for (const dbPhoto of propertyPhotos) {
      const pexelsId =
        getManifestPexelsId(
          manifestResult.manifest,
          dbPhoto
        );

      allPhotoInfo.push({
        ...dbPhoto,
        property,
        pexelsId,
        manifestPath:
          manifestResult.manifestPath,
      });
    }
  }

  /*
   * ==========================================================
   * MONTA O MAPA DE DUPLICATAS
   * ==========================================================
   */

  const byPexelsId = new Map<
    number,
    PhotoInfo[]
  >();

  const usedPexelsIds = new Set<number>();

  for (const photo of allPhotoInfo) {
    if (photo.pexelsId == null) continue;

    usedPexelsIds.add(photo.pexelsId);

    const list =
      byPexelsId.get(photo.pexelsId) ??
      [];

    list.push(photo);
    byPexelsId.set(
      photo.pexelsId,
      list
    );
  }

  const duplicateGroups = [
    ...byPexelsId.entries(),
  ]
    .filter(
      ([, photos]) => photos.length > 1
    )
    .sort(
      (a, b) => a[0] - b[0]
    );

  if (!duplicateGroups.length) {
    console.log(
      "✅ Nenhuma duplicata encontrada."
    );
    return;
  }

  /*
   * ==========================================================
   * DEFINE O QUE SERÁ PRESERVADO
   * ==========================================================
   *
   * Para cada Pexels ID duplicado:
   * - menor ID do banco permanece;
   * - demais serão substituídos.
   */

  const replacements: Replacement[] = [];

  for (const [
    oldPexelsId,
    photos,
  ] of duplicateGroups) {
    const ordered = [...photos].sort(
      (a, b) => a.id - b.id
    );

    const keeper = ordered[0];

    console.log("");
    console.log(
      `Pexels ${oldPexelsId}: preservando ${keeper.property.codigo} / DB ${keeper.id}`
    );

    for (const photo of ordered.slice(1)) {
      replacements.push({
        photo,
        oldPexelsId,
      });

      console.log(
        `  🔄 ${photo.property.codigo} | ordem ${photo.ordem} | DB ${photo.id}`
      );
    }
  }

  console.log("");
  console.log(
    "============================================================"
  );
  console.log(
    `Total de substituições: ${replacements.length}`
  );
  console.log(
    "============================================================"
  );
  console.log("");

  /*
   * ==========================================================
   * EXECUTA AS SUBSTITUIÇÕES
   * ==========================================================
   */

  const success: string[] = [];
  const errors: string[] = [];

  for (
    let index = 0;
    index < replacements.length;
    index++
  ) {
    const replacement =
      replacements[index];

    const photo =
      replacement.photo;

    const property =
      photo.property;

    console.log("");
    console.log(
      `============================================================`
    );
    console.log(
      `[${index + 1}/${replacements.length}] ${property.codigo}`
    );
    console.log(
      `Foto DB: ${photo.id} | ordem: ${photo.ordem}`
    );
    console.log(
      `Pexels antigo: ${replacement.oldPexelsId}`
    );
    console.log(
      `============================================================`
    );

    try {
      /*
       * IDs já usados dentro deste imóvel.
       */
      const propertyUsedIds =
        new Set<number>();

      const propertyPhotos =
        allPhotoInfo.filter(
          item =>
            item.propertyId ===
            property.id
        );

      for (const item of propertyPhotos) {
        if (
          item.pexelsId != null &&
          item.id !== photo.id
        ) {
          propertyUsedIds.add(
            item.pexelsId
          );
        }
      }

      /*
       * Procura uma foto globalmente inédita.
       */
      const candidate =
        await getReplacementCandidate(
          property,
          photo.ordem,
          usedPexelsIds,
          propertyUsedIds
        );

      if (!candidate) {
        throw new Error(
          "Não foi encontrada uma nova foto Pexels com ID globalmente único."
        );
      }

      const newPexelsId =
        Number(candidate.photo.id);

      const imageUrl =
        candidate.photo.src?.large2x ??
        candidate.photo.src?.large ??
        candidate.photo.src?.medium ??
        candidate.photo.src?.original;

      if (!imageUrl) {
        throw new Error(
          "Candidato do Pexels não possui URL de imagem."
        );
      }

      console.log(
        `      ✅ Novo Pexels ID: ${newPexelsId}`
      );

      console.log(
        `      ⬇️ Baixando e comprimindo...`
      );

      const processed =
        await downloadAndCompress(
          imageUrl
        );

      console.log(
        `      📐 ${processed.width}x${processed.height}`
      );

      console.log(
        `      📦 ${(processed.bytes / 1024).toFixed(1)} KB`
      );

      const category =
        categoryForOrder(
          photo.ordem
        );

      const filename =
        `${extensionName(photo.ordem + 1)}-${category}_${randomSuffix()}.webp`;

      const newFileKey =
        `${property.codigo}/${filename}`;

      /*
       * ========================================================
       * 1. UPLOAD NOVO ARQUIVO
       * ========================================================
       */

      console.log(
        `      ☁️ Enviando para Supabase...`
      );

      const uploaded =
        await storagePut(
          newFileKey,
          processed.buffer,
          "image/webp"
        );

      const newUrl =
        uploaded.url;

      if (!newUrl) {
        throw new Error(
          "Supabase não retornou URL pública para a nova imagem."
        );
      }

      console.log(
        `      ✅ Upload concluído`
      );

      /*
       * ========================================================
       * 2. ATUALIZA BANCO
       * ========================================================
       */

      console.log(
        `      🗄️ Atualizando banco...`
      );

      await updatePhotoInDatabase(
        photo.id,
        uploaded.key,
        newUrl
      );

      await updateMainImageIfNecessary(
        property.id,
        photo.ordem,
        newUrl
      );

      console.log(
        `      ✅ Banco atualizado`
      );

      /*
       * ========================================================
       * 3. ATUALIZA MANIFEST
       * ========================================================
       */

      const manifestResult =
        await readManifest(
          property.codigo
        );

      if (manifestResult) {
        const updatedManifest =
          updateManifestPhoto(
            manifestResult.manifest,
            photo,
            {
              pexelsId:
                newPexelsId,
              pexelsUrl:
                imageUrl,
              storageKey:
                uploaded.key,
              storageUrl:
                newUrl,
              arquivo:
                filename,
              categoria:
                category,
              busca:
                candidate.query,
              width:
                processed.width,
              height:
                processed.height,
              bytes:
                processed.bytes,
            }
          );

        await writeManifest(
          manifestResult.manifestPath,
          updatedManifest
        );

        console.log(
          `      📝 Manifest atualizado`
        );
      } else {
        console.warn(
          `      ⚠️ Manifest não encontrado; banco já foi atualizado.`
        );
      }

      /*
       * ========================================================
       * 4. REMOVE FOTO ANTIGA
       * ========================================================
       *
       * Só chegamos aqui depois de:
       * - upload novo;
       * - update do banco;
       * - update do manifest.
       */

      console.log(
        `      🗑️ Removendo arquivo antigo...`
      );

      await storageRemove(
        photo.fileKey
      );

      console.log(
        `      ✅ Arquivo antigo removido`
      );

      /*
       * ========================================================
       * 5. RESERVA O NOVO PEXELS ID GLOBALMENTE
       * ========================================================
       */

      usedPexelsIds.add(
        newPexelsId
      );

      propertyUsedIds.add(
        newPexelsId
      );

      /*
       * Atualiza o estado em memória para
       * evitar qualquer reutilização posterior.
       */
      photo.pexelsId =
        newPexelsId;
      photo.fileKey =
        uploaded.key;
      photo.url =
        newUrl;

      success.push(
        `${property.codigo} | ordem ${photo.ordem} | ${replacement.oldPexelsId} -> ${newPexelsId}`
      );

      console.log(
        `      🎉 Substituição concluída`
      );
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : String(error);

      errors.push(
        `${property.codigo} | ordem ${photo.ordem} | ${message}`
      );

      console.error(
        `      ❌ Falha: ${message}`
      );

      /*
       * IMPORTANTE:
       * Se algo falhar antes do UPDATE:
       * - a imagem antiga permanece;
       * - o banco permanece apontando para a antiga.
       *
       * Se o UPDATE já tiver acontecido e uma etapa posterior
       * falhar, o script registra o erro e não tenta apagar
       * novamente a imagem antiga.
       */
    }

    await sleep(DELAY_MS);
  }

  /*
   * ==========================================================
   * RELATÓRIO FINAL
   * ==========================================================
   */

  console.log("");
  console.log("");
  console.log(
    "============================================================"
  );
  console.log(
    "RESUMO FINAL"
  );
  console.log(
    "============================================================"
  );

  console.log(
    `✅ Substituições concluídas: ${success.length}`
  );

  console.log(
    `❌ Falhas: ${errors.length}`
  );

  console.log("");

  if (success.length) {
    console.log(
      "SUBSTITUIÇÕES CONCLUÍDAS"
    );
    console.log(
      "------------------------------------------------------------"
    );

    for (const item of success) {
      console.log(
        `✅ ${item}`
      );
    }

    console.log("");
  }

  if (errors.length) {
    console.log(
      "FALHAS"
    );
    console.log(
      "------------------------------------------------------------"
    );

    for (const item of errors) {
      console.log(
        `❌ ${item}`
      );
    }

    console.log("");
  }

  console.log(
    "============================================================"
  );

  if (errors.length === 0) {
    console.log(
      "🎉 Todas as substituições foram concluídas."
    );
  } else {
    console.log(
      "⚠️ Algumas substituições falharam."
    );

    console.log(
      "As imagens antigas das etapas que falharam foram preservadas sempre que a falha ocorreu antes da atualização do banco."
    );
  }

  console.log(
    "============================================================"
  );
  console.log("");
}

main().catch(error => {
  console.error("");
  console.error(
    "============================================================"
  );
  console.error(
    "❌ ERRO FATAL"
  );
  console.error(
    "============================================================"
  );
  console.error(error);
  console.error("");
  process.exit(1);
});