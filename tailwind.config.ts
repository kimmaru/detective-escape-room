import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        detective: {
          bg: "#1a1614",
          card: "#26211e",
          paper: "#efe6d5",
          paperDark: "#ded0b8",
          ink: "#2c221e",
          accent: "#d4a373",
          gold: "#e6af2e",
          red: "#b91c1c",
          stamp: "#dc2626",
          board: "#3e2723",
        },
      },
      fontFamily: {
        serif: ["Georgia", "Cambria", "serif"],
        mono: ["Courier New", "Menlo", "monospace"],
      },
    },
  },
  plugins: [],
};
export default config;
