/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        navy: {
          950: "#0B1426",
          900: "#11203A",
          850: "#162746",
          800: "#1C2D4A",
          700: "#28406B",
          600: "#3A5786",
        },
        vault: {
          50: "#FBF1D6",
          100: "#F5E6BE",
          300: "#E4C76C",
          400: "#D9BE5A",
          500: "#C9A227",
          600: "#A8841C",
          700: "#876911",
        },
        paper: "#F7F8FA",
        ink: "#0F172A",
      },
      fontFamily: {
        sans: ["var(--font-jakarta)", "system-ui", "-apple-system", "sans-serif"],
        ledger: ["var(--font-mono-ledger)", "ui-monospace", "SFMono-Regular", "monospace"],
      },
      boxShadow: {
        panel: "0 1px 2px 0 rgba(11, 20, 38, 0.04), 0 1px 8px -2px rgba(11, 20, 38, 0.06)",
      },
      keyframes: {
        "pulse-dot": {
          "0%, 100%": { opacity: "1", transform: "scale(1)" },
          "50%": { opacity: "0.45", transform: "scale(0.85)" },
        },
        "flicker-up": {
          "0%": { color: "#10B981" },
          "100%": { color: "inherit" },
        },
        "flicker-down": {
          "0%": { color: "#DC2626" },
          "100%": { color: "inherit" },
        },
      },
      animation: {
        "pulse-dot": "pulse-dot 1.8s ease-in-out infinite",
        "flicker-up": "flicker-up 900ms ease-out",
        "flicker-down": "flicker-down 900ms ease-out",
      },
    },
  },
  plugins: [],
};
