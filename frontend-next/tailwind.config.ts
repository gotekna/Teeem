import type { Config } from "tailwindcss";
import tailwindcssAnimate from "tailwindcss-animate";

export default {
  darkMode: ["class"],
  content: ["./src/**/*.{ts,tsx}", "./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  safelist: ["dark", "light"],
  theme: {
    extend: {
      /* ========================================
         TEKNA BRAND GUIDELINES - TAILWIND TOKENS
         ======================================== */

      fontFamily: {
        sans: "var(--font-sans)",
        mono: "var(--font-mono)",
        serif: "var(--font-serif)",
      },

      fontSize: {
        // Brand guideline sizes
        "brand-xs": "var(--text-xs)",     // 10px - Small pills, tags
        "brand-sm": "var(--text-sm)",     // 11px - Labels, invoice body, table cells
        "brand-base": "var(--text-base)", // 12px - Small text, badges
        "brand-md": "var(--text-md)",     // 14px - Body text (default)
        "brand-lg": "var(--text-lg)",     // 21px - Document titles, totals
        "brand-xl": "var(--text-xl)",     // 32px - Large headings
      },

      spacing: {
        // Brand guideline spacing
        "brand-1": "var(--space-1)",   // 4px
        "brand-2": "var(--space-2)",   // 8px
        "brand-3": "var(--space-3)",   // 12px
        "brand-4": "var(--space-4)",   // 16px
        "brand-6": "var(--space-6)",   // 24px
        "brand-8": "var(--space-8)",   // 32px
        // Document dimensions
        "doc-width": "var(--doc-width)",
        "doc-height": "var(--doc-height)",
        "doc-padding": "var(--doc-padding)",
      },

      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",

        // Text colors from brand guidelines
        "text-primary": "hsl(var(--text-primary))",
        "text-secondary": "hsl(var(--text-secondary))",   // #606060
        "text-muted": "hsl(var(--text-muted))",           // #878787

        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },

        // Status colors from brand guidelines
        status: {
          success: {
            DEFAULT: "hsl(var(--status-success-bg))",
            foreground: "hsl(var(--status-success-text))",
          },
          warning: {
            DEFAULT: "hsl(var(--status-warning-bg))",
            foreground: "hsl(var(--status-warning-text))",
          },
          error: {
            DEFAULT: "hsl(var(--status-error-bg))",
            foreground: "hsl(var(--status-error-text))",
          },
          info: {
            DEFAULT: "hsl(var(--status-info-bg))",
            foreground: "hsl(var(--status-info-text))",
          },
        },

        // Accent colors
        "accent-blue": "hsl(var(--accent-blue))",
        "accent-today": "hsl(var(--accent-today))",

        // Chart colors
        chart: {
          grid: "var(--chart-grid-stroke)",
          axis: "var(--chart-axis-text)",
          line: "var(--chart-actual-line)",
          "line-secondary": "var(--chart-line-secondary)",
          bar: "var(--chart-bar-fill)",
          "bar-secondary": "var(--chart-bar-fill-secondary)",
        },
      },

      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
        none: "var(--radius-none)",
      },

      keyframes: {
        // GPU-optimized spinner animation to prevent CLS
        // Uses rotate3d instead of rotate for better compositing
        "spinner-rotate": {
          "0%": { transform: "rotate3d(0, 0, 1, 0deg)" },
          "100%": { transform: "rotate3d(0, 0, 1, 360deg)" },
        },
        // GPU-optimized shimmer animation using transform instead of background-position
        // transform is GPU-compositable and won't cause CLS (layout shifts)
        shimmer: {
          "0%": { transform: "translateX(-100%)" },
          "100%": { transform: "translateX(100%)" },
        },
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
        jiggle: {
          "0%": {
            transform: "rotate(-4deg)",
          },
          "50%": {
            transform: "rotate(4deg)",
          },
        },
        "caret-blink": {
          "0%,70%,100%": { opacity: "1" },
          "20%,50%": { opacity: "0" },
        },
        scroll: {
          to: {
            transform: "translate(calc(-50% - 0.5rem))",
          },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "caret-blink": "caret-blink 1.25s ease-out infinite",
        shimmer: "shimmer 2.5s linear infinite",
        scroll:
          "scroll var(--animation-duration, 40s) var(--animation-direction, forwards) linear infinite",
        // GPU-optimized spinner that won't cause CLS
        "spinner": "spinner-rotate 1s linear infinite",
      },
      screens: {
        "3xl": "1800px",
      },
    },
  },
  plugins: [tailwindcssAnimate],
} satisfies Config;
