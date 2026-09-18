import { SkyEnvironment } from "@/components/SkyEnvironment";
import { GlobalHeader } from "@/components/GlobalHeader";
import { AuthModal } from "@/components/AuthModal";
import { ConfirmDeleteDialog, ProfileModal } from "@/components/ProfileModal";
import { PropertyDetailsModal, type DetailProperty } from "@/components/PropertyDetailsModal";
import { PremiumImage } from "@/components/PremiumImage";
import { PropertyCard } from "@/components/PropertyCard";
import { fileToBase64, PropertyFormModal, type PropertyFormValues } from "@/components/PropertyFormModal";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Button as StatefulButton } from "@/components/ui/stateful-button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { SEARCH_SUGGESTIONS, getPropertyImage } from "@/lib/property";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import {
  ArrowRight,
  BadgeCheck,
  BarChart3,
  Bot,
  Building2,
  Check,
  ChevronRight,
  CircleDollarSign,
  Clock3,
  Compass,
  Loader2,
  Menu,
  MessageSquareText,
  PawPrint,
  Plus,
  Search,
  SearchX,
  ShieldCheck,
  Sparkles,
  Tags,
  TrendingUp,
  Users,
  X,
  MapPin,
  Home as HomeIcon,
  WalletCards,
} from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

type SearchParams = {
  finalidade: "compra" | "aluguel" | null;
  tipo: string | null;
  quartos: number | null;
  vagas: number | null;
  aceita_pets: boolean | null;
  varanda: boolean | null;
  ensolarado: boolean | null;
  cidade: string | null;
  bairro: string | null;
  valor_min: number | null;
  valor_max: number | null;
  diferenciais: string[];
  source?: "agent" | "fallback";
};

type PriceResult = {
  preco_sugerido_venda: number;
  preco_sugerido_aluguel: number;
  justificativa: string;
  faixa_recomendada: string;
  media_m2: number;
  similares: number;
  source: "agent" | "fallback";
};

const money = (value: number | string | null | undefined, compact = false) => {
  const numberValue = Number(value ?? 0);
  if (compact && numberValue >= 1_000_000) return `R$ ${(numberValue / 1_000_000).toFixed(2).replace(".", ",")} mi`;
  return numberValue.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
};

const EMPTY_PROPERTY_FORM: PropertyFormValues = {
  tipo: "Apartamento",
  bairro: "",
  cidade: "São Paulo",
  quartos: 2,
  banheiros: 1,
  vagas: 1,
  areaM2: 60,
  valorVenda: 0,
  valorAluguel: 0,
  descricaoTecnica: "",
  diferenciais: "",
};

const navItems = [
  { label: "Visão geral", icon: BarChart3, target: "overview" },
  { label: "Busca inteligente", icon: Search, target: "search" },
  { label: "Catálogo", icon: Building2, target: "catalog" },
  { label: "Minhas negociações", icon: MessageSquareText, target: "inbox" },
];

