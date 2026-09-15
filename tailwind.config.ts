import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  darkMode: "media",
  theme: {
    extend: {
      colors: {
        surface: "#fcfcfb",
        "surface-dark": "#1a1a19",
        plane: "#f9f9f7",
        "plane-dark": "#0d0d0d",
        ink: "#0b0b0b",
        "ink-dark": "#ffffff",
        "ink-secondary": "#52514e",
        "ink-secondary-dark": "#c3c2b7",
        "ink-muted": "#898781",
        grid: "#e1e0d9",
        "grid-dark": "#2c2c2a",
        series: {
          1: "#2a78d6",
          2: "#eb6834",
          3: "#1baf7a",
          4: "#eda100",
          5: "#e87ba4",
          6: "#008300",
          7: "#4a3aa7",
          8: "#e34948",
        },
        status: {
          good: "#0ca30c",
          warning: "#fab219",
          serious: "#ec835a",
          critical: "#d03b3b",
        },
      },
    },
  },
  plugins: [],
};

export default config;
