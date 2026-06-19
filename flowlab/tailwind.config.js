/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        // Brand palette — "engineering lab" blues & cyans.
        brand: {
          50: "#eff8ff",
          100: "#dbeefe",
          200: "#bfe3ff",
          300: "#92d2ff",
          400: "#5fb8fc",
          500: "#3a98f5",
          600: "#2479ea",
          700: "#1d62d7",
          800: "#1e50ae",
          900: "#1e4589",
          950: "#172b54",
        },
        // Fluid accent — aqua / teal for water metaphors.
        aqua: {
          50: "#edfcfb",
          100: "#d2f7f5",
          200: "#aaeeec",
          300: "#71dfdd",
          400: "#34c7c7",
          500: "#19aaac",
          600: "#11888c",
          700: "#136d71",
          800: "#15585c",
          900: "#16494d",
          950: "#072b2e",
        },
      },
      fontFamily: {
        sans: [
          "Inter",
          "Noto Sans Thai",
          "system-ui",
          "-apple-system",
          "sans-serif",
        ],
        mono: ["JetBrains Mono", "ui-monospace", "SFMono-Regular", "monospace"],
      },
      keyframes: {
        "flow-dash": {
          to: { strokeDashoffset: "-100" },
        },
        "fade-in": {
          from: { opacity: "0", transform: "translateY(8px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "pulse-soft": {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.55" },
        },
      },
      animation: {
        "flow-dash": "flow-dash 1s linear infinite",
        "fade-in": "fade-in 0.4s ease-out both",
        "pulse-soft": "pulse-soft 2s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};
