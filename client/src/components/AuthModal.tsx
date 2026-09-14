import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { Loader2, ShieldCheck, X } from "lucide-react";
import { useState } from "react";

export type AuthModalProps = {
  open: boolean;
  mode: "login" | "register";
  onModeChange: (mode: "login" | "register") => void;
  onClose: () => void;
  onSubmit: (values: { name: string; email: string; password: string }) => void;
  pending: boolean;
};

export function AuthModal({ open, mode, onModeChange, onClose, onSubmit, pending }: AuthModalProps) {
  const [form, setForm] = useState({ name: "", email: "", password: "" });

  if (!open) return null;

  const canSubmit = mode === "login" ? Boolean(form.email && form.password) : Boolean(form.name && form.email && form.password.length >= 8);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#071426]/65 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label={mode === "login" ? "Entrar no ImobAI" : "Criar conta no ImobAI"}
      onClick={onClose}
    >
      <div
        className="imobai-reveal w-full max-w-[430px] rounded-[24px] border border-white/60 bg-white p-6 shadow-[var(--shadow-modal-premium)]"
        onClick={event => event.stopPropagation()}
      >
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.16em] text-[#8a6110]">
              <ShieldCheck size={12} /> Acesso seguro
            </div>
            <h2 className="mt-1.5 text-[22px] font-semibold tracking-[-0.04em] text-[#102033]">
              {mode === "login" ? "Entre no ImobAI" : "Crie sua conta"}
            </h2>
            <p className="mt-1 text-[12px] leading-5 text-[#656e79]">
              {mode === "login" ? "Acesse seus imóveis, negociações e seu concierge privado." : "Tenha um portfólio, uma inbox e um histórico individual com a IA."}
            </p>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-[#8a98a8] transition hover:bg-[#f1f4f7]" aria-label="Fechar">
            <X size={17} />
          </button>
        </div>

        {mode === "register" && (
          <label className="mt-5 block">
            <span className="mb-1.5 block text-[10px] font-semibold uppercase tracking-[0.11em] text-[#656e79]">Nome completo</span>
            <Input
              value={form.name}
              onChange={event => setForm({ ...form, name: event.target.value })}
              placeholder="Ex.: Ana Martins"
              className="h-11 rounded-xl border-[#dce4ed] bg-[#fbfcfe] text-[13px]"
            />
          </label>
        )}

        <label className="mt-4 block">
          <span className="mb-1.5 block text-[10px] font-semibold uppercase tracking-[0.11em] text-[#656e79]">Email</span>
          <Input
            type="email"
            value={form.email}
            onChange={event => setForm({ ...form, email: event.target.value })}
            placeholder="voce@email.com"
            className="h-11 rounded-xl border-[#dce4ed] bg-[#fbfcfe] text-[13px]"
          />
        </label>

        <label className="mt-4 block">
          <span className="mb-1.5 block text-[10px] font-semibold uppercase tracking-[0.11em] text-[#656e79]">Senha</span>
          <Input
            type="password"
            value={form.password}
            onChange={event => setForm({ ...form, password: event.target.value })}
            placeholder="Mínimo de 8 caracteres"
            className="h-11 rounded-xl border-[#dce4ed] bg-[#fbfcfe] text-[13px]"
          />
        </label>

        <button
          onClick={() => canSubmit && onSubmit(form)}
          disabled={!canSubmit || pending}
          className={cn(
            "mt-5 h-11 w-full rounded-xl text-[13px] font-semibold transition",
            canSubmit
              ? "bg-[#c99a3e] text-[#071426] shadow-[0_10px_26px_rgba(201,154,62,0.3)] hover:bg-[#d9ad58]"
              : "cursor-not-allowed bg-[#eef2f6] text-[#a7b2c0]"
          )}
        >
          {pending ? <Loader2 size={16} className="mx-auto animate-spin" /> : mode === "login" ? "Entrar na conta" : "Criar conta"}
        </button>

        <button
          onClick={() => onModeChange(mode === "login" ? "register" : "login")}
          className="mt-4 w-full text-center text-[11px] font-semibold text-[#62829e] transition hover:text-[#0b1f3a]"
        >
          {mode === "login" ? "Ainda não tenho conta — criar agora" : "Já tenho conta — entrar"}
        </button>

        <p className="mt-4 text-center text-[10px] leading-4 text-[#a0acb9]">A senha é armazenada como hash seguro e nunca é exibida na aplicação.</p>
      </div>
    </div>
  );
}
