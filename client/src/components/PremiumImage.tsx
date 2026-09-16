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
        "relative flex h-full w-full flex-col items-center justify-center gap-2 overflow-hidden bg-[radial-gradient(circle_at_20%_15%,rgba(201,154,62,0.24),transparent_30%),linear-gradient(135deg,#2c4a68,#14243a)] text-white/70",
        className
      )}
    >
      <span className="pointer-events-none absolute inset-0 opacity-20 [background-image:linear-gradient(135deg,transparent_48%,rgba(255,255,255,0.18)_49%,transparent_51%)] [background-size:28px_28px]" aria-hidden="true" />
      <Building2 size={28} strokeWidth={1.4} className="text-white/45" />
      <span className="px-4 text-center text-[10px] font-semibold uppercase tracking-[0.22em] text-white/45">
        Imagem do anúncio
      </span>
      <span className="h-px w-10 bg-[#c99a3e]/60" />
      <span className="text-[10px] text-white/35">Adicione fotos para destacar este imóvel</span>
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
