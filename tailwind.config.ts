import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Tokens extraídos da apresentação aprovada (assets/css/style.css)
        bg: "#F7F8FA",
        "bg-ice": "#FFFFFF",
        surface: "#F1F3F5",
        card: "#FFFFFF",
        ink: {
          DEFAULT: "#111318",
          soft: "#667085",
          muted: "#98A2B3",
        },
        border: {
          DEFAULT: "#E5E7EB",
          soft: "#EDEFF2",
        },
        // Marca — gradiente controlado (magenta → roxo → azul)
        magenta: "#F43F8E",
        purple: "#8B5CF6",
        indigo: "#4F46E5",
        blue: "#3B82F6",
        // Estados semânticos
        success: {
          DEFAULT: "#10B981",
          soft: "rgba(16,185,129,.10)",
        },
        danger: {
          DEFAULT: "#EF4444",
          soft: "rgba(239,68,68,.10)",
          softStrong: "rgba(239,68,68,.22)",
          softMid: "rgba(239,68,68,.16)",
        },
        warn: {
          DEFAULT: "#F59E0B",
          soft: "rgba(245,158,11,.12)",
        },
        info: {
          DEFAULT: "#3B82F6",
          soft: "rgba(59,130,246,.10)",
        },
        ai: {
          DEFAULT: "#8B5CF6",
          soft: "rgba(139,92,246,.10)",
        },
      },
      fontFamily: {
        display: ['"Sora"', '"Plus Jakarta Sans"', "system-ui", "sans-serif"],
        body: ['"Plus Jakarta Sans"', "system-ui", "-apple-system", "sans-serif"],
        data: ['"Space Grotesk"', "ui-monospace", '"SF Mono"', "monospace"],
      },
      borderRadius: {
        xs: "8px",
        sm: "12px",
        md: "16px",
        lg: "22px",
        xl: "28px",
        pill: "999px",
      },
      boxShadow: {
        xs: "0 1px 2px rgba(17,19,24,.04)",
        sm: "0 1px 2px rgba(17,19,24,.05), 0 4px 12px rgba(17,19,24,.04)",
        md: "0 2px 4px rgba(17,19,24,.05), 0 12px 32px rgba(17,19,24,.07)",
        lg: "0 4px 8px rgba(17,19,24,.06), 0 24px 56px rgba(17,19,24,.10)",
        brand: "0 8px 30px rgba(168,85,247,.25)",
        "brand-lg": "0 16px 48px rgba(168,85,247,.30)",
      },
      backgroundImage: {
        "brand-grad":
          "linear-gradient(115deg, #F43F8E 0%, #A855F7 45%, #6366F1 100%)",
        "brand-grad-soft":
          "linear-gradient(115deg, rgba(244,63,142,.10), rgba(168,85,247,.10), rgba(99,102,241,.10))",
        "brand-grad-vertical": "linear-gradient(160deg, #fff 0%, #FBF8FF 55%, #F8F6FF 100%)",
        "brand-grad-card": "linear-gradient(160deg, #fff 0%, #F9F6FF 60%, #F5F1FF 100%)",
      },
      maxWidth: {
        container: "1180px",
      },
      keyframes: {
        "fade-slide": {
          "0%": { opacity: "0", transform: "translateY(16px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        float: {
          "0%,100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-14px)" },
        },
        pulse: {
          "0%": { boxShadow: "0 0 0 0 rgba(16,185,129,.4)" },
          "70%": { boxShadow: "0 0 0 10px rgba(16,185,129,0)" },
          "100%": { boxShadow: "0 0 0 0 rgba(16,185,129,0)" },
        },
        "spin-slow": { to: { transform: "rotate(360deg)" } },
      },
      animation: {
        "fade-slide": "fade-slide .6s var(--ease-out) both",
        float: "float 7s ease-in-out infinite",
        pulse: "pulse 2.2s infinite",
        "spin-slow": "spin-slow 3s linear infinite",
      },
      transitionTimingFunction: {
        out: "cubic-bezier(.22,1,.36,1)",
        spring: "cubic-bezier(.34,1.56,.64,1)",
      },
    },
  },
  plugins: [],
};

export default config;
