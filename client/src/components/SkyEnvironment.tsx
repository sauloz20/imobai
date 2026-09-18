import type { ReactNode } from "react";
import { CloudShader } from "@/components/ui/cloud-shader";
import { cn } from "@/lib/utils";

type SkyIntensity = "strong" | "medium" | "soft" | "subtle";

interface SkyEnvironmentProps {
  children?: ReactNode;
  className?: string;
  intensity?: SkyIntensity;
  shaderClassName?: string;
  showShader?: boolean;
}

const intensityClasses: Record<SkyIntensity, string> = {
  strong: "opacity-100",
  medium: "opacity-75",
  soft: "opacity-50",
  subtle: "opacity-30",
};

export function SkyEnvironment({
  children,
  className,
  intensity = "medium",
  shaderClassName,
  showShader = true,
}: SkyEnvironmentProps) {
  return (
    <div className={cn("relative min-h-screen", className)}>
      {showShader && (
        <div
          aria-hidden="true"
          className={cn(
            "fixed inset-0 z-0 pointer-events-none overflow-hidden",
            intensityClasses[intensity]
          )}
        >
          <CloudShader
            className={cn("h-full w-full", shaderClassName)}
          />
        </div>
      )}

      <div
        aria-hidden="true"
        className="fixed inset-0 z-[1] pointer-events-none bg-[radial-gradient(circle_at_50%_0%,rgba(255,255,255,0.28),transparent_60%)]"
      />

      <div className="relative z-10 min-h-screen">
        {children}
      </div>
    </div>
  );
}