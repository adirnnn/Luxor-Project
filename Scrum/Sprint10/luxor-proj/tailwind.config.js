/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      // Colores como variables (globals.css): la tienda usa siempre los valores oscuros y la consola
      // del admin los cambia en modo claro (.admin-console[data-theme="light"]). Así todas las
      // pantallas del admin cambian de tema sin reescribir cada una.
      colors: {
        white: "rgb(var(--c-white) / <alpha-value>)",
        primary: {
          black: "rgb(var(--c-black) / <alpha-value>)", // Warm Desert Dusk (Deep Coffee/Earthy)
          gold: "rgb(var(--c-gold) / <alpha-value>)", // Metallic Gold
          champagne: "rgb(var(--c-champagne) / <alpha-value>)", // Bone White / Warm Ivory
          sand: "rgb(var(--c-sand) / <alpha-value>)",
          amber: "rgb(var(--c-amber) / <alpha-value>)",
        },
        secondary: {
          charcoal: "rgb(var(--c-charcoal) / <alpha-value>)", // Warmer charcoal for cards
          tan: "rgb(var(--c-tan) / <alpha-value>)",
        },
        // SFTWRKEY-353: Colores semánticos únicos para estados (éxito/error/advertencia/info),
        // en vez de que cada pantalla improvise su propio verde/rojo/amarillo genérico de Tailwind.
        status: {
          success: "rgb(var(--c-success) / <alpha-value>)", // Verde cálido, coherente con la paleta tierra
          "success-bg": "#4C9A6A26", // 15% opacidad para fondos de badges/alertas
          error: "rgb(var(--c-error) / <alpha-value>)", // Rojo terracota, no un rojo puro/frío
          "error-bg": "#C0524A26",
          warning: "rgb(var(--c-warning) / <alpha-value>)", // Ámbar dorado, cercano al primary-gold
          "warning-bg": "#C79A3B26",
          info: "rgb(var(--c-info) / <alpha-value>)",
          "info-bg": "#5B7C9926",
          // feedback del cliente (psicología del color en el panel): naranja = requiere acción ya,
          // violeta = en camino. Se distinguen del dorado de la marca.
          attention: "rgb(var(--c-attention) / <alpha-value>)",
          "attention-bg": "#D9822B26",
          transit: "rgb(var(--c-transit) / <alpha-value>)",
          "transit-bg": "#8A6FB026",
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