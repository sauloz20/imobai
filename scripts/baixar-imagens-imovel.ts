import "dotenv/config";
import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

type Imagem = {
  categoria: string;
  busca: string;
  id: number;
  url: string;
  arquivo?: string;
  caminho?: string;
  largura?: number;
  altura?: number;
};

const argumentos = process.argv.slice(2);

const IMOVEL_ID = argumentos[0];

const buscas = [
  {
    categoria: "fachada",
    query: argumentos[1],
  },
  {
    categoria: "sala",
    query: argumentos[2],
  },
  {
    categoria: "cozinha",
    query: argumentos[3],
  },
  {
    categoria: "quarto",
    query: argumentos[4],
  },
  {
    categoria: "banheiro",
    query: argumentos[5],
  },
];

if (!IMOVEL_ID) {
  throw new Error(
    'Uso: pnpm exec tsx .\\scripts\\baixar-imagens-imovel.ts IMB-012 "busca fachada" "busca sala" "busca cozinha" "busca quarto" "busca banheiro"'
  );
}

if (buscas.some((item) => !item.query?.trim())) {
  throw new Error("É necessário informar exatamente 5 buscas do Pexels.");
}

const PEXELS_API_KEY = process.env.PEXELS_API_KEY?.trim();

if (!PEXELS_API_KEY) {
  throw new Error(
    "PEXELS_API_KEY não encontrada no arquivo .env."
  );
}

const pastaDestino = path.resolve(
  "imoveis-fotos",
  IMOVEL_ID
);

async function buscarImagemPexels(
  categoria: string,
  query: string
): Promise<Imagem> {
  console.log(`  Pesquisando Pexels: "${query}"`);

  const parametros = new URLSearchParams({
    query,
    per_page: "10",
    orientation: "landscape",
  });

  const resposta = await fetch(
    `https://api.pexels.com/v1/search?${parametros.toString()}`,
    {
      headers: {
        Authorization: PEXELS_API_KEY,
      },
    }
  );

  if (!resposta.ok) {
    throw new Error(
      `Falha na API do Pexels para "${query}": HTTP ${resposta.status}`
    );
  }

  const dados = (await resposta.json()) as {
    photos?: Array<{
      id: number;
      src?: {
        large2x?: string;
        large?: string;
        medium?: string;
      };
    }>;
  };

  const foto = dados.photos?.find(
    (item) =>
      item.src?.large2x ||
      item.src?.large ||
      item.src?.medium
  );

  if (!foto) {
    throw new Error(
      `Nenhuma imagem encontrada no Pexels para: "${query}"`
    );
  }

  const url =
    foto.src?.large2x ??
    foto.src?.large ??
    foto.src?.medium;

  if (!url) {
    throw new Error(
      `A imagem ${foto.id} não possui URL válida.`
    );
  }

  return {
    categoria,
    busca: query,
    id: foto.id,
    url,
  };
}

async function baixarImagem(
  imagem: Imagem,
  indice: number
) {
  console.log(
    `[${indice + 1}/${buscas.length}] Baixando ${imagem.categoria}...`
  );

  const resposta = await fetch(imagem.url);

  if (!resposta.ok) {
    throw new Error(
      `Falha ao baixar Pexels ${imagem.id}: HTTP ${resposta.status}`
    );
  }

  const buffer = Buffer.from(
    await resposta.arrayBuffer()
  );

  const nomeArquivo =
    `${String(indice + 1).padStart(2, "0")}-${imagem.categoria}.webp`;

  const caminhoFinal = path.join(
    pastaDestino,
    nomeArquivo
  );

  await sharp(buffer)
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
    .toFile(caminhoFinal);

  const metadata = await sharp(caminhoFinal).metadata();

  return {
    ...imagem,
    arquivo: nomeArquivo,
    caminho: caminhoFinal,
    largura: metadata.width,
    altura: metadata.height,
  };
}

async function main() {
  console.log("");
  console.log("==========================================");
  console.log(" DOWNLOAD DE IMAGENS DO IMOB-AI");
  console.log("==========================================");
  console.log("");
  console.log(`Imóvel: ${IMOVEL_ID}`);
  console.log(`Destino: ${pastaDestino}`);
  console.log("");
  console.log("Fonte: Pexels");
  console.log("Processamento: Sharp → WebP");
  console.log("Nenhuma imagem será enviada ao Supabase.");
  console.log("");

  await fs.mkdir(pastaDestino, {
    recursive: true,
  });

  const imagens: Imagem[] = [];

  for (const item of buscas) {
    const imagem = await buscarImagemPexels(
      item.categoria,
      item.query
    );

    imagens.push(imagem);

    console.log(
      `  ✓ Pexels #${imagem.id} selecionada`
    );
    console.log("");
  }

  console.log("------------------------------------------");
  console.log("Baixando e comprimindo imagens...");
  console.log("------------------------------------------");
  console.log("");

  const resultados = [];

  for (let i = 0; i < imagens.length; i++) {
    const resultado = await baixarImagem(
      imagens[i],
      i
    );

    resultados.push(resultado);

    const tamanho = await fs.stat(
      resultado.caminho!
    );

    console.log(
      `  ✓ ${resultado.arquivo} — ` +
      `${resultado.largura}x${resultado.altura} — ` +
      `${(tamanho.size / 1024).toFixed(1)} KB`
    );

    console.log("");
  }

  const manifest = {
    imovel_id: IMOVEL_ID,
    processado_em: new Date().toISOString(),
    fonte: "Pexels",
    configuracao: {
      formato: "webp",
      largura_maxima: 1600,
      qualidade: 82,
      sem_enviar_ao_supabase: true,
    },
    imagens: resultados.map((imagem) => ({
      categoria: imagem.categoria,
      busca: imagem.busca,
      pexels_id: imagem.id,
      url_imagem: imagem.url,
      arquivo: imagem.arquivo,
      largura: imagem.largura,
      altura: imagem.altura,
    })),
  };

  await fs.writeFile(
    path.join(pastaDestino, "manifest.json"),
    JSON.stringify(manifest, null, 2),
    "utf8"
  );

  console.log("==========================================");
  console.log(" CONCLUÍDO");
  console.log("==========================================");
  console.log("");
  console.log(
    `${resultados.length} imagens salvas em:`
  );
  console.log(pastaDestino);
  console.log("");
  console.log("Manifesto salvo em: manifest.json");
  console.log("");
  console.log("Nenhuma imagem foi enviada ao Supabase.");
}

main().catch((erro) => {
  console.error("");
  console.error("ERRO:", erro);
  process.exit(1);
});
