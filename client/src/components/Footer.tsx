import { ArrowUpRight, Instagram, Linkedin, MessageCircle } from "lucide-react";

const exploreLinks = [
  { label: "Encontrar imóveis", href: "#featured-properties" },
  { label: "Comprar", href: "#featured-properties" },
  { label: "Alugar", href: "#featured-properties" },
];

const imobaiLinks = [
  { label: "Sobre o ImobAI", href: "#sobre" },
  { label: "Como funciona", href: "#como-funciona" },
  { label: "Concierge IA", href: "#concierge" },
];

const supportLinks = [
  { label: "Central de ajuda", href: "#ajuda" },
  { label: "Contato", href: "#contato" },
];

export function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="relative overflow-hidden bg-[#071426] text-white">
      {/* Atmosfera de céu */}
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-40 opacity-30"
        aria-hidden="true"
        style={{
          background:
            "radial-gradient(circle at 18% 20%, rgba(255,255,255,0.16), transparent 28%), radial-gradient(circle at 72% 10%, rgba(201,154,62,0.14), transparent 24%), linear-gradient(to bottom, rgba(43,110,158,0.18), transparent)",
        }}
      />

      <div className="relative mx-auto max-w-[1180px] px-5 pb-7 pt-12 sm:px-8 sm:pt-14">
        {/* Conteúdo principal */}
        <div className="grid gap-10 border-b border-white/10 py-10 sm:grid-cols-[1.5fr_1fr_1fr_1fr] sm:gap-8">
          <div>
            <a
              href="/"
              className="inline-flex items-center text-[25px] font-semibold tracking-[-0.04em] text-white"
            >
              Imob<span className="text-[#c99a3e]">AI</span>
            </a>

            <p className="mt-4 max-w-[290px] text-[13px] leading-6 text-white/45">
              Inteligência para encontrar, comparar e decidir sobre imóveis
              de um jeito mais simples.
            </p>

            <div className="mt-5 flex items-center gap-2">
              <a
                href="#"
                aria-label="Instagram"
                className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 text-white/55 transition hover:border-[#c99a3e]/50 hover:text-[#d9ad58]"
              >
                <Instagram size={15} />
              </a>

              <a
                href="#"
                aria-label="LinkedIn"
                className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 text-white/55 transition hover:border-[#c99a3e]/50 hover:text-[#d9ad58]"
              >
                <Linkedin size={15} />
              </a>

              <a
                href="#"
                aria-label="WhatsApp"
                className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 text-white/55 transition hover:border-[#c99a3e]/50 hover:text-[#d9ad58]"
              >
                <MessageCircle size={15} />
              </a>
            </div>
          </div>

          <FooterColumn title="Explorar" links={exploreLinks} />
          <FooterColumn title="ImobAI" links={imobaiLinks} />
          <FooterColumn title="Suporte" links={supportLinks} />
        </div>

        {/* Rodapé inferior */}
        <div className="flex flex-col gap-4 pt-6 text-[10px] text-white/35 sm:flex-row sm:items-center sm:justify-between">
          <p>
            © {currentYear} ImobAI. Inteligência para decisões imobiliárias.
          </p>

          <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
            <a href="#privacidade" className="transition hover:text-white/70">
              Privacidade
            </a>
            <a href="#termos" className="transition hover:text-white/70">
              Termos
            </a>
            <a href="#contato" className="transition hover:text-white/70">
              Contato
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}

function FooterColumn({
  title,
  links,
}: {
  title: string;
  links: Array<{ label: string; href: string }>;
}) {
  return (
    <div>
      <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/45">
        {title}
      </h3>

      <nav className="mt-4 flex flex-col items-start gap-3">
        {links.map(link => (
          <a
            key={link.label}
            href={link.href}
            className="text-[12px] text-white/60 transition hover:text-[#d9ad58]"
          >
            {link.label}
          </a>
        ))}
      </nav>
    </div>
  );
}

