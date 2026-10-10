import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";

export function Logo() {
  return (
    <Link to="/" className="flex items-baseline gap-1 text-foreground" aria-label="Revec.ai home">
      <span className="font-display text-3xl">Revec</span>
      <span className="font-mono text-xs text-primary">.ai</span>
    </Link>
  );
}

export function SiteHeader({ showStart = true }: { showStart?: boolean }) {
  return (
    <header className="sticky top-0 z-40 border-b border-border/70 bg-background/85 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5">
        <Logo />
        {showStart && <Button variant="quiet" size="sm" asChild>
          <Link to="/analyze">Start an analysis</Link>
        </Button>}
      </div>
    </header>
  );
}
