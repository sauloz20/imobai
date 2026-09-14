import { and, asc, count, eq, gt, gte, inArray, lte, or } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { createHash, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { parse as parseCookieHeader } from "cookie";
import { nanoid } from "nanoid";
import { ENV } from "./_core/env";
import {
  chatsIa,
  conversas,
  historicoBuscas,
  imoveis,
  imovelFotos,
  localSessions,
  mensagens,
  mensagensIa,
  InsertProperty,
  InsertSearchHistory,
  InsertUser,
  Property,
  User,
  users,
} from "../drizzle/schema";

import { storageRemove } from "./storage";

let _db: ReturnType<typeof drizzle> | null = null;
let _pool: ReturnType<typeof postgres> | null = null;
const isDemoMode = process.env.NODE_ENV !== "production";

export type PropertyFilters = {
  finalidade?: "compra" | "aluguel";
  tipo?: string;
  cidade?: string;
  bairro?: string;
  quartos?: number;
  vagas?: number;
  valorMin?: number;
  valorMax?: number;
  aceitaPets?: boolean;
  varanda?: boolean;
  ensolarado?: boolean;
  limit?: number;
  offset?: number;
};

export type DemoProperty = Property;

const demoProperties: DemoProperty[] = [
  {
    id: 1,
    ownerId: null,
    codigo: "IMB-2048",
    tipo: "Apartamento",
    bairro: "Pinheiros",
    cidade: "São Paulo",
    quartos: 3,
    banheiros: 2,
    vagas: 2,
    areaM2: "96.00",
    aceitaPets: true,
    varanda: true,
    ensolarado: true,
    valorVenda: "1180000.00",
    valorAluguel: "7400.00",
    descricaoTecnica: "Planta inteligente, varanda integrada e marcenaria planejada.",
    descricaoIa: "Um apartamento luminoso em Pinheiros para viver a cidade com mais espaço e leveza.",
    tituloAnuncio: "Luz natural e varanda generosa em Pinheiros",
    status: "Disponivel",
    imagemUrl: "/manus-storage/apto-01_f5822bf0.jpg",
    dataCadastro: new Date("2026-08-24T12:00:00Z"),
  },
  {
    id: 2,
    ownerId: null,
    codigo: "IMB-1972",
    tipo: "Cobertura",
    bairro: "Vila Madalena",
    cidade: "São Paulo",
    quartos: 4,
    banheiros: 4,
    vagas: 3,
    areaM2: "182.00",
    aceitaPets: true,
    varanda: true,
    ensolarado: true,
    valorVenda: "2480000.00",
    valorAluguel: "14500.00",
    descricaoTecnica: "Cobertura duplex com terraço, churrasqueira e vista aberta.",
    descricaoIa: "Seu refúgio urbano com terraço ensolarado, ambientes amplos e vista para o skyline.",
    tituloAnuncio: "Cobertura duplex com vista aberta na Vila Madalena",
    status: "Disponivel",
    imagemUrl: "/manus-storage/apto-02_ac324e1e.jpg",
    dataCadastro: new Date("2026-08-19T12:00:00Z"),
  },
  {
    id: 3,
    ownerId: null,
    codigo: "IMB-2110",
    tipo: "Apartamento",
    bairro: "Moema",
    cidade: "São Paulo",
    quartos: 2,
    banheiros: 2,
    vagas: 1,
    areaM2: "74.00",
    aceitaPets: true,
    varanda: true,
    ensolarado: true,
    valorVenda: "890000.00",
    valorAluguel: "5600.00",
    descricaoTecnica: "Próximo ao parque, com varanda e iluminação cruzada.",
    descricaoIa: "A praticidade de Moema em uma planta acolhedora, com luz natural em todos os ambientes.",
    tituloAnuncio: "Apartamento iluminado a poucos minutos do parque",
    status: "Disponivel",
    imagemUrl: "/manus-storage/apto-03_c1989a3b.jpg",
    dataCadastro: new Date("2026-08-11T12:00:00Z"),
  },
  {
    id: 4,
    ownerId: null,
    codigo: "IMB-2016",
    tipo: "Casa",
    bairro: "Alto de Pinheiros",
    cidade: "São Paulo",
    quartos: 4,
    banheiros: 4,
    vagas: 3,
    areaM2: "238.00",
    aceitaPets: true,
    varanda: true,
    ensolarado: true,
    valorVenda: "3250000.00",
    valorAluguel: "18200.00",
    descricaoTecnica: "Casa térrea com jardim, home office e área gourmet.",
    descricaoIa: "Espaçoo, verde e privacidade para uma rotina com mais tempo de qualidade.",
    tituloAnuncio: "Casa com jardim e arquitetura acolhedora no Alto de Pinheiros",
    status: "Disponivel",
    imagemUrl: "/manus-storage/apto-01_f5822bf0.jpg",
    dataCadastro: new Date("2026-08-02T12:00:00Z"),
  },
  {
    id: 5,
    ownerId: null,
    codigo: "IMB-2093",
    tipo: "Apartamento",
    bairro: "Itaim Bibi",
    cidade: "São Paulo",
    quartos: 3,
    banheiros: 3,
    vagas: 2,
    areaM2: "112.00",
    aceitaPets: false,
    varanda: true,
    ensolarado: false,
    valorVenda: "1670000.00",
    valorAluguel: "9900.00",
    descricaoTecnica: "Condomínio completo, sala ampla e varanda gourmet.",
    descricaoIa: "Entre restaurantes e escritórios, um endereço que simplifica seus dias.",
    tituloAnuncio: "Varanda gourmet e localização premium no Itaim",
    status: "Disponivel",
    imagemUrl: "/manus-storage/apto-02_ac324e1e.jpg",
    dataCadastro: new Date("2026-07-28T12:00:00Z"),
  },
  {
    id: 6,
    ownerId: null,
    codigo: "IMB-1884",
    tipo: "Sobrado",
    bairro: "Saúde",
    cidade: "São Paulo",
    quartos: 3,
    banheiros: 2,
    vagas: 2,
    areaM2: "154.00",
    aceitaPets: true,
    varanda: false,
    ensolarado: true,
    valorVenda: "1120000.00",
    valorAluguel: "6300.00",
    descricaoTecnica: "Sobrado reformado, quintal e duas vagas cobertas.",
    descricaoIa: "Uma casa pronta para receber, com quintal para pets e uma vizinhança tranquila.",
    tituloAnuncio: "Sobrado reformado com quintal na Saúde",
    status: "Disponivel",
    imagemUrl: "/manus-storage/apto-03_c1989a3b.jpg",
    dataCadastro: new Date("2026-07-18T12:00:00Z"),
  },
  {
    id: 7,
    ownerId: null,
    codigo: "IMB-2041",
    tipo: "Apartamento",
    bairro: "Perdizes",
    cidade: "São Paulo",
    quartos: 3,
    banheiros: 2,
    vagas: 2,
    areaM2: "105.00",
    aceitaPets: true,
    varanda: true,
    ensolarado: true,
    valorVenda: "1260000.00",
    valorAluguel: "7600.00",
    descricaoTecnica: "Andar alto, varanda e condomínio com lazer completo.",
    descricaoIa: "Conforto e praticidade em um bairro que equilibra tranquilidade e mobilidade.",
    tituloAnuncio: "Andar alto com varanda e lazer completo em Perdizes",
    status: "Disponivel",
    imagemUrl: "/manus-storage/apto-01_f5822bf0.jpg",
    dataCadastro: new Date("2026-07-12T12:00:00Z"),
  },
  {
    id: 8,
    ownerId: null,
    codigo: "IMB-1999",
    tipo: "Cobertura",
    bairro: "Jardins",
    cidade: "São Paulo",
    quartos: 3,
    banheiros: 3,
    vagas: 2,
    areaM2: "145.00",
    aceitaPets: false,
    varanda: true,
    ensolarado: true,
    valorVenda: "2790000.00",
    valorAluguel: "15800.00",
    descricaoTecnica: "Cobertura com rooftop privativo e acabamentos sofisticados.",
    descricaoIa: "Uma cobertura autoral para quem busca design, privacidade e a melhor versão dos Jardins.",
    tituloAnuncio: "Rooftop privativo e design autoral nos Jardins",
    status: "Disponivel",
    imagemUrl: "/manus-storage/apto-02_ac324e1e.jpg",
    dataCadastro: new Date("2026-07-04T12:00:00Z"),
  },
];

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      const databaseUrl = new URL(process.env.DATABASE_URL);

      _pool = postgres(databaseUrl.toString(), {
        max: Math.max(
          2,
          Math.min(Number(process.env.DB_POOL_SIZE) || 10, 30)
        ),
        connect_timeout: 10,
        idle_timeout: 20,
        max_lifetime: 60 * 30,
        keep_alive: 10,
      });

      _db = drizzle(_pool);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _pool = null;
      _db = null;
    }
  }

  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");

  const db = await getDb();
  if (!db) return;

  const values: InsertUser = { openId: user.openId };
  const updateSet: Record<string, unknown> = {};

  const textFields = ["name", "email", "loginMethod"] as const;

  textFields.forEach(field => {
    if (user[field] !== undefined) {
      values[field] = user[field] ?? null;
      updateSet[field] = user[field] ?? null;
    }
  });

  if (user.lastSignedIn !== undefined) {
    values.lastSignedIn = user.lastSignedIn;
    updateSet.lastSignedIn = user.lastSignedIn;
  } else {
    values.lastSignedIn = new Date();
    updateSet.lastSignedIn = new Date();
  }

  if (user.role !== undefined) {
    values.role = user.role;
    updateSet.role = user.role;
  } else if (user.openId === ENV.ownerOpenId) {
    values.role = "admin";
    updateSet.role = "admin";
  }

  await db.insert(users).values(values).onConflictDoUpdate({ target: users.openId, set: updateSet });
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();

  if (!db) return undefined;

  const result = await db
    .select()
    .from(users)
    .where(eq(users.openId, openId))
    .limit(1);

  return result[0];
}

