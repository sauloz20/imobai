import {
  Bot,
  Building2,
  ChevronRight,
  MapPin,
  MessageCircle,
  Search,
  Send,
  Sparkles,
  TrendingUp,
} from "lucide-react";

const suggestions = [
  "Encontre imóveis até R$ 500 mil",
  "Quero um apartamento em Montes Claros",
  "Compare dois imóveis para mim",
];

const features = [
  {
    icon: Search,
    title: "Busca inteligente",
    description: "Encontre imóveis usando linguagem natural.",
  },
  {
    icon: TrendingUp,
    title: "Análise imobiliária",
    description: "Compare preços, localização e características.",
  },
  {
    icon: MessageCircle,
    title: "Atendimento",
    description: "Converse com seu assistente imobiliário.",
  },
];

export default function Concierge() {
  return (
    <main className="min-h-screen bg-[#f5f9fc] px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-[#7b94a8]">
              ImobAI
            </p>

            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-semibold tracking-tight text-[#243b53] sm:text-4xl">
                Concierge IA
              </h1>

              <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-100 bg-emerald-50 px-2.5 py-1 text-[11px] font-medium text-emerald-700">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                Online
              </span>
            </div>

            <p className="mt-2 max-w-2xl text-sm leading-6 text-[#64788a]">
              Seu assistente inteligente para encontrar imóveis, comparar
              oportunidades e tomar decisões com mais segurança.
            </p>
          </div>

          <div className="hidden items-center gap-2 rounded-full border border-white/80 bg-white/65 px-3 py-2 text-xs text-[#64788a] shadow-[0_8px_30px_rgba(48,81,107,0.05)] backdrop-blur-xl sm:flex">
            <Sparkles size={14} className="text-[#2f6f9f]" />
            Inteligência imobiliária
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
          <section className="flex min-h-[620px] flex-col overflow-hidden rounded-[28px] border border-white/80 bg-white/65 shadow-[0_20px_60px_rgba(48,81,107,0.08)] backdrop-blur-xl">
            <div className="flex items-center gap-3 border-b border-[#e5edf4] bg-white/35 px-5 py-4 sm:px-6">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[#eaf4fb] text-[#2f6f9f]">
                <Bot size={20} />
              </div>

              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-[#243b53]">
                  Assistente ImobAI
                </p>
                <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-[#7b94a8]">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  Pronto para ajudar
                </div>
              </div>
            </div>

            <div className="flex-1 px-5 py-8 sm:px-8">
              <div className="mx-auto max-w-2xl">
                <div className="flex gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#eaf4fb] text-[#2f6f9f]">
                    <Sparkles size={17} />
                  </div>

                  <div className="max-w-xl rounded-[20px] rounded-tl-[6px] border border-white/90 bg-white/80 px-4 py-3.5 text-sm leading-6 text-[#30475c] shadow-[0_8px_28px_rgba(48,81,107,0.06)] backdrop-blur-xl">
                    <p className="font-medium text-[#243b53]">
                      Olá! Eu sou o Concierge IA do ImobAI.
                    </p>

                    <p className="mt-1 text-[#64788a]">
                      Posso ajudar você a encontrar imóveis, entender preços,
                      comparar opções ou explorar oportunidades de acordo com o
                      que procura.
                    </p>
                  </div>
                </div>

                <div className="mt-8">
                  <p className="mb-3 text-xs font-semibold uppercase tracking-[0.16em] text-[#7b94a8]">
                    Comece por aqui
                  </p>

                  <div className="grid gap-2 sm:grid-cols-3">
                    {suggestions.map(suggestion => (
                      <button
                        key={suggestion}
                        type="button"
                        className="group rounded-2xl border border-[#e5edf4] bg-white/75 p-3 text-left text-xs leading-5 text-[#536b7f] transition hover:border-[#c9dce9] hover:bg-white"
                      >
                        <span className="flex items-start justify-between gap-2">
                          {suggestion}
                          <ChevronRight
                            size={14}
                            className="mt-0.5 shrink-0 text-[#9aafbf] transition group-hover:translate-x-0.5 group-hover:text-[#2f6f9f]"
                          />
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="border-t border-[#e5edf4] bg-white/35 p-4 sm:p-5">
              <div className="mx-auto max-w-2xl">
                <div className="flex items-center gap-2 rounded-2xl border border-[#dce8f0] bg-white px-3 py-2 shadow-[0_8px_24px_rgba(48,81,107,0.05)]">
                  <input
                    type="text"
                    placeholder="Digite sua pergunta..."
                    className="min-w-0 flex-1 bg-transparent px-2 py-2 text-sm text-[#243b53] outline-none placeholder:text-[#9aafbf]"
                  />

                  <button
                    type="button"
                    aria-label="Enviar mensagem"
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#2f6f9f] text-white transition hover:bg-[#285f89]"
                  >
                    <Send size={16} />
                  </button>
                </div>

                <p className="mt-2 text-center text-[10px] text-[#94a8b7]">
                  O Concierge pode ajudar com buscas, comparações e informações
                  imobiliárias.
                </p>
              </div>
            </div>
          </section>

          <aside className="space-y-4">
            <div className="rounded-[24px] border border-white/80 bg-white/65 p-5 shadow-[0_16px_45px_rgba(48,81,107,0.06)] backdrop-blur-xl">
              <div className="mb-4 flex items-center gap-2">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#eaf4fb] text-[#2f6f9f]">
                  <Sparkles size={17} />
                </div>

                <div>
                  <p className="text-sm font-semibold text-[#243b53]">
                    O que posso fazer?
                  </p>
                  <p className="text-[11px] text-[#7b94a8]">
                    Recursos do Concierge
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                {features.map(feature => {
                  const Icon = feature.icon;

                  return (
                    <div
                      key={feature.title}
                      className="rounded-2xl border border-[#e5edf4] bg-white/75 p-3.5"
                    >
                      <div className="flex gap-3">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#f0f6fa] text-[#2f6f9f]">
                          <Icon size={15} />
                        </div>

                        <div>
                          <p className="text-xs font-semibold text-[#30475c]">
                            {feature.title}
                          </p>
                          <p className="mt-1 text-[11px] leading-5 text-[#7b8f9f]">
                            {feature.description}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="rounded-[24px] border border-[#dce9f2] bg-[#f8fbfd] p-5">
              <div className="flex items-start gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white text-[#2f6f9f] shadow-sm">
                  <Building2 size={17} />
                </div>

                <div>
                  <p className="text-sm font-semibold text-[#30475c]">
                    Busca personalizada
                  </p>

                  <p className="mt-1 text-xs leading-5 text-[#718698]">
                    Diga região, orçamento, tipo de imóvel e características. O
                    Concierge organiza a busca para você.
                  </p>
                </div>
              </div>

              <div className="mt-4 flex items-center gap-2 text-[11px] font-medium text-[#2f6f9f]">
                <MapPin size={13} />
                Pesquisa por localização
              </div>
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}
