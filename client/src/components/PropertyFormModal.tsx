import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { Check, ImagePlus, Loader2, Sparkles, X } from "lucide-react";
import { useEffect, useMemo } from "react";
import { toast } from "sonner";

export type PropertyFormValues = {
  tipo: string;
  bairro: string;
  cidade: string;
  quartos: number;
  banheiros: number;
  vagas: number;
  areaM2: number;
  valorVenda: number;
  valorAluguel: number;
  descricaoTecnica: string;
  diferenciais: string;
};

export type GeneratedCopy = {
  titulo_comercial: string;
  descricao_persuasiva: string;
  destaques: string[];
  cta: string;
  hashtags: string[];
  source: "qwen" | "fallback";
};

type PropertyFormModalProps = {
  open: boolean;
  /** "create" publica um novo imóvel; "edit" salva alterações em um imóvel existente. */
  mode?: "create" | "edit";
  onClose: () => void;
  values: PropertyFormValues;
  onValuesChange: (values: PropertyFormValues) => void;
  files: File[];
  onFilesChange: (files: File[]) => void;
  copy: GeneratedCopy | null;
  onCopyChange: (copy: GeneratedCopy | null) => void;
  onGenerateCopy: () => void;
  generatingCopy: boolean;
  onSubmit: () => Promise<void>;
  submitting: boolean;
};

const fileToBase64 = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const value = String(reader.result || "");
      resolve(value.includes(",") ? value.split(",")[1] || "" : value);
    };
    reader.onerror = () => reject(reader.error || new Error("Não foi possível ler a imagem"));
    reader.readAsDataURL(file);
  });

