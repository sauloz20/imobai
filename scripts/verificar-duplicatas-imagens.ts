import fs from "node:fs";
import path from "node:path";

const root = path.resolve("imoveis-fotos");

type Photo = {
  ordem?: number;
  databasePhotoId?: number;
  storageKey?: string;
  storageUrl?: string;
  pexelsId?: string | number | null;
  pexelsUrl?: string | null;
  photographer?: string | null;
  sourceUrl?: string | null;
  query?: string | null;
  localFile?: string | null;
};

type Manifest = {
  generatedAt?: string;
  property?: {
    id?: number;
    codigo?: string;
    tituloAnuncio?: string;
    tipo?: string;
    bairro?: string;
    cidade?: string;
  };
  photos?: Photo[];
};

const used = new Map<
  string,
  Array<{
    codigo: string;
    titulo: string;
    ordem: number;
    databasePhotoId: number | string;
    storageKey: string;
  }>
>();

const withoutPexels: Array<{
  codigo: string;
  ordem: number;
  databasePhotoId: number | string;
  storageKey: string;
}> = [];

const manifests = fs
  .readdirSync(root, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => path.join(root, entry.name, "manifest.json"))
  .filter((file) => fs.existsSync(file));

let totalPhotos = 0;
let totalPexelsPhotos = 0;

for (const manifestPath of manifests) {
  const folder = path.basename(path.dirname(manifestPath));

  try {
    const manifest = JSON.parse(
      fs.readFileSync(manifestPath, "utf8")
    ) as Manifest;

    const codigo = manifest.property?.codigo ?? folder;
    const titulo = manifest.property?.tituloAnuncio ?? "";

    for (const photo of manifest.photos ?? []) {
      totalPhotos++;

      const pexelsId = String(photo.pexelsId ?? "").trim();

      if (!pexelsId) {
        withoutPexels.push({
          codigo,
          ordem: Number(photo.ordem ?? -1),
          databasePhotoId: photo.databasePhotoId ?? "",
          storageKey: photo.storageKey ?? "",
        });

        continue;
      }

      totalPexelsPhotos++;

      if (!used.has(pexelsId)) {
        used.set(pexelsId, []);
      }

      used.get(pexelsId)!.push({
        codigo,
        titulo,
        ordem: Number(photo.ordem ?? -1),
        databasePhotoId: photo.databasePhotoId ?? "",
        storageKey: photo.storageKey ?? "",
      });
    }
  } catch (error) {
    console.log(`❌ Erro lendo ${manifestPath}`);
    console.log(error);
  }
}

const duplicates = [...used.entries()]
  .filter(([, occurrences]) => {
    const properties = new Set(
      occurrences.map((occurrence) => occurrence.codigo)
    );

    return properties.size > 1;
  })
  .sort((a, b) => Number(a[0]) - Number(b[0]));

console.log("");
console.log("==============================================");
console.log("      DIAGNÓSTICO GLOBAL DO IMOBAI");
console.log("==============================================");
console.log("");

console.log(`Manifests encontrados: ${manifests.length}`);
console.log(`Fotos nos manifests: ${totalPhotos}`);
console.log(`Fotos com Pexels ID: ${totalPexelsPhotos}`);
console.log(`Fotos sem Pexels ID: ${withoutPexels.length}`);
console.log(`IDs Pexels únicos: ${used.size}`);
console.log(`IDs Pexels duplicados: ${duplicates.length}`);

console.log("");
console.log("==============================================");
console.log("FOTOS SEM PEXELS ID");
console.log("==============================================");

if (withoutPexels.length === 0) {
  console.log("Nenhuma.");
} else {
  for (const photo of withoutPexels) {
    console.log(
      `${photo.codigo} | ordem ${photo.ordem} | DB ${photo.databasePhotoId} | ${photo.storageKey}`
    );
  }
}

console.log("");
console.log("==============================================");
console.log("DUPLICATAS ENTRE IMÓVEIS");
console.log("==============================================");

if (duplicates.length === 0) {
  console.log("Nenhuma duplicata encontrada nos IDs identificáveis.");
} else {
  for (const [pexelsId, occurrences] of duplicates) {
    console.log("");
    console.log(`Pexels ID: ${pexelsId}`);

    for (const occurrence of occurrences) {
      console.log(
        `  ${occurrence.codigo} | ordem ${occurrence.ordem} | DB ${occurrence.databasePhotoId} | ${occurrence.storageKey}`
      );
    }
  }
}

console.log("");
console.log("==============================================");
console.log("FOTOS POR IMÓVEL");
console.log("==============================================");

for (const manifestPath of manifests) {
  try {
    const manifest = JSON.parse(
      fs.readFileSync(manifestPath, "utf8")
    ) as Manifest;

    const codigo =
      manifest.property?.codigo ??
      path.basename(path.dirname(manifestPath));

    console.log(
      `${codigo}: ${(manifest.photos ?? []).length}/5 fotos`
    );
  } catch {}
}

console.log("");
console.log("==============================================");