export async function listProperties(
  filters: PropertyFilters = {}
): Promise<Property[]> {
  const db = await getDb();

  if (!db) {
    if (isDemoMode) return filterDemoProperties(filters);
    throw new Error("Banco de dados indisponível");
  }

  try {
    const conditions = [eq(imoveis.status, "Disponivel")];

    // Finalidade não é uma coluna: um imóvel "está para" venda se tem valor de venda,
    // e para aluguel se tem valor de aluguel. Sem isso, "quero alugar" retornaria
    // também imóveis que só têm preço de venda.
    if (filters.finalidade === "compra") {
      conditions.push(gt(imoveis.valorVenda, "0"));
    }

    if (filters.finalidade === "aluguel") {
      conditions.push(gt(imoveis.valorAluguel, "0"));
    }

    if (filters.tipo) {
      conditions.push(eq(imoveis.tipo, filters.tipo as any));
    }

    if (filters.cidade) {
      conditions.push(eq(imoveis.cidade, filters.cidade));
    }

    if (filters.bairro) {
      conditions.push(eq(imoveis.bairro, filters.bairro));
    }

    if (filters.quartos) {
      conditions.push(gte(imoveis.quartos, filters.quartos));
    }

    if (filters.vagas) {
      conditions.push(gte(imoveis.vagas, filters.vagas));
    }

    if (filters.valorMax) {
      const priceColumn =
        filters.finalidade === "aluguel"
          ? imoveis.valorAluguel
          : imoveis.valorVenda;

      conditions.push(lte(priceColumn, filters.valorMax.toFixed(2)));
    }

    if (filters.valorMin) {
      const priceColumn =
        filters.finalidade === "aluguel"
          ? imoveis.valorAluguel
          : imoveis.valorVenda;

      conditions.push(gte(priceColumn, filters.valorMin.toFixed(2)));
    }

    if (filters.aceitaPets) {
      conditions.push(eq(imoveis.aceitaPets, true));
    }

    if (filters.varanda) {
      conditions.push(eq(imoveis.varanda, true));
    }

    if (filters.ensolarado) {
      conditions.push(eq(imoveis.ensolarado, true));
    }

    const limit = Math.max(1, Math.min(filters.limit ?? 100, 500));
    const offset = Math.max(0, filters.offset ?? 0);

    return await db
      .select()
      .from(imoveis)
      .where(and(...conditions))
      .limit(limit)
      .offset(offset);
  } catch (error) {
    console.warn("[Database] Property query failed:", error);

    if (isDemoMode) return filterDemoProperties(filters);

    throw error;
  }
}

