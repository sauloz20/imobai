import { Badge } from "@/components/ui/badge";
import { PremiumImage } from "@/components/PremiumImage";
import {
  formatBRL,
  getPropertyAmenities,
  getPropertyImage,
  getPropertyLocation,
  getPropertyPrice,
  getPropertyTitle,
  type PropertyLike,
} from "@/lib/property";
import { cn } from "@/lib/utils";
import { Bath, BedDouble, Car, Heart, MapPin, MessageSquareText, Maximize2, Pencil, Trash2 } from "lucide-react";
import { motion } from "framer-motion";
import { memo, useState } from "react";

export type PropertyCardProps = {
  property: PropertyLike & {
    id?: number | string;
    quartos?: number | null;
    banheiros?: number | null;
    vagas?: number | null;
    areaM2?: string | number | null;
    codigo?: string | null;
    recommended?: boolean;
    onNegotiate?: (property: PropertyLike) => void;
  };
  /** Ações do proprietário (cartão em "Meus imóveis"). */
  onEdit?: (property: PropertyCardProps["property"]) => void;
  onDelete?: (property: PropertyCardProps["property"]) => void;
  hideFavorite?: boolean;
  layout?: "vertical" | "horizontal";
  /** Contexto de modalidade (catálogo filtrado): ajusta qual preço exibir. */
  priceContext?: "venda" | "aluguel";
  onOpenDetails?: (property: PropertyCardProps["property"]) => void;
  className?: string;
};

const amenaryIcons = { pets: Heart } as const;

