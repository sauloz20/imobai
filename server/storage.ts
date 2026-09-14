// Storage de fotos do ImobAI — Supabase Storage (bucket público "imoveis-fotos").
//
// O sistema de armazenamento do projeto é o Supabase Storage, o mesmo backend
// do banco de dados. NÃO há dependência do Built-in Forge (BUILT_IN_FORGE_API_URL /
// BUILT_IN_FORGE_API_KEY) — essas variáveis foram removidas do projeto.
//
// Configuração necessária (uma única vez, no dashboard do Supabase):
//   Storage → New bucket → nome: "imoveis-fotos" → Public bucket: LIGADO
//
// A chave usada no servidor é a publishable (anon) key. Com o bucket público,
// uploads e leituras funcionam sem service_role. URLs são públicas e estáveis.

import { createClient } from "@supabase/supabase-js";

const BUCKET = "imoveis-fotos";

function resolveSupabaseUrl(): string {
  const raw = (process.env.VITE_SUPABASE_URL || "") || "";
  const trimmed = raw.trim().replace(/^["']|["']$/g, "");
  if (!trimmed) {
    throw new Error("VITE_SUPABASE_URL não configurada no .env");
  }
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}.supabase.co`;
}

function getSupabase() {
  const key = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if (!key) {
    throw new Error("VITE_SUPABASE_PUBLISHABLE_KEY não configurada no .env");
  }
  return createClient(resolveSupabaseUrl(), key, {
    auth: { persistSession: false },
  });
}

function normalizeKey(relKey: string): string {
  return relKey.replace(/^\/+/, "");
}

function appendHashSuffix(relKey: string): string {
  const hash = crypto.randomUUID().replace(/-/g, "").slice(0, 8);
  const lastDot = relKey.lastIndexOf(".");
  if (lastDot === -1) return `${relKey}_${hash}`;
  return `${relKey.slice(0, lastDot)}_${hash}${relKey.slice(lastDot)}`;
}

export async function storagePut(
  relKey: string,
  data: Buffer | Uint8Array | string,
  contentType = "application/octet-stream",
): Promise<{ key: string; url: string }> {
  const supabase = getSupabase();
  const key = appendHashSuffix(normalizeKey(relKey));

  const { error } = await supabase.storage.from(BUCKET).upload(key, data, {
    contentType,
    upsert: false,
  });

  if (error) {
    // Mensagem orientada à ação quando o bucket ainda não foi criado no dashboard.
    if (/not found|does not exist/i.test(error.message)) {
      throw new Error(
        `Bucket "${BUCKET}" não existe no Supabase Storage. Crie no dashboard: Storage → New bucket → nome "${BUCKET}" → Public: ligado.`,
      );
    }
    throw new Error(`Falha no upload para o Supabase Storage: ${error.message}`);
  }

  const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(key);
  return { key, url: pub?.publicUrl ?? "" };
}

export async function storageGet(relKey: string): Promise<{ key: string; url: string }> {
  const supabase = getSupabase();
  const key = normalizeKey(relKey);
  const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(key);
  return { key, url: pub?.publicUrl ?? "" };
}

export async function storageRemove(relKey: string): Promise<void> {
  const supabase = getSupabase();
  const { error } = await supabase.storage.from(BUCKET).remove([normalizeKey(relKey)]);
  if (error) {
    console.warn("[ImobAI] Não foi possível remover o arquivo do storage:", error.message);
  }
}
