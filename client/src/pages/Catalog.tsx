import { CloudShader } from "@/components/ui/cloud-shader";
import { GlobalHeader } from "@/components/GlobalHeader";
import { PropertyDetailsModal, type DetailProperty } from "@/components/PropertyDetailsModal";
import { PropertyCard } from "@/components/PropertyCard";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { trpc } from "@/lib/trpc";
import { formatPropertyPlace, normalizePropertyText } from "@/lib/property";
import { cn } from "@/lib/utils";
import { Bath, BedDouble, Car, FilterX, MapPin, PawPrint, SearchX, SlidersHorizontal, Sun, Wallet } from "lucide-react";
import { useMemo, useState } from "react";
import { useLocation, useSearch } from "wouter";

type Property = {
  id: number;
  ownerId: number | null;
  codigo: string;
  tipo: string;
  bairro: string;
  cidade: string;
  quartos: number;
  banheiros: number;
  vagas: number;
  areaM2: string;
  aceitaPets: boolean;
  varanda: boolean;
  ensolarado: boolean;
  valorVenda: string | null;
  valorAluguel: string | null;
  descricaoTecnica: string | null;
  descricaoIa: string | null;
  tituloAnuncio: string | null;
  imagemUrl: string | null;
};

type CatalogState = {
  finalidade: "compra" | "aluguel" | null;
  tipo: string | null;
  bairro: string | null;
  cidade: string | null;
  quartos: number | null;
  vagas: number | null;
  valorMin: number | null;
  valorMax: number | null;
  pets: boolean;
  varanda: boolean;
  ensolarado: boolean;
  ordem: "afinidade" | "preco-asc" | "preco-desc" | "area-desc" | "recentes";
};

const TIPOS = ["Casa", "Apartamento", "Sobrado", "Cobertura", "Terreno"];
const ORDER_LABELS: Record<CatalogState["ordem"], string> = {
  afinidade: "Afinidade",
  "preco-asc": "Menor preço",
  "preco-desc": "Maior preço",
  "area-desc": "Maior área",
  recentes: "Mais recentes",
};

function parseState(query: string): CatalogState {
  const params = new URLSearchParams(query);
  const numberOrNull = (key: string) => {
    const value = Number(params.get(key));
    return Number.isFinite(value) && value > 0 ? value : null;
  };
  return {
    finalidade: params.get("f") === "compra" || params.get("f") === "aluguel" ? (params.get("f") as "compra" | "aluguel") : null,
    tipo: params.get("t") || null,
    bairro: params.get("b") || null,
    cidade: params.get("c") || null,
    quartos: numberOrNull("q"),
    vagas: numberOrNull("v"),
    valorMin: numberOrNull("min"),
    valorMax: numberOrNull("max"),
    pets: params.get("pets") === "1",
    varanda: params.get("var") === "1",
    ensolarado: params.get("sol") === "1",
    ordem: (Object.keys(ORDER_LABELS) as CatalogState["ordem"][]).includes(params.get("ord") as CatalogState["ordem"])
      ? (params.get("ord") as CatalogState["ordem"])
      : "afinidade",
  };
}

function serializeState(state: CatalogState): string {
  const params = new URLSearchParams();
  if (state.finalidade) params.set("f", state.finalidade);
  if (state.tipo) params.set("t", state.tipo);
  if (state.bairro) params.set("b", state.bairro);
  if (state.cidade) params.set("c", state.cidade);
  if (state.quartos) params.set("q", String(state.quartos));
  if (state.vagas) params.set("v", String(state.vagas));
  if (state.valorMin) params.set("min", String(state.valorMin));
  if (state.valorMax) params.set("max", String(state.valorMax));
  if (state.pets) params.set("pets", "1");
  if (state.varanda) params.set("var", "1");
  if (state.ensolarado) params.set("sol", "1");
  if (state.ordem !== "afinidade") params.set("ord", state.ordem);
  const query = params.toString();
  return query ? `?${query}` : "";
}

