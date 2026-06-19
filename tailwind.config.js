/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Print-proof palette — neutral light-gray paper + ink black.
        // (Calendar paper tints live in CARD_THEMES, applied via inline styles.)
        "paper": "#eaeaea",
        "ink": "#1a1a1a",
        "muted": "#6b675d",
      },
      borderRadius: {
        // Only pressable elements use this; containers stay square.
        pill: "99px",
      },
      fontFamily: {
        sans: ["Akt", "Pretendard", "-apple-system", "BlinkMacSystemFont", "sans-serif"],
      },
    },
  },
  plugins: [],
};