function filterDemoProperties(filters: PropertyFilters) {
  return demoProperties.filter(property => {
    if (filters.finalidade === "compra" && !(Number(property.valorVenda) > 0)) return false;
    if (filters.finalidade === "aluguel" && !(Number(property.valorAluguel) > 0)) return false;
    if (filters.tipo && property.tipo !== filters.tipo) return false;
    if (filters.cidade && property.cidade !== filters.cidade) return false;
    if (filters.bairro && property.bairro !== filters.bairro) return false;
    if (filters.quartos && property.quartos < filters.quartos) return false;
    if (filters.vagas && property.vagas < filters.vagas) return false;

    if (filters.valorMax) {
      const price = Number(
        (filters.finalidade === "aluguel"
          ? property.valorAluguel
          : property.valorVenda) ?? 0
      );

      if (price > filters.valorMax) return false;
    }

    if (filters.valorMin) {
      const price = Number(
        (filters.finalidade === "aluguel"
          ? property.valorAluguel
          : property.valorVenda) ?? 0
      );

      if (price < filters.valorMin) return false;
    }

    if (filters.aceitaPets && !property.aceitaPets) return false;
    if (filters.varanda && !property.varanda) return false;
    if (filters.ensolarado && !property.ensolarado) return false;

    return true;
  });
}

