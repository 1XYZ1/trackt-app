import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./src/pages/**/*.{ts,tsx}",
    "./src/components/**/*.{ts,tsx}",
    "./src/app/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#f0edff",
          100: "#ddd8ff",
          200: "#beb5ff",
          300: "#9b8fff",
          400: "#7c6ef5",
          500: "#6152e8",
          600: "#4e40d1",
          700: "#3d31b0",
          800: "#2e2488",
          900: "#1e1860",
          950: "#100d36",
        },
        estado: {
          asignado: {
            bg: "#0c1a2e",
            border: "#1e3a5f",
            dot: "#3b82f6",
            text: "#60a5fa",
          },
          cancelado: {
            bg: "#1c0a0a",
            border: "#450a0a",
            dot: "#ef4444",
            text: "#f87171",
          },
          cerrado: {
            bg: "#052e16",
            border: "#166534",
            dot: "#16a34a",
            text: "#86efac",
          },
          ejecutado: {
            bg: "#0a1f12",
            border: "#14532d",
            dot: "#22c55e",
            text: "#4ade80",
          },
          en_ejecucion: {
            bg: "#1c1400",
            border: "#3d2e00",
            dot: "#f59e0b",
            text: "#fbbf24",
          },
          pendiente: {
            bg: "#262626",
            border: "#3a3a3a",
            dot: "#737373",
            text: "#a0a0a0",
          },
        },
        surface: {
          50: "#f8f8f8",
          100: "#f0f0f0",
          200: "#e4e4e4",
          300: "#c8c8c8",
          400: "#a0a0a0",
          500: "#737373",
          600: "#525252",
          700: "#3a3a3a",
          800: "#262626",
          900: "#171717",
          950: "#0d0d0d",
        },
      },
      fontFamily: {
        mono: ["var(--font-geist-mono)", "monospace"],
        sans: ["var(--font-geist-sans)", "system-ui", "sans-serif"],
      },
      borderRadius: {
        "4xl": "2rem",
      },
      boxShadow: {
        card: "0 1px 3px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.04)",
        "card-hover":
          "0 4px 16px rgba(0,0,0,0.5), 0 0 0 1px rgba(97,82,232,0.3)",
        "glow-brand": "0 0 20px rgba(97, 82, 232, 0.25)",
        "glow-sm": "0 0 8px rgba(97, 82, 232, 0.15)",
      },
      animation: {
        "fade-in": "fadeIn 0.2s ease-out",
        "pulse-dot": "pulseDot 2s ease-in-out infinite",
        "slide-up": "slideUp 0.25s ease-out",
      },
      keyframes: {
        fadeIn: { "0%": { opacity: "0" }, "100%": { opacity: "1" } },
        pulseDot: {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.4" },
        },
        slideUp: {
          "0%": { opacity: "0", transform: "translateY(6px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
      },
    },
  },
  plugins: [],
};

export default config;
