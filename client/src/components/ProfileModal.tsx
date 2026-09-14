import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { Loader2, LogOut, UserRound, X } from "lucide-react";

export type ProfileModalProps = {
  open: boolean;
  onClose: () => void;
  user: { id: number; name?: string | null; email?: string | null } | null;
  onSave: (values: { name: string; email: string }) => void;
  onLogout: () => void;
  saving: boolean;
};

/** FASE 3.7 — Perfil do usuário: visualizar e editar os próprios dados e encerrar a sessão. */
export function ProfileModal({ open, onClose, user, onSave, onLogout, saving }: ProfileModalProps) {
  if (!open || !user) return null;

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    onSave({
      name: String(data.get("name") || "").trim(),
      email: String(data.get("email") || "").trim(),
    });
  };

  return (
    <>
      <div
        className="fixed inset-0 z-50 flex items-center justify-center overflow-auto bg-[#071426]/65 p-4 backdrop-blur-sm"
        role="dialog"
        aria-modal="true"
        aria-label="Meu perfil"
        onClick={onClose}
      >
        <div
          className="w-full max-w-[420px] rounded-[24px] border border-white/60 bg-white p-6 shadow-[var(--shadow-modal-premium)]"
          onClick={event => event.stopPropagation()}
        >
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#0b1f3a] text-[#e7c984]">
                <UserRound size={20} />
              </div>
              <div>
                <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#8a6110]">Sua conta</div>
                <h2 className="text-[20px] font-semibold tracking-[-0.04em] text-[#102033]">Meu perfil</h2>
              </div>
            </div>
            <button onClick={onClose} className="rounded-lg p-1.5 text-[#8a98a8] transition hover:bg-[#f1f4f7]" aria-label="Fechar">
              <X size={17} />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="mt-5 space-y-3">
            <label className="block">
              <span className="mb-1.5 block text-[10px] font-semibold uppercase tracking-[0.11em] text-[#656e79]">Nome</span>
              <Input name="name" defaultValue={user.name ?? ""} minLength={2} required className="h-10 rounded-xl border-[#dce4ed] bg-[#fbfcfe] text-[12px]" />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-[10px] font-semibold uppercase tracking-[0.11em] text-[#656e79]">Email</span>
              <Input name="email" type="email" defaultValue={user.email ?? ""} required className="h-10 rounded-xl border-[#dce4ed] bg-[#fbfcfe] text-[12px]" />
            </label>
            <Button type="submit" disabled={saving} className="w-full rounded-xl bg-[#c99a3e] text-[12px] font-semibold text-[#071426] hover:bg-[#d9ad58]">
              {saving ? <Loader2 className="mr-2 animate-spin" size={15} /> : null} Salvar alterações
            </Button>
          </form>

          <div className="mt-5 border-t border-[#eef2f6] pt-4">
            <button
              type="button"
              onClick={onLogout}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-[#b03a2e]/20 bg-[#fdf5f4] py-2.5 text-[12px] font-semibold text-[#b03a2e] transition hover:bg-[#fbe9e7]"
            >
              <LogOut size={14} /> Encerrar sessão
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

/** FASE 2.5 — Confirmação antes de excluir um imóvel. */
export function ConfirmDeleteDialog({
  open,
  propertyTitle,
  onCancel,
  onConfirm,
  pending,
}: {
  open: boolean;
  propertyTitle: string;
  onCancel: () => void;
  onConfirm: () => void;
  pending: boolean;
}) {
  return (
    <AlertDialog open={open}>
      <AlertDialogContent className="max-w-[420px] rounded-[22px] border-[#e7ecf2] bg-white">
        <AlertDialogHeader>
          <AlertDialogTitle className="text-[18px] font-semibold tracking-[-0.03em] text-[#102033]">Excluir este imóvel?</AlertDialogTitle>
          <AlertDialogDescription className="text-[12px] leading-5 text-[#5c6b7d]">
            {propertyTitle ? `"${propertyTitle}" ` : "Este imóvel "}será removido permanentemente do catálogo, junto com as fotos. As negociações abertas são mantidas no histórico.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onCancel} className="rounded-xl border-[#dce4ed] bg-white text-[12px] font-semibold text-[#40536a]">
            Cancelar
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={event => {
              event.preventDefault();
              onConfirm();
            }}
            disabled={pending}
            className={cn("rounded-xl bg-[#b03a2e] text-[12px] font-semibold text-white hover:bg-[#9a3128]", pending && "opacity-70")}
          >
            {pending ? <Loader2 className="mr-2 animate-spin" size={14} /> : null} Excluir definitivamente
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
