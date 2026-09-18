import { Building2, Menu, Plus, UserRound } from "lucide-react";
import { Link } from "wouter";

export type GlobalHeaderProps = {
  onLogin?: () => void;
  onMenu?: () => void;
  userName?: string | null;
  onProfile?: () => void;
};

export function GlobalHeader({
  onLogin,
  onMenu,
  userName,
  onProfile,
}: GlobalHeaderProps) {
  return (
    <header className="fixed inset-x-0 top-0 z-[90] px-4 pt-5 sm:px-8 drop-shadow-[0_3px_12px_rgba(15,45,65,0.18)]">
      <div className="mx-auto flex h-14 max-w-[1380px] items-center justify-between">
        {/* Logo */}
        <Link
          href="/"
          className="flex items-center gap-2.5 drop-shadow-[0_3px_10px_rgba(15,45,65,0.22)]"
          aria-label="Ir para o inÃ­cio"
        >
          <span className="flex h-9 w-9 items-center justify-center text-[#10233f]">
            <Building2 size={19} strokeWidth={2} />
          </span>

          <span className="text-[17px] font-bold tracking-[-0.045em] text-[#102033]">
            Imob<span className="text-[#8a6110]">AI</span>
          </span>
        </Link>

        {/* NavegaÃ§Ã£o */}
        <nav
          className="hidden items-center gap-1 md:flex"
          aria-label="NavegaÃ§Ã£o principal"
        >
        </nav>

        {/* AÃ§Ãµes */}
        <div className="flex items-center gap-3">
          {userName ? (
            <button
              type="button"
              onClick={onProfile}
              className="hidden items-center gap-2 text-[12px] font-semibold text-[#40536a] transition-colors hover:text-[#102033] sm:flex"
            >
              <UserRound size={15} />
              {userName}
            </button>
          ) : (
            <button
              type="button"
              onClick={onLogin}
              className="hidden text-[12px] font-semibold text-[#102033] drop-shadow-[0_2px_8px_rgba(255,255,255,0.8)] transition-colors hover:text-[#f3d28a] sm:block"
            >
              Entrar
            </button>
          )}

          {/* Menu */}
          <button
            type="button"
            onClick={onMenu}
            aria-label="Abrir menu"
            className="flex h-9 w-9 items-center justify-center text-[#102033] drop-shadow-[0_3px_10px_rgba(255,255,255,0.85)] transition-colors hover:text-[#f3d28a]"
          >
            <Menu size={20} strokeWidth={1.8} />
          </button>
        </div>
      </div>
    </header>
  );
}

export function PublishPill({ onClick }: { onClick?: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1.5 rounded-xl border border-[#d6e1eb] bg-white px-3 py-2 text-[11px] font-semibold text-[#40536a] hover:border-[#c99a3e]/50 hover:text-[#8a6110]"
    >
      <Plus size={13} />
      Anunciar imÃ³vel
    </button>
  );
}