export default function Catalog() {
  const query = useSearch();
  const [detailsProperty, setDetailsProperty] = useState<DetailProperty | null>(null);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const state = useMemo(() => parseState(query), [query]);
  const propertiesQuery = trpc.property.list.useQuery({
    limit: 500,
    finalidade: state.finalidade ?? undefined,
    tipo: state.tipo ?? undefined,
    quartos: state.quartos ?? undefined,
    vagas: state.vagas ?? undefined,
    valorMin: state.valorMin ?? undefined,
    valorMax: state.valorMax ?? undefined,
  });
  const properties = ((propertiesQuery.data ?? []) as Property[]).map(item => ({
    ...item,
    bairro: formatPropertyPlace(item.bairro),
    cidade: formatPropertyPlace(item.cidade),
    tituloAnuncio: normalizePropertyText(item.tituloAnuncio),
  }));
  const isLoading = propertiesQuery.isLoading;
  const onOpenDetails = (property: Property) => setDetailsProperty(property as DetailProperty);
  const [, navigate] = useLocation();
  const [minInput, setMinInput] = useState(state.valorMin ? String(state.valorMin) : "");
  const [maxInput, setMaxInput] = useState(state.valorMax ? String(state.valorMax) : "");

  const update = (patch: Partial<CatalogState>) => {
    navigate(`/catalogo${serializeState({ ...state, ...patch })}`, { replace: false });
  };

  const applyPrice = () => {
    const min = Number(minInput.replace(/[^\d]/g, ""));
    const max = Number(maxInput.replace(/[^\d]/g, ""));
    update({
      valorMin: Number.isFinite(min) && min > 0 ? min : null,
      valorMax: Number.isFinite(max) && max > 0 ? max : null,
    });
  };

  const filtered = useMemo(() => {
    let list = [...properties];
    // Busca local por bairro OU cidade, sem diferenciar maiúsculas (o servidor compara igual).
    if (state.bairro) {
      const term = state.bairro.trim().toLowerCase();
      list = list.filter(
        item =>
          item.bairro?.toLowerCase().includes(term) || item.cidade?.toLowerCase().includes(term)
      );
    }
    if (state.pets) list = list.filter(item => item.aceitaPets);
    if (state.varanda) list = list.filter(item => item.varanda);
    if (state.ensolarado) list = list.filter(item => item.ensolarado);
    const priceOf = (item: Property) =>
      state.finalidade === "aluguel" ? Number(item.valorAluguel ?? 0) : Number(item.valorVenda ?? item.valorAluguel ?? 0);
    if (state.ordem === "preco-asc") list.sort((a, b) => priceOf(a) - priceOf(b));
    if (state.ordem === "preco-desc") list.sort((a, b) => priceOf(b) - priceOf(a));
    if (state.ordem === "area-desc") list.sort((a, b) => Number(b.areaM2) - Number(a.areaM2));
    if (state.ordem === "recentes") list.sort((a, b) => b.id - a.id);
    return list;
  }, [properties, state.bairro, state.pets, state.varanda, state.ensolarado, state.ordem, state.finalidade]);

  const activeFilterCount = [
    state.finalidade,
    state.tipo,
    state.bairro,
    state.cidade,
    state.quartos,
    state.vagas,
    state.valorMin,
    state.valorMax,
    state.pets && "pets",
    state.varanda && "varanda",
    state.ensolarado && "sol",
  ].filter(Boolean).length;

  return (
    <div className="relative min-h-screen overflow-hidden pb-16 pt-24">
      <GlobalHeader onLogin={() => navigate("/?auth=login")} />
      <div className="pointer-events-none fixed inset-0 -z-10 opacity-[0.42]" aria-hidden="true">
        <CloudShader className="h-full w-full" count={4} speed={0.72} skyTopColor="#d9eaf7" skyBottomColor="#f7fafc" cloudColor="#ffffff" />
      </div>
      <div className="pointer-events-none fixed inset-0 -z-10 bg-[linear-gradient(180deg,rgba(247,250,252,0.18),rgba(247,250,252,0.82)_72%,#f7fafc)]" aria-hidden="true" />
      <div className="mx-auto w-full max-w-[1380px] px-4 sm:px-6 lg:px-8">
      <header className="imobai-reveal">
        <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#8a6110]">Catálogo completo</p>
        <h1 className="imobai-gold-line mt-2 inline-block text-[28px] font-semibold tracking-[-0.035em] text-[#102033] sm:text-[34px]">
          Todas as oportunidades
        </h1>
        <p className="mt-3 max-w-[620px] text-[14px] leading-6 text-[#40536a]">
          Explore o catálogo com filtros reais de finalidade, tipo, preço e diferenciais. Os filtros ficam salvos na URL — você pode compartilhar uma busca ou voltar a ela depois.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          {[
            ["Dados revisados", "Informações normalizadas"],
            ["Busca inteligente", "Filtros compartilháveis"],
            ["Concierge IA", "Recomendações personalizadas"],
          ].map(([title, description]) => (
            <span key={title} title={description} className="rounded-full border border-[#dce6ee] bg-white/75 px-3 py-1.5 text-[10px] font-semibold text-[#526577] shadow-sm">
              <span className="mr-1.5 text-[#c99a3e]">●</span>{title}
            </span>
          ))}
        </div>
      </header>

      {/* Filtros */}
      <section aria-label="Filtros do catálogo" className="imobai-filter-surface mt-7 rounded-[24px] p-4 sm:p-5 lg:p-6">
        <div className="flex flex-wrap items-center gap-2">
          <SlidersHorizontal size={15} className="text-[#8a6110]" aria-hidden />
          <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#656e79]">Filtros</span>
          {activeFilterCount > 0 && (
            <button
              onClick={() => {
                setMinInput("");
                setMaxInput("");
                navigate("/catalogo");
              }}
              className="ml-auto flex items-center gap-1 rounded-full bg-[#f6f8fb] px-3 py-1.5 text-[11px] font-semibold text-[#40536a] transition hover:bg-[#eef2f6]"
            >
              <FilterX size={12} /> Limpar filtros ({activeFilterCount})
            </button>
          )}
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5">
          <div>
            <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-[0.12em] text-[#656e79]">Finalidade</label>
            <div className="flex gap-1.5">
              {(["compra", "aluguel"] as const).map(option => (
                <button
                  key={option}
                  onClick={() => update({ finalidade: state.finalidade === option ? null : option })}
                  aria-pressed={state.finalidade === option}
                  className={cn(
                    "flex-1 rounded-xl border px-3 py-2 text-[12px] font-semibold capitalize transition",
                    state.finalidade === option
                      ? "border-[#c99a3e] bg-[#fffaf0] text-[#8a6110]"
                      : "border-[#d8e1ea] bg-white text-[#40536a] hover:border-[#c99a3e]/40"
                  )}
                >
                  {option === "compra" ? "Comprar" : "Alugar"}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label htmlFor="catalog-tipo" className="mb-1.5 block text-[10px] font-semibold uppercase tracking-[0.12em] text-[#656e79]">Tipo</label>
            <select
              id="catalog-tipo"
              value={state.tipo ?? ""}
              onChange={event => update({ tipo: event.target.value || null })}
              className="h-[42px] w-full rounded-xl border border-[#d8e1ea] bg-white px-3 text-[13px] text-[#102033] outline-none transition focus:border-[#c99a3e]/60"
            >
              <option value="">Todos os tipos</option>
              {TIPOS.map(tipo => <option key={tipo} value={tipo}>{tipo}</option>)}
            </select>
          </div>

          <div>
            <label htmlFor="catalog-bairro" className="mb-1.5 block text-[10px] font-semibold uppercase tracking-[0.12em] text-[#656e79]">Bairro ou cidade</label>
            <div className="relative">
              <MapPin size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#a7b2c0]" aria-hidden />
              <input
                id="catalog-bairro"
                value={state.bairro ?? state.cidade ?? ""}
                onChange={event => {
                  const value = event.target.value;
                  update({ bairro: value || null, cidade: null });
                }}
                placeholder="Ex.: Pinheiros"
                className="h-[42px] w-full rounded-xl border border-[#d8e1ea] bg-white pl-9 pr-3 text-[13px] text-[#102033] outline-none transition placeholder:text-[#a7b2c0] focus:border-[#c99a3e]/60"
              />
            </div>
          </div>

          <div>
            <label htmlFor="catalog-ordem" className="mb-1.5 block text-[10px] font-semibold uppercase tracking-[0.12em] text-[#656e79]">Ordenar por</label>
            <select
              id="catalog-ordem"
              value={state.ordem}
              onChange={event => update({ ordem: event.target.value as CatalogState["ordem"] })}
              className="h-[42px] w-full rounded-xl border border-[#d8e1ea] bg-white px-3 text-[13px] text-[#102033] outline-none transition focus:border-[#c99a3e]/60"
            >
              {(Object.keys(ORDER_LABELS) as CatalogState["ordem"][]).map(option => (
                <option key={option} value={option}>{ORDER_LABELS[option]}</option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="catalog-quartos" className="mb-1.5 block text-[10px] font-semibold uppercase tracking-[0.12em] text-[#656e79]">
              <BedDouble size={11} className="mr-1 inline" aria-hidden /> Quartos (mín.)
            </label>
            <select
              id="catalog-quartos"
              value={state.quartos ?? ""}
              onChange={event => update({ quartos: event.target.value ? Number(event.target.value) : null })}
              className="h-[42px] w-full rounded-xl border border-[#d8e1ea] bg-white px-3 text-[13px] text-[#102033] outline-none transition focus:border-[#c99a3e]/60"
            >
              <option value="">Qualquer</option>
              {[1, 2, 3, 4, 5].map(n => <option key={n} value={n}>{n}+</option>)}
            </select>
          </div>

          <div>
            <label htmlFor="catalog-vagas" className="mb-1.5 block text-[10px] font-semibold uppercase tracking-[0.12em] text-[#656e79]">
              <Car size={11} className="mr-1 inline" aria-hidden /> Vagas (mín.)
            </label>
            <select
              id="catalog-vagas"
              value={state.vagas ?? ""}
              onChange={event => update({ vagas: event.target.value ? Number(event.target.value) : null })}
              className="h-[42px] w-full rounded-xl border border-[#d8e1ea] bg-white px-3 text-[13px] text-[#102033] outline-none transition focus:border-[#c99a3e]/60"
            >
              <option value="">Qualquer</option>
              {[1, 2, 3, 4].map(n => <option key={n} value={n}>{n}+</option>)}
            </select>
          </div>

          <div className="sm:col-span-2">
            <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-[0.12em] text-[#656e79]">
              <Wallet size={11} className="mr-1 inline" aria-hidden /> Faixa de preço (R$)
            </label>
            <div className="flex items-center gap-2">
              <input
                value={minInput}
                onChange={event => setMinInput(event.target.value)}
                onBlur={applyPrice}
                onKeyDown={event => event.key === "Enter" && applyPrice()}
                inputMode="numeric"
                placeholder="Mínimo"
                aria-label="Preço mínimo"
                className="h-[42px] w-full rounded-xl border border-[#d8e1ea] bg-white px-3 text-[13px] text-[#102033] outline-none transition placeholder:text-[#a7b2c0] focus:border-[#c99a3e]/60"
              />
              <span className="text-[#a7b2c0]">–</span>
              <input
                value={maxInput}
                onChange={event => setMaxInput(event.target.value)}
                onBlur={applyPrice}
                onKeyDown={event => event.key === "Enter" && applyPrice()}
                inputMode="numeric"
                placeholder="Máximo"
                aria-label="Preço máximo"
                className="h-[42px] w-full rounded-xl border border-[#d8e1ea] bg-white px-3 text-[13px] text-[#102033] outline-none transition placeholder:text-[#a7b2c0] focus:border-[#c99a3e]/60"
              />
            </div>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {([
            { key: "pets", label: "Aceita pets", icon: PawPrint },
            { key: "varanda", label: "Com varanda", icon: Bath },
            { key: "ensolarado", label: "Ensolarado", icon: Sun },
          ] as const).map(toggle => (
            <button
              key={toggle.key}
              onClick={() => update({ [toggle.key]: !state[toggle.key] } as Partial<CatalogState>)}
              aria-pressed={state[toggle.key]}
              className={cn(
                "flex items-center gap-1.5 rounded-full border px-3.5 py-2 text-[12px] font-semibold transition",
                state[toggle.key]
                  ? "border-[#c99a3e] bg-[#fffaf0] text-[#8a6110]"
                  : "border-[#d8e1ea] bg-white text-[#40536a] hover:border-[#c99a3e]/40"
              )}
            >
              <toggle.icon size={13} aria-hidden />
              {toggle.label}
            </button>
          ))}
        </div>
      </section>

      {/* Resultado */}
      <div className="mt-6 flex items-center justify-between">
        <p className="text-[13px] text-[#40536a]" aria-live="polite">
          <strong className="font-semibold text-[#102033]">{isLoading ? "…" : filtered.length}</strong>{" "}
          {filtered.length === 1 ? "imóvel encontrado" : "imóveis encontrados"}
        </p>
      </div>

      {isLoading ? (
        <div className="mt-5 grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className="overflow-hidden rounded-[22px] border border-[#e7ecf2] bg-white">
              <Skeleton className="aspect-[4/3] w-full rounded-none" />
              <div className="space-y-2.5 p-5">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
                <Skeleton className="h-3 w-2/3" />
                <Skeleton className="h-6 w-1/3" />
              </div>
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="mt-4 flex flex-col items-center rounded-[22px] border border-dashed border-[#d8e1ea] bg-[#fbfcfe] px-6 py-14 text-center">
          <SearchX size={30} className="text-[#8a6110]" aria-hidden />
          <h2 className="mt-4 text-[18px] font-semibold tracking-[-0.02em] text-[#102033]">Nenhum imóvel com esses filtros</h2>
          <p className="mt-2 max-w-[420px] text-[13px] leading-6 text-[#616e81]">
            Tente ampliar a faixa de preço, remover diferenciais ou buscar por outra cidade e bairro. Novos imóveis entram no catálogo sempre que são cadastrados.
          </p>
          <Button
            onClick={() => {
              setMinInput("");
              setMaxInput("");
              navigate("/catalogo");
            }}
            className="mt-5 rounded-xl bg-[#0b1f3a] text-[12px] font-semibold text-white hover:bg-[#12345a]"
          >
            <FilterX size={14} /> Limpar todos os filtros
          </Button>
        </div>
      ) : (
        <div className="mt-4 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((property, index) => (
            <div key={property.id} className="imobai-reveal" style={{ animationDelay: `${Math.min(index, 8) * 55}ms` }}>
              <PropertyCard
                property={property}
                priceContext={state.finalidade === "aluguel" ? "aluguel" : state.finalidade === "compra" ? "venda" : undefined}
                onOpenDetails={() => onOpenDetails(property)}
              />
            </div>
          ))}
        </div>
      )}

      <PropertyDetailsModal
        property={detailsProperty}
        onClose={() => setDetailsProperty(null)}
        similar={detailsProperty ? properties.filter(item => item.id !== detailsProperty.id && (item.bairro === detailsProperty.bairro || item.tipo === detailsProperty.tipo)).slice(0, 3) as DetailProperty[] : []}
        onSelectSimilar={item => setDetailsProperty(item as DetailProperty)}
      />
    </div>
    </div>
  );
}