export function PropertyFormModal({
  open,
  mode = "create",
  onClose,
  values,
  onValuesChange,
  files,
  onFilesChange,
  copy,
  onCopyChange,
  onGenerateCopy,
  generatingCopy,
  onSubmit,
  submitting,
}: PropertyFormModalProps) {
  const photoPreviews = useMemo(() => files.map(file => ({ file, url: URL.createObjectURL(file) })), [files]);
  useEffect(() => () => photoPreviews.forEach(item => URL.revokeObjectURL(item.url)), [photoPreviews]);

  const handlePhotoSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(event.target.files || []);
    const valid = selected.filter(file => file.type.startsWith("image/") && file.size <= 4 * 1024 * 1024);
    if (valid.length !== selected.length) toast.error("Use apenas imagens de até 4 MB cada");
    const total = files.length + valid.length;
    if (total > 20) toast.info("Cada anúncio pode ter no máximo 20 fotos");
    onFilesChange([...files, ...valid].slice(0, 20));
    event.target.value = "";
  };

  const handleSubmit = async () => {
    if (!values.bairro.trim()) {
      toast.error("Informe o bairro do imóvel");
      return;
    }
    await onSubmit();
  };

  if (!open) return null;

  const editing = mode === "edit";
  const completedSteps = [Boolean(values.bairro.trim() && values.cidade.trim()), Boolean(values.areaM2 && values.quartos >= 0), Boolean(files.length || editing), Boolean(copy)].filter(Boolean).length;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center overflow-auto bg-[#071426]/65 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label={editing ? "Editar imóvel" : "Cadastrar imóvel"}
      onClick={onClose}
    >
      <div
        className="w-full max-w-[680px] rounded-[24px] border border-white/60 bg-white p-6 shadow-[var(--shadow-modal-premium)]"
        onClick={event => event.stopPropagation()}
      >
        <div className="flex items-start justify-between">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#8a6110]">{editing ? "Editar anúncio" : "Novo anúncio"}</div>
            <h2 className="mt-1 text-[22px] font-semibold tracking-[-0.04em] text-[#102033]">{editing ? "Editar imóvel" : "Cadastrar imóvel"}</h2>
            <p className="mt-1 text-[12px] text-[#656e79]">{editing ? "Altere as informações do anúncio e salve para atualizar o catálogo." : "A IA melhora o texto do anúncio e você pode incluir até 20 fotos."}</p>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-[#8a98a8] transition hover:bg-[#f1f4f7]" aria-label="Fechar">
            <X size={17} />
          </button>
        </div>

        <div className="mt-5 rounded-2xl border border-[#e8edf3] bg-[#fbfcfe] p-3">
          <div className="flex items-center justify-between text-[10px] font-semibold uppercase tracking-[0.12em] text-[#6c7f91]">
            <span>{editing ? "Revisão do anúncio" : "Publicação guiada"}</span>
            <span className="text-[#8a6110]">{completedSteps}/4 etapas</span>
          </div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[#e8edf3]">
            <div className="h-full rounded-full bg-gradient-to-r from-[#2f6f9f] to-[#c99a3e] transition-all" style={{ width: `${Math.max(12, completedSteps * 25)}%` }} />
          </div>
          <div className="mt-2 grid grid-cols-4 gap-1 text-[9px] text-[#8a98a8]">
            <span>Dados</span><span>Características</span><span>Fotos</span><span>Revisão IA</span>
          </div>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <Field label="Tipo">
            <select
              value={values.tipo}
              onChange={event => onValuesChange({ ...values, tipo: event.target.value })}
              className="h-10 w-full rounded-xl border border-[#dce4ed] bg-[#fbfcfe] px-3 text-[12px] text-[#2b3d53] outline-none focus:border-[#c99a3e]/60"
            >
              <option>Apartamento</option><option>Casa</option><option>Sobrado</option><option>Terreno</option><option>Cobertura</option>
            </select>
          </Field>
          <Field label="Bairro">
            <Input value={values.bairro} onChange={event => onValuesChange({ ...values, bairro: event.target.value })} placeholder="Ex.: Pinheiros" className="h-10 rounded-xl border-[#dce4ed] bg-[#fbfcfe] text-[12px]" />
          </Field>
          <Field label="Cidade">
            <Input value={values.cidade} onChange={event => onValuesChange({ ...values, cidade: event.target.value })} className="h-10 rounded-xl border-[#dce4ed] bg-[#fbfcfe] text-[12px]" />
          </Field>
          <Field label="Área (m²)">
            <Input type="number" value={values.areaM2} onChange={event => onValuesChange({ ...values, areaM2: Number(event.target.value) })} className="h-10 rounded-xl border-[#dce4ed] bg-[#fbfcfe] text-[12px]" />
          </Field>
          <Field label="Quartos">
            <Input type="number" value={values.quartos} onChange={event => onValuesChange({ ...values, quartos: Number(event.target.value) })} className="h-10 rounded-xl border-[#dce4ed] bg-[#fbfcfe] text-[12px]" />
          </Field>
          <Field label="Banheiros">
            <Input type="number" value={values.banheiros} onChange={event => onValuesChange({ ...values, banheiros: Number(event.target.value) })} className="h-10 rounded-xl border-[#dce4ed] bg-[#fbfcfe] text-[12px]" />
          </Field>
          <Field label="Vagas">
            <Input type="number" value={values.vagas} onChange={event => onValuesChange({ ...values, vagas: Number(event.target.value) })} className="h-10 rounded-xl border-[#dce4ed] bg-[#fbfcfe] text-[12px]" />
          </Field>
          <Field label="Preço de venda">
            <Input type="number" value={values.valorVenda} onChange={event => onValuesChange({ ...values, valorVenda: Number(event.target.value) })} placeholder="Opcional" className="h-10 rounded-xl border-[#dce4ed] bg-[#fbfcfe] text-[12px]" />
          </Field>
          <Field label="Preço de locação">
            <Input type="number" value={values.valorAluguel} onChange={event => onValuesChange({ ...values, valorAluguel: Number(event.target.value) })} placeholder="Opcional" className="h-10 rounded-xl border-[#dce4ed] bg-[#fbfcfe] text-[12px]" />
          </Field>
        </div>

        <Field label="Diferenciais do imóvel" className="mt-3">
          <Input value={values.diferenciais} onChange={event => onValuesChange({ ...values, diferenciais: event.target.value })} placeholder="Ex.: varanda, armários planejados, luz natural" className="h-10 rounded-xl border-[#dce4ed] bg-[#fbfcfe] text-[12px]" />
        </Field>

        <Field label="Descrição técnica" className="mt-3">
          <Textarea value={values.descricaoTecnica} onChange={event => onValuesChange({ ...values, descricaoTecnica: event.target.value })} placeholder="Fale sobre planta, conservação, posição solar e outros fatos do imóvel..." className="min-h-[82px] resize-none rounded-xl border-[#dce4ed] bg-[#fbfcfe] text-[12px]" />
        </Field>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-[#f0dfaa] bg-[#fffaf0] p-3">
          <div>
            <div className="text-[11px] font-semibold text-[#765d20]">Descrição comercial com IA</div>
            <p className="mt-1 text-[10px] leading-4 text-[#997f3a]">O Qwen cria título, descrição, destaques e chamada para visita usando somente os dados informados.</p>
          </div>
          <Button type="button" onClick={onGenerateCopy} disabled={generatingCopy} variant="outline" className="rounded-xl border-[#e6c86e] bg-white text-[11px] font-semibold text-[#86671b]">
            {generatingCopy ? <Loader2 className="mr-2 animate-spin" size={14} /> : <Sparkles className="mr-2" size={14} />} Gerar descrição
          </Button>
        </div>

        {copy && (
          <div className="mt-3 rounded-2xl border border-[#dce8f2] bg-[#f7fbfe] p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-[14px] font-semibold text-[#243b53]">{copy.titulo_comercial}</div>
                <p className="mt-2 whitespace-pre-line text-[11px] leading-5 text-[#60758a]">{copy.descricao_persuasiva}</p>
              </div>
              <Badge className="shrink-0 border-0 bg-[#e6f5eb] text-[10px] text-[#3c8d5d]">{copy.source === "qwen" ? "Qwen" : "Fallback"}</Badge>
            </div>
            <div className="mt-3 flex flex-wrap gap-1.5">{copy.destaques.map(item => <span key={item} className="rounded-full bg-white px-2 py-1 text-[10px] text-[#5d7892] shadow-sm">{item}</span>)}</div>
            <p className="mt-3 text-[11px] font-semibold text-[#3b6687]">{copy.cta}</p>
          </div>
        )}

        {!editing && (
        <div className="mt-4 rounded-2xl border border-dashed border-[#cbd9e5] bg-[#fbfcfe] p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <div className="flex items-center gap-2 text-[11px] font-semibold text-[#3b5e7d]">
                <ImagePlus size={15} /> Galeria do anúncio
                <span className="rounded-full bg-[#eaf2f8] px-2 py-0.5 text-[10px] text-[#5a7b96]">{files.length}/20 fotos</span>
              </div>
              <p className="mt-1 text-[10px] text-[#8494a5]">JPG, PNG, WEBP ou GIF · até 4 MB por imagem.</p>
            </div>
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-[#0b1f3a] px-3.5 py-2.5 text-[11px] font-semibold text-white transition hover:bg-[#12345a]">
              <ImagePlus size={14} /> Adicionar fotos
              <input type="file" accept="image/jpeg,image/png,image/webp,image/gif" multiple className="hidden" onChange={handlePhotoSelect} disabled={files.length >= 20} />
            </label>
          </div>
          {photoPreviews.length > 0 && (
            <div className="mt-3 grid grid-cols-4 gap-2 sm:grid-cols-5">
              {photoPreviews.map((item, index) => (
                <div key={`${item.file.name}-${index}`} className="group relative aspect-square overflow-hidden rounded-xl bg-[#e8eef3]">
                  <img src={item.url} alt={`Foto ${index + 1} do anúncio`} className="h-full w-full object-cover" />
                  <button
                    type="button"
                    onClick={() => onFilesChange(files.filter((_, itemIndex) => itemIndex !== index))}
                    className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-[#0b1f3a]/80 text-white opacity-0 transition group-hover:opacity-100"
                    aria-label={`Remover foto ${index + 1}`}
                  >
                    <X size={12} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
        )}

        <div className="mt-5 flex justify-end gap-2">
          <Button variant="outline" onClick={onClose} className="rounded-xl bg-white text-[12px]">Cancelar</Button>
          <Button onClick={handleSubmit} disabled={submitting} className="rounded-xl bg-[#c99a3e] text-[12px] font-semibold text-[#071426] hover:bg-[#d9ad58]">
            {submitting ? <Loader2 className="mr-2 animate-spin" size={15} /> : <Check className="mr-2" size={15} />}{editing ? "Salvar alterações" : "Publicar imóvel"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children, className = "" }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <label className={cn("block", className)}>
      <span className="mb-1.5 block text-[10px] font-semibold uppercase tracking-[0.11em] text-[#656e79]">{label}</span>
      {children}
    </label>
  );
}

export { fileToBase64 };
