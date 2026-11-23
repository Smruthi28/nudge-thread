import type { Config } from "tailwindcss";

const token = (name: string) => `rgb(var(--${name}) / <alpha-value>)`;

const config: Config = {
  darkMode: "class",
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-inter)", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      colors: {
        canvas: token("canvas"),
        surface: token("surface"),
        raised: token("raised"),
        line: token("line"),
        fg: token("fg"),
        muted: token("muted"),
        subtle: token("subtle"),
        accent: {
          DEFAULT: token("accent"),
          fg: token("accent-fg"),
          soft: token("accent-soft"),
          strong: token("accent-strong"),
        },
        ok: { DEFAULT: token("ok"), soft: token("ok-soft") },
        warn: { DEFAULT: token("warn"), soft: token("warn-soft") },
        bad: { DEFAULT: token("bad"), soft: token("bad-soft") },
        maya: token("maya"),
        dev: token("dev"),
      },
      boxShadow: {
        card: "0 1px 2px rgb(0 0 0 / 0.04), 0 2px 8px rgb(0 0 0 / 0.04)",
        pop: "0 4px 12px rgb(0 0 0 / 0.08), 0 16px 40px rgb(0 0 0 / 0.10)",
      },
      keyframes: {
        "fade-up": {
          "0%": { opacity: "0", transform: "translateY(6px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "nudge-in": {
          "0%": { opacity: "0", transform: "translateY(-4px) scale(0.98)" },
          "100%": { opacity: "1", transform: "translateY(0) scale(1)" },
        },
        "bounce-dot": {
          "0%, 80%, 100%": { transform: "translateY(0)", opacity: "0.4" },
          "40%": { transform: "translateY(-3px)", opacity: "1" },
        },
        flash: {
          "0%": { backgroundColor: "rgb(var(--accent) / 0.10)" },
          "100%": { backgroundColor: "rgb(var(--accent) / 0)" },
        },
      },
      animation: {
        "fade-up": "fade-up 0.3s ease-out both",
        "nudge-in": "nudge-in 0.35s cubic-bezier(.2,.9,.3,1.2) both",
        "bounce-dot": "bounce-dot 1.2s ease-in-out infinite",
        flash: "flash 1.8s ease-out both",
      },
    },
  },
  plugins: [],
};

export default config;
