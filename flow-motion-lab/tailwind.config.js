/** @type {import('tailwindcss').Config} */
export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Lab surface palette driven by CSS variables (see index.css)
        surface: {
          DEFAULT: "rgb(var(--surface) / <alpha-value>)",
          soft: "rgb(var(--surface-soft) / <alpha-value>)",
          raised: "rgb(var(--surface-raised) / <alpha-value>)",
        },
        ink: {
          DEFAULT: "rgb(var(--ink) / <alpha-value>)",
          soft: "rgb(var(--ink-soft) / <alpha-value>)",
          faint: "rgb(var(--ink-faint) / <alpha-value>)",
        },
        line: "rgb(var(--line) / <alpha-value>)",
        flow: {
          50: "#ecfeff",
          100: "#cffafe",
          200: "#a5f3fc",
          300: "#67e8f9",
          400: "#22d3ee",
          500: "#06b6d4",
          600: "#0891b2",
          700: "#0e7490",
          800: "#155e75",
          900: "#164e63",
        },
        deep: {
          500: "#3b82f6",
          600: "#2563eb",
          700: "#1d4ed8",
        },
        // Violet accent — pairs with flow (cyan) + deep (blue) to form the
        // cyan → blue → violet "aurora" gradient used across the new visuals.
        iris: {
          300: "#c4b5fd",
          400: "#a78bfa",
          500: "#8b5cf6",
          600: "#7c3aed",
          700: "#6d28d9",
        },
      },
      fontFamily: {
        sans: [
          '"IBM Plex Sans Thai"',
          '"Noto Sans Thai"',
          "ui-sans-serif",
          "system-ui",
          "sans-serif",
        ],
        mono: ['"JetBrains Mono"', "ui-monospace", "monospace"],
      },
      boxShadow: {
        lab: "0 1px 2px rgb(15 23 42 / 0.04), 0 8px 24px -12px rgb(15 23 42 / 0.18)",
        glow: "0 0 0 1px rgb(34 211 238 / 0.3), 0 8px 30px -8px rgb(34 211 238 / 0.45)",
        "glow-lg":
          "0 0 0 1px rgb(34 211 238 / 0.25), 0 18px 60px -18px rgb(34 211 238 / 0.55), 0 8px 24px -12px rgb(124 58 237 / 0.4)",
        glass:
          "inset 0 1px 0 0 rgb(255 255 255 / 0.08), 0 16px 50px -24px rgb(8 13 24 / 0.7)",
      },
      backgroundImage: {
        "aurora-text": "linear-gradient(110deg, #22d3ee 0%, #3b82f6 45%, #a78bfa 100%)",
      },
      keyframes: {
        "fade-in": {
          from: { opacity: "0", transform: "translateY(6px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "pulse-soft": {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.55" },
        },
        // Slow drift for the ambient aurora orbs behind the page.
        float: {
          "0%, 100%": { transform: "translate3d(0,0,0) scale(1)" },
          "50%": { transform: "translate3d(0,-4%,0) scale(1.06)" },
        },
        // Pans a wide gradient so headline text shimmers like flowing light.
        "gradient-pan": {
          "0%, 100%": { "background-position": "0% 50%" },
          "50%": { "background-position": "100% 50%" },
        },
        // Sweeping sheen across primary buttons.
        sheen: {
          "0%": { transform: "translateX(-120%)" },
          "60%, 100%": { transform: "translateX(220%)" },
        },
        // Staggered card entrance.
        rise: {
          from: { opacity: "0", transform: "translateY(18px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        "fade-in": "fade-in 0.4s ease-out both",
        "pulse-soft": "pulse-soft 2s ease-in-out infinite",
        float: "float 14s ease-in-out infinite",
        "float-slow": "float 22s ease-in-out infinite",
        "gradient-pan": "gradient-pan 8s ease-in-out infinite",
        sheen: "sheen 4.5s ease-in-out infinite",
        rise: "rise 0.6s cubic-bezier(0.22, 1, 0.36, 1) both",
      },
    },
  },
  plugins: [],
};