export async function getDashboardData() {
  const properties = await listProperties();
  const db = await getDb();

  let searchCount = 1284;

  if (db) {
    try {
      const [result] = await db
        .select({ total: count() })
        .from(historicoBuscas);

      const totalSearches = Number(result?.total ?? 0);

      searchCount = isDemoMode
        ? Math.max(totalSearches, 1284)
        : totalSearches;
    } catch {
      if (!isDemoMode) {
        throw new Error(
          "Não foi possível carregar as métricas do dashboard"
        );
      }
    }
  } else if (!isDemoMode) {
    throw new Error("Banco de dados indisponível");
  }

  const active = properties.filter(
    property => property.status === "Disponivel"
  );

  const avgPrice = active.length
    ? active.reduce(
        (sum, property) => sum + Number(property.valorVenda ?? 0),
        0
      ) / active.length
    : 0;

  const neighborhoodMap = new Map<
    string,
    { total: number; priceM2: number }
  >();

  active.forEach(property => {
    const current = neighborhoodMap.get(property.bairro) ?? {
      total: 0,
      priceM2: 0,
    };

    current.total += 1;
    current.priceM2 +=
      Number(property.valorVenda ?? 0) / Number(property.areaM2);

    neighborhoodMap.set(property.bairro, current);
  });

  const neighborhoods = Array.from(neighborhoodMap.entries())
    .map(([bairro, value]) => ({
      bairro,
      total: value.total,
      priceM2: Math.round(value.priceM2 / value.total),
    }))
    .sort((a, b) => b.priceM2 - a.priceM2);

  return {
    totalActive: active.length,
    searchCount,
    avgPrice,
    conversionRate: 18.6,
    neighborhoods,
    featured: active.slice(0, 3),
  };
}

export async function saveSearch(history: InsertSearchHistory) {
  const db = await getDb();

  if (!db) return;

  try {
    await db.insert(historicoBuscas).values(history);
  } catch (error) {
    console.warn("[Database] Could not save search history:", error);
  }
}

export async function findSimilarProperties(property: {
  bairro: string;
  tipo?: string;
  areaM2?: number;
}) {
  const properties = await listProperties({
    bairro: property.bairro,
    tipo: property.tipo,
  });

  const sameNeighborhood = properties.filter(
    item =>
      Math.abs(
        Number(item.areaM2) - Number(property.areaM2 ?? 0)
      ) < 80
  );

  return sameNeighborhood.length ? sameNeighborhood : properties;
}

