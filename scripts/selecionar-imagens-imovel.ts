import "dotenv/config";

type PexelsPhoto = {
  id: number;
  width: number;
  height: number;
  url: string;
  photographer: string;
  photographer_url: string;
  alt: string;
  src: {
    original: string;
    large2x: string;
    large: string;
    medium: string;
    small: string;
    portrait: string;
    landscape: string;
    tiny: string;
  };
};

type PexelsResponse = {
  total_results: number;
  page: number;
  per_page: number;
  photos: PexelsPhoto[];
};

type Categoria = {
  nome: string;
  emoji: string;
  query: string;
};

const PEXELS_API_URL = "https://api.pexels.com/v1/search";

const IMOVEL = {
  id: "IMB-UMFIT4D",
  titulo: "Casa com 3 quartos em Chiquinho GuimarÃ£es",
  bairro: "Chiquinho GuimarÃ£es",
  cidade: "Montes Claros",
};

const CATEGORIAS: Categoria[] = [
  {
    nome: "Fachada",
    emoji: "ðŸ ",
    query: "modern residential house exterior empty no people",
  },
  {
    nome: "Sala",
    emoji: "ðŸ›‹ï¸",
    query: "modern residential living room interior empty no people",
  },
  {
    nome: "Cozinha",
    emoji: "ðŸ³",
    query: "modern residential kitchen interior empty no people",
  },
  {
    nome: "Quarto",
    emoji: "ðŸ›ï¸",
    query: "modern residential bedroom interior empty no people",
  },
  {
    nome: "Banheiro",
    emoji: "ðŸš¿",
    query: "modern residential bathroom interior empty no people",
  },
];

function validarApiKey(): string {
  const apiKey = process.env.PEXELS_API_KEY;

  if (!apiKey || apiKey.trim() === "") {
    throw new Error(
      "PEXELS_API_KEY nao encontrada. Verifique o arquivo .env."
    );
  }

  return apiKey.trim();
}

async function buscarFotos(
  apiKey: string,
  categoria: Categoria
): Promise<PexelsPhoto[]> {
  const params = new URLSearchParams();

  params.set("query", categoria.query);
  params.set("orientation", "landscape");
  params.set("per_page", "10");
  params.set("page", "1");
  params.set("locale", "en-US");

  const url = PEXELS_API_URL + "?" + params.toString();

  const response = await fetch(url, {
    method: "GET",
    headers: {
      Authorization: apiKey,
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    const erro = await response.text();

    throw new Error(
      "Pexels retornou HTTP " +
        response.status +
        " para a busca: " +
        categoria.query +
        "\n" +
        erro
    );
  }

  const data = (await response.json()) as PexelsResponse;

  return data.photos || [];
}

function selecionarMelhorFoto(
  fotos: PexelsPhoto[],
  fotosJaSelecionadas: Set<number>
): PexelsPhoto | null {
  const disponiveis = fotos.filter(function (foto) {
    return !fotosJaSelecionadas.has(foto.id);
  });

  if (disponiveis.length === 0) {
    return null;
  }

  const ordenadas = disponiveis.slice().sort(function (a, b) {
    const areaA = a.width * a.height;
    const areaB = b.width * b.height;

    return areaB - areaA;
  });

  return ordenadas[0];
}

function imprimirResultado(
  categoria: Categoria,
  foto: PexelsPhoto
): void {
  console.log("");
  console.log("=".repeat(70));
  console.log(
    categoria.emoji + " " + categoria.nome.toUpperCase()
  );
  console.log("=".repeat(70));

  console.log("ID Pexels:       " + foto.id);
  console.log("Fotografo:        " + foto.photographer);
  console.log(
    "Dimensoes:        " +
      foto.width +
      " x " +
      foto.height
  );
  console.log(
    "Descricao:        " +
      (foto.alt || "Sem descricao")
  );
  console.log("Pagina Pexels:    " + foto.url);
  console.log("Imagem:           " + foto.src.large2x);
}

async function main(): Promise<void> {
  console.log("");
  console.log(
    "=============================================================="
  );
  console.log(
    "          SELECAO DE IMAGENS - IMOB.AI"
  );
  console.log(
    "=============================================================="
  );
  console.log("");

  console.log("Imovel:   " + IMOVEL.id);
  console.log("Titulo:   " + IMOVEL.titulo);
  console.log(
    "Local:    " +
      IMOVEL.bairro +
      " - " +
      IMOVEL.cidade
  );

  const apiKey = validarApiKey();

  console.log("");
  console.log("Consultando o Pexels...");
  console.log(
    "Nenhuma imagem sera baixada ou enviada ao Supabase."
  );
  console.log("");

  const selecionadas = new Set<number>();
  let totalSelecionadas = 0;

  for (const categoria of CATEGORIAS) {
    console.log(
      "Procurando " +
        categoria.nome.toLowerCase() +
        "..."
    );

    try {
      const fotos = await buscarFotos(
        apiKey,
        categoria
      );

      if (fotos.length === 0) {
        console.log(
          "Nenhuma foto encontrada para " +
            categoria.nome +
            "."
        );
        continue;
      }

      const foto = selecionarMelhorFoto(
        fotos,
        selecionadas
      );

      if (!foto) {
        console.log(
          "Nao foi possivel encontrar uma foto unica para " +
            categoria.nome +
            "."
        );
        continue;
      }

      selecionadas.add(foto.id);
      totalSelecionadas++;

      imprimirResultado(categoria, foto);
    } catch (error) {
      console.error(
        "Erro ao buscar " + categoria.nome + ":",
        error instanceof Error
          ? error.message
          : error
      );
    }
  }

  console.log("");
  console.log("=".repeat(70));
  console.log("RESUMO");
  console.log("=".repeat(70));

  console.log("Imovel:               " + IMOVEL.id);
  console.log(
    "Imagens selecionadas: " +
      totalSelecionadas +
      "/5"
  );

  console.log("");

  if (totalSelecionadas === 5) {
    console.log(
      "Selecao concluida com 5 imagens."
    );
  } else {
    console.log(
      "Foram encontradas " +
        totalSelecionadas +
        " imagens de 5 possiveis."
    );
  }

  console.log("");
  console.log(
    "Proxima etapa: revisar as imagens antes do download automatico."
  );
  console.log("");
}

main().catch(function (error) {
  console.error("");
  console.error("ERRO FATAL");
  console.error(
    error instanceof Error
      ? error.message
      : error
  );
  console.error("");

  process.exit(1);
});


