/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        primary: {
          black: "#1A1614", // Warm Desert Dusk (Deep Coffee/Earthy)
          gold: "#D4AF37",  // Metallic Gold
          champagne: "#FDFCFB", // Bone White / Warm Ivory
          sand: "#E5D3B3", 
          amber: "#9B673C",
        },
        secondary: {
          charcoal: "#2A2522", // Warmer charcoal for cards
          tan: "#C2A17E",
        },
      },
      fontFamily: {
        heading: ["Bodoni Moda", "serif"],
        body: ["Cormorant Garamond", "serif"],
        brand: ["Abogia", "serif"],
        sans: ["Montserrat", "sans-serif"],
        mono: ["Space Mono", "monospace"],
      },
      fontSize: {
        h1: ["7.5rem", { lineHeight: "0.85", letterSpacing: "-0.02em" }],
        h2: ["4.5rem", { lineHeight: "1", letterSpacing: "-0.01em" }],
        h3: ["2.5rem", { lineHeight: "1.1" }],
        body: ["1.25rem", { lineHeight: "1.6" }],
        xs: ["0.8rem", { lineHeight: "1.5", letterSpacing: "0.15em" }],
      },
      borderRadius: {
        'button': '100px', // Ultra-rounded modern buttons
        'card': '32px', // Softer, modern corners
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