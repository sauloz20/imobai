import { useMemo, useState } from "react";
import {
  ArrowLeft,
  Bot,
  Building2,
  ChevronLeft,
  Loader2,
  MessageCircle,
  MoreHorizontal,
  Paperclip,
  Search,
  Send,
  Sparkles,
  UserRound,
} from "lucide-react";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";

type Conversation = {
  id: string;
  name: string;
  type: "ai" | "seller" | "buyer";
  preview: string;
  time: string;
  unread?: number;
  property?: string;
};

const conversations: Conversation[] = [
  {
    id: "concierge",
    name: "Concierge IA",
    type: "ai",
    preview: "Seu assistente imobiliário pessoal",
    time: "Agora",
    unread: 1,
  },
  {
    id: "vendedor-1",
    name: "Mariana Oliveira",
    type: "seller",
    preview: "O imóvel continua disponível para visita.",
    time: "10:42",
    property: "Casa com 3 quartos em Ibituruna",
    unread: 2,
  },
  {
    id: "comprador-1",
    name: "Lucas Almeida",
    type: "buyer",
    preview: "Gostaria de saber se aceita financiamento.",
    time: "Ontem",
    property: "Apartamento no Centro",
  },
];

const humanMessages: Record<
  string,
  Array<{
    id: string;
    sender: "me" | "other";
    text: string;
    time: string;
  }>
> = {
  "vendedor-1": [
    {
      id: "seller-1",
      sender: "other",
      text: "Olá! Vi que você demonstrou interesse no imóvel.",
      time: "10:38",
    },
    {
      id: "seller-2",
      sender: "me",
      text: "Sim. Gostaria de saber se posso agendar uma visita.",
      time: "10:40",
    },
    {
      id: "seller-3",
      sender: "other",
      text: "Claro. O imóvel continua disponível para visita.",
      time: "10:42",
    },
  ],
  "comprador-1": [
    {
      id: "buyer-1",
      sender: "other",
      text: "Gostaria de saber se aceita financiamento.",
      time: "Ontem",
    },
  ],
};

const suggestedPrompts = [
  {
    label: "Encontrar imóveis",
    text: "Quero encontrar imóveis que combinem com o que estou procurando.",
  },
  {
    label: "Comparar opções",
    text: "Compare as melhores opções disponíveis para mim.",
  },
  {
    label: "Analisar preço",
    text: "Qual faixa de preço faz sentido para esse imóvel?",
  },
  {
    label: "Conhecer bairros",
    text: "Quais bairros combinam com meu perfil de busca?",
  },
];

