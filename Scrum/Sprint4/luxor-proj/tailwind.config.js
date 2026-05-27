/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        primary: {
          black: "#2A1610", // Deep Brown Background
          gold: "#C5A059",  // Burnished Gold
          champagne: "#F7F4EF", // Warm Ivory
          beige: "#D8C2A8",
          nude: "#EAD7C5",
        },
        secondary: {
          brown: "#8F5C38", // Liquid Brun / Amber
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