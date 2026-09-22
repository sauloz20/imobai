
import "dotenv/config";
import fs from "node:fs/promises";
import path from "node:path";

import { getDb } from "../server/db";
import { imoveis, imovelFotos } from "../drizzle/schema";

const ROOT = path.resolve("imoveis-fotos");

type ManifestPhoto = {
  ordem?: number | null;
  categoria?: string | null;
  pexelsId?: number | string | null;
  pexels_id?: number | string | null;
  arquivo?: string | null;
  storageKey?: string | null;
  storageUrl?: string | null;
  databasePhotoId?: number | null;
  url_imagem?: string | null;
};

type Manifest = {
  property?: {
    id?: number;
    codigo?: string;
    tituloAnuncio?: string;
    tipo?: string;
    bairro?: string;
    cidade?: string;
  };
  photos?: ManifestPhoto[];
  imagens?: ManifestPhoto[];
};

type Property = {
  id: number;
  codigo: string | null;
};

type DatabasePhoto = {
  id: number;
  imovelId: number;
  ordem: number;
  fileKey: string;
};

function getPexelsId(photo: ManifestPhoto): string | null {
  const value = photo.pexelsId ?? photo.pexels_id;

  if (value === undefined || value === null) {
    return null;
  }

  const normalized = String(value).trim();

  return normalized.length > 0 ? normalized : null;
}

function getPhotos(manifest: Manifest): ManifestPhoto[] {
  if (Array.isArray(manifest.photos)) {
    return manifest.photos;
  }

  if (Array.isArray(manifest.imagens)) {
    return manifest.imagens;
  }

  return [];
}

async function getManifestFiles(): Promise<string[]> {
  const result: string[] = [];

  let directories: string[];

  try {
    directories = await fs.readdir(ROOT);
  } catch {
    return result;
  }

  for (const directory of directories) {
    const manifestPath = path.join(
      ROOT,
      directory,
      "manifest.json"
    );

    try {
      const stat = await fs.stat(manifestPath);

      if (stat.isFile()) {
        result.push(manifestPath);
      }
    } catch {
      // Ignore missing manifest files.
    }
  }

  return result.sort();
}

async function loadManifests() {
  const files = await getManifestFiles();

  const result: Array<{
    filePath: string;
    directory: string;
    manifest: Manifest;
  }> = [];

  for (const filePath of files) {
    try {
      const content = await fs.readFile(filePath, "utf8");
      const manifest = JSON.parse(content) as Manifest;

      result.push({
        filePath,
        directory: path.basename(path.dirname(filePath)),
        manifest,
      });
    } catch (error) {
      console.log("");
      console.log("Could not read manifest:");
      console.log(filePath);
      console.log(error);
    }
  }

  return result;
}

async function loadDatabaseProperties(): Promise<Property[]> {
  const db = await getDb();

  return db
    .select({
      id: imoveis.id,
      codigo: imoveis.codigo,
    })
    .from(imoveis);
}

async function loadDatabasePhotos(): Promise<DatabasePhoto[]> {
  const db = await getDb();

  return db
    .select({
      id: imovelFotos.id,
      imovelId: imovelFotos.imovelId,
      ordem: imovelFotos.ordem,
      fileKey: imovelFotos.fileKey,
    })
    .from(imovelFotos);
}

