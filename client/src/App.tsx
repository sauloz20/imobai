import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { MotionConfig } from "framer-motion";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Catalog from "./pages/Catalog";
import Home from "./pages/Home";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/catalogo" component={Catalog} />
      <Route path="/404" component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        {/* reducedMotion="user" makes every Framer Motion animation (e.g. PropertyCard) honor
            the OS-level prefers-reduced-motion setting — the CSS media query in index.css only
            covers CSS transitions/keyframes, not JS-driven Framer Motion animations. */}
        <MotionConfig reducedMotion="user">
          <TooltipProvider>
            <Toaster />
            <Router />
          </TooltipProvider>
        </MotionConfig>
      </ThemeProvider>
    </ErrorBoundary>
  );
}