export { demoProperties };

export const LOCAL_SESSION_COOKIE = "imob_local_session";

const LOCAL_SESSION_MAX_AGE_MS =
  1000 * 60 * 60 * 24 * 30;

function hashPassword(
  password: string,
  salt = randomBytes(16).toString("hex")
) {
  const derived = scryptSync(password, salt, 64).toString("hex");
  return `scrypt$${salt}$${derived}`;
}

function verifyPassword(password: string, stored: string) {
  const [, salt, expected] = stored.split("$");

  if (!salt || !expected) return false;

  const actual = Buffer.from(
    hashPassword(password, salt).split("$")[2],
    "hex"
  );

  const expectedBuffer = Buffer.from(expected, "hex");

  return (
    actual.length === expectedBuffer.length &&
    timingSafeEqual(actual, expectedBuffer)
  );
}

function hashSessionToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function getUserByEmail(email: string) {
  const db = await getDb();

  if (!db) throw new Error("Banco de dados indisponível");

  const result = await db
    .select()
    .from(users)
    .where(eq(users.email, email.toLowerCase()))
    .limit(1);

  return result[0];
}

export async function createLocalUser(input: {
  name: string;
  email: string;
  password: string;
}) {
  const db = await getDb();

  if (!db) throw new Error("Banco de dados indisponível");

  const email = input.email.trim().toLowerCase();

  const existing = await getUserByEmail(email);

  if (existing) {
    throw new Error("Este email já está cadastrado");
  }

  const openId = `local_${nanoid(24)}`;

  const [createdUser] = await db.insert(users).values({
    openId,
    name: input.name.trim(),
    email,
    passwordHash: hashPassword(input.password),
    loginMethod: "email",
  }).returning({ id: users.id });

  const userId = createdUser?.id;

  if (!userId) {
    throw new Error("Não foi possível criar a conta");
  }

  const user = await db
    .select()
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!user[0]) {
    throw new Error("Não foi possível criar a conta");
  }

  return user[0];
}

export async function updateUserProfile(
  userId: number,
  input: { name?: string; email?: string }
) {
  const db = await getDb();

  if (!db) throw new Error("Banco de dados indisponível");

  if (input.email) {
    const existing = await getUserByEmail(input.email);
    if (existing && existing.id !== userId) {
      throw new Error("Este email já está em uso por outra conta");
    }
  }

  const [updated] = await db
    .update(users)
    .set({
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.email !== undefined ? { email: input.email } : {}),
      updatedAt: new Date(),
    })
    .where(eq(users.id, userId))
    .returning();

  if (!updated) throw new Error("Usuário não encontrado");

  return updated;
}

export async function verifyLocalCredentials(
  email: string,
  password: string
) {
  const user = await getUserByEmail(
    email.trim().toLowerCase()
  );

  if (
    !user?.passwordHash ||
    !verifyPassword(password, user.passwordHash)
  ) {
    return null;
  }

  return user;
}

export async function createLocalSession(userId: number) {
  const db = await getDb();

  if (!db) throw new Error("Banco de dados indisponível");

  const token = randomBytes(32).toString("hex");

  await db.insert(localSessions).values({
    tokenHash: hashSessionToken(token),
    userId,
    expiresAt: new Date(
      Date.now() + LOCAL_SESSION_MAX_AGE_MS
    ),
  });

  return token;
}

export async function getUserByLocalSessionCookie(
  cookieHeader?: string
) {
  const token = cookieHeader
    ? parseCookieHeader(cookieHeader)[LOCAL_SESSION_COOKIE]
    : undefined;

  if (!token) return undefined;

  const db = await getDb();

  if (!db) return undefined;

  const result = await db
    .select({ user: users })
    .from(localSessions)
    .innerJoin(
      users,
      eq(localSessions.userId, users.id)
    )
    .where(
      and(
        eq(
          localSessions.tokenHash,
          hashSessionToken(token)
        ),
        gt(
          localSessions.expiresAt,
          new Date()
        )
      )
    )
    .limit(1);

  return result[0]?.user;
}

