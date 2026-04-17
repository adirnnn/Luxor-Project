/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        primary: {
          black: "#0F0F10",
          gold: "#D6C3A3",
          champagne: "#F2E8DC",
          beige: "#D8C2A8",
          nude: "#EAD7C5",
        },
        secondary: {
          brown: "#8B6A4E",
          rose: "#CFA18D",
          emerald: "#2F6B5F",
        },
      },
      fontFamily: {
        heading: ["Playfair Display", "serif"],
        body: ["Inter", "sans-serif"],
      },
      fontSize: {
        h1: ["3.2rem", { lineHeight: "1.02", letterSpacing: "-0.02em" }],
        h2: ["2.2rem", { lineHeight: "1.15" }],
        h3: ["1.25rem", { lineHeight: "1.3" }],
        body: ["1rem", { lineHeight: "1.6" }],
      },
      maxWidth: {
        content: "1200px",
      },
      spacing: {
        "section-sm": "3rem",
        "section-md": "5rem",
        "section-lg": "7rem",
      },
      boxShadow: {
        soft: "0 4px 24px rgba(0,0,0,0.06)",
      },
    },
  },
  plugins: [],
};