import type { SVGProps } from "react";
import { cn } from "@/lib/utils";

interface SpinnerProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  /**
   * The size of the spinner in pixels.
   * @default 20
   */
  size?: number;
}

export const Spinner = ({
  className,
  size = 20,
  style,
  ...props
}: SpinnerProps) => {
  return (
    <span
      style={{
        display: 'inline-block',
        width: size,
        height: size,
        position: 'relative',
        // Contain layout to prevent animation from causing CLS
        contain: 'strict',
      }}
    >
      <svg
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        viewBox="0 0 24 24"
        strokeLinecap="round"
        strokeLinejoin="round"
        xmlns="http://www.w3.org/2000/svg"
        className={cn("stroke-muted-foreground", className)}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: size,
          height: size,
          // GPU compositing hints
          transform: 'translateZ(0)',
          willChange: 'transform',
          // Use CSS animation directly for better GPU compositing
          animation: 'spin 1s linear infinite',
          ...style
        }}
        {...props}
      >
        <path d="M12 3v3m6.366-.366-2.12 2.12M21 12h-3m.366 6.366-2.12-2.12M12 21v-3m-6.366.366 2.12-2.12M3 12h3m-.366-6.366 2.12 2.12" />
      </svg>
    </span>
  );
};
