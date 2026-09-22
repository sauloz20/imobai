import { PremiumImage } from "@/components/PremiumImage";
import { PropertyCard } from "@/components/PropertyCard";
import { Button } from "@/components/ui/button";
import {
  formatBRL,
  getPropertyImage,
  getPropertyPrice,
  getPropertyTitle,
} from "@/lib/property";
import { cn } from "@/lib/utils";
import {
  Bath,
  BedDouble,
  Car,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Heart,
  Loader2,
  MapPin,
  MessageSquareText,
  Ruler,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";

export type DetailProperty = {
  id: number;
  ownerId: number | null;
  codigo: string;
  tipo: string;
  bairro: string;
  cidade: string;
  quartos: number;
  banheiros: number;
  vagas: number;
  areaM2: string | number;
  aceitaPets: boolean;
  varanda: boolean;
  ensolarado: boolean;
  valorVenda: string | null;
  valorAluguel: string | null;
  descricaoTecnica: string | null;
  descricaoIa: string | null;
  tituloAnuncio: string | null;
  imagemUrl: string | null;
  fotos?: Array<{ id: number; url: string; ordem: number }> | null;
};

type SimilarProperty = Omit<DetailProperty, "fotos"> & {
  fotos?: DetailProperty["fotos"];
};

type PropertyDetailsModalProps = {
  property: DetailProperty | null;
  onClose: () => void;
  onNegotiate?: (property: DetailProperty) => void;
  similar?: SimilarProperty[];
  onSelectSimilar?: (property: SimilarProperty) => void;
};

export function PropertyDetailsModal({
  property,
  onClose,
  onNegotiate,
  similar = [],
  onSelectSimilar,
}: PropertyDetailsModalProps) {
  const [galleryIndex, setGalleryIndex] = useState(0);
  const [favorite, setFavorite] = useState(false);

  useEffect(() => {
    setGalleryIndex(0);
    setFavorite(false);
  }, [property?.id]);

  useEffect(() => {
    if (!property) return;

    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();

      if (event.key === "ArrowLeft") {
        setGalleryIndex(current => Math.max(0, current - 1));
      }

      if (event.key === "ArrowRight") {
        setGalleryIndex(current => current + 1);
      }
    };

    document.addEventListener("keydown", handleKey);
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", handleKey);
      document.body.style.overflow = "";
    };
  }, [property, onClose]);

  if (!property) return null;

  const price = getPropertyPrice(property);
  const mainImage = getPropertyImage(property);

  const gallery = Array.from(
    new Set([
      ...(mainImage ? [mainImage] : []),
      ...(property.fotos ?? [])
        .map(photo => photo.url)
        .filter(Boolean),
    ])
  );

  const currentImage = gallery[galleryIndex] ?? null;
  const title = getPropertyTitle(property);

  const description =
    property.descricaoIa || property.descricaoTecnica;

  const technical =
    property.descricaoTecnica &&
    property.descricaoTecnica !== description
      ? property.descricaoTecnica
      : null;

  const attributes = [
    {
      icon: BedDouble,
      label: "Quartos",
      value: String(property.quartos ?? 0),
    },
    {
      icon: Bath,
      label: "Banheiros",
      value: String(property.banheiros ?? 0),
    },
    {
      icon: Car,
      label: "Vagas",
      value: String(property.vagas ?? 0),
    },
    {
      icon: Ruler,
      label: "Área",
      value: `${Number(property.areaM2 ?? 0).toLocaleString("pt-BR")} m²`,
    },
  ];

  const structured = [
    property.aceitaPets && { label: "Aceita pets" },
    property.varanda && { label: "Varanda" },
    property.ensolarado && { label: "Ensolarado" },
  ].filter(Boolean) as Array<{ label: string }>;

  const goToPreviousImage = () => {
    if (gallery.length <= 1) return;

    setGalleryIndex(
      current => (current - 1 + gallery.length) % gallery.length
    );
  };

  const goToNextImage = () => {
    if (gallery.length <= 1) return;

    setGalleryIndex(current => (current + 1) % gallery.length);
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex bg-[#071426]/85 backdrop-blur-md"
      role="dialog"
      aria-modal="true"
      aria-label={`Detalhes de ${title}`}
      onClick={onClose}
    >
      <div
        className="imobai-reveal relative flex h-full w-full flex-col overflow-hidden bg-[#f7f9fc]"
        onClick={event => event.stopPropagation()}
      >
        <header className="absolute left-0 right-0 top-0 z-50 flex h-[72px] items-center justify-between bg-gradient-to-b from-[#071426]/75 to-transparent px-4 sm:px-7">
          <button
            type="button"
            onClick={onClose}
            className="flex items-center gap-2 rounded-full border border-white/20 bg-[#071426]/60 px-4 py-2.5 text-sm font-medium text-white backdrop-blur-md transition hover:bg-[#071426]/80"
          >
            <ChevronLeft size={18} />
            <span className="hidden sm:inline">Voltar</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setFavorite(current => !current)}
              aria-label={
                favorite
                  ? "Remover dos favoritos"
                  : "Adicionar aos favoritos"
              }
              aria-pressed={favorite}
              className={cn(
                "flex h-10 w-10 items-center justify-center rounded-full border backdrop-blur-md transition",
                favorite
                  ? "border-[#c99a3e] bg-[#c99a3e] text-white"
                  : "border-white/20 bg-[#071426]/60 text-white hover:bg-[#071426]/80"
              )}
            >
              <Heart
                size={18}
                className={favorite ? "fill-current" : undefined}
              />
            </button>


          </div>
        </header>

        <main className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[minmax(0,1.35fr)_minmax(420px,0.85fr)]">
          <section className="relative min-h-[48vh] bg-[#16283b] lg:min-h-0">
            <PremiumImage
              src={currentImage}
              alt={`${title} — foto ${galleryIndex + 1} de ${gallery.length}`}
              className="h-full w-full"
              eager
            />

            <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#071426]/65 via-transparent to-[#071426]/10" />

            {price.modality === "aluguel" && (
              <span className="absolute left-5 top-20 rounded-full bg-[#2b6e9e] px-4 py-2 text-[10px] font-bold uppercase tracking-[0.16em] text-white shadow-lg sm:left-8">
                Aluguel
              </span>
            )}

            {gallery.length > 1 && (
              <>
                <button
                  type="button"
                  onClick={goToPreviousImage}
                  aria-label="Imagem anterior"
                  className="absolute left-4 top-1/2 z-20 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-[#071426]/65 text-white shadow-xl backdrop-blur-md transition hover:bg-[#071426]/90 active:scale-95 sm:left-7"
                >
                  <ChevronLeft size={23} />
                </button>

                <button
                  type="button"
                  onClick={goToNextImage}
                  aria-label="Próxima imagem"
                  className="absolute right-4 top-1/2 z-20 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-[#071426]/65 text-white shadow-xl backdrop-blur-md transition hover:bg-[#071426]/90 active:scale-95 sm:right-7"
                >
                  <ChevronRight size={23} />
                </button>

                <div className="absolute bottom-5 left-1/2 z-20 -translate-x-1/2 rounded-full bg-[#071426]/70 px-4 py-2 text-xs font-semibold text-white backdrop-blur-md">
                  {galleryIndex + 1} / {gallery.length}
                </div>
              </>
            )}

            <div className="absolute bottom-4 left-4 right-4 z-20 flex gap-2 overflow-x-auto pb-1 sm:bottom-7 sm:left-7 sm:right-7">
              {gallery.map((image, index) => (
                <button
                  key={`${image}-${index}`}
                  type="button"
                  onClick={() => setGalleryIndex(index)}
                  aria-label={`Ver foto ${index + 1}`}
                  aria-current={index === galleryIndex}
                  className={cn(
                    "h-14 w-20 shrink-0 overflow-hidden rounded-xl border-2 bg-[#071426]/40 shadow-lg transition sm:h-16 sm:w-24",
                    index === galleryIndex
                      ? "border-[#e7c984]"
                      : "border-white/40 opacity-75 hover:border-white hover:opacity-100"
                  )}
                >
                  <PremiumImage
                    src={image}
                    alt=""
                    className="h-full w-full"
                  />
                </button>
              ))}
            </div>
          </section>

          <section className="min-h-0 overflow-y-auto bg-white">
            <div className="mx-auto w-full max-w-[720px] p-5 pb-8 sm:p-8 lg:p-10">
              {property.codigo && (
                <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#8a6110]">
                  {property.codigo}
                </span>
              )}

              <div className="mt-2 flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <h1 className="text-[26px] font-semibold leading-tight tracking-[-0.035em] text-[#102033] sm:text-[34px]">
                    {title}
                  </h1>

                  <p className="mt-2 flex items-center gap-1.5 text-sm text-[#40536a]">
                    <MapPin
                      size={16}
                      className="shrink-0 text-[#b1812c]"
                    />
                    {property.bairro}, {property.cidade}
                  </p>
                </div>
              </div>

              <div className="mt-6 border-b border-[#e7edf3] pb-6">
                <div className="text-[30px] font-semibold tracking-[-0.04em] text-[#102033] sm:text-[36px]">
                  {price.primary}
                </div>

                <div className="mt-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-[#707b88]">
                  {price.label}
                </div>

                {price.sale !== null &&
                  price.rent !== null &&
                  price.rent > 0 && (
                    <div className="mt-2 text-xs text-[#616e81]">
                      Também para aluguel:{" "}
                      <strong>{formatBRL(price.rent)}</strong>
                      /mês
                    </div>
                  )}
              </div>

              <div className="mt-6 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
                {attributes.map(attribute => (
                  <div
                    key={attribute.label}
                    className="rounded-2xl border border-[#e7edf3] bg-[#f8fafc] p-4"
                  >
                    <attribute.icon
                      size={19}
                      className="text-[#2b6e9e]"
                      aria-hidden
                    />

                    <div className="mt-3 text-lg font-semibold text-[#102033]">
                      {attribute.value}
                    </div>

                    <div className="mt-0.5 text-[9px] font-semibold uppercase tracking-[0.12em] text-[#707b88]">
                      {attribute.label}
                    </div>
                  </div>
                ))}
              </div>

              {structured.length > 0 && (
                <div className="mt-6">
                  <h2 className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#707b88]">
                    Características
                  </h2>

                  <div className="mt-3 flex flex-wrap gap-2">
                    {structured.map(item => (
                      <span
                        key={item.label}
                        className="flex items-center gap-1.5 rounded-full border border-[#2f8b61]/20 bg-[#eef8f1] px-3 py-2 text-xs font-semibold text-[#2f8b61]"
                      >
                        <CheckCircle2 size={13} />
                        {item.label}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {(description || technical) && (
                <div className="mt-7 border-t border-[#e7edf3] pt-6">
                  <h2 className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#707b88]">
                    Sobre o imóvel
                  </h2>

                  {description && (
                    <p className="mt-3 whitespace-pre-line text-[14px] leading-7 text-[#40536a]">
                      {description}
                    </p>
                  )}

                  {technical && (
                    <p className="mt-4 whitespace-pre-line text-[13px] leading-6 text-[#687688]">
                      {technical}
                    </p>
                  )}
                </div>
              )}

              <div className="mt-8">
                <NegotiationCTA
                  property={property}
                  onNegotiate={onNegotiate}
                  favorite={favorite}
                  onToggleFavorite={() =>
                    setFavorite(current => !current)
                  }
                />
              </div>

              {similar.length > 0 && (
                <div className="mt-9 border-t border-[#e7edf3] pt-7">
                  <h2 className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#707b88]">
                    Imóveis semelhantes
                  </h2>

                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    {similar.slice(0, 4).map(item => (
                      <PropertyCard
                        key={item.id}
                        property={{
                          ...item,
                          onNegotiate: undefined,
                        }}
                        className="!rounded-[18px] shadow-none"
                        onOpenDetails={() =>
                          onSelectSimilar?.(item)
                        }
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}

function NegotiationCTA({
  property,
  onNegotiate,
  favorite,
  onToggleFavorite,
}: {
  property: DetailProperty;
  onNegotiate?: (property: DetailProperty) => void;
  favorite: boolean;
  onToggleFavorite: () => void;
}) {
  const [pending, setPending] = useState(false);

  return (
    <div className="flex w-full gap-2.5">
      <Button
        onClick={() => {
          setPending(true);
          onNegotiate?.(property);
          setTimeout(() => setPending(false), 1200);
        }}
        disabled={pending}
        className="h-12 flex-1 rounded-xl bg-[#c99a3e] text-sm font-semibold text-[#071426] shadow-[0_10px_26px_rgba(201,154,62,0.28)] transition hover:bg-[#d9ad58]"
      >
        {pending ? (
          <Loader2 size={17} className="animate-spin" />
        ) : (
          <MessageSquareText size={17} />
        )}
        Tenho interesse
      </Button>

      <button
        type="button"
        onClick={onToggleFavorite}
        aria-label={
          favorite
            ? "Remover dos favoritos"
            : "Adicionar aos favoritos"
        }
        aria-pressed={favorite}
        className={cn(
          "flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border transition",
          favorite
            ? "border-[#c99a3e] bg-[#c99a3e] text-white"
            : "border-[#d8e1ea] bg-white text-[#40536a] hover:border-[#c99a3e]/50 hover:bg-[#fffaf0]"
        )}
      >
        <Heart
          size={18}
          className={favorite ? "fill-current" : undefined}
        />
      </button>
    </div>
  );
}


