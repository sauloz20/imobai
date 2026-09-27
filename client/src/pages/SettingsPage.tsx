import {
  Bell,
  ChevronRight,
  Eye,
  LockKeyhole,
  Mail,
  Moon,
  Palette,
  ShieldCheck,
  Smartphone,
  UserRound,
} from "lucide-react";

const settingsSections = [
  {
    title: "Aparência",
    description: "Ajuste a forma como o ImobAI aparece para você.",
    icon: Palette,
    items: [
      {
        icon: Moon,
        title: "Tema da interface",
        description:
          "Use o tema claro e a experiência visual padrão do ImobAI.",
        value: "Claro",
      },
    ],
  },
  {
    title: "Notificações",
    description: "Escolha como deseja receber atualizações e avisos.",
    icon: Bell,
    items: [
      {
        icon: Mail,
        title: "Notificações por e-mail",
        description:
          "Receba novidades, atualizações e informações importantes.",
        enabled: true,
      },
      {
        icon: Bell,
        title: "Alertas de novos imóveis",
        description:
          "Seja avisado quando aparecerem imóveis compatíveis com seus interesses.",
        enabled: true,
      },
      {
        icon: Smartphone,
        title: "Notificações no dispositivo",
        description:
          "Receba alertas diretamente enquanto estiver usando o ImobAI.",
        enabled: false,
      },
    ],
  },
  {
    title: "Privacidade e segurança",
    description: "Gerencie a proteção e a visibilidade das suas informações.",
    icon: ShieldCheck,
    items: [
      {
        icon: LockKeyhole,
        title: "Segurança da conta",
        description: "Revise as informações e mantenha sua conta protegida.",
        action: "Gerenciar",
      },
      {
        icon: Eye,
        title: "Privacidade",
        description:
          "Controle como seus dados são utilizados dentro do ImobAI.",
        action: "Gerenciar",
      },
    ],
  },
];

function Toggle({ enabled }: { enabled: boolean }) {
  return (
    <span
      className={`relative inline-flex h-6 w-11 shrink-0 rounded-full transition-colors ${
        enabled ? "bg-[#2f6f9f]" : "bg-[#d9e4ec]"
      }`}
      aria-hidden="true"
    >
      <span
        className={`absolute top-1 h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${
          enabled ? "translate-x-6" : "translate-x-1"
        }`}
      />
    </span>
  );
}

export default function SettingsPage() {
  return (
    <main className="min-h-screen bg-[#f5f9fc] px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
      <div className="mx-auto max-w-5xl">
        <header className="mb-8">
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-[#7b94a8]">
            Preferências
          </p>
          <h1 className="text-3xl font-semibold tracking-tight text-[#243b53] sm:text-4xl">
            Configurações
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-[#64788a] sm:text-[15px]">
            Personalize sua experiência, notificações e preferências dentro do
            ImobAI.
          </p>
        </header>

        <div className="grid gap-6 lg:grid-cols-[240px_minmax(0,1fr)]">
          <aside className="h-fit rounded-2xl border border-white/80 bg-white/65 p-3 shadow-[0_12px_40px_rgba(48,81,107,0.06)] backdrop-blur-xl">
            <div className="flex items-center gap-3 rounded-xl bg-[#f8fbfd] px-4 py-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#eaf4fb] text-[#2f6f9f]">
                <UserRound size={19} />
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-[#243b53]">
                  Minha conta
                </p>
                <p className="text-xs text-[#7b94a8]">Preferências</p>
              </div>
            </div>

            <div className="mt-3 hidden space-y-1 lg:block">
              {settingsSections.map((section, index) => {
                const Icon = section.icon;

                return (
                  <div
                    key={section.title}
                    className={`flex items-center gap-3 rounded-xl px-4 py-3 text-sm ${
                      index === 0
                        ? "bg-[#eaf4fb] font-medium text-[#2f6f9f]"
                        : "text-[#64788a]"
                    }`}
                  >
                    <Icon size={17} />
                    <span>{section.title}</span>
                  </div>
                );
              })}
            </div>
          </aside>

          <div className="space-y-5">
            {settingsSections.map(section => {
              const SectionIcon = section.icon;

              return (
                <section
                  key={section.title}
                  className="overflow-hidden rounded-2xl border border-white/80 bg-white/70 shadow-[0_12px_40px_rgba(48,81,107,0.06)] backdrop-blur-xl"
                >
                  <div className="border-b border-[#e8f0f5] px-5 py-5 sm:px-6">
                    <div className="flex items-start gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#eaf4fb] text-[#2f6f9f]">
                        <SectionIcon size={19} />
                      </div>

                      <div>
                        <h2 className="text-base font-semibold text-[#243b53]">
                          {section.title}
                        </h2>
                        <p className="mt-1 text-sm leading-5 text-[#7b94a8]">
                          {section.description}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="divide-y divide-[#e8f0f5]">
                    {section.items.map(item => {
                      const ItemIcon = item.icon;

                      return (
                        <div
                          key={item.title}
                          className="flex items-center gap-4 px-5 py-4 sm:px-6"
                        >
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#f4f8fb] text-[#6d879a]">
                            <ItemIcon size={17} />
                          </div>

                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium text-[#30475c]">
                              {item.title}
                            </p>
                            <p className="mt-1 text-xs leading-5 text-[#7b94a8] sm:text-sm">
                              {item.description}
                            </p>
                          </div>

                          {"value" in item && (
                            <button
                              type="button"
                              className="flex shrink-0 items-center gap-1 rounded-lg px-2 py-2 text-sm font-medium text-[#2f6f9f] transition-colors hover:bg-[#f0f6fa]"
                            >
                              {item.value}
                              <ChevronRight size={16} />
                            </button>
                          )}

                          {"enabled" in item && (
                            <button
                              type="button"
                              className="shrink-0 rounded-full focus:outline-none focus:ring-2 focus:ring-[#2f6f9f]/30"
                              aria-label={`Alterar ${item.title}`}
                            >
                              <Toggle enabled={item.enabled} />
                            </button>
                          )}

                          {"action" in item && (
                            <button
                              type="button"
                              className="flex shrink-0 items-center gap-1 rounded-lg px-2 py-2 text-sm font-medium text-[#2f6f9f] transition-colors hover:bg-[#f0f6fa]"
                            >
                              {item.action}
                              <ChevronRight size={16} />
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </section>
              );
            })}

            <section className="rounded-2xl border border-[#dce9f2] bg-[#f8fbfd] p-5 sm:p-6">
              <div className="flex items-start gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white text-[#2f6f9f] shadow-sm">
                  <ShieldCheck size={18} />
                </div>

                <div>
                  <h2 className="text-sm font-semibold text-[#30475c]">
                    Suas preferências são salvas automaticamente
                  </h2>
                  <p className="mt-1 text-xs leading-5 text-[#7b94a8] sm:text-sm">
                    As configurações desta página serão aplicadas à sua
                    experiência no ImobAI.
                  </p>
                </div>
              </div>
            </section>
          </div>
        </div>
      </div>
    </main>
  );
}
