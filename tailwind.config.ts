import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./hooks/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        f1red: "#e10600",
        ink: "#0a0a0d",
        panel: "#121218",
        border: "rgba(255,255,255,0.10)",
        tyre: {
          S: "#ef4444",
          M: "#eab308",
          H: "#e5e7eb",
          I: "#22c55e",
          W: "#3b82f6",
        },
      },
      fontFamily: {
        mono: ["var(--font-mono)", "ui-monospace", "SFMono-Regular", "monospace"],
      },
    },
  },
  plugins: [],
};

export default config;