function PropertyCardBase({ property, layout = "vertical", priceContext, onOpenDetails, onEdit, onDelete, hideFavorite, className }: PropertyCardProps) {
  const [favorite, setFavorite] = useState(false);
  const price = getPropertyPrice(property, priceContext);
  const image = getPropertyImage(property);
  const title = getPropertyTitle(property);
  const location = getPropertyLocation(property);
  const amenities = getPropertyAmenities(property);
  const area = Number(property.areaM2 ?? 0);
  const horizontal = layout === "horizontal";

  const open = () => onOpenDetails?.(property);

  return (
    <motion.article
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
      whileHover={{ y: -3 }}
      whileFocus={{ y: -2 }}
      className={cn(
        "imobai-card-hover group flex cursor-pointer overflow-hidden rounded-[22px] border border-[#e7ecf2] bg-white shadow-[var(--shadow-card-premium)]",
        horizontal ? "flex-row" : "flex-col",
        className
      )}
      onClick={open}
      onKeyDown={event => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          open();
        }
      }}
      tabIndex={0}
      role="button"
      aria-label={`Ver detalhes de ${title}`}
    >
      <div
        className={cn(
          "imobai-image-hover relative shrink-0",
          horizontal ? "h-[150px] w-[190px] max-sm:h-[130px] max-sm:w-[124px]" : "aspect-[4/3] w-full"
        )}
      >
        <PremiumImage
          src={image}
          alt={title}
          className="h-full w-full"
          imgClassName="transition-transform duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-[1.03]"
        />
        <div className="absolute left-3 top-3 flex max-w-[85%] flex-wrap gap-1.5">
          <span className="rounded-full bg-[#0b1f3a]/85 px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.14em] text-white backdrop-blur-sm">
            {property.tipo ?? "Imóvel"}
          </span>
          {price.modality === "aluguel" && (
            <span className="rounded-full bg-[#2b6e9e]/90 px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.14em] text-white backdrop-blur-sm">
              Aluguel
            </span>
          )}
          {price.modality === "venda" && property.valorAluguel && Number(property.valorAluguel) > 0 && !horizontal && (
            <span className="rounded-full bg-white/90 px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.14em] text-[#40536a] backdrop-blur-sm">
              Venda e aluguel
            </span>
          )}
          {property.recommended && !horizontal && (
            <span className="rounded-full bg-[#c99a3e] px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.14em] text-[#071426]">
              Recomendado
            </span>
          )}
        </div>
        <button
          type="button"
          aria-label={favorite ? "Remover dos favoritos" : "Adicionar aos favoritos"}
          aria-pressed={favorite}
          onClick={event => {
            event.stopPropagation();
            setFavorite(current => !current);
          }}
          className={cn(
            "absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full backdrop-blur-sm transition",
            hideFavorite && "hidden",
            favorite ? "bg-[#c99a3e] text-white" : "bg-white/90 text-[#40536a] hover:bg-white"
          )}
        >
          <Heart size={15} className={favorite ? "fill-current" : undefined} />
        </button>
      </div>

      <div className={cn("flex min-w-0 flex-1 flex-col p-4 sm:p-5", horizontal && "py-4")}>
        <h3 className="line-clamp-2 min-h-[2.4em] text-[16px] font-semibold leading-[1.3] tracking-[-0.02em] text-[#102033]">
          {title}
        </h3>
        <p className="mt-1 flex items-center gap-1 text-[12px] text-[#616e81]">
          <MapPin size={13} className="shrink-0 text-[#8a6110]" />
          <span className="truncate">{location}</span>
          {property.codigo && <span className="ml-auto hidden shrink-0 text-[10px] text-[#a7b2c0] sm:inline">{property.codigo}</span>}
        </p>

        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[12px] text-[#40536a]" aria-label="Atributos do imóvel">
          <span className="flex items-center gap-1.5">
            <BedDouble size={14} className="text-[#656e79]" aria-hidden />
            {property.quartos ?? 0} {Number(property.quartos) === 1 ? "quarto" : "quartos"}
          </span>
          <span className="flex items-center gap-1.5">
            <Bath size={14} className="text-[#656e79]" aria-hidden />
            {property.banheiros ?? 0} banh.
          </span>
          <span className="flex items-center gap-1.5">
            <Car size={14} className="text-[#656e79]" aria-hidden />
            {property.vagas ?? 0} {Number(property.vagas) === 1 ? "vaga" : "vagas"}
          </span>
          <span className="flex items-center gap-1.5">
            <Maximize2 size={13} className="text-[#656e79]" aria-hidden />
            {area ? `${area.toLocaleString("pt-BR")} m²` : "—"}
          </span>
        </div>

        <div className="mt-4 flex items-end justify-between gap-3 border-t border-[#eef2f6] pt-3.5">
          <div>
            <div
              className={cn(
                "font-semibold tracking-[-0.02em] text-[#102033]",
                price.modality === "none" ? "text-[14px]" : "text-[19px]"
              )}
            >
              {price.primary}
            </div>
            <div className="mt-0.5 text-[10px] font-medium uppercase tracking-[0.14em] text-[#656e79]">{price.label}</div>
          </div>
          {amenities.length > 0 && (
            <div className="flex flex-wrap justify-end gap-1">
              {amenities.map(amenity => {
                const Icon = amenity.key === "pets" ? amenaryIcons.pets : undefined;
                return (
                  <span
                    key={amenity.key}
                    title={amenity.label}
                    className="flex h-6 items-center gap-1 rounded-lg bg-[#f6f8fb] px-1.5 text-[10px] font-medium text-[#5a6b80]"
                  >
                    {Icon && <Icon size={11} className="text-[#8a6110]" aria-hidden />}
                    {amenity.label}
                  </span>
                );
              })}
            </div>
          )}
        </div>

        {(onEdit || onDelete) && (
          <div className="mt-3.5 flex gap-2">
            {onEdit && (
              <button
                type="button"
                onClick={event => {
                  event.stopPropagation();
                  onEdit(property);
                }}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-[#0b1f3a]/12 bg-[#f6f8fb] py-2.5 text-[12px] font-semibold text-[#0b1f3a] transition hover:border-[#2b6e9e]/40 hover:bg-[#f0f7fc]"
              >
                <Pencil size={14} className="text-[#2b6e9e]" />
                Editar
              </button>
            )}
            {onDelete && (
              <button
                type="button"
                onClick={event => {
                  event.stopPropagation();
                  onDelete(property);
                }}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-[#b03a2e]/20 bg-[#fdf5f4] py-2.5 text-[12px] font-semibold text-[#b03a2e] transition hover:bg-[#fbe9e7]"
              >
                <Trash2 size={14} />
                Excluir
              </button>
            )}
          </div>
        )}

        {property.onNegotiate && (
          <button
            type="button"
            onClick={event => {
              event.stopPropagation();
              property.onNegotiate?.(property);
            }}
            className="mt-3.5 flex w-full items-center justify-center gap-2 rounded-xl border border-[#0b1f3a]/12 bg-[#f6f8fb] py-2.5 text-[12px] font-semibold text-[#0b1f3a] transition hover:border-[#c99a3e]/40 hover:bg-[#fffaf0]"
          >
            <MessageSquareText size={14} className="text-[#8a6110]" />
            Negociar com o anunciante
          </button>
        )}
      </div>
    </motion.article>
  );
}

export const PropertyCard = memo(PropertyCardBase);
