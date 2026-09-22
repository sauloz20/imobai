import { useMemo, useState } from "react";
import {
  ArrowLeft,
  Bot,
  Building2,
  ChevronLeft,
  MessageCircle,
  MoreHorizontal,
  Paperclip,
  Search,
  Send,
  UserRound,
} from "lucide-react";
import { Link } from "wouter";

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
    preview: "Posso ajudar a encontrar um imóvel...",
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

const initialMessages: Record<string, Array<{ id: string; sender: "me" | "other"; text: string; time: string }>> = {
  concierge: [
    {
      id: "ai-1",
      sender: "other",
      text: "Olá! Sou o Concierge IA do ImobAI. Posso ajudar você a encontrar imóveis, comparar opções, analisar anúncios e entender bairros.",
      time: "Agora",
    },
  ],
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

function Avatar({ type }: { type: Conversation["type"] }) {
  if (type === "ai") {
    return (
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#102f50] text-[#d7b56a]">
        <Bot size={19} />
      </div>
    );
  }

  return (
    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#e8eef4] text-[#486176]">
      <UserRound size={18} />
    </div>
  );
}

export default function Messages() {
  const [selectedId, setSelectedId] = useState("concierge");
  const [text, setText] = useState("");
  const [mobileChatOpen, setMobileChatOpen] = useState(false);
  const [messages, setMessages] = useState(initialMessages);

  const selectedConversation = useMemo(
    () => conversations.find(conversation => conversation.id === selectedId) ?? conversations[0],
    [selectedId]
  );

  const selectedMessages = messages[selectedConversation.id] ?? [];

  const handleSelectConversation = (id: string) => {
    setSelectedId(id);
    setMobileChatOpen(true);
  };

  const handleSend = () => {
    const value = text.trim();

    if (!value) return;

    setMessages(current => ({
      ...current,
      [selectedConversation.id]: [
        ...(current[selectedConversation.id] ?? []),
        {
          id: `${selectedConversation.id}-${Date.now()}`,
          sender: "me",
          text: value,
          time: "Agora",
        },
      ],
    }));

    setText("");
  };

  return (
    <main className="min-h-screen bg-[#eef4f8] text-[#102033]">
      <header className="border-b border-[#dce6ee] bg-white/85 backdrop-blur-xl">
        <div className="mx-auto flex h-[72px] max-w-[1440px] items-center justify-between px-4 sm:px-8">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="flex h-10 w-10 items-center justify-center rounded-full text-[#40536a] transition hover:bg-[#eef4f8]"
              aria-label="Voltar para o início"
            >
              <ArrowLeft size={19} />
            </Link>

            <div className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#102f50] text-white">
                <MessageCircle size={17} />
              </div>
              <div>
                <div className="text-[15px] font-bold tracking-[-0.035em]">
                  Mensagens
                </div>
                <div className="text-[10px] text-[#718398]">
                  IA, compradores e vendedores
                </div>
              </div>
            </div>
          </div>

          <button
            type="button"
            className="flex h-10 w-10 items-center justify-center rounded-full text-[#40536a] transition hover:bg-[#eef4f8]"
            aria-label="Mais opções"
          >
            <MoreHorizontal size={20} />
          </button>
        </div>
      </header>

      <div className="mx-auto flex max-w-[1440px] px-3 py-4 sm:px-6 lg:py-6">
        <div className="flex min-h-[calc(100vh-120px)] w-full overflow-hidden rounded-[28px] border border-[#dce6ee] bg-white shadow-[0_18px_60px_rgba(38,68,96,0.10)]">
          <aside
            className={`w-full border-r border-[#e5ebf0] bg-white md:w-[360px] md:shrink-0 ${
              mobileChatOpen ? "hidden md:block" : "block"
            }`}
          >
            <div className="border-b border-[#edf1f4] p-5">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h1 className="text-[20px] font-semibold tracking-[-0.04em]">
                    Conversas
                  </h1>
                  <p className="mt-1 text-[11px] text-[#8090a0]">
                    Suas conversas no ImobAI
                  </p>
                </div>
                <MessageCircle size={18} className="text-[#7890a5]" />
              </div>

              <div className="flex h-10 items-center gap-2 rounded-xl bg-[#f3f6f8] px-3 text-[#8a99a8]">
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
                    onClick={() => handleSelectConversation(conversation.id)}
                    className={`flex w-full items-center gap-3 rounded-2xl p-3 text-left transition ${
                      active
                        ? "bg-[#edf4f8]"
                        : "hover:bg-[#f6f8fa]"
                    }`}
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
                          <span className="truncate">{conversation.property}</span>
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
            className={`flex min-w-0 flex-1 flex-col ${
              mobileChatOpen ? "flex" : "hidden md:flex"
            }`}
          >
            <div className="flex min-h-[72px] items-center gap-3 border-b border-[#e8edf1] bg-white px-4 sm:px-6">
              <button
                type="button"
                onClick={() => setMobileChatOpen(false)}
                className="flex h-9 w-9 items-center justify-center rounded-full text-[#526577] hover:bg-[#eef4f8] md:hidden"
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
                  {selectedConversation.type === "ai"
                    ? "Assistente imobiliário"
                    : "Conversa sobre imóvel"}
                </div>
              </div>

              <button
                type="button"
                className="flex h-9 w-9 items-center justify-center rounded-full text-[#718294] hover:bg-[#eef4f8]"
                aria-label="Mais opções da conversa"
              >
                <MoreHorizontal size={18} />
              </button>
            </div>

            {selectedConversation.property && (
              <div className="border-b border-[#edf1f4] bg-[#f8fafb] px-4 py-3 sm:px-6">
                <div className="flex items-center gap-3 rounded-xl border border-[#e4ebf0] bg-white px-3 py-2">
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

            <div className="flex-1 space-y-3 overflow-y-auto bg-[#f7fafc] p-4 sm:p-6">
              <div className="mx-auto mb-5 w-fit rounded-full bg-white px-3 py-1 text-[9px] text-[#9aa7b3] shadow-sm">
                Hoje
              </div>

              {selectedMessages.map(message => (
                <div
                  key={message.id}
                  className={`flex ${
                    message.sender === "me" ? "justify-end" : "justify-start"
                  }`}
                >
                  <div
                    className={`max-w-[78%] rounded-[18px] px-4 py-3 text-[11px] leading-5 shadow-sm ${
                      message.sender === "me"
                        ? "rounded-br-md bg-[#173a5e] text-white"
                        : "rounded-bl-md border border-[#e3eaf0] bg-white text-[#45596b]"
                    }`}
                  >
                    <div>{message.text}</div>
                    <div
                      className={`mt-1 text-[8px] ${
                        message.sender === "me"
                          ? "text-white/50"
                          : "text-[#9aa7b3]"
                      }`}
                    >
                      {message.time}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <form
              onSubmit={event => {
                event.preventDefault();
                handleSend();
              }}
              className="border-t border-[#e5ebf0] bg-white p-3 sm:p-4"
            >
              <div className="flex items-end gap-2 rounded-2xl border border-[#dce5ec] bg-[#f8fafc] p-2">
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
                  placeholder={
                    selectedConversation.type === "ai"
                      ? "Pergunte algo ao Concierge IA..."
                      : "Digite uma mensagem..."
                  }
                  className="max-h-28 min-h-9 min-w-0 flex-1 resize-none bg-transparent px-1 py-2 text-[12px] text-[#30475c] outline-none placeholder:text-[#9aa7b3]"
                />

                <button
                  type="submit"
                  disabled={!text.trim()}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#173a5e] text-white transition hover:bg-[#214c75] disabled:cursor-not-allowed disabled:opacity-35"
                  aria-label="Enviar mensagem"
                >
                  <Send size={15} />
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