export default function Home() {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [finalidadeOverride, setFinalidadeOverride] = useState<"compra" | "aluguel" | null>(null);
  const [searchParams, setSearchParams] = useState<SearchParams | null>(null);
  const [interpretation, setInterpretation] = useState<SearchParams | null>(null);
  const [adForm, setAdForm] = useState({ tipo: "Apartamento", quartos: 3, bairro: "Pinheiros", diferenciais: "varanda, luz natural, aceita pets", preco: 1180000 });
  const [adResult, setAdResult] = useState<{ titulo_comercial: string; descricao_persuasiva: string; hashtags: string[]; source: "agent" | "fallback" } | null>(null);
  const [priceForm, setPriceForm] = useState({ tipo: "Apartamento", quartos: 3, bairro: "Pinheiros", areaM2: 96, diferenciais: "varanda, ensolarado" });
  const [priceResult, setPriceResult] = useState<PriceResult | null>(null);
  const [authMode, setAuthMode] = useState<"login" | "register">("login");
  const [authOpen, setAuthOpen] = useState(false);
  const [authForm, setAuthForm] = useState({ name: "", email: "", password: "" });
  const [propertyForm, setPropertyForm] = useState<PropertyFormValues>(EMPTY_PROPERTY_FORM);
  const [propertyFiles, setPropertyFiles] = useState<File[]>([]);
  const [propertyOpen, setPropertyOpen] = useState(false);
  const [propertyCopy, setPropertyCopy] = useState<{ titulo_comercial: string; descricao_persuasiva: string; destaques: string[]; cta: string; hashtags: string[]; source: "qwen" | "fallback" } | null>(null);
  const [aiText, setAiText] = useState("");
  const [pendingAiMessages, setPendingAiMessages] = useState<Array<{ id: string; conteudo: string; role: "user" | "assistant" }>>([]);
  const [selectedConversation, setSelectedConversation] = useState<number | null>(null);
  const [messageText, setMessageText] = useState("");
  const [detailsProperty, setDetailsProperty] = useState<DetailProperty | null>(null);
  const [editingProperty, setEditingProperty] = useState<DetailProperty | null>(null);
  const [deletingProperty, setDeletingProperty] = useState<DetailProperty | null>(null);
  const [profileOpen, setProfileOpen] = useState(false);

  const summary = trpc.dashboard.summary.useQuery();
  const auth = trpc.auth.me.useQuery();
  const utils = trpc.useUtils();
  const myProperties = trpc.property.mine.useQuery(undefined, { enabled: Boolean(auth.data) });
  const conversations = trpc.conversation.list.useQuery(undefined, { enabled: Boolean(auth.data) });
  const aiHistory = trpc.aiChat.history.useQuery(undefined, { enabled: Boolean(auth.data) });
  const conversationMessages = trpc.conversation.messages.useQuery({ conversaId: selectedConversation ?? 0 }, { enabled: Boolean(selectedConversation) });
  const propertiesInput = useMemo(() => {
    if (!searchParams) return {};
    return {
      finalidade: searchParams.finalidade || undefined,
      tipo: searchParams.tipo || undefined,
      cidade: searchParams.cidade || undefined,
      bairro: searchParams.bairro || undefined,
      quartos: searchParams.quartos || undefined,
      vagas: searchParams.vagas || undefined,
      valorMin: searchParams.valor_min || undefined,
      valorMax: searchParams.valor_max || undefined,
      aceitaPets: searchParams.aceita_pets || undefined,
      varanda: searchParams.varanda || undefined,
      ensolarado: searchParams.ensolarado || undefined,
    };
  }, [searchParams]);
  const properties = trpc.property.list.useQuery(propertiesInput);
  const parseSearch = trpc.agent.parseSearch.useMutation({
    onSuccess: result => {
      const merged = finalidadeOverride ? { ...result, finalidade: finalidadeOverride } : result;
      setInterpretation(merged);
      setSearchParams(merged);
      toast.success("Busca interpretada pelo ImobAI", { description: result.source === "agent" ? "Agente conectado" : "Modo demonstração ativo" });
    },
    onError: error => toast.error("Não foi possível interpretar a busca", { description: error.message }),
  });
  const generateAd = trpc.agent.generateAd.useMutation({
    onSuccess: result => {
      setAdResult(result);
      toast.success("Anúncio gerado em segundos");
    },
    onError: error => toast.error("Falha ao gerar anúncio", { description: error.message }),
  });
  const suggestPrice = trpc.agent.suggestPrice.useMutation({
    onSuccess: result => {
      setPriceResult(result);
      toast.success("Sugestão de preço calculada");
    },
    onError: error => toast.error("Falha ao sugerir preço", { description: error.message }),
  });
  const login = trpc.auth.login.useMutation({
    onSuccess: user => { utils.auth.me.setData(undefined, user); setAuthOpen(false); toast.success(`Bem-vindo, ${user.name || "ao ImobAI"}`); },
    onError: error => toast.error("Não foi possível entrar", { description: error.message }),
  });
  const register = trpc.auth.register.useMutation({
    onSuccess: user => { utils.auth.me.setData(undefined, user); setAuthOpen(false); toast.success("Conta criada com sucesso"); },
    onError: error => toast.error("Não foi possível criar a conta", { description: error.message }),
  });
  const logout = trpc.auth.logout.useMutation({ onSuccess: async () => { utils.auth.me.setData(undefined, null); await utils.auth.me.invalidate(); toast.success("Sessão encerrada"); } });
  const createProperty = trpc.property.create.useMutation({
    onError: error => toast.error("Não foi possível cadastrar o imóvel", { description: error.message }),
  });
  const generatePropertyCopy = trpc.property.generateCopy.useMutation({
    onSuccess: result => { setPropertyCopy(result); toast.success("Descrição comercial criada pelo Qwen"); },
    onError: error => toast.error("Não foi possível gerar a descrição", { description: error.message }),
  });
  const uploadPhotos = trpc.property.uploadPhotos.useMutation({
    onError: error => toast.error("O imóvel foi criado, mas algumas fotos não foram enviadas", { description: error.message }),
  });
  const updateProperty = trpc.property.update.useMutation({
    onSuccess: () => {
      setPropertyOpen(false);
      setEditingProperty(null);
      myProperties.refetch();
      toast.success("Imóvel atualizado com sucesso");
    },
    onError: error => toast.error("Não foi possível salvar as alterações", { description: error.message }),
  });
  const removeProperty = trpc.property.remove.useMutation({
    onSuccess: () => {
      setDeletingProperty(null);
      myProperties.refetch();
      toast.success("Imóvel excluído");
    },
    onError: error => toast.error("Não foi possível excluir o imóvel", { description: error.message }),
  });
  const updateProfile = trpc.auth.updateProfile.useMutation({
    onSuccess: user => {
      utils.auth.me.setData(undefined, user);
      setProfileOpen(false);
      toast.success("Perfil atualizado");
    },
    onError: error => toast.error("Não foi possível atualizar o perfil", { description: error.message }),
  });
  const startConversation = trpc.conversation.start.useMutation({
    onSuccess: conversation => { setSelectedConversation(conversation.id); conversations.refetch(); scrollTo("inbox"); toast.success("Negociação iniciada"); },
    onError: error => toast.error("Não foi possível iniciar a negociação", { description: error.message }),
  });
  const sendMessage = trpc.conversation.send.useMutation({ onSuccess: () => { setMessageText(""); conversationMessages.refetch(); conversations.refetch(); } });
  const sendAiMessage = trpc.aiChat.send.useMutation({
    onSuccess: result => {
      // Substitui o estado otimista pelo histórico real (mensagem do usuário + resposta da IA).
      setPendingAiMessages([]);
      setAiText("");
      utils.aiChat.history.setData(undefined, [...(aiHistory.data ?? []), result.message]);
      aiHistory.refetch();
    },
    onError: error => {
      setPendingAiMessages([]);
      toast.error("O Concierge não conseguiu responder agora", { description: error.message });
    },
  });

  const startEditProperty = (property: DetailProperty) => {
    setEditingProperty(property);
    setPropertyForm({
      tipo: String(property.tipo ?? "Apartamento"),
      bairro: String(property.bairro ?? ""),
      cidade: String(property.cidade ?? "São Paulo"),
      quartos: Number(property.quartos ?? 0),
      banheiros: Number(property.banheiros ?? 0),
      vagas: Number(property.vagas ?? 0),
      areaM2: Number(property.areaM2 ?? 0),
      valorVenda: Number(property.valorVenda ?? 0),
      valorAluguel: Number(property.valorAluguel ?? 0),
      descricaoTecnica: String(property.descricaoTecnica ?? ""),
      diferenciais: "",
    });
    setPropertyCopy(null);
    setPropertyFiles([]);
    setPropertyOpen(true);
  };

  const handlePropertyEditSubmit = async (): Promise<void> => {
    if (!editingProperty || !propertyForm.bairro.trim()) {
      toast.error("Informe o bairro do imóvel");
      return;
    }
    updateProperty.mutate({
      imovelId: editingProperty.id,
      tipo: propertyForm.tipo as "Apartamento" | "Casa" | "Sobrado" | "Terreno" | "Cobertura",
      bairro: propertyForm.bairro,
      cidade: propertyForm.cidade,
      quartos: Number(propertyForm.quartos),
      banheiros: Number(propertyForm.banheiros),
      vagas: Number(propertyForm.vagas),
      areaM2: Number(propertyForm.areaM2),
      valorVenda: propertyForm.valorVenda > 0 ? propertyForm.valorVenda : null,
      valorAluguel: propertyForm.valorAluguel > 0 ? propertyForm.valorAluguel : null,
      descricaoTecnica: propertyForm.descricaoTecnica || undefined,
      tituloAnuncio: propertyCopy?.titulo_comercial || undefined,
      descricaoIa: propertyCopy?.descricao_persuasiva || undefined,
    });
  };

  const handleDeleteProperty = () => {
    if (!deletingProperty) return;
    removeProperty.mutate({ imovelId: deletingProperty.id });
  };

  const handleSuggestPrice = () => {
    // FASE 2.3: nunca calcular com dados faltando, zero, negativo ou não numéricos.
    const bairro = priceForm.bairro.trim();
    const area = Number(priceForm.areaM2);
    if (!bairro) {
      toast.error("Preencha todos os campos necessários para realizar o cálculo.", { description: "Informe o bairro do imóvel." });
      return;
    }
    if (!Number.isFinite(area) || area <= 0) {
      toast.error("Preencha todos os campos necessários para realizar o cálculo.", { description: "A área (m²) deve ser um número maior que zero." });
      return;
    }
    suggestPrice.mutate({ ...priceForm, bairro, areaM2: area, diferenciais: priceForm.diferenciais.split(",").map(item => item.trim()).filter(Boolean) });
  };

  const scrollTo = (target: string) => {
    document.getElementById(target)?.scrollIntoView({ behavior: "smooth", block: "start" });
    setMobileNavOpen(false);
  };

  const interpretSearch = () => {
    if (searchText.trim().length < 3) return toast.error("Digite uma busca mais completa");
    parseSearch.mutate({ text: searchText });
  };

  const propertyList = properties.data ?? [];
  const featured = propertyList.slice(0, 12) as DetailProperty[];
  const allCatalog = (properties.data ?? []) as DetailProperty[];

  const validateRegistration = (values: { name: string; email: string; password: string }) => {
    const name = values.name.trim();
    const email = values.email.trim();
    if (name.length < 2) {
      toast.error("Informe seu nome completo", { description: "O nome precisa ter pelo menos 2 caracteres." });
      return null;
    }
    if (!/^\S+@\S+\.\S+$/.test(email)) {
      toast.error("Informe um email válido");
      return null;
    }
    if (values.password.length < 8) {
      toast.error("A senha é muito curta", { description: "Use pelo menos 8 caracteres." });
      return null;
    }
    return { name, email, password: values.password };
  };
  const submitInlineRegistration = () => {
    const input = validateRegistration(authForm);
    if (input) register.mutate(input);
  };
  const handleAuthModalSubmit = (values: { name: string; email: string; password: string }) => {
    if (authMode === "login") {
      login.mutate({ email: values.email, password: values.password });
      return;
    }
    const input = validateRegistration(values);
    if (input) register.mutate(input);
  };
  const handleAuthSubmitInline = () => {
    if (authMode === "login") login.mutate({ email: authForm.email, password: authForm.password });
    else submitInlineRegistration();
  };
  const handleGenerateCopy = () => {
    if (!propertyForm.bairro.trim()) return toast.error("Informe o bairro antes de gerar a descrição");
    generatePropertyCopy.mutate({
      ...propertyForm,
      tipo: propertyForm.tipo,
      areaM2: Number(propertyForm.areaM2),
      valorVenda: propertyForm.valorVenda || undefined,
      valorAluguel: propertyForm.valorAluguel || undefined,
      diferenciais: propertyForm.diferenciais.split(",").map(item => item.trim()).filter(Boolean),
    });
  };
  const handlePropertySubmit = async (): Promise<void> => {
    if (!propertyForm.bairro.trim()) {
      toast.error("Informe o bairro do imóvel");
      return;
    }
    try {
      const property = await createProperty.mutateAsync({
        ...propertyForm,
        tipo: propertyForm.tipo as "Apartamento" | "Casa" | "Sobrado" | "Terreno" | "Cobertura",
        diferenciais: propertyForm.diferenciais.split(",").map(item => item.trim()).filter(Boolean),
        valorVenda: propertyForm.valorVenda || undefined,
        valorAluguel: propertyForm.valorAluguel || undefined,
        aceitaPets: false,
        varanda: false,
        ensolarado: false,
        tituloAnuncio: propertyCopy?.titulo_comercial,
        descricaoIa: propertyCopy?.descricao_persuasiva,
      });
      if (propertyFiles.length) {
        const photos = await Promise.all(propertyFiles.map(async (file, index) => ({ name: file.name, mimeType: file.type, data: await fileToBase64(file), ordem: index })));
        await uploadPhotos.mutateAsync({ imovelId: property.id, photos });
      }
      setPropertyOpen(false);
      setPropertyFiles([]);
      setPropertyCopy(null);
      setPropertyForm(EMPTY_PROPERTY_FORM);
      myProperties.refetch();
      toast.success(`Imóvel publicado${propertyFiles.length ? ` com ${propertyFiles.length} fotos` : ""}`);
    } catch (error) {
      toast.error("Não foi possível concluir a publicação", { description: error instanceof Error ? error.message : "Tente novamente" });
    }
  };
  const handleAiSubmit = () => {
    const text = aiText.trim();
    if (!text) return;
    if (!auth.data) return setAuthOpen(true);
    if (sendAiMessage.isPending) return; // bloqueia envio duplicado enquanto a IA responde
    // Mensagem otimista: aparece imediatamente no chat, antes da resposta do servidor.
    setPendingAiMessages([{ id: `pending-${Date.now()}`, conteudo: text, role: "user" }]);
    sendAiMessage.mutate({ text, contexto: Object.keys(propertiesInput).length ? propertiesInput : undefined });
  };
  const negotiate = (property: any) => {
    if (!auth.data) return setAuthOpen(true);
    if (!property.ownerId) return toast.info("Este imóvel demonstrativo ainda não tem um proprietário cadastrado.");
    startConversation.mutate({ imovelId: property.id, proprietarioId: property.ownerId });
  };

  const openDetails = (property: DetailProperty) => setDetailsProperty(property);
  const similarProperties = detailsProperty
    ? allCatalog.filter(item => item.id !== detailsProperty.id && (item.bairro === detailsProperty.bairro || item.tipo === detailsProperty.tipo)).slice(0, 3)
    : [];

  return (
    <SkyEnvironment intensity="strong" className="min-h-screen">
      <div className="imobai-app-shell relative min-h-screen text-[#102033]">
      {!mobileNavOpen && (
        <GlobalHeader
          onLogin={() => {
            setAuthMode("login");
            setAuthOpen(true);
          }}
          onMenu={() => setMobileNavOpen(true)}
          onProfile={() => setProfileOpen(true)}
        />
      )}
      {/* ================= AppShell ================= */}
      <aside className={`fixed inset-y-0 left-0 z-40 hidden w-[254px] flex-col border-r border-[#172c45] bg-[#102033] text-white transition-transform duration-200 ${mobileNavOpen ? "translate-x-0" : "-translate-x-full"}`}>
        <div className="flex h-[84px] items-center border-b border-white/10 px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-[14px] bg-white text-[#102033] shadow-none"><Building2 size={20} strokeWidth={2.5} /></div>
            <div><div className="text-[19px] font-semibold tracking-[-0.04em]">Imob<span className="text-[#d7b56a]">AI</span></div><div className="mt-0.5 text-[10px] uppercase tracking-[0.19em] text-white/45">Real estate intelligence</div></div>
          </div>
          <button className="ml-auto rounded-lg p-1 text-white/50 hover:bg-white/10 hover:text-white lg:hidden" onClick={() => setMobileNavOpen(false)} aria-label="Fechar menu"><X size={18} /></button>
        </div>
        <div className="px-4 pt-7 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/35">Workspace</div>
        <nav className="mt-3 space-y-1 px-3">
          {navItems.map((item, index) => <button key={item.target} onClick={() => scrollTo(item.target)} className={`group flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-[13px] transition ${index === 0 ? "bg-white/10 text-white" : "text-white/60 hover:bg-white/[0.07] hover:text-white"}`}><item.icon size={17} className={index === 0 ? "text-[#d7b56a]" : "text-white/45 group-hover:text-[#d7b56a]"} /><span>{item.label}</span>{index === 0 && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-[#e7c984]" />}</button>)}
        </nav>
        <div className="mt-auto px-4 pb-5">
          <div className="mb-4 rounded-2xl border border-white/10 bg-white/[0.06] p-4"><div className="flex items-center gap-2 text-[11px] font-semibold text-[#d7b56a]"><span className="imobai-ai-pulse h-1.5 w-1.5 rounded-full bg-[#e7c984]" /> Agente IA online</div><p className="mt-2 text-[12px] leading-5 text-white/50">Pronto para interpretar buscas, gerar copy e sugerir valores.</p></div>
          <button type="button" onClick={() => (auth.data ? setProfileOpen(true) : (setAuthMode("login"), setAuthOpen(true)))} className="flex w-full items-center gap-3 border-t border-white/10 pt-4 text-left transition hover:opacity-90"><div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#dbe8f5] text-[12px] font-bold text-[#0b1f3a]">{(auth.data?.name || auth.data?.email || "U").trim().slice(0, 2).toUpperCase()}</div><div className="min-w-0"><div className="truncate text-[12px] font-semibold">{auth.data?.name || auth.data?.email || "Usuário"}</div><div className="truncate text-[11px] text-white/40">{auth.data ? "Meu perfil · sessão ativa" : "Entrar na minha conta"}</div></div><ChevronRight size={15} className="ml-auto text-white/30" /></button>
        </div>
      </aside>
      <main className="relative z-10">
        {mobileNavOpen && (
  <div className="fixed inset-0 z-[100]">
    <button
      type="button"
      aria-label="Fechar menu"
      onClick={() => setMobileNavOpen(false)}
      className="absolute inset-0 bg-[#123b5d]/20 backdrop-blur-[2px]"
    />

    <aside className="absolute right-0 top-0 bottom-0 z-[110] flex w-[330px] max-w-[88vw] flex-col bg-white shadow-[-12px_0_40px_rgba(18,59,93,0.16)]">

      <div className="flex h-[76px] items-center justify-between border-b border-[#e7eff4] px-6">
        <div>
          <div className="text-[17px] font-bold tracking-[-0.03em] text-[#123b5d]">
            Imob<span className="text-[#2f6f9f]">AI</span>
          </div>
          <div className="mt-0.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-[#8aa0b2]">
            Navegação
          </div>
        </div>

        <button
          type="button"
          onClick={() => setMobileNavOpen(false)}
          aria-label="Fechar menu"
          className="flex h-9 w-9 items-center justify-center rounded-full bg-[#f1f6fa] text-[#527084] transition hover:bg-[#e7f0f5]"
        >
          <X size={18} />
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto px-4 py-5">

        <a
          href="/"
          onClick={() => setMobileNavOpen(false)}
          className="flex items-center gap-3 rounded-xl bg-[#f1f6fa] px-4 py-3 text-[13px] font-semibold text-[#123b5d]"
        >
          <Building2 size={18} className="text-[#2f6f9f]" />
          Início
        </a>

        <a
          href="/catalogo"
          onClick={() => setMobileNavOpen(false)}
          className="mt-1 flex items-center gap-3 rounded-xl px-4 py-3 text-[13px] font-medium text-[#526577] transition hover:bg-[#f1f6fa] hover:text-[#2f6f9f]"
        >
          <HomeIcon size={18} />
          Comprar imóveis
        </a>

        <a
          href="/catalogo"
          onClick={() => setMobileNavOpen(false)}
          className="flex items-center gap-3 rounded-xl px-4 py-3 text-[13px] font-medium text-[#526577] transition hover:bg-[#f1f6fa] hover:text-[#2f6f9f]"
        >
          <Tags size={18} />
          Alugar imóveis
        </a>

        <div className="my-4 h-px bg-[#e7eff4]" />

        <button
          type="button"
          onClick={() => {
            setMobileNavOpen(false);
            if (auth.data) {
              setPropertyOpen(true);
            } else {
              setAuthMode("register");
              setAuthOpen(true);
            }
          }}
          className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left text-[13px] font-medium text-[#526577] transition hover:bg-[#f1f6fa] hover:text-[#2f6f9f]"
        >
          <Plus size={18} />
          Anunciar imóvel
        </button>

        <button
          type="button"
          onClick={() => setMobileNavOpen(false)}
          className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left text-[13px] font-medium text-[#526577] transition hover:bg-[#f1f6fa] hover:text-[#2f6f9f]"
        >
          <MessageSquareText size={18} />
          Mensagens
        </button>

        <button
          type="button"
          onClick={() => setMobileNavOpen(false)}
          className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left text-[13px] font-medium text-[#526577] transition hover:bg-[#f1f6fa] hover:text-[#2f6f9f]"
        >
          <Bot size={18} />
          Concierge IA
        </button>

        <button
          type="button"
          onClick={() => setMobileNavOpen(false)}
          className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left text-[13px] font-medium text-[#526577] transition hover:bg-[#f1f6fa] hover:text-[#2f6f9f]"
        >
          <BarChart3 size={18} />
          Meus imóveis
        </button>

        <button
          type="button"
          onClick={() => setMobileNavOpen(false)}
          className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left text-[13px] font-medium text-[#526577] transition hover:bg-[#f1f6fa] hover:text-[#2f6f9f]"
        >
          <BadgeCheck size={18} />
          Favoritos
        </button>

        <button
          type="button"
          onClick={() => setMobileNavOpen(false)}
          className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left text-[13px] font-medium text-[#526577] transition hover:bg-[#f1f6fa] hover:text-[#2f6f9f]"
        >
          <Users size={18} />
          Minha conta
        </button>

        <button
          type="button"
          onClick={() => setMobileNavOpen(false)}
          className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left text-[13px] font-medium text-[#526577] transition hover:bg-[#f1f6fa] hover:text-[#2f6f9f]"
        >
          <WalletCards size={18} />
          Configurações
        </button>

      </nav>

      <div className="border-t border-[#e7eff4] p-5">
        {auth.data ? (
          <button
            type="button"
            onClick={() => {
              setMobileNavOpen(false);
              logout.mutate();
            }}
            className="w-full rounded-xl border border-[#dce7ef] bg-white px-4 py-3 text-[12px] font-semibold text-[#456177] transition hover:bg-[#f7fafc]"
          >
            Sair da conta
          </button>
        ) : (
          <button
            type="button"
            onClick={() => {
              setMobileNavOpen(false);
              setAuthMode("login");
              setAuthOpen(true);
            }}
            className="w-full rounded-xl bg-[#2f6f9f] px-4 py-3 text-[12px] font-semibold text-white transition hover:bg-[#275f88]"
          >
            Entrar na conta
          </button>
        )}
      </div>

    </aside>
  </div>
)}

        <div className="mx-auto max-w-[1440px] px-5 pb-16 sm:px-8 lg:px-10">
          {/* ================= Hero principal ================= */}
          <section
            id="overview"
            className="relative flex min-h-[calc(100vh-72px)] items-center justify-center overflow-hidden rounded-b-[42px] px-5 py-24 text-center sm:px-8 lg:min-h-[calc(100vh-72px)]"
          ><div className="relative z-10 mx-auto w-full max-w-[1050px]">

              <h1
                className="mx-auto max-w-[900px] font-['Nunito'] text-[44px] font-800 leading-[0.98] tracking-[-0.055em] text-white sm:text-[64px] lg:text-[78px]"
                style={{
                  textShadow: "0 4px 18px rgba(15, 45, 65, 0.35)",
                }}
              >
                Encontre o imóvel
                <span className="block">ideal para você</span>
              </h1>

              <div id="search" className="mx-auto mt-9 w-full max-w-[760px] scroll-mt-24">
                <div className="flex h-[62px] items-center rounded-full bg-white px-5 shadow-[0_10px_35px_rgba(25,75,105,0.14)]">
                  <Search size={19} className="mr-3 shrink-0 text-[#6f91a6]" />

                  <input
                    value={searchText}
                    onChange={event => setSearchText(event.target.value)}
                    onKeyDown={event => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        interpretSearch();
                      }
                    }}
                    placeholder="Busque por cidade, bairro ou tipo de imóvel..."
                    className="min-w-0 flex-1 !border-0 !outline-none !ring-0 !shadow-none bg-transparent text-[14px] text-[#29485d] focus:!border-0 focus:!outline-none focus:!ring-0 focus:!shadow-none focus-visible:!border-0 focus-visible:!outline-none focus-visible:!ring-0 focus-visible:!shadow-none placeholder:text-[#9aadb9]"
                  />

                  <StatefulButton
                    onClick={interpretSearch}
                    disabled={parseSearch.isPending}
                    className="ml-3 h-[44px] shrink-0 rounded-full bg-[#2f6f9f] px-6 text-[12px] font-semibold text-white transition hover:bg-[#285f87]"
                  >
                    {parseSearch.isPending ? (
                      <>
                        <Loader2 className="animate-spin" size={14} />
                        Buscando
                      </>
                    ) : (
                      "Buscar"
                    )}
                  </StatefulButton>
                </div>
                <div className="mt-4 flex flex-wrap justify-center gap-2">
                  {SEARCH_SUGGESTIONS.slice(0, 4).map(suggestion => (
                    <button
                      key={suggestion}
                      type="button"
                      onClick={() => setSearchText(suggestion)}
                      className="rounded-full border border-white/30 bg-white/10 px-3 py-1.5 text-[10px] font-semibold text-white/85 backdrop-blur-sm hover:border-white/60 hover:bg-white/20"
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
            </div>
          </div>
        </section>
          {/* ================= Busca inteligente ================= */}          
          {/* ================= Imóveis em destaque ================= */}
          <section id="catalog" className="imobai-reveal mt-8 scroll-mt-24 px-1 sm:mt-12">
            <div className="mx-auto max-w-[1240px]">
              <div className="mb-7 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/75">
                    Seleção ImobAI
                  </div>
                  <h2 className="mt-1 text-[28px] font-semibold tracking-[-0.045em] text-white drop-shadow-[0_2px_12px_rgba(20,61,87,0.18)] sm:text-[34px]">
                    Imóveis em destaque
                  </h2>
                  <p className="mt-2 max-w-[560px] text-[13px] leading-6 text-white/85">
                    Encontre casas, apartamentos e espaços selecionados para você.
                  </p>
                </div>

                <a
                  href="/catalogo"
                  className="inline-flex w-fit items-center gap-1.5 rounded-full bg-white/95 px-4 py-2.5 text-[11px] font-semibold text-[#2f6f9f] shadow-[0_8px_24px_rgba(25,75,105,0.12)] transition hover:bg-white"
                >
                  Explorar catálogo
                  <ArrowRight size={13} />
                </a>
              </div>

              {summary.isLoading || properties.isLoading ? (
                <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
                  {Array.from({ length: 12 }).map((_, index) => (
                    <ResultSkeleton key={index} />
                  ))}
                </div>
              ) : featured.length ? (
                <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
                  {featured.map((property, index) => (
                    <div
                      key={property.id}
                      className="imobai-reveal"
                      style={{ animationDelay: `${index * 70}ms` }}
                    >
                      <PropertyCard
                        property={{
                          ...property,
                          recommended: index === 0,
                        }}
                        onOpenDetails={() => openDetails(property)}
                      />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-[24px] border border-white/40 bg-white/15 p-10 text-center backdrop-blur-sm">
                  <Building2 className="mx-auto text-white/80" size={28} />
                  <p className="mt-3 text-[13px] text-white/80">
                    Ainda não há imóveis disponíveis para destaque.
                  </p>
                </div>
              )}
            </div>
          </section>
        </div>
      </main>

      {/* ================= Modais ================= */}
      <AuthModal open={authOpen} mode={authMode} onModeChange={setAuthMode} onClose={() => setAuthOpen(false)} onSubmit={handleAuthModalSubmit} pending={login.isPending || register.isPending} />

      <PropertyFormModal
        open={propertyOpen}
        mode={editingProperty ? "edit" : "create"}
        onClose={() => { setPropertyOpen(false); setEditingProperty(null); }}
        values={propertyForm}
        onValuesChange={setPropertyForm}
        files={propertyFiles}
        onFilesChange={setPropertyFiles}
        copy={propertyCopy}
        onCopyChange={setPropertyCopy}
        onGenerateCopy={handleGenerateCopy}
        generatingCopy={generatePropertyCopy.isPending}
        onSubmit={editingProperty ? handlePropertyEditSubmit : handlePropertySubmit}
        submitting={editingProperty ? updateProperty.isPending : createProperty.isPending || uploadPhotos.isPending}
      />

      <ProfileModal
        open={profileOpen}
        onClose={() => setProfileOpen(false)}
        user={auth.data}
        onSave={values => updateProfile.mutate(values)}
        onLogout={() => { setProfileOpen(false); logout.mutate(); }}
        saving={updateProfile.isPending}
      />

      <ConfirmDeleteDialog
        open={Boolean(deletingProperty)}
        propertyTitle={deletingProperty?.tituloAnuncio || deletingProperty?.bairro || ""}
        onCancel={() => setDeletingProperty(null)}
        onConfirm={handleDeleteProperty}
        pending={removeProperty.isPending}
      />

      <PropertyDetailsModal
        property={detailsProperty}
        onClose={() => setDetailsProperty(null)}
        onNegotiate={negotiate}
        similar={similarProperties}
        onSelectSimilar={item => setDetailsProperty(item as DetailProperty)}
      />
      </div>
    </SkyEnvironment>
  );
}

function buildCatalogUrl(params: SearchParams): string {
  const query = new URLSearchParams();
  if (params.finalidade) query.set("f", params.finalidade);
  if (params.tipo) query.set("t", params.tipo);
  if (params.bairro) query.set("b", params.bairro);
  if (params.cidade) query.set("c", params.cidade);
  if (params.quartos) query.set("q", String(params.quartos));
  if (params.vagas) query.set("v", String(params.vagas));
  if (params.valor_min) query.set("min", String(params.valor_min));
  if (params.valor_max) query.set("max", String(params.valor_max));
  if (params.aceita_pets) query.set("pets", "1");
  if (params.varanda) query.set("var", "1");
  if (params.ensolarado) query.set("sol", "1");
  const qs = query.toString();
  return qs ? `?${qs}` : "";
}

function ResultSkeleton() {
  return (
    <div className="overflow-hidden rounded-[22px] border border-[#e7ecf2] bg-white">
      <Skeleton className="aspect-[4/3] w-full rounded-none" />
      <div className="space-y-2.5 p-5">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-3 w-1/2" />
        <Skeleton className="h-3 w-2/3" />
        <Skeleton className="h-6 w-1/3" />
      </div>
    </div>
  );
}

function ParseChip({ label, value, icon: Icon }: { label: string; value: string; icon?: typeof PawPrint }) {
  return <div className="rounded-xl border border-[#e7ecf2] bg-white px-3 py-2.5"><div className="flex items-center gap-1.5 text-[10px] text-[#9aa7b5]">{Icon && <Icon size={11} />} {label}</div><div className="mt-1 truncate text-[12px] font-semibold text-[#304258]">{value}</div></div>;
}

function SectionHeader({ icon: Icon, eyebrow, title, description, dark = false }: { icon: typeof Tags; eyebrow: string; title: string; description: string; dark?: boolean }) {
  return <div className="flex items-start gap-3"><div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${dark ? "bg-white/10 text-[#d7b56a]" : "bg-[#fff5df] text-[#8a6110]"}`}><Icon size={17} /></div><div><div className={`text-[10px] font-bold uppercase tracking-[0.14em] ${dark ? "text-[#d7b56a]" : "text-[#8a6110]"}`}>{eyebrow}</div><h2 className={`mt-1 text-[17px] font-semibold tracking-[-0.025em] ${dark ? "text-white" : "text-[#22364d]"}`}>{title}</h2><p className={`mt-1 text-[12px] ${dark ? "text-white/50" : "text-[#656e79]"}`}>{description}</p></div></div>;
}

function Field({ label, children, className = "", dark = false }: { label: string; children: React.ReactNode; className?: string; dark?: boolean }) {
  return <label className={`block ${className}`}><span className={`mb-1.5 block text-[10px] font-semibold uppercase tracking-[0.11em] ${dark ? "text-white/45" : "text-[#656e79]"}`}>{label}</span>{children}</label>;
}

function MarketBar({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  return <div><div className="mb-1.5 flex items-center justify-between text-[11px]"><span className="font-medium text-[#596c80]">{label}</span><span className="font-semibold text-[#314861]">{money(value)}/m²</span></div><div className="h-2 overflow-hidden rounded-full bg-[#edf1f5]"><div className="h-full rounded-full transition-all" style={{ width: `${Math.min(100, Math.round((value / max) * 100))}%`, backgroundColor: color }} /></div></div>;
}


























