export async function deleteLocalSession(
  cookieHeader?: string
) {
  const token = cookieHeader
    ? parseCookieHeader(cookieHeader)[LOCAL_SESSION_COOKIE]
    : undefined;

  const db = await getDb();

  if (!db || !token) return;

  await db
    .delete(localSessions)
    .where(
      eq(
        localSessions.tokenHash,
        hashSessionToken(token)
      )
    );
}

export async function createPropertyForUser(
  userId: number,
  input: Omit<
    InsertProperty,
    "id" | "ownerId" | "codigo" | "dataCadastro"
  >
) {
  const db = await getDb();

  if (!db) throw new Error("Banco de dados indisponível");

  const codigo = `IMB-${nanoid(7).toUpperCase()}`;

  const [createdProperty] = await db
    .insert(imoveis)
    .values({
      ...input,
      ownerId: userId,
      codigo,
    })
    .returning({ id: imoveis.id });

  const created = await db
    .select()
    .from(imoveis)
    .where(eq(imoveis.id, createdProperty.id))
    .limit(1);

  return created[0];
}

export async function updatePropertyForUser(
  userId: number,
  propertyId: number,
  input: Partial<InsertProperty>
) {
  const db = await getDb();

  if (!db) throw new Error("Banco de dados indisponível");

  // A cláusula ownerId garante que só o dono edita o imóvel.
  const [updated] = await db
    .update(imoveis)
    .set(input)
    .where(and(eq(imoveis.id, propertyId), eq(imoveis.ownerId, userId)))
    .returning({ id: imoveis.id });

  if (!updated?.id) {
    throw new Error("Imóvel não encontrado ou sem permissão para editar");
  }

  const created = await db
    .select()
    .from(imoveis)
    .where(eq(imoveis.id, propertyId))
    .limit(1);

  return created[0];
}

export async function deletePropertyForUser(userId: number, propertyId: number) {
  const db = await getDb();

  if (!db) throw new Error("Banco de dados indisponível");

  // Fotos são removidas primeiro (para coletar os fileKeys antes do cascade).
  const photos = await db
    .select({ fileKey: imovelFotos.fileKey })
    .from(imovelFotos)
    .where(eq(imovelFotos.imovelId, propertyId));

  const [deleted] = await db
    .delete(imoveis)
    .where(and(eq(imoveis.id, propertyId), eq(imoveis.ownerId, userId)))
    .returning({ id: imoveis.id });

  if (!deleted?.id) {
    throw new Error("Imóvel não encontrado ou sem permissão para excluir");
  }

  // Com o imóvel excluído (fotos têm FK cascade), remove os arquivos do storage.
  for (const photo of photos) {
    try {
      await storageRemove(photo.fileKey);
    } catch (error) {
      console.warn("[ImobAI] Falha ao remover foto do storage:", error instanceof Error ? error.message : error);
    }
  }

  return { id: deleted.id };
}

export async function listPropertiesForUser(
  userId: number,
  limit = 100,
  offset = 0
) {
  const db = await getDb();

  if (!db) return [];

  const properties = await db
    .select()
    .from(imoveis)
    .where(eq(imoveis.ownerId, userId))
    .limit(Math.min(Math.max(limit, 1), 500))
    .offset(Math.max(offset, 0));

  if (!properties.length) return [];

  const photos = await db
    .select()
    .from(imovelFotos)
    .where(
      inArray(
        imovelFotos.imovelId,
        properties.map(property => property.id)
      )
    )
    .orderBy(
      asc(imovelFotos.ordem),
      asc(imovelFotos.id)
    );

  const photosByProperty = new Map<
    number,
    typeof photos
  >();

  for (const photo of photos) {
    const current =
      photosByProperty.get(photo.imovelId) ?? [];

    current.push(photo);
    photosByProperty.set(
      photo.imovelId,
      current
    );
  }

  return properties.map(property => ({
    ...property,
    fotos:
      photosByProperty.get(property.id) ?? [],
  }));
}

