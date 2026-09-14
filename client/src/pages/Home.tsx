import { CloudShader } from "@/components/ui/cloud-shader";
import { AuthModal } from "@/components/AuthModal";
import { ConfirmDeleteDialog, ProfileModal } from "@/components/ProfileModal";
import { PropertyDetailsModal, type DetailProperty } from "@/components/PropertyDetailsModal";
import { PremiumImage } from "@/components/PremiumImage";
import { PropertyCard } from "@/components/PropertyCard";
import { fileToBase64, PropertyFormModal, type PropertyFormValues } from "@/components/PropertyFormModal";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Button as StatefulButton } from "@/components/ui/stateful-button";
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
  cidade: "SÃ£o Paulo",
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
  { label: "VisÃ£o geral", icon: BarChart3, target: "overview" },
  { label: "Busca inteligente", icon: Search, target: "search" },
  { label: "CatÃ¡logo", icon: Building2, target: "catalog" },
  { label: "PrecificaÃ§Ã£o", icon: CircleDollarSign, target: "pricing" },
  { label: "Minhas negociaÃ§Ãµes", icon: MessageSquareText, target: "inbox" },
  { label: "Concierge Qwen", icon: Bot, target: "ai-chat" },
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
      toast.success("Busca interpretada pelo ImobAI", { description: result.source === "agent" ? "Agente conectado" : "Modo demonstraÃ§Ã£o ativo" });
    },
    onError: error => toast.error("NÃ£o foi possÃ­vel interpretar a busca", { description: error.message }),
  });
  const generateAd = trpc.agent.generateAd.useMutation({
    onSuccess: result => {
      setAdResult(result);
      toast.success("AnÃºncio gerado em segundos");
    },
    onError: error => toast.error("Falha ao gerar anÃºncio", { description: error.message }),
  });
  const suggestPrice = trpc.agent.suggestPrice.useMutation({
    onSuccess: result => {
      setPriceResult(result);
      toast.success("SugestÃ£o de preÃ§o calculada");
    },
    onError: error => toast.error("Falha ao sugerir preÃ§o", { description: error.message }),
  });
  const login = trpc.auth.login.useMutation({
    onSuccess: user => { utils.auth.me.setData(undefined, user); setAuthOpen(false); toast.success(`Bem-vindo, ${user.name || "ao ImobAI"}`); },
    onError: error => toast.error("NÃ£o foi possÃ­vel entrar", { description: error.message }),
  });
  const register = trpc.auth.register.useMutation({
    onSuccess: user => { utils.auth.me.setData(undefined, user); setAuthOpen(false); toast.success("Conta criada com sucesso"); },
    onError: error => toast.error("NÃ£o foi possÃ­vel criar a conta", { description: error.message }),
  });
  const logout = trpc.auth.logout.useMutation({ onSuccess: async () => { utils.auth.me.setData(undefined, null); await utils.auth.me.invalidate(); toast.success("SessÃ£o encerrada"); } });
  const createProperty = trpc.property.create.useMutation({
    onError: error => toast.error("NÃ£o foi possÃ­vel cadastrar o imÃ³vel", { description: error.message }),
  });
  const generatePropertyCopy = trpc.property.generateCopy.useMutation({
    onSuccess: result => { setPropertyCopy(result); toast.success("DescriÃ§Ã£o comercial criada pelo Qwen"); },
    onError: error => toast.error("NÃ£o foi possÃ­vel gerar a descriÃ§Ã£o", { description: error.message }),
  });
  const uploadPhotos = trpc.property.uploadPhotos.useMutation({
    onError: error => toast.error("O imÃ³vel foi criado, mas algumas fotos nÃ£o foram enviadas", { description: error.message }),
  });
  const updateProperty = trpc.property.update.useMutation({
    onSuccess: () => {
      setPropertyOpen(false);
      setEditingProperty(null);
      myProperties.refetch();
      toast.success("ImÃ³vel atualizado com sucesso");
    },
    onError: error => toast.error("NÃ£o foi possÃ­vel salvar as alteraÃ§Ãµes", { description: error.message }),
  });
  const removeProperty = trpc.property.remove.useMutation({
    onSuccess: () => {
      setDeletingProperty(null);
      myProperties.refetch();
      toast.success("ImÃ³vel excluÃ­do");
    },
    onError: error => toast.error("NÃ£o foi possÃ­vel excluir o imÃ³vel", { description: error.message }),
  });
  const updateProfile = trpc.auth.updateProfile.useMutation({
    onSuccess: user => {
      utils.auth.me.setData(undefined, user);
      setProfileOpen(false);
      toast.success("Perfil atualizado");
    },
    onError: error => toast.error("NÃ£o foi possÃ­vel atualizar o perfil", { description: error.message }),
  });
  const startConversation = trpc.conversation.start.useMutation({
    onSuccess: conversation => { setSelectedConversation(conversation.id); conversations.refetch(); scrollTo("inbox"); toast.success("NegociaÃ§Ã£o iniciada"); },
    onError: error => toast.error("NÃ£o foi possÃ­vel iniciar a negociaÃ§Ã£o", { description: error.message }),
  });
  const sendMessage = trpc.conversation.send.useMutation({ onSuccess: () => { setMessageText(""); conversationMessages.refetch(); conversations.refetch(); } });
  const sendAiMessage = trpc.aiChat.send.useMutation({
    onSuccess: result => {
      // Substitui o estado otimista pelo histÃ³rico real (mensagem do usuÃ¡rio + resposta da IA).
      setPendingAiMessages([]);
      setAiText("");
      utils.aiChat.history.setData(undefined, [...(aiHistory.data ?? []), result.message]);
      aiHistory.refetch();
    },
    onError: error => {
      setPendingAiMessages([]);
      toast.error("O Concierge nÃ£o conseguiu responder agora", { description: error.message });
    },
  });

  const startEditProperty = (property: DetailProperty) => {
    setEditingProperty(property);
    setPropertyForm({
      tipo: String(property.tipo ?? "Apartamento"),
      bairro: String(property.bairro ?? ""),
      cidade: String(property.cidade ?? "SÃ£o Paulo"),
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
      toast.error("Informe o bairro do imÃ³vel");
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
    // FASE 2.3: nunca calcular com dados faltando, zero, negativo ou nÃ£o numÃ©ricos.
    const bairro = priceForm.bairro.trim();
    const area = Number(priceForm.areaM2);
    if (!bairro) {
      toast.error("Preencha todos os campos necessÃ¡rios para realizar o cÃ¡lculo.", { description: "Informe o bairro do imÃ³vel." });
      return;
    }
    if (!Number.isFinite(area) || area <= 0) {
      toast.error("Preencha todos os campos necessÃ¡rios para realizar o cÃ¡lculo.", { description: "A Ã¡rea (mÂ²) deve ser um nÃºmero maior que zero." });
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
  const featured = (summary.data?.featured ?? propertyList.slice(0, 3)) as DetailProperty[];
  const allCatalog = (properties.data ?? []) as DetailProperty[];

  const validateRegistration = (values: { name: string; email: string; password: string }) => {
    const name = values.name.trim();
    const email = values.email.trim();
    if (name.length < 2) {
      toast.error("Informe seu nome completo", { description: "O nome precisa ter pelo menos 2 caracteres." });
      return null;
    }
    if (!/^\S+@\S+\.\S+$/.test(email)) {
      toast.error("Informe um email vÃ¡lido");
      return null;
    }
    if (values.password.length < 8) {
      toast.error("A senha Ã© muito curta", { description: "Use pelo menos 8 caracteres." });
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
    if (!propertyForm.bairro.trim()) return toast.error("Informe o bairro antes de gerar a descriÃ§Ã£o");
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
      toast.error("Informe o bairro do imÃ³vel");
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
      toast.success(`ImÃ³vel publicado${propertyFiles.length ? ` com ${propertyFiles.length} fotos` : ""}`);
    } catch (error) {
      toast.error("NÃ£o foi possÃ­vel concluir a publicaÃ§Ã£o", { description: error instanceof Error ? error.message : "Tente novamente" });
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
    if (!property.ownerId) return toast.info("Este imÃ³vel demonstrativo ainda nÃ£o tem um proprietÃ¡rio cadastrado.");
    startConversation.mutate({ imovelId: property.id, proprietarioId: property.ownerId });
  };

  const openDetails = (property: DetailProperty) => setDetailsProperty(property);
  const similarProperties = detailsProperty
    ? allCatalog.filter(item => item.id !== detailsProperty.id && (item.bairro === detailsProperty.bairro || item.tipo === detailsProperty.tipo)).slice(0, 3)
    : [];

  return (
    <div className="imobai-app-shell relative min-h-screen text-[#102033]">
      {/* ================= AppShell ================= */}
      <aside className={`fixed inset-y-0 left-0 z-40 flex w-[254px] flex-col border-r border-[#172c45] bg-[#102033] text-white transition-transform duration-200 lg:translate-x-0 ${mobileNavOpen ? "translate-x-0" : "-translate-x-full"}`}>
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
          <button type="button" onClick={() => (auth.data ? setProfileOpen(true) : (setAuthMode("login"), setAuthOpen(true)))} className="flex w-full items-center gap-3 border-t border-white/10 pt-4 text-left transition hover:opacity-90"><div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#dbe8f5] text-[12px] font-bold text-[#0b1f3a]">{(auth.data?.name || auth.data?.email || "U").trim().slice(0, 2).toUpperCase()}</div><div className="min-w-0"><div className="truncate text-[12px] font-semibold">{auth.data?.name || auth.data?.email || "UsuÃ¡rio"}</div><div className="truncate text-[11px] text-white/40">{auth.data ? "Meu perfil Â· sessÃ£o ativa" : "Entrar na minha conta"}</div></div><ChevronRight size={15} className="ml-auto text-white/30" /></button>
        </div>
      </aside>
      {mobileNavOpen && <button className="fixed inset-0 z-30 bg-[#071426]/50 lg:hidden" onClick={() => setMobileNavOpen(false)} aria-label="Fechar menu" />}

      <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
  <CloudShader className="h-full w-full" />
</div>

<main className="relative z-10 lg:pl-[254px]">
        <header className="sticky top-0 z-20 flex h-[72px] items-center justify-between border-b border-[#e3e7ec] bg-[#fbfaf7]/95 px-5 backdrop-blur-xl sm:px-8">
          <div className="flex items-center gap-3"><button className="rounded-lg p-2 text-[#6f7f92] hover:bg-[#f2f5f8] lg:hidden" onClick={() => setMobileNavOpen(true)} aria-label="Abrir menu"><Menu size={21} /></button><div className="text-[12px] text-[#8a97a8]"><span className="font-medium text-[#25364a]">ImobAI</span> <span className="mx-2 text-[#cfd6df]">/</span> <span className="font-medium text-[#25364a]">InÃ­cio</span></div></div>
          <div className="flex items-center gap-3">
            <a href="/catalogo" className="hidden items-center gap-1.5 rounded-full border border-[#c99a3e]/30 bg-[#fffaf0] px-3.5 py-2 text-[11px] font-semibold text-[#8a6110] transition hover:bg-[#fff5df] sm:flex"><Compass size={13} /> Explorar catÃ¡logo</a>
            <div className="hidden items-center gap-2 rounded-full border border-[#e8edf3] bg-[#fbfcfe] px-3 py-2 text-[11px] text-[#728196] md:flex"><Clock3 size={14} className="text-[#9ba9b8]" /> Ãšltima atualizaÃ§Ã£o hÃ¡ 4 min</div>
            {auth.data ? <button onClick={() => logout.mutate()} className="rounded-full bg-[#f6f8fb] px-3.5 py-2 text-[11px] font-semibold text-[#40536a] transition hover:bg-[#eef2f6]">Sair</button> : <button onClick={() => { setAuthMode("login"); setAuthOpen(true); }} className="rounded-full bg-[#0b1f3a] px-4 py-2 text-[11px] font-semibold text-white transition hover:bg-[#12345a]">Entrar / criar conta</button>}
          </div>
        </header>

        <div className="mx-auto max-w-[1440px] px-5 pb-16 sm:px-8 lg:px-10">
          {/* ================= Hero premium ================= */}
          <section id="overview" className="imobai-editorial-hero relative mt-6 overflow-hidden rounded-[30px] px-6 py-10 sm:px-10 sm:py-14">
            <div className="pointer-events-none absolute right-0 top-0 z-[2] hidden h-full w-[52%] opacity-100 lg:block">
              <div className="h-full w-full [mask-image:linear-gradient(to_left,black_70%,transparent_100%)]">
                <PremiumImage src={featured[0] ? getPropertyImage(featured[0]) : null} alt="" className="h-full w-full object-cover" eager />
              </div>
            </div>
            <div className="relative z-10 max-w-[640px]">
              <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-[#e7c984]/25 bg-white/[0.07] px-3.5 py-1.5 text-[10.5px] font-semibold uppercase tracking-[0.18em] text-[#d7b56a]">
                <Sparkles size={12} /> Curadoria imobiliÃ¡ria
              </div>
              <h1 className="text-[38px] font-semibold leading-[1.08] tracking-[-0.045em] text-white sm:text-[52px] lg:text-[60px]">
                DecisÃµes imobiliÃ¡rias <span className="text-[#d7b56a]">mais inteligentes.</span>
              </h1>
              <p className="mt-5 max-w-[540px] text-[15px] leading-7 text-white/70 sm:text-[16px]">
                Uma experiÃªncia mais clara para pesquisar, comparar e negociar imÃ³veis â€” com inteligÃªncia trabalhando nos bastidores.
              </p>
              <div className="mt-8 flex flex-wrap items-center gap-3">
                <StatefulButton onClick={() => scrollTo("search")} className="h-12 rounded-xl bg-[#c99a3e] px-6 text-[13px] font-semibold text-[#071426] shadow-[0_14px_34px_rgba(201,154,62,0.35)] transition hover:bg-[#d9ad58]">
                  Explorar imÃ³veis <ArrowRight size={16} />
                </StatefulButton>
                <StatefulButton onClick={() => (auth.data ? setPropertyOpen(true) : (setAuthMode("register"), setAuthOpen(true)))} className="h-12 rounded-xl border border-white/25 bg-white/[0.06] px-6 text-[13px] font-semibold text-white backdrop-blur-sm transition hover:bg-white/[0.14]">
                  <Plus size={16} /> {auth.data ? "Adicionar imÃ³vel" : "Anunciar meu imÃ³vel"}
                </StatefulButton>
              </div>
              {/* Prova de valor â€” nÃºmeros do backend */}
              <div className="mt-10 grid max-w-[560px] grid-cols-2 gap-x-8 gap-y-5 sm:grid-cols-4">
                {[
                  { label: "imÃ³veis ativos", value: summary.isLoading ? null : summary.data?.totalActive ?? 0 },
                  { label: "buscas interpretadas", value: summary.isLoading ? null : Number(summary.data?.searchCount ?? 0) },
                  { label: "regiÃµes atendidas", value: summary.isLoading ? null : summary.data?.neighborhoods?.length ?? 0 },
                ].map(metric => (
                  <div key={metric.label}>
                    <div className="text-[26px] font-semibold tracking-[-0.04em] text-white">
                      {metric.value === null ? <Skeleton className="h-7 w-14 bg-white/15" /> : Number(metric.value).toLocaleString("pt-BR")}
                    </div>
                    <div className="mt-1 text-[10.5px] font-medium uppercase tracking-[0.14em] text-white/45">{metric.label}</div>
                  </div>
                ))}
                <div>
                  <div className="flex items-center gap-1.5 text-[26px] font-semibold tracking-[-0.04em] text-[#7fd6a4]"><span className="relative flex h-2.5 w-2.5"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#7fd6a4] opacity-60" /><span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-[#7fd6a4]" /></span></div>
                  <div className="mt-1 text-[10.5px] font-medium uppercase tracking-[0.14em] text-white/45">disponibilidade atualizada</div>
                </div>
              </div>
            </div>
          </section>

          {/* ================= Busca inteligente ================= */}
          <section id="search" className="imobai-reveal imobai-reveal-delay-1 mt-7 scroll-mt-24">
            <div className="imobai-editorial-panel overflow-hidden rounded-[26px] p-5 sm:p-7">
              <div className="flex flex-col justify-between gap-4 md:flex-row md:items-start">
                <div className="flex items-center gap-3">
                  <div className="imobai-ai-pulse flex h-11 w-11 items-center justify-center rounded-[14px] bg-[#0b1f3a] text-[#d7b56a]"><Bot size={20} /></div>
                  <div>
                    <h2 className="text-[19px] font-semibold tracking-[-0.03em] text-[#102033]">Busca inteligente</h2>
                    <p className="mt-0.5 text-[12.5px] text-[#616e81]">Escreva como vocÃª falaria com um corretor. A IA identifica finalidade, filtros e diferenciais.</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 text-[11px] text-[#656e79]">
                  <span className="rounded-full bg-[#eef8f1] px-2.5 py-1 font-semibold text-[#2f8b61]">Qwen conectado</span>
                </div>
              </div>

              <div className="mt-5 grid gap-5 xl:grid-cols-[1.15fr_0.85fr]">
                <div>
                  <div className="mb-2 flex items-center gap-1.5 text-[11px]">
                    <span className="mr-1 text-[#656e79]">Finalidade:</span>
                    {(["compra", "aluguel"] as const).map(option => (
                      <button key={option} type="button" onClick={() => setFinalidadeOverride(current => (current === option ? null : option))} className={cn("rounded-full border px-3 py-1 font-semibold transition-colors", finalidadeOverride === option ? "border-[#c99a3e] bg-[#fffaf0] text-[#8a6110]" : "border-[#d8e1ea] bg-white text-[#6f7d8e] hover:border-[#c99a3e]/50")}>{option === "compra" ? "Comprar" : "Alugar"}</button>
                    ))}
                  </div>
                  <div className="relative">
                    <Textarea
                      value={searchText}
                      onChange={event => setSearchText(event.target.value)}
                      onKeyDown={event => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); interpretSearch(); } }}
                      className="min-h-[104px] resize-none rounded-[18px] border-[#dce4ed] bg-[#fbfcfe] px-4 py-3.5 text-[14px] leading-6 text-[#263950] shadow-none placeholder:text-[#a1adbb] focus-visible:ring-[#c99a3e]/40"
                      placeholder="Ex.: quero uma casa atÃ© R$ 500 mil que aceite pets..."
                      maxLength={240}
                    />
                    <div className="absolute bottom-3 right-3 text-[10px] text-[#a3adba]">{searchText.length}/240</div>
                  </div>

                  {/* SugestÃµes rÃ¡pidas â€” escrita natural */}
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {SEARCH_SUGGESTIONS.map(suggestion => (
                      <button key={suggestion} type="button" onClick={() => setSearchText(suggestion)} className="rounded-full border border-[#e4eaf1] bg-white px-3 py-1.5 text-[11px] text-[#5a6b80] transition hover:border-[#c99a3e]/50 hover:bg-[#fffaf0] hover:text-[#8a6110]">
                        {suggestion}
                      </button>
                    ))}
                  </div>

                  <div className="mt-4 flex items-center justify-between gap-3">
                    <div className="hidden items-center gap-2 text-[11px] text-[#656e79] sm:flex">
                      <ShieldCheck size={14} className="text-[#2b6e9e]" /> Interpretado pelo agente â€” vocÃª revisa os filtros antes de ver resultados.
                    </div>
                    <StatefulButton onClick={interpretSearch} disabled={parseSearch.isPending} className="ml-auto h-11 rounded-xl bg-[#c99a3e] px-6 text-[13px] font-semibold text-[#071426] shadow-[0_10px_26px_rgba(201,154,62,0.3)] transition hover:bg-[#d9ad58]">
                      {parseSearch.isPending ? (<><Loader2 className="animate-spin" size={15} /> Interpretando sua busca</>) : (<><Search size={15} /> Interpretar busca</>)}
                    </StatefulButton>
                  </div>
                </div>

                {/* Leitura do agente */}
                <div className="rounded-[20px] border border-[#e7ecf2] bg-[#f6f8fb] p-4 sm:p-5">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#656e79]">Leitura do agente</span>
                    {interpretation && <Badge className={cn("border-0 text-[10px] font-semibold", interpretation.source === "agent" ? "bg-[#e9f7ef] text-[#2f8b61]" : "bg-[#fff3d6] text-[#8a6110]")}>{interpretation.source === "agent" ? "IA conectada" : "Modo demo"}</Badge>}
                  </div>
                  {interpretation ? (
                    <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
                      <ParseChip label="Finalidade" value={interpretation.finalidade === "aluguel" ? "Aluguel" : interpretation.finalidade === "compra" ? "Compra" : "Qualquer"} />
                      <ParseChip label="Tipo" value={interpretation.tipo ?? "Qualquer"} />
                      <ParseChip label="Cidade" value={interpretation.cidade ?? "Qualquer"} />
                      <ParseChip label="Quartos" value={interpretation.quartos ? `${interpretation.quartos}+` : "Qualquer"} />
                      <ParseChip label="Bairro" value={interpretation.bairro ?? "Qualquer"} />
                      <ParseChip label="Faixa de valor" value={interpretation.valor_min || interpretation.valor_max ? `${interpretation.valor_min ? money(interpretation.valor_min, true) : "Sem piso"} â€“ ${interpretation.valor_max ? money(interpretation.valor_max, true) : "Sem teto"}` : "Sem limite"} />
                      <ParseChip label="Pet friendly" value={interpretation.aceita_pets ? "Sim" : "â€”"} icon={PawPrint} />
                      <ParseChip label="Varanda" value={interpretation.varanda ? "Sim" : "â€”"} icon={Building2} />
                    </div>
                  ) : (
                    <div className="flex min-h-[112px] flex-col items-center justify-center text-center">
                      <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-white text-[#a9b5c2] shadow-sm"><Bot size={18} /></div>
                      <p className="text-[12px] leading-5 text-[#656e79]">Os filtros reconhecidos aparecem aqui<br />antes de consultar o catÃ¡logo.</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Resultados da busca */}
              {searchParams && (
                <div className="mt-6 border-t border-[#eef2f6] pt-5">
                  <div className="mb-3 flex items-center justify-between">
                    <div>
                      <h3 className="text-[14px] font-semibold text-[#102033]">{properties.isLoading ? "Buscandoâ€¦" : `${propertyList.length} ${propertyList.length === 1 ? "imÃ³vel compatÃ­vel" : "imÃ³veis compatÃ­veis"}`}</h3>
                      <p className="mt-0.5 text-[11.5px] text-[#656e79]">Ordenados por afinidade com a sua busca.</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <a href={`/catalogo${buildCatalogUrl(searchParams)}`} className="flex items-center gap-1 text-[12px] font-semibold text-[#8a6110] transition hover:text-[#c99a3e]">Abrir no catÃ¡logo <ArrowRight size={13} /></a>
                      <button onClick={() => { setSearchParams(null); setInterpretation(null); }} className="text-[11.5px] font-medium text-[#6f8da8] transition hover:text-[#102033]">Limpar</button>
                    </div>
                  </div>
                  {properties.isLoading ? (
                    <div className="grid gap-3 md:grid-cols-3">{Array.from({ length: 3 }).map((_, index) => <ResultSkeleton key={index} />)}</div>
                  ) : propertyList.length ? (
                    <div className="grid gap-3 md:grid-cols-3">
                      {propertyList.slice(0, 3).map(property => (
                        <PropertyCard key={property.id} property={{ ...(property as DetailProperty), recommended: true }} layout="horizontal" className="max-md:flex-col" onOpenDetails={() => openDetails(property as DetailProperty)} />
                      ))}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center rounded-[20px] border border-dashed border-[#d8e1ea] bg-[#fbfcfe] p-6 text-center">
                      <SearchX size={24} className="text-[#8a6110]" aria-hidden />
                      <p className="mt-3 max-w-[460px] text-[12.5px] leading-5 text-[#5c6b7d]">
                        {searchParams.cidade ? `Ainda nÃ£o temos imÃ³veis em ${searchParams.cidade}${searchParams.bairro ? `, no bairro ${searchParams.bairro}` : ""} com esses filtros.` : "Nenhum imÃ³vel bate com esses filtros no momento."} Tente ampliar a faixa de preÃ§o, remover diferenciais ou explorar outra regiÃ£o.
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </section>

          {/* ================= Faixa de confianÃ§a ================= */}
          <section aria-label="Por que confiar no ImobAI" className="mt-7 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { icon: ShieldCheck, title: "CatÃ¡logo verificado", text: "PreÃ§os e disponibilidade consistentes com o banco de dados." },
              { icon: Bot, title: "IA que explica", text: "A busca mostra os critÃ©rios reconhecidos antes de filtrar." },
              { icon: BadgeCheck, title: "NegociaÃ§Ã£o protegida", text: "Converse com o anunciante sem expor seus dados." },
              { icon: TrendingUp, title: "Leitura de mercado", text: "PreÃ§o mÃ©dio por mÂ² do bairro antes de vocÃª decidir." },
            ].map(item => (
              <div key={item.title} className="imobai-card-hover flex items-start gap-3 rounded-[18px] border border-[#e7ecf2] bg-white p-4 shadow-[var(--shadow-card-premium)]">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#f6f8fb] text-[#8a6110]"><item.icon size={17} /></div>
                <div><div className="text-[13px] font-semibold text-[#102033]">{item.title}</div><p className="mt-1 text-[11.5px] leading-5 text-[#616e81]">{item.text}</p></div>
              </div>
            ))}
          </section>

          {/* ================= CatÃ¡logo em destaque ================= */}
          <section id="catalog" className="imobai-reveal imobai-reveal-delay-2 mt-9 scroll-mt-24">
            <div className="flex items-end justify-between">
              <div>
                <div className="mb-2 text-[11px] font-bold uppercase tracking-[0.16em] text-[#8a6110]">Curadoria de oportunidades</div>
                <h2 className="text-[24px] font-semibold tracking-[-0.035em] text-[#102033]">CatÃ¡logo em destaque</h2>
              </div>
              <a href="/catalogo" className="group flex items-center gap-1.5 rounded-full border border-[#d8e1ea] bg-white px-4 py-2 text-[12px] font-semibold text-[#0b1f3a] shadow-sm transition hover:border-[#c99a3e]/50 hover:bg-[#fffaf0]">
                Ver todos <ArrowRight size={14} className="transition-transform group-hover:translate-x-0.5" />
              </a>
            </div>
            <div className="mt-5 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
              {summary.isLoading
                ? Array.from({ length: 3 }).map((_, index) => <ResultSkeleton key={index} />)
                : featured.map((property, index) => (
                    <div key={property.id} className="imobai-reveal" style={{ animationDelay: `${index * 90}ms` }}>
                      <PropertyCard property={{ ...property, recommended: index === 0 }} onOpenDetails={() => openDetails(property)} />
                    </div>
                  ))}
            </div>
          </section>

          {/* ================= Ferramentas de anÃºncio e preÃ§o ================= */}
          <div className="mt-9 grid gap-7 xl:grid-cols-[1.15fr_0.85fr]">
            <section id="ad-generator" className="scroll-mt-24 rounded-[22px] border border-[#e7ecf2] bg-white p-5 shadow-[var(--shadow-card-premium)] sm:p-6">
              <SectionHeader icon={Tags} eyebrow="GERADOR_ANUNCIO" title="AnÃºncio pronto para publicar" description="Transforme atributos tÃ©cnicos em uma narrativa que vende." />
              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <Field label="Tipo de imÃ³vel"><select value={adForm.tipo} onChange={event => setAdForm({ ...adForm, tipo: event.target.value })} className="h-10 w-full rounded-xl border border-[#dce4ed] bg-[#fbfcfe] px-3 text-[12px] text-[#2b3d53] outline-none focus:border-[#c99a3e]/60"><option>Apartamento</option><option>Casa</option><option>Sobrado</option><option>Cobertura</option><option>Terreno</option></select></Field>
                <Field label="Quartos"><Input type="number" value={adForm.quartos} onChange={event => setAdForm({ ...adForm, quartos: Number(event.target.value) })} className="h-10 rounded-xl border-[#dce4ed] bg-[#fbfcfe] text-[12px]" /></Field>
                <Field label="Bairro"><Input value={adForm.bairro} onChange={event => setAdForm({ ...adForm, bairro: event.target.value })} className="h-10 rounded-xl border-[#dce4ed] bg-[#fbfcfe] text-[12px]" /></Field>
                <Field label="PreÃ§o de venda"><Input type="number" value={adForm.preco} onChange={event => setAdForm({ ...adForm, preco: Number(event.target.value) })} className="h-10 rounded-xl border-[#dce4ed] bg-[#fbfcfe] text-[12px]" /></Field>
              </div>
              <Field label="Diferenciais" className="mt-3"><Input value={adForm.diferenciais} onChange={event => setAdForm({ ...adForm, diferenciais: event.target.value })} className="h-10 rounded-xl border-[#dce4ed] bg-[#fbfcfe] text-[12px]" /></Field>
              <StatefulButton onClick={() => generateAd.mutate({ ...adForm, diferenciais: adForm.diferenciais.split(",").map(item => item.trim()).filter(Boolean) })} disabled={generateAd.isPending} variant="outline" className="mt-4 rounded-xl border-[#cdd9e5] bg-white text-[12px] font-semibold text-[#2c5274] hover:bg-[#f5f9fc]">{generateAd.isPending ? <Loader2 className="mr-2 animate-spin" size={15} /> : <Sparkles className="mr-2" size={15} />} Gerar anÃºncio com IA</StatefulButton>
              {adResult && <div className="mt-5 rounded-2xl border border-[#f2dfad] bg-[#fffaf0] p-4"><div className="flex items-start justify-between gap-4"><div><div className="text-[15px] font-semibold text-[#263a4f]">{adResult.titulo_comercial}</div><p className="mt-2 text-[12px] leading-5 text-[#6f7d8e]">{adResult.descricao_persuasiva}</p></div><Badge className="shrink-0 border-0 bg-[#fff0c5] text-[10px] text-[#9a7013]">{adResult.source === "agent" ? "IA" : "Demo"}</Badge></div><div className="mt-3 flex flex-wrap gap-1.5">{adResult.hashtags.map(tag => <span key={tag} className="rounded-full bg-white px-2 py-1 text-[10px] font-medium text-[#9a7013] shadow-sm">{tag}</span>)}</div></div>}
            </section>
            <section id="pricing" className="scroll-mt-24 rounded-[22px] bg-[#0b1f3a] p-5 text-white shadow-[0_14px_40px_rgba(11,31,58,0.18)] sm:p-6">
              <SectionHeader dark icon={CircleDollarSign} eyebrow="SUGESTAO_PRECO" title="PreÃ§o com contexto de mercado" description="Compare o mÂ² da regiÃ£o e ajuste pelos diferenciais do imÃ³vel." />
              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <Field dark label="Bairro"><Input value={priceForm.bairro} onChange={event => setPriceForm({ ...priceForm, bairro: event.target.value })} className="h-10 rounded-xl border-white/10 bg-white/10 text-[12px] text-white placeholder:text-white/35" /></Field>
                <Field dark label="Ãrea (mÂ²)"><Input type="number" value={priceForm.areaM2} onChange={event => setPriceForm({ ...priceForm, areaM2: Number(event.target.value) })} className="h-10 rounded-xl border-white/10 bg-white/10 text-[12px] text-white" /></Field>
                <Field dark label="Tipo"><select value={priceForm.tipo} onChange={event => setPriceForm({ ...priceForm, tipo: event.target.value })} className="h-10 w-full rounded-xl border border-white/10 bg-white/10 px-3 text-[12px] text-white outline-none"><option className="text-[#0b1f3a]">Apartamento</option><option className="text-[#0b1f3a]">Casa</option><option className="text-[#0b1f3a]">Cobertura</option><option className="text-[#0b1f3a]">Sobrado</option></select></Field>
                <Field dark label="Diferenciais"><Input value={priceForm.diferenciais} onChange={event => setPriceForm({ ...priceForm, diferenciais: event.target.value })} className="h-10 rounded-xl border-white/10 bg-white/10 text-[12px] text-white placeholder:text-white/35" /></Field>
              </div>
              <StatefulButton onClick={handleSuggestPrice} disabled={suggestPrice.isPending} className="mt-4 rounded-xl bg-[#c99a3e] text-[12px] font-semibold text-[#071426] hover:bg-[#d9ad58]">{suggestPrice.isPending ? <Loader2 className="mr-2 animate-spin" size={15} /> : <CircleDollarSign className="mr-2" size={15} />} Calcular sugestÃ£o</StatefulButton>
              {priceResult && <div className="mt-5 rounded-2xl border border-white/10 bg-white/[0.07] p-4"><div className="flex items-end justify-between gap-3"><div><div className="text-[10px] uppercase tracking-[0.14em] text-white/45">Venda sugerida</div><div className="mt-1 text-[25px] font-semibold tracking-[-0.04em] text-[#d7b56a]">{money(priceResult.preco_sugerido_venda, true)}</div></div><div className="text-right"><div className="text-[10px] uppercase tracking-[0.14em] text-white/45">LocaÃ§Ã£o</div><div className="mt-1 text-[15px] font-semibold text-white">{money(priceResult.preco_sugerido_aluguel)}/mÃªs</div></div></div><div className="mt-4 grid grid-cols-2 gap-2 border-t border-white/10 pt-3 text-[11px]"><div><span className="text-white/45">MÃ©dia regional</span><div className="mt-1 font-semibold text-white">{money(priceResult.media_m2)}/mÂ²</div></div><div><span className="text-white/45">Faixa recomendada</span><div className="mt-1 font-semibold text-white">{priceResult.faixa_recomendada}</div></div></div><p className="mt-3 text-[11px] leading-5 text-white/55">{priceResult.justificativa}</p></div>}
            </section>
          </div>

          {/* ================= Mercado + performance ================= */}
          <section className="mt-9 grid gap-7 xl:grid-cols-[1fr_0.8fr]">
            <div className="rounded-[22px] border border-[#e7ecf2] bg-white p-5 shadow-[var(--shadow-card-premium)] sm:p-6">
              <div className="flex items-start justify-between">
                <div>
                  <div className="mb-2 text-[11px] font-bold uppercase tracking-[0.16em] text-[#8a6110]">Leitura de mercado</div>
                  <h2 className="text-[19px] font-semibold tracking-[-0.035em] text-[#102033]">PreÃ§o mÃ©dio por mÂ²</h2>
                  <p className="mt-1 text-[12px] text-[#656e79]">Bairros com maior procura na base ativa.</p>
                </div>
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#f6f8fb] text-[#2b6e9e]"><BarChart3 size={17} /></div>
              </div>
              <div className="mt-6 space-y-4">
                {(summary.data?.neighborhoods ?? []).slice(0, 5).map((item, index) => <MarketBar key={item.bairro} label={item.bairro} value={item.priceM2} max={summary.data?.neighborhoods?.[0]?.priceM2 ?? item.priceM2} color={index === 0 ? "#0b1f3a" : index === 1 ? "#2b6e9e" : "#9ab1c5"} />)}
              </div>
            </div>
            <div className="rounded-[22px] bg-[#eaf1f7] p-5 sm:p-6">
              <div className="flex items-start justify-between">
                <div>
                  <div className="mb-2 text-[11px] font-bold uppercase tracking-[0.16em] text-[#5d7893]">Performance do agente</div>
                  <h2 className="text-[19px] font-semibold tracking-[-0.035em] text-[#17314e]">Mais clareza, menos atrito.</h2>
                </div>
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white text-[#547b9c] shadow-sm"><Users size={17} /></div>
              </div>
              <div className="mt-6 flex items-end gap-3">
                <div className="text-[42px] font-semibold tracking-[-0.07em] text-[#17314e]">86<span className="text-[20px] text-[#547b9c]">/100</span></div>
                <div className="mb-2 rounded-full bg-[#d7eddf] px-2 py-1 text-[10px] font-bold text-[#398557]">+6,8%</div>
              </div>
              <p className="mt-2 max-w-[340px] text-[12px] leading-5 text-[#65809a]">Ãndice de afinidade mÃ©dio entre buscas interpretadas e imÃ³veis recomendados.</p>
              <div className="mt-6 h-2 overflow-hidden rounded-full bg-white/70"><div className="h-full w-[86%] rounded-full bg-[#2b6e9e]" /></div>
              <div className="mt-2 flex justify-between text-[10px] text-[#7e97ac]"><span>RelevÃ¢ncia das recomendaÃ§Ãµes</span><span>86%</span></div>
            </div>
          </section>

          {/* ================= Inbox + Concierge ================= */}
          <section className="mt-9 grid gap-7 xl:grid-cols-[0.9fr_1.1fr]">
            <div id="inbox" className="scroll-mt-24 rounded-[22px] border border-[#e7ecf2] bg-white p-5 shadow-[var(--shadow-card-premium)] sm:p-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="mb-2 text-[11px] font-bold uppercase tracking-[0.16em] text-[#8a6110]">NegociaÃ§Ã£o privada</div>
                  <h2 className="text-[19px] font-semibold tracking-[-0.035em] text-[#102033]">Minhas conversas</h2>
                  <p className="mt-1 text-[12px] text-[#656e79]">Fale diretamente com o proprietÃ¡rio ou interessado.</p>
                </div>
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#f6f8fb] text-[#2b6e9e]"><MessageSquareText size={17} /></div>
              </div>
              {!auth.data ? (
                <div className="mt-6 rounded-2xl bg-[#f6f8fb] p-5 text-center"><div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-white text-[#6789a5] shadow-sm"><Users size={18} /></div><p className="mt-3 text-[12px] leading-5 text-[#7e8d9f]">Crie uma conta para negociar imÃ³veis e manter seu histÃ³rico de mensagens.</p><StatefulButton onClick={() => { setAuthMode("register"); setAuthOpen(true); }} className="mt-4 rounded-xl bg-[#0b1f3a] text-[12px]">Criar minha conta</StatefulButton></div>
              ) : (
                <div className="mt-5 grid gap-4 md:grid-cols-[0.75fr_1.25fr]">
                  <div className="space-y-2">
                    {(conversations.data ?? []).length ? (conversations.data ?? []).map(conversation => <button key={conversation.id} onClick={() => setSelectedConversation(conversation.id)} className={`w-full rounded-xl border p-3 text-left transition ${selectedConversation === conversation.id ? "border-[#c99a3e]/50 bg-[#fffaf0]" : "border-[#eef2f6] bg-white hover:bg-[#fafbfd]"}`}><div className="flex items-center justify-between"><span className="text-[12px] font-semibold text-[#33485f]">NegociaÃ§Ã£o #{conversation.id}</span><span className="text-[10px] text-[#9ba8b5]">imÃ³vel</span></div><p className="mt-1 truncate text-[11px] text-[#8b99a8]">Conversa sobre anÃºncio</p></button>) : <div className="rounded-xl bg-[#f6f8fb] p-4 text-[11px] leading-5 text-[#8795a5]">Nenhuma conversa ainda. Abra uma negociaÃ§Ã£o a partir de um anÃºncio de outro usuÃ¡rio.</div>}
                  </div>
                  <div className="flex min-h-[180px] flex-col rounded-2xl bg-[#f6f8fb] p-4">
                    {selectedConversation ? (
                      <>
                        <div className="mb-3 border-b border-[#e5eaf0] pb-3 text-[12px] font-semibold text-[#31475e]">NegociaÃ§Ã£o #{selectedConversation}</div>
                        <div className="flex-1 space-y-2 overflow-auto">{(conversationMessages.data ?? []).map(message => <div key={message.id} className={`max-w-[88%] rounded-xl px-3 py-2 text-[11px] leading-5 ${message.remetenteId === auth.data.id ? "ml-auto bg-[#0b1f3a] text-white" : "bg-white text-[#52657a]"}`}>{message.conteudo}</div>)}</div>
                        <form onSubmit={event => { event.preventDefault(); if (messageText.trim()) sendMessage.mutate({ conversaId: selectedConversation, conteudo: messageText }); }} className="mt-3 flex gap-2"><Input value={messageText} onChange={event => setMessageText(event.target.value)} placeholder="Escreva uma mensagem..." className="h-9 rounded-xl border-[#dce4ed] bg-white text-[11px]" /><StatefulButton type="submit" size="sm" className="h-9 rounded-xl bg-[#0b1f3a] text-[11px]">Enviar</StatefulButton></form>
                      </>
                    ) : (
                      <div className="flex flex-1 flex-col items-center justify-center text-center"><MessageSquareText size={21} className="text-[#b5c0cb]" /><p className="mt-2 text-[11px] text-[#8a98a8]">Selecione uma conversa<br />para ver as mensagens.</p></div>
                    )}
                  </div>
                </div>
              )}
            </div>
            <div id="ai-chat" className="scroll-mt-24 rounded-[22px] bg-[#0b1f3a] p-5 text-white shadow-[0_14px_40px_rgba(11,31,58,0.18)] sm:p-6">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/10 text-[#d7b56a]"><Bot size={18} /></div>
                  <div>
                    <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#d7b56a]">Concierge individual</div>
                    <h2 className="mt-1 text-[19px] font-semibold tracking-[-0.035em]">Converse com o Qwen</h2>
                    <p className="mt-1 text-[12px] text-white/50">Seu histÃ³rico Ã© privado e fica associado Ã  sua conta.</p>
                  </div>
                </div>
                <Badge className="border-0 bg-[#214567] text-[10px] text-[#b9d3e8]">Qwen</Badge>
              </div>
              {!auth.data ? (
                <div className="mt-6 rounded-2xl border border-white/10 bg-white/[0.06] p-5 text-center"><p className="text-[12px] leading-5 text-white/60">Entre na sua conta para conversar com a IA sobre compra, locaÃ§Ã£o, visita e negociaÃ§Ã£o.</p><StatefulButton onClick={() => { setAuthMode("login"); setAuthOpen(true); }} className="mt-4 rounded-xl bg-[#c99a3e] text-[12px] font-semibold text-[#071426] hover:bg-[#d9ad58]">Entrar para conversar</StatefulButton></div>
              ) : (
                <>
                  <div className="mt-5 flex min-h-[210px] flex-col gap-2 rounded-2xl border border-white/10 bg-white/[0.06] p-4">
                    {[...(aiHistory.data ?? []), ...pendingAiMessages].length ? [...(aiHistory.data ?? []), ...pendingAiMessages].map(message => <div key={message.id} className={`max-w-[88%] rounded-xl px-3 py-2 text-[11px] leading-5 ${message.role === "user" ? "ml-auto bg-[#c99a3e] text-[#071426]" : "bg-white/10 text-white/80"}`}>{message.conteudo}</div>) : <div className="m-auto max-w-[300px] text-center text-[12px] leading-5 text-white/50">OlÃ¡, {auth.data.name || "bem-vindo"}. Posso te ajudar a comparar bairros, analisar um anÃºncio ou preparar a prÃ³xima conversa.</div>}
                    {sendAiMessage.isPending && <div className="flex items-center gap-2 self-start rounded-xl bg-white/10 px-3 py-2 text-[11px] text-white/60"><Loader2 className="animate-spin" size={13} /> Interpretando sua mensagemâ€¦</div>}
                  </div>
                  <form onSubmit={event => { event.preventDefault(); handleAiSubmit(); }} className="mt-3 flex gap-2"><Input value={aiText} onChange={event => setAiText(event.target.value)} placeholder="Ex.: vale a pena comprar em Pinheiros?" className="h-10 rounded-xl border-white/10 bg-white/10 text-[12px] text-white placeholder:text-white/35" /><StatefulButton type="submit" disabled={sendAiMessage.isPending} className="h-10 rounded-xl bg-[#c99a3e] px-3 text-[11px] font-semibold text-[#071426] hover:bg-[#d9ad58]">{sendAiMessage.isPending ? <Loader2 className="animate-spin" size={15} /> : "Enviar"}</StatefulButton></form>
                  {searchParams && <p className="mt-2 text-[10px] text-white/40">Usando os filtros da sua Ãºltima busca ({searchParams.cidade || searchParams.bairro || "sem local definido"}) como contexto.</p>}
                </>
              )}
            </div>
          </section>

          {/* ================= Meus imÃ³veis ================= */}
          <section className="mt-9 scroll-mt-24 rounded-[22px] border border-[#e7ecf2] bg-white p-5 shadow-[var(--shadow-card-premium)] sm:p-6">
            <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
              <div>
                <div className="mb-2 text-[11px] font-bold uppercase tracking-[0.16em] text-[#8a6110]">Conta e portfÃ³lio</div>
                <h2 className="text-[19px] font-semibold tracking-[-0.035em] text-[#102033]">Meus imÃ³veis</h2>
                <p className="mt-1 text-[12px] text-[#656e79]">Cadastre anÃºncios e acompanhe o que estÃ¡ publicado pela sua conta.</p>
              </div>
              <Button onClick={() => (auth.data ? setPropertyOpen(true) : (setAuthMode("register"), setAuthOpen(true)))} className="w-fit rounded-xl bg-[#0b1f3a] text-[12px]"><Plus size={15} className="mr-2" /> Cadastrar imÃ³vel</Button>
            </div>
            {!auth.data ? (
              <div className="mt-5 rounded-2xl border border-dashed border-[#d6e0e9] bg-[#fbfcfe] p-4">
                <div className="grid gap-2 sm:grid-cols-3"><Input value={authForm.name} onChange={event => setAuthForm({ ...authForm, name: event.target.value })} placeholder="Seu nome" className="h-10 rounded-xl border-[#dce4ed] bg-white text-[11px]" /><Input type="email" value={authForm.email} onChange={event => setAuthForm({ ...authForm, email: event.target.value })} placeholder="Seu email" className="h-10 rounded-xl border-[#dce4ed] bg-white text-[11px]" /><Input type="password" value={authForm.password} onChange={event => setAuthForm({ ...authForm, password: event.target.value })} placeholder="Senha (8+ caracteres)" className="h-10 rounded-xl border-[#dce4ed] bg-white text-[11px]" /></div>
                <div className="mt-3 flex flex-wrap items-center justify-between gap-2"><span className="text-[10px] text-[#8795a5]">Senha protegida por hash seguro.</span><StatefulButton onClick={handleAuthSubmitInline} disabled={register.isPending || login.isPending} className="rounded-xl bg-[#0b1f3a] text-[11px]">{register.isPending || login.isPending ? <Loader2 className="animate-spin" size={14} /> : "Criar conta e portfÃ³lio"}</StatefulButton></div>
                <button onClick={() => { setAuthMode("login"); setAuthOpen(true); }} className="mt-2 text-[10px] font-semibold text-[#5d819f]">JÃ¡ tenho uma conta â€” entrar</button>
              </div>
            ) : (
              <div className="mt-5 grid gap-3 md:grid-cols-3">
                {(myProperties.data ?? []).length ? (myProperties.data ?? []).map(property => <PropertyCard key={property.id} property={property as DetailProperty} onOpenDetails={() => openDetails(property as DetailProperty)} />) : <div className="rounded-2xl bg-[#f6f8fb] p-5 text-[12px] text-[#8795a5] md:col-span-3">VocÃª ainda nÃ£o cadastrou imÃ³veis. Comece com os campos essenciais e complete o anÃºncio depois.</div>}
              </div>
            )}
          </section>

          <footer className="flex flex-col justify-between gap-2 border-t border-[#e7ecf2] py-6 text-[11px] text-[#9aa6b5] sm:flex-row"><span>ImobAI Â· Real Estate Intelligence</span><span>Dados do catÃ¡logo ativo Â· Disponibilidade atualizada em tempo real</span></footer>
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
  return <div><div className="mb-1.5 flex items-center justify-between text-[11px]"><span className="font-medium text-[#596c80]">{label}</span><span className="font-semibold text-[#314861]">{money(value)}/mÂ²</span></div><div className="h-2 overflow-hidden rounded-full bg-[#edf1f5]"><div className="h-full rounded-full transition-all" style={{ width: `${Math.min(100, Math.round((value / max) * 100))}%`, backgroundColor: color }} /></div></div>;
}





