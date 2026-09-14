import { Building2, ArrowRight, Compass, SearchX } from "lucide-react";

export default function NotFound() {
  return (
    <div className="imobai-app-shell flex min-h-screen w-full items-center justify-center px-5 py-12">
      <div className="imobai-reveal w-full max-w-[480px] text-center">
        <a href="/" className="mb-8 inline-flex items-center gap-2 text-[15px] font-semibold tracking-[-0.03em] text-[#102033]">
          Imob<span className="text-[#c99a3e]">AI</span>
        </a>

        <div className="imobai-editorial-panel rounded-[26px] px-6 py-10 sm:px-10 sm:py-12">
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-[#fff5df]">
            <SearchX size={26} className="text-[#8a6110]" aria-hidden />
          </div>

          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#8a6110]">Erro 404</p>
          <h1 className="mt-2 text-[26px] font-semibold tracking-[-0.03em] text-[#102033] sm:text-[30px]">
            Este endereço não existe no nosso mapa
          </h1>
          <p className="mx-auto mt-3 max-w-[360px] text-[13.5px] leading-6 text-[#616e81]">
            O link pode ter mudado ou o imóvel que você procurava já não está disponível. Vamos te levar de volta para continuar a busca.
          </p>

          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <a
              href="/"
              className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#c99a3e] px-6 text-[13px] font-semibold text-[#071426] shadow-[0_14px_34px_rgba(201,154,62,0.35)] transition hover:bg-[#d9ad58] sm:w-auto"
            >
              Voltar ao início <ArrowRight size={16} />
            </a>
            <a
              href="/catalogo"
              className="flex h-12 w-full items-center justify-center gap-2 rounded-xl border border-[#d8e1ea] bg-white px-6 text-[13px] font-semibold text-[#40536a] transition hover:border-[#c99a3e]/40 hover:bg-[#fffaf0] hover:text-[#8a6110] sm:w-auto"
            >
              <Compass size={15} /> Explorar catálogo
            </a>
          </div>
        </div>

        <p className="mt-6 flex items-center justify-center gap-1.5 text-[11px] text-[#656e79]">
          <Building2 size={12} aria-hidden /> ImobAI · inteligência imobiliária
        </p>
      </div>
    </div>
  );
}