async function main() {
  console.log("");
  console.log("==============================================");
  console.log("        IMOBAI IMAGE DIAGNOSTIC");
  console.log("==============================================");
  console.log("");

  const manifests = await loadManifests();
  const properties = await loadDatabaseProperties();
  const databasePhotos = await loadDatabasePhotos();

  console.log(
    `Manifests found: ${manifests.length}`
  );

  const allPhotos: Array<{
    codigo: string;
    ordem: number;
    databasePhotoId: number | null;
    pexelsId: string | null;
    arquivo: string;
  }> = [];

  for (const item of manifests) {
    const codigo =
      item.manifest.property?.codigo ??
      item.directory;

    const photos = getPhotos(item.manifest);

    for (const photo of photos) {
      allPhotos.push({
        codigo,
        ordem:
          typeof photo.ordem === "number"
            ? photo.ordem
            : -1,
        databasePhotoId:
          typeof photo.databasePhotoId === "number"
            ? photo.databasePhotoId
            : null,
        pexelsId: getPexelsId(photo),
        arquivo: String(photo.arquivo ?? ""),
      });
    }
  }

  console.log(
    `Photos in manifests: ${allPhotos.length}`
  );

  const withPexels = allPhotos.filter(
    (photo) => photo.pexelsId !== null
  );

  const withoutPexels = allPhotos.filter(
    (photo) => photo.pexelsId === null
  );

  const pexelsIds = withPexels.map(
    (photo) => photo.pexelsId as string
  );

  const uniquePexelsIds = new Set(pexelsIds);

  const idCounts = new Map<string, number>();

  for (const id of pexelsIds) {
    const current = idCounts.get(id) ?? 0;
    idCounts.set(id, current + 1);
  }

  const duplicatedIds = Array.from(idCounts.entries())
    .filter(([, count]) => count > 1)
    .sort(([a], [b]) => a.localeCompare(b));

  console.log(
    `Photos with Pexels ID: ${withPexels.length}`
  );

  console.log(
    `Photos without Pexels ID: ${withoutPexels.length}`
  );

  console.log(
    `Unique Pexels IDs: ${uniquePexelsIds.size}`
  );

  console.log(
    `Duplicated Pexels IDs: ${duplicatedIds.length}`
  );

  console.log("");
  console.log("==============================================");
  console.log("PHOTOS WITHOUT PEXELS ID");
  console.log("==============================================");

  if (withoutPexels.length === 0) {
    console.log("None.");
  } else {
    for (const photo of withoutPexels) {
      console.log(
        `${photo.codigo} | order ${photo.ordem} | DB ${
          photo.databasePhotoId ?? ""
        } | ${photo.arquivo}`
      );
    }
  }

  console.log("");
  console.log("==============================================");
  console.log("DUPLICATES");
  console.log("==============================================");

  if (duplicatedIds.length === 0) {
    console.log("No duplicated Pexels IDs.");
  } else {
    for (const [id, count] of duplicatedIds) {
      console.log("");
      console.log(
        `Pexels ID ${id} appears ${count} times:`
      );

      const matches = allPhotos.filter(
        (photo) => photo.pexelsId === id
      );

      for (const match of matches) {
        console.log(
          `  ${match.codigo} | order ${match.ordem} | DB ${
            match.databasePhotoId ?? ""
          } | ${match.arquivo}`
        );
      }
    }
  }

  console.log("");
  console.log("==============================================");
  console.log("PHOTOS PER PROPERTY");
  console.log("==============================================");

  const manifestCount = new Map<string, number>();

  for (const photo of allPhotos) {
    const current = manifestCount.get(photo.codigo) ?? 0;
    manifestCount.set(photo.codigo, current + 1);
  }

  const propertyCodes = new Set<string>();

  for (const property of properties) {
    if (property.codigo) {
      propertyCodes.add(property.codigo);
    }
  }

  for (const item of manifests) {
    const codigo =
      item.manifest.property?.codigo ??
      item.directory;

    propertyCodes.add(codigo);
  }

  for (const codigo of Array.from(propertyCodes).sort()) {
    const count = manifestCount.get(codigo) ?? 0;

    console.log(
      `${codigo}: ${count}/5 photos`
    );
  }

  console.log("");
  console.log("==============================================");
  console.log("DATABASE VALIDATION");
  console.log("==============================================");

  const databaseCount = new Map<number, number>();

  for (const photo of databasePhotos) {
    const current = databaseCount.get(photo.imovelId) ?? 0;
    databaseCount.set(photo.imovelId, current + 1);
  }

  const sortedProperties = [...properties].sort(
    (a, b) =>
      String(a.codigo).localeCompare(
        String(b.codigo)
      )
  );

  for (const property of sortedProperties) {
    const count =
      databaseCount.get(property.id) ?? 0;

    console.log(
      `${property.codigo ?? `ID ${property.id}`}: ${count}/5 photos in database`
    );
  }

  console.log("");
  console.log("==============================================");
  console.log("FINAL VALIDATION");
  console.log("==============================================");

  const expectedPhotos = properties.length * 5;

  const manifestsOk = properties.every(
    (property) =>
      property.codigo !== null &&
      (manifestCount.get(property.codigo) ?? 0) === 5
  );

  const databaseOk = properties.every(
    (property) =>
      (databaseCount.get(property.id) ?? 0) === 5
  );

  const pexelsOk =
    withoutPexels.length === 0;

  const duplicatesOk =
    duplicatedIds.length === 0;

  console.log(
    `Expected photos: ${expectedPhotos}`
  );

  console.log(
    `Five manifest photos per property: ${
      manifestsOk ? "OK" : "ERROR"
    }`
  );

  console.log(
    `Five database photos per property: ${
      databaseOk ? "OK" : "ERROR"
    }`
  );

  console.log(
    `All photos have Pexels ID: ${
      pexelsOk ? "OK" : "WARNING"
    }`
  );

  console.log(
    `No duplicated Pexels IDs: ${
      duplicatesOk ? "OK" : "ERROR"
    }`
  );

  console.log("");

  if (
    manifestsOk &&
    databaseOk &&
    pexelsOk &&
    duplicatesOk
  ) {
    console.log(
      "FINAL STATUS: ALL CHECKS PASSED."
    );
  } else {
    console.log(
      "FINAL STATUS: SOME CHECKS NEED ATTENTION."
    );
  }

  console.log("");
}

main().catch((error) => {
  console.error("");
  console.error("Diagnostic error:");
  console.error(error);
  process.exit(1);
});
