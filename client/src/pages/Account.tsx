import {
  Bell,
  ChevronRight,
  Edit3,
  Mail,
  MapPin,
  Phone,
  ShieldCheck,
  UserRound,
} from "lucide-react";

const profileItems = [
  {
    label: "Nome completo",
    value: "Saulo Gabriel",
    icon: UserRound,
  },
  {
    label: "E-mail",
    value: "seuemail@exemplo.com",
    icon: Mail,
  },
  {
    label: "Telefone",
    value: "(38) 9 0000-0000",
    icon: Phone,
  },
  {
    label: "Localização",
    value: "Montes Claros, MG",
    icon: MapPin,
  },
];

const accountOptions = [
  {
    title: "Notificações",
    description: "Receba atualizações sobre imóveis e mensagens.",
    icon: Bell,
  },
  {
    title: "Privacidade e segurança",
    description: "Gerencie acesso, segurança e informações da conta.",
    icon: ShieldCheck,
  },
];

export default function Account() {
  return (
    <main className="min-h-screen bg-[#f5f9fc] px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <div className="mb-7">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-[#7b94a8]">
            Perfil
          </p>

          <h1 className="text-3xl font-semibold tracking-tight text-[#243b53] sm:text-4xl">
            Minha conta
          </h1>

          <p className="mt-2 max-w-2xl text-sm leading-6 text-[#64788a]">
            Gerencie seus dados pessoais, preferências e informações da sua
            conta no ImobAI.
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
          <aside className="space-y-4">
            <section className="rounded-[24px] border border-white/80 bg-white/65 p-6 shadow-[0_16px_45px_rgba(48,81,107,0.06)] backdrop-blur-xl">
              <div className="flex flex-col items-center text-center">
                <div className="flex h-24 w-24 items-center justify-center rounded-[28px] bg-[linear-gradient(145deg,#eaf4fb,#dbeaf4)] text-3xl font-semibold text-[#2f6f9f] shadow-inner">
                  SG
                </div>

                <h2 className="mt-4 text-lg font-semibold text-[#243b53]">
                  Saulo Gabriel
                </h2>

                <p className="mt-1 text-xs text-[#7b8f9f]">Usuário ImobAI</p>

                <button
                  type="button"
                  className="mt-5 inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-[#dce8f0] bg-white px-4 py-2 text-xs font-semibold text-[#536b7f] transition hover:bg-[#f8fbfd]"
                >
                  <Edit3 size={14} />
                  Editar perfil
                </button>
              </div>
            </section>

            <section className="rounded-[24px] border border-[#dce9f2] bg-[#f8fbfd] p-5">
              <div className="flex items-start gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white text-[#2f6f9f] shadow-sm">
                  <ShieldCheck size={17} />
                </div>

                <div>
                  <p className="text-sm font-semibold text-[#30475c]">
                    Conta protegida
                  </p>

                  <p className="mt-1 text-xs leading-5 text-[#718698]">
                    Suas informações são usadas para personalizar sua
                    experiência no ImobAI.
                  </p>
                </div>
              </div>
            </section>
          </aside>

          <div className="space-y-5">
            <section className="rounded-[24px] border border-white/80 bg-white/65 p-5 shadow-[0_12px_40px_rgba(48,81,107,0.05)] backdrop-blur-xl sm:p-6">
              <div className="mb-5">
                <p className="text-sm font-semibold text-[#30475c]">
                  Informações pessoais
                </p>

                <p className="mt-1 text-xs text-[#7b8f9f]">
                  Dados utilizados no seu perfil e atendimento.
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                {profileItems.map(item => {
                  const Icon = item.icon;

                  return (
                    <div
                      key={item.label}
                      className="rounded-2xl border border-[#e5edf4] bg-white/75 p-4"
                    >
                      <div className="flex items-start gap-3">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#f0f6fa] text-[#2f6f9f]">
                          <Icon size={16} />
                        </div>

                        <div className="min-w-0">
                          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#8aa0b1]">
                            {item.label}
                          </p>

                          <p className="mt-1 truncate text-sm font-medium text-[#30475c]">
                            {item.value}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>

            <section className="rounded-[24px] border border-white/80 bg-white/65 p-5 shadow-[0_12px_40px_rgba(48,81,107,0.05)] backdrop-blur-xl sm:p-6">
              <div className="mb-4">
                <p className="text-sm font-semibold text-[#30475c]">
                  Preferências e segurança
                </p>

                <p className="mt-1 text-xs text-[#7b8f9f]">
                  Controle como o ImobAI se comunica com você.
                </p>
              </div>

              <div className="divide-y divide-[#edf2f5]">
                {accountOptions.map(option => {
                  const Icon = option.icon;

                  return (
                    <button
                      key={option.title}
                      type="button"
                      className="flex w-full items-center gap-3 py-4 text-left transition hover:bg-white/40"
                    >
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#f0f6fa] text-[#2f6f9f]">
                        <Icon size={16} />
                      </div>

                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-[#30475c]">
                          {option.title}
                        </p>

                        <p className="mt-1 text-xs leading-5 text-[#7b8f9f]">
                          {option.description}
                        </p>
                      </div>

                      <ChevronRight
                        size={17}
                        className="shrink-0 text-[#9aafbf]"
                      />
                    </button>
                  );
                })}
              </div>
            </section>

            <section className="rounded-[24px] border border-[#dce9f2] bg-[#f8fbfd] p-5">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-semibold text-[#30475c]">
                    Sua experiência no ImobAI
                  </p>
                  <p className="mt-1 text-xs text-[#718698]">
                    Personalize sua conta para encontrar imóveis de forma mais
                    rápida.
                  </p>
                </div>

                <span className="text-[10px] font-medium text-[#8aa0b1]">
                  Perfil ativo
                </span>
              </div>
            </section>
          </div>
        </div>
      </div>
    </main>
  );
}
