import { useEffect, useState } from "react";
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
} from "lucide-react";
import { trpc } from "@/lib/trpc";

type Theme = "light" | "dark";

export default function SettingsPage() {
  const { data: preferences, isLoading } =
    trpc.auth.getPreferences.useQuery();

  const updatePreferences = trpc.auth.updatePreferences.useMutation();

  const [theme, setTheme] = useState<Theme>("light");
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [propertyAlerts, setPropertyAlerts] = useState(true);
  const [deviceNotifications, setDeviceNotifications] = useState(false);

  useEffect(() => {
    if (!preferences) return;

    setTheme(preferences.theme === "dark" ? "dark" : "light");
    setEmailNotifications(preferences.emailNotifications);
    setPropertyAlerts(preferences.propertyAlerts);
    setDeviceNotifications(preferences.deviceNotifications);
  }, [preferences]);

  const savePreference = (
    changes: Partial<{
      theme: Theme;
      emailNotifications: boolean;
      propertyAlerts: boolean;
      deviceNotifications: boolean;
    }>
  ) => {
    const next = {
      theme,
      emailNotifications,
      propertyAlerts,
      deviceNotifications,
      ...changes,
    };

    updatePreferences.mutate(next);
  };

  const toggleEmailNotifications = () => {
    const value = !emailNotifications;
    setEmailNotifications(value);
    savePreference({ emailNotifications: value });
  };

  const togglePropertyAlerts = () => {
    const value = !propertyAlerts;
    setPropertyAlerts(value);
    savePreference({ propertyAlerts: value });
  };

  const toggleDeviceNotifications = () => {
    const value = !deviceNotifications;
    setDeviceNotifications(value);
    savePreference({ deviceNotifications: value });
  };

  const changeTheme = () => {
    const value: Theme = theme === "light" ? "dark" : "light";
    setTheme(value);
    savePreference({ theme: value });
  };

  function Toggle({
    enabled,
    disabled = false,
  }: {
    enabled: boolean;
    disabled?: boolean;
  }) {
    return (
      <span
        className={`relative inline-flex h-6 w-11 shrink-0 rounded-full transition-colors ${
          enabled ? "bg-slate-900" : "bg-slate-300"
        } ${disabled ? "opacity-50" : ""}`}
      >
        <span
          className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-transform ${
            enabled ? "translate-x-5" : "translate-x-0.5"
          }`}
        />
      </span>
    );
  }

  const sections = [
    {
      title: "Aparência",
      description: "Ajuste a forma como o ImobAI aparece para você.",
      icon: Palette,
      items: [
        {
          icon: Moon,
          title: "Tema da interface",
          description:
            "Escolha entre o tema claro e o tema escuro da interface.",
          type: "theme" as const,
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
          type: "email" as const,
          enabled: emailNotifications,
          onToggle: toggleEmailNotifications,
        },
        {
          icon: Bell,
          title: "Alertas de novos imóveis",
          description:
            "Seja avisado quando aparecerem imóveis compatíveis com seus interesses.",
          type: "property" as const,
          enabled: propertyAlerts,
          onToggle: togglePropertyAlerts,
        },
        {
          icon: Smartphone,
          title: "Notificações no dispositivo",
          description:
            "Receba alertas diretamente enquanto estiver usando o ImobAI.",
          type: "device" as const,
          enabled: deviceNotifications,
          onToggle: toggleDeviceNotifications,
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
          description:
            "Revise as informações e mantenha sua conta protegida.",
          type: "action" as const,
          action: "Gerenciar",
        },
        {
          icon: Eye,
          title: "Privacidade",
          description:
            "Controle como seus dados são utilizados dentro do ImobAI.",
          type: "action" as const,
          action: "Gerenciar",
        },
      ],
    },
  ];

  return (
    <main className="min-h-screen bg-transparent px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl">
        <div className="mb-8">
          <p className="mb-2 text-sm font-medium text-slate-500">
            Configurações
          </p>

          <h1 className="text-3xl font-semibold tracking-tight text-slate-900">
            Preferências
          </h1>

          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
            Personalize sua experiência no ImobAI e controle como sua conta
            recebe informações.
          </p>
        </div>

        {isLoading ? (
          <div className="rounded-3xl border border-slate-200 bg-white/70 p-8 text-sm text-slate-500 shadow-sm backdrop-blur">
            Carregando suas preferências...
          </div>
        ) : (
          <div className="space-y-6">
            {sections.map((section) => {
              const SectionIcon = section.icon;

              return (
                <section
                  key={section.title}
                  className="overflow-hidden rounded-3xl border border-slate-200 bg-white/70 shadow-sm backdrop-blur"
                >
                  <div className="border-b border-slate-100 px-6 py-5">
                    <div className="flex items-start gap-4">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-slate-100 text-slate-700">
                        <SectionIcon size={19} />
                      </div>

                      <div>
                        <h2 className="text-base font-semibold text-slate-900">
                          {section.title}
                        </h2>

                        <p className="mt-1 text-sm text-slate-500">
                          {section.description}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="divide-y divide-slate-100">
                    {section.items.map((item) => {
                      const ItemIcon = item.icon;

                      return (
                        <div
                          key={item.title}
                          className="flex items-center justify-between gap-6 px-6 py-5"
                        >
                          <div className="flex min-w-0 items-start gap-4">
                            <div className="mt-0.5 text-slate-400">
                              <ItemIcon size={19} />
                            </div>

                            <div className="min-w-0">
                              <h3 className="text-sm font-medium text-slate-900">
                                {item.title}
                              </h3>

                              <p className="mt-1 max-w-2xl text-sm leading-5 text-slate-500">
                                {item.description}
                              </p>
                            </div>
                          </div>

                          {item.type === "theme" && (
                            <button
                              type="button"
                              onClick={changeTheme}
                              disabled={updatePreferences.isPending}
                              className="flex shrink-0 items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              {theme === "light" ? "Claro" : "Escuro"}
                              <ChevronRight size={16} />
                            </button>
                          )}

                          {(item.type === "email" ||
                            item.type === "property" ||
                            item.type === "device") && (
                            <button
                              type="button"
                              onClick={item.onToggle}
                              disabled={updatePreferences.isPending}
                              aria-label={`Alterar ${item.title}`}
                              className="shrink-0"
                            >
                              <Toggle
                                enabled={item.enabled}
                                disabled={updatePreferences.isPending}
                              />
                            </button>
                          )}

                          {item.type === "action" && (
                            <button
                              type="button"
                              className="flex shrink-0 items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
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
          </div>
        )}

        {updatePreferences.isError && (
          <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            Não foi possível salvar a preferência. Tente novamente.
          </div>
        )}

        {updatePreferences.isSuccess && (
          <div className="mt-4 text-right text-xs text-slate-400">
            Preferência salva.
          </div>
        )}
      </div>
    </main>
  );
}
