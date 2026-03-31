import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        coral: {
          DEFAULT: "#FF6B42",
          light: "#FF9B7A",
          deep: "#E8543A",
          wash: "#FFF5F0",
        },
        cream: "#FEFCFB",
        warm: {
          50: "#F5F1EE",
          100: "#E8E3DF",
          400: "#8A7F79",
          600: "#3D3632",
          900: "#1A1614",
        },
      },
      fontFamily: {
        sans: ["var(--font-sora)", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
