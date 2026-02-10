import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";

interface LoadingOverlayProps {
  /** Height class (default: "h-64") */
  height?: string;
  /** Spinner size in pixels (default: 32) */
  size?: number;
  /** Additional className for the container */
  className?: string;
}

export function LoadingOverlay({
  height = "h-64",
  size = 32,
  className,
}: LoadingOverlayProps) {
  return (
    <div className={cn("flex items-center justify-center", height, className)}>
      <Spinner size={size} className="text-muted-foreground" />
    </div>
  );
}
