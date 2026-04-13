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
    },
  },
  plugins: [],
};