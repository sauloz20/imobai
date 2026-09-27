import {
  Bath,
  BedDouble,
  Building2,
  Edit3,
  Eye,
  Home,
  MapPin,
  Plus,
  Ruler,
  MoreHorizontal,
} from "lucide-react";

const properties = [
  {
    id: 1,
    title: "Apartamento moderno",
    location: "Centro, Montes Claros - MG",
    price: "R$ 420.000",
    type: "Apartamento",
    bedrooms: 3,
    bathrooms: 2,
    area: "92 m²",
    status: "Publicado",
    views: 128,
    image:
      "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=900&q=80",
  },
  {
    id: 2,
    title: "Casa com área externa",
    location: "Ibituruna, Montes Claros - MG",
    price: "R$ 680.000",
    type: "Casa",
    bedrooms: 4,
    bathrooms: 3,
    area: "186 m²",
    status: "Publicado",
    views: 94,
    image:
      "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=900&q=80",
  },
  {
    id: 3,
    title: "Apartamento compacto",
    location: "Todos os Santos, Montes Claros - MG",
    price: "R$ 285.000",
    type: "Apartamento",
    bedrooms: 2,
    bathrooms: 1,
    area: "64 m²",
    status: "Rascunho",
    views: 0,
    image:
      "https://images.unsplash.com/photo-1600566753190-17f0baa2a6c3?auto=format&fit=crop&w=900&q=80",
  },
];

const stats = [
  {
    label: "Meus imóveis",
    value: "3",
    description: "cadastrados",
    icon: Home,
  },
  {
    label: "Publicados",
    value: "2",
    description: "anúncios ativos",
    icon: Eye,
  },
  {
    label: "Visualizações",
    value: "222",
    description: "nos últimos anúncios",
    icon: Eye,
  },
];

export default function MyProperties() {
  return (
    <main className="min-h-screen bg-[#f5f9fc] px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-7 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-[#7b94a8]">
              Minha área
            </p>

            <h1 className="text-3xl font-semibold tracking-tight text-[#243b53] sm:text-4xl">
              Meus imóveis
            </h1>

            <p className="mt-2 max-w-2xl text-sm leading-6 text-[#64788a]">
              Gerencie seus imóveis, anúncios e informações de cada propriedade
              em um só lugar.
            </p>
          </div>

          <button
            type="button"
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#2f6f9f] px-4 py-2.5 text-sm font-semibold text-white shadow-[0_8px_22px_rgba(47,111,159,0.16)] transition hover:bg-[#285f89]"
          >
            <Plus size={17} />
            Adicionar imóvel
          </button>
        </div>

        <div className="mb-7 grid gap-3 sm:grid-cols-3">
          {stats.map(stat => {
            const Icon = stat.icon;

            return (
              <div
                key={stat.label}
                className="rounded-2xl border border-white/80 bg-white/65 p-4 shadow-[0_10px_35px_rgba(48,81,107,0.05)] backdrop-blur-xl"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-medium text-[#7b94a8]">
                      {stat.label}
                    </p>

                    <div className="mt-1 flex items-baseline gap-2">
                      <span className="text-2xl font-semibold tracking-tight text-[#243b53]">
                        {stat.value}
                      </span>
                      <span className="text-[10px] text-[#94a8b7]">
                        {stat.description}
                      </span>
                    </div>
                  </div>

                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#eaf4fb] text-[#2f6f9f]">
                    <Icon size={17} />
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <section>
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-[#30475c]">
                Seus anúncios
              </h2>
              <p className="mt-1 text-xs text-[#7b8f9f]">
                Acompanhe o desempenho das suas propriedades.
              </p>
            </div>

            <button
              type="button"
              className="hidden items-center gap-1.5 rounded-lg border border-[#dce8f0] bg-white/70 px-3 py-2 text-xs font-medium text-[#536b7f] transition hover:bg-white sm:flex"
            >
              Ver todos
              <MoreHorizontal size={14} />
            </button>
          </div>

          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {properties.map(property => (
              <article
                key={property.id}
                className="group overflow-hidden rounded-[24px] border border-white/80 bg-white shadow-[0_14px_45px_rgba(48,81,107,0.06)] transition hover:-translate-y-0.5 hover:shadow-[0_18px_50px_rgba(48,81,107,0.09)]"
              >
                <div className="relative aspect-[16/10] overflow-hidden bg-[#eaf1f5]">
                  <img
                    src={property.image}
                    alt={property.title}
                    className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.02]"
                  />

                  <div className="absolute left-3 top-3">
                    <span
                      className={
                        property.status === "Publicado"
                          ? "rounded-full border border-emerald-100 bg-white/90 px-2.5 py-1 text-[10px] font-semibold text-emerald-700 backdrop-blur"
                          : "rounded-full border border-amber-100 bg-white/90 px-2.5 py-1 text-[10px] font-semibold text-amber-700 backdrop-blur"
                      }
                    >
                      {property.status}
                    </span>
                  </div>

                  <button
                    type="button"
                    aria-label={`Mais opções para ${property.title}`}
                    className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-xl border border-white/70 bg-white/85 text-[#536b7f] backdrop-blur transition hover:bg-white"
                  >
                    <MoreHorizontal size={17} />
                  </button>
                </div>

                <div className="p-5">
                  <div className="mb-3 flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#8aa0b1]">
                        {property.type}
                      </p>

                      <h3 className="mt-1 truncate text-base font-semibold text-[#243b53]">
                        {property.title}
                      </h3>

                      <div className="mt-1.5 flex items-center gap-1.5 text-xs text-[#718698]">
                        <MapPin size={13} className="shrink-0" />
                        <span className="truncate">{property.location}</span>
                      </div>
                    </div>
                  </div>

                  <p className="text-xl font-semibold tracking-tight text-[#2f6f9f]">
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

                  <div className="mt-5 flex items-center justify-between border-t border-[#edf2f5] pt-4">
                    <span className="text-[11px] text-[#8aa0b1]">
                      {property.views} visualizações
                    </span>

                    <button
                      type="button"
                      className="inline-flex items-center gap-1.5 rounded-lg border border-[#dce8f0] bg-[#f8fbfd] px-3 py-2 text-[11px] font-semibold text-[#536b7f] transition hover:bg-white"
                    >
                      <Edit3 size={13} />
                      Editar
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>

        <div className="mt-6 rounded-2xl border border-[#dce9f2] bg-[#f8fbfd] px-4 py-3.5">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2.5">
              <Building2 size={16} className="text-[#2f6f9f]" />
              <p className="text-xs text-[#64788a]">
                Mantenha seus anúncios atualizados para oferecer uma melhor
                experiência aos interessados.
              </p>
            </div>

            <span className="text-[10px] font-medium text-[#8aa0b1]">
              ImobAI Marketplace
            </span>
          </div>
        </div>
      </div>
    </main>
  );
}
