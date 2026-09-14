import { cn } from "@/lib/utils";
import { Building2 } from "lucide-react";
import { useState } from "react";

type PremiumImageProps = {
  src: string | null;
  alt: string;
  className?: string;
  imgClassName?: string;
  eager?: boolean;
  sizes?: string;
};

/**
 * Placeholder premium (Plano Mestre, seção 10): fundo azul-acinzentado,
 * ícone arquitetônico e texto "Imagem não cadastrada". Parece decisão de
 * design, não uma falha. Nunca renderiza uma URL quebrada.
 */
export function PremiumImagePlaceholder({ className }: { className?: string }) {
  return (
    <div
      role="img"
      aria-label="Imagem não cadastrada"
      className={cn(
        "flex h-full w-full flex-col items-center justify-center gap-2 bg-gradient-to-br from-[#2c4a68] via-[#22384f] to-[#14243a] text-white/70",
        className
      )}
    >
      <Building2 size={28} strokeWidth={1.4} className="text-white/45" />
      <span className="px-4 text-center text-[10px] font-semibold uppercase tracking-[0.22em] text-white/45">
        Imagem não cadastrada
      </span>
      <span className="h-px w-10 bg-[#c99a3e]/60" />
    </div>
  );
}

export function PremiumImage({ src, alt, className, imgClassName, eager = false, sizes }: PremiumImageProps) {
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    return <PremiumImagePlaceholder className={className} />;
  }

  return (
    <div className={cn("relative overflow-hidden", className)}>
      <img
        src={src}
        alt={alt}
        sizes={sizes}
        loading={eager ? "eager" : "lazy"}
        decoding="async"
        onError={() => setFailed(true)}
        className={cn("h-full w-full object-cover", imgClassName)}
      />
    </div>
  );
}
