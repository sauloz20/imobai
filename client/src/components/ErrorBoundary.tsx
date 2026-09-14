import { cn } from "@/lib/utils";
import { AlertTriangle, RotateCcw } from "lucide-react";
import { Component, ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-background p-8">
          <div className="flex w-full max-w-md flex-col items-center text-center">
            <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-destructive/10">
              <AlertTriangle size={26} className="text-destructive" />
            </div>

            <h2 className="text-[19px] font-semibold tracking-[-0.03em] text-foreground">
              Algo deu errado por aqui
            </h2>
            <p className="mt-2 text-[13px] leading-6 text-muted-foreground">
              Ocorreu um erro inesperado ao carregar esta página. Recarregue para tentar de novo — se o problema continuar, volte mais tarde.
            </p>

            {import.meta.env.DEV && this.state.error?.stack && (
              <div className="mt-5 w-full overflow-auto rounded-xl bg-muted p-4 text-left">
                <pre className="whitespace-break-spaces text-xs text-muted-foreground">
                  {this.state.error.stack}
                </pre>
              </div>
            )}

            <button
              onClick={() => window.location.reload()}
              className={cn(
                "mt-7 flex items-center gap-2 rounded-xl px-5 py-2.5 text-[13px] font-semibold transition",
                "bg-primary text-primary-foreground",
                "hover:opacity-90 cursor-pointer"
              )}
            >
              <RotateCcw size={15} />
              Recarregar página
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