export async function addPropertyPhotos(
  userId: number,
  imovelId: number,
  photos: Array<{
    fileKey: string;
    url: string;
    ordem: number;
  }>
) {
  const db = await getDb();

  if (!db) {
    throw new Error("Banco de dados indisponível");
  }

  const property = await db
    .select()
    .from(imoveis)
    .where(
      and(
        eq(imoveis.id, imovelId),
        eq(imoveis.ownerId, userId)
      )
    )
    .limit(1);

  if (!property[0]) {
    throw new Error(
      "Imóvel não encontrado ou sem permissão"
    );
  }

  const existing = await db
    .select()
    .from(imovelFotos)
    .where(
      eq(imovelFotos.imovelId, imovelId)
    );

  if (existing.length + photos.length > 20) {
    throw new Error(
      "Cada anúncio pode ter no máximo 20 fotos"
    );
  }

  if (photos.length) {
    await db.insert(imovelFotos).values(
      photos.map(photo => ({
        ...photo,
        imovelId,
        ownerId: userId,
      }))
    );
  }

  if (!property[0].imagemUrl && photos[0]) {
    await db
      .update(imoveis)
      .set({
        imagemUrl: photos[0].url,
      })
      .where(eq(imoveis.id, imovelId));
  }

  return db
    .select()
    .from(imovelFotos)
    .where(
      eq(imovelFotos.imovelId, imovelId)
    );
}

export async function listPropertyPhotos(
  imovelId: number
) {
  const db = await getDb();

  if (!db) return [];

  return db
    .select()
    .from(imovelFotos)
    .where(
      eq(imovelFotos.imovelId, imovelId)
    );
}

export async function getConversation(
  userId: number,
  conversationId: number
) {
  const db = await getDb();

  if (!db) {
    throw new Error(
      "Banco de dados indisponível"
    );
  }

  const result = await db
    .select()
    .from(conversas)
    .where(
      and(
        eq(conversas.id, conversationId),
        or(
          eq(conversas.compradorId, userId),
          eq(
            conversas.proprietarioId,
            userId
          )
        )
      )
    )
    .limit(1);

  return result[0];
}

export async function listConversations(
  userId: number
) {
  const db = await getDb();

  if (!db) return [];

  return db
    .select()
    .from(conversas)
    .where(
      or(
        eq(conversas.compradorId, userId),
        eq(
          conversas.proprietarioId,
          userId
        )
      )
    )
    .orderBy(
      asc(conversas.updatedAt),
      asc(conversas.id)
    )
    .limit(100);
}

export async function createConversation(
  input: {
    imovelId?: number;
    compradorId: number;
    proprietarioId: number;
  }
) {
  const db = await getDb();

  if (!db) {
    throw new Error(
      "Banco de dados indisponível"
    );
  }

  const existing = await db
    .select()
    .from(conversas)
    .where(
      and(
        input.imovelId
          ? eq(
              conversas.imovelId,
              input.imovelId
            )
          : undefined,
        eq(
          conversas.compradorId,
          input.compradorId
        ),
        eq(
          conversas.proprietarioId,
          input.proprietarioId
        )
      )
    )
    .limit(1);

  if (existing[0]) return existing[0];

  try {
    const [createdConversation] = await db
      .insert(conversas)
      .values(input)
      .returning({ id: conversas.id });

    if (!createdConversation?.id) {
      throw new Error("Não foi possível criar a conversa");
    }

    const created = await db
      .select()
      .from(conversas)
      .where(eq(conversas.id, createdConversation.id))
      .limit(1);

    return created[0];
  } catch (error) {
    const duplicate = await db
      .select()
      .from(conversas)
      .where(
        and(
          input.imovelId
            ? eq(
                conversas.imovelId,
                input.imovelId
              )
            : undefined,
          eq(
            conversas.compradorId,
            input.compradorId
          ),
          eq(
            conversas.proprietarioId,
            input.proprietarioId
          )
        )
      )
      .limit(1);

    if (duplicate[0]) return duplicate[0];

    throw error;
  }
}