function Avatar({ type }: { type: Conversation["type"] }) {
  if (type === "ai") {
    return (
      <div className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[linear-gradient(145deg,#173d63,#0b223b)] text-[#e1bf76] shadow-[0_8px_25px_rgba(16,47,80,0.22)]">
        <Sparkles size={18} strokeWidth={1.8} />
        <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-white bg-[#69b889]" />
      </div>
    );
  }

  return (
    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#edf3f7] text-[#486176]">
      <UserRound size={18} />
    </div>
  );
}

function formatTime(value: string | Date) {
  const date = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Agora";
  }

  return date.toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function Messages() {
  const [selectedId, setSelectedId] = useState("concierge");
  const [text, setText] = useState("");
  const [mobileChatOpen, setMobileChatOpen] = useState(false);
  const [localHumanMessages, setLocalHumanMessages] = useState(humanMessages);

  const [pendingAiMessages, setPendingAiMessages] = useState<
    Array<{
      id: string;
      text: string;
      time: string;
    }>
  >([]);

  const auth = trpc.auth.me.useQuery();

  const aiHistory = trpc.aiChat.history.useQuery(undefined, {
    enabled: Boolean(auth.data),
  });

  const utils = trpc.useUtils();

  const sendAiMessage = trpc.aiChat.send.useMutation({
    onSuccess: result => {
      console.log("[Concierge] Resposta recebida:", result);

      setPendingAiMessages(current =>
        current.filter(message => !message.id.startsWith("pending-"))
      );

      utils.aiChat.history.setData(undefined, current => [
        ...(current ?? []),
        result.message,
      ]);

      aiHistory.refetch();
    },

    onError: error => {
      console.error("[Concierge] Erro ao enviar mensagem:", error);
      console.error("[Concierge] Código:", error.data?.code);
      console.error("[Concierge] Mensagem:", error.message);

      setPendingAiMessages(current =>
        current.filter(message => !message.id.startsWith("pending-"))
      );
    },
  });

  const selectedConversation = useMemo(
    () =>
      conversations.find(conversation => conversation.id === selectedId) ??
      conversations[0],
    [selectedId]
  );

  const isAiConversation = selectedConversation.type === "ai";

  const aiMessages = useMemo(
    () => [
      ...(aiHistory.data ?? []).map(message => ({
        id: String(message.id),
        sender:
          message.role === "user"
            ? ("me" as const)
            : ("other" as const),
        text: message.conteudo,
        time: formatTime(message.createdAt),
      })),

      ...pendingAiMessages.map(message => ({
        id: message.id,
        sender: "me" as const,
        text: message.text,
        time: message.time,
      })),
    ],
    [aiHistory.data, pendingAiMessages]
  );

  const selectedMessages = isAiConversation
    ? aiMessages
    : localHumanMessages[selectedConversation.id] ?? [];

  const handleSelectConversation = (id: string) => {
    setSelectedId(id);
    setMobileChatOpen(true);
  };

  const handleSend = () => {
    const value = text.trim();

    console.log("[Concierge] handleSend chamado");
    console.log("[Concierge] Texto:", value);
    console.log("[Concierge] Conversa:", selectedConversation.id);
    console.log("[Concierge] É IA:", isAiConversation);
    console.log(
      "[Concierge] Mutation pending:",
      sendAiMessage.isPending
    );

    if (!value) {
      console.warn("[Concierge] Mensagem vazia.");
      return;
    }

    if (isAiConversation) {
      if (sendAiMessage.isPending) {
        console.warn("[Concierge] Já existe uma mensagem sendo enviada.");
        return;
      }

      const pendingId = `pending-${Date.now()}`;

      console.log("[Concierge] Enviando para aiChat.send...");

      setPendingAiMessages(current => [
        ...current,
        {
          id: pendingId,
          text: value,
          time: "Agora",
        },
      ]);

      setText("");

      sendAiMessage.mutate({
        text: value,
      });

      return;
    }

    setLocalHumanMessages(current => ({
      ...current,
      [selectedConversation.id]: [
        ...(current[selectedConversation.id] ?? []),
        {
          id:
            selectedConversation.id +
            "-" +
            String(Date.now()),
          sender: "me",
          text: value,
          time: "Agora",
        },
      ],
    }));

    setText("");
  };

  const handleSuggestedPrompt = (prompt: string) => {
    if (sendAiMessage.isPending) {
      return;
    }

    const pendingId = `pending-${Date.now()}`;

    setPendingAiMessages(current => [
      ...current,
      {
        id: pendingId,
        text: prompt,
        time: "Agora",
      },
    ]);

    setText("");

    sendAiMessage.mutate({
      text: prompt,
    });
  };

  const showSuggestions =
    isAiConversation &&
    !sendAiMessage.isPending &&
    aiMessages.length <= 1;

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#edf4f8] text-[#102033]">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -left-32 -top-40 h-[480px] w-[480px] rounded-full bg-white/80 blur-3xl" />
        <div className="absolute right-[-160px] top-[15%] h-[420px] w-[420px] rounded-full bg-[#d9e8f2]/70 blur-3xl" />
        <div className="absolute bottom-[-220px] left-[25%] h-[500px] w-[600px] rounded-full bg-white/70 blur-3xl" />

        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_10%,rgba(255,255,255,0.92),transparent_34%),radial-gradient(circle_at_85%_30%,rgba(191,214,230,0.45),transparent_30%)]" />
      </div>

      <header className="relative z-10 border-b border-white/70 bg-white/65 backdrop-blur-2xl">
        <div className="mx-auto flex h-[72px] max-w-[1440px] items-center justify-between px-4 sm:px-8">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="flex h-10 w-10 items-center justify-center rounded-full text-[#40536a] transition hover:bg-white/80"
              aria-label="Voltar para o início"
            >
              <ArrowLeft size={19} />
            </Link>

            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#102f50] text-[#dfbd74] shadow-[0_6px_18px_rgba(16,47,80,0.16)]">
                <MessageCircle size={17} />
              </div>

              <div>
                <div className="text-[15px] font-bold tracking-[-0.035em]">
                  Mensagens
                </div>

                <div className="text-[10px] text-[#718398]">
                  Conversas e Concierge IA
                </div>
              </div>
            </div>
          </div>

          <button
            type="button"
            className="flex h-10 w-10 items-center justify-center rounded-full text-[#40536a] transition hover:bg-white/80"
            aria-label="Mais opções"
          >
            <MoreHorizontal size={20} />
          </button>
        </div>
      </header>

      <div className="relative z-10 mx-auto flex max-w-[1440px] px-3 py-4 sm:px-6 lg:py-6">
        <div className="flex h-[calc(100vh-120px)] w-full overflow-hidden rounded-[30px] border border-white/80 bg-white/65 shadow-[0_30px_100px_rgba(38,68,96,0.12)] backdrop-blur-2xl">
          <aside
            className={cn(
              "w-full border-r border-white/80 bg-white/45 md:w-[360px] md:shrink-0",
              mobileChatOpen ? "hidden md:block" : "block"
            )}
          >
            <div className="border-b border-white/80 p-5">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h1 className="text-[20px] font-semibold tracking-[-0.04em]">
                    Conversas
                  </h1>

                  <p className="mt-1 text-[11px] text-[#8090a0]">
                    Tudo em um só lugar
                  </p>
                </div>

                <MessageCircle size={18} className="text-[#7890a5]" />
              </div>

              <div className="flex h-10 items-center gap-2 rounded-xl border border-white/90 bg-white/60 px-3 text-[#8a99a8] shadow-sm">
                <Search size={15} />

                <input
                  className="min-w-0 flex-1 bg-transparent text-[12px] text-[#24384c] outline-none placeholder:text-[#9aa8b5]"
                  placeholder="Buscar conversas..."
                  aria-label="Buscar conversas"
                />
              </div>
            </div>

            <div className="p-2">
              {conversations.map(conversation => {
                const active = conversation.id === selectedId;

                return (
                  <button
                    key={conversation.id}
                    type="button"
                    onClick={() =>
                      handleSelectConversation(conversation.id)
                    }
                    className={cn(
                      "group flex w-full items-center gap-3 rounded-2xl p-3 text-left transition",
                      active
                        ? "bg-white/85 shadow-[0_8px_28px_rgba(38,68,96,0.08)]"
                        : "hover:bg-white/55"
                    )}
                  >
                    <Avatar type={conversation.type} />

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate text-[12px] font-semibold text-[#25394d]">
                          {conversation.name}
                        </span>

                        <span className="shrink-0 text-[9px] text-[#93a0ac]">
                          {conversation.time}
                        </span>
                      </div>

                      {conversation.property && (
                        <div className="mt-0.5 flex items-center gap-1 text-[9px] text-[#8a6110]">
                          <Building2 size={10} />
                          <span className="truncate">
                            {conversation.property}
                          </span>
                        </div>
                      )}

                      <div className="mt-1 flex items-center justify-between gap-2">
                        <span className="truncate text-[10px] text-[#7d8d9c]">
                          {conversation.preview}
                        </span>

                        {conversation.unread && (
                          <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-[#c99a3e] px-1 text-[8px] font-bold text-white">
                            {conversation.unread}
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </aside>

          <section
            className={cn(
              "min-h-0 min-w-0 flex-1 flex-col",
              mobileChatOpen ? "flex" : "hidden md:flex"
            )}
          >
            <div className="flex min-h-[76px] items-center gap-3 border-b border-white/80 bg-white/45 px-4 sm:px-6">
              <button
                type="button"
                onClick={() => setMobileChatOpen(false)}
                className="flex h-9 w-9 items-center justify-center rounded-full text-[#526577] hover:bg-white/80 md:hidden"
                aria-label="Voltar para conversas"
              >
                <ChevronLeft size={19} />
              </button>

              <Avatar type={selectedConversation.type} />

              <div className="min-w-0 flex-1">
                <div className="truncate text-[13px] font-semibold text-[#25394d]">
                  {selectedConversation.name}
                </div>

                <div className="mt-0.5 flex items-center gap-1.5 text-[9px] text-[#8292a0]">
                  <span className="h-1.5 w-1.5 rounded-full bg-[#68a77c]" />

                  {isAiConversation
                    ? "Conectado ao catálogo do ImobAI"
                    : "Conversa sobre imóvel"}
                </div>
              </div>

              {isAiConversation && (
                <div className="hidden items-center gap-1.5 rounded-full border border-[#ead8ad]/70 bg-[#fffaf0]/80 px-3 py-1.5 text-[9px] font-medium text-[#967331] sm:flex">
                  <Sparkles size={11} />
                  Concierge
                </div>
              )}

              <button
                type="button"
                className="flex h-9 w-9 items-center justify-center rounded-full text-[#718294] hover:bg-white/80"
                aria-label="Mais opções da conversa"
              >
                <MoreHorizontal size={18} />
              </button>
            </div>

            {isAiConversation && (
              <div className="border-b border-white/80 bg-white/30 px-4 py-4 sm:px-6">
                <div className="relative overflow-hidden rounded-[22px] border border-white/80 bg-[linear-gradient(135deg,rgba(255,255,255,0.82),rgba(235,244,249,0.65))] p-4 shadow-[0_12px_40px_rgba(48,81,107,0.07)]">
                  <div className="pointer-events-none absolute -right-12 -top-16 h-36 w-36 rounded-full bg-white/80 blur-2xl" />

                  <div className="relative flex gap-3">
                    <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[#102f50] text-[#dfbd74]">
                      <Bot size={15} />
                    </div>

                    <div>
                      <div className="text-[11px] font-semibold text-[#233b50]">
                        Seu assistente imobiliário pessoal
                      </div>

                      <p className="mt-1 max-w-2xl text-[10px] leading-5 text-[#718398]">
                        Posso interpretar sua busca, encontrar imóveis,
                        comparar opções e analisar preços usando os dados
                        disponíveis no ImobAI.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {selectedConversation.property && (
              <div className="border-b border-white/80 bg-white/25 px-4 py-3 sm:px-6">
                <div className="flex items-center gap-3 rounded-xl border border-white/80 bg-white/60 px-3 py-2 shadow-sm">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#edf3f7] text-[#526a7d]">
                    <Building2 size={15} />
                  </div>

                  <div className="min-w-0">
                    <div className="text-[9px] uppercase tracking-[0.12em] text-[#8a99a7]">
                      Imóvel relacionado
                    </div>

                    <div className="truncate text-[11px] font-semibold text-[#30475c]">
                      {selectedConversation.property}
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div className="min-h-0 flex-1 space-y-3 overflow-y-auto bg-white/20 p-4 sm:p-6">
              <div className="mx-auto mb-5 w-fit rounded-full border border-white/80 bg-white/55 px-3 py-1 text-[9px] text-[#9aa7b3] shadow-sm">
                Hoje
              </div>

              {selectedMessages.length === 0 &&
                isAiConversation && (
                  <div className="flex min-h-[220px] flex-col items-center justify-center px-4 text-center">
                    <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-[20px] bg-[linear-gradient(145deg,#173d63,#0b223b)] text-[#dfbd74] shadow-[0_14px_35px_rgba(16,47,80,0.18)]">
                      <Sparkles size={23} />
                    </div>

                    <h2 className="text-[18px] font-semibold tracking-[-0.035em] text-[#233b50]">
                      Por onde começamos?
                    </h2>

                    <p className="mt-2 max-w-md text-[11px] leading-5 text-[#8292a0]">
                      Conte o que você procura. O Concierge consegue
                      transformar uma descrição natural em uma busca
                      imobiliária.
                    </p>
                  </div>
                )}

              {selectedMessages.map((message, index) => {
        const previousMessage = selectedMessages[index - 1];
        const isSameSender = previousMessage?.sender === message.sender;

        return (
                <div
                  key={message.id}
                  className={cn(
                    "flex",
                    isSameSender ? "mt-[-6px]" : "mt-0",
                    message.sender === "me"
                      ? "justify-end"
                      : "justify-start"
                  )}
                >
                  {message.sender === "other" &&
                    isAiConversation && (
                      <div className="mr-2 mt-1 hidden h-7 w-7 shrink-0 items-center justify-center rounded-xl bg-[#102f50] text-[#dfbd74] sm:flex">
                        <Sparkles size={12} />
                      </div>
                    )}

                  <div
                    className={cn(
                      "group relative max-w-[82%] rounded-[20px] px-4 py-3 text-[13px] leading-6 font-normal shadow-sm transition-all duration-200 sm:max-w-[72%]",
                      message.sender === "me"
                        ? "rounded-br-[6px] bg-[linear-gradient(135deg,#173a5e,#214d76)] text-white shadow-[0_10px_28px_rgba(23,58,94,0.18)]"
                        : "rounded-bl-[6px] border border-white/90 bg-white/80 text-[#30475c] shadow-[0_8px_28px_rgba(48,81,107,0.07)] backdrop-blur-xl"
                    )}
                  >
                    <div className="whitespace-pre-wrap break-words">
                      {message.text}
                    </div>

                    <div
                      className={cn(
                        "mt-1.5 flex justify-end text-[8px] leading-none",
                        message.sender === "me"
                          ? "text-white/50"
                          : "text-[#9aa7b3]"
                      )}
                    >
                      {message.time}
                    </div>
                  </div>
                </div>
              ); })}

              {sendAiMessage.isPending && isAiConversation && (
                <div className="flex items-start gap-2">
                  <div className="hidden h-7 w-7 shrink-0 items-center justify-center rounded-xl bg-[#102f50] text-[#dfbd74] sm:flex">
                    <Sparkles size={12} />
                  </div>

                  <div className="rounded-[20px] rounded-bl-md border border-white/90 bg-white/75 px-4 py-3 shadow-sm backdrop-blur-xl">
                    <div className="flex items-center gap-2 text-[10px] text-[#7d8d9c]">
                      <Loader2 size={13} className="animate-spin" />
                      O Concierge está analisando sua busca...
                    </div>
                  </div>
                </div>
              )}

              {showSuggestions && (
                <div className="pt-3">
                  <div className="mb-2 px-1 text-[9px] font-medium uppercase tracking-[0.12em] text-[#9aa7b3]">
                    Experimente perguntar
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {suggestedPrompts.map(prompt => (
                      <button
                        key={prompt.label}
                        type="button"
                        onClick={() =>
                          handleSuggestedPrompt(prompt.text)
                        }
                        className="rounded-full border border-white/90 bg-white/60 px-3 py-2 text-[9px] font-medium text-[#496176] shadow-sm backdrop-blur-xl transition hover:-translate-y-0.5 hover:bg-white"
                      >
                        {prompt.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <form
              onSubmit={event => {
                event.preventDefault();
                handleSend();
              }}
              className="border-t border-white/80 bg-white/45 p-3 backdrop-blur-xl sm:p-4"
            >
              <div className="flex items-end gap-2 rounded-[20px] border border-white/90 bg-white/70 p-2 shadow-[0_8px_30px_rgba(38,68,96,0.07)]">
                <button
                  type="button"
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-[#788a9a] hover:bg-white"
                  aria-label="Anexar arquivo"
                >
                  <Paperclip size={16} />
                </button>

                <textarea
                  value={text}
                  onChange={event => setText(event.target.value)}
                  onKeyDown={event => {
                    if (event.key === "Enter" && !event.shiftKey) {
                      event.preventDefault();
                      handleSend();
                    }
                  }}
                  rows={1}
                  disabled={
                    isAiConversation && sendAiMessage.isPending
                  }
                  placeholder={
                    isAiConversation
                      ? "Converse com o Concierge..."
                      : "Digite uma mensagem..."
                  }
                  className="max-h-28 min-h-9 min-w-0 flex-1 resize-none bg-transparent px-1 py-2 text-[12px] text-[#30475c] outline-none placeholder:text-[#9aa7b3] disabled:opacity-60"
                />

                <button
                  type="submit"
                  disabled={
                    !text.trim() ||
                    (isAiConversation && sendAiMessage.isPending)
                  }
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#173a5e] text-white transition hover:bg-[#214c75] disabled:cursor-not-allowed disabled:opacity-35"
                  aria-label="Enviar mensagem"
                >
                  {isAiConversation &&
                  sendAiMessage.isPending ? (
                    <Loader2 size={15} className="animate-spin" />
                  ) : (
                    <Send size={15} />
                  )}
                </button>
              </div>

              <div className="px-1 pt-2 text-[8px] text-[#a0adb8]">
                Enter envia · Shift + Enter cria uma nova linha
              </div>
            </form>
          </section>
        </div>
      </div>
    </main>
  );
}



