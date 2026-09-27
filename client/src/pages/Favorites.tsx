import {
  Bath,
  BedDouble,
  Heart,
  MapPin,
  Ruler,
  SlidersHorizontal,
} from "lucide-react";

const favorites = [
  {
    id: 1,
    title: "Apartamento com varanda",
    location: "Morada do Sol, Montes Claros - MG",
    price: "R$ 495.000",
    bedrooms: 3,
    bathrooms: 2,
    area: "98 m²",
    image:
      "https://images.unsplash.com/photo-1600607687920-4e2a09cf159d?auto=format&fit=crop&w=1000&q=80",
  },
  {
    id: 2,
    title: "Casa contemporânea",
    location: "Ibituruna, Montes Claros - MG",
    price: "R$ 760.000",
    bedrooms: 4,
    bathrooms: 3,
    area: "214 m²",
    image:
      "https://images.unsplash.com/photo-1600585154526-990dced4db0d?auto=format&fit=crop&w=1000&q=80",
  },
  {
    id: 3,
    title: "Apartamento próximo ao centro",
    location: "São José, Montes Claros - MG",
    price: "R$ 340.000",
    bedrooms: 2,
    bathrooms: 2,
    area: "76 m²",
    image:
      "https://images.unsplash.com/photo-1600566753086-00f18fb6b3ea?auto=format&fit=crop&w=1000&q=80",
  },
];

export default function Favorites() {
  return (
    <main className="min-h-screen bg-[#f5f9fc] px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-7 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-[#7b94a8]">
              Sua seleção
            </p>

            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-semibold tracking-tight text-[#243b53] sm:text-4xl">
                Favoritos
              </h1>

              <span className="rounded-full border border-[#dce8f0] bg-white/70 px-2.5 py-1 text-[11px] font-semibold text-[#64788a]">
                {favorites.length}
              </span>
            </div>

            <p className="mt-2 max-w-2xl text-sm leading-6 text-[#64788a]">
              Guarde os imóveis que mais combinam com o que você procura e
              compare suas opções com calma.
            </p>
          </div>

          <button
            type="button"
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-[#dce8f0] bg-white px-4 py-2.5 text-sm font-semibold text-[#536b7f] shadow-[0_8px_24px_rgba(48,81,107,0.04)] transition hover:bg-[#f8fbfd]"
          >
            <SlidersHorizontal size={16} />
            Filtrar
          </button>
        </div>

        <div className="mb-6 flex items-center gap-2 rounded-2xl border border-[#dce9f2] bg-[#f8fbfd] px-4 py-3">
          <Heart size={16} className="fill-[#2f6f9f] text-[#2f6f9f]" />
          <p className="text-xs text-[#64788a]">
            Você salvou{" "}
            <span className="font-semibold text-[#30475c]">
              {favorites.length} imóveis
            </span>
            . Continue explorando para encontrar novas opções.
          </p>
        </div>

        <section className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {favorites.map(property => (
            <article
              key={property.id}
              className="group overflow-hidden rounded-[24px] border border-white/80 bg-white shadow-[0_14px_45px_rgba(48,81,107,0.06)] transition hover:-translate-y-0.5 hover:shadow-[0_18px_50px_rgba(48,81,107,0.1)]"
            >
              <div className="relative aspect-[16/10] overflow-hidden bg-[#eaf1f5]">
                <img
                  src={property.image}
                  alt={property.title}
                  className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.02]"
                />

                <button
                  type="button"
                  aria-label={`Remover ${property.title} dos favoritos`}
                  className="absolute right-3 top-3 flex h-10 w-10 items-center justify-center rounded-xl border border-white/70 bg-white/90 text-[#2f6f9f] shadow-sm backdrop-blur transition hover:bg-white"
                >
                  <Heart size={18} className="fill-current" />
                </button>

                <div className="absolute bottom-3 left-3 rounded-full border border-white/70 bg-white/90 px-2.5 py-1 text-[10px] font-medium text-[#536b7f] backdrop-blur">
                  Imóvel selecionado
                </div>
              </div>

              <div className="p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="truncate text-base font-semibold text-[#243b53]">
                      {property.title}
                    </h2>

                    <div className="mt-1.5 flex items-center gap-1.5 text-xs text-[#718698]">
                      <MapPin size={13} className="shrink-0" />
                      <span className="truncate">{property.location}</span>
                    </div>
                  </div>
                </div>

                <p className="mt-4 text-xl font-semibold tracking-tight text-[#2f6f9f]">
                  {property.price}
                </p>

                <div className="mt-4 flex flex-wrap gap-3 border-t border-[#edf2f5] pt-4 text-[11px] text-[#718698]">
                  <span className="inline-flex items-center gap-1.5">
                    <BedDouble size={14} />
                    {property.bedrooms} quartos
                  </span>

                  <span className="inline-flex items-center gap-1.5">
                    <Bath size={14} />
                    {property.bathrooms} banheiros
                  </span>

                  <span className="inline-flex items-center gap-1.5">
                    <Ruler size={14} />
                    {property.area}
                  </span>
                </div>

                <button
                  type="button"
                  className="mt-5 flex min-h-10 w-full items-center justify-center rounded-xl border border-[#dce8f0] bg-[#f8fbfd] px-4 py-2 text-xs font-semibold text-[#536b7f] transition hover:bg-white"
                >
                  Ver detalhes
                </button>
              </div>
            </article>
          ))}
        </section>

        <div className="mt-8 rounded-[24px] border border-white/80 bg-white/65 p-5 shadow-[0_12px_40px_rgba(48,81,107,0.05)] backdrop-blur-xl">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#eaf4fb] text-[#2f6f9f]">
              <Heart size={17} />
            </div>

            <div>
              <p className="text-sm font-semibold text-[#30475c]">
                Continue sua busca
              </p>
              <p className="mt-1 text-xs leading-5 text-[#718698]">
                O Concierge IA pode encontrar imóveis semelhantes aos que você
                salvou e ajudar a comparar suas opções.
              </p>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