export async function listMessages(
  userId: number,
  conversationId: number
) {
  const conversation = await getConversation(
    userId,
    conversationId
  );

  if (!conversation) {
    throw new Error(
      "Conversa não encontrada"
    );
  }

  const db = await getDb();

  if (!db) return [];

  return db
    .select({
      id: mensagens.id,
      conversaId: mensagens.conversaId,
      remetenteId: mensagens.remetenteId,
      conteudo: mensagens.conteudo,
      createdAt: mensagens.createdAt,
      remetenteNome: users.name,
    })
    .from(mensagens)
    .leftJoin(
      users,
      eq(
        mensagens.remetenteId,
        users.id
      )
    )
    .where(
      eq(
        mensagens.conversaId,
        conversationId
      )
    )
    .orderBy(
      asc(mensagens.createdAt),
      asc(mensagens.id)
    )
    .limit(200);
}

export async function createMessage(
  userId: number,
  conversationId: number,
  conteudo: string
) {
  const conversation = await getConversation(
    userId,
    conversationId
  );

  if (!conversation) {
    throw new Error(
      "Conversa não encontrada"
    );
  }

  const db = await getDb();

  if (!db) {
    throw new Error(
      "Banco de dados indisponível"
    );
  }

  const [createdMessage] = await db
    .insert(mensagens)
    .values({
      conversaId: conversationId,
      remetenteId: userId,
      conteudo: conteudo.trim(),
    })
    .returning({ id: mensagens.id });

  const created = await db
    .select()
    .from(mensagens)
    .where(eq(mensagens.id, createdMessage.id))
    .limit(1);

  return created[0];
}

export async function getOrCreateAiChat(
  userId: number
) {
  const db = await getDb();

  if (!db) {
    throw new Error(
      "Banco de dados indisponível"
    );
  }

  const existing = await db
    .select()
    .from(chatsIa)
    .where(eq(chatsIa.userId, userId))
    .limit(1);

  if (existing[0]) return existing[0];

  try {
    const [createdChat] = await db
      .insert(chatsIa)
      .values({ userId })
      .returning({ id: chatsIa.id });

    const created = await db
      .select()
      .from(chatsIa)
      .where(eq(chatsIa.id, createdChat.id))
      .limit(1);

    return created[0];
  } catch (error) {
    const duplicate = await db
      .select()
      .from(chatsIa)
      .where(
        eq(chatsIa.userId, userId)
      )
      .limit(1);

    if (duplicate[0]) return duplicate[0];

    throw error;
  }
}

export async function listAiMessages(
  userId: number
) {
  const chat = await getOrCreateAiChat(
    userId
  );

  const db = await getDb();

  if (!db) return [];

  return db
    .select()
    .from(mensagensIa)
    .where(
      and(
        eq(
          mensagensIa.chatId,
          chat.id
        ),
        eq(
          mensagensIa.userId,
          userId
        )
      )
    )
    .orderBy(
      asc(mensagensIa.createdAt),
      asc(mensagensIa.id)
    )
    .limit(100);
}

export async function cleanupExpiredSessions(
  batchSize = 1000
) {
  const db = await getDb();

  if (!db) return 0;

  const expired = await db
    .select({
      id: localSessions.id,
    })
    .from(localSessions)
    .where(
      lte(
        localSessions.expiresAt,
        new Date()
      )
    )
    .limit(
      Math.min(
        Math.max(batchSize, 1),
        5000
      )
    );

  if (!expired.length) return 0;

  await db
    .delete(localSessions)
    .where(
      inArray(
        localSessions.id,
        expired.map(
          session => session.id
        )
      )
    );

  return expired.length;
}

export async function createAiMessage(
  userId: number,
  role: "user" | "assistant",
  conteudo: string
) {
  const chat = await getOrCreateAiChat(
    userId
  );

  const db = await getDb();

  if (!db) {
    throw new Error(
      "Banco de dados indisponível"
    );
  }

  const [createdMessage] = await db
    .insert(mensagensIa)
    .values({
      chatId: chat.id,
      userId,
      role,
      conteudo,
    })
    .returning({ id: mensagensIa.id });

  const created = await db
    .select()
    .from(mensagensIa)
    .where(eq(mensagensIa.id, createdMessage.id))
    .limit(1);

  return created[0];
}
















