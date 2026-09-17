import { Loader2 } from "lucide-react";

/** Small spinning indicator for in-flight buttons — pair with a "…ing" label, not alone. */
export function Spinner({ className = "h-4 w-4" }: { className?: string }) {
  return <Loader2 className={`animate-spin ${className}`} aria-hidden="true" />;
}
