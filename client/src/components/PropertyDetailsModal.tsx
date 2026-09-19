import { PremiumImage } from "@/components/PremiumImage";
import { PropertyCard } from "@/components/PropertyCard";
import { Button } from "@/components/ui/button";
import { formatBRL, getPropertyImage, getPropertyPrice, getPropertyTitle } from "@/lib/property";
import { cn } from "@/lib/utils";
import { Bath, BedDouble, Car, CheckCircle2, Heart, Loader2, MapPin, MessageSquareText, Ruler, Sun, X } from "lucide-react";
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

type SimilarProperty = Omit<DetailProperty, "fotos"> & { fotos?: DetailProperty["fotos"] };

type PropertyDetailsModalProps = {
  property: DetailProperty | null;
  onClose: () => void;
  onNegotiate?: (property: DetailProperty) => void;
  similar?: SimilarProperty[];
  onSelectSimilar?: (property: SimilarProperty) => void;
};

export function PropertyDetailsModal({ property, onClose, onNegotiate, similar = [], onSelectSimilar }: PropertyDetailsModalProps) {
  const [galleryIndex, setGalleryIndex] = useState(0);
  const [favorite, setFavorite] = useState(false);

  useEffect(() => {
    setGalleryIndex(0);
  }, [property?.id]);

  useEffect(() => {
    if (!property) return;
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
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
  const gallery = [
    ...(mainImage ? [mainImage] : []),
    ...(property.fotos ?? []).map(photo => photo.url).filter(Boolean),
  ] as string[];
  const currentImage = gallery[galleryIndex] ?? null;
  const title = getPropertyTitle(property);
  const description = property.descricaoIa || property.descricaoTecnica;
  const technical = property.descricaoTecnica && property.descricaoTecnica !== description ? property.descricaoTecnica : null;

  const attributes = [
    { icon: BedDouble, label: "Quartos", value: String(property.quartos ?? 0) },
    { icon: Bath, label: "Banheiros", value: String(property.banheiros ?? 0) },
    { icon: Car, label: "Vagas", value: String(property.vagas ?? 0) },
    { icon: Ruler, label: "Ãrea", value: `${Number(property.areaM2 ?? 0).toLocaleString("pt-BR")} mÂ²` },
  ];

  const structured = [
    property.aceitaPets && { label: "Aceita pets" },
    property.varanda && { label: "Varanda" },
    property.ensolarado && { label: "Ensolarado" },
  ].filter(Boolean) as Array<{ label: string }>;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-[#071426]/70 p-0 backdrop-blur-sm sm:items-center sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-label={`Detalhes de ${title}`}
      onClick={onClose}
    >
      <div
        className="imobai-reveal relative flex max-h-[92vh] w-full max-w-[920px] flex-col overflow-hidden rounded-t-[24px] bg-white shadow-[var(--shadow-modal-premium)] sm:rounded-[24px]"
        onClick={event => event.stopPropagation()}
      >
                <button
          onClick={onClose}
          type="button"
          aria-label="Fechar detalhes"
          className="absolute right-4 top-4 z-[100] flex h-10 w-10 cursor-pointer items-center justify-center rounded-full bg-[#071426]/85 text-white shadow-xl backdrop-blur-sm transition hover:bg-[#071426] active:scale-95"
        >
          <X size={18} strokeWidth={2.5} />
        </button>

        {/* Galeria */}
        <div className="relative aspect-[16/10] w-full shrink-0 bg-[#22384f] sm:aspect-[16/8]">
          <PremiumImage src={currentImage} alt={title} className="h-full w-full" eager />
          {gallery.length > 1 && (
            <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 gap-1.5 rounded-full bg-[#071426]/55 px-2.5 py-1.5 backdrop-blur-sm">
              {gallery.map((image, index) => (
                <button
                  key={`${image}-${index}`}
                  onClick={() => setGalleryIndex(index)}
                  aria-label={`Ver foto ${index + 1} de ${gallery.length}`}
                  aria-current={index === galleryIndex}
                  className={cn(
                    "h-1.5 rounded-full transition-all",
                    index === galleryIndex ? "w-6 bg-[#e7c984]" : "w-1.5 bg-white/50 hover:bg-white/80"
                  )}
                />
              ))}
            </div>
          )}
          {price.modality === "aluguel" && (
            <span className="absolute left-4 top-4 rounded-full bg-[#2b6e9e] px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.16em] text-white">
              Aluguel
            </span>
          )}
        </div>

        {/* ConteÃºdo */}
        <div className="overflow-y-auto p-5 sm:p-7">
          <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
            <div className="min-w-0">
              {property.codigo && (
                <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#8a6110]">{property.codigo}</span>
              )}
              <h2 className="mt-1 text-[22px] font-semibold leading-tight tracking-[-0.03em] text-[#102033] sm:text-[26px]">{title}</h2>
              <p className="mt-1.5 flex items-center gap-1.5 text-[13px] text-[#40536a]">
                <MapPin size={14} className="text-[#8a6110]" />
                {property.bairro}, {property.cidade}
              </p>
            </div>
            <div className="shrink-0 text-left sm:text-right">
              <div className="text-[24px] font-semibold tracking-[-0.03em] text-[#102033]">{price.primary}</div>
              <div className="mt-0.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-[#656e79]">{price.label}</div>
              {price.sale !== null && price.rent !== null && price.rent > 0 && (
                <div className="mt-1 text-[11px] text-[#616e81]">TambÃ©m para aluguel: {formatBRL(price.rent)}/mÃªs</div>
              )}
            </div>
          </div>

          <div className="mt-5 grid grid-cols-4 gap-2 rounded-[18px] bg-[#f6f8fb] p-3.5">
            {attributes.map(attribute => (
              <div key={attribute.label} className="flex flex-col items-center gap-1 py-1 text-center">
                <attribute.icon size={17} className="text-[#2b6e9e]" aria-hidden />
                <span className="text-[15px] font-semibold text-[#102033]">{attribute.value}</span>
                <span className="text-[9px] font-medium uppercase tracking-[0.12em] text-[#656e79]">{attribute.label}</span>
              </div>
            ))}
          </div>

          {(description || technical) && (
            <div className="mt-5">
              <h3 className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#656e79]">Sobre o imÃ³vel</h3>
              <p className="mt-2 whitespace-pre-line text-[13.5px] leading-6 text-[#40536a]">{description}</p>
              {technical && <p className="mt-3 whitespace-pre-line text-[12.5px] leading-5 text-[#616e81]">{technical}</p>}
            </div>
          )}

          {structured.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2">
              {structured.map(item => (
                <span
                  key={item.label}
                  className="flex items-center gap-1.5 rounded-full border border-[#2f8b61]/25 bg-[#eef8f1] px-3 py-1.5 text-[11px] font-semibold text-[#2f8b61]"
                >
                  <CheckCircle2 size={12} />
                  {item.label}
                </span>
              ))}
            </div>
          )}

          {/* CTA fixo em desktop dentro do bloco; fixo em mobile abaixo */}
          <div className="mt-6 hidden sm:block">
            <NegotiationCTA property={property} onNegotiate={onNegotiate} favorite={favorite} onToggleFavorite={() => setFavorite(current => !current)} />
          </div>

          {similar.length > 0 && (
            <div className="mt-7 border-t border-[#eef2f6] pt-5">
              <h3 className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#656e79]">ImÃ³veis semelhantes</h3>
              <div className="mt-3 grid gap-3 sm:grid-cols-3">
                {similar.slice(0, 3).map(item => (
                  <PropertyCard
                    key={item.id}
                    property={{ ...item, onNegotiate: undefined }}
                    className="!rounded-[16px] shadow-none"
                    onOpenDetails={() => onSelectSimilar?.(item)}
                  />
                ))}
              </div>
            </div>
          )}
        </div>

        {/* CTA fixo mobile */}
        <div className="sticky bottom-0 border-t border-[#eef2f6] bg-white/95 p-3.5 backdrop-blur-md sm:hidden">
          <NegotiationCTA property={property} onNegotiate={onNegotiate} favorite={favorite} onToggleFavorite={() => setFavorite(current => !current)} compact />
        </div>
      </div>
    </div>
  );
}

function NegotiationCTA({
  property,
  onNegotiate,
  favorite,
  onToggleFavorite,
  compact = false,
}: {
  property: DetailProperty;
  onNegotiate?: (property: DetailProperty) => void;
  favorite: boolean;
  onToggleFavorite: () => void;
  compact?: boolean;
}) {
  const [pending, setPending] = useState(false);

  return (
    <div className={cn("flex items-center gap-2.5", compact ? "w-full" : "")}>
      <Button
        onClick={() => {
          setPending(true);
          onNegotiate?.(property);
          setTimeout(() => setPending(false), 1200);
        }}
        disabled={pending}
        className="h-11 flex-1 rounded-xl bg-[#c99a3e] text-[13px] font-semibold text-[#071426] shadow-[0_10px_26px_rgba(201,154,62,0.32)] transition hover:bg-[#d9ad58]"
      >
        {pending ? <Loader2 size={15} className="animate-spin" /> : <MessageSquareText size={15} />}
        Tenho interesse
      </Button>
      <button
        onClick={onToggleFavorite}
        aria-label={favorite ? "Remover dos favoritos" : "Adicionar aos favoritos"}
        aria-pressed={favorite}
        className={cn(
          "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border transition",
          favorite ? "border-[#c99a3e] bg-[#c99a3e] text-white" : "border-[#d8e1ea] bg-white text-[#40536a] hover:border-[#c99a3e]/50"
        )}
      >
        <Heart size={16} className={favorite ? "fill-current" : undefined} />
      </button>
    </div>
  );
}